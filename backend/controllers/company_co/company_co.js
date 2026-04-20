const crypto = require('crypto');
const { pool } = require('../../utils/db');
const { sendEmail } = require('../../utils/send_email');
const { hashPassword, getPasswordPepper } = require('../../utils/password');

function normalizeEmail(email) {
  return (email || '').trim().toLowerCase();
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(email));
}

function buildFallbackName(email) {
  const localPart = normalizeEmail(email).split('@')[0] || 'User';
  return localPart
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ') || 'User';
}

async function getCoordinatorAndCompanyDetails(client, coordinator) {
  const companyIdentifier = coordinator.company_identifier || null;
  let companyCoordinatorName = '';
  let companyName = '';

  if (coordinator.id) {
    const coordinatorResult = await client.query(
      `
        SELECT emp_name
        FROM ifc_users
        WHERE id = $1
      `,
      [coordinator.id]
    );
    companyCoordinatorName = coordinatorResult.rows[0]?.emp_name || '';
  }

  if (companyIdentifier) {
    const companyResult = await client.query(
      `
        SELECT company_name
        FROM companies
        WHERE company_identifier = $1
        LIMIT 1
      `,
      [companyIdentifier]
    );
    companyName = companyResult.rows[0]?.company_name || '';
  }

  return {
    companyIdentifier,
    companyCoordinatorName,
    companyDisplayName: companyName || 'your company',
  };
}

async function createCompanyUser(client, coordinator, payload = {}) {
  getPasswordPepper();

  const emailId = normalizeEmail(payload.email_id);
  const empCode = payload.emp_code && payload.emp_code.trim() ? payload.emp_code.trim() : null;
  const empName = payload.emp_name && payload.emp_name.trim() ? payload.emp_name.trim() : buildFallbackName(emailId);
  const designation = payload.designation && payload.designation.trim() ? payload.designation.trim() : null;
  const department = payload.department && payload.department.trim() ? payload.department.trim() : null;
  const mobile = payload.mobile && payload.mobile.trim() ? payload.mobile.trim() : null;

  if (!emailId) {
    const error = new Error('Email ID is required');
    error.statusCode = 400;
    throw error;
  }

  if (!isValidEmail(emailId)) {
    const error = new Error('Invalid email format');
    error.statusCode = 400;
    throw error;
  }

  if (mobile && !/^[0-9]{10}$/.test(mobile)) {
    const error = new Error('Mobile number must be 10 digits');
    error.statusCode = 400;
    throw error;
  }

  const existingUser = await client.query(
    'SELECT id FROM ifc_users WHERE LOWER(TRIM(email_id)) = $1 LIMIT 1',
    [emailId]
  );

  if (existingUser.rows.length > 0) {
    const error = new Error('User with this email already exists');
    error.statusCode = 409;
    throw error;
  }

  const tempPassword = crypto.randomBytes(8).toString('hex');
  const tempPasswordHash = await hashPassword(tempPassword);
  const { companyIdentifier, companyCoordinatorName, companyDisplayName } =
    await getCoordinatorAndCompanyDetails(client, coordinator);

  const userResult = await client.query(
    `
      INSERT INTO ifc_users (
        email_id,
        password,
        role,
        company_identifier,
        temp_login,
        emp_code,
        emp_name,
        designation,
        department,
        mobile
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING id, email_id, company_identifier
    `,
    [
      emailId,
      tempPasswordHash,
      'user',
      companyIdentifier,
      1,
      empCode,
      empName,
      designation,
      department,
      mobile,
    ]
  );

  const emailSubject = 'Welcome to IFC - Let\'s get started';
  const emailText = `Hi ${empName},

Hope you're having a good week!

I am ${companyCoordinatorName} at ${companyDisplayName} organization. We have been engaged to carry out an internal financial control review. This is a yearly exercise. If you have not participated before, we’ve put together a short introductory video (just a few minutes) to get you up to speed. You can watch it here: [Video Link]

Here is a brief overview of Internal Financial Controls.

Internal financial controls are the everyday steps we take to keep our financial information accurate and safe. IFC testing checks whether those steps are working.

The control flow is as follows: You upload evidence that you've performed the control. Our tester reviews it and passes or fails the control based on whether it is working effectively. That's it!

Your evidence is the proof that shows our controls are doing their job.

Here are your login credentials. (This is a temporary password, please change it after logging in.)

Email ID: ${emailId}
Password: ${tempPassword}
Portal: ${process.env.FRONTEND_URL}

Thanks & Regards,
${companyCoordinatorName}
Sharp and Tannan Associates
    `;

  const emailSent = await sendEmail(emailId, emailSubject, emailText);

  return {
    user: userResult.rows[0],
    emailSent,
  };
}

