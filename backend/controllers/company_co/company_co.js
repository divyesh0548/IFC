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

function generateUnitIdentifier(unitName) {
  const namePart = String(unitName || 'UNIT')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toUpperCase()
    .substring(0, 6)
    .padEnd(6, 'X');

  const randomPart = crypto.randomBytes(2).toString('hex').toUpperCase().substring(0, 4);

  return (namePart + randomPart).substring(0, 10);
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
  const empName = payload.emp_name && payload.emp_name.trim() ? payload.emp_name.trim() : null;
  const emailGreeting = empName ? `Hi ${empName},` : 'Hi,';
  const designation = payload.designation && payload.designation.trim() ? payload.designation.trim() : null;
  const department = payload.department && payload.department.trim() ? payload.department.trim() : null;
  const mobile = payload.mobile && payload.mobile.trim() ? payload.mobile.trim() : null;
  const unitId = payload.unit_id && String(payload.unit_id).trim() ? String(payload.unit_id).trim() : null;

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

  const companyIdentifier = coordinator.company_identifier || null;

  if (unitId) {
    if (!companyIdentifier) {
      const error = new Error('Company identifier is required');
      error.statusCode = 400;
      throw error;
    }

    const assignedUnitResult = await client.query(
      `
        SELECT unit_id
        FROM company_unit_master
        WHERE company_identifier = $1
          AND unit_id = $2
          AND LOWER(TRIM(COALESCE(coordinator_email_id, ''))) = $3
        LIMIT 1
      `,
      [companyIdentifier, unitId, normalizeEmail(coordinator.email_id)]
    );

    if (assignedUnitResult.rows.length === 0) {
      const error = new Error('Selected unit is not mapped with this company coordinator');
      error.statusCode = 403;
      throw error;
    }
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
  const { companyCoordinatorName, companyDisplayName } =
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
        mobile,
        unit_id
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING id, email_id, company_identifier, unit_id
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
      unitId,
    ]
  );

  const emailSubject = 'Welcome to IFC - Let\'s get started';
  const emailText = `${emailGreeting}

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
${companyDisplayName}
    `;

  const emailSent = await sendEmail(emailId, emailSubject, emailText);

  return {
    user: userResult.rows[0],
    emailSent,
  };
}

function getUnitMappingRoleConfig(role) {
  if (role === 'company_co') {
    return {
      role,
      columnName: 'coordinator_email_id',
      roleLabel: 'Company Coordinator',
    };
  }

  if (role === 'approver') {
    return {
      role,
      columnName: 'approver_email_id',
      roleLabel: 'Approver',
    };
  }

  return null;
}

