const crypto = require('crypto');
const { pool } = require('../../utils/db');
const { hashPassword, getPasswordPepper } = require('../../utils/password');
const { encryptTempPassword, sendUserCreationEmail } = require('../../utils/login_email');
const { getMobileValidationError, normalizeMobileDigits } = require('../../utils/mobile_validation');
const { listBusinessProcessesForCompany } = require('../../utils/business_process_master');

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
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

function normalizeUnitIds(unitIds) {
  return [...new Set(
    (Array.isArray(unitIds) ? unitIds : [])
      .map((unitId) => String(unitId || '').trim())
      .filter(Boolean)
  )];
}

async function getCompanyName(client, companyIdentifier) {
  const result = await client.query(
    'SELECT company_name FROM companies WHERE company_identifier = $1 LIMIT 1',
    [companyIdentifier]
  );
  return result.rows[0]?.company_name || companyIdentifier;
}

async function assertUnitsBelongToCompany(client, companyIdentifier, unitIds) {
  if (unitIds.length === 0) return;

  const result = await client.query(
    `
      SELECT unit_id
      FROM company_unit_master
      WHERE company_identifier = $1
        AND unit_id = ANY($2::text[])
    `,
    [companyIdentifier, unitIds]
  );
  const found = new Set(result.rows.map((row) => String(row.unit_id || '').trim()));
  const missing = unitIds.filter((unitId) => !found.has(unitId));
  if (missing.length > 0) {
    const error = new Error(`Unit not found: ${missing.join(', ')}`);
    error.statusCode = 400;
    throw error;
  }
}

