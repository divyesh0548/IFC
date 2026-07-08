const crypto = require('crypto');
const { pool } = require('../../utils/db');
const { prisma } = require('../../lib/prisma');
const { requestControlSummary, OLLAMA_MODEL, isOllamaReachable } = require('../../ai_summary/key_manual_summary/ollama_client');
const { requestRiskAnalysis } = require('../../ai_summary/risk_analysis/ollama_client');
const {
  loadRiskAnalysisMasterByBusinessProcess,
  listRiskAnalysisBusinessProcesses,
} = require('../../ai_summary/risk_analysis/risk_analysis_master');
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
const {
  UNIT_RESPONSIBILITY_TYPES,
  getUnitResponsibilityConfig,
} = require('../../utils/unit_responsibilities');
const {
  loadUnitFrequencySampleSizeMap,
  validateSampleSizeValue,
  buildSampleSizeForFrequency,
  buildUnitSampleSizeConfigResponse,
} = require('../../utils/sample_size_resolver');
const { logAuditEvent } = require('../../utils/auditLog');
const { ALL_PROCESSES_KEYWORD } = require('../../utils/racm_cc_recipients');

const RACM_SPECIFIC_APPROVER_ASSIGNMENT_ACTION = 'RACM Specific approver assignment';

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
        NULLIF(TRIM(cum.unit_id), '') AS unit_id,
        NULLIF(TRIM(cum.unit_name), '') AS unit_name
      FROM company_unit_master cum
      INNER JOIN coordinator_unit_assignments cua
        ON cua.company_identifier = cum.company_identifier
       AND cua.unit_id = cum.unit_id
      WHERE cum.company_identifier = $1
        AND LOWER(TRIM(cua.coordinator_email_id)) = $2
        AND NULLIF(TRIM(cum.unit_id), '') IS NOT NULL
      ORDER BY unit_name ASC, unit_id ASC
    `,
    [companyIdentifier, coordinatorEmail]
  );

  return result.rows;
}

async function assertCoordinatorHasUnitAssignment(clientOrTx, companyIdentifier, coordinatorEmail, unitId) {
  if (!companyIdentifier || !coordinatorEmail || !unitId) {
    return false;
  }

  const result = await clientOrTx.$queryRawUnsafe
    ? clientOrTx.$queryRawUnsafe(
      `
        SELECT 1
        FROM coordinator_unit_assignments cua
        INNER JOIN company_unit_master cum
          ON cum.company_identifier = cua.company_identifier
         AND cum.unit_id = cua.unit_id
        WHERE cua.company_identifier = $1
          AND LOWER(TRIM(cua.coordinator_email_id)) = $2
          AND LOWER(TRIM(cua.unit_id)) = LOWER(TRIM($3))
        LIMIT 1
      `,
      companyIdentifier,
      coordinatorEmail,
      unitId
    )
    : clientOrTx.query(
      `
        SELECT 1
        FROM coordinator_unit_assignments cua
        INNER JOIN company_unit_master cum
          ON cum.company_identifier = cua.company_identifier
         AND cum.unit_id = cua.unit_id
        WHERE cua.company_identifier = $1
          AND LOWER(TRIM(cua.coordinator_email_id)) = $2
          AND LOWER(TRIM(cua.unit_id)) = LOWER(TRIM($3))
        LIMIT 1
      `,
      [companyIdentifier, coordinatorEmail, unitId]
    );

  const rows = Array.isArray(result?.rows) ? result.rows : result;
  return Array.isArray(rows) && rows.length > 0;
}

async function assertCoordinatorHasMappedUnit(companyIdentifier, coordinatorEmail, unitId) {
  if (!companyIdentifier || !coordinatorEmail || !unitId) {
    return false;
  }

  const mappedUnits = await getCoordinatorMappedUnits(companyIdentifier, coordinatorEmail);
  return mappedUnits.some((row) => String(row?.unit_id || '').trim().toLowerCase() === String(unitId).trim().toLowerCase());
}

function normalizeSelectedUnitIds(unitIdsInput, unitIdInput) {
  const unitIds = Array.isArray(unitIdsInput) ? unitIdsInput : [];
  const normalizedUnitIds = [...new Set(
    [
      ...unitIds,
      ...(unitIdInput != null ? [unitIdInput] : []),
    ]
      .map((value) => String(value || '').trim())
      .filter(Boolean)
  )];

  return normalizedUnitIds;
}

async function getUserMembershipUnitIds(tx, companyIdentifier, emailId) {
  if (!companyIdentifier || !emailId) {
    return [];
  }

  const memberships = await tx.userUnitMembership.findMany({
    where: {
      companyIdentifier,
      userEmailId: {
        equals: emailId,
        mode: 'insensitive',
      },
    },
    select: {
      unitId: true,
    },
  });

  return memberships
    .map((row) => String(row.unitId || '').trim())
    .filter(Boolean);
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

function isEntityLevelControlsBusinessProcess(value) {
  return String(value || '').trim().toLowerCase() === 'entity level controls';
}

function countEntityLevelControls(rows) {
  return (rows || []).filter((row) => isEntityLevelControlsBusinessProcess(row?.business_process)).length;
}

function excludeEntityLevelControls(rows) {
  return (rows || []).filter((row) => !isEntityLevelControlsBusinessProcess(row?.business_process));
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

function shapeControlForRiskAnalysis(row) {
  return {
    controlNumber: String(row?.control_number || '').trim(),
    businessProcess: String(row?.business_process || '').trim(),
    subProcess: String(row?.sub_process || '').trim(),
    riskDescription: String(row?.risk_description || '').trim(),
    controlObjective: String(row?.control_objective || '').trim(),
    standardControlDescription: String(row?.standard_control_description || '').trim(),
  };
}

async function getRiskAnalysisControlRow(companyIdentifier, controlNumber, coordinatorEmail) {
  const normalizedCompanyIdentifier = String(companyIdentifier || '').trim();
  const normalizedControlNumber = String(controlNumber || '').trim();
  const normalizedCoordinatorEmail = normalizeEmail(coordinatorEmail);
  if (!normalizedCompanyIdentifier || !normalizedControlNumber) {
    return null;
  }

  const result = await pool.query(
    `
      SELECT
        cf.form_id,
        cf.company_identifier,
        cf.business_process,
        cf.sub_process,
        cf.risk_description,
        cf.control_objective,
        cf.standard_control_description,
        cf.control_number
      FROM control_forms cf
      WHERE cf.company_identifier = $1
        AND cf.control_number = $2
        AND EXISTS (
          SELECT 1
          FROM company_unit_responsibilities cur
          WHERE cur.company_identifier = cf.company_identifier
            AND cur.unit_id = cf.unit_id
            AND cur.responsibility_type = '${UNIT_RESPONSIBILITY_TYPES.COORDINATOR}'
            AND LOWER(TRIM(cur.user_email_id)) = $3
        )
      LIMIT 1
    `,
    [normalizedCompanyIdentifier, normalizedControlNumber, normalizedCoordinatorEmail]
  );

  return result.rows[0] || null;
}

async function getStoredRiskAnalysis(companyIdentifier, formId) {
  const normalizedCompanyIdentifier = String(companyIdentifier || '').trim();
  const normalizedFormId = String(formId || '').trim();
  if (!normalizedCompanyIdentifier || !normalizedFormId) {
    return null;
  }

  const result = await pool.query(
    `
      SELECT
        id,
        company_identifier,
        form_id,
        business_process,
        sub_process,
        model_name,
        matched_sub_process,
        match_confidence,
        coverage_status,
        response_json,
        created_at,
        updated_at
      FROM risk_analysis
      WHERE company_identifier = $1
        AND form_id = $2
      LIMIT 1
    `,
    [normalizedCompanyIdentifier, normalizedFormId]
  );

  return result.rows[0] || null;
}

function serializeRiskAnalysisRow(row) {
  if (!row) return null;

  return {
    id: String(row.id),
    company_identifier: row.company_identifier,
    form_id: row.form_id,
    business_process: row.business_process,
    sub_process: row.sub_process,
    model_name: row.model_name,
    matched_sub_process: row.matched_sub_process,
    match_confidence: row.match_confidence,
    coverage_status: row.coverage_status,
    response_json: row.response_json,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

async function getRiskAnalysisAvailability(req, res) {
  try {
    const reachable = await isOllamaReachable();

    return res.status(200).json({
      success: true,
      data: {
        reachable,
        availableBusinessProcesses: listRiskAnalysisBusinessProcesses(),
      },
    });
  } catch (error) {
    console.error('Company coordinator risk analysis availability error:', error);
    return res.status(200).json({
      success: true,
      data: {
        reachable: false,
        availableBusinessProcesses: listRiskAnalysisBusinessProcesses(),
      },
    });
  }
}

async function getRiskAnalysisByControl(req, res) {
  try {
    const companyIdentifier = String(req.user?.company_identifier || '').trim();
    const controlNumber = String(req.params?.control_number || '').trim();

    if (!companyIdentifier) {
      return res.status(400).json({
        success: false,
        message: 'Company identifier is required',
      });
    }

    if (!controlNumber) {
      return res.status(400).json({
        success: false,
        message: 'Control number is required',
      });
    }

    const controlRow = await getRiskAnalysisControlRow(companyIdentifier, controlNumber, req.user?.email_id);

    if (!controlRow) {
      return res.status(404).json({
        success: false,
        message: 'Control not found for this company',
      });
    }

    const storedAnalysis = await getStoredRiskAnalysis(companyIdentifier, controlRow.form_id);

    return res.status(200).json({
      success: true,
      data: {
        control: {
          form_id: controlRow.form_id,
          company_identifier: controlRow.company_identifier,
          business_process: controlRow.business_process,
          sub_process: controlRow.sub_process,
          risk_description: controlRow.risk_description,
          control_objective: controlRow.control_objective,
          standard_control_description: controlRow.standard_control_description,
          control_number: controlRow.control_number,
        },
        analysis: serializeRiskAnalysisRow(storedAnalysis),
      },
    });
  } catch (error) {
    console.error('Company coordinator get risk analysis error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch risk analysis',
    });
  }
}

async function generateRiskAnalysisByControl(req, res) {
  const lockClient = await pool.connect();

  try {
    const locked = await tryAcquireGlobalAiModelLock(lockClient);
    if (!locked) {
      return res.status(409).json({
        success: false,
        message: 'Model is busy, try after some moments',
      });
    }

    const companyIdentifier = String(req.user?.company_identifier || '').trim();
    const controlNumber = String(req.params?.control_number || '').trim();

    if (!companyIdentifier) {
      return res.status(400).json({
        success: false,
        message: 'Company identifier is required',
      });
    }

    if (!controlNumber) {
      return res.status(400).json({
        success: false,
        message: 'Control number is required',
      });
    }

    const controlRow = await getRiskAnalysisControlRow(companyIdentifier, controlNumber, req.user?.email_id);
    if (!controlRow) {
      return res.status(404).json({
        success: false,
        message: 'Control not found for this company',
      });
    }

    const businessProcess = String(controlRow.business_process || '').trim();
    if (!businessProcess) {
      return res.status(400).json({
        success: false,
        message: 'Business process is required for risk analysis',
      });
    }

    const { master } = loadRiskAnalysisMasterByBusinessProcess(businessProcess);
    const candidateSubProcesses = (Array.isArray(master?.sub_processes) ? master.sub_processes : [])
      .map((entry) => ({
        subProcess: String(entry?.sub_process || '').trim(),
        risks: Array.isArray(entry?.risks) ? entry.risks.map((risk) => String(risk || '').trim()).filter(Boolean) : [],
      }))
      .filter((entry) => entry.subProcess && entry.risks.length > 0);

    if (candidateSubProcesses.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No candidate sub-processes found in the risk analysis master file',
      });
    }

    const llmResult = await requestRiskAnalysis({
      companyIdentifier,
      businessProcess,
      control: shapeControlForRiskAnalysis({
        control_number: controlRow.control_number,
        business_process: controlRow.business_process,
        sub_process: controlRow.sub_process,
        risk_description: controlRow.risk_description,
        control_objective: controlRow.control_objective,
        standard_control_description: controlRow.standard_control_description,
      }),
      candidateSubProcesses,
    });

    const upsertResult = await pool.query(
      `
        INSERT INTO risk_analysis (
          company_identifier,
          form_id,
          business_process,
          sub_process,
          model_name,
          matched_sub_process,
          match_confidence,
          coverage_status,
          response_json
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)
        ON CONFLICT (company_identifier, form_id)
        DO UPDATE SET
          business_process = EXCLUDED.business_process,
          sub_process = EXCLUDED.sub_process,
          model_name = EXCLUDED.model_name,
          matched_sub_process = EXCLUDED.matched_sub_process,
          match_confidence = EXCLUDED.match_confidence,
          coverage_status = EXCLUDED.coverage_status,
          response_json = EXCLUDED.response_json,
          updated_at = (CURRENT_TIMESTAMP AT TIME ZONE 'UTC'::text)
        RETURNING
          id,
          company_identifier,
          form_id,
          business_process,
          sub_process,
          model_name,
          matched_sub_process,
          match_confidence,
          coverage_status,
          response_json,
          created_at,
          updated_at
      `,
      [
        companyIdentifier,
        controlRow.form_id ? String(controlRow.form_id).trim() : null,
        businessProcess,
        String(controlRow.sub_process || '').trim() || null,
        OLLAMA_MODEL,
        llmResult.matchedSubProcess,
        llmResult.matchConfidence,
        llmResult.coverageStatus,
        JSON.stringify(llmResult),
      ]
    );

    return res.status(200).json({
      success: true,
      message: 'Risk analysis generated successfully',
      data: {
        analysis: serializeRiskAnalysisRow(upsertResult.rows[0] || null),
      },
    });
  } catch (error) {
    console.error('Company coordinator generate risk analysis error:', error);
    const errorCode = String(error?.code || 'INTERNAL_SERVER_ERROR').trim() || 'INTERNAL_SERVER_ERROR';
    return res.status(Number(error?.statusCode || 500)).json({
      success: false,
      message: error?.message || 'Failed to generate risk analysis',
      code: errorCode,
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

function getUnitMappingRoleConfig(role) {
  return getUnitResponsibilityConfig(role);
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
    tempPassword,
  };
}

async function getUsers(req, res) {
  try {
    const companyIdentifier = req.user.company_identifier;
    const coordinatorEmail = normalizeEmail(req.user?.email_id);

    if (!companyIdentifier) {
      return res.status(200).json({
        success: true,
        users: [],
      });
    }

    const coordinatorUnits = await getCoordinatorMappedUnits(companyIdentifier, coordinatorEmail);
    const mappedUnitIds = coordinatorUnits
      .map((row) => (row.unitId == null ? '' : String(row.unitId).trim()))
      .concat(
        coordinatorUnits.map((row) => (row.unit_id == null ? '' : String(row.unit_id).trim()))
      )
      .filter(Boolean);

    if (mappedUnitIds.length === 0) {
      return res.status(200).json({
        success: true,
        users: [],
      });
    }

    const roleParam = req.query.role != null ? String(req.query.role).trim() : '';
    const qRaw = req.query.q != null ? String(req.query.q).trim() : '';
    const unitIdRaw = req.query.unit_id != null ? String(req.query.unit_id).trim() : '';
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
          STRING_AGG(mapped_units.unit_id, ', ' ORDER BY mapped_units.unit_name, mapped_units.unit_id) AS unit_ids,
          STRING_AGG(mapped_units.unit_name, ', ' ORDER BY mapped_units.unit_name, mapped_units.unit_id) AS unit_names
        FROM (
          SELECT DISTINCT
            NULLIF(TRIM(cum.unit_id), '') AS unit_id,
            NULLIF(TRIM(cum.unit_name), '') AS unit_name
          FROM company_unit_master cum
          INNER JOIN coordinator_unit_assignments cua
            ON cua.company_identifier = cum.company_identifier
           AND cua.unit_id = cum.unit_id
          WHERE cum.company_identifier = u.company_identifier
            AND LOWER(TRIM(cua.coordinator_email_id)) = LOWER(TRIM(u.email_id))
            AND NULLIF(TRIM(cum.unit_id), '') IS NOT NULL
        ) mapped_units
      ) coordinator_units ON u.role = 'company_co'
      LEFT JOIN LATERAL (
        SELECT
          STRING_AGG(mapped_units.unit_id, ', ' ORDER BY mapped_units.unit_name, mapped_units.unit_id) AS unit_ids,
          STRING_AGG(mapped_units.unit_name, ', ' ORDER BY mapped_units.unit_name, mapped_units.unit_id) AS unit_names
        FROM (
          SELECT DISTINCT
            NULLIF(TRIM(COALESCE(aa.unit_id, cf.unit_id)), '') AS unit_id,
            NULLIF(TRIM(COALESCE(unit_direct.unit_name, unit_cf.unit_name)), '') AS unit_name
          FROM approver_assignments aa
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
          WHERE aa.company_identifier = u.company_identifier
            AND LOWER(TRIM(aa.approver_email_id)) = LOWER(TRIM(u.email_id))
            AND NULLIF(TRIM(COALESCE(aa.unit_id, cf.unit_id)), '') IS NOT NULL
        ) mapped_units
      ) approver_units ON u.role = 'approver'
      LEFT JOIN LATERAL (
        SELECT
          STRING_AGG(mapped_units.unit_id, ', ' ORDER BY mapped_units.unit_name, mapped_units.unit_id) AS unit_ids,
          STRING_AGG(mapped_units.unit_name, ', ' ORDER BY mapped_units.unit_name, mapped_units.unit_id) AS unit_names
        FROM (
          SELECT DISTINCT
            NULLIF(TRIM(cum.unit_id), '') AS unit_id,
            NULLIF(TRIM(cum.unit_name), '') AS unit_name
          FROM company_unit_master cum
          INNER JOIN user_unit_memberships uum
            ON uum.company_identifier = cum.company_identifier
           AND uum.unit_id = cum.unit_id
          WHERE cum.company_identifier = u.company_identifier
            AND LOWER(TRIM(uum.user_email_id)) = LOWER(TRIM(u.email_id))
            AND NULLIF(TRIM(cum.unit_id), '') IS NOT NULL
        ) mapped_units
      ) user_units ON u.role = 'user'
      WHERE u.company_identifier = $1
    `;
    const params = [companyIdentifier];
    let paramIndex = 2;

    query += `
      AND (
        (
          u.role = 'user'
          AND EXISTS (
            SELECT 1
            FROM user_unit_memberships uum
            WHERE uum.company_identifier = u.company_identifier
              AND uum.unit_id = ANY($${paramIndex}::text[])
              AND LOWER(TRIM(uum.user_email_id)) = LOWER(TRIM(u.email_id))
          )
        )
        OR (
          u.role = 'company_co'
          AND EXISTS (
            SELECT 1
            FROM coordinator_unit_assignments cua
            WHERE cua.company_identifier = u.company_identifier
              AND cua.unit_id = ANY($${paramIndex}::text[])
              AND LOWER(TRIM(cua.coordinator_email_id)) = LOWER(TRIM(u.email_id))
          )
        )
        OR (
          u.role = 'approver'
        )
      )
    `;
    params.push(mappedUnitIds);
    paramIndex++;

    if (roleParam) {
      query += ` AND u.role = $${paramIndex}`;
      params.push(roleParam);
      paramIndex++;
    }

    if (unitIdRaw) {
      query += `
        AND (
          (
            u.role = 'user'
            AND EXISTS (
              SELECT 1
              FROM user_unit_memberships uum
              WHERE uum.company_identifier = u.company_identifier
                AND LOWER(TRIM(uum.user_email_id)) = LOWER(TRIM(u.email_id))
                AND LOWER(TRIM(uum.unit_id)) = LOWER(TRIM($${paramIndex}))
            )
          )
          OR (
            u.role = 'company_co'
            AND EXISTS (
              SELECT 1
              FROM coordinator_unit_assignments cua
              WHERE cua.company_identifier = u.company_identifier
                AND LOWER(TRIM(cua.coordinator_email_id)) = LOWER(TRIM(u.email_id))
                AND LOWER(TRIM(cua.unit_id)) = LOWER(TRIM($${paramIndex}))
            )
          )
          OR (
            u.role = 'approver'
          )
        )
      `;
      params.push(unitIdRaw);
      paramIndex++;
    }

    if (qRaw) {
      query += ` AND (
        LOWER(COALESCE(u.emp_name, '')) LIKE $${paramIndex}
        OR LOWER(TRIM(u.email_id)) LIKE $${paramIndex}
        OR LOWER(COALESCE(user_units.unit_names, '')) LIKE $${paramIndex}
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

    console.log(
      `[company-co/users] company=${companyIdentifier} role=${roleParam || 'all'} unit_id=${unitIdRaw || 'all'} q=${qRaw || ''} fetched=${usersResult.rows.length} user(s)`
    );

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

async function getAssignedUnits(req, res) {
  try {
    const companyIdentifier = String(req.user?.company_identifier || '').trim() || null;
    const coordinatorEmail = normalizeEmail(req.user?.email_id);

    if (!companyIdentifier || !coordinatorEmail) {
      return res.status(200).json({
        success: true,
        units: [],
      });
    }

    const units = await getCoordinatorMappedUnits(companyIdentifier, coordinatorEmail);

    return res.status(200).json({
      success: true,
      units,
    });
  } catch (error) {
    console.error('Error fetching coordinator assigned units:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch assigned units',
    });
  }
}

async function getApproverAssignments(req, res) {
  try {
    const companyIdentifier = String(req.user?.company_identifier || '').trim() || null;
    const approverEmail = normalizeEmail(req.params?.email_id);

    if (!companyIdentifier || !approverEmail) {
      return res.status(400).json({
        success: false,
        message: 'Approver email is required',
      });
    }

    const approverResult = await pool.query(
      `
        SELECT
          email_id,
          role,
          emp_name
        FROM ifc_users
        WHERE company_identifier = $1
          AND LOWER(TRIM(email_id)) = $2
        LIMIT 1
      `,
      [companyIdentifier, approverEmail]
    );

    const approver = approverResult.rows[0];
    if (!approver || approver.role !== 'approver') {
      return res.status(404).json({
        success: false,
        message: 'Approver not found for this company',
      });
    }

    const assignmentsResult = await pool.query(
      `
        SELECT
          aa.id,
          aa.assignment_scope,
          COALESCE(aa.unit_id, cf.unit_id) AS unit_id,
          COALESCE(unit_direct.unit_name, unit_cf.unit_name) AS unit_name,
          COALESCE(aa.business_process, cf.business_process) AS business_process,
          aa.form_id,
          cf.control_number,
          cf.standard_control_description,
          aa.created_at
        FROM approver_assignments aa
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
          AND LOWER(TRIM(aa.approver_email_id)) = $2
        ORDER BY
          CASE aa.assignment_scope
            WHEN 'RACM' THEN 1
            WHEN 'BUSINESS_PROCESS' THEN 2
            WHEN 'UNIT' THEN 3
            ELSE 4
          END,
          aa.created_at DESC
      `,
      [companyIdentifier, approverEmail]
    );

    return res.status(200).json({
      success: true,
      data: {
        approver: {
          email_id: approver.email_id,
          emp_name: approver.emp_name,
        },
        assignments: assignmentsResult.rows,
      },
    });
  } catch (error) {
    console.error('Error fetching approver assignments:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch approver assignments',
    });
  }
}

async function assignRacmApprover(req, res) {
  const client = await pool.connect();

  try {
    const companyIdentifier = String(req.user?.company_identifier || '').trim() || null;
    const coordinatorEmail = normalizeEmail(req.user?.email_id);
    const approverEmailId = normalizeEmail(req.body?.approver_email_id || req.body?.email_id);
    const formIds = [...new Set(
      (Array.isArray(req.body?.form_ids) ? req.body.form_ids : [req.body?.form_id])
        .map((value) => String(value || '').trim())
        .filter(Boolean)
    )];
    const confirmReplaceExisting = Boolean(req.body?.confirm_replace_existing);
    const lockedApprovalStatuses = new Set(['sent for approval']);

    if (!companyIdentifier || !coordinatorEmail) {
      return res.status(403).json({
        success: false,
        message: 'Company coordinator context is required',
      });
    }

    if (!approverEmailId || !isValidEmail(approverEmailId)) {
      return res.status(400).json({
        success: false,
        message: 'Valid approver email ID is required',
      });
    }

    if (formIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one RACM is required',
      });
    }

    const mappedUnits = await getCoordinatorMappedUnits(companyIdentifier, coordinatorEmail);
    const mappedUnitIds = mappedUnits
      .map((row) => String(row?.unit_id || '').trim())
      .filter(Boolean);

    if (mappedUnitIds.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'No linked units available for this coordinator',
      });
    }

    await client.query('BEGIN');

    const approverResult = await client.query(
      `
        SELECT email_id, emp_name
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
      return res.status(400).json({
        success: false,
        message: 'Approver email ID is not available for this company',
      });
    }

    const formsResult = await client.query(
      `
        SELECT
          cf.form_id,
          cf.unit_id,
          cf.control_number,
          cf.standard_control_description,
          cf.status
        FROM control_forms cf
        WHERE cf.company_identifier = $1
          AND cf.form_id = ANY($2::text[])
          AND cf.unit_id = ANY($3::text[])
      `,
      [companyIdentifier, formIds, mappedUnitIds]
    );

    const accessibleForms = formsResult.rows;
    if (accessibleForms.length !== formIds.length) {
      const accessibleIds = new Set(accessibleForms.map((row) => String(row.form_id || '').trim()));
      const inaccessibleFormIds = formIds.filter((formId) => !accessibleIds.has(formId));
      await client.query('ROLLBACK');
      return res.status(403).json({
        success: false,
        message: 'One or more RACMs are not accessible for approver assignment',
        inaccessibleFormIds,
      });
    }

    const approvalLockedForms = accessibleForms.filter((row) =>
      lockedApprovalStatuses.has(String(row?.status || '').trim().toLowerCase())
    );
    if (approvalLockedForms.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({
        success: false,
        code: 'RACM_APPROVER_ASSIGNMENT_LOCKED',
        message: 'Approver assignment cannot be changed for RACMs that are sent for approval',
        lockedForms: approvalLockedForms.map((row) => ({
          form_id: row.form_id,
          control_number: row.control_number,
          standard_control_description: row.standard_control_description,
          status: row.status,
        })),
      });
    }

    const existingAssignmentsResult = await client.query(
      `
        SELECT
          aa.id,
          aa.form_id,
          aa.approver_email_id,
          approver.emp_name AS approver_name,
          cf.control_number,
          cf.standard_control_description
        FROM approver_assignments aa
        INNER JOIN control_forms cf
          ON cf.company_identifier = aa.company_identifier
         AND cf.form_id = aa.form_id
        LEFT JOIN ifc_users approver
          ON approver.company_identifier = aa.company_identifier
         AND LOWER(TRIM(approver.email_id)) = LOWER(TRIM(aa.approver_email_id))
        WHERE aa.company_identifier = $1
          AND aa.assignment_scope = 'RACM'
          AND aa.form_id = ANY($2::text[])
        ORDER BY cf.control_number ASC NULLS LAST, aa.created_at DESC
      `,
      [companyIdentifier, formIds]
    );

    if (existingAssignmentsResult.rows.length > 0 && !confirmReplaceExisting) {
      await client.query('ROLLBACK');
      return res.status(409).json({
        success: false,
        code: 'CONFIRM_REPLACE_RACM_APPROVER',
        message: 'One or more selected RACMs already have RACM-level approver assignments',
        requiresConfirmation: true,
        existingAssignments: existingAssignmentsResult.rows,
      });
    }

    await client.query(
      `
        DELETE FROM approver_assignments
        WHERE company_identifier = $1
          AND assignment_scope = 'RACM'
          AND form_id = ANY($2::text[])
      `,
      [companyIdentifier, formIds]
    );

    const insertResult = await client.query(
      `
        INSERT INTO approver_assignments (
          company_identifier,
          approver_email_id,
          assignment_scope,
          unit_id,
          business_process,
          form_id
        )
        SELECT
          $1,
          $2,
          'RACM',
          NULL,
          NULL,
          form_id
        FROM UNNEST($3::text[]) AS form_id
        RETURNING id, approver_email_id, assignment_scope, form_id, created_at
      `,
      [companyIdentifier, approverEmailId, formIds]
    );

    await client.query('COMMIT');

    const coordinatorAuditEmail = String(req.user?.email_id || coordinatorEmail || '').trim();
    await Promise.all(
      formIds.map((formId) =>
        logAuditEvent(
          RACM_SPECIFIC_APPROVER_ASSIGNMENT_ACTION,
          coordinatorAuditEmail,
          formId,
          approverEmailId
        )
      )
    );

    return res.status(200).json({
      success: true,
      message: 'Approver assignment saved successfully',
      data: {
        assignmentCount: insertResult.rowCount,
        replacedCount: existingAssignmentsResult.rows.length,
        approver: approverResult.rows[0],
        assignments: insertResult.rows,
      },
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Assign RACM approver error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to save approver assignment',
    });
  } finally {
    client.release();
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
          NULLIF(TRIM(cum.unit_id), '') AS unit_id,
          NULLIF(TRIM(cum.unit_name), '') AS unit_name
        FROM company_unit_master cum
        INNER JOIN coordinator_unit_assignments cua
          ON cua.company_identifier = cum.company_identifier
         AND cua.unit_id = cum.unit_id
        WHERE cum.company_identifier = $1
          AND LOWER(TRIM(cua.coordinator_email_id)) = $2
          AND NULLIF(TRIM(cum.unit_id), '') IS NOT NULL
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
          SELECT COUNT(DISTINCT u.id)::int AS total_users
          FROM ifc_users u
          INNER JOIN user_unit_memberships uum
            ON uum.company_identifier = u.company_identifier
           AND LOWER(TRIM(uum.user_email_id)) = LOWER(TRIM(u.email_id))
          WHERE u.company_identifier = $1
            AND u.role = 'user'
            AND NULLIF(TRIM(uum.unit_id), '') = ANY($2::text[])
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
    const manualKeyControls = filterKeyManualControls(dashboardRows);
    const excludedEntityLevelCount = countEntityLevelControls(manualKeyControls);
    const filteredControls = excludeEntityLevelControls(manualKeyControls);

    if (filteredControls.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No eligible Key + Manual Controls found after excluding Entity Level Controls',
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
        excluded_entity_level_count: excludedEntityLevelCount,
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
    const errorCode = String(error?.code || 'INTERNAL_SERVER_ERROR').trim() || 'INTERNAL_SERVER_ERROR';

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
      code: errorCode,
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
    const scope = await getCoordinatorDashboardScope(req);
    if (!scope.companyIdentifier) {
      return res.status(400).json({
        success: false,
        message: 'Company identifier is required',
      });
    }

    const dashboardRows = await getCoordinatorDashboardRacmRows(scope);
    const manualKeyControls = filterKeyManualControls(dashboardRows);
    const excludedEntityLevelCount = countEntityLevelControls(manualKeyControls);

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
        companyIdentifier: scope.companyIdentifier,
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
          excluded_entity_level_count: excludedEntityLevelCount,
        },
      });
    }

    const selectedRunId = parsedRunId ?? runs[0].id;
    const run = await prisma.keyManualAiInsightsRunTable.findFirst({
      where: {
        id: selectedRunId,
        companyIdentifier: scope.companyIdentifier,
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
        excluded_entity_level_count: excludedEntityLevelCount,
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

    const [
      currentUnitsRows,
      approversRows,
      coordinatorsRows,
      assignmentCoordinatorsRows,
      assignmentApproversRows,
      unitsRows,
    ] = await Promise.all([
      pool.query(
        `
          SELECT cum.id, cum.unit_id, cum.unit_name, cum.unit_address
          FROM company_unit_master cum
          INNER JOIN coordinator_unit_assignments cua
            ON cua.company_identifier = cum.company_identifier
           AND cua.unit_id = cum.unit_id
          WHERE cum.company_identifier = $1
            AND LOWER(TRIM(cua.coordinator_email_id)) = $2
          ORDER BY cum.unit_name ASC, cum.id ASC
        `,
        [companyIdentifier, coordinatorEmail]
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
          SELECT
            aa.id,
            aa.approver_email_id AS email_id,
            COALESCE(NULLIF(TRIM(u.emp_name), ''), aa.approver_email_id) AS display_name,
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
          ORDER BY aa.created_at DESC
        `,
        [companyIdentifier]
      ),
      pool.query(
        `
          SELECT
            cum.id,
            cum.unit_id,
            cum.unit_name,
            cua.coordinator_email_id,
            COALESCE(NULLIF(TRIM(coordinator.emp_name), ''), cua.coordinator_email_id) AS coordinator_display_name,
            aa.approver_email_id,
            COALESCE(NULLIF(TRIM(approver.emp_name), ''), aa.approver_email_id) AS approver_display_name
          FROM company_unit_master cum
          LEFT JOIN coordinator_unit_assignments cua
            ON cua.company_identifier = cum.company_identifier
           AND cua.unit_id = cum.unit_id
          LEFT JOIN approver_assignments aa
            ON aa.company_identifier = cum.company_identifier
           AND aa.unit_id = cum.unit_id
           AND aa.assignment_scope = 'UNIT'
          LEFT JOIN ifc_users coordinator
            ON LOWER(TRIM(coordinator.email_id)) = LOWER(TRIM(COALESCE(cua.coordinator_email_id, '')))
           AND coordinator.company_identifier = cum.company_identifier
          LEFT JOIN ifc_users approver
            ON LOWER(TRIM(approver.email_id)) = LOWER(TRIM(COALESCE(aa.approver_email_id, '')))
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
        currentCoordinatorUnits: currentUnitsRows.rows,
        approvers: approversRows.rows,
        coordinators: coordinatorsRows.rows,
        unmappedRoleUsers: [],
        unmappedCoordinatorUnits: [],
        unmappedApproverUnits: [],
        assignmentCoordinators: assignmentCoordinatorsRows.rows,
        assignmentApprovers: assignmentApproversRows.rows,
        units: unitsRows.rows,
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
    const companyName = await getCompanyName(req.user.company_identifier);
    const coordinatorName = String(req.user.emp_name || '').trim() || 'Company Coordinator';

    await client.query('BEGIN');

    const { user, loginEmailQueued, tempPassword } = await createUnitMappedPrivilegedUser(
      client,
      req.user,
      req.body,
      'company_co'
    );

    await client.query('COMMIT');

    try {
      const emailSent = await sendUserCreationEmail(pool, {
        userId: user.id,
        emailId: user.email_id,
        role: user.role,
        coordinatorEmail: req.user.email_id,
        coordinatorName,
        companyName,
        tempPassword,
      });
      if (!emailSent) {
        console.warn(`Warning: failed to send coordinator creation email to ${user.email_id}`);
      }
    } catch (emailError) {
      console.error('Coordinator creation email error:', emailError);
    }

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
    const companyName = await getCompanyName(req.user.company_identifier);
    const coordinatorName = String(req.user.emp_name || '').trim() || 'Company Coordinator';

    await client.query('BEGIN');

    const { user, loginEmailQueued, tempPassword } = await createUnitMappedPrivilegedUser(
      client,
      req.user,
      req.body,
      'approver'
    );

    await client.query('COMMIT');

    try {
      const emailSent = await sendUserCreationEmail(pool, {
        userId: user.id,
        emailId: user.email_id,
        role: user.role,
        coordinatorEmail: req.user.email_id,
        coordinatorName,
        companyName,
        tempPassword,
      });
      if (!emailSent) {
        console.warn(`Warning: failed to send approver creation email to ${user.email_id}`);
      }
    } catch (emailError) {
      console.error('Approver creation email error:', emailError);
    }

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
            RETURNING id, unit_id, unit_name, unit_address
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

    const {
      ensureActiveTemplateForUnit,
      isRacmTemplateSchemaReady,
    } = require('../../utils/racm_templates');
    if (await isRacmTemplateSchemaReady(client)) {
      await ensureActiveTemplateForUnit(client, {
        companyIdentifier,
        unitId: insertedUnit.unit_id,
        createdBy: req.user.email_id,
      });
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
        SELECT cum.id, cum.unit_name
        FROM company_unit_master cum
        WHERE cum.company_identifier = $1
          AND cum.unit_id = $2
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

    const currentAssignmentResult = await client.query(
      `
        SELECT user_email_id AS assigned_email_id
        FROM company_unit_responsibilities
        WHERE company_identifier = $1
          AND unit_id = $2
          AND responsibility_type = $3
        FOR UPDATE
      `,
      [companyIdentifier, unitId, config.responsibilityType]
    );

    const currentAssignedEmail = normalizeEmail(currentAssignmentResult.rows[0]?.assigned_email_id);
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
        INSERT INTO company_unit_responsibilities (
          company_identifier,
          unit_id,
          user_email_id,
          responsibility_type
        )
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (company_identifier, unit_id, responsibility_type)
        DO UPDATE SET user_email_id = EXCLUDED.user_email_id
      `,
      [companyIdentifier, unitId, emailId, config.responsibilityType]
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
    unit_ids,
    confirm_existing_user_units,
  } = req.body;
  const coordinator = req.user;

  try {
    const emailId = normalizeEmail(email_id);
    const empCode = String(emp_code || '').trim() || null;
    const empName = String(emp_name || '').trim() || null;
    const userDesignation = String(designation || '').trim() || null;
    const userDepartment = String(department || '').trim() || null;
    const userMobile = normalizeMobileDigits(mobile) || null;
    const selectedUnitIds = normalizeSelectedUnitIds(unit_ids, unit_id);
    const companyIdentifier = coordinator.company_identifier || null;
    const coordinatorEmail = normalizeEmail(coordinator.email_id);
    const confirmExistingUserUnits = Boolean(confirm_existing_user_units);

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

    if (!userMobile) {
      return res.status(400).json({
        success: false,
        message: 'Mobile number is required',
      });
    }

    const mobileError = getMobileValidationError(userMobile);
    if (mobileError) {
      return res.status(400).json({
        success: false,
        message: mobileError,
      });
    }

    if (selectedUnitIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one unit is required',
      });
    }

    if (selectedUnitIds.length > 0 && !companyIdentifier) {
      return res.status(400).json({
        success: false,
        message: 'Company identifier is required',
      });
    }

    getPasswordPepper();
    const companyName = await getCompanyName(companyIdentifier);
    const coordinatorName = String(coordinator.emp_name || '').trim() || 'Company Coordinator';

    const { user: newUser, loginEmailQueued, tempPassword, empName: createdEmpName } = await prisma.$transaction(async (tx) => {
      const mappedUnits = await getCoordinatorMappedUnits(companyIdentifier, coordinatorEmail);
      const mappedUnitIds = new Set(
        mappedUnits
          .map((row) => String(row?.unit_id || '').trim())
          .filter(Boolean)
      );
      const unauthorizedUnitIds = selectedUnitIds.filter((selectedUnitId) => !mappedUnitIds.has(selectedUnitId));
      if (unauthorizedUnitIds.length > 0) {
        const error = new Error(
          unauthorizedUnitIds.length === 1
            ? 'Selected unit is not mapped with this company coordinator'
            : 'One or more selected units are not mapped with this company coordinator'
        );
        error.statusCode = 403;
        error.unauthorizedUnits = unauthorizedUnitIds;
        throw error;
      }

      const existingUser = await tx.ifcUser.findFirst({
        where: {
          emailId: {
            equals: emailId,
            mode: 'insensitive',
          },
        },
        select: {
          id: true,
          emailId: true,
          companyIdentifier: true,
          role: true,
          empName: true,
        },
      });

      if (existingUser) {
        if (existingUser.companyIdentifier !== companyIdentifier || existingUser.role !== 'user') {
          const error = new Error('User with this email already exists');
          error.statusCode = 409;
          throw error;
        }

        const existingMembershipUnitIds = await getUserMembershipUnitIds(tx, companyIdentifier, emailId);
        const existingMembershipUnitSet = new Set(existingMembershipUnitIds);
        const unitIdsToAdd = selectedUnitIds.filter((selectedUnitId) => !existingMembershipUnitSet.has(selectedUnitId));

        if (unitIdsToAdd.length === 0) {
          const error = new Error('User is already mapped to the selected unit(s)');
          error.statusCode = 409;
          error.code = 'USER_ALREADY_MAPPED_TO_UNITS';
          error.existingUnitIds = existingMembershipUnitIds;
          throw error;
        }

        if (!confirmExistingUserUnits) {
          const error = new Error(
            unitIdsToAdd.length === 1
              ? `User already exists in another unit. Are you sure you want to create user in ${unitIdsToAdd[0]} unit?`
              : 'User already exists in other units. Confirm to add the selected units for this user.'
          );
          error.statusCode = 409;
          error.code = 'CONFIRM_EXISTING_USER_UNITS';
          error.requiresConfirmation = true;
          error.user = {
            email_id: existingUser.emailId,
            existing_unit_ids: existingMembershipUnitIds,
            target_unit_ids: selectedUnitIds,
            units_to_add: unitIdsToAdd,
          };
          throw error;
        }

        await tx.userUnitMembership.createMany({
          data: unitIdsToAdd.map((selectedUnitId) => ({
            companyIdentifier,
            userEmailId: emailId,
            unitId: selectedUnitId,
          })),
          skipDuplicates: true,
        });

        return {
          user: {
            id: existingUser.id,
            email_id: existingUser.emailId,
            company_identifier: existingUser.companyIdentifier,
            role: 'user',
            unit_id: unitIdsToAdd[0] || selectedUnitIds[0] || null,
            unit_ids: [...new Set([...existingMembershipUnitIds, ...unitIdsToAdd])],
            membershipAdded: true,
          },
          loginEmailQueued: false,
          tempPassword: null,
          empName: existingUser.empName || empName,
        };
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
          loginEmailSent: false,
          tempPasswordEncrypted,
        },
        select: {
          id: true,
          emailId: true,
          companyIdentifier: true,
        },
      });

      await tx.userUnitMembership.createMany({
        data: selectedUnitIds.map((selectedUnitId) => ({
          companyIdentifier,
          userEmailId: emailId,
          unitId: selectedUnitId,
        })),
        skipDuplicates: true,
      });

      return {
        user: {
          id: createdUser.id,
          email_id: createdUser.emailId,
          company_identifier: createdUser.companyIdentifier,
          role: 'user',
          unit_id: selectedUnitIds[0] || null,
          unit_ids: selectedUnitIds,
          membershipAdded: false,
        },
        loginEmailQueued: true,
        tempPassword,
        empName,
      };
    });

    if (loginEmailQueued && tempPassword) {
      try {
        const emailSent = await sendUserCreationEmail(pool, {
          userId: newUser.id,
          emailId: newUser.email_id,
          role: newUser.role,
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
    }

    await new Promise((resolve) => setTimeout(resolve, 500));

    return res.status(loginEmailQueued ? 201 : 200).json({
      success: true,
      message: loginEmailQueued ? 'User created successfully' : 'User unit assignment updated successfully',
      user: {
        id: newUser.id,
        email_id: newUser.email_id,
        company_identifier: newUser.company_identifier,
        unit_id: newUser.unit_id,
        unit_ids: newUser.unit_ids || [],
      },
      loginEmailQueued,
    });
  } catch (error) {
    console.error('Error creating user:', error);

    if (error.statusCode) {
      return res.status(error.statusCode).json({
        success: false,
        message: error.message,
        code: error.code,
        requiresConfirmation: Boolean(error.requiresConfirmation),
        user: error.user,
        existingUnitIds: error.existingUnitIds,
        unauthorizedUnits: error.unauthorizedUnits,
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
  const usersInput = Array.isArray(req.body?.users) ? req.body.users : [];
  const selectedUnitIds = normalizeSelectedUnitIds(req.body?.unit_ids, req.body?.unit_id);

  if (usersInput.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'At least one user row is required for bulk user upload',
    });
  }

  if (selectedUnitIds.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'At least one unit is required for bulk user upload',
    });
  }

  if (!companyIdentifier) {
    return res.status(400).json({
      success: false,
      message: 'Company identifier is missing for coordinator',
    });
  }

  const uploadRows = [];
  const validationErrors = [];
  const seenUploadEmails = new Map();

  usersInput.forEach((row, index) => {
    const rowNumber = index + 2;
    const emailId = normalizeEmail(row?.email_id);
    const mobileDigits = normalizeMobileDigits(row?.mobile);
    let rowHasError = false;

    if (!emailId) {
      validationErrors.push({
        rowNumber,
        field: 'Email ID',
        reason: 'Email ID is missing',
      });
      rowHasError = true;
    } else if (!isValidEmail(emailId)) {
      validationErrors.push({
        rowNumber,
        field: 'Email ID',
        email_id: emailId,
        reason: 'Invalid email format',
      });
      rowHasError = true;
    } else {
      const duplicateRows = seenUploadEmails.get(emailId) || [];
      duplicateRows.push(rowNumber);
      seenUploadEmails.set(emailId, duplicateRows);
    }

    if (!mobileDigits) {
      validationErrors.push({
        rowNumber,
        field: 'Mobile',
        email_id: emailId || null,
        reason: 'Mobile number is required',
      });
      rowHasError = true;
    } else {
      const mobileError = getMobileValidationError(mobileDigits);
      if (mobileError) {
        validationErrors.push({
          rowNumber,
          field: 'Mobile',
          email_id: emailId || null,
          reason: mobileError,
        });
        rowHasError = true;
      }
    }

    if (rowHasError) {
      return;
    }

    uploadRows.push({
      rowNumber,
      payload: {
        email_id: emailId,
        emp_name: row?.emp_name || null,
        department: row?.department || null,
        designation: row?.designation || null,
        mobile: mobileDigits,
        unit_ids: selectedUnitIds,
      },
    });
  });

  seenUploadEmails.forEach((rowNumbers, emailId) => {
    if (rowNumbers.length > 1) {
      validationErrors.push({
        rowNumber: rowNumbers.join(', '),
        field: 'Email ID',
        email_id: emailId,
        reason: `Duplicate email in upload file (rows ${rowNumbers.join(', ')})`,
      });
    }
  });

  if (validationErrors.length > 0) {
    return res.status(400).json({
      success: false,
      code: 'BULK_UPLOAD_VALIDATION_FAILED',
      message: 'Bulk upload blocked: fix invalid rows before uploading',
      validationErrors,
    });
  }

  const rowsToCreate = uploadRows;

  if (rowsToCreate.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'No valid rows found for user creation',
    });
  }

  try {
    const createdUsers = [];
    const skippedEmails = [];
    const duplicateRows = [];
    const skippedRows = [];
    getPasswordPepper();
    const companyName = await getCompanyName(companyIdentifier);
    const coordinatorName = String(coordinator.emp_name || '').trim() || 'Company Coordinator';

    const coordinatorEmail = normalizeEmail(coordinator.email_id);
    if (selectedUnitIds.length > 0) {
      const mappedUnits = await getCoordinatorMappedUnits(companyIdentifier, coordinatorEmail);
      const mappedUnitSet = new Set(
        mappedUnits
          .map((row) => String(row?.unit_id || '').trim())
          .filter(Boolean)
      );
      const unauthorizedUnits = selectedUnitIds.filter((unitId) => !mappedUnitSet.has(unitId));

      if (unauthorizedUnits.length > 0) {
        const error = new Error('Selected unit is not mapped with this company coordinator');
        error.statusCode = 403;
        error.unauthorizedUnits = unauthorizedUnits;
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
      select: {
        id: true,
        emailId: true,
        companyIdentifier: true,
        role: true,
      },
    });
    const existingUsersByEmail = new Map(existingUsers.map((user) => [normalizeEmail(user.emailId), user]));
    const sameCompanyExistingUserEmails = existingUsers
      .filter((user) => user.companyIdentifier === companyIdentifier && user.role === 'user')
      .map((user) => normalizeEmail(user.emailId));

    const existingMembershipRows = sameCompanyExistingUserEmails.length > 0
      ? await prisma.userUnitMembership.findMany({
        where: {
          companyIdentifier,
          OR: sameCompanyExistingUserEmails.map((emailId) => ({
            userEmailId: {
              equals: emailId,
              mode: 'insensitive',
            },
          })),
        },
        select: {
          userEmailId: true,
          unitId: true,
        },
      })
      : [];

    const existingMembershipsByEmail = new Map();
    existingMembershipRows.forEach((row) => {
      const normalizedEmail = normalizeEmail(row.userEmailId);
      const current = existingMembershipsByEmail.get(normalizedEmail) || [];
      current.push(String(row.unitId || '').trim());
      existingMembershipsByEmail.set(normalizedEmail, current.filter(Boolean));
    });

    const usersAlreadyMapped = [];
    if (selectedUnitIds.length > 0) {
      for (const emailId of targetEmails) {
        const existingUser = existingUsersByEmail.get(emailId);
        if (!existingUser || existingUser.companyIdentifier !== companyIdentifier || existingUser.role !== 'user') {
          continue;
        }

        const existingUnitIds = existingMembershipsByEmail.get(emailId) || [];
        const existingUnitSet = new Set(existingUnitIds);
        const unitsToAdd = selectedUnitIds.filter((unitId) => !existingUnitSet.has(unitId));

        if (unitsToAdd.length === 0) {
          usersAlreadyMapped.push({
            email_id: emailId,
            existing_unit_ids: existingUnitIds,
          });
        }
      }
    }

    for (const item of rowsToCreate) {
      if (requestAborted) {
        const abortError = new Error('User insertion cancelled by client navigation');
        abortError.statusCode = 499;
        throw abortError;
      }

      const emailId = normalizeEmail(item.payload?.email_id);
      const mobileValue = item.payload?.mobile || null;

      const existingUser = existingUsersByEmail.get(emailId);
      const payloadUnitIds = normalizeSelectedUnitIds(item.payload?.unit_ids, item.payload?.unit_id);
      const existingMembershipUnitIds = existingMembershipsByEmail.get(emailId) || [];
      const existingMembershipUnitSet = new Set(existingMembershipUnitIds);

      if (existingUser) {
        if (existingUser.companyIdentifier !== companyIdentifier || existingUser.role !== 'user') {
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

        const unitIdsToAdd = payloadUnitIds.filter((unitId) => !existingMembershipUnitSet.has(unitId));
        if (unitIdsToAdd.length === 0) {
          const duplicateEmail = normalizeEmail(item.payload?.email_id);
          skippedEmails.push(duplicateEmail);
          if (item.rowNumber != null) {
            duplicateRows.push({
              rowNumber: item.rowNumber,
              email_id: duplicateEmail,
              reason: 'User already exists in selected unit(s)',
            });
          }
          continue;
        }

        await prisma.userUnitMembership.createMany({
          data: unitIdsToAdd.map((unitId) => ({
            companyIdentifier,
            userEmailId: emailId,
            unitId,
          })),
          skipDuplicates: true,
        });

        existingMembershipsByEmail.set(emailId, [...new Set([...existingMembershipUnitIds, ...unitIdsToAdd])]);
        createdUsers.push({
          id: existingUser.id,
          email_id: existingUser.emailId,
          company_identifier: existingUser.companyIdentifier,
          role: 'user',
          unit_id: unitIdsToAdd[0] || null,
          unit_ids: [...new Set([...existingMembershipUnitIds, ...unitIdsToAdd])],
          loginEmailQueued: false,
          tempPassword: null,
          emp_name: item.payload?.emp_name || null,
          membershipAdded: true,
        });
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
            loginEmailSent: false,
            tempPasswordEncrypted,
          },
          select: {
            id: true,
            emailId: true,
            companyIdentifier: true,
          },
        });

        if (payloadUnitIds.length > 0) {
          await prisma.userUnitMembership.createMany({
            data: payloadUnitIds.map((unitId) => ({
              companyIdentifier,
              userEmailId: emailId,
              unitId,
            })),
            skipDuplicates: true,
          });
        }

        existingUsersByEmail.set(emailId, {
          id: createdUser.id,
          emailId: createdUser.emailId,
          companyIdentifier: createdUser.companyIdentifier,
          role: 'user',
        });
        existingMembershipsByEmail.set(emailId, payloadUnitIds);
        createdUsers.push({
          id: createdUser.id,
          email_id: createdUser.emailId,
          company_identifier: createdUser.companyIdentifier,
          role: 'user',
          unit_id: payloadUnitIds[0] || null,
          unit_ids: payloadUnitIds,
          loginEmailQueued: true,
          tempPassword,
          emp_name: item.payload?.emp_name || null,
          membershipAdded: false,
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
          continue;
        }
        throw createError;
      }
    }

    for (const createdUser of createdUsers) {
      if (!createdUser.loginEmailQueued || !createdUser.tempPassword) {
        continue;
      }

      try {
        const emailSent = await sendUserCreationEmail(pool, {
          userId: createdUser.id,
          emailId: createdUser.email_id,
          role: createdUser.role,
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
      skippedRows: [
        ...duplicateRows,
        ...usersAlreadyMapped.map((user) => ({
          email_id: user.email_id,
          reason: 'User already exists in selected unit(s)',
        })),
      ],
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
        code: error.code,
        requiresConfirmation: Boolean(error.requiresConfirmation),
        users: error.users,
        unauthorizedUnits: error.unauthorizedUnits,
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
  const coordinatorDisplayName = String(coordinator?.emp_name || '').trim() || null;

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
    const coordinatorUnits = await getCoordinatorMappedUnits(companyIdentifier, normalizeEmail(coordinator.email_id));
    const mappedUnitIds = coordinatorUnits
      .map((row) => (row.unit_id == null ? '' : String(row.unit_id).trim()))
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
      },
    });

    const userMemberships = await prisma.userUnitMembership.findMany({
      where: {
        companyIdentifier,
        unitId: {
          in: mappedUnitIds,
        },
      },
      select: {
        userEmailId: true,
        unitId: true,
      },
    });

    const membershipsByEmail = userMemberships.reduce((acc, row) => {
      const emailId = normalizeEmail(row.userEmailId);
      if (!acc.has(emailId)) {
        acc.set(emailId, []);
      }
      acc.get(emailId).push(String(row.unitId || '').trim());
      return acc;
    }, new Map());

    const emailSet = new Set(normalizedEmails);
    const usersToDelete = candidateUsers
      .map((row) => ({
        id: row.id,
        email_id: normalizeEmail(row.emailId),
        unit_ids: membershipsByEmail.get(normalizeEmail(row.emailId)) || [],
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
      return row.unit_ids.length === 0 || row.unit_ids.some((unitId) => !mappedUnitSet.has(unitId));
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

      await tx.userUnitMembership.deleteMany({
        where: {
          companyIdentifier,
          userEmailId: {
            in: authorizedEmails,
          },
        },
      });

      const deletedUsers = await tx.ifcUser.deleteMany({
        where: {
          id: {
            in: authorizedUserIds,
          },
        },
      });

      return [deactivatedCount, deletedUsers.count];
    });

    for (const emailId of authorizedEmails) {
      try {
        const subject = 'IFC : Account Removed';
        const text = coordinatorDisplayName
          ? `Your account has been removed by Company Coordinator ${coordinatorDisplayName}.`
          : 'Your account has been removed by the Company Coordinator.';
        const emailSent = await sendEmail(emailId, subject, text);
        if (!emailSent) {
          console.warn(`Warning: failed to send user deletion email to ${emailId}`);
        }
      } catch (emailError) {
        console.error(`User deletion email error for ${emailId}:`, emailError);
      }
    }

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

async function linkUserUnits(req, res) {
  try {
    const coordinator = req.user;
    const companyIdentifier = coordinator.company_identifier || null;
    const coordinatorEmail = normalizeEmail(coordinator.email_id);
    const emailId = normalizeEmail(req.body?.email_id);
    const unitIdsToAdd = normalizeSelectedUnitIds(req.body?.unit_ids);

    if (!companyIdentifier) {
      return res.status(400).json({
        success: false,
        message: 'Company identifier is missing for coordinator',
      });
    }

    if (!emailId || !isValidEmail(emailId)) {
      return res.status(400).json({
        success: false,
        message: 'Valid user email ID is required',
      });
    }

    if (unitIdsToAdd.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Select at least one unit to link',
      });
    }

    const mappedUnits = await getCoordinatorMappedUnits(companyIdentifier, coordinatorEmail);
    const mappedUnitSet = new Set(
      mappedUnits.map((row) => String(row.unit_id || '').trim()).filter(Boolean)
    );

    if (mappedUnitSet.size === 0) {
      return res.status(403).json({
        success: false,
        message: 'You are not mapped to any unit',
      });
    }

    const unauthorizedUnits = unitIdsToAdd.filter((unitId) => !mappedUnitSet.has(unitId));
    if (unauthorizedUnits.length > 0) {
      return res.status(403).json({
        success: false,
        message: 'One or more selected units are not mapped to this coordinator',
        unauthorizedUnits,
      });
    }

    const user = await prisma.ifcUser.findFirst({
      where: {
        companyIdentifier,
        role: 'user',
        emailId: {
          equals: emailId,
          mode: 'insensitive',
        },
      },
      select: {
        id: true,
        emailId: true,
      },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found for this company',
      });
    }

    const existingMembershipRows = await prisma.userUnitMembership.findMany({
      where: {
        companyIdentifier,
        userEmailId: {
          equals: emailId,
          mode: 'insensitive',
        },
      },
      select: {
        unitId: true,
      },
    });

    const existingUnitIds = existingMembershipRows
      .map((row) => String(row.unitId || '').trim())
      .filter(Boolean);

    const hasCoordinatorScope = existingUnitIds.some((unitId) => mappedUnitSet.has(unitId));
    if (!hasCoordinatorScope) {
      return res.status(403).json({
        success: false,
        message: 'This user is outside your assigned unit scope',
      });
    }

    const newUnitIds = unitIdsToAdd.filter((unitId) => !existingUnitIds.includes(unitId));
    if (newUnitIds.length === 0) {
      const existingUnitDetails = await pool.query(
        `
          SELECT NULLIF(TRIM(unit_id), '') AS unit_id, NULLIF(TRIM(unit_name), '') AS unit_name
          FROM company_unit_master
          WHERE company_identifier = $1
            AND unit_id = ANY($2::text[])
          ORDER BY unit_name ASC, unit_id ASC
        `,
        [companyIdentifier, existingUnitIds]
      );

      return res.status(200).json({
        success: true,
        message: 'Selected unit(s) are already linked to this user',
        data: {
          email_id: user.emailId,
          unit_ids: existingUnitDetails.rows.map((row) => row.unit_id).filter(Boolean),
          unit_names: existingUnitDetails.rows.map((row) => row.unit_name || row.unit_id).filter(Boolean),
          added_unit_ids: [],
        },
      });
    }

    await prisma.userUnitMembership.createMany({
      data: newUnitIds.map((unitId) => ({
        companyIdentifier,
        userEmailId: emailId,
        unitId,
      })),
      skipDuplicates: true,
    });

    const allUnitIds = [...new Set([...existingUnitIds, ...newUnitIds])];
    const unitDetails = await pool.query(
      `
        SELECT NULLIF(TRIM(unit_id), '') AS unit_id, NULLIF(TRIM(unit_name), '') AS unit_name
        FROM company_unit_master
        WHERE company_identifier = $1
          AND unit_id = ANY($2::text[])
        ORDER BY unit_name ASC, unit_id ASC
      `,
      [companyIdentifier, allUnitIds]
    );

    return res.status(200).json({
      success: true,
      message: `Linked ${newUnitIds.length} unit(s) successfully`,
      data: {
        email_id: user.emailId,
        unit_ids: unitDetails.rows.map((row) => row.unit_id).filter(Boolean),
        unit_names: unitDetails.rows.map((row) => row.unit_name || row.unit_id).filter(Boolean),
        added_unit_ids: newUnitIds,
      },
    });
  } catch (error) {
    console.error('Link user units error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to link user units',
    });
  }
}

async function checkUser(req, res) {
  let { email } = req.params;
  if (!email) {
    email = req.query.email;
  }

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
  if (!email) {
    email = req.query.email;
  }

  try {
    email = decodeURIComponent(email);
  } catch (decodeError) {
    console.warn('Failed to decode email parameter, using as-is:', decodeError);
  }

  email = email.trim().toLowerCase();
  const unitId = req.query.unit_id != null ? String(req.query.unit_id).trim() : '';

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
      SELECT role, mobile
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
        unit_ids: [],
        in_unit: unitId ? false : null,
        has_valid_mobile: false,
        mobile_error: 'Mobile number is required',
      });
    }

    const role = existingUser.rows[0]?.role || null;
    const mobileDigits = normalizeMobileDigits(existingUser.rows[0]?.mobile);
    const mobileError = !mobileDigits
      ? 'Mobile number is required'
      : getMobileValidationError(mobileDigits);
    const hasValidMobile = !mobileError;

    const membershipResult = await pool.query(
      `
        SELECT unit_id
        FROM user_unit_memberships
        WHERE company_identifier = $1
          AND LOWER(TRIM(user_email_id)) = LOWER(TRIM($2))
        ORDER BY unit_id ASC
      `,
      [companyIdentifier, email]
    );

    const unitIds = membershipResult.rows
      .map((row) => String(row.unit_id || '').trim())
      .filter(Boolean);
    const inUnit = unitId ? unitIds.includes(unitId) : null;

    return res.status(200).json({
      success: true,
      exists: true,
      role,
      unit_id: unitIds[0] || null,
      unit_ids: unitIds,
      in_unit: inUnit,
      has_valid_mobile: hasValidMobile,
      mobile_error: mobileError || null,
    });
  } catch (error) {
    console.error('Error checking user role:', error);
    return res.status(500).json({
      success: false,
      message: 'Error checking user role',
      exists: false,
      role: null,
      unit_id: null,
      unit_ids: [],
      in_unit: unitId ? false : null,
      has_valid_mobile: false,
      mobile_error: null,
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
          NULLIF(TRIM(cum.unit_id), '') AS unit_id,
          NULLIF(TRIM(cum.unit_name), '') AS unit_name
        FROM company_unit_master cum
        INNER JOIN coordinator_unit_assignments cua
          ON cua.company_identifier = cum.company_identifier
         AND cua.unit_id = cum.unit_id
        WHERE cum.company_identifier = $1
          AND LOWER(TRIM(cua.coordinator_email_id)) = $2
          AND NULLIF(TRIM(cum.unit_id), '') IS NOT NULL
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
      entriesQuery += ` AND (
        TRIM(COALESCE(r.business_process, '')) = $3
        OR TRIM(COALESCE(r.business_process, '')) = $4
      )`;
      params.push(businessProcessFilter, ALL_PROCESSES_KEYWORD);
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
        SELECT DISTINCT NULLIF(TRIM(cum.unit_id), '') AS unit_id
        FROM company_unit_master cum
        INNER JOIN coordinator_unit_assignments cua
          ON cua.company_identifier = cum.company_identifier
         AND cua.unit_id = cum.unit_id
        WHERE cum.company_identifier = $1
          AND LOWER(TRIM(cua.coordinator_email_id)) = $2
          AND NULLIF(TRIM(cum.unit_id), '') IS NOT NULL
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
          [emailId, ALL_PROCESSES_KEYWORD, companyIdentifier, unitId, emailId]
        );
        if (result.rowCount > 0) inserted += 1;
        else skipped += 1;
      }
    }

    await client.query('COMMIT');
    return res.status(201).json({
      success: true,
      message: 'Common CC email(s) added successfully',
      inserted,
      skipped,
      business_process: ALL_PROCESSES_KEYWORD,
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

  if (businessProcess === ALL_PROCESSES_KEYWORD) {
    return res.status(400).json({
      success: false,
      message: 'Use the common CC email option for all business processes',
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
        SELECT DISTINCT NULLIF(TRIM(cum.unit_id), '') AS unit_id
        FROM company_unit_master cum
        INNER JOIN coordinator_unit_assignments cua
          ON cua.company_identifier = cum.company_identifier
         AND cua.unit_id = cum.unit_id
        WHERE cum.company_identifier = $1
          AND LOWER(TRIM(cua.coordinator_email_id)) = $2
          AND NULLIF(TRIM(cum.unit_id), '') IS NOT NULL
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
        SELECT DISTINCT NULLIF(TRIM(cum.unit_id), '') AS unit_id
        FROM company_unit_master cum
        INNER JOIN coordinator_unit_assignments cua
          ON cua.company_identifier = cum.company_identifier
         AND cua.unit_id = cum.unit_id
        WHERE cum.company_identifier = $1
          AND LOWER(TRIM(cua.coordinator_email_id)) = $2
          AND NULLIF(TRIM(cum.unit_id), '') IS NOT NULL
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

async function getUnitSampleSizeConfig(req, res) {
  try {
    const companyIdentifier = String(req.user?.company_identifier || '').trim();
    const coordinatorEmail = normalizeEmail(req.user?.email_id);
    const unitId = String(req.query?.unit_id || '').trim();

    if (!companyIdentifier || !coordinatorEmail) {
      return res.status(400).json({ success: false, message: 'Company context is required' });
    }
    if (!unitId) {
      return res.status(400).json({ success: false, message: 'unit_id is required' });
    }

    const hasAccess = await assertCoordinatorHasMappedUnit(companyIdentifier, coordinatorEmail, unitId);
    if (!hasAccess) {
      return res.status(403).json({ success: false, message: 'Access denied for selected unit' });
    }

    const unitMap = await loadUnitFrequencySampleSizeMap(pool, companyIdentifier, unitId);
    return res.status(200).json({
      success: true,
      data: {
        unit_id: unitId,
        settings: buildUnitSampleSizeConfigResponse(unitMap),
      },
    });
  } catch (error) {
    console.error('Error fetching unit sample size config:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch sample size settings' });
  }
}

async function updateUnitSampleSizeConfig(req, res) {
  const client = await pool.connect();
  try {
    const companyIdentifier = String(req.user?.company_identifier || '').trim();
    const coordinatorEmail = normalizeEmail(req.user?.email_id);
    const unitId = String(req.body?.unit_id || '').trim();
    const settings = Array.isArray(req.body?.settings) ? req.body.settings : [];

    if (!companyIdentifier || !coordinatorEmail) {
      return res.status(400).json({ success: false, message: 'Company context is required' });
    }
    if (!unitId) {
      return res.status(400).json({ success: false, message: 'unit_id is required' });
    }

    const hasAccess = await assertCoordinatorHasMappedUnit(companyIdentifier, coordinatorEmail, unitId);
    if (!hasAccess) {
      return res.status(403).json({ success: false, message: 'Access denied for selected unit' });
    }

    await client.query('BEGIN');

    for (const item of settings) {
      const frequencyKey = String(item?.frequency_key || '').trim();
      const sampleSizeRaw = item?.sample_size;

      if (!frequencyKey) {
        await client.query('ROLLBACK');
        return res.status(400).json({ success: false, message: 'frequency_key is required for each setting' });
      }

      const validation = validateSampleSizeValue(frequencyKey, sampleSizeRaw);
      if (!validation.ok) {
        await client.query('ROLLBACK');
        return res.status(400).json({ success: false, message: validation.message });
      }

      const minimum = validation.minimum;
      if (validation.sampleSize === minimum) {
        await client.query(
          `
            DELETE FROM company_frequency_sample_size
            WHERE company_identifier = $1
              AND unit_id = $2
              AND frequency_key = $3
          `,
          [companyIdentifier, unitId, frequencyKey]
        );
        continue;
      }

      await client.query(
        `
          INSERT INTO company_frequency_sample_size (
            company_identifier,
            unit_id,
            frequency_key,
            sample_size,
            updated_by,
            updated_at
          )
          VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
          ON CONFLICT (company_identifier, unit_id, frequency_key)
          DO UPDATE SET
            sample_size = EXCLUDED.sample_size,
            updated_by = EXCLUDED.updated_by,
            updated_at = CURRENT_TIMESTAMP
        `,
        [companyIdentifier, unitId, frequencyKey, validation.sampleSize, coordinatorEmail]
      );
    }

    await client.query('COMMIT');

    const unitMap = await loadUnitFrequencySampleSizeMap(pool, companyIdentifier, unitId);
    return res.status(200).json({
      success: true,
      message: 'Sample size settings updated successfully',
      data: {
        unit_id: unitId,
        settings: buildUnitSampleSizeConfigResponse(unitMap),
      },
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error updating unit sample size config:', error);
    return res.status(500).json({ success: false, message: 'Failed to update sample size settings' });
  } finally {
    client.release();
  }
}

async function previewSampleRequired(req, res) {
  try {
    const companyIdentifier = String(req.user?.company_identifier || '').trim();
    const coordinatorEmail = normalizeEmail(req.user?.email_id);
    const controlFrequency = String(req.body?.control_frequency || '').trim();
    const sampleSize = req.body?.sample_size;
    const createdAt = req.body?.created_at || new Date();

    if (!companyIdentifier || !coordinatorEmail) {
      return res.status(400).json({ success: false, message: 'Company context is required' });
    }
    if (!controlFrequency) {
      return res.status(400).json({ success: false, message: 'control_frequency is required' });
    }

    const built = buildSampleSizeForFrequency(controlFrequency, createdAt, sampleSize);
    if (!built.ok) {
      return res.status(400).json({ success: false, message: built.message });
    }

    return res.status(200).json({
      success: true,
      data: {
        sample_size: built.sampleSize,
        sample_required: built.sampleRequired,
        minimum_sample_size: built.minimum,
      },
    });
  } catch (error) {
    console.error('Error previewing sample required:', error);
    return res.status(500).json({ success: false, message: 'Failed to preview sample required' });
  }
}

module.exports = {
  getUsers,
  getAssignedUnits,
  getApproverAssignments,
  assignRacmApprover,
  getHomeStats,
  getDashboardFilters,
  getDashboardSummary,
  getDashboardKeyControlStats,
  getDashboardNatureStats,
  getDashboardControlTypeStats,
  getDashboardRacms,
  getRiskAnalysisAvailability,
  getRiskAnalysisByControl,
  generateRiskAnalysisByControl,
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
  linkUserUnits,
  deleteUsers,
  checkUser,
  checkUserRole,
  getRacmAuditLogs,
  getCommunicationMatrix,
  addCommonCommunicationEmails,
  addBusinessProcessSpecificCommunicationEmails,
  deleteCommunicationMatrixEntries,
  createCompanyBusinessProcess,
  getUnitSampleSizeConfig,
  updateUnitSampleSizeConfig,
  previewSampleRequired,
};