async function getUsers(req, res) {
  try {
    const companyIdentifier = req.user.company_identifier;

    if (!companyIdentifier) {
      return res.status(200).json({
        success: true,
        users: [],
      });
    }

    const roleParam = req.query.role != null ? String(req.query.role).trim() : '';
    const qRaw = req.query.q != null ? String(req.query.q).trim() : '';
    const limitRaw = req.query.limit;

    let query = `
      SELECT email_id, role, emp_name, designation, department, mobile
      FROM ifc_users
      WHERE company_identifier = $1
    `;
    const params = [companyIdentifier];
    let paramIndex = 2;

    if (roleParam) {
      query += ` AND role = $${paramIndex}`;
      params.push(roleParam);
      paramIndex++;
    }

    if (qRaw) {
      query += ` AND (
        LOWER(COALESCE(emp_name, '')) LIKE $${paramIndex}
        OR LOWER(TRIM(email_id)) LIKE $${paramIndex}
      )`;
      params.push(`%${qRaw.toLowerCase()}%`);
      paramIndex++;
    }

    query += ' ORDER BY created_at DESC';

    if (limitRaw !== undefined && limitRaw !== '') {
      const limitNum = parseInt(String(limitRaw), 10);
      if (!Number.isNaN(limitNum) && limitNum > 0) {
        const capped = Math.min(limitNum, 200);
        query += ` LIMIT $${paramIndex}`;
        params.push(capped);
      }
    }

    const usersResult = await pool.query(query, params);

    return res.status(200).json({
      success: true,
      users: usersResult.rows,
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch users',
    });
  }
}

async function getHomeStats(req, res) {
  try {
    const companyIdentifier = req.user.company_identifier;

    if (!companyIdentifier) {
      return res.status(200).json({
        success: true,
        data: {
          coordinatorName: req.user.emp_name || req.user.email_id || 'User',
          totalUsers: 0,
          totalRacms: 0,
          approvedRacms: 0,
          rejectedRacms: 0,
        },
      });
    }

    const [usersResult, racmResult] = await Promise.all([
      pool.query(
        `
          SELECT COUNT(*)::int AS total_users
          FROM ifc_users
          WHERE company_identifier = $1
            AND role = 'user'
        `,
        [companyIdentifier]
      ),
      pool.query(
        `
          SELECT
            COUNT(*)::int AS total_racms,
            COUNT(*) FILTER (
              WHERE LOWER(TRIM(COALESCE(status, ''))) = 'approved'
            )::int AS approved_racms,
            COUNT(*) FILTER (
              WHERE LOWER(TRIM(COALESCE(status, ''))) = 'rejected'
            )::int AS rejected_racms
          FROM control_forms
          WHERE company_identifier = $1
        `,
        [companyIdentifier]
      ),
    ]);

    const userRow = usersResult.rows[0] || {};
    const racmRow = racmResult.rows[0] || {};

    return res.status(200).json({
      success: true,
      data: {
        coordinatorName: req.user.emp_name || req.user.email_id || 'User',
        totalUsers: Number(userRow.total_users || 0),
        totalRacms: Number(racmRow.total_racms || 0),
        approvedRacms: Number(racmRow.approved_racms || 0),
        rejectedRacms: Number(racmRow.rejected_racms || 0),
      },
    });
  } catch (error) {
    console.error('Company coordinator home stats error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch company coordinator home stats',
    });
  }
}

