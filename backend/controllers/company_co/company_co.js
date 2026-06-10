const crypto = require('crypto');
const { pool } = require('../../utils/db');
const { prisma } = require('../../lib/prisma');
const { requestControlSummary, OLLAMA_MODEL, isOllamaReachable } = require('../../llm_racm_summary/ollama_client');
const { hashPassword, getPasswordPepper } = require('../../utils/password');
const { encryptTempPassword, sendUserCreationEmail } = require('../../utils/login_email');
const { sendEmail } = require('../../utils/send_email');
const {
  createBusinessProcessMasterEntry,
  listBusinessProcessesForCompany,
} = require('../../utils/business_process_master');
const {
  classifyKeyControlValue,
  isUnclassifiedKeyControlValue,
  isKeyControlValue,
} = require('../../utils/key_control_classification');
const {
  tryAcquireGlobalAiModelLock,
  releaseGlobalAiModelLock,
} = require('../../utils/ai_model_lock');
const {
  getMobileValidationError,
  normalizeMobileDigits,
} = require('../../utils/mobile_validation');

const KEY_MANUAL_AI_PROMPT_VERSION = 'v1';

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

async function getCompanyName(companyIdentifier) {
  if (!companyIdentifier) return null;
  const company = await prisma.company.findUnique({
    where: { companyIdentifier },
    select: { companyName: true },
  });
  return company?.companyName || null;
}

const DASHBOARD_EMPTY_VALUE_LABEL = '(empty)';

function normalizeDashboardFilterValue(value) {
  const normalized = String(value ?? '').trim();
  return normalized || null;
}

function parseDashboardActiveFilter(value) {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (normalized === 'true' || normalized === '1' || normalized === 'active') return true;
  if (normalized === 'false' || normalized === '0' || normalized === 'inactive') return false;
  return null;
}

function normalizeDashboardStatusFilter(value) {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (['approved', 'rejected', 'pending'].includes(normalized)) {
    return normalized;
  }
  return null;
}

function normalizeDashboardDistinctValue(value) {
  const trimmed = String(value ?? '').trim();
  return trimmed || DASHBOARD_EMPTY_VALUE_LABEL;
}

async function getCoordinatorMappedUnits(companyIdentifier, coordinatorEmail) {
  if (!companyIdentifier || !coordinatorEmail) {
    return [];
  }

  const result = await pool.query(
    `
      SELECT DISTINCT
        NULLIF(TRIM(unit_id), '') AS unit_id,
        NULLIF(TRIM(unit_name), '') AS unit_name
      FROM company_unit_master
      WHERE company_identifier = $1
        AND LOWER(TRIM(COALESCE(coordinator_email_id, ''))) = $2
        AND NULLIF(TRIM(unit_id), '') IS NOT NULL
      ORDER BY unit_name ASC, unit_id ASC
    `,
    [companyIdentifier, coordinatorEmail]
  );

  return result.rows;
}

async function getCompanyUnits(companyIdentifier) {
  if (!companyIdentifier) {
    return [];
  }

  const result = await pool.query(
    `
      SELECT DISTINCT
        NULLIF(TRIM(unit_id), '') AS unit_id,
        NULLIF(TRIM(unit_name), '') AS unit_name
      FROM company_unit_master
      WHERE company_identifier = $1
        AND NULLIF(TRIM(unit_id), '') IS NOT NULL
      ORDER BY unit_name ASC, unit_id ASC
    `,
    [companyIdentifier]
  );

  return result.rows;
}

async function getCoordinatorDashboardScope(req) {
  const companyIdentifier = String(req.user?.company_identifier || '').trim() || null;
  const companyUnits = await getCompanyUnits(companyIdentifier);
  const companyUnitIds = companyUnits
    .map((row) => String(row.unit_id || '').trim())
    .filter(Boolean);

  const selectedUnitId = normalizeDashboardFilterValue(req.query?.unit_id);
  if (selectedUnitId && !companyUnitIds.includes(selectedUnitId)) {
    const error = new Error('Selected unit does not belong to this company');
    error.statusCode = 403;
    throw error;
  }

  return {
    companyIdentifier,
    companyUnits,
    selectedUnitId,
    filters: {
      active: parseDashboardActiveFilter(req.query?.active),
      businessProcess: normalizeDashboardFilterValue(req.query?.business_process),
      financialYear: normalizeDashboardFilterValue(req.query?.financial_year),
      status: normalizeDashboardStatusFilter(req.query?.status),
      conclusion: normalizeDashboardFilterValue(req.query?.conclusion),
    },
  };
}

function buildCoordinatorDashboardWhereClause(scope, alias = 'cf') {
  const params = [];
  const conditions = [];
  let paramIndex = 1;

  conditions.push(`${alias}.company_identifier = $${paramIndex}`);
  params.push(scope.companyIdentifier);
  paramIndex += 1;

  if (scope.selectedUnitId) {
    conditions.push(`TRIM(COALESCE(${alias}.unit_id, '')) = $${paramIndex}`);
    params.push(scope.selectedUnitId);
    paramIndex += 1;
  }

  if (scope.filters.active === true) {
    conditions.push(`${alias}.active = TRUE`);
  } else if (scope.filters.active === false) {
    conditions.push(`COALESCE(${alias}.active, FALSE) = FALSE`);
  }

  if (scope.filters.businessProcess) {
    conditions.push(`LOWER(TRIM(COALESCE(${alias}.business_process, ''))) = $${paramIndex}`);
    params.push(scope.filters.businessProcess.toLowerCase());
    paramIndex += 1;
  }

  if (scope.filters.financialYear) {
    conditions.push(`TRIM(COALESCE(${alias}.financial_year, '')) = $${paramIndex}`);
    params.push(scope.filters.financialYear);
    paramIndex += 1;
  }

  if (scope.filters.status === 'approved') {
    conditions.push(`LOWER(TRIM(COALESCE(${alias}.status, ''))) = 'approved'`);
  } else if (scope.filters.status === 'rejected') {
    conditions.push(`LOWER(TRIM(COALESCE(${alias}.status, ''))) = 'rejected'`);
  } else if (scope.filters.status === 'pending') {
    conditions.push(`(
      COALESCE(NULLIF(TRIM(${alias}.status), ''), '') = ''
      OR LOWER(TRIM(COALESCE(${alias}.status, ''))) = 'sent for approval'
    )`);
  }

  if (scope.filters.conclusion) {
    if (scope.filters.conclusion.toLowerCase() === 'none') {
      conditions.push(`COALESCE(NULLIF(TRIM(${alias}.control_design_conclusion), ''), '') = ''`);
    } else {
      conditions.push(`LOWER(TRIM(COALESCE(${alias}.control_design_conclusion, ''))) = $${paramIndex}`);
      params.push(scope.filters.conclusion.toLowerCase());
      paramIndex += 1;
    }
  }

  return {
    whereClause: conditions.join('\n      AND '),
    params,
  };
}

function classifyDashboardControlType(value) {
  const normalized = String(value || '').trim().toLowerCase();

  if (normalized.includes('semi')) {
    return 'semiAutomated';
  }

  if (normalized === 'manual') {
    return 'manual';
  }

  if (normalized === 'automated' || normalized === 'automative') {
    return 'automated';
  }

  return 'unclassified';
}

async function getCoordinatorDashboardAggregateRow(scope, selectClause) {
  if (!scope.companyIdentifier) {
    return null;
  }

  const { whereClause, params } = buildCoordinatorDashboardWhereClause(scope);
  const result = await pool.query(
    `
      SELECT
        ${selectClause}
      FROM control_forms cf
      WHERE ${whereClause}
    `,
    params
  );

  return result.rows[0] || null;
}

async function getCoordinatorDashboardDistinctValues(scope, columnName, excludedValues = [], options = {}) {
  if (!scope.companyIdentifier) {
    return [];
  }

  const { includeEmpty = false } = options;
  const { whereClause, params } = buildCoordinatorDashboardWhereClause(scope);
  const distinctParams = [...params];
  let paramIndex = distinctParams.length + 1;
  let exclusionCondition = '';

  if (excludedValues.length > 0) {
    exclusionCondition = ` AND LOWER(TRIM(COALESCE(cf.${columnName}, ''))) <> ALL($${paramIndex}::text[])`;
    distinctParams.push(excludedValues.map((value) => String(value).trim().toLowerCase()));
    paramIndex += 1;
  }

  if (!includeEmpty) {
    exclusionCondition += ` AND COALESCE(NULLIF(TRIM(cf.${columnName}), ''), '') <> ''`;
  }

  const result = await pool.query(
    `
      SELECT DISTINCT
        CASE
          WHEN NULLIF(TRIM(cf.${columnName}), '') IS NULL THEN $${paramIndex}
          ELSE TRIM(cf.${columnName})
        END AS value
      FROM control_forms cf
      WHERE ${whereClause}${exclusionCondition}
      ORDER BY value ASC
    `,
    [...distinctParams, DASHBOARD_EMPTY_VALUE_LABEL]
  );

  return result.rows
    .map((row) => normalizeDashboardDistinctValue(row.value))
    .filter(Boolean);
}