async function createUnitMappedPrivilegedUser(client, coordinator, payload = {}, role) {
  getPasswordPepper();

  const config = getUnitMappingRoleConfig(role);
  if (!config) {
    const error = new Error('Invalid role');
    error.statusCode = 400;
    throw error;
  }

  const companyIdentifier = coordinator.company_identifier;
  const emailId = normalizeEmail(payload.email_id);
  const unitId = payload.unit_id && String(payload.unit_id).trim() ? String(payload.unit_id).trim() : '';

  if (!companyIdentifier) {
    const error = new Error('Company identifier is required');
    error.statusCode = 400;
    throw error;
  }

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

  if (!unitId) {
    const error = new Error('Unit is required');
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

  const unitResult = await client.query(
    `
      SELECT id, unit_id, unit_name
      FROM company_unit_master
      WHERE company_identifier = $1
        AND unit_id = $2
        AND COALESCE(TRIM(${config.columnName}), '') = ''
      FOR UPDATE
    `,
    [companyIdentifier, unitId]
  );

  if (unitResult.rows.length === 0) {
    const error = new Error(`${config.roleLabel} is already mapped for this unit`);
    error.statusCode = 409;
    throw error;
  }

  const tempPassword = crypto.randomBytes(8).toString('hex');
  const tempPasswordHash = await hashPassword(tempPassword);

  const userResult = await client.query(
    `
      INSERT INTO ifc_users (email_id, password, role, company_identifier, temp_login)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, email_id, role, company_identifier
    `,
    [emailId, tempPasswordHash, config.role, companyIdentifier, 1]
  );

  await client.query(
    `
      UPDATE company_unit_master
      SET ${config.columnName} = $1
      WHERE id = $2
    `,
    [emailId, unitResult.rows[0].id]
  );

  const companyResult = await client.query(
    'SELECT company_name FROM companies WHERE company_identifier = $1 LIMIT 1',
    [companyIdentifier]
  );
  const companyName = companyResult.rows[0]?.company_name || 'your company';
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173/user/login';

  const emailSubject = `Welcome to ${companyName} - Your Temporary Login Credentials`;
  const emailText = `
Dear ${config.roleLabel},

Your company account has been created successfully.

Company: ${companyName}

Your temporary login credentials:
Email: ${emailId}
Temporary Password: ${tempPassword}

IMPORTANT: Please login using these credentials and update your password immediately for security purposes.

Login URL: ${frontendUrl}

After logging in, you will be prompted to update your temporary password to a permanent one.

Best regards,
IFC System
        `;

  const emailSent = await sendEmail(emailId, emailSubject, emailText);

  return {
    user: userResult.rows[0],
    unit: unitResult.rows[0],
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
      SELECT email_id, role, emp_name, designation, department, mobile, company_identifier, unit_id
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

async function getUnitManagement(req, res) {
  try {
    const companyIdentifier = req.user.company_identifier;
    const coordinatorEmail = normalizeEmail(req.user.email_id);

    if (!companyIdentifier) {
      return res.status(200).json({
        success: true,
        data: {
          currentCoordinatorUnits: [],
          approvers: [],
          coordinators: [],
          unmappedCoordinatorUnits: [],
          unmappedApproverUnits: [],
          assignmentCoordinators: [],
          assignmentApprovers: [],
          units: [],
        },
      });
    }

    const buildDistinctPeopleQuery = (columnName) => `
      WITH distinct_people AS (
        SELECT DISTINCT LOWER(TRIM(${columnName})) AS email_id
        FROM company_unit_master
        WHERE company_identifier = $1
          AND COALESCE(TRIM(${columnName}), '') <> ''
      )
      SELECT
        dp.email_id,
        COALESCE(NULLIF(TRIM(u.emp_name), ''), dp.email_id) AS display_name
      FROM distinct_people dp
      LEFT JOIN ifc_users u
        ON LOWER(TRIM(u.email_id)) = dp.email_id
       AND u.company_identifier = $1
      ORDER BY display_name ASC, dp.email_id ASC
    `;

    const buildUnmappedUnitsQuery = (columnName) => `
      SELECT id, unit_id, unit_name
      FROM company_unit_master
      WHERE company_identifier = $1
        AND COALESCE(TRIM(${columnName}), '') = ''
      ORDER BY unit_name ASC, id ASC
    `;

    const [
      currentUnitsResult,
      approversResult,
      coordinatorsResult,
      unmappedCoordinatorUnitsResult,
      unmappedApproverUnitsResult,
      assignmentCoordinatorsResult,
      assignmentApproversResult,
      unitsResult,
    ] = await Promise.all([
      pool.query(
        `
          SELECT id, unit_id, unit_name, unit_address
          FROM company_unit_master
          WHERE company_identifier = $1
            AND LOWER(TRIM(COALESCE(coordinator_email_id, ''))) = $2
          ORDER BY unit_name ASC, id ASC
        `,
        [companyIdentifier, coordinatorEmail]
      ),
      pool.query(buildDistinctPeopleQuery('approver_email_id'), [companyIdentifier]),
      pool.query(buildDistinctPeopleQuery('coordinator_email_id'), [companyIdentifier]),
      pool.query(buildUnmappedUnitsQuery('coordinator_email_id'), [companyIdentifier]),
      pool.query(buildUnmappedUnitsQuery('approver_email_id'), [companyIdentifier]),
      pool.query(
        `
          SELECT
            LOWER(TRIM(email_id)) AS email_id,
            COALESCE(NULLIF(TRIM(emp_name), ''), LOWER(TRIM(email_id))) AS display_name
          FROM ifc_users
          WHERE company_identifier = $1
            AND role = 'company_co'
            AND COALESCE(TRIM(email_id), '') <> ''
          ORDER BY display_name ASC, email_id ASC
        `,
        [companyIdentifier]
      ),
      pool.query(
        `
          SELECT
            LOWER(TRIM(email_id)) AS email_id,
            COALESCE(NULLIF(TRIM(emp_name), ''), LOWER(TRIM(email_id))) AS display_name
          FROM ifc_users
          WHERE company_identifier = $1
            AND role = 'approver'
            AND COALESCE(TRIM(email_id), '') <> ''
          ORDER BY display_name ASC, email_id ASC
        `,
        [companyIdentifier]
      ),
      pool.query(
        `
          SELECT
            cum.id,
            cum.unit_id,
            cum.unit_name,
            cum.coordinator_email_id,
            COALESCE(NULLIF(TRIM(coordinator.emp_name), ''), cum.coordinator_email_id) AS coordinator_display_name,
            cum.approver_email_id,
            COALESCE(NULLIF(TRIM(approver.emp_name), ''), cum.approver_email_id) AS approver_display_name
          FROM company_unit_master cum
          LEFT JOIN ifc_users coordinator
            ON LOWER(TRIM(coordinator.email_id)) = LOWER(TRIM(COALESCE(cum.coordinator_email_id, '')))
           AND coordinator.company_identifier = cum.company_identifier
          LEFT JOIN ifc_users approver
            ON LOWER(TRIM(approver.email_id)) = LOWER(TRIM(COALESCE(cum.approver_email_id, '')))
           AND approver.company_identifier = cum.company_identifier
          WHERE cum.company_identifier = $1
          ORDER BY cum.unit_name ASC, cum.id ASC
        `,
        [companyIdentifier]
      ),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        currentCoordinatorUnits: currentUnitsResult.rows,
        approvers: approversResult.rows,
        coordinators: coordinatorsResult.rows,
        unmappedCoordinatorUnits: unmappedCoordinatorUnitsResult.rows,
        unmappedApproverUnits: unmappedApproverUnitsResult.rows,
        assignmentCoordinators: assignmentCoordinatorsResult.rows,
        assignmentApprovers: assignmentApproversResult.rows,
        units: unitsResult.rows,
      },
    });
  } catch (error) {
    console.error('Company coordinator unit management error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch unit management data',
    });
  }
}

async function createUnitCoordinator(req, res) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const { user, unit, emailSent } = await createUnitMappedPrivilegedUser(
      client,
      req.user,
      req.body,
      'company_co'
    );

    await client.query('COMMIT');

    if (!emailSent) {
      console.warn(`Warning: Failed to send email to ${user.email_id}, but company coordinator was created successfully.`);
    }

    return res.status(201).json({
      success: true,
      message: 'Company coordinator created successfully',
      data: { user, unit, emailSent },
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Create unit coordinator error:', error);

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

async function createUnitApprover(req, res) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const { user, unit, emailSent } = await createUnitMappedPrivilegedUser(
      client,
      req.user,
      req.body,
      'approver'
    );

    await client.query('COMMIT');

    if (!emailSent) {
      console.warn(`Warning: Failed to send email to ${user.email_id}, but approver was created successfully.`);
    }

    return res.status(201).json({
      success: true,
      message: 'Approver created successfully',
      data: { user, unit, emailSent },
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Create unit approver error:', error);

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

async function createCompanyUnit(req, res) {
  const client = await pool.connect();

  try {
    const companyIdentifier = req.user.company_identifier;
    const unitName = req.body?.unit_name && String(req.body.unit_name).trim()
      ? String(req.body.unit_name).trim()
      : '';
    const unitAddress = req.body?.unit_address && String(req.body.unit_address).trim()
      ? String(req.body.unit_address).trim()
      : null;

    if (!companyIdentifier) {
      return res.status(400).json({
        success: false,
        message: 'Company identifier is required',
      });
    }

    if (!unitName) {
      return res.status(400).json({
        success: false,
        message: 'Unit name is required',
      });
    }

    await client.query('BEGIN');

    const duplicateResult = await client.query(
      `
        SELECT id
        FROM company_unit_master
        WHERE company_identifier = $1
          AND LOWER(TRIM(unit_name)) = LOWER(TRIM($2))
        LIMIT 1
      `,
      [companyIdentifier, unitName]
    );

    if (duplicateResult.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({
        success: false,
        message: 'A unit with this name already exists for this company',
      });
    }

    let insertedUnit = null;
    let attempts = 0;
    while (!insertedUnit && attempts < 5) {
      attempts += 1;
      const unitId = generateUnitIdentifier(unitName);

      try {
        const unitResult = await client.query(
          `
            INSERT INTO company_unit_master (
              company_identifier, unit_name, unit_address, unit_id
            )
            VALUES ($1, $2, $3, $4)
            RETURNING id, unit_id, unit_name, unit_address, coordinator_email_id, approver_email_id
          `,
          [companyIdentifier, unitName, unitAddress, unitId]
        );
        insertedUnit = unitResult.rows[0];
      } catch (unitError) {
        if (unitError.code === '23505' && attempts < 5) {
          continue;
        }
        throw unitError;
      }
    }

    if (!insertedUnit) {
      throw new Error('Failed to create unit identifier');
    }

    await client.query('COMMIT');

    return res.status(201).json({
      success: true,
      message: 'Company unit created successfully',
      data: {
        unit: insertedUnit,
      },
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Create company unit error:', error);

    if (error.code === '23505') {
      return res.status(409).json({
        success: false,
        message: 'Company unit identifier already exists. Please try again.',
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

async function updateUnitAssignment(req, res) {
  const client = await pool.connect();

  try {
    const companyIdentifier = req.user.company_identifier;
    const unitId = req.params.unit_id && String(req.params.unit_id).trim()
      ? String(req.params.unit_id).trim()
      : '';
    const role = req.body?.role && String(req.body.role).trim()
      ? String(req.body.role).trim()
      : '';
    const emailId = normalizeEmail(req.body?.email_id);
    const config = getUnitMappingRoleConfig(role);

    if (!companyIdentifier) {
      return res.status(400).json({
        success: false,
        message: 'Company identifier is required',
      });
    }

    if (!unitId) {
      return res.status(400).json({
        success: false,
        message: 'Unit is required',
      });
    }

    if (!config) {
      return res.status(400).json({
        success: false,
        message: 'Invalid assignment role',
      });
    }

    if (!emailId || !isValidEmail(emailId)) {
      return res.status(400).json({
        success: false,
        message: 'Valid email ID is required',
      });
    }

    await client.query('BEGIN');

    const unitResult = await client.query(
      `
        SELECT id, ${config.columnName}
        FROM company_unit_master
        WHERE company_identifier = $1
          AND unit_id = $2
        FOR UPDATE
      `,
      [companyIdentifier, unitId]
    );

    if (unitResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        message: 'Unit not found',
      });
    }

    const userResult = await client.query(
      `
        SELECT email_id
        FROM ifc_users
        WHERE company_identifier = $1
          AND role = $2
          AND LOWER(TRIM(email_id)) = $3
        LIMIT 1
      `,
      [companyIdentifier, config.role, emailId]
    );

    if (userResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: `${config.roleLabel} email ID is not available for this company`,
      });
    }

    await client.query(
      `
        UPDATE company_unit_master
        SET ${config.columnName} = $1
        WHERE id = $2
      `,
      [emailId, unitResult.rows[0].id]
    );

    await client.query('COMMIT');

    return res.status(200).json({
      success: true,
      message: `${config.roleLabel} assigned successfully`,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Update unit assignment error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  } finally {
    client.release();
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
    unit_id,
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
      unit_id,
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
        unit_id: newUser.unit_id,
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
  getUnitManagement,
  createUnitCoordinator,
  createUnitApprover,
  createCompanyUnit,
  updateUnitAssignment,
  createUser,
  createUsersBulk,
  deleteUsers,
  checkUser,
  checkUserRole,
  getRacmAuditLogs,
};