async function createUser(req, res) {
  const {
    email_id,
    emp_code,
    emp_name,
    designation,
    department,
    mobile,
  } = req.body;
  const coordinator = req.user;

  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    const { user: newUser, emailSent } = await createCompanyUser(client, coordinator, {
      email_id,
      emp_code,
      emp_name,
      designation,
      department,
      mobile,
    });

    if (!emailSent) {
      console.warn(`Warning: Failed to send email to ${newUser.email_id}, but user was created successfully.`);
    } else {
      console.log(`✓ User creation email sent successfully to ${newUser.email_id}`);
    }

    await client.query('COMMIT');
    await new Promise((resolve) => setTimeout(resolve, 500));

    return res.status(201).json({
      success: true,
      message: 'User created successfully',
      user: {
        id: newUser.id,
        email_id: newUser.email_id,
        company_identifier: newUser.company_identifier,
      },
      emailSent,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating user:', error);

    if (error.statusCode) {
      return res.status(error.statusCode).json({
        success: false,
        message: error.message,
      });
    }

    if (error.code === '23505') {
      return res.status(409).json({
        success: false,
        message: 'User with this email already exists',
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  } finally {
    client.release();
  }
}

async function createUsersBulk(req, res) {
  const coordinator = req.user;
  const inputEmails = Array.isArray(req.body?.email_ids) ? req.body.email_ids : [];
  const normalizedEmails = [...new Set(inputEmails.map(normalizeEmail).filter(Boolean))];
  const invalidEmails = normalizedEmails.filter((email) => !isValidEmail(email));
  const emailIds = normalizedEmails.filter((email) => isValidEmail(email));

  if (emailIds.length === 0) {
    return res.status(400).json({
      success: false,
      message: invalidEmails.length > 0
        ? 'No valid email IDs found for user creation'
        : 'At least one email ID is required',
      invalidEmails,
    });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const createdUsers = [];
    const skippedEmails = [];

    for (const emailId of emailIds) {
      try {
        const { user, emailSent } = await createCompanyUser(client, coordinator, { email_id: emailId });
        createdUsers.push({
          id: user.id,
          email_id: user.email_id,
          company_identifier: user.company_identifier,
          emailSent,
        });
      } catch (error) {
        if (error.statusCode === 409) {
          skippedEmails.push(emailId);
          continue;
        }
        throw error;
      }
    }

    await client.query('COMMIT');

    return res.status(201).json({
      success: true,
      message: `Created ${createdUsers.length} user(s) successfully`,
      createdUsers,
      skippedEmails,
      invalidEmails,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating users in bulk:', error);

    if (error.statusCode) {
      return res.status(error.statusCode).json({
        success: false,
        message: error.message,
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  } finally {
    client.release();
  }
}

async function deleteUsers(req, res) {
  const coordinator = req.user;
  const companyIdentifier = coordinator.company_identifier;

  const emailIdsInput = Array.isArray(req.body?.email_ids) ? req.body.email_ids : [];
  const normalizedEmails = [...new Set(emailIdsInput.map(normalizeEmail).filter(Boolean))];
  const invalidEmails = normalizedEmails.filter((email) => !isValidEmail(email));

  if (!companyIdentifier) {
    return res.status(400).json({
      success: false,
      message: 'Company identifier is missing for coordinator',
    });
  }

  if (normalizedEmails.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'No valid user emails provided for deletion',
    });
  }

  if (invalidEmails.length > 0) {
    return res.status(400).json({
      success: false,
      message: 'Invalid email format',
      invalidEmails,
    });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const deactivatedRacmsQuery = `
      UPDATE control_forms
      SET control_owner = NULL,
          active = '0'
      WHERE company_identifier = $1
        AND LOWER(TRIM(control_owner)) = ANY($2::text[])
    `;

    const deactivatedRacmsResult = await client.query(deactivatedRacmsQuery, [companyIdentifier, normalizedEmails]);

    const deletedUsersQuery = `
      DELETE FROM ifc_users
      WHERE company_identifier = $1
        AND role = 'user'
        AND LOWER(TRIM(email_id)) = ANY($2::text[])
      RETURNING email_id
    `;

    const deletedUsersResult = await client.query(deletedUsersQuery, [companyIdentifier, normalizedEmails]);

    await client.query('COMMIT');

    return res.status(200).json({
      success: true,
      message: `Deleted ${deletedUsersResult.rowCount} user(s) successfully`,
      deleted_users: deletedUsersResult.rows.map((row) => row.email_id),
      deactivated_racms: deactivatedRacmsResult.rowCount,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error deleting users:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete user(s)',
    });
  } finally {
    client.release();
  }
}

async function checkUser(req, res) {
  let { email } = req.params;

  try {
    email = decodeURIComponent(email);
  } catch (decodeError) {
    console.warn('Failed to decode email parameter, using as-is:', decodeError);
  }

  email = email.trim().toLowerCase();

  if (!isValidEmail(email)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid email format',
      exists: false,
    });
  }

  try {
    const companyIdentifier = (req.user && req.user.company_identifier) || null;

    if (!companyIdentifier) {
      console.warn('Company coordinator does not have company_identifier');
      return res.status(200).json({
        success: true,
        exists: false,
      });
    }

    const checkUserQuery = `
      SELECT 1
      FROM ifc_users
      WHERE LOWER(TRIM(email_id)) = $1
        AND company_identifier = $2
        AND role = 'user'
      LIMIT 1
    `;

    const existingUser = await pool.query(checkUserQuery, [email, companyIdentifier]);

    console.log(`User check for ${email} in company ${companyIdentifier}: ${existingUser.rows.length > 0 ? 'FOUND' : 'NOT FOUND'}`);

    return res.status(200).json({
      success: true,
      exists: existingUser.rows.length > 0,
    });
  } catch (error) {
    console.error('Error checking user:', error);
    return res.status(500).json({
      success: false,
      message: 'Error checking user existence',
      exists: false,
    });
  }
}

async function checkUserRole(req, res) {
  let { email } = req.params;

  try {
    email = decodeURIComponent(email);
  } catch (decodeError) {
    console.warn('Failed to decode email parameter, using as-is:', decodeError);
  }

  email = email.trim().toLowerCase();

  if (!isValidEmail(email)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid email format',
      exists: false,
      role: null,
    });
  }

  try {
    const companyIdentifier = (req.user && req.user.company_identifier) || null;

    if (!companyIdentifier) {
      return res.status(200).json({
        success: true,
        exists: false,
        role: null,
      });
    }

    const checkUserQuery = `
      SELECT role
      FROM ifc_users
      WHERE LOWER(TRIM(email_id)) = $1
        AND company_identifier = $2
      LIMIT 1
    `;

    const existingUser = await pool.query(checkUserQuery, [email, companyIdentifier]);

    if (!existingUser.rows.length) {
      return res.status(200).json({
        success: true,
        exists: false,
        role: null,
      });
    }

    return res.status(200).json({
      success: true,
      exists: true,
      role: existingUser.rows[0]?.role || null,
    });
  } catch (error) {
    console.error('Error checking user role:', error);
    return res.status(500).json({
      success: false,
      message: 'Error checking user role',
      exists: false,
      role: null,
    });
  }
}

async function getRacmAuditLogs(req, res) {
  try {
    const { form_id } = req.params;
    const companyIdentifier = req.user.company_identifier;
    if (!companyIdentifier) {
      return res.status(403).json({
        success: false,
        message: 'Company not associated with user',
      });
    }

    const own = await pool.query(
      'SELECT 1 FROM control_forms WHERE form_id = $1 AND company_identifier = $2 LIMIT 1',
      [form_id, companyIdentifier]
    );
    if (own.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'RACM not found',
      });
    }

    const result = await pool.query(
      `
      SELECT id, timestamp, action, user_email_id, form_id, ref_data
      FROM audit_logs_racm
      WHERE form_id = $1
      ORDER BY timestamp ASC NULLS LAST, id ASC
    `,
      [form_id]
    );

    return res.status(200).json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    console.error('Get RACM audit logs (company_co) error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
}

module.exports = {
  getUsers,
  getHomeStats,
  createUser,
  createUsersBulk,
  deleteUsers,
  checkUser,
  checkUserRole,
  getRacmAuditLogs,
};