async function getCoordinatorDashboardKeyControlValues(scope) {
  if (!scope.companyIdentifier) {
    return [];
  }

  const { whereClause, params } = buildCoordinatorDashboardWhereClause(scope);
  const result = await pool.query(
    `
      SELECT cf.key_control
      FROM control_forms cf
      WHERE ${whereClause}
    `,
    params
  );

  return result.rows;
}

async function getCoordinatorDashboardRacmRows(scope) {
  const { whereClause, params } = buildCoordinatorDashboardWhereClause(scope);
  const result = await pool.query(
    `
      SELECT
        cf.*
      FROM control_forms cf
      WHERE ${whereClause}
      ORDER BY
        LOWER(TRIM(COALESCE(cf.business_process, ''))) ASC,
        cf.id ASC
    `,
    params
  );

  return result.rows.map((row) => ({
    ...row,
    key_control_classification: classifyKeyControlValue(row?.key_control),
    control_type_classification: classifyDashboardControlType(row?.control_type_ma),
  }));
}

function filterKeyManualControls(rows) {
  return (rows || []).filter((row) => (
    isKeyControlValue(row?.key_control) &&
    classifyDashboardControlType(row?.control_type_ma) === 'manual'
  ));
}

function shapeControlForAi(row) {
  return {
    controlNumber: String(row?.control_number || '').trim(),
    businessProcess: String(row?.business_process || '').trim(),
    subProcess: String(row?.sub_process || '').trim(),
    riskDescription: String(row?.risk_description || '').trim(),
    controlObjective: String(row?.control_objective || '').trim(),
    standardControlDescription: String(row?.standard_control_description || '').trim(),
    natureOfControl: String(row?.nature_of_control || '').trim(),
    controlFrequency: String(row?.control_frequency || '').trim(),
    whetherFraudRisksExist: String(row?.whether_fraud_risks_exist || '').trim(),
    controlTypeFo: String(row?.control_type_fo || '').trim(),
    controlTypeMa: String(row?.control_type_ma || '').trim(),
    keyControl: String(row?.key_control || '').trim(),
    riskHeat: String(row?.risk_heat || '').trim(),
    controlReliesOnIpe: String(row?.control_relies_on_ipe || '').trim(),
    applicationName: String(row?.application_name || '').trim(),
  };
}

async function createCompanyUser(client, coordinator, payload = {}) {
  getPasswordPepper();

  const emailId = normalizeEmail(payload.email_id);
  const empCode = payload.emp_code && payload.emp_code.trim() ? payload.emp_code.trim() : null;
  const empName = payload.emp_name && payload.emp_name.trim() ? payload.emp_name.trim() : null;
  const designation = payload.designation && payload.designation.trim() ? payload.designation.trim() : null;
  const department = payload.department && payload.department.trim() ? payload.department.trim() : null;
  const mobileDigits = normalizeMobileDigits(payload.mobile);
  const mobile = mobileDigits || null;
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

  if (mobile) {
    const mobileError = getMobileValidationError(mobile);
    if (mobileError) {
      const error = new Error(mobileError);
      error.statusCode = 400;
      throw error;
    }
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
  const tempPasswordEncrypted = encryptTempPassword(tempPassword);

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
        unit_id,
        login_email_sent,
        temp_password_encrypted
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, FALSE, $12)
      RETURNING id, email_id, company_identifier, unit_id
    `,
    [
      emailId,
      tempPasswordHash,
      'user',
      companyIdentifier,
      true,
      empCode,
      empName,
      designation,
      department,
      mobile,
      unitId,
      tempPasswordEncrypted,
    ]
  );

  return {
    user: userResult.rows[0],
    loginEmailQueued: true,
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

function buildUnitAssignmentNotificationEmail({ roleLabel, unitName, companyName }) {
  const safeRoleLabel = String(roleLabel || 'User').trim();
  const safeUnitName = String(unitName || 'the specified').trim();
  const safeCompanyName = String(companyName || 'your').trim();

  return {
    subject: `Unit Assignment Notification - ${safeCompanyName}`,
    text: `Dear Sir/Madam,

This is to formally inform you that you have been assigned as a ${safeRoleLabel} to the ${safeUnitName} unit for the company ${safeCompanyName}.

You are requested to take note of this assignment and proceed with your responsibilities accordingly.

Regards,
${safeCompanyName}`,
  };
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
  const tempPasswordEncrypted = encryptTempPassword(tempPassword);

  const createdUser = await prisma.ifcUser.create({
    data: {
      emailId,
      password: tempPasswordHash,
      role: config.role,
      companyIdentifier,
      tempLogin: true,
      loginEmailSent: false,
      tempPasswordEncrypted,
    },
    select: {
      id: true,
      emailId: true,
      role: true,
      companyIdentifier: true,
    },
  });

  return {
    user: {
      id: createdUser.id,
      email_id: createdUser.emailId,
      role: createdUser.role,
      company_identifier: createdUser.companyIdentifier,
    },
    loginEmailQueued: true,
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
      SELECT
        u.email_id,
        u.role,
        u.emp_name,
        u.designation,
        u.department,
        u.mobile,
        u.company_identifier,
        CASE
          WHEN u.role = 'company_co' THEN coordinator_units.unit_ids
          WHEN u.role = 'approver' THEN approver_units.unit_ids
          ELSE NULLIF(TRIM(u.unit_id), '')
        END AS unit_id,
        CASE
          WHEN u.role = 'company_co' THEN coordinator_units.unit_names
          WHEN u.role = 'approver' THEN approver_units.unit_names
          ELSE NULLIF(TRIM(user_unit.unit_name), '')
        END AS unit_name
      FROM ifc_users u
      LEFT JOIN company_unit_master user_unit
        ON user_unit.company_identifier = u.company_identifier
       AND user_unit.unit_id = u.unit_id
      LEFT JOIN LATERAL (
        SELECT
          STRING_AGG(mapped_units.unit_id, ', ' ORDER BY mapped_units.unit_name, mapped_units.unit_id) AS unit_ids,
          STRING_AGG(mapped_units.unit_name, ', ' ORDER BY mapped_units.unit_name, mapped_units.unit_id) AS unit_names
        FROM (
          SELECT DISTINCT
            NULLIF(TRIM(unit_id), '') AS unit_id,
            NULLIF(TRIM(unit_name), '') AS unit_name
          FROM company_unit_master
          WHERE company_identifier = u.company_identifier
            AND LOWER(TRIM(COALESCE(coordinator_email_id, ''))) = LOWER(TRIM(u.email_id))
            AND NULLIF(TRIM(unit_id), '') IS NOT NULL
        ) mapped_units
      ) coordinator_units ON u.role = 'company_co'
      LEFT JOIN LATERAL (
        SELECT
          STRING_AGG(mapped_units.unit_id, ', ' ORDER BY mapped_units.unit_name, mapped_units.unit_id) AS unit_ids,
          STRING_AGG(mapped_units.unit_name, ', ' ORDER BY mapped_units.unit_name, mapped_units.unit_id) AS unit_names
        FROM (
          SELECT DISTINCT
            NULLIF(TRIM(unit_id), '') AS unit_id,
            NULLIF(TRIM(unit_name), '') AS unit_name
          FROM company_unit_master
          WHERE company_identifier = u.company_identifier
            AND LOWER(TRIM(COALESCE(approver_email_id, ''))) = LOWER(TRIM(u.email_id))
            AND NULLIF(TRIM(unit_id), '') IS NOT NULL
        ) mapped_units
      ) approver_units ON u.role = 'approver'
      WHERE u.company_identifier = $1
    `;
    const params = [companyIdentifier];
    let paramIndex = 2;

    if (roleParam) {
      query += ` AND u.role = $${paramIndex}`;
      params.push(roleParam);
      paramIndex++;
    }

    // Assignable "user" role list (Process Owner / Control Performer): only users in units mapped to this coordinator
    if (String(roleParam).toLowerCase() === 'user') {
      const coordinatorEmail = normalizeEmail(req.user.email_id);
      query += ` AND EXISTS (
        SELECT 1
        FROM company_unit_master cum
        WHERE cum.company_identifier = u.company_identifier
          AND NULLIF(TRIM(cum.unit_id), '') IS NOT NULL
          AND NULLIF(TRIM(u.unit_id), '') IS NOT NULL
          AND LOWER(TRIM(cum.unit_id)) = LOWER(TRIM(u.unit_id))
          AND LOWER(TRIM(COALESCE(cum.coordinator_email_id, ''))) = $${paramIndex}
      )`;
      params.push(coordinatorEmail);
      paramIndex++;
    }

    if (qRaw) {
      query += ` AND (
        LOWER(COALESCE(u.emp_name, '')) LIKE $${paramIndex}
        OR LOWER(TRIM(u.email_id)) LIKE $${paramIndex}
        OR LOWER(COALESCE(user_unit.unit_name, '')) LIKE $${paramIndex}
        OR LOWER(COALESCE(coordinator_units.unit_names, '')) LIKE $${paramIndex}
        OR LOWER(COALESCE(approver_units.unit_names, '')) LIKE $${paramIndex}
      )`;
      params.push(`%${qRaw.toLowerCase()}%`);
      paramIndex++;
    }

    query += ' ORDER BY u.created_at DESC';

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

async function getDashboardFilters(req, res) {
  try {
    const companyIdentifier = String(req.user?.company_identifier || '').trim() || null;

    if (!companyIdentifier) {
      return res.status(200).json({
        success: true,
        data: {
          units: [],
          financialYears: [],
          conclusions: [],
        },
      });
    }

    const [units, financialYearsResult, conclusionsResult] = await Promise.all([
      getCompanyUnits(companyIdentifier),
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
      pool.query(
        `
          SELECT DISTINCT COALESCE(NULLIF(TRIM(control_design_conclusion), ''), 'None') AS conclusion
          FROM control_forms
          WHERE company_identifier = $1
          ORDER BY conclusion ASC
        `,
        [companyIdentifier]
      ),
    ]);

    const conclusions = conclusionsResult.rows
      .map((row) => String(row.conclusion || '').trim())
      .filter(Boolean)
      .sort((a, b) => {
        if (a === 'None') return 1;
        if (b === 'None') return -1;
        return a.localeCompare(b);
      });

    return res.status(200).json({
      success: true,
      data: {
        units,
        financialYears: financialYearsResult.rows
          .map((row) => String(row.financial_year || '').trim())
          .filter(Boolean),
        conclusions,
      },
    });
  } catch (error) {
    console.error('Company coordinator dashboard filters error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch dashboard filters',
    });
  }
}