async function createTempLoginUser(client, {
  companyIdentifier,
  emailId,
  role,
  empCode,
  empName,
  designation,
  department,
  mobile,
}) {
  getPasswordPepper();

  const tempPassword = crypto.randomBytes(8).toString('hex');
  const tempPasswordHash = await hashPassword(tempPassword);
  const tempPasswordEncrypted = encryptTempPassword(tempPassword);

  const result = await client.query(
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
        login_email_sent,
        temp_password_encrypted
      )
      VALUES ($1, $2, $3, $4, TRUE, $5, $6, $7, $8, $9, FALSE, $10)
      RETURNING id, email_id, role, company_identifier, emp_name
    `,
    [
      emailId,
      tempPasswordHash,
      role,
      companyIdentifier,
      empCode || null,
      empName || null,
      designation || null,
      department || null,
      mobile || null,
      tempPasswordEncrypted,
    ]
  );

  return {
    user: result.rows[0],
    tempPassword,
  };
}

async function sendCreationEmail({ user, tempPassword, companyName, admin }) {
  try {
    const emailSent = await sendUserCreationEmail(pool, {
      userId: user.id,
      emailId: user.email_id,
      role: user.role,
      userName: user.emp_name,
      coordinatorName: admin.emp_name || 'Company Admin',
      coordinatorEmail: admin.email_id,
      companyName,
      tempPassword,
    });
    if (!emailSent) {
      console.warn(`Warning: failed to send login email to ${user.email_id}`);
    }
  } catch (emailError) {
    console.error(`User creation email error for ${user.email_id}:`, emailError);
  }
}

async function getUnitManagement(req, res) {
  const companyIdentifier = req.user.company_identifier;

  try {
    const [units, coordinators, approvers, users, approverAssignments] = await Promise.all([
      pool.query(
        `
          SELECT id, unit_id, unit_name, unit_address
          FROM company_unit_master
          WHERE company_identifier = $1
          ORDER BY unit_name ASC, id ASC
        `,
        [companyIdentifier]
      ),
      pool.query(
        `
          SELECT
            u.id,
            u.email_id,
            COALESCE(NULLIF(TRIM(u.emp_name), ''), u.email_id) AS display_name,
            COALESCE(
              json_agg(cua.unit_id ORDER BY cua.unit_id) FILTER (WHERE cua.unit_id IS NOT NULL),
              '[]'::json
            ) AS unit_ids
          FROM ifc_users u
          LEFT JOIN coordinator_unit_assignments cua
            ON cua.company_identifier = u.company_identifier
           AND LOWER(TRIM(cua.coordinator_email_id)) = LOWER(TRIM(u.email_id))
          WHERE u.company_identifier = $1
            AND u.role = 'company_co'
          GROUP BY u.id, u.email_id, u.emp_name
          ORDER BY display_name ASC
        `,
        [companyIdentifier]
      ),
      pool.query(
        `
          SELECT id, email_id, COALESCE(NULLIF(TRIM(emp_name), ''), email_id) AS display_name
          FROM ifc_users
          WHERE company_identifier = $1
            AND role = 'approver'
          ORDER BY display_name ASC
        `,
        [companyIdentifier]
      ),
      pool.query(
        `
          SELECT
            u.id,
            u.email_id,
            COALESCE(NULLIF(TRIM(u.emp_name), ''), u.email_id) AS display_name,
            COALESCE(
              json_agg(uum.unit_id ORDER BY uum.unit_id) FILTER (WHERE uum.unit_id IS NOT NULL),
              '[]'::json
            ) AS unit_ids
          FROM ifc_users u
          LEFT JOIN user_unit_memberships uum
            ON uum.company_identifier = u.company_identifier
           AND LOWER(TRIM(uum.user_email_id)) = LOWER(TRIM(u.email_id))
          WHERE u.company_identifier = $1
            AND u.role = 'user'
          GROUP BY u.id, u.email_id, u.emp_name
          ORDER BY display_name ASC
        `,
        [companyIdentifier]
      ),
      pool.query(
        `
          SELECT
            aa.id,
            aa.approver_email_id,
            COALESCE(NULLIF(TRIM(u.emp_name), ''), aa.approver_email_id) AS approver_display_name,
            aa.assignment_scope,
            COALESCE(aa.unit_id, cf.unit_id) AS unit_id,
            COALESCE(unit_direct.unit_name, unit_cf.unit_name) AS unit_name,
            aa.business_process,
            aa.form_id,
            aa.created_at
          FROM approver_assignments aa
          LEFT JOIN ifc_users u
            ON u.company_identifier = aa.company_identifier
           AND LOWER(TRIM(u.email_id)) = LOWER(TRIM(aa.approver_email_id))
          LEFT JOIN control_forms cf
            ON aa.assignment_scope = 'RACM'
           AND cf.company_identifier = aa.company_identifier
           AND cf.form_id = aa.form_id
          LEFT JOIN company_unit_master unit_direct
            ON unit_direct.company_identifier = aa.company_identifier
           AND unit_direct.unit_id = aa.unit_id
          LEFT JOIN company_unit_master unit_cf
            ON unit_cf.company_identifier = cf.company_identifier
           AND unit_cf.unit_id = cf.unit_id
          WHERE aa.company_identifier = $1
          ORDER BY
            CASE aa.assignment_scope
              WHEN 'RACM' THEN 1
              WHEN 'BUSINESS_PROCESS' THEN 2
              ELSE 3
            END,
            aa.created_at DESC
        `,
        [companyIdentifier]
      ),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        units: units.rows,
        coordinators: coordinators.rows,
        approvers: approvers.rows,
        users: users.rows,
        approverAssignments: approverAssignments.rows,
      },
    });
  } catch (error) {
    console.error('Company admin unit management error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
}

async function createCompanyUnit(req, res) {
  const client = await pool.connect();
  const companyIdentifier = req.user.company_identifier;
  const unitName = String(req.body?.unit_name || req.body?.unit || '').trim();
  const unitAddress = String(req.body?.unit_address || '').trim();

  if (!unitName) {
    return res.status(400).json({ success: false, message: 'Unit name is required' });
  }

  try {
    await client.query('BEGIN');

    const duplicate = await client.query(
      `
        SELECT 1
        FROM company_unit_master
        WHERE company_identifier = $1
          AND LOWER(TRIM(unit_name)) = LOWER(TRIM($2))
        LIMIT 1
      `,
      [companyIdentifier, unitName]
    );
    if (duplicate.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ success: false, message: 'A unit with this name already exists for this company' });
    }

    let insertedUnit = null;
    let attempts = 0;
    while (!insertedUnit && attempts < 5) {
      attempts += 1;
      const unitId = generateUnitIdentifier(unitName);
      try {
        const result = await client.query(
          `
            INSERT INTO company_unit_master (company_identifier, unit_name, unit_address, unit_id)
            VALUES ($1, $2, $3, $4)
            RETURNING id, unit_id, unit_name, unit_address
          `,
          [companyIdentifier, unitName, unitAddress || null, unitId]
        );
        insertedUnit = result.rows[0];
      } catch (unitError) {
        if (unitError.code === '23505' && attempts < 5) continue;
        throw unitError;
      }
    }

    await client.query('COMMIT');
    return res.status(201).json({
      success: true,
      message: 'Company unit created successfully',
      data: { unit: insertedUnit },
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Company admin create unit error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  } finally {
    client.release();
  }
}

async function updateCompanyUnit(req, res) {
  const client = await pool.connect();
  const companyIdentifier = req.user.company_identifier;
  const unitId = String(req.params?.unit_id || '').trim();
  const unitName = String(req.body?.unit_name || req.body?.unit || '').trim();
  const unitAddress = String(req.body?.unit_address || '').trim();

  if (!unitId) {
    return res.status(400).json({ success: false, message: 'Unit ID is required' });
  }
  if (!unitName) {
    return res.status(400).json({ success: false, message: 'Unit name is required' });
  }

  try {
    await client.query('BEGIN');
    await assertUnitsBelongToCompany(client, companyIdentifier, [unitId]);

    const duplicate = await client.query(
      `
        SELECT 1
        FROM company_unit_master
        WHERE company_identifier = $1
          AND unit_id <> $2
          AND LOWER(TRIM(unit_name)) = LOWER(TRIM($3))
        LIMIT 1
      `,
      [companyIdentifier, unitId, unitName]
    );
    if (duplicate.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ success: false, message: 'A unit with this name already exists for this company' });
    }

    const updated = await client.query(
      `
        UPDATE company_unit_master
        SET unit_name = $3,
            unit_address = $4
        WHERE company_identifier = $1
          AND unit_id = $2
        RETURNING id, unit_id, unit_name, unit_address
      `,
      [companyIdentifier, unitId, unitName, unitAddress || null]
    );

    await client.query('COMMIT');
    return res.status(200).json({
      success: true,
      message: 'Company unit updated successfully',
      data: { unit: updated.rows[0] || null },
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Company admin update company unit error:', error);
    if (error.statusCode) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    return res.status(500).json({ success: false, message: 'Internal server error' });
  } finally {
    client.release();
  }
}

async function createRoleUser(req, res, role) {
  const client = await pool.connect();
  const companyIdentifier = req.user.company_identifier;
  const emailId = normalizeEmail(req.body?.email_id);
  const unitIds = normalizeUnitIds(req.body?.unit_ids);
  const mobileDigits = normalizeMobileDigits(req.body?.mobile);
  const mobile = mobileDigits || null;

  if (!emailId || !isValidEmail(emailId)) {
    return res.status(400).json({ success: false, message: 'Valid email ID is required' });
  }
  if (mobile) {
    const mobileError = getMobileValidationError(mobile);
    if (mobileError) {
      return res.status(400).json({ success: false, message: mobileError });
    }
  }

  try {
    await client.query('BEGIN');
    await assertUnitsBelongToCompany(client, companyIdentifier, unitIds);

    const { user, tempPassword } = await createTempLoginUser(client, {
      companyIdentifier,
      emailId,
      role,
      empCode: String(req.body?.emp_code || '').trim() || null,
      empName: String(req.body?.emp_name || '').trim() || null,
      designation: String(req.body?.designation || '').trim() || null,
      department: String(req.body?.department || '').trim() || null,
      mobile,
    });

    const assignmentTable = role === 'company_co'
      ? 'coordinator_unit_assignments'
      : 'user_unit_memberships';
    const emailColumn = role === 'company_co' ? 'coordinator_email_id' : 'user_email_id';

    if (role !== 'approver') {
      for (const unitId of unitIds) {
        await client.query(
          `
            INSERT INTO ${assignmentTable} (company_identifier, ${emailColumn}, unit_id)
            VALUES ($1, $2, $3)
            ON CONFLICT DO NOTHING
          `,
          [companyIdentifier, emailId, unitId]
        );
      }
    }

    const companyName = await getCompanyName(client, companyIdentifier);
    await client.query('COMMIT');

    await sendCreationEmail({ user, tempPassword, companyName, admin: req.user });

    return res.status(201).json({
      success: true,
      message: `${role === 'company_co' ? 'Coordinator' : role === 'approver' ? 'Approver' : 'User'} created successfully`,
      data: { user, loginEmailQueued: true },
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(`Company admin create ${role} error:`, error);

    if (error.statusCode) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    if (error.code === '23505') {
      return res.status(409).json({ success: false, message: 'User with this email already exists' });
    }
    return res.status(500).json({ success: false, message: 'Internal server error' });
  } finally {
    client.release();
  }
}

async function createCoordinator(req, res) {
  return createRoleUser(req, res, 'company_co');
}

async function createApprover(req, res) {
  return createRoleUser(req, res, 'approver');
}

async function createUser(req, res) {
  return createRoleUser(req, res, 'user');
}

async function getHomeStats(req, res) {
  const companyIdentifier = String(req.user?.company_identifier || '').trim();

  if (!companyIdentifier) {
    return res.status(200).json({
      success: true,
      data: {
        adminName: req.user?.emp_name || req.user?.email_id || 'Admin',
        totalUsers: 0,
        totalRacms: 0,
        approvedRacms: 0,
        rejectedRacms: 0,
      },
    });
  }

  try {
    const [usersResult, racmStatsResult] = await Promise.all([
      pool.query(
        `
          SELECT COUNT(*)::int AS total_users
          FROM ifc_users
          WHERE company_identifier = $1
            AND role IN ('user', 'company_co', 'approver')
        `,
        [companyIdentifier]
      ),
      pool.query(
        `
          SELECT
            COUNT(*)::int AS total_racms,
            COUNT(*) FILTER (WHERE LOWER(TRIM(COALESCE(status, ''))) = 'approved')::int AS approved_racms,
            COUNT(*) FILTER (WHERE LOWER(TRIM(COALESCE(status, ''))) = 'rejected')::int AS rejected_racms
          FROM control_forms
          WHERE company_identifier = $1
        `,
        [companyIdentifier]
      ),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        adminName: req.user?.emp_name || req.user?.email_id || 'Admin',
        totalUsers: Number(usersResult.rows[0]?.total_users || 0),
        totalRacms: Number(racmStatsResult.rows[0]?.total_racms || 0),
        approvedRacms: Number(racmStatsResult.rows[0]?.approved_racms || 0),
        rejectedRacms: Number(racmStatsResult.rows[0]?.rejected_racms || 0),
      },
    });
  } catch (error) {
    console.error('Company admin home stats error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
}

async function getUsers(req, res) {
  const companyIdentifier = String(req.user?.company_identifier || '').trim();
  const roleFilter = String(req.query?.role || '').trim().toLowerCase();

  if (!companyIdentifier) {
    return res.status(200).json({ success: true, users: [] });
  }

  try {
    const params = [companyIdentifier];
    let paramIndex = 2;
    let roleCondition = '';

    if (['user', 'company_co', 'approver', 'company_admin'].includes(roleFilter)) {
      roleCondition = ` AND u.role = $${paramIndex}`;
      params.push(roleFilter);
      paramIndex += 1;
    }

    const result = await pool.query(
      `
        SELECT
          u.email_id,
          u.role,
          u.emp_name,
          u.designation,
          u.department,
          u.mobile,
          CASE
            WHEN u.role = 'company_co' THEN coordinator_units.unit_ids
            WHEN u.role = 'approver' THEN approver_units.unit_ids
            ELSE user_units.unit_ids
          END AS unit_id,
          CASE
            WHEN u.role = 'company_co' THEN coordinator_units.unit_names
            WHEN u.role = 'approver' THEN approver_units.unit_names
            ELSE user_units.unit_names
          END AS unit_name
        FROM ifc_users u
        LEFT JOIN LATERAL (
          SELECT
            STRING_AGG(cua.unit_id, ', ' ORDER BY cum.unit_name, cua.unit_id) AS unit_ids,
            STRING_AGG(cum.unit_name, ', ' ORDER BY cum.unit_name, cua.unit_id) AS unit_names
          FROM coordinator_unit_assignments cua
          INNER JOIN company_unit_master cum
            ON cum.company_identifier = cua.company_identifier
           AND cum.unit_id = cua.unit_id
          WHERE cua.company_identifier = u.company_identifier
            AND LOWER(TRIM(cua.coordinator_email_id)) = LOWER(TRIM(u.email_id))
        ) coordinator_units ON u.role = 'company_co'
        LEFT JOIN LATERAL (
          SELECT
            STRING_AGG(aa.unit_id, ', ' ORDER BY cum.unit_name, aa.unit_id) AS unit_ids,
            STRING_AGG(cum.unit_name, ', ' ORDER BY cum.unit_name, aa.unit_id) AS unit_names
          FROM approver_assignments aa
          INNER JOIN company_unit_master cum
            ON cum.company_identifier = aa.company_identifier
           AND cum.unit_id = aa.unit_id
          WHERE aa.company_identifier = u.company_identifier
            AND LOWER(TRIM(aa.approver_email_id)) = LOWER(TRIM(u.email_id))
            AND aa.assignment_scope = 'UNIT'
            AND NULLIF(TRIM(aa.unit_id), '') IS NOT NULL
        ) approver_units ON u.role = 'approver'
        LEFT JOIN LATERAL (
          SELECT
            STRING_AGG(uum.unit_id, ', ' ORDER BY cum.unit_name, uum.unit_id) AS unit_ids,
            STRING_AGG(cum.unit_name, ', ' ORDER BY cum.unit_name, uum.unit_id) AS unit_names
          FROM user_unit_memberships uum
          INNER JOIN company_unit_master cum
            ON cum.company_identifier = uum.company_identifier
           AND cum.unit_id = uum.unit_id
          WHERE uum.company_identifier = u.company_identifier
            AND LOWER(TRIM(uum.user_email_id)) = LOWER(TRIM(u.email_id))
        ) user_units ON u.role = 'user'
        WHERE u.company_identifier = $1
        ${roleCondition}
        ORDER BY
          CASE u.role
            WHEN 'company_admin' THEN 1
            WHEN 'company_co' THEN 2
            WHEN 'approver' THEN 3
            WHEN 'user' THEN 4
            ELSE 5
          END,
          COALESCE(NULLIF(TRIM(u.emp_name), ''), u.email_id) ASC
      `,
      params
    );

    return res.status(200).json({
      success: true,
      users: result.rows,
    });
  } catch (error) {
    console.error('Company admin get users error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
}

async function createUsersBulk(req, res) {
  const client = await pool.connect();
  const companyIdentifier = String(req.user?.company_identifier || '').trim();
  const role = String(req.body?.role || 'user').trim();
  const rowsInput = Array.isArray(req.body?.users) ? req.body.users : [];

  if (!companyIdentifier) {
    return res.status(400).json({ success: false, message: 'Company identifier is missing for company admin' });
  }

  if (!['user', 'company_co', 'approver'].includes(role)) {
    return res.status(400).json({ success: false, message: 'Invalid role for bulk creation' });
  }

  if (rowsInput.length === 0) {
    return res.status(400).json({ success: false, message: 'At least one user row is required' });
  }

  try {
    const companyName = await getCompanyName(client, companyIdentifier);
    const createdUsers = [];
    const duplicateRows = [];
    const skippedRows = [];

    for (const [index, row] of rowsInput.entries()) {
      const rowNumber = index + 2;
      const emailId = normalizeEmail(row?.email_id);

      if (!emailId || !isValidEmail(emailId)) {
        skippedRows.push({ rowNumber, email_id: emailId, reason: 'Invalid email format' });
        continue;
      }

      await client.query('BEGIN');
      try {
        const { user, tempPassword } = await createTempLoginUser(client, {
          companyIdentifier,
          emailId,
          role,
          empName: String(row?.emp_name || '').trim() || null,
          designation: String(row?.designation || '').trim() || null,
          department: String(row?.department || '').trim() || null,
          mobile: String(row?.mobile || '').trim() || null,
        });

        await client.query('COMMIT');
        createdUsers.push({ user, tempPassword, rowNumber });
      } catch (error) {
        await client.query('ROLLBACK');
        if (error.code === '23505') {
          duplicateRows.push({ rowNumber, email_id: emailId });
          continue;
        }
        throw error;
      }
    }

    for (const created of createdUsers) {
      await sendCreationEmail({
        user: created.user,
        tempPassword: created.tempPassword,
        companyName,
        admin: req.user,
      });
    }

    return res.status(201).json({
      success: true,
      message: `${createdUsers.length} ${role === 'user' ? 'user' : role === 'company_co' ? 'coordinator' : 'approver'}(s) created successfully`,
      created_count: createdUsers.length,
      duplicate_count: duplicateRows.length,
      skipped_count: skippedRows.length,
      duplicate_rows: duplicateRows,
      skipped_rows: skippedRows,
    });
  } catch (error) {
    console.error('Company admin bulk create users error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  } finally {
    client.release();
  }
}

async function deleteUsers(req, res) {
  const client = await pool.connect();
  const companyIdentifier = String(req.user?.company_identifier || '').trim();
  const normalizedEmails = [...new Set(
    (Array.isArray(req.body?.email_ids) ? req.body.email_ids : [])
      .map(normalizeEmail)
      .filter(Boolean)
  )];

  if (!companyIdentifier) {
    return res.status(400).json({ success: false, message: 'Company identifier is missing for company admin' });
  }

  if (normalizedEmails.length === 0) {
    return res.status(400).json({ success: false, message: 'No valid user emails provided for deletion' });
  }

  try {
    const usersResult = await client.query(
      `
        SELECT id, email_id, role
        FROM ifc_users
        WHERE company_identifier = $1
          AND LOWER(TRIM(email_id)) = ANY($2::text[])
      `,
      [companyIdentifier, normalizedEmails]
    );

    const users = usersResult.rows;
    const foundEmails = new Set(users.map((row) => normalizeEmail(row.email_id)));
    const missingEmails = normalizedEmails.filter((emailId) => !foundEmails.has(emailId));
    if (missingEmails.length > 0) {
      return res.status(404).json({
        success: false,
        message: 'One or more selected users were not found for this company',
        missingEmails,
      });
    }

    const protectedUsers = users.filter((row) => row.role === 'company_admin');
    if (protectedUsers.length > 0) {
      return res.status(403).json({
        success: false,
        message: 'Company admin users cannot be deleted from this screen',
        protectedEmails: protectedUsers.map((row) => row.email_id),
      });
    }

    await client.query('BEGIN');

    await client.query(
      `
        UPDATE control_forms
        SET control_owner = NULL,
            active = FALSE,
            updated_at = CURRENT_TIMESTAMP
        WHERE company_identifier = $1
          AND LOWER(TRIM(control_owner)) = ANY($2::text[])
      `,
      [companyIdentifier, normalizedEmails]
    );

    await client.query(
      'DELETE FROM coordinator_unit_assignments WHERE company_identifier = $1 AND LOWER(TRIM(coordinator_email_id)) = ANY($2::text[])',
      [companyIdentifier, normalizedEmails]
    );
    await client.query(
      'DELETE FROM approver_assignments WHERE company_identifier = $1 AND LOWER(TRIM(approver_email_id)) = ANY($2::text[])',
      [companyIdentifier, normalizedEmails]
    );
    await client.query(
      'DELETE FROM user_unit_memberships WHERE company_identifier = $1 AND LOWER(TRIM(user_email_id)) = ANY($2::text[])',
      [companyIdentifier, normalizedEmails]
    );
    await client.query(
      'DELETE FROM ifc_users WHERE company_identifier = $1 AND LOWER(TRIM(email_id)) = ANY($2::text[])',
      [companyIdentifier, normalizedEmails]
    );

    await client.query('COMMIT');

    return res.status(200).json({
      success: true,
      message: `Deleted ${normalizedEmails.length} user(s) successfully`,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Company admin delete users error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  } finally {
    client.release();
  }
}

async function getDashboardFilters(req, res) {
  const companyIdentifier = String(req.user?.company_identifier || '').trim();

  if (!companyIdentifier) {
    return res.status(200).json({
      success: true,
      data: { units: [], financialYears: [], businessProcesses: [] },
    });
  }

  try {
    const [unitsResult, financialYearsResult, businessProcesses] = await Promise.all([
      pool.query(
        `
          SELECT unit_id, unit_name
          FROM company_unit_master
          WHERE company_identifier = $1
          ORDER BY unit_name ASC, unit_id ASC
        `,
        [companyIdentifier]
      ),
      pool.query(
        `
          SELECT DISTINCT TRIM(financial_year) AS financial_year
          FROM control_forms
          WHERE company_identifier = $1
            AND COALESCE(NULLIF(TRIM(financial_year), ''), '') <> ''
          ORDER BY financial_year ASC
        `,
        [companyIdentifier]
      ),
      listBusinessProcessesForCompany(pool, companyIdentifier),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        units: unitsResult.rows,
        financialYears: financialYearsResult.rows.map((row) => row.financial_year).filter(Boolean),
        businessProcesses: businessProcesses
          .map((row) => String(row.business_process || '').trim())
          .filter(Boolean),
      },
    });
  } catch (error) {
    console.error('Company admin dashboard filters error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
}

async function getDashboardRacms(req, res) {
  const companyIdentifier = String(req.user?.company_identifier || '').trim();
  const unitId = String(req.query?.unit_id || '').trim();
  const businessProcess = String(req.query?.business_process || '').trim();
  const financialYear = String(req.query?.financial_year || '').trim();
  const active = String(req.query?.active || '').trim().toLowerCase();
  const status = String(req.query?.status || '').trim().toLowerCase();

  if (!companyIdentifier) {
    return res.status(200).json({ success: true, data: [] });
  }

  try {
    const params = [companyIdentifier];
    const conditions = ['cf.company_identifier = $1'];
    let paramIndex = 2;

    if (unitId) {
      conditions.push(`TRIM(COALESCE(cf.unit_id, '')) = $${paramIndex}`);
      params.push(unitId);
      paramIndex += 1;
    }
    if (businessProcess) {
      conditions.push(`LOWER(TRIM(COALESCE(cf.business_process, ''))) = $${paramIndex}`);
      params.push(businessProcess.toLowerCase());
      paramIndex += 1;
    }
    if (financialYear) {
      conditions.push(`TRIM(COALESCE(cf.financial_year, '')) = $${paramIndex}`);
      params.push(financialYear);
      paramIndex += 1;
    }
    if (active === 'active') {
      conditions.push('cf.active = TRUE');
    } else if (active === 'inactive') {
      conditions.push('COALESCE(cf.active, FALSE) = FALSE');
    }
    if (status === 'approved') {
      conditions.push(`LOWER(TRIM(COALESCE(cf.status, ''))) = 'approved'`);
    } else if (status === 'rejected') {
      conditions.push(`LOWER(TRIM(COALESCE(cf.status, ''))) = 'rejected'`);
    } else if (status === 'pending') {
      conditions.push(`(
        COALESCE(NULLIF(TRIM(cf.status), ''), '') = ''
        OR LOWER(TRIM(COALESCE(cf.status, ''))) = 'sent for approval'
      )`);
    }

    const result = await pool.query(
      `
        SELECT
          cf.form_id,
          cf.business_process,
          cf.sub_process,
          cf.standard_control_description,
          cf.financial_year,
          cf.control_owner,
          cf.status,
          cf.active,
          cf.due_date,
          cf.created_at,
          cum.unit_name,
          NULLIF(TRIM(owner.emp_name), '') AS control_owner_name
        FROM control_forms cf
        LEFT JOIN company_unit_master cum
          ON cum.company_identifier = cf.company_identifier
         AND cum.unit_id = cf.unit_id
        LEFT JOIN ifc_users owner
          ON owner.company_identifier = cf.company_identifier
         AND LOWER(TRIM(owner.email_id)) = LOWER(TRIM(cf.control_owner))
        WHERE ${conditions.join(' AND ')}
        ORDER BY cf.created_at DESC, cf.id DESC
      `,
      params
    );

    return res.status(200).json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    console.error('Company admin dashboard RACMs error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
}

async function updateCoordinatorUnits(req, res) {
  const client = await pool.connect();
  const companyIdentifier = req.user.company_identifier;
  const emailId = normalizeEmail(req.body?.email_id);
  const unitIds = normalizeUnitIds(req.body?.unit_ids);

  if (!emailId || !isValidEmail(emailId)) {
    return res.status(400).json({ success: false, message: 'Valid coordinator email ID is required' });
  }

  try {
    await client.query('BEGIN');
    await assertUnitsBelongToCompany(client, companyIdentifier, unitIds);

    const userResult = await client.query(
      `
        SELECT 1
        FROM ifc_users
        WHERE company_identifier = $1
          AND role = 'company_co'
          AND LOWER(TRIM(email_id)) = $2
        LIMIT 1
      `,
      [companyIdentifier, emailId]
    );
    if (userResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: 'Coordinator email ID is not available for this company' });
    }

    await client.query(
      'DELETE FROM coordinator_unit_assignments WHERE company_identifier = $1 AND LOWER(TRIM(coordinator_email_id)) = $2',
      [companyIdentifier, emailId]
    );
    for (const unitId of unitIds) {
      await client.query(
        `
          INSERT INTO coordinator_unit_assignments (company_identifier, coordinator_email_id, unit_id)
          VALUES ($1, $2, $3)
        `,
        [companyIdentifier, emailId, unitId]
      );
    }

    await client.query('COMMIT');
    return res.status(200).json({ success: true, message: 'Coordinator unit assignments updated successfully' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Update coordinator units error:', error);
    if (error.statusCode) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    return res.status(500).json({ success: false, message: 'Internal server error' });
  } finally {
    client.release();
  }
}

async function updateUserUnits(req, res) {
  const client = await pool.connect();
  const companyIdentifier = req.user.company_identifier;
  const emailId = normalizeEmail(req.body?.email_id);
  const unitIds = normalizeUnitIds(req.body?.unit_ids);

  if (!emailId || !isValidEmail(emailId)) {
    return res.status(400).json({ success: false, message: 'Valid user email ID is required' });
  }

  try {
    await client.query('BEGIN');
    await assertUnitsBelongToCompany(client, companyIdentifier, unitIds);

    const userResult = await client.query(
      `
        SELECT 1
        FROM ifc_users
        WHERE company_identifier = $1
          AND role = 'user'
          AND LOWER(TRIM(email_id)) = $2
        LIMIT 1
      `,
      [companyIdentifier, emailId]
    );
    if (userResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: 'User email ID is not available for this company' });
    }

    await client.query(
      'DELETE FROM user_unit_memberships WHERE company_identifier = $1 AND LOWER(TRIM(user_email_id)) = $2',
      [companyIdentifier, emailId]
    );
    for (const unitId of unitIds) {
      await client.query(
        `
          INSERT INTO user_unit_memberships (company_identifier, user_email_id, unit_id)
          VALUES ($1, $2, $3)
        `,
        [companyIdentifier, emailId, unitId]
      );
    }

    await client.query('COMMIT');
    return res.status(200).json({ success: true, message: 'User unit memberships updated successfully' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Update user units error:', error);
    if (error.statusCode) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    return res.status(500).json({ success: false, message: 'Internal server error' });
  } finally {
    client.release();
  }
}

async function updateUnitAssignment(req, res) {
  const client = await pool.connect();
  const companyIdentifier = String(req.user?.company_identifier || '').trim();
  const unitId = String(req.params?.unit_id || '').trim();
  const role = String(req.body?.role || '').trim();
  const emailId = normalizeEmail(req.body?.email_id);

  if (!companyIdentifier) {
    return res.status(400).json({ success: false, message: 'Company identifier is missing for company admin' });
  }
  if (!unitId) {
    return res.status(400).json({ success: false, message: 'Unit is required' });
  }
  if (!['company_co', 'approver'].includes(role)) {
    return res.status(400).json({ success: false, message: 'Invalid assignment role' });
  }
  if (!emailId || !isValidEmail(emailId)) {
    return res.status(400).json({ success: false, message: 'Valid email ID is required' });
  }

  try {
    await client.query('BEGIN');
    await assertUnitsBelongToCompany(client, companyIdentifier, [unitId]);

    const userResult = await client.query(
      `
        SELECT 1
        FROM ifc_users
        WHERE company_identifier = $1
          AND role = $2
          AND LOWER(TRIM(email_id)) = $3
        LIMIT 1
      `,
      [companyIdentifier, role, emailId]
    );

    if (userResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: 'Selected user is not available for this role in this company' });
    }

    if (role === 'company_co') {
      await client.query(
        `
          DELETE FROM coordinator_unit_assignments
          WHERE company_identifier = $1
            AND unit_id = $2
        `,
        [companyIdentifier, unitId]
      );
      await client.query(
        `
          INSERT INTO coordinator_unit_assignments (company_identifier, coordinator_email_id, unit_id)
          VALUES ($1, $2, $3)
        `,
        [companyIdentifier, emailId, unitId]
      );
    } else {
      await client.query(
        `
          DELETE FROM approver_assignments
          WHERE company_identifier = $1
            AND assignment_scope = 'UNIT'
            AND unit_id = $2
        `,
        [companyIdentifier, unitId]
      );
      await client.query(
        `
          INSERT INTO approver_assignments (
            company_identifier,
            approver_email_id,
            assignment_scope,
            unit_id,
            business_process,
            form_id
          )
          VALUES ($1, $2, 'UNIT', $3, NULL, NULL)
        `,
        [companyIdentifier, emailId, unitId]
      );
    }

    await client.query('COMMIT');
    return res.status(200).json({ success: true, message: 'Unit assignment updated successfully' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Company admin update unit assignment error:', error);
    if (error.statusCode) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    return res.status(500).json({ success: false, message: 'Internal server error' });
  } finally {
    client.release();
  }
}

async function assignApprover(req, res) {
  const client = await pool.connect();
  const companyIdentifier = req.user.company_identifier;
  const approverEmailId = normalizeEmail(req.body?.approver_email_id || req.body?.email_id);
  const assignmentScope = String(req.body?.assignment_scope || req.body?.scope || '').trim().toUpperCase();
  const unitId = String(req.body?.unit_id || '').trim() || null;
  const businessProcess = String(req.body?.business_process || '').trim() || null;
  const formId = String(req.body?.form_id || '').trim() || null;

  if (!approverEmailId || !isValidEmail(approverEmailId)) {
    return res.status(400).json({ success: false, message: 'Valid approver email ID is required' });
  }
  if (!['UNIT', 'BUSINESS_PROCESS', 'RACM'].includes(assignmentScope)) {
    return res.status(400).json({ success: false, message: 'Invalid approver assignment scope' });
  }
  if (assignmentScope === 'UNIT' && !unitId) {
    return res.status(400).json({ success: false, message: 'Unit is required for unit-level approver assignment' });
  }
  if (assignmentScope === 'BUSINESS_PROCESS' && (!unitId || !businessProcess)) {
    return res.status(400).json({ success: false, message: 'Unit and business process are required for process-level approver assignment' });
  }
  if (assignmentScope === 'RACM' && !formId) {
    return res.status(400).json({ success: false, message: 'Form ID is required for RACM-level approver assignment' });
  }

  try {
    await client.query('BEGIN');

    const approverResult = await client.query(
      `
        SELECT 1
        FROM ifc_users
        WHERE company_identifier = $1
          AND role = 'approver'
          AND LOWER(TRIM(email_id)) = $2
        LIMIT 1
      `,
      [companyIdentifier, approverEmailId]
    );
    if (approverResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: 'Approver email ID is not available for this company' });
    }

    if (unitId) {
      await assertUnitsBelongToCompany(client, companyIdentifier, [unitId]);
    }
    if (formId) {
      const formResult = await client.query(
        'SELECT 1 FROM control_forms WHERE company_identifier = $1 AND form_id = $2 LIMIT 1',
        [companyIdentifier, formId]
      );
      if (formResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ success: false, message: 'RACM not found for this company' });
      }
    }

    if (assignmentScope === 'BUSINESS_PROCESS') {
      const overlappingScopeResult = await client.query(
        `
          SELECT 1
          FROM approver_assignments
          WHERE company_identifier = $1
            AND LOWER(TRIM(approver_email_id)) = $2
            AND assignment_scope = 'UNIT'
            AND unit_id = $3
          LIMIT 1
        `,
        [companyIdentifier, approverEmailId, unitId]
      );

      if (overlappingScopeResult.rows.length > 0) {
        await client.query('ROLLBACK');
        return res.status(409).json({
          success: false,
          message: 'Assignment already included in previously assigned scope',
        });
      }
    }

    if (assignmentScope === 'UNIT') {
      await client.query(
        `DELETE FROM approver_assignments WHERE company_identifier = $1 AND assignment_scope = 'UNIT' AND unit_id = $2`,
        [companyIdentifier, unitId]
      );
    } else if (assignmentScope === 'BUSINESS_PROCESS') {
      await client.query(
        `
          DELETE FROM approver_assignments
          WHERE company_identifier = $1
            AND assignment_scope = 'BUSINESS_PROCESS'
            AND unit_id = $2
            AND LOWER(TRIM(business_process)) = LOWER(TRIM($3))
        `,
        [companyIdentifier, unitId, businessProcess]
      );
    } else {
      await client.query(
        `DELETE FROM approver_assignments WHERE company_identifier = $1 AND assignment_scope = 'RACM' AND form_id = $2`,
        [companyIdentifier, formId]
      );
    }

    const result = await client.query(
      `
        INSERT INTO approver_assignments (
          company_identifier,
          approver_email_id,
          assignment_scope,
          unit_id,
          business_process,
          form_id
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id, approver_email_id, assignment_scope, unit_id, business_process, form_id, created_at
      `,
      [
        companyIdentifier,
        approverEmailId,
        assignmentScope,
        assignmentScope === 'UNIT' || assignmentScope === 'BUSINESS_PROCESS' ? unitId : null,
        assignmentScope === 'BUSINESS_PROCESS' ? businessProcess : null,
        assignmentScope === 'RACM' ? formId : null,
      ]
    );

    await client.query('COMMIT');
    return res.status(200).json({
      success: true,
      message: 'Approver assignment saved successfully',
      data: { assignment: result.rows[0] },
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Assign approver error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  } finally {
    client.release();
  }
}

module.exports = {
  getHomeStats,
  getUnitManagement,
  getUsers,
  createCompanyUnit,
  updateCompanyUnit,
  createCoordinator,
  createApprover,
  createUser,
  createUsersBulk,
  deleteUsers,
  updateCoordinatorUnits,
  updateUserUnits,
  updateUnitAssignment,
  assignApprover,
  getDashboardFilters,
  getDashboardRacms,
};