async function getHomeStats(req, res) {
  try {
    const companyIdentifier = req.user.company_identifier;
    const coordinatorEmail = normalizeEmail(req.user.email_id);

    if (!companyIdentifier) {
      return res.status(200).json({
        success: true,
        data: {
          coordinatorName: req.user.emp_name || req.user.email_id || 'User',
          coordinatorUnits: [],
          totalUsers: 0,
          totalRacms: 0,
          approvedRacms: 0,
          rejectedRacms: 0,
        },
      });
    }

    const unitsResult = await pool.query(
      `
        SELECT DISTINCT
          NULLIF(TRIM(unit_id), '') AS unit_id,
          NULLIF(TRIM(unit_name), '') AS unit_name
        FROM company_unit_master
        WHERE company_identifier = $1
          AND LOWER(TRIM(COALESCE(coordinator_email_id, ''))) = $2
          AND NULLIF(TRIM(unit_id), '') IS NOT NULL
        ORDER BY unit_name ASC, unit_id ASC
      `,
      [companyIdentifier, coordinatorEmail]
    );

    const mappedUnitIds = unitsResult.rows
      .map((row) => String(row.unit_id || '').trim())
      .filter(Boolean);

    if (mappedUnitIds.length === 0) {
      return res.status(200).json({
        success: true,
        data: {
          coordinatorName: req.user.emp_name || req.user.email_id || 'User',
          coordinatorUnits: unitsResult.rows,
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
            AND NULLIF(TRIM(unit_id), '') = ANY($2::text[])
        `,
        [companyIdentifier, mappedUnitIds]
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
            AND NULLIF(TRIM(unit_id), '') = ANY($2::text[])
        `,
        [companyIdentifier, mappedUnitIds]
      ),
    ]);

    const userRow = usersResult.rows[0] || {};
    const racmRow = racmResult.rows[0] || {};

    return res.status(200).json({
      success: true,
      data: {
        coordinatorName: req.user.emp_name || req.user.email_id || 'User',
        coordinatorUnits: unitsResult.rows,
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

async function getDashboardSummary(req, res) {
  try {
    const scope = await getCoordinatorDashboardScope(req);

    if (!scope.companyIdentifier) {
      return res.status(200).json({
        success: true,
        data: {
          totalRacms: 0,
          units: scope.companyUnits,
          selectedUnitId: scope.selectedUnitId,
        },
      });
    }

    const row = await getCoordinatorDashboardAggregateRow(
      scope,
      `COUNT(*)::int AS total_racms`
    );

    return res.status(200).json({
      success: true,
      data: {
        totalRacms: Number(row?.total_racms || 0),
        units: scope.companyUnits,
        selectedUnitId: scope.selectedUnitId,
      },
    });
  } catch (error) {
    console.error('Company coordinator dashboard summary error:', error);
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Failed to fetch dashboard summary',
    });
  }
}

async function getDashboardKeyControlStats(req, res) {
  try {
    const scope = await getCoordinatorDashboardScope(req);

    if (!scope.companyIdentifier) {
      return res.status(200).json({
        success: true,
        data: {
          keyControls: 0,
          nonKeyControls: 0,
          notClassified: 0,
          unclassifiedValues: [],
        },
      });
    }

    const rows = await getCoordinatorDashboardKeyControlValues(scope);
    const counts = {
      keyControls: 0,
      nonKeyControls: 0,
      notClassified: 0,
    };
    const unclassifiedSet = new Set();

    for (const item of rows) {
      const rawValue = String(item?.key_control || '').trim();
      const classification = classifyKeyControlValue(rawValue);

      if (classification === 'key') {
        counts.keyControls += 1;
      } else if (classification === 'nonKey') {
        counts.nonKeyControls += 1;
      } else {
        counts.notClassified += 1;
        if (rawValue && isUnclassifiedKeyControlValue(rawValue)) {
          unclassifiedSet.add(rawValue);
        }
      }
    }

    return res.status(200).json({
      success: true,
      data: {
        keyControls: counts.keyControls,
        nonKeyControls: counts.nonKeyControls,
        notClassified: counts.notClassified,
        unclassifiedValues: Array.from(unclassifiedSet).sort((a, b) => a.localeCompare(b)),
      },
    });
  } catch (error) {
    console.error('Company coordinator dashboard key control stats error:', error);
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Failed to fetch key control dashboard stats',
    });
  }
}

async function getDashboardNatureStats(req, res) {
  try {
    const scope = await getCoordinatorDashboardScope(req);

    if (!scope.companyIdentifier) {
      return res.status(200).json({
        success: true,
        data: {
          preventive: 0,
          detective: 0,
          corrective: 0,
          notClassified: 0,
          unclassifiedValues: [],
        },
      });
    }

    const [row, unclassifiedValues] = await Promise.all([
      getCoordinatorDashboardAggregateRow(
        scope,
        `
          COUNT(*) FILTER (
            WHERE LOWER(TRIM(COALESCE(cf.nature_of_control, ''))) IN ('preventive', 'preventing')
          )::int AS preventive,
          COUNT(*) FILTER (
            WHERE LOWER(TRIM(COALESCE(cf.nature_of_control, ''))) = 'detective'
          )::int AS detective,
          COUNT(*) FILTER (
            WHERE LOWER(TRIM(COALESCE(cf.nature_of_control, ''))) LIKE '%corrective%'
          )::int AS corrective,
          COUNT(*) FILTER (
            WHERE LOWER(TRIM(COALESCE(cf.nature_of_control, ''))) NOT IN ('preventive', 'preventing', 'detective')
              AND LOWER(TRIM(COALESCE(cf.nature_of_control, ''))) NOT LIKE '%corrective%'
          )::int AS not_classified
        `
      ),
      getCoordinatorDashboardDistinctValues(scope, 'nature_of_control', ['preventive', 'preventing', 'detective', 'corrective'], { includeEmpty: true }),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        preventive: Number(row?.preventive || 0),
        detective: Number(row?.detective || 0),
        corrective: Number(row?.corrective || 0),
        notClassified: Number(row?.not_classified || 0),
        unclassifiedValues,
      },
    });
  } catch (error) {
    console.error('Company coordinator dashboard nature stats error:', error);
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Failed to fetch nature of control dashboard stats',
    });
  }
}

async function getDashboardControlTypeStats(req, res) {
  try {
    const scope = await getCoordinatorDashboardScope(req);

    if (!scope.companyIdentifier) {
      return res.status(200).json({
        success: true,
        data: {
          manual: 0,
          automated: 0,
          semiAutomated: 0,
          notClassified: 0,
          unclassifiedValues: [],
        },
      });
    }

    const [row, unclassifiedValues] = await Promise.all([
      getCoordinatorDashboardAggregateRow(
        scope,
        `
          COUNT(*) FILTER (
            WHERE LOWER(TRIM(COALESCE(cf.control_type_ma, ''))) = 'manual'
          )::int AS manual,
          COUNT(*) FILTER (
            WHERE LOWER(TRIM(COALESCE(cf.control_type_ma, ''))) IN ('automated', 'automative')
          )::int AS automated,
          COUNT(*) FILTER (
            WHERE LOWER(TRIM(COALESCE(cf.control_type_ma, ''))) LIKE '%semi%'
          )::int AS semi_automated,
          COUNT(*) FILTER (
            WHERE LOWER(TRIM(COALESCE(cf.control_type_ma, ''))) NOT IN ('manual', 'automated', 'automative')
              AND LOWER(TRIM(COALESCE(cf.control_type_ma, ''))) NOT LIKE '%semi%'
          )::int AS not_classified
        `
      ),
      getCoordinatorDashboardDistinctValues(scope, 'control_type_ma', ['manual', 'automated', 'automative', 'semi automated'], { includeEmpty: true }),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        manual: Number(row?.manual || 0),
        automated: Number(row?.automated || 0),
        semiAutomated: Number(row?.semi_automated || 0),
        notClassified: Number(row?.not_classified || 0),
        unclassifiedValues,
      },
    });
  } catch (error) {
    console.error('Company coordinator dashboard control type stats error:', error);
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Failed to fetch control type dashboard stats',
    });
  }
}

async function getDashboardRacms(req, res) {
  try {
    const scope = await getCoordinatorDashboardScope(req);

    if (!scope.companyIdentifier) {
      return res.status(200).json({
        success: true,
        data: [],
        count: 0,
      });
    }

    const shapedRows = await getCoordinatorDashboardRacmRows(scope);

    return res.status(200).json({
      success: true,
      data: shapedRows,
      count: shapedRows.length,
    });
  } catch (error) {
    console.error('Company coordinator dashboard RACMs error:', error);
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Failed to fetch dashboard RACMs',
    });
  }
}

async function generateKeyManualAiInsightsRun(req, res) {
  const lockClient = await pool.connect();
  let createdRunId = null;

  try {
    const locked = await tryAcquireGlobalAiModelLock(lockClient);
    if (!locked) {
      return res.status(409).json({
        success: false,
        message: 'Model is busy, try after some moments',
      });
    }

    const scope = await getCoordinatorDashboardScope(req);
    if (!scope.companyIdentifier) {
      return res.status(400).json({
        success: false,
        message: 'Company identifier is required',
      });
    }

    const dashboardRows = await getCoordinatorDashboardRacmRows(scope);
    const filteredControls = filterKeyManualControls(dashboardRows);

    if (filteredControls.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No Key + Manual Controls found for the current filters',
      });
    }

    const run = await prisma.keyManualAiInsightsRunTable.create({
      data: {
        companyIdentifier: scope.companyIdentifier,
        modelName: OLLAMA_MODEL,
        promptVersion: KEY_MANUAL_AI_PROMPT_VERSION,
        status: 'in_progress',
      },
      select: {
        id: true,
      },
    });

    createdRunId = run.id;

    const rowDataToCreate = [];

    for (const row of filteredControls) {
      const businessProcess = String(row?.business_process || '').trim() || 'Unspecified Business Process';
      const llmInputControl = shapeControlForAi(row);
      const llmResult = await requestControlSummary({
        companyIdentifier: scope.companyIdentifier,
        businessProcess,
        control: llmInputControl,
      });

      if (String(llmResult.controlNumber || '').trim() !== String(row?.control_number || '').trim()) {
        throw new Error(
          `Ollama returned control ${llmResult.controlNumber} for input ${row?.control_number}`
        );
      }

      rowDataToCreate.push({
        runId: createdRunId,
        companyIdentifier: scope.companyIdentifier,
        formId: row.form_id ? String(row.form_id).trim() : null,
        controlNumber: String(llmResult.controlNumber || '').trim(),
        businessProcess: businessProcess || null,
        rationalisationOpportunity: String(llmResult.rationalisationOpportunity || '').trim(),
      });
    }

    await prisma.$transaction(async (tx) => {
      if (rowDataToCreate.length > 0) {
        await tx.keyManualAiInsightsRowData.createMany({
          data: rowDataToCreate,
        });
      }

      await tx.keyManualAiInsightsRunTable.update({
        where: { id: createdRunId },
        data: { status: 'completed' },
      });
    });

    return res.status(200).json({
      success: true,
      message: 'AI summary generated successfully',
      data: {
        run_id: String(createdRunId),
        control_count: filteredControls.length,
        stored_row_count: rowDataToCreate.length,
        model_name: OLLAMA_MODEL,
      },
    });
  } catch (error) {
    console.error('Company coordinator generate key manual AI insights error:', error);

    const errorMessage = String(error?.message || '').trim();
    const clientMessage = errorMessage
      ? errorMessage
      : 'Failed to generate AI summary';

    if (createdRunId != null) {
      try {
        await prisma.keyManualAiInsightsRunTable.update({
          where: { id: createdRunId },
          data: { status: 'failed' },
        });
      } catch (updateError) {
        console.error('Failed to mark AI insights run as failed:', updateError);
      }
    }

    return res.status(500).json({
      success: false,
      message: clientMessage,
    });
  } finally {
    try {
      await releaseGlobalAiModelLock(lockClient);
    } catch (unlockError) {
      console.error('Failed to release AI model lock:', unlockError);
    }
    lockClient.release();
  }
}

async function getKeyManualAiInsightsAvailability(req, res) {
  try {
    const reachable = await isOllamaReachable();

    return res.status(200).json({
      success: true,
      data: {
        reachable,
      },
    });
  } catch (error) {
    console.error('Company coordinator key manual AI insights availability error:', error);
    return res.status(200).json({
      success: true,
      data: {
        reachable: false,
      },
    });
  }
}

async function getKeyManualAiInsightsRun(req, res) {
  try {
    const companyIdentifier = String(req.user?.company_identifier || '').trim();
    if (!companyIdentifier) {
      return res.status(400).json({
        success: false,
        message: 'Company identifier is required',
      });
    }

    const requestedRunId = String(req.query?.run_id || '').trim();
    let parsedRunId = null;
    if (requestedRunId) {
      try {
        parsedRunId = BigInt(requestedRunId);
      } catch (error) {
        return res.status(400).json({
          success: false,
          message: 'Invalid run id',
        });
      }
    }

    const runs = await prisma.keyManualAiInsightsRunTable.findMany({
      where: {
        companyIdentifier,
      },
      orderBy: [
        { createdAt: 'desc' },
        { id: 'desc' },
      ],
      include: {
        _count: {
          select: {
            rows: true,
          },
        },
      },
    });

    if (runs.length === 0) {
      return res.status(200).json({
        success: true,
        data: {
          runs: [],
          run: null,
          rows: [],
        },
      });
    }

    const selectedRunId = parsedRunId ?? runs[0].id;
    const run = await prisma.keyManualAiInsightsRunTable.findFirst({
      where: {
        id: selectedRunId,
        companyIdentifier,
      },
      include: {
        rows: {
          orderBy: [
            { businessProcess: 'asc' },
            { controlNumber: 'asc' },
          ],
        },
      },
    });

    if (!run) {
      return res.status(404).json({
        success: false,
        message: 'AI insights run not found for this company',
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        runs: runs.map((item) => ({
          id: String(item.id),
          company_identifier: item.companyIdentifier,
          model_name: item.modelName,
          status: item.status,
          created_at: item.createdAt,
          row_count: item._count.rows,
        })),
        run: {
          id: String(run.id),
          company_identifier: run.companyIdentifier,
          model_name: run.modelName,
          status: run.status,
          created_at: run.createdAt,
          row_count: run.rows.length,
        },
        rows: run.rows.map((row) => ({
          id: String(row.id),
          run_id: String(row.runId),
          company_identifier: row.companyIdentifier,
          form_id: row.formId,
          control_number: row.controlNumber,
          business_process: row.businessProcess,
          rationalisation_opportunity: row.rationalisationOpportunity,
          created_at: row.createdAt,
          updated_at: row.updatedAt,
        })),
      },
    });
  } catch (error) {
    console.error('Company coordinator key manual AI insights run error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch AI insights run',
    });
  }
}

async function deleteKeyManualAiInsightsRun(req, res) {
  try {
    const companyIdentifier = String(req.user?.company_identifier || '').trim();
    if (!companyIdentifier) {
      return res.status(400).json({
        success: false,
        message: 'Company identifier is required',
      });
    }

    const requestedRunId = String(req.params?.run_id || '').trim();
    if (!requestedRunId) {
      return res.status(400).json({
        success: false,
        message: 'Run id is required',
      });
    }

    let parsedRunId = null;
    try {
      parsedRunId = BigInt(requestedRunId);
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: 'Invalid run id',
      });
    }

    const existingRun = await prisma.keyManualAiInsightsRunTable.findFirst({
      where: {
        id: parsedRunId,
        companyIdentifier,
      },
      select: {
        id: true,
      },
    });

    if (!existingRun) {
      return res.status(404).json({
        success: false,
        message: 'AI insights run not found for this company',
      });
    }

    await prisma.keyManualAiInsightsRunTable.delete({
      where: {
        id: parsedRunId,
      },
    });

    return res.status(200).json({
      success: true,
      message: 'AI insights run deleted successfully',
      data: {
        run_id: requestedRunId,
      },
    });
  } catch (error) {
    console.error('Company coordinator delete key manual AI insights run error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete AI insights run',
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
          unmappedRoleUsers: [],
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
      currentUnitsRows,
      approversRows,
      coordinatorsRows,
      unmappedRoleUsersRows,
      unmappedCoordinatorUnitsRows,
      unmappedApproverUnitsRows,
      assignmentCoordinatorsRows,
      assignmentApproversRows,
      unitsRows,
    ] = await Promise.all([
      prisma.$queryRawUnsafe(
        `
          SELECT id, unit_id, unit_name, unit_address
          FROM company_unit_master
          WHERE company_identifier = $1
            AND LOWER(TRIM(COALESCE(coordinator_email_id, ''))) = $2
          ORDER BY unit_name ASC, id ASC
        `,
        companyIdentifier,
        coordinatorEmail
      ),
      prisma.$queryRawUnsafe(buildDistinctPeopleQuery('approver_email_id'), companyIdentifier),
      prisma.$queryRawUnsafe(buildDistinctPeopleQuery('coordinator_email_id'), companyIdentifier),
      prisma.$queryRawUnsafe(
        `
          SELECT *
          FROM (
            SELECT
              LOWER(TRIM(u.email_id)) AS email_id,
              COALESCE(NULLIF(TRIM(u.emp_name), ''), LOWER(TRIM(u.email_id))) AS display_name,
              'company_co' AS role
            FROM ifc_users u
            WHERE u.company_identifier = $1
              AND u.role = 'company_co'
              AND COALESCE(TRIM(u.email_id), '') <> ''
              AND NOT EXISTS (
                SELECT 1
                FROM company_unit_master cum
                WHERE cum.company_identifier = u.company_identifier
                  AND LOWER(TRIM(COALESCE(cum.coordinator_email_id, ''))) = LOWER(TRIM(u.email_id))
              )

            UNION ALL

            SELECT
              LOWER(TRIM(u.email_id)) AS email_id,
              COALESCE(NULLIF(TRIM(u.emp_name), ''), LOWER(TRIM(u.email_id))) AS display_name,
              'approver' AS role
            FROM ifc_users u
            WHERE u.company_identifier = $1
              AND u.role = 'approver'
              AND COALESCE(TRIM(u.email_id), '') <> ''
              AND NOT EXISTS (
                SELECT 1
                FROM company_unit_master cum
                WHERE cum.company_identifier = u.company_identifier
                  AND LOWER(TRIM(COALESCE(cum.approver_email_id, ''))) = LOWER(TRIM(u.email_id))
              )
          ) unmapped_role_users
          ORDER BY role ASC, display_name ASC, email_id ASC
        `,
        companyIdentifier
      ),
      prisma.$queryRawUnsafe(buildUnmappedUnitsQuery('coordinator_email_id'), companyIdentifier),
      prisma.$queryRawUnsafe(buildUnmappedUnitsQuery('approver_email_id'), companyIdentifier),
      prisma.$queryRawUnsafe(
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
        companyIdentifier
      ),
      prisma.$queryRawUnsafe(
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
        companyIdentifier
      ),
      prisma.$queryRawUnsafe(
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
        companyIdentifier
      ),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        currentCoordinatorUnits: currentUnitsRows,
        approvers: approversRows,
        coordinators: coordinatorsRows,
        unmappedRoleUsers: unmappedRoleUsersRows,
        unmappedCoordinatorUnits: unmappedCoordinatorUnitsRows,
        unmappedApproverUnits: unmappedApproverUnitsRows,
        assignmentCoordinators: assignmentCoordinatorsRows,
        assignmentApprovers: assignmentApproversRows,
        units: unitsRows,
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

    const { user, loginEmailQueued } = await createUnitMappedPrivilegedUser(
      client,
      req.user,
      req.body,
      'company_co'
    );

    await client.query('COMMIT');

    return res.status(201).json({
      success: true,
      message: 'Company coordinator created successfully',
      data: { user, loginEmailQueued },
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

    const { user, loginEmailQueued } = await createUnitMappedPrivilegedUser(
      client,
      req.user,
      req.body,
      'approver'
    );

    await client.query('COMMIT');

    return res.status(201).json({
      success: true,
      message: 'Approver created successfully',
      data: { user, loginEmailQueued },
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
    const requesterEmail = normalizeEmail(req.user?.email_id);
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
        SELECT id, unit_name, ${config.columnName}
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

    const currentAssignedEmail = normalizeEmail(unitResult.rows[0]?.[config.columnName]);
    const isReplacingOwnCoordinatorAssignment =
      config.role === 'company_co' &&
      requesterEmail &&
      currentAssignedEmail === requesterEmail &&
      emailId !== requesterEmail;

    if (isReplacingOwnCoordinatorAssignment) {
      await client.query('ROLLBACK');
      return res.status(403).json({
        success: false,
        message: 'You cannot replace your own company coordinator assignment. Assign another coordinator only for units not currently mapped to you.',
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

    try {
      const companyResult = await pool.query(
        `
          SELECT company_name
          FROM companies
          WHERE company_identifier = $1
          LIMIT 1
        `,
        [companyIdentifier]
      );

      const emailPayload = buildUnitAssignmentNotificationEmail({
        roleLabel: config.roleLabel,
        unitName: unitResult.rows[0]?.unit_name || unitId,
        companyName: companyResult.rows[0]?.company_name || companyIdentifier,
      });

      const emailSent = await sendEmail(emailId, emailPayload.subject, emailPayload.text);
      if (!emailSent) {
        console.warn(`Warning: failed to send unit assignment email to ${emailId}`);
      }
    } catch (emailError) {
      console.error('Unit assignment notification email error:', emailError);
    }

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

  try {
    const emailId = normalizeEmail(email_id);
    const empCode = String(emp_code || '').trim() || null;
    const empName = String(emp_name || '').trim() || null;
    const userDesignation = String(designation || '').trim() || null;
    const userDepartment = String(department || '').trim() || null;
    const userMobile = normalizeMobileDigits(mobile) || null;
    const unitId = String(unit_id || '').trim() || null;
    const companyIdentifier = coordinator.company_identifier || null;

    if (!emailId) {
      return res.status(400).json({
        success: false,
        message: 'Email ID is required',
      });
    }

    if (!isValidEmail(emailId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email format',
      });
    }

    if (userMobile) {
      const mobileError = getMobileValidationError(userMobile);
      if (mobileError) {
        return res.status(400).json({
          success: false,
          message: mobileError,
        });
      }
    }

    if (unitId && !companyIdentifier) {
      return res.status(400).json({
        success: false,
        message: 'Company identifier is required',
      });
    }

    getPasswordPepper();
    const companyName = await getCompanyName(companyIdentifier);
    const coordinatorName = String(coordinator.emp_name || '').trim() || 'Company Coordinator';

    const { user: newUser, loginEmailQueued, tempPassword, empName: createdEmpName } = await prisma.$transaction(async (tx) => {
      if (unitId) {
        const assignedUnit = await tx.companyUnitMaster.findFirst({
          where: {
            companyIdentifier,
            unitId,
            coordinatorEmailId: {
              equals: normalizeEmail(coordinator.email_id),
              mode: 'insensitive',
            },
          },
          select: { unitId: true },
        });

        if (!assignedUnit) {
          const error = new Error('Selected unit is not mapped with this company coordinator');
          error.statusCode = 403;
          throw error;
        }
      }

      const existingUser = await tx.ifcUser.findFirst({
        where: {
          emailId: {
            equals: emailId,
            mode: 'insensitive',
          },
        },
        select: { id: true },
      });

      if (existingUser) {
        const error = new Error('User with this email already exists');
        error.statusCode = 409;
        throw error;
      }

      const tempPassword = crypto.randomBytes(8).toString('hex');
      const tempPasswordHash = await hashPassword(tempPassword);
      const tempPasswordEncrypted = encryptTempPassword(tempPassword);

      const createdUser = await tx.ifcUser.create({
        data: {
          emailId,
          password: tempPasswordHash,
          role: 'user',
          companyIdentifier,
          tempLogin: true,
          empCode,
          empName,
          designation: userDesignation,
          department: userDepartment,
          mobile: userMobile,
          unitId,
          loginEmailSent: false,
          tempPasswordEncrypted,
        },
        select: {
          id: true,
          emailId: true,
          companyIdentifier: true,
          unitId: true,
        },
      });

      return {
        user: {
          id: createdUser.id,
          email_id: createdUser.emailId,
          company_identifier: createdUser.companyIdentifier,
          unit_id: createdUser.unitId,
        },
        loginEmailQueued: true,
        tempPassword,
        empName,
      };
    });

    try {
      const emailSent = await sendUserCreationEmail(pool, {
        userId: newUser.id,
        emailId: newUser.email_id,
        userName: createdEmpName,
        coordinatorName,
        coordinatorEmail: coordinator.email_id,
        companyName,
        tempPassword,
      });
      if (!emailSent) {
        console.warn(`Warning: failed to send user creation email to ${newUser.email_id}`);
      }
    } catch (emailError) {
      console.error('User creation email error:', emailError);
    }

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
      loginEmailQueued,
    });
  } catch (error) {
    console.error('Error creating user:', error);

    if (error.statusCode) {
      return res.status(error.statusCode).json({
        success: false,
        message: error.message,
      });
    }

    if (error.code === '23505' || error.code === 'P2002') {
      return res.status(409).json({
        success: false,
        message: 'User with this email already exists',
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
}

async function createUsersBulk(req, res) {
  const coordinator = req.user;
  let requestAborted = false;
  const markRequestAborted = () => {
    requestAborted = true;
  };
  req.on('aborted', markRequestAborted);
  req.on('close', markRequestAborted);

  const companyIdentifier = coordinator.company_identifier || null;
  const inputEmails = Array.isArray(req.body?.email_ids) ? req.body.email_ids : [];
  const usersInput = Array.isArray(req.body?.users) ? req.body.users : [];
  const selectedUnitId = req.body?.unit_id && String(req.body.unit_id).trim()
    ? String(req.body.unit_id).trim()
    : null;

  if (usersInput.length > 0 && !selectedUnitId) {
    return res.status(400).json({
      success: false,
      message: 'Unit is required for bulk user upload',
    });
  }

  if (usersInput.length > 0 && !companyIdentifier) {
    return res.status(400).json({
      success: false,
      message: 'Company identifier is missing for coordinator',
    });
  }

  const normalizedEmails = [...new Set(inputEmails.map(normalizeEmail).filter(Boolean))];
  const invalidEmails = normalizedEmails.filter((email) => !isValidEmail(email));
  const legacyEmailIds = normalizedEmails.filter((email) => isValidEmail(email));

  const uploadRows = [];
  const skippedRows = [];
  const invalidRowEmails = [];

  if (usersInput.length > 0) {
    usersInput.forEach((row, index) => {
      const rowNumber = index + 2;
      const emailId = normalizeEmail(row?.email_id);

      if (!emailId) {
        skippedRows.push({
          rowNumber,
          reason: 'Email ID is missing',
        });
        return;
      }

      if (!isValidEmail(emailId)) {
        invalidRowEmails.push(emailId);
        skippedRows.push({
          rowNumber,
          email_id: emailId,
          reason: 'Invalid email format',
        });
        return;
      }

      const mobileDigits = normalizeMobileDigits(row?.mobile);
      if (mobileDigits) {
        const mobileError = getMobileValidationError(mobileDigits);
        if (mobileError) {
          skippedRows.push({
            rowNumber,
            email_id: emailId,
            reason: mobileError,
          });
          return;
        }
      }

      uploadRows.push({
        rowNumber,
        payload: {
          email_id: emailId,
          emp_name: row?.emp_name || null,
          department: row?.department || null,
          designation: row?.designation || null,
          mobile: mobileDigits || null,
          unit_id: selectedUnitId,
        },
      });
    });
  }

  const emailPayloadRows = legacyEmailIds.map((emailId) => ({
    rowNumber: null,
    payload: { email_id: emailId },
  }));

  const rowsToCreate = [...uploadRows, ...emailPayloadRows];

  if (rowsToCreate.length === 0) {
    return res.status(400).json({
      success: false,
      message: usersInput.length > 0
        ? 'No valid rows found for user creation'
        : (invalidEmails.length > 0
          ? 'No valid email IDs found for user creation'
          : 'At least one email ID is required'),
      invalidEmails: [...invalidEmails, ...invalidRowEmails],
      skippedRows,
    });
  }

  try {
    const createdUsers = [];
    const skippedEmails = [];
    const duplicateRows = [];
    getPasswordPepper();
    const companyName = await getCompanyName(companyIdentifier);
    const coordinatorName = String(coordinator.emp_name || '').trim() || 'Company Coordinator';

    const coordinatorEmail = normalizeEmail(coordinator.email_id);
    if (selectedUnitId) {
      const assignedUnit = await prisma.companyUnitMaster.findFirst({
        where: {
          companyIdentifier,
          unitId: selectedUnitId,
          coordinatorEmailId: {
            equals: coordinatorEmail,
            mode: 'insensitive',
          },
        },
        select: { unitId: true },
      });

      if (!assignedUnit) {
        const error = new Error('Selected unit is not mapped with this company coordinator');
        error.statusCode = 403;
        throw error;
      }
    }

    const targetEmails = [...new Set(rowsToCreate.map((item) => normalizeEmail(item.payload?.email_id)).filter(Boolean))];
    const existingUsers = await prisma.ifcUser.findMany({
      where: {
        OR: targetEmails.map((emailId) => ({
          emailId: {
            equals: emailId,
            mode: 'insensitive',
          },
        })),
      },
      select: { emailId: true },
    });
    const existingEmailSet = new Set(existingUsers.map((u) => normalizeEmail(u.emailId)));

    for (const item of rowsToCreate) {
      if (requestAborted) {
        const abortError = new Error('User insertion cancelled by client navigation');
        abortError.statusCode = 499;
        throw abortError;
      }

      const emailId = normalizeEmail(item.payload?.email_id);
      const mobileValue = normalizeMobileDigits(item.payload?.mobile) || null;

      if (mobileValue) {
        const mobileError = getMobileValidationError(mobileValue);
        if (mobileError) {
          if (item.rowNumber != null) {
            skippedRows.push({
              rowNumber: item.rowNumber,
              email_id: emailId,
              reason: mobileError,
            });
          }
          continue;
        }
      }

      if (existingEmailSet.has(emailId)) {
        const duplicateEmail = normalizeEmail(item.payload?.email_id);
        skippedEmails.push(duplicateEmail);
        if (item.rowNumber != null) {
          duplicateRows.push({
            rowNumber: item.rowNumber,
            email_id: duplicateEmail,
            reason: 'User already exists',
          });
        }
        continue;
      }

      const tempPassword = crypto.randomBytes(8).toString('hex');
      const tempPasswordHash = await hashPassword(tempPassword);
      const tempPasswordEncrypted = encryptTempPassword(tempPassword);

      try {
        const createdUser = await prisma.ifcUser.create({
          data: {
            emailId,
            password: tempPasswordHash,
            role: 'user',
            companyIdentifier,
            tempLogin: true,
            empCode: null,
            empName: item.payload?.emp_name || null,
            designation: item.payload?.designation || null,
            department: item.payload?.department || null,
            mobile: mobileValue,
            unitId: item.payload?.unit_id || null,
            loginEmailSent: false,
            tempPasswordEncrypted,
          },
          select: {
            id: true,
            emailId: true,
            companyIdentifier: true,
            unitId: true,
          },
        });

        existingEmailSet.add(emailId);
        createdUsers.push({
          id: createdUser.id,
          email_id: createdUser.emailId,
          company_identifier: createdUser.companyIdentifier,
          unit_id: createdUser.unitId,
          loginEmailQueued: true,
          tempPassword,
          emp_name: item.payload?.emp_name || null,
        });
      } catch (createError) {
        if (createError.code === 'P2002') {
          const duplicateEmail = normalizeEmail(item.payload?.email_id);
          skippedEmails.push(duplicateEmail);
          if (item.rowNumber != null) {
            duplicateRows.push({
              rowNumber: item.rowNumber,
              email_id: duplicateEmail,
              reason: 'User already exists',
            });
          }
          existingEmailSet.add(emailId);
          continue;
        }
        throw createError;
      }
    }

    for (const createdUser of createdUsers) {
      try {
        const emailSent = await sendUserCreationEmail(pool, {
          userId: createdUser.id,
          emailId: createdUser.email_id,
          userName: createdUser.emp_name,
          coordinatorName,
          coordinatorEmail: coordinator.email_id,
          companyName,
          tempPassword: createdUser.tempPassword,
        });
        if (!emailSent) {
          console.warn(`Warning: failed to send user creation email to ${createdUser.email_id}`);
        }
      } catch (emailError) {
        console.error(`User creation email error for ${createdUser.email_id}:`, emailError);
      }
    }

    return res.status(201).json({
      success: true,
      message: `Created ${createdUsers.length} user(s) successfully`,
      createdUsers: createdUsers.map(({ tempPassword: _tempPassword, emp_name: _empName, ...rest }) => rest),
      skippedEmails,
      invalidEmails: [...invalidEmails, ...invalidRowEmails],
      skippedRows: [...skippedRows, ...duplicateRows],
    });
  } catch (error) {
    console.error('Error creating users in bulk:', error);

    if (error.statusCode === 499) {
      if (!res.headersSent) {
        return res.status(499).json({
          success: false,
          message: 'User insertion cancelled by client navigation',
        });
      }
      return;
    }

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
    req.off('aborted', markRequestAborted);
    req.off('close', markRequestAborted);
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

  try {
    const coordinatorUnits = await prisma.companyUnitMaster.findMany({
      where: {
        companyIdentifier,
        coordinatorEmailId: {
          equals: normalizeEmail(coordinator.email_id),
          mode: 'insensitive',
        },
      },
      select: { unitId: true },
    });

    const mappedUnitIds = coordinatorUnits
      .map((row) => (row.unitId == null ? '' : String(row.unitId).trim()))
      .filter(Boolean);

    if (mappedUnitIds.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'You are not mapped to any unit, so you cannot delete users',
      });
    }

    const candidateUsers = await prisma.ifcUser.findMany({
      where: {
        companyIdentifier,
        role: 'user',
      },
      select: {
        id: true,
        emailId: true,
        unitId: true,
      },
    });

    const emailSet = new Set(normalizedEmails);
    const usersToDelete = candidateUsers
      .map((row) => ({
        id: row.id,
        email_id: normalizeEmail(row.emailId),
        unit_id: row.unitId,
      }))
      .filter((row) => emailSet.has(row.email_id));

    const foundEmails = new Set(usersToDelete.map((row) => row.email_id));
    const missingEmails = normalizedEmails.filter((emailId) => !foundEmails.has(emailId));
    if (missingEmails.length > 0) {
      return res.status(404).json({
        success: false,
        message: 'One or more selected users were not found for this company',
        missingEmails,
      });
    }

    const mappedUnitSet = new Set(mappedUnitIds);
    const unauthorizedUsers = usersToDelete.filter((row) => {
      const userUnitId = row.unit_id == null ? '' : String(row.unit_id).trim();
      return !userUnitId || !mappedUnitSet.has(userUnitId);
    });

    if (unauthorizedUsers.length > 0) {
      return res.status(403).json({
        success: false,
        message: "You can't delete users from other units",
        unauthorized_users: unauthorizedUsers.map((row) => row.email_id),
      });
    }

    const authorizedUserIds = usersToDelete.map((row) => row.id);
    const authorizedEmails = usersToDelete.map((row) => row.email_id);

    const [deactivatedRacmsCount, deletedUsersCount] = await prisma.$transaction(async (tx) => {
      const deactivatedCount = await tx.$executeRawUnsafe(
        `
          UPDATE control_forms
          SET control_owner = NULL,
              active = FALSE,
              updated_at = CURRENT_TIMESTAMP
          WHERE company_identifier = $1
            AND LOWER(TRIM(control_owner)) = ANY($2::text[])
            AND unit_id = ANY($3::text[])
        `,
        companyIdentifier,
        authorizedEmails,
        mappedUnitIds
      );

      const deletedUsers = await tx.ifcUser.deleteMany({
        where: {
          id: {
            in: authorizedUserIds,
          },
        },
      });

      return [deactivatedCount, deletedUsers.count];
    });

    return res.status(200).json({
      success: true,
      message: `Deleted ${deletedUsersCount} user(s) successfully`,
      deleted_users: authorizedEmails,
      deactivated_racms: deactivatedRacmsCount,
    });
  } catch (error) {
    console.error('Error deleting users:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete user(s)',
    });
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
      SELECT role, unit_id
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
        unit_id: null,
      });
    }

    return res.status(200).json({
      success: true,
      exists: true,
      role: existingUser.rows[0]?.role || null,
      unit_id: existingUser.rows[0]?.unit_id || null,
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
      SELECT
        id,
        timestamp,
        TO_CHAR(
          timezone('Asia/Kolkata', timestamp AT TIME ZONE 'UTC'),
          'DD/MM/YYYY HH24:MI:SS'
        ) AS timestamp_ist,
        action,
        user_email_id,
        form_id,
        ref_data
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

async function getCommunicationMatrix(req, res) {
  try {
    const companyIdentifier = req.user.company_identifier;
    const coordinatorEmail = normalizeEmail(req.user.email_id);
    const businessProcessFilter = req.query.business_process != null
      ? String(req.query.business_process).trim()
      : '';

    if (!companyIdentifier) {
      return res.status(200).json({
        success: true,
        data: {
          company_identifier: null,
          mappedUnits: [],
          businessProcesses: [],
          entries: [],
        },
      });
    }

    const mappedUnitsResult = await pool.query(
      `
        SELECT DISTINCT
          NULLIF(TRIM(unit_id), '') AS unit_id,
          NULLIF(TRIM(unit_name), '') AS unit_name
        FROM company_unit_master
        WHERE company_identifier = $1
          AND LOWER(TRIM(COALESCE(coordinator_email_id, ''))) = $2
          AND NULLIF(TRIM(unit_id), '') IS NOT NULL
        ORDER BY unit_name ASC, unit_id ASC
      `,
      [companyIdentifier, coordinatorEmail]
    );

    const mappedUnits = mappedUnitsResult.rows;
    const mappedUnitIds = mappedUnits.map((row) => String(row.unit_id || '').trim()).filter(Boolean);

    if (mappedUnitIds.length === 0) {
      return res.status(200).json({
        success: true,
        data: {
          company_identifier: companyIdentifier,
          mappedUnits,
          businessProcesses: [],
          entries: [],
        },
      });
    }

    const businessProcesses = await listBusinessProcessesForCompany(pool, companyIdentifier);
    const allBusinessProcesses = businessProcesses
      .map((row) => String(row.business_process || '').trim())
      .filter(Boolean);

    let entriesQuery = `
      SELECT
        r.id,
        r.email_id,
        r.business_process,
        r.unit_id,
        COALESCE(NULLIF(TRIM(cum.unit_name), ''), r.unit_id) AS unit_name,
        r.created_at
      FROM racm_cc_users r
      LEFT JOIN company_unit_master cum
        ON cum.company_identifier = r.company_identifier
       AND cum.unit_id = r.unit_id
      WHERE r.company_identifier = $1
        AND r.unit_id = ANY($2::text[])
    `;
    const params = [companyIdentifier, mappedUnitIds];
    if (businessProcessFilter) {
      entriesQuery += ` AND TRIM(COALESCE(r.business_process, '')) = $3`;
      params.push(businessProcessFilter);
    }
    entriesQuery += ' ORDER BY r.business_process ASC, r.email_id ASC, unit_name ASC';

    const entriesResult = await pool.query(entriesQuery, params);

    return res.status(200).json({
      success: true,
      data: {
        company_identifier: companyIdentifier,
        mappedUnits,
        businessProcesses: allBusinessProcesses,
        entries: entriesResult.rows,
      },
    });
  } catch (error) {
    console.error('Get communication matrix error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch communication matrix',
    });
  }
}

async function addCommonCommunicationEmails(req, res) {
  const coordinator = req.user;
  const companyIdentifier = coordinator.company_identifier;
  const coordinatorEmail = normalizeEmail(coordinator.email_id);
  const inputEmails = Array.isArray(req.body?.email_ids) ? req.body.email_ids : [];
  const selectedUnitIdsInput = Array.isArray(req.body?.unit_ids) ? req.body.unit_ids : [];

  if (!companyIdentifier) {
    return res.status(400).json({
      success: false,
      message: 'Company identifier is missing for coordinator',
    });
  }

  const normalizedEmails = [...new Set(inputEmails.map(normalizeEmail).filter(Boolean))];
  if (normalizedEmails.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'At least one email ID is required',
    });
  }

  const invalidEmails = normalizedEmails.filter((email) => !isValidEmail(email));
  if (invalidEmails.length > 0) {
    return res.status(400).json({
      success: false,
      message: 'Invalid email format found',
      invalidEmails,
    });
  }

  const normalizedUnitIds = [...new Set(selectedUnitIdsInput.map((value) => String(value || '').trim()).filter(Boolean))];
  if (normalizedUnitIds.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'At least one mapped unit is required',
    });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const mappedUnitsResult = await client.query(
      `
        SELECT DISTINCT NULLIF(TRIM(unit_id), '') AS unit_id
        FROM company_unit_master
        WHERE company_identifier = $1
          AND LOWER(TRIM(COALESCE(coordinator_email_id, ''))) = $2
          AND NULLIF(TRIM(unit_id), '') IS NOT NULL
      `,
      [companyIdentifier, coordinatorEmail]
    );

    const mappedSet = new Set(
      mappedUnitsResult.rows
        .map((row) => String(row.unit_id || '').trim())
        .filter(Boolean)
    );
    const unauthorizedUnits = normalizedUnitIds.filter((unitId) => !mappedSet.has(unitId));
    if (unauthorizedUnits.length > 0) {
      await client.query('ROLLBACK');
      return res.status(403).json({
        success: false,
        message: 'One or more selected units are not mapped to this company coordinator',
        unauthorizedUnits,
      });
    }

    const businessProcessRows = await listBusinessProcessesForCompany(client, companyIdentifier);
    const businessProcesses = businessProcessRows
      .map((row) => String(row.business_process || '').trim())
      .filter(Boolean);

    if (businessProcesses.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: 'No business process master data found',
      });
    }

    let inserted = 0;
    let skipped = 0;

    for (const unitId of normalizedUnitIds) {
      for (const businessProcess of businessProcesses) {
        for (const emailId of normalizedEmails) {
          const result = await client.query(
            `
              INSERT INTO racm_cc_users (email_id, business_process, company_identifier, unit_id)
              SELECT $1::text, $2::text, $3::text, $4::text
              WHERE NOT EXISTS (
                SELECT 1
                FROM racm_cc_users
                WHERE LOWER(TRIM(email_id)) = $5
                  AND company_identifier = $3
                  AND unit_id = $4
                  AND TRIM(COALESCE(business_process, '')) = $2::text
              )
            `,
            [emailId, businessProcess, companyIdentifier, unitId, emailId]
          );
          if (result.rowCount > 0) inserted += 1;
          else skipped += 1;
        }
      }
    }

    await client.query('COMMIT');
    return res.status(201).json({
      success: true,
      message: 'Common CC email(s) added successfully',
      inserted,
      skipped,
      businessProcessCount: businessProcesses.length,
      unitCount: normalizedUnitIds.length,
      emailCount: normalizedEmails.length,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Add common communication emails error:', error);
    if (error.code === '23505') {
      return res.status(409).json({
        success: false,
        message: 'One or more email IDs already exist with conflicting unique constraint',
      });
    }
    return res.status(500).json({
      success: false,
      message: 'Failed to add communication emails',
    });
  } finally {
    client.release();
  }
}

async function createCompanyBusinessProcess(req, res) {
  try {
    const companyIdentifier = String(req.user?.company_identifier || '').trim();
    if (!companyIdentifier) {
      return res.status(400).json({
        success: false,
        message: 'Company identifier is missing for coordinator',
      });
    }

    const created = await createBusinessProcessMasterEntry({
      ...(req.body || {}),
      company_identifier: companyIdentifier,
      created_by_email: req.user?.email_id || null,
    });

    return res.status(201).json({
      success: true,
      message: 'Company specific business process created successfully',
      data: created,
    });
  } catch (error) {
    const statusCode = Number(error.statusCode || 500);
    if (statusCode >= 500) {
      console.error('Create company coordinator business process error:', error);
    }
    return res.status(statusCode).json({
      success: false,
      message: error.message || 'Failed to create company specific business process',
    });
  }
}

async function addBusinessProcessSpecificCommunicationEmails(req, res) {
  const coordinator = req.user;
  const companyIdentifier = coordinator.company_identifier;
  const coordinatorEmail = normalizeEmail(coordinator.email_id);
  const inputEmails = Array.isArray(req.body?.email_ids) ? req.body.email_ids : [];
  const selectedUnitIdsInput = Array.isArray(req.body?.unit_ids) ? req.body.unit_ids : [];
  const businessProcess = req.body?.business_process != null ? String(req.body.business_process).trim() : '';

  if (!companyIdentifier) {
    return res.status(400).json({
      success: false,
      message: 'Company identifier is missing for coordinator',
    });
  }

  if (!businessProcess) {
    return res.status(400).json({
      success: false,
      message: 'Business Process is required',
    });
  }

  const normalizedEmails = [...new Set(inputEmails.map(normalizeEmail).filter(Boolean))];
  if (normalizedEmails.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'At least one email ID is required',
    });
  }

  const invalidEmails = normalizedEmails.filter((email) => !isValidEmail(email));
  if (invalidEmails.length > 0) {
    return res.status(400).json({
      success: false,
      message: 'Invalid email format found',
      invalidEmails,
    });
  }

  const normalizedUnitIds = [...new Set(selectedUnitIdsInput.map((value) => String(value || '').trim()).filter(Boolean))];
  if (normalizedUnitIds.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'At least one mapped unit is required',
    });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const mappedUnitsResult = await client.query(
      `
        SELECT DISTINCT NULLIF(TRIM(unit_id), '') AS unit_id
        FROM company_unit_master
        WHERE company_identifier = $1
          AND LOWER(TRIM(COALESCE(coordinator_email_id, ''))) = $2
          AND NULLIF(TRIM(unit_id), '') IS NOT NULL
      `,
      [companyIdentifier, coordinatorEmail]
    );

    const mappedSet = new Set(
      mappedUnitsResult.rows
        .map((row) => String(row.unit_id || '').trim())
        .filter(Boolean)
    );
    const unauthorizedUnits = normalizedUnitIds.filter((unitId) => !mappedSet.has(unitId));
    if (unauthorizedUnits.length > 0) {
      await client.query('ROLLBACK');
      return res.status(403).json({
        success: false,
        message: 'One or more selected units are not mapped to this company coordinator',
        unauthorizedUnits,
      });
    }

    let inserted = 0;
    let skipped = 0;
    for (const unitId of normalizedUnitIds) {
      for (const emailId of normalizedEmails) {
        const result = await client.query(
          `
            INSERT INTO racm_cc_users (email_id, business_process, company_identifier, unit_id)
            SELECT $1::text, $2::text, $3::text, $4::text
            WHERE NOT EXISTS (
              SELECT 1
              FROM racm_cc_users
              WHERE LOWER(TRIM(email_id)) = $5
                AND company_identifier = $3
                AND unit_id = $4
                AND TRIM(COALESCE(business_process, '')) = $2::text
            )
          `,
          [emailId, businessProcess, companyIdentifier, unitId, emailId]
        );
        if (result.rowCount > 0) inserted += 1;
        else skipped += 1;
      }
    }

    await client.query('COMMIT');
    return res.status(201).json({
      success: true,
      message: 'Business Process specific email(s) added successfully',
      inserted,
      skipped,
      business_process: businessProcess,
      unitCount: normalizedUnitIds.length,
      emailCount: normalizedEmails.length,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Add business process specific communication emails error:', error);
    if (error.code === '23505') {
      return res.status(409).json({
        success: false,
        message: 'One or more email IDs already exist with conflicting unique constraint',
      });
    }
    return res.status(500).json({
      success: false,
      message: 'Failed to add communication emails',
    });
  } finally {
    client.release();
  }
}

async function deleteCommunicationMatrixEntries(req, res) {
  const coordinator = req.user;
  const companyIdentifier = coordinator.company_identifier;
  const coordinatorEmail = normalizeEmail(coordinator.email_id);
  const entryIdsInput = Array.isArray(req.body?.entry_ids) ? req.body.entry_ids : [];
  const entryIds = [...new Set(entryIdsInput.map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0))];

  if (!companyIdentifier) {
    return res.status(400).json({
      success: false,
      message: 'Company identifier is missing for coordinator',
    });
  }

  if (entryIds.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'At least one communication entry is required for deletion',
    });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const mappedUnitsResult = await client.query(
      `
        SELECT DISTINCT NULLIF(TRIM(unit_id), '') AS unit_id
        FROM company_unit_master
        WHERE company_identifier = $1
          AND LOWER(TRIM(COALESCE(coordinator_email_id, ''))) = $2
          AND NULLIF(TRIM(unit_id), '') IS NOT NULL
      `,
      [companyIdentifier, coordinatorEmail]
    );
    const mappedUnitIds = mappedUnitsResult.rows
      .map((row) => String(row.unit_id || '').trim())
      .filter(Boolean);

    if (mappedUnitIds.length === 0) {
      await client.query('ROLLBACK');
      return res.status(403).json({
        success: false,
        message: 'No mapped units found for this company coordinator',
      });
    }

    const ownershipResult = await client.query(
      `
        SELECT id
        FROM racm_cc_users
        WHERE company_identifier = $1
          AND unit_id = ANY($2::text[])
          AND id = ANY($3::int[])
      `,
      [companyIdentifier, mappedUnitIds, entryIds]
    );
    const allowedIds = ownershipResult.rows.map((row) => Number(row.id));
    const allowedIdSet = new Set(allowedIds);
    const unauthorizedIds = entryIds.filter((id) => !allowedIdSet.has(id));
    if (unauthorizedIds.length > 0) {
      await client.query('ROLLBACK');
      return res.status(403).json({
        success: false,
        message: 'One or more entries are not accessible for deletion',
        unauthorizedIds,
      });
    }

    const deleteResult = await client.query(
      `
        DELETE FROM racm_cc_users
        WHERE company_identifier = $1
          AND id = ANY($2::int[])
        RETURNING id
      `,
      [companyIdentifier, allowedIds]
    );

    await client.query('COMMIT');
    return res.status(200).json({
      success: true,
      message: `Deleted ${deleteResult.rowCount} communication entr${deleteResult.rowCount === 1 ? 'y' : 'ies'}`,
      deletedIds: deleteResult.rows.map((row) => Number(row.id)),
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Delete communication matrix entries error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete communication entries',
    });
  } finally {
    client.release();
  }
}

module.exports = {
  getUsers,
  getHomeStats,
  getDashboardFilters,
  getDashboardSummary,
  getDashboardKeyControlStats,
  getDashboardNatureStats,
  getDashboardControlTypeStats,
  getDashboardRacms,
  getKeyManualAiInsightsAvailability,
  getKeyManualAiInsightsRun,
  generateKeyManualAiInsightsRun,
  deleteKeyManualAiInsightsRun,
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
  getCommunicationMatrix,
  addCommonCommunicationEmails,
  addBusinessProcessSpecificCommunicationEmails,
  deleteCommunicationMatrixEntries,
  createCompanyBusinessProcess,
};
