const express = require('express');
const multer = require('multer');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const path = require('path');
const { prisma } = require('../lib/prisma');
const { uploadFileToS3, deleteFileFromS3 } = require('../utils/s3Upload');
const { sendEmail } = require('../utils/send_email');
const { getCcEmailsForRacm } = require('../utils/racm_cc_recipients');
const { buildRacmInactiveUserEmail } = require('../utils/racm_status_user_email');
const { decryptToken } = require('../utils/auth_utility');
const { verifyUserAuth } = require('../modules/auth/auth.middleware');
const { clearAuthCookies } = require('../modules/auth/auth.cookies');
const { logAuditEvent, EXCEL_BULK_RACM_UPLOAD_ACTION } = require('../utils/auditLog');
const {
  createOrResubmitDeficiencyResponse,
  getDeficiencyResponseByFormId,
} = require('../utils/deficiency_response');
const { getBusinessProcessCodeForCompany } = require('../utils/business_process_master');
const {
  notifyDeficiencyResponseSubmitted,
  getCoordinatorEmailForUnit,
} = require('../utils/deficiency_response_notifications');
const { buildRacmDetailsSection } = require('../utils/racm_email_details');
const {
  calculateSampleRequired,
  getSampleSizeByFrequency,
  getSupportedControlFrequencyCategories,
} = require('../utils/sample_required');
const {
  resolveEffectiveSampleSizeForUnit,
  buildSampleSizeForFrequency,
} = require('../utils/sample_size_resolver');
const { validateRacmUnitUserAssignment } = require('../utils/unit_user_validation');
const { shouldAutoActivateRacmOnCreate } = require('../utils/racm_activation');
const {
  ensureActiveTemplateForUnit,
  getActiveTemplateWithFields,
  getTemplateWithFieldsById,
  validateDynamicValuesAgainstTemplate,
  saveDynamicFieldValues,
  applyApprovedDynamicFieldChanges,
  incrementTemplateLinkedRacmCount,
  decrementTemplateLinkedRacmCount,
  loadDynamicFieldValuesForForm,
  isRacmTemplateSchemaReady,
} = require('../utils/racm_templates');
const {
  attachControlFormDocuments,
  buildDeficiencyResponseS3FolderPath,
  buildSampleDocumentS3FolderPath,
  buildUserDocumentS3FolderPath,
  collectRacmS3DocumentKeys,
  getControlFormDocumentRows,
  getControlFormUserDocumentContext,
  insertSampleDocument,
  insertUserDocument,
} = require('../utils/racm_documents');
const {
  DOCUMENT_UPLOAD_MAX_FILE_SIZE_BYTES,
  DOCUMENT_UPLOAD_INVALID_SIZE_MESSAGE,
  DEFICIENCY_RESPONSE_INVALID_SIZE_MESSAGE,
  documentUploadFileFilter,
} = require('../utils/document_upload_restrictions');
const {
  DUPLICATE_RACM_COMPANY_SCOPED_MESSAGE,
  formatBulkImportZeroInsertedMessage,
  formatBulkImportSuccessMessage,
} = require('../utils/racm_duplicate_key');
const {
  getActiveRacmDeleteError,
  getInactiveRacmApproverAccessError,
} = require('../utils/racm_delete');
const {
  getMissingRacmRequiredFields,
  formatMissingRacmRequiredFields,
} = require('../utils/racm_required_fields');
const {
  CONTROLS_REMINDER_JOIN_SQL,
  CONTROLS_REMINDER_SELECT_SQL,
  resetReminderDatetimeForForms,
  seedReminderToApproverDatetime,
  mapControlsReminderToApi,
} = require('../utils/controls_reminder');
const { UNIT_RESPONSIBILITY_TYPES } = require('../utils/unit_responsibilities');
const {
  resolveApproverForRacm,
  getControlFormApproverDetails: resolveControlFormApproverDetails,
} = require('../utils/approver_assignment_resolver');
const {
  VALID_RACM_ASSIGNMENT_EXISTS_SQL,
  RACM_ASSIGNMENT_COMPUTED_SELECT_SQL,
  isCoordinatorAssignedRacm,
  hasCoordinatorScheduleConfigured,
  getControlFormCoordinatorContext,
  assertCoordinatorAssignedRacmAccess,
  getCoordinatorSubmissionBlockMessage,
  coordinatorHasUnitAccess,
  hasValidProcessOwnerAssignment,
} = require('../utils/racm_coordinator_assignment');

console.log('✅ control_forms.js module loaded successfully');

// Function to generate a random 15-character alphanumeric string
function generateFormId() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 15; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Function to generate a unique form_id that doesn't exist in the database
async function generateUniqueFormId(client) {
  let formId;
  let isUnique = false;
  let attempts = 0;
  const maxAttempts = 100; // Prevent infinite loop
  
  while (!isUnique && attempts < maxAttempts) {
    formId = generateFormId();
    
    // Check if form_id already exists
    const checkQuery = 'SELECT id FROM control_forms WHERE form_id = $1';
    const result = await client.query(checkQuery, [formId]);
    
    if (result.rows.length === 0) {
      isUnique = true;
    } else {
      attempts++;
    }
  }
  
  if (!isUnique) {
    // Fallback: use crypto random bytes if we can't find a unique one
    formId = crypto.randomBytes(8).toString('hex').toUpperCase().substring(0, 15);
    // Pad with random chars if needed
    while (formId.length < 15) {
      formId += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'.charAt(Math.floor(Math.random() * 36));
    }
  }
  
  return formId;
}

function formatDueDateDisplay(dueDateRaw) {
  if (!dueDateRaw) return 'TBD';

  // Expecting YYYY-MM-DD, but be defensive
  let year, month, day;
  const str = String(dueDateRaw).trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    const parts = str.split('-');
    year = Number(parts[0]);
    month = Number(parts[1]); // 1–12
    day = Number(parts[2]);
  } else {
    const dt = new Date(str);
    if (Number.isNaN(dt.getTime())) return 'TBD';
    year = dt.getFullYear();
    month = dt.getMonth() + 1;
    day = dt.getDate();
  }

  if (!year || !month || !day) return 'TBD';

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];
  const monthName = monthNames[month - 1] || '';

  const getOrdinal = (n) => {
    const v = n % 100;
    if (v >= 11 && v <= 13) return `${n}th`;
    switch (n % 10) {
      case 1: return `${n}st`;
      case 2: return `${n}nd`;
      case 3: return `${n}rd`;
      default: return `${n}th`;
    }
  };

  return `${getOrdinal(day)} ${monthName}, ${year}`;
}

function normalizeActiveInput(value) {
  if (value === undefined) return undefined;
  return value === '1' || value === 1 || value === true || String(value).trim().toLowerCase() === 'true';
}

function parseActiveFilter(value) {
  if (value === undefined) return undefined;
  const normalized = String(value).trim().toLowerCase();
  if (normalized === 'true' || normalized === '1') return true;
  if (normalized === 'false' || normalized === '0') return false;
  return undefined;
}

const VALID_RACM_APPROVER_ASSIGNMENT_EXISTS_SQL = `
  EXISTS (
    SELECT 1
    FROM approver_assignments aa
    WHERE aa.company_identifier = cf.company_identifier
      AND (
        (aa.assignment_scope = 'RACM' AND aa.form_id = cf.form_id)
        OR (
          aa.assignment_scope = 'BUSINESS_PROCESS'
          AND aa.unit_id = cf.unit_id
          AND LOWER(TRIM(COALESCE(aa.business_process, ''))) = LOWER(TRIM(COALESCE(cf.business_process, '')))
        )
        OR (aa.assignment_scope = 'UNIT' AND aa.unit_id = cf.unit_id)
      )
  )
`;

const CONTROL_FORMS_LIST_FROM = `
  FROM control_forms cf
  ${CONTROLS_REMINDER_JOIN_SQL}
  LEFT JOIN company_unit_master cum
    ON cum.company_identifier = cf.company_identifier
   AND cum.unit_id = cf.unit_id
  LEFT JOIN ifc_users u
    ON LOWER(TRIM(u.email_id)) = LOWER(TRIM(cf.control_owner))
   AND u.company_identifier = cf.company_identifier
   AND u.role = 'user'
  LEFT JOIN LATERAL (
    SELECT aa.approver_email_id
    FROM approver_assignments aa
    WHERE aa.company_identifier = cf.company_identifier
      AND (
        (aa.assignment_scope = 'RACM' AND aa.form_id = cf.form_id)
        OR (
          aa.assignment_scope = 'BUSINESS_PROCESS'
          AND aa.unit_id = cf.unit_id
          AND LOWER(TRIM(COALESCE(aa.business_process, ''))) = LOWER(TRIM(COALESCE(cf.business_process, '')))
        )
        OR (aa.assignment_scope = 'UNIT' AND aa.unit_id = cf.unit_id)
      )
    ORDER BY
      CASE aa.assignment_scope
        WHEN 'RACM' THEN 1
        WHEN 'BUSINESS_PROCESS' THEN 2
        WHEN 'UNIT' THEN 3
        ELSE 4
      END,
      aa.created_at DESC
    LIMIT 1
  ) approver_map ON TRUE
  LEFT JOIN ifc_users approver_user
    ON LOWER(TRIM(approver_user.email_id)) = LOWER(TRIM(COALESCE(approver_map.approver_email_id, '')))
   AND approver_user.company_identifier = cf.company_identifier
   AND approver_user.role = 'approver'
  LEFT JOIN user_unit_memberships owner_membership
    ON owner_membership.company_identifier = cf.company_identifier
   AND owner_membership.unit_id = cf.unit_id
   AND LOWER(TRIM(owner_membership.user_email_id)) = LOWER(TRIM(u.email_id))
`;

const CONTROL_FORMS_LIST_SELECT = `
  SELECT
    cf.*,
    ${CONTROLS_REMINDER_SELECT_SQL},
    NULLIF(TRIM(cum.unit_name), '') AS unit_name,
    NULLIF(TRIM(u.emp_name), '') AS control_owner_name,
    NULLIF(TRIM(approver_map.approver_email_id), '') AS approver_email_id,
    NULLIF(TRIM(approver_user.emp_name), '') AS approver_name,
    NULLIF(TRIM(approver_user.emp_name), '') AS approver_display_name,
    ${RACM_ASSIGNMENT_COMPUTED_SELECT_SQL}
`;

function appendControlFormsListFilters(req, options, queryParts) {
  const { assignmentEligibleOnly = false } = options;
  const {
    assignment,
    company_identifier,
    control_owner,
    control_number,
    active,
    business_process,
    status,
    financial_year,
    cycle,
    sub_process,
    unit_id,
    conclusion,
    pending_changes,
    deficiency_action_status,
    active_or_valid_assignment,
    assignment_target,
  } = req.query;

  let { whereClause, queryParams, paramIndex } = queryParts;

  if (req.user.role === 'company_co') {
    const coordinatorCompanyIdentifier = req.user.company_identifier;
    if (coordinatorCompanyIdentifier) {
      whereClause += ` AND cf.company_identifier = $${paramIndex}`;
      queryParams.push(coordinatorCompanyIdentifier);
      paramIndex += 1;
    }
    whereClause += `
      AND EXISTS (
        SELECT 1
        FROM coordinator_unit_assignments coordinator_units
        WHERE coordinator_units.company_identifier = cf.company_identifier
          AND coordinator_units.unit_id = cf.unit_id
          AND LOWER(TRIM(coordinator_units.coordinator_email_id)) = LOWER(TRIM($${paramIndex}))
      )
    `;
    queryParams.push(req.user.email_id);
    paramIndex += 1;
  } else if (company_identifier) {
    whereClause += ` AND cf.company_identifier = $${paramIndex}`;
    queryParams.push(company_identifier);
    paramIndex += 1;
  }

  if (unit_id) {
    whereClause += ` AND cf.unit_id = $${paramIndex}`;
    queryParams.push(String(unit_id).trim());
    paramIndex += 1;
  }

  if (control_owner) {
    whereClause += ` AND LOWER(TRIM(cf.control_owner)) = LOWER(TRIM($${paramIndex}))`;
    queryParams.push(control_owner.trim());
    paramIndex += 1;
  }

  if (control_number) {
    whereClause += ` AND LOWER(TRIM(COALESCE(cf.control_number, ''))) LIKE $${paramIndex}`;
    queryParams.push(`%${String(control_number).trim().toLowerCase()}%`);
    paramIndex += 1;
  }

  if (business_process) {
    whereClause += ` AND cf.business_process IS NOT NULL AND LOWER(TRIM(cf.business_process)) = $${paramIndex}`;
    queryParams.push(business_process.trim().toLowerCase());
    paramIndex += 1;
  }

  if (active !== undefined) {
    const activeFilter = parseActiveFilter(active);
    if (activeFilter === true) {
      whereClause += ' AND cf.active = TRUE';
    } else if (activeFilter === false) {
      whereClause += ' AND COALESCE(cf.active, FALSE) = FALSE';
    }
  }

  if (status) {
    const normalizedStatus = String(status).trim().toLowerCase();
    if (normalizedStatus === 'pending') {
      whereClause += ` AND (
        cf.status IS NULL
        OR cf.status = ''
        OR cf.status = 'null'
        OR LOWER(TRIM(cf.status)) = 'sent for approval'
      )`;
    } else if (normalizedStatus === 'sent for approval') {
      whereClause += ` AND cf.status = $${paramIndex}`;
      queryParams.push('sent for approval');
      paramIndex += 1;
    } else if (normalizedStatus === 'approved') {
      whereClause += ` AND cf.status = $${paramIndex}`;
      queryParams.push('Approved');
      paramIndex += 1;
    } else if (normalizedStatus === 'rejected') {
      whereClause += ` AND cf.status = $${paramIndex}`;
      queryParams.push('Rejected');
      paramIndex += 1;
    }
  }

  if (financial_year) {
    whereClause += ` AND cf.financial_year IS NOT NULL AND TRIM(cf.financial_year) = $${paramIndex}`;
    queryParams.push(financial_year.trim());
    paramIndex += 1;
  }

  if (sub_process) {
    whereClause += ` AND cf.sub_process IS NOT NULL AND TRIM(cf.sub_process) = $${paramIndex}`;
    queryParams.push(sub_process.trim());
    paramIndex += 1;
  }

  if (cycle) {
    whereClause += ` AND cf.cycle IS NOT NULL AND TRIM(cf.cycle) = $${paramIndex}`;
    queryParams.push(cycle.trim());
    paramIndex += 1;
  }

  if (conclusion) {
    const normalizedConclusion = String(conclusion).trim();
    if (normalizedConclusion.toLowerCase() === 'none') {
      whereClause += ` AND (
        cf.control_design_conclusion IS NULL
        OR TRIM(cf.control_design_conclusion) = ''
      )`;
    } else {
      whereClause += ` AND LOWER(TRIM(cf.control_design_conclusion)) = LOWER(TRIM($${paramIndex}))`;
      queryParams.push(normalizedConclusion);
      paramIndex += 1;
    }
  }

  if (pending_changes !== undefined) {
    const pendingChangesFilter = parseActiveFilter(pending_changes);
    if (pendingChangesFilter === true) {
      whereClause += ' AND COALESCE(cf.pending_changes, FALSE) = TRUE';
    } else if (pendingChangesFilter === false) {
      whereClause += ' AND COALESCE(cf.pending_changes, FALSE) = FALSE';
    }
  }

  if (deficiency_action_status !== undefined) {
    const deficiencyActionFilter = parseActiveFilter(deficiency_action_status);
    if (deficiencyActionFilter === true) {
      whereClause += ' AND COALESCE(cf.deficiency_action_status, FALSE) = TRUE';
    } else if (deficiencyActionFilter === false) {
      whereClause += ' AND COALESCE(cf.deficiency_action_status, FALSE) = FALSE';
    }
  }

  if (assignment === 'assigned') {
    if (String(assignment_target || '').trim().toLowerCase() === 'approver') {
      whereClause += ` AND ${VALID_RACM_APPROVER_ASSIGNMENT_EXISTS_SQL}`;
    } else {
      whereClause += ` AND ${VALID_RACM_ASSIGNMENT_EXISTS_SQL}`;
    }
  } else if (assignment === 'unassigned') {
    if (String(assignment_target || '').trim().toLowerCase() === 'approver') {
      whereClause += ` AND NOT ${VALID_RACM_APPROVER_ASSIGNMENT_EXISTS_SQL}`;
    } else {
      whereClause += ` AND NOT ${VALID_RACM_ASSIGNMENT_EXISTS_SQL}`;
    }
  }

  if (parseActiveFilter(active_or_valid_assignment) === true) {
    whereClause += ` AND (cf.active = TRUE OR ${VALID_RACM_ASSIGNMENT_EXISTS_SQL})`;
  }

  if (assignmentEligibleOnly) {
    whereClause += `
      AND cf.due_date IS NOT NULL
      AND NULLIF(TRIM(COALESCE(cf.reminder_frequency, '')), '') IS NOT NULL
    `;
  }

  return { whereClause, queryParams, paramIndex };
}

function buildControlFormsListQueryParts(req, options = {}) {
  const queryParts = {
    whereClause: ' WHERE 1=1',
    queryParams: [],
    paramIndex: 1,
  };
  return appendControlFormsListFilters(req, options, queryParts);
}

async function getControlFormsForList(req, options = {}) {
  const { whereClause, queryParams } = buildControlFormsListQueryParts(req, options);
  const orderByClause = ' ORDER BY COALESCE(cf.updated_at, cf.created_at) DESC, cf.created_at DESC';
  const shouldPaginate = req.query.page !== undefined || req.query.page_size !== undefined;

  if (!shouldPaginate) {
    const query = `${CONTROL_FORMS_LIST_SELECT}${CONTROL_FORMS_LIST_FROM}${whereClause}${orderByClause}`;
    const result = await pool.query(query, queryParams);
    await attachControlFormDocuments(pool, result.rows);
    return result.rows;
  }

  const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
  const pageSize = Math.min(100, Math.max(1, Number.parseInt(req.query.page_size, 10) || 10));
  const offset = (page - 1) * pageSize;
  const limitParamIndex = queryParams.length + 1;
  const offsetParamIndex = queryParams.length + 2;

  const countQuery = `SELECT COUNT(*)::int AS total${CONTROL_FORMS_LIST_FROM}${whereClause}`;
  const summaryQuery = `
    SELECT
      COUNT(*) FILTER (WHERE COALESCE(cf.deficiency_action_status, FALSE) = TRUE)::int AS action_required_count,
      COUNT(*) FILTER (WHERE COALESCE(cf.pending_changes, FALSE) = TRUE)::int AS pending_change_request_count
    ${CONTROL_FORMS_LIST_FROM}${whereClause}
  `;
  const conclusionOptionsQuery = `
    SELECT DISTINCT
      CASE
        WHEN cf.control_design_conclusion IS NULL OR TRIM(cf.control_design_conclusion) = '' THEN 'None'
        ELSE INITCAP(TRIM(cf.control_design_conclusion))
      END AS conclusion_label
    ${CONTROL_FORMS_LIST_FROM}${whereClause}
    ORDER BY conclusion_label
  `;
  const dataQuery = `${CONTROL_FORMS_LIST_SELECT}${CONTROL_FORMS_LIST_FROM}${whereClause}${orderByClause} LIMIT $${limitParamIndex} OFFSET $${offsetParamIndex}`;

  const [countResult, summaryResult, conclusionOptionsResult, dataResult] = await Promise.all([
    pool.query(countQuery, queryParams),
    pool.query(summaryQuery, queryParams),
    pool.query(conclusionOptionsQuery, queryParams),
    pool.query(dataQuery, [...queryParams, pageSize, offset]),
  ]);

  await attachControlFormDocuments(pool, dataResult.rows);

  const summaryRow = summaryResult.rows[0] || {};
  return {
    rows: dataResult.rows,
    total: Number(countResult.rows[0]?.total || 0),
    page,
    page_size: pageSize,
    summary: {
      action_required_count: Number(summaryRow.action_required_count || 0),
      pending_change_request_count: Number(summaryRow.pending_change_request_count || 0),
      conclusion_options: conclusionOptionsResult.rows
        .map((row) => String(row.conclusion_label || '').trim())
        .filter(Boolean)
        .sort((a, b) => {
          if (a === 'None') return 1;
          if (b === 'None') return -1;
          return a.localeCompare(b);
        }),
    },
  };
}

function buildControlFormStatusEmail(status, businessProcess, processOwnerName, coordinatorName, coordinatorCompanyName, dueDate, formId) {
  const recipientName = processOwnerName || 'Process Owner';
  const coordinatorDisplayName = coordinatorName || 'Company Coordinator';
  const coordinatorCompanyDisplayName = coordinatorCompanyName || 'Company';
  const formattedDueDate = formatDueDateDisplay(dueDate);
  const formUrl = formId ? `${process.env.FRONTEND_URL}/user/form/${formId}` : null;
  switch (status) {
    case 'Active':
      return {
        shouldSend: true,
        subject: 'Your IFC testing for ' + businessProcess + ' is ready',
        text: `Hi ${recipientName},

Hope you're having a good week!

I'm reaching out because your Internal Financial Controls assignment for ${businessProcess} is now ready in the system. Nothing complicated; we just need your help to keep things moving.

Here's what we need from you:

1. You'll see the risk and control matrix from last year. Take a quick look through from here (View of the Risk & Control key issues) especially the risks we identified and the controls we put in place. You'll also spot the evidence that was submitted last year, which should give you a good sense of what we're looking for. (You will be able to download the evidence that was submitted last year.)

2. Upload the evidence for this year's testing against each control. The period and the amount of samples can be viewed in the RACM detail page. 

What happens next?

Once you submit your evidence, our tester will review it to check if the control is operating effectively. They'll either pass or fail the control based on what they see. So the clearer your evidence, the smoother that review goes!

Deadline: ${formattedDueDate}

Portal: ${process.env.VITE_FRONTEND_URL}

Just shout if you hit any snags or have questions or you have any feedback on the performance of the controls or have noted any significant breaches; I'm happy to help.

Thanks for cooperating.

Regards,
${coordinatorDisplayName}
${coordinatorCompanyDisplayName}
        `
      };
    case 'Inactive':
      return buildRacmInactiveUserEmail({
        businessProcess,
        processOwnerName: recipientName,
        coordinatorName: coordinatorDisplayName,
        coordinatorCompanyName: coordinatorCompanyDisplayName,
      });
    default:
      return {
        shouldSend: false
      };
  }
}

function buildSentForApprovalEmail({
  approverName,
  userDisplayName,
  formId,
  businessProcess,
  financialYear,
  standardControlDescription,
  subProcess,
  dueDate,
  companyName,
}) {
  const reviewerName = String(approverName || '').trim() || 'Approver';
  const submittedBy = String(userDisplayName || '').trim() || 'User';
  const companyDisplayName = String(companyName || '').trim() || 'Sharp and Tannan Associates';
  const bp = String(businessProcess || '').trim();
  const dueDateText = dueDate ? formatDueDateDisplay(dueDate) : '';
  const portalUrl = process.env.VITE_FRONTEND_URL || process.env.FRONTEND_URL || '';
  const detailsBlock = buildRacmDetailsSection(
    {
      businessProcess,
      financialYear,
      standardControlDescription,
    },
    [
      ['Submitted By', submittedBy],
      ['Sub-Process', subProcess],
      ['Due Date', dueDateText],
    ]
  );
  const subjectSuffix = bp || String(formId || '').trim() || 'RACM';

  return {
    subject: `RACM sent for approval - ${subjectSuffix}`,
    text: `Dear ${reviewerName},

A RACM has been sent for approval.

${detailsBlock}

Please review the uploaded documents and Approve/Reject based on your judgement.
${portalUrl ? `\nPortal: ${portalUrl}` : ''}

Regards,
${companyDisplayName}`,
  };
}

async function getBusinessProcessCodeForName(clientOrPool, companyIdentifier, businessProcess) {
  return getBusinessProcessCodeForCompany(clientOrPool, companyIdentifier, businessProcess);
}

async function getNextGeneratedControlNumber(clientOrPool, companyIdentifier, prefix) {
  const companyId = String(companyIdentifier || '').trim();
  const codePrefix = String(prefix || '').trim();
  if (!companyId || !codePrefix) return null;

  const escapedPrefix = codePrefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const result = await clientOrPool.query(
    `
      SELECT TRIM(control_number) AS control_number
      FROM control_forms
      WHERE company_identifier = $1
        AND control_number IS NOT NULL
        AND TRIM(control_number) <> ''
        AND TRIM(control_number) ~ $2
    `,
    [companyId, `^${escapedPrefix}[0-9]+$`]
  );

  let maxNumber = 0;
  for (const row of result.rows) {
    const value = String(row.control_number || '').trim();
    const numericPart = value.slice(codePrefix.length);
    const parsed = parseInt(numericPart, 10);
    if (!Number.isNaN(parsed) && parsed > maxNumber) {
      maxNumber = parsed;
    }
  }
  return `${codePrefix}${maxNumber + 1}`;
}

const router = express.Router();

// Test route to verify routes are working (no auth required)
router.get('/test-route', (req, res) => {
  console.log('🧪 TEST ROUTE HIT - Routes are working!');
  console.log('Request path:', req.path);
  console.log('Request method:', req.method);
  res.json({ success: true, message: 'Test route is working!', timestamp: new Date().toISOString() });
});

router.get('/control-number-preview', verifyAuth, async (req, res) => {
  try {
    const businessProcess = req.query.business_process != null ? String(req.query.business_process).trim() : '';
    const inputControlNumber = req.query.control_number != null ? String(req.query.control_number).trim() : '';
    let companyIdentifier = req.query.company_identifier != null ? String(req.query.company_identifier).trim() : '';

    if (!companyIdentifier) {
      const userResult = await pool.query(
        'SELECT company_identifier FROM ifc_users WHERE LOWER(TRIM(email_id)) = LOWER(TRIM($1)) LIMIT 1',
        [req.user.email_id]
      );
      companyIdentifier = String(userResult.rows[0]?.company_identifier || '').trim();
    }

    if (!companyIdentifier) {
      return res.status(400).json({
        success: false,
        message: 'Company identifier not found',
      });
    }

    let generatedControlNumber = '';
    if (businessProcess) {
      const prefix = await getBusinessProcessCodeForName(pool, companyIdentifier, businessProcess);
      if (prefix) {
        generatedControlNumber = await getNextGeneratedControlNumber(pool, companyIdentifier, prefix);
      }
    }

    let duplicate = false;
    if (inputControlNumber) {
      const duplicateResult = await pool.query(
        `
          SELECT 1
          FROM control_forms
          WHERE company_identifier = $1
            AND TRIM(control_number) = TRIM($2)
            AND (
              $3 = ''
              OR LOWER(TRIM(COALESCE(business_process, ''))) = LOWER(TRIM($3))
            )
          LIMIT 1
        `,
        [companyIdentifier, inputControlNumber, businessProcess]
      );
      duplicate = duplicateResult.rows.length > 0;
    }

    return res.status(200).json({
      success: true,
      data: {
        generated_control_number: generatedControlNumber,
        duplicate,
        available: inputControlNumber ? !duplicate : false,
      },
    });
  } catch (error) {
    console.error('Control number preview error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to generate/check control number',
    });
  }
});

const { pool, connectPgClient, releasePgClient, isPgConnectionError, getDatabaseUnavailableMessage, queryWithRetry } = require('../utils/db');
const { getColumnMappingConfig } = require('../utils/column_mapping');
const {
  applyControlFrequencyValueMapping,
  prepareBulkImportRows,
  transformExcelData,
  transformExcelDataWithColumnMapping,
  insertRacmRowsFromTransformedData,
  validateBulkImportControlFrequencies,
} = require('../utils/racm_bulk_import_from_rows');

const MAX_BULK_IMPORT_ROWS = 5000;

router.get('/column-mapping-config', verifyAuth, async (req, res) => {
  try {
    return res.status(200).json({
      success: true,
      data: getColumnMappingConfig(),
    });
  } catch (error) {
    console.error('column-mapping-config error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to load column mapping config',
    });
  }
});

router.get('/control-frequency-options', verifyAuth, async (req, res) => {
  try {
    return res.status(200).json({
      success: true,
      data: getSupportedControlFrequencyCategories(),
    });
  } catch (error) {
    console.error('control-frequency-options error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch control frequency options',
    });
  }
});

// Multer for user document uploads (memory storage for S3 upload)
const uploadUserDoc = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: DOCUMENT_UPLOAD_MAX_FILE_SIZE_BYTES },
  fileFilter: documentUploadFileFilter,
});

const uploadSampleDoc = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: DOCUMENT_UPLOAD_MAX_FILE_SIZE_BYTES },
  fileFilter: documentUploadFileFilter,
});

const uploadDeficiencyResponseDoc = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: DOCUMENT_UPLOAD_MAX_FILE_SIZE_BYTES },
  fileFilter: documentUploadFileFilter,
});

function handleUserDocumentUpload(req, res, next) {
  uploadUserDoc.fields([
    { name: 'documents', maxCount: 20 },
    { name: 'document', maxCount: 1 },
  ])(req, res, (error) => {
    if (!error) {
      next();
      return;
    }

    if (error instanceof multer.MulterError) {
      if (error.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          success: false,
          message: DOCUMENT_UPLOAD_INVALID_SIZE_MESSAGE,
        });
      }

      return res.status(400).json({
        success: false,
        message: error.message || 'Failed to upload documents',
      });
    }

    console.error('User document upload middleware error:', error);
    return res.status(400).json({
      success: false,
      message: error.message || 'Failed to upload documents',
    });
  });
}

function handleSampleDocumentUpload(req, res, next) {
  uploadSampleDoc.fields([
    { name: 'excelFiles', maxCount: 20 },
    { name: 'excelFile', maxCount: 1 },
  ])(req, res, (error) => {
    if (!error) {
      next();
      return;
    }

    if (error instanceof multer.MulterError) {
      if (error.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          success: false,
          message: DOCUMENT_UPLOAD_INVALID_SIZE_MESSAGE,
        });
      }

      return res.status(400).json({
        success: false,
        message: error.message || 'Failed to upload sample documents',
      });
    }

    console.error('Sample document upload middleware error:', error);
    return res.status(400).json({
      success: false,
      message: error.message || 'Failed to upload sample documents',
    });
  });
}

function handleDeficiencyResponseUpload(req, res, next) {
  uploadDeficiencyResponseDoc.fields([
    { name: 'documents', maxCount: 20 },
    { name: 'document', maxCount: 1 },
  ])(req, res, (error) => {
    if (!error) {
      next();
      return;
    }

    if (error instanceof multer.MulterError) {
      if (error.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          success: false,
          message: DEFICIENCY_RESPONSE_INVALID_SIZE_MESSAGE,
        });
      }

      return res.status(400).json({
        success: false,
        message: error.message || 'Failed to upload deficiency response documents',
      });
    }

    console.error('Deficiency response upload middleware error:', error);
    return res.status(400).json({
      success: false,
      message: error.message || 'Failed to upload deficiency response documents',
    });
  });
}

/** Design & Implementation block (process owner / user UI). Keep in sync with UserFormDetail groupedApproverFields. */
const DESIGN_IMPLEMENTATION_GROUP_FIELDS = [
  'control_design_procs',
  'control_design_conclusion',
  'design_deficiency_desc',
];

const REQUEST_CHANGE_ALLOWED_FIELDS = new Set([
  'control_number',
  'area',
  'sub_process',
  'risk_description',
  'risk_heat',
  'standard_control_description',
  'control_objective',
  'whether_fraud_risks_exist',
  'process_walkthrough',
  'control_relies_on_ipe',
  'audit_evidence_accuracy',
  'ipe_reference',
  'key_control',
  'application_name',
  'control_performer',
  'control_owner',
  'control_design_procs',
  'control_design_conclusion',
  'design_deficiency_desc',
  'control_type_fo',
  'control_type_ma',
  'nature_of_control',
  'sample_size',
  'sample_required',
  'due_date',
]);

const REQUEST_CHANGE_FIELD_LABELS = {
  control_number: 'Control Number',
  area: 'Area',
  sub_process: 'Sub Process',
  risk_description: 'Risk Description',
  risk_heat: 'Risk Heat',
  standard_control_description: 'Standard Control Description',
  control_objective: 'Control Objective',
  whether_fraud_risks_exist: 'Whether Fraud Risks Exist',
  process_walkthrough: 'Process Activity and Walkthrough Details',
  control_relies_on_ipe: 'Does the Control Rely on IPE?',
  audit_evidence_accuracy: 'Audit Evidence Accuracy',
  ipe_reference: 'IPE Reference',
  key_control: 'Key Control',
  application_name: 'Application Name',
  control_performer: 'Control Performer',
  control_owner: 'Process Owner',
  control_design_procs: 'Procedures to Evaluate Design and Implementation',
  control_design_conclusion: 'Conclusion on Design of Control',
  design_deficiency_desc: 'Description of Deficiency in Control Design',
  control_type_fo: 'Type of Control (Operational/Financial)',
  control_type_ma: 'Type of Control (Manual/Automated)',
  nature_of_control: 'Nature of Control',
  sample_size: 'Sample Size',
  sample_required: 'Sample Required',
  due_date: 'Due Date',
};

function generateChangeRequestId() {
  const randomPart = crypto.randomBytes(4).toString('hex').toUpperCase();
  return `CR${Date.now()}${randomPart}`.slice(0, 30);
}

function normalizeChangeRequestTextValue(fieldName, value) {
  if (value == null) return '';

  if (fieldName === 'due_date') {
    const raw = String(value).trim();
    if (!raw) return '';
    return raw.length >= 10 ? raw.slice(0, 10) : raw;
  }

  return String(value).trim();
}

function getRequestChangeFieldLabel(fieldName, providedLabel) {
  const derivedLabel = REQUEST_CHANGE_FIELD_LABELS[fieldName];
  if (derivedLabel) return derivedLabel;
  const safeLabel = String(providedLabel || '').trim();
  if (safeLabel) return safeLabel;
  return fieldName
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

async function loadRequestChangeExtraFieldContext(client, templateId, formId) {
  if (!templateId) {
    return { extraFieldByKey: new Map(), dynamicValues: {} };
  }

  const templatePayload = await getTemplateWithFieldsById(client, templateId);
  if (!templatePayload.ok) {
    return { extraFieldByKey: new Map(), dynamicValues: {} };
  }

  const extraFieldByKey = new Map(
    (templatePayload.extra_fields || []).map((field) => [field.field_key, field])
  );
  const dynamicPayload = await loadDynamicFieldValuesForForm(client, formId);

  return {
    extraFieldByKey,
    dynamicValues: dynamicPayload.dynamic_values || {},
  };
}

function resolveRequestChangeFieldKind(fieldDbName, extraFieldByKey) {
  if (extraFieldByKey.has(fieldDbName)) return 'dynamic';
  if (REQUEST_CHANGE_ALLOWED_FIELDS.has(fieldDbName)) return 'fixed';
  return null;
}

function quoteIdentifier(identifier) {
  return `"${String(identifier).replace(/"/g, '""')}"`;
}

function parseApprovedChangeRequestValue(fieldName, value) {
  if (value == null) return null;
  const raw = String(value).trim();
  if (!raw) return null;

  if (fieldName === 'due_date') {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
    return raw;
  }

  return raw;
}

async function getAuthorizedControlFormForChangeRequest(clientOrPool, formId, user) {
  const result = await clientOrPool.query(
    `
      SELECT form_id, company_identifier, unit_id, control_owner
      FROM control_forms
      WHERE form_id = $1
      LIMIT 1
    `,
    [formId]
  );

  if (result.rows.length === 0) {
    return { error: { status: 404, message: 'RACM not found' } };
  }

  const form = result.rows[0];
  const userRole = String(user?.role || '').trim().toLowerCase();
  const userEmail = String(user?.email_id || '').trim().toLowerCase();
  const formOwnerEmail = String(form.control_owner || '').trim().toLowerCase();
  const formCompanyIdentifier = String(form.company_identifier || '').trim();
  const userCompanyIdentifier = String(user?.company_identifier || '').trim();

  if (userRole === 'user' && formOwnerEmail !== userEmail) {
    return { error: { status: 403, message: 'Access denied. You are not authorized to view this change request.' } };
  }

  if (userRole === 'company_co' && formCompanyIdentifier !== userCompanyIdentifier) {
    return { error: { status: 403, message: 'Access denied. RACM is not assigned to this company coordinator.' } };
  }

  return { form };
}

function designImplementationGroupHasAnyValue(row) {
  if (!row || typeof row !== 'object') return false;
  return DESIGN_IMPLEMENTATION_GROUP_FIELDS.some((key) => {
    const v = row[key];
    return v !== null && v !== undefined && v !== '' && String(v).trim() !== '';
  });
}

/** Shallow copy for JSON: omit all three when every value is empty; otherwise return full row. */
function shapeControlFormJsonForProcessOwner(row) {
  const copy = { ...row };
  if (!designImplementationGroupHasAnyValue(copy)) {
    DESIGN_IMPLEMENTATION_GROUP_FIELDS.forEach((k) => {
      delete copy[k];
    });
  }
  return copy;
}

function isDatabaseConnectionError(error) {
  return isPgConnectionError(error);
}

const MISSING_UNIT_APPROVER_MESSAGE = 'No approver is assigned for current company unit';

async function getControlFormApproverDetails(clientOrPool, formId) {
  return resolveControlFormApproverDetails(clientOrPool, formId);
}

function isApproverAssigned(details) {
  return String(details?.approver_email_id || '').trim() !== '';
}

function getApproverSubmissionBlockMessage(details) {
  if (!isApproverAssigned(details)) return MISSING_UNIT_APPROVER_MESSAGE;
  return '';
}

function isDeficiencyResponseEditable(status) {
  const normalized = String(status || '').trim().toLowerCase();
  return normalized === 'rejected' || normalized === 'resubmission_required';
}

async function getAuthorizedControlFormForDeficiency(clientOrPool, formId, user) {
  const result = await clientOrPool.query(
    `
      SELECT form_id, company_identifier, unit_id, control_owner, deficiency_action_status, deficiency_response_status, status
      FROM control_forms
      WHERE form_id = $1
      LIMIT 1
    `,
    [formId]
  );

  if (result.rows.length === 0) {
    return { error: { status: 404, message: 'RACM not found' } };
  }

  const form = result.rows[0];
  const userRole = String(user?.role || '').trim().toLowerCase();
  const userEmail = String(user?.email_id || '').trim().toLowerCase();
  const formOwnerEmail = String(form.control_owner || '').trim().toLowerCase();
  const formCompanyIdentifier = String(form.company_identifier || '').trim();
  const userCompanyIdentifier = String(user?.company_identifier || '').trim();

  if (userRole === 'user' && formOwnerEmail !== userEmail) {
    return { error: { status: 403, message: 'Access denied. You are not authorized to update this deficiency response.' } };
  }

  if (userRole === 'company_co' && formCompanyIdentifier !== userCompanyIdentifier) {
    return { error: { status: 403, message: 'Access denied. RACM is not assigned to this company coordinator.' } };
  }

  if (!['user', 'company_co'].includes(userRole)) {
    return { error: { status: 403, message: 'Only process owners and company coordinators can submit deficiency responses.' } };
  }

  return { form };
}

async function queryAuthenticatedUser(emailId) {
  const userQuery = 'SELECT id, email_id, role, company_identifier FROM ifc_users WHERE email_id = $1';
  return queryWithRetry(userQuery, [emailId]);
}

// Middleware to verify authentication (unified authentication system)
async function verifyAuth(req, res, next) {
  try {
    // Use unified authToken (prioritize it, but fallback to old tokens for backward compatibility)
    const token = req.cookies.authToken || req.cookies.userAuthToken || req.cookies.approverAuthToken;
    
    if (!token) {
      console.error('❌ No token found in cookies');
      clearAuthCookies(res);
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    const jwtSecret = process.env.JWT_SECRET;
    let decoded;

    try {
      decoded = jwt.verify(decryptToken(token), jwtSecret);
    } catch (error) {
      console.error('❌ Invalid or expired token:', error.message);
      clearAuthCookies(res);
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired token'
      });
    }
    
    // Get user details from database to include role and company_identifier
    const userResult = await queryAuthenticatedUser(decoded.email_id);
    
    if (userResult.rows.length === 0) {
      clearAuthCookies(res);
      return res.status(401).json({
        success: false,
        message: 'User not found'
      });
    }
    
    const user = userResult.rows[0];
    
    // Attach user info to request object
    req.user = {
      id: user.id,
      email_id: user.email_id,
      role: user.role,
      company_identifier: user.company_identifier
    };
    
    console.log('✅ Token verified successfully, user:', user.email_id, 'role:', user.role);
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      console.error('❌ Invalid or expired token:', error.message);
      clearAuthCookies(res);
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired token'
      });
    }
    
    console.error('❌ Authentication user lookup failed:', error.message);
    clearAuthCookies(res);
    return res.status(isDatabaseConnectionError(error) ? 503 : 500).json({
      success: false,
      message: isDatabaseConnectionError(error)
        ? 'Authentication service temporarily unavailable'
        : 'Authentication lookup failed'
    });
  }
}

// Client-parsed Excel rows → immediate RACM insert (no S3 / excel_files queue)
router.post('/bulk-import-rows', verifyAuth, async (req, res) => {
  try {
    if (req.user.role !== 'company_co') {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const companyIdentifier = req.user.company_identifier;
    if (!companyIdentifier || String(companyIdentifier).trim() === '') {
      return res.status(400).json({ success: false, message: 'Company identifier is required' });
    }

    const businessProcess = req.body.businessProcess;
    const financialYear = req.body.financialYear;
    const unitId = req.body.unit_id ? String(req.body.unit_id).trim() : '';
    const rows = req.body.rows;

    const missingRequiredFields = getMissingRacmRequiredFields({
      business_process: businessProcess,
      financial_year: financialYear,
      unit_id: unitId,
    });
    if (missingRequiredFields.length > 0) {
      return res.status(400).json({
        success: false,
        message: formatMissingRacmRequiredFields(missingRequiredFields),
        missingFields: missingRequiredFields,
      });
    }
    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ success: false, message: 'No data rows provided' });
    }
    if (rows.length > MAX_BULK_IMPORT_ROWS) {
      return res.status(400).json({
        success: false,
        message: `Too many rows (max ${MAX_BULK_IMPORT_ROWS} per request)`,
      });
    }

    const dueDate = req.body.due_date ? String(req.body.due_date).trim() : '';
    const reminderFrequency = req.body.reminder_frequency ? String(req.body.reminder_frequency).trim() : '';

    if ((dueDate && !reminderFrequency) || (!dueDate && reminderFrequency)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide both due_date and reminder_frequency (or keep both empty)',
      });
    }

    if (dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid due_date format. Expected YYYY-MM-DD',
      });
    }

    if (reminderFrequency) {
      const allowed = new Set(['Daily', 'Weekly', 'Monthly']);
      if (!allowed.has(reminderFrequency)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid reminder_frequency. Allowed values: Daily, Weekly, Monthly',
        });
      }
    }

    const coordinatorEmailId = req.user.email_id;
    const columnMapping = req.body.column_mapping;

    let allowedExtraFieldKeys = null;
    if (unitId) {
      const schemaClient = await pool.connect();
      try {
        if (await isRacmTemplateSchemaReady(schemaClient)) {
          const templateResult = await getActiveTemplateWithFields(
            schemaClient,
            companyIdentifier,
            unitId
          );
          if (templateResult.ok) {
            allowedExtraFieldKeys = new Set(
              (templateResult.extra_fields || []).map((field) => field.field_key)
            );
          }
        }
      } finally {
        schemaClient.release();
      }
    }

    const transformedDataBase =
      columnMapping &&
      typeof columnMapping === 'object' &&
      !Array.isArray(columnMapping) &&
      Object.keys(columnMapping).length > 0
        ? transformExcelDataWithColumnMapping(rows, columnMapping, allowedExtraFieldKeys)
        : transformExcelData(rows);
    const controlFrequencyValueMapping =
      req.body.control_frequency_value_mapping &&
      typeof req.body.control_frequency_value_mapping === 'object' &&
      !Array.isArray(req.body.control_frequency_value_mapping)
        ? req.body.control_frequency_value_mapping
        : null;
    const transformedData = applyControlFrequencyValueMapping(
      transformedDataBase,
      controlFrequencyValueMapping
    );

    const controlFrequencyValidation = validateBulkImportControlFrequencies(transformedData);
    if (!controlFrequencyValidation.ok) {
      return res.status(400).json({
        success: false,
        message: controlFrequencyValidation.message,
        data: {
          reason: controlFrequencyValidation.reason,
          invalidControlFrequencies: controlFrequencyValidation.invalidValues,
        },
      });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const unitResult = await client.query(
        `
          SELECT unit_id
          FROM coordinator_unit_assignments
          WHERE company_identifier = $1
            AND unit_id = $2
            AND LOWER(TRIM(coordinator_email_id)) = LOWER(TRIM($3))
          LIMIT 1
        `,
        [companyIdentifier, unitId, coordinatorEmailId]
      );

      if (unitResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          success: false,
          message: 'Invalid unit selected',
        });
      }

      const {
        preparedRows,
        duplicateControlNumbersInUpload,
        duplicateExistingCompanyControlNumbers,
      } = await prepareBulkImportRows(client, {
        transformedData,
        companyIdentifier,
        businessProcess: String(businessProcess).trim(),
      });

      if (duplicateControlNumbersInUpload.length > 0) {
        await client.query('ROLLBACK');
        return res.status(409).json({
          success: false,
          message: `Duplicate Control Number found in the uploaded Excel file: ${duplicateControlNumbersInUpload.join(', ')}`,
          data: {
            duplicateControlNumbers: duplicateControlNumbersInUpload,
            source: 'upload',
          },
        });
      }

      if (duplicateExistingCompanyControlNumbers.length > 0) {
        await client.query('ROLLBACK');
        return res.status(409).json({
          success: false,
          message: `Duplicate Control Number already exists for this company: ${duplicateExistingCompanyControlNumbers.join(', ')}`,
          data: {
            duplicateControlNumbers: duplicateExistingCompanyControlNumbers,
            source: 'database',
          },
        });
      }

      const importStats = await insertRacmRowsFromTransformedData(client, {
        transformedData: preparedRows,
        companyIdentifier,
        coordinatorEmailId,
        unitId,
        businessProcess: String(businessProcess).trim(),
        financialYear: String(financialYear).trim(),
        fileDueDate: dueDate || null,
        fileReminderFrequency: reminderFrequency || null,
      });
      const {
        insertedCount,
        skippedCount,
        duplicateCount,
        errorCount,
        duplicateControlNumberSamples,
        createdAuditEvents,
      } = importStats;

      if (insertedCount === 0) {
        await client.query('ROLLBACK');
        await logAuditEvent(EXCEL_BULK_RACM_UPLOAD_ACTION, coordinatorEmailId, null, null);
        return res.status(400).json({
          success: false,
          message: formatBulkImportZeroInsertedMessage(importStats),
          data: {
            insertedCount,
            skippedCount,
            duplicateCount,
            errorCount,
            duplicateControlNumberSamples,
          },
        });
      }

      await client.query('COMMIT');

      for (const event of createdAuditEvents || []) {
        await logAuditEvent(event.action, event.userEmailId, event.formId);
      }

      await logAuditEvent(EXCEL_BULK_RACM_UPLOAD_ACTION, coordinatorEmailId, null, null);

      return res.status(200).json({
        success: true,
        message: formatBulkImportSuccessMessage(insertedCount, {
          duplicateCount,
          skippedCount,
          errorCount,
        }),
        data: {
          insertedCount,
          skippedCount,
          duplicateCount,
          errorCount,
          duplicateControlNumberSamples,
        },
      });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('bulk-import-rows error:', error);
    return res.status(Number(error.statusCode || 500)).json({
      success: false,
      message: error.statusCode ? error.message : 'Error importing RACMs',
      error: error.message,
    });
  }
});

// Get all RACM forms (with optional company_identifier, control_owner, active, business_process, status, financial_year, sub_process, cycle, and unit filters)
router.get('/', verifyAuth, async (req, res) => {
  try {
    console.log('RACM GET request filters:', req.query);
    const result = await getControlFormsForList(req);
    const isPaginated = result && !Array.isArray(result);

    if (isPaginated) {
      return res.status(200).json({
        success: true,
        data: result.rows,
        count: result.total,
        page: result.page,
        page_size: result.page_size,
        summary: result.summary,
      });
    }

    res.status(200).json({
      success: true,
      data: result,
      count: result.length
    });
  } catch (error) {
    console.error('Error fetching RACM records:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching RACM records'
    });
  }
});

router.get('/assignment-eligible', verifyAuth, async (req, res) => {
  try {
    console.log('RACM assignment-eligible GET request filters:', req.query);
    const rows = await getControlFormsForList(req, { assignmentEligibleOnly: true });

    return res.status(200).json({
      success: true,
      data: rows,
      count: rows.length,
    });
  } catch (error) {
    console.error('Error fetching assignment-eligible RACM records:', error);
    return res.status(500).json({
      success: false,
      message: 'Error fetching assignment-eligible RACM records',
    });
  }
});

// Get aggregated RACM stats (without loading full RACM rows)
router.get('/stats', verifyAuth, async (req, res) => {
  try {
    const { company_identifier } = req.query;

    let targetCompanyIdentifier = company_identifier;

    // Company coordinator should only see stats for their own company identifier
    if (req.user.role === 'company_co') {
      targetCompanyIdentifier = req.user.company_identifier;
    }

    let query = `
      SELECT
        COUNT(*)::int AS total_racms,
        COUNT(*) FILTER (
          WHERE LOWER(TRIM(COALESCE(status, ''))) = 'approved'
        )::int AS approved_racms,
        COUNT(*) FILTER (
          WHERE LOWER(TRIM(COALESCE(status, ''))) = 'rejected'
        )::int AS rejected_racms
      FROM control_forms
      WHERE 1=1
    `;
    const params = [];

    if (targetCompanyIdentifier) {
      query += ' AND company_identifier = $1';
      params.push(String(targetCompanyIdentifier).trim());
    }

    const result = await pool.query(query, params);
    const row = result.rows[0] || {};

    return res.status(200).json({
      success: true,
      data: {
        totalRacms: Number(row.total_racms || 0),
        approvedRacms: Number(row.approved_racms || 0),
        rejectedRacms: Number(row.rejected_racms || 0),
      },
    });
  } catch (error) {
    console.error('Error fetching RACM stats:', error);
    return res.status(500).json({
      success: false,
      message: 'Error fetching RACM stats',
    });
  }
});

// Download user uploaded document (for approver) - MUST be before /:form_id route
router.get('/download-document', verifyAuth, async (req, res) => {
  try {
    let { path: filePath } = req.query;

    if (!filePath) {
      return res.status(400).json({
        success: false,
        message: 'File path is required'
      });
    }

    // Decode the file path (in case it was encoded by the frontend)
    try {
      filePath = decodeURIComponent(filePath);
    } catch (decodeError) {
      // If decoding fails, use the original path
      console.warn('[Download Endpoint] Failed to decode file path, using original:', decodeError);
    }

    // Download from S3
    const { downloadFileFromS3 } = require('../utils/s3Upload');
    
    console.log(`[Download Endpoint] Request received - Path (raw): ${req.query.path}`);
    console.log(`[Download Endpoint] Request received - Path (decoded): ${filePath}`);
    
    try {
      console.log(`[Download Endpoint] Starting download from S3: ${filePath}`);
      const fileBuffer = await downloadFileFromS3(filePath);
      
      // Extract filename from S3 key
      const fileName = path.basename(filePath);
      
      console.log(`[Download Endpoint] File downloaded successfully, sending to client`);
      
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${fileName}"`
      );
      res.setHeader('Content-Type', 'application/octet-stream');
      
      res.send(fileBuffer);
    } catch (error) {
      console.error('[Download Endpoint] Error downloading from S3:', error);
      console.error('[Download Endpoint] Error message:', error.message);
      
      // Return 404 if file not found, otherwise 500
      const statusCode = error.message.includes('not found') || error.message.includes('NoSuchKey') ? 404 : 500;
      
      console.error(`[Download Endpoint] Returning status ${statusCode} with error: ${error.message}`);
      
      return res.status(statusCode).json({
        success: false,
        message: 'Error downloading document from S3',
        error: error.message
      });
    }

  } catch (error) {
    console.error('Download error:', error);
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        message: 'Error downloading document'
      });
    }
  }
});

// Get single RACM by form_id
router.get('/:form_id', verifyAuth, async (req, res) => {
  try {
    const { form_id } = req.params;
    const loggedInUserEmail = req.user.email_id;
    const loggedInUserRole = req.user.role;
    
    // SELECT cf.* returns all RACM columns; unit and approver details are joined for display.
    const query = `
      SELECT
        cf.*,
        ${CONTROLS_REMINDER_SELECT_SQL},
        cum.unit_name,
        NULLIF(TRIM(owner.emp_name), '') AS control_owner_name,
        approver_map.approver_email_id AS approver_email_id,
        NULLIF(TRIM(approver.emp_name), '') AS approver_name,
        approver.temp_login AS approver_temp_login,
        NULLIF(TRIM(approver.emp_name), '') AS approver_display_name,
        ${RACM_ASSIGNMENT_COMPUTED_SELECT_SQL}
      FROM control_forms cf
      ${CONTROLS_REMINDER_JOIN_SQL}
      LEFT JOIN company_unit_master cum
        ON cum.unit_id = cf.unit_id
       AND cum.company_identifier = cf.company_identifier
      LEFT JOIN LATERAL (
        SELECT aa.approver_email_id
        FROM approver_assignments aa
        WHERE aa.company_identifier = cf.company_identifier
          AND (
            (aa.assignment_scope = 'RACM' AND aa.form_id = cf.form_id)
            OR (
              aa.assignment_scope = 'BUSINESS_PROCESS'
              AND aa.unit_id = cf.unit_id
              AND LOWER(TRIM(aa.business_process)) = LOWER(TRIM(cf.business_process))
            )
            OR (aa.assignment_scope = 'UNIT' AND aa.unit_id = cf.unit_id)
          )
        ORDER BY
          CASE aa.assignment_scope
            WHEN 'RACM' THEN 1
            WHEN 'BUSINESS_PROCESS' THEN 2
            WHEN 'UNIT' THEN 3
            ELSE 4
          END
        LIMIT 1
      ) approver_map ON TRUE
      LEFT JOIN ifc_users owner
        ON LOWER(TRIM(owner.email_id)) = LOWER(TRIM(cf.control_owner))
      LEFT JOIN ifc_users approver
        ON LOWER(TRIM(approver.email_id)) = LOWER(TRIM(COALESCE(approver_map.approver_email_id, '')))
      WHERE cf.form_id = $1
    `;
    const result = await pool.query(query, [form_id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'RACM not found'
      });
    }
    
    const formData = result.rows[0];
    await attachControlFormDocuments(pool, [formData]);
    formData.deficiency_response = await getDeficiencyResponseByFormId(pool, form_id);
    
    // Authorization check: For users with role 'user', verify they are the control_owner
    // company_co and approver roles can still access (existing behavior)
    if (loggedInUserRole === 'user') {
      const processOwnerEmail = (formData.control_owner || '').trim().toLowerCase();
      const userEmail = loggedInUserEmail.trim().toLowerCase();
      
      if (processOwnerEmail !== userEmail) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. You are not authorized to view this form.'
        });
      }
    }

    if (loggedInUserRole === 'approver') {
      const inactiveMessage = getInactiveRacmApproverAccessError(formData.active);
      if (inactiveMessage) {
        return res.status(403).json({
          success: false,
          message: inactiveMessage,
        });
      }
    }
    
    const dataForClient =
      loggedInUserRole === 'user'
        ? shapeControlFormJsonForProcessOwner(formData)
        : formData;

    if (await isRacmTemplateSchemaReady(pool)) {
      const templateId = dataForClient.template_id;
      if (templateId) {
        const templatePayload = await getTemplateWithFieldsById(pool, templateId);
        if (templatePayload.ok) {
          dataForClient.template = templatePayload.template;
          dataForClient.field_definitions = templatePayload.fields;
        }
      }
      const dynamicPayload = await loadDynamicFieldValuesForForm(pool, form_id);
      dataForClient.dynamic_values = dynamicPayload.dynamic_values;
      dataForClient.dynamic_value_rows = dynamicPayload.dynamic_value_rows;
    }

    res.status(200).json({
      success: true,
      data: dataForClient
    });
  } catch (error) {
    console.error('Error fetching RACM:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching RACM'
    });
  }
});

// Update single control form by form_id
router.put('/:form_id', verifyAuth, async (req, res) => {
  const { form_id } = req.params;
  const {
    standard_control_description, sub_process, risk_description,
    whether_fraud_risks_exist, control_objective, ipe_reference,
    nature_of_control, control_frequency,
    control_number, area,
    risk_heat, process_walkthrough, control_relies_on_ipe,
    audit_evidence_accuracy, key_control, application_name,
    control_performer, control_owner, control_design_procs,
    control_design_conclusion, design_deficiency_desc,
    control_type_fo, control_type_ma,
    due_date, reminder_frequency,
    sample_size,
    dynamic_values,
    doc_uploaded_by_user, doc_uploaded_by_user_docs, replace_user_documents, active, status, reason_by_approver, remarks_by_user,
    modifiedFields,
    modifiedChanges
  } = req.body;

  const normalizedFormId = String(form_id || '').trim();
  const currentForm = await prisma.controlForm.findUnique({
    where: { formId: normalizedFormId },
  });
  if (!currentForm) {
    return res.status(404).json({ success: false, message: 'RACM not found' });
  }

  const isCoordinatorAssigned = Boolean(currentForm.assignedToCoordinator);

  const currentActiveStatus = Boolean(currentForm.active);
  const hasChangesArray = Array.isArray(modifiedChanges) && modifiedChanges.length > 0;
  const hasFieldsArray = Array.isArray(modifiedFields) && modifiedFields.length > 0;
  const assignmentEmail = control_owner !== undefined && control_owner !== null ? String(control_owner).trim() : '';
  const normalizeAssignmentEmail = (value) => value == null ? '' : String(value).trim().toLowerCase();
  const currentAssignmentEmail = normalizeAssignmentEmail(currentForm.controlOwner);
  const nextAssignmentEmail = normalizeAssignmentEmail(control_owner);
  const assignmentInChangesArray = hasChangesArray && modifiedChanges.some((item) => {
    const col = item?.column_name || item?.column || item?.field;
    return String(col || '').trim() === 'control_owner';
  });
  const assignmentInFieldsArray = hasFieldsArray && modifiedFields.some((col) => String(col || '').trim() === 'control_owner');
  const isControlOwnerChanged = control_owner !== undefined && nextAssignmentEmail !== '' && nextAssignmentEmail !== currentAssignmentEmail;
  const isAssignmentUpdate = Boolean((assignmentInChangesArray || assignmentInFieldsArray || control_owner !== undefined) && isControlOwnerChanged);
  const isRacmAssignmentOperation = Boolean(isAssignmentUpdate && assignmentEmail);

  if (isRacmAssignmentOperation && isCoordinatorAssigned) {
    return res.status(400).json({
      success: false,
      message: 'Cannot assign a process owner to a coordinator-assigned RACM.',
    });
  }

  if (control_owner !== undefined && isCoordinatorAssigned && nextAssignmentEmail !== currentAssignmentEmail) {
    return res.status(400).json({
      success: false,
      message: 'Process owner cannot be changed on a coordinator-assigned RACM.',
    });
  }

  const normalizeDateOnly = (value) => {
    if (value == null) return '';
    const raw = String(value).trim();
    if (!raw) return '';
    return raw.length >= 10 ? raw.slice(0, 10) : raw;
  };
  const normalizeReminderFrequency = (value) => value == null ? '' : String(value).trim().toLowerCase();
  const dueDateChanged = due_date !== undefined && normalizeDateOnly(due_date) !== normalizeDateOnly(currentForm.dueDate);
  const reminderFrequencyChanged = reminder_frequency !== undefined
    && normalizeReminderFrequency(reminder_frequency) !== normalizeReminderFrequency(currentForm.reminderFrequency);
  const dueDateInChangesArray = hasChangesArray && modifiedChanges.some((item) => {
    const col = item?.column_name || item?.column || item?.field;
    return String(col || '').trim() === 'due_date';
  });
  const reminderInChangesArray = hasChangesArray && modifiedChanges.some((item) => {
    const col = item?.column_name || item?.column || item?.field;
    return String(col || '').trim() === 'reminder_frequency';
  });
  const dueDateInFieldsArray = hasFieldsArray && modifiedFields.some((col) => String(col || '').trim() === 'due_date');
  const reminderInFieldsArray = hasFieldsArray && modifiedFields.some((col) => String(col || '').trim() === 'reminder_frequency');
  const isReminderSettingsUpdate = Boolean(
    dueDateChanged || reminderFrequencyChanged || dueDateInChangesArray || reminderInChangesArray || dueDateInFieldsArray || reminderInFieldsArray
  );
  if (req.user?.role === 'company_co' && currentActiveStatus && (isRacmAssignmentOperation || isReminderSettingsUpdate)) {
    return res.status(400).json({
      success: false,
      message: isRacmAssignmentOperation
        ? 'RACM assignment cannot be changed once RACM is Active'
        : 'Reminder settings cannot be changed once RACM is Active',
    });
  }

  const racmUnitId = String(currentForm.unitId || '').trim();
  const racmCompanyId = String(currentForm.companyIdentifier || '').trim();

  if (control_owner !== undefined) {
    const ownerValidation = await validateRacmUnitUserAssignment(pool, {
      companyIdentifier: racmCompanyId,
      unitId: racmUnitId,
      email: control_owner,
      fieldLabel: 'Process owner',
      requireUserRole: true,
    });
    if (!ownerValidation.ok) {
      return res.status(400).json({ success: false, message: ownerValidation.message });
    }
  }

  if (control_performer !== undefined) {
    const performerValidation = await validateRacmUnitUserAssignment(pool, {
      companyIdentifier: racmCompanyId,
      unitId: racmUnitId,
      email: control_performer,
      fieldLabel: 'Control performer',
      requireUserRole: true,
    });
    if (!performerValidation.ok) {
      return res.status(400).json({ success: false, message: performerValidation.message });
    }
  }

  const parseDateOnlyInput = (value) => {
    if (value == null) return null;
    const s = String(value).trim();
    if (!s) return null;
    const datePart = s.length >= 10 ? s.slice(0, 10) : s;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(datePart)) return null;
    return new Date(`${datePart}T00:00:00.000Z`);
  };
  const normalizeNullableBoolean = (value) => {
    if (value === undefined) return undefined;
    if (value === null || String(value).trim() === '') return null;
    const normalized = String(value).trim().toLowerCase();
    if (normalized === 'true' || normalized === '1') return true;
    if (normalized === 'false' || normalized === '0') return false;
    return value;
  };
  const normalizeUserDocumentUrl = (value) => {
    if (value && typeof value === 'object') return value.doc_uploaded_by_user == null ? '' : String(value.doc_uploaded_by_user).trim();
    return value == null ? '' : String(value).trim();
  };
  const uploadedUserDocumentUrls = Array.isArray(doc_uploaded_by_user_docs)
    ? [...new Set(doc_uploaded_by_user_docs.map(normalizeUserDocumentUrl).filter(Boolean))]
    : (doc_uploaded_by_user !== undefined && doc_uploaded_by_user !== null ? [normalizeUserDocumentUrl(doc_uploaded_by_user)].filter(Boolean) : []);
  const hasUserDocumentUpload = uploadedUserDocumentUrls.length > 0;

  const isApprover = !!req.cookies.approverAuthToken;
  if (isApprover || req.user?.role === 'approver') {
    const inactiveMessage = getInactiveRacmApproverAccessError(currentForm.active);
    if (inactiveMessage) {
      return res.status(403).json({ success: false, message: inactiveMessage });
    }
  }
  const approverOnlyFields = ['control_design_procs', 'control_design_conclusion', 'design_deficiency_desc'];
  if (!isApprover) {
    const attemptedApproverFields = approverOnlyFields.filter((field) => {
      const v = req.body[field];
      return v !== undefined && v !== null && String(v).trim() !== '';
    });
    if (attemptedApproverFields.length > 0) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to update these fields. Only approvers can update: control_design_procs, control_design_conclusion, design_deficiency_desc'
      });
    }
  }

  const normalizeFrequencyForCompare = (value) =>
    value == null ? '' : String(value).trim().toLowerCase().replace(/&/g, 'and').replace(/[-_]/g, ' ').replace(/\s+/g, ' ');
  const nextControlFrequency = control_frequency !== undefined ? (control_frequency ? String(control_frequency).trim() : null) : undefined;
  const isControlFrequencyChange = control_frequency !== undefined
    && normalizeFrequencyForCompare(nextControlFrequency) !== normalizeFrequencyForCompare(currentForm.controlFrequency);
  const isSampleSizeChange = sample_size !== undefined
    && String(sample_size ?? '').trim() !== String(currentForm.sampleSize ?? '').trim();
  const frequencyForSample = control_frequency !== undefined ? nextControlFrequency : currentForm.controlFrequency;
  const shouldRecalculateSampleFields = isControlFrequencyChange || isSampleSizeChange;

  let sampleSizeForUpdate;
  let sampleRequiredForUpdate;

  if (shouldRecalculateSampleFields) {
    const createdAtForSample = currentForm.createdAt || new Date();
    const resolvedSize = await resolveEffectiveSampleSizeForUnit(pool, {
      companyIdentifier: currentForm.companyIdentifier,
      unitId: currentForm.unitId,
      controlFrequency: frequencyForSample,
      explicitSampleSize: sample_size !== undefined
        ? sample_size
        : (isControlFrequencyChange ? undefined : currentForm.sampleSize),
    });

    if (!resolvedSize.ok) {
      return res.status(400).json({ success: false, message: resolvedSize.message });
    }

    const built = buildSampleSizeForFrequency(
      frequencyForSample,
      createdAtForSample,
      resolvedSize.sampleSize
    );

    if (!built.ok) {
      return res.status(400).json({ success: false, message: built.message });
    }

    sampleSizeForUpdate = String(built.sampleSize);
    sampleRequiredForUpdate = built.sampleRequired;
  }

  const data = {
    standardControlDescription: standard_control_description,
    subProcess: sub_process,
    riskDescription: risk_description,
    whetherFraudRisksExist: whether_fraud_risks_exist,
    controlObjective: control_objective,
    ipeReference: ipe_reference,
    natureOfControl: nature_of_control,
    controlFrequency: control_frequency,
    controlNumber: control_number,
    area,
    riskHeat: risk_heat,
    processWalkthrough: process_walkthrough,
    controlReliesOnIpe: control_relies_on_ipe,
    auditEvidenceAccuracy: audit_evidence_accuracy,
    keyControl: key_control,
    applicationName: application_name,
    controlPerformer: control_performer,
    controlDesignProcs: control_design_procs,
    controlDesignConclusion: control_design_conclusion,
    designDeficiencyDesc: design_deficiency_desc,
    sampleSize: sampleSizeForUpdate,
    sampleRequired: sampleRequiredForUpdate,
    controlTypeFo: control_type_fo,
    controlTypeMa: control_type_ma,
    dueDate: due_date !== undefined ? parseDateOnlyInput(due_date) : undefined,
    reminderFrequency: reminder_frequency,
    status,
    reasonByApprover: reason_by_approver,
    remarksByUser: remarks_by_user,
  };
  if (!isApprover) {
    delete data.controlDesignProcs;
    delete data.controlDesignConclusion;
    delete data.designDeficiencyDesc;
  }
  if (!isRacmAssignmentOperation && control_owner !== undefined && nextAssignmentEmail !== currentAssignmentEmail) {
    data.controlOwner = control_owner;
    data.userMailSent = false;
  }
  if (!(isRacmAssignmentOperation && active !== undefined) && active !== undefined) {
    const normalizedActive = normalizeActiveInput(active);
    data.active = normalizedActive;
    if (normalizedActive !== currentActiveStatus) {
      data.userMailSent = false;
      if (currentActiveStatus === true && normalizedActive === false) {
        if (String(currentForm.controlOwner || '').trim()) {
          data.inactiveMailPending = true;
        }
      } else if (normalizedActive === true) {
        data.inactiveMailPending = false;
      }
    }
  }
  if (status === 'sent for approval' && currentForm.status === 'Rejected' && String(currentForm.reasonByApprover || '').trim() !== '') {
    data.reasonByApprover = null;
  }
  const wasSentForApproval = String(currentForm?.status || '').trim().toLowerCase() === 'sent for approval';
  const isNowSentForApprovalRequest = status !== undefined
    && String(status || '').trim().toLowerCase() === 'sent for approval';
  if (isNowSentForApprovalRequest && Boolean(currentForm.pendingChanges)) {
    return res.status(400).json({
      success: false,
      message: 'This RACM has a pending change request and cannot be sent for approval until it is resolved.',
    });
  }

  if (isNowSentForApprovalRequest && !currentActiveStatus) {
    return res.status(400).json({
      success: false,
      message: 'Inactive RACMs cannot be sent for approval.',
    });
  }

  if (isNowSentForApprovalRequest && req.user?.role === 'company_co') {
    if (!isCoordinatorAssigned) {
      return res.status(403).json({
        success: false,
        message: 'Only coordinator-assigned RACMs can be submitted from the coordinator form.',
      });
    }

    const coordinatorAccess = await assertCoordinatorAssignedRacmAccess({
      assigned_to_coordinator: currentForm.assignedToCoordinator,
      company_identifier: currentForm.companyIdentifier,
      unit_id: currentForm.unitId,
    }, req.user);
    if (!coordinatorAccess.ok) {
      return res.status(coordinatorAccess.status).json({
        success: false,
        message: coordinatorAccess.message,
      });
    }
    const coordinatorBlockMessage = getCoordinatorSubmissionBlockMessage({ status: currentForm.status });
    if (coordinatorBlockMessage) {
      return res.status(400).json({ success: false, message: coordinatorBlockMessage });
    }
    if (!hasUserDocumentUpload) {
      const existingDocCount = await prisma.racmDoc.count({ where: { formId: normalizedFormId } });
      if (existingDocCount === 0) {
        return res.status(400).json({
          success: false,
          message: 'Please upload at least one document before sending for approval',
        });
      }
    }
    const approverBlockMessage = getApproverSubmissionBlockMessage(
      await getControlFormApproverDetails(pool, normalizedFormId)
    );
    if (approverBlockMessage) {
      return res.status(400).json({ success: false, message: approverBlockMessage });
    }
  }

  if (isNowSentForApprovalRequest && !wasSentForApproval) {
    data.sentForApprovalTimestamp = new Date();
  }
  const cleanedUpdateData = Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined));
  const hasDynamicValuesUpdate = dynamic_values !== undefined && typeof dynamic_values === 'object';
  if (Object.keys(cleanedUpdateData).length === 0 && !isRacmAssignmentOperation && active === undefined && !hasUserDocumentUpload && !hasDynamicValuesUpdate) {
    return res.status(400).json({ success: false, message: 'No fields to update' });
  }

  try {
    if (control_number !== undefined) {
      const cid = currentForm.companyIdentifier ? String(currentForm.companyIdentifier).trim() : '';
      const nextCn = control_number != null ? String(control_number).trim() : '';
      if (cid && nextCn) {
        const dup = await prisma.controlForm.findFirst({
          where: { companyIdentifier: cid, controlNumber: nextCn, NOT: { formId: normalizedFormId } },
          select: { id: true },
        });
        if (dup) {
          return res.status(409).json({ success: false, message: DUPLICATE_RACM_COMPANY_SCOPED_MESSAGE });
        }
      }
    }

    await prisma.$transaction(async (tx) => {
      // Seed approver reminder timestamp before status changes (same transaction).
      if (isNowSentForApprovalRequest && !wasSentForApproval) {
        await seedReminderToApproverDatetime(tx, normalizedFormId);
      }

      if (Object.keys(cleanedUpdateData).length > 0) {
        await tx.controlForm.update({
          where: { formId: normalizedFormId },
          data: cleanedUpdateData,
        });
      }

      if (isRacmAssignmentOperation) {
        await tx.controlForm.update({
          where: { formId: normalizedFormId },
          data: { controlOwner: assignmentEmail, userMailSent: false },
        });
        if (active !== undefined) {
          const normalizedActive = normalizeActiveInput(active);
          if (normalizedActive !== currentActiveStatus) {
            const assignmentActiveData = { active: normalizedActive, userMailSent: false };
            if (currentActiveStatus === true && normalizedActive === false) {
              if (String(currentForm.controlOwner || assignmentEmail || '').trim()) {
                assignmentActiveData.inactiveMailPending = true;
              }
            } else if (normalizedActive === true) {
              assignmentActiveData.inactiveMailPending = false;
            }
            await tx.controlForm.update({
              where: { formId: normalizedFormId },
              data: assignmentActiveData,
            });
          }
        }
      }

      if (replace_user_documents === true) {
        const existing = await tx.racmDoc.findMany({
          where: { formId: normalizedFormId },
          select: { docUploadedByUser: true, userId: true },
        });
        const replacementDocSet = new Set(uploadedUserDocumentUrls);
        const existingUploaderByDocUrl = new Map(
          existing
            .map((row) => {
              const docUrl = row.docUploadedByUser == null ? '' : String(row.docUploadedByUser).trim();
              const userId = row.userId == null ? '' : String(row.userId).trim();
              return [docUrl, userId || null];
            })
            .filter(([docUrl]) => Boolean(docUrl))
        );
        const docsToDeleteFromS3 = existing
          .map((row) => row.docUploadedByUser == null ? '' : String(row.docUploadedByUser).trim())
          .filter((docUrl) => docUrl && !replacementDocSet.has(docUrl));
        for (const docUrl of docsToDeleteFromS3) {
          await deleteFileFromS3(docUrl);
        }
        await tx.racmDoc.deleteMany({ where: { formId: normalizedFormId } });
        for (const userDocUrl of uploadedUserDocumentUrls) {
          await tx.racmDoc.create({
            data: {
              formId: normalizedFormId,
              docUploadedByUser: userDocUrl,
              userId: existingUploaderByDocUrl.get(userDocUrl) || req.user?.email_id || null,
            },
          });
        }
      } else {
        for (const userDocUrl of uploadedUserDocumentUrls) {
          await tx.racmDoc.create({
            data: {
              formId: normalizedFormId,
              docUploadedByUser: userDocUrl,
              userId: req.user?.email_id || null,
            },
          });
        }
      }
    });

    if (hasDynamicValuesUpdate && await isRacmTemplateSchemaReady(pool)) {
      const templateId = currentForm.templateId;
      if (templateId) {
        const templateDetails = await getTemplateWithFieldsById(pool, templateId);
        if (templateDetails.ok) {
          const dynamicValidation = validateDynamicValuesAgainstTemplate(
            templateDetails.extra_fields || [],
            dynamic_values
          );
          if (!dynamicValidation.ok) {
            return res.status(400).json({ success: false, message: dynamicValidation.message });
          }
          const saveDynamicResult = await saveDynamicFieldValues(
            pool,
            normalizedFormId,
            templateId,
            dynamicValidation.dynamicValues
          );
          if (!saveDynamicResult.ok) {
            return res.status(400).json({ success: false, message: saveDynamicResult.message });
          }
        }
      }
    }

    if (status === 'sent for approval' && req.user && req.user.email_id) {
      await logAuditEvent('Sent RACM for approval', req.user.email_id, form_id, null);
    }
    if (req.user && req.user.email_id) {
      if (isRacmAssignmentOperation) {
        await logAuditEvent('RACM Assignment', req.user.email_id, form_id, assignmentEmail);
      }
      if (hasChangesArray) {
        const nonAssignmentChanges = modifiedChanges.filter((item) => {
          const col = item?.column_name || item?.column || item?.field;
          const normalizedCol = String(col || '').trim();
          return normalizedCol !== 'control_owner' && normalizedCol !== 'due_date' && normalizedCol !== 'reminder_frequency';
        });
        if (nonAssignmentChanges.length > 0) {
          await logAuditEvent('RACM Modification', req.user.email_id, form_id, JSON.stringify(nonAssignmentChanges));
        }
      } else if (hasFieldsArray) {
        const nonAssignmentFields = modifiedFields.filter((col) => {
          const normalizedCol = String(col || '').trim();
          return normalizedCol !== 'control_owner' && normalizedCol !== 'due_date' && normalizedCol !== 'reminder_frequency';
        });
        if (nonAssignmentFields.length > 0) {
          await logAuditEvent('RACM Modification', req.user.email_id, form_id, JSON.stringify(nonAssignmentFields.map((col) => ({ column_name: col }))));
        }
      }
    }
    if (!isRacmAssignmentOperation && active !== undefined && req.user && req.user.email_id) {
      const newActiveStatus = normalizeActiveInput(active);
      if (newActiveStatus !== currentActiveStatus) {
        await logAuditEvent(newActiveStatus === true ? 'Set RACM Active' : 'Set RACM Inactive', req.user.email_id, form_id);
      }
    }

    const form = await prisma.controlForm.findUnique({
      where: { formId: normalizedFormId },
      include: { controlsReminder: true },
    });
    if (!form) {
      return res.status(404).json({ success: false, message: 'RACM not found' });
    }
    const reminderFields = mapControlsReminderToApi(form.controlsReminder);
    const sampleDocs = await prisma.sampleDoc.findMany({ where: { formId: normalizedFormId }, orderBy: { id: 'asc' } });
    const userDocs = await prisma.racmDoc.findMany({ where: { formId: normalizedFormId }, orderBy: { id: 'asc' } });
    const updatedRow = {
      id: form.id,
      standard_control_description: form.standardControlDescription,
      sub_process: form.subProcess,
      risk_description: form.riskDescription,
      whether_fraud_risks_exist: form.whetherFraudRisksExist,
      control_objective: form.controlObjective,
      ipe_reference: form.ipeReference,
      nature_of_control: form.natureOfControl,
      control_frequency: form.controlFrequency,
      active: form.active,
      status: form.status,
      reason_by_approver: form.reasonByApprover,
      created_at: form.createdAt,
      updated_at: form.updatedAt,
      company_identifier: form.companyIdentifier,
      form_id: form.formId,
      unit_id: form.unitId,
      remarks_by_user: form.remarksByUser,
      business_process: form.businessProcess,
      financial_year: form.financialYear,
      sample_required: form.sampleRequired,
      control_number: form.controlNumber,
      area: form.area,
      risk_heat: form.riskHeat,
      process_walkthrough: form.processWalkthrough,
      control_relies_on_ipe: form.controlReliesOnIpe,
      audit_evidence_accuracy: form.auditEvidenceAccuracy,
      key_control: form.keyControl,
      application_name: form.applicationName,
      control_performer: form.controlPerformer,
      control_owner: form.controlOwner,
      control_design_procs: form.controlDesignProcs,
      control_design_conclusion: form.controlDesignConclusion,
      design_deficiency_desc: form.designDeficiencyDesc,
      sample_size: form.sampleSize,
      control_type_fo: form.controlTypeFo,
      control_type_ma: form.controlTypeMa,
      due_date: form.dueDate,
      reminder_frequency: form.reminderFrequency,
      assigned_to_coordinator: form.assignedToCoordinator,
      coordinator_assigned_by: form.coordinatorAssignedBy,
      coordinator_assigned_at: form.coordinatorAssignedAt,
      template_id: form.templateId,
      ...reminderFields,
      sent_for_approval_timestamp: form.sentForApprovalTimestamp,
      approval_status_change_timestamp: form.approvalStatusChangeTs,
      user_mail_sent: form.userMailSent,
      sample_docs: sampleDocs.map((d) => ({
        id: d.id,
        form_id: d.formId,
        sample_doc: d.sampleDoc,
        user_id: d.userId,
        created_at: d.createdAt,
      })),
      doc_uploaded_by_user_docs: userDocs.map((d) => ({ id: d.id, form_id: d.formId, doc_uploaded_by_user: d.docUploadedByUser, user_id: d.userId, created_at: d.createdAt })),
      sample_doc: sampleDocs.length > 0 ? sampleDocs[sampleDocs.length - 1].sampleDoc : null,
      doc_uploaded_by_user: userDocs.length > 0 ? userDocs[userDocs.length - 1].docUploadedByUser : null,
    };

    const isNowSentForApproval = String(updatedRow?.status || '').trim().toLowerCase() === 'sent for approval';
    if (isNowSentForApproval && !wasSentForApproval && (req.user?.role === 'user' || (req.user?.role === 'company_co' && isCoordinatorAssigned))) {
      try {
        const resolvedApprover = await resolveApproverForRacm(pool, {
          companyIdentifier: updatedRow.company_identifier,
          unitId: updatedRow.unit_id,
          businessProcess: updatedRow.business_process,
          formId: updatedRow.form_id,
        });
        const approverEmail = String(resolvedApprover?.approver_email_id || '').trim();
        if (approverEmail) {
          const [approverUser, submitterUser, company] = await Promise.all([
            prisma.ifcUser.findFirst({
              where: { emailId: { equals: approverEmail, mode: 'insensitive' } },
              select: { empName: true },
            }),
            prisma.ifcUser.findFirst({
              where: { emailId: { equals: req.user.email_id, mode: 'insensitive' } },
              select: { empName: true, emailId: true },
            }),
            updatedRow.company_identifier
              ? prisma.company.findUnique({
                  where: { companyIdentifier: updatedRow.company_identifier },
                  select: { companyName: true },
                })
              : Promise.resolve(null),
          ]);
          const submitterName = String(submitterUser?.empName || submitterUser?.emailId || req.user.email_id || '').trim();
          const payload = buildSentForApprovalEmail({
            approverName: approverUser?.empName,
            userDisplayName: submitterName,
            formId: updatedRow.form_id,
            businessProcess: updatedRow.business_process,
            financialYear: updatedRow.financial_year,
            standardControlDescription: updatedRow.standard_control_description,
            subProcess: updatedRow.sub_process,
            dueDate: updatedRow.due_date,
            companyName: company?.companyName,
          });
          const [communicationMatrixCcEmails, coordinatorEmail] = await Promise.all([
            getCcEmailsForRacm({
              companyIdentifier: updatedRow.company_identifier,
              businessProcess: updatedRow.business_process,
              unitId: updatedRow.unit_id,
              excludeEmail: approverEmail,
            }),
            getCoordinatorEmailForUnit(updatedRow.company_identifier, updatedRow.unit_id),
          ]);
          const ccEmails = Array.from(
            new Set(
              [
                ...communicationMatrixCcEmails,
                coordinatorEmail,
              ]
                .map((email) => String(email || '').trim().toLowerCase())
                .filter((email) => email && email !== String(approverEmail || '').trim().toLowerCase())
            )
          );
          await sendEmail(approverEmail, payload.subject, payload.text, { cc: ccEmails });
        }
      } catch (notifyError) {
        console.error('Error sending sent-for-approval approver email:', notifyError);
      }
    }

    updatedRow.deficiency_response = await getDeficiencyResponseByFormId(pool, form_id);
    if (await isRacmTemplateSchemaReady(pool)) {
      const templateId = updatedRow.template_id || form.templateId;
      if (templateId) {
        const templatePayload = await getTemplateWithFieldsById(pool, templateId);
        if (templatePayload.ok) {
          updatedRow.template = templatePayload.template;
          updatedRow.field_definitions = templatePayload.fields;
        }
      }
      const dynamicPayload = await loadDynamicFieldValuesForForm(pool, normalizedFormId);
      updatedRow.dynamic_values = dynamicPayload.dynamic_values;
      updatedRow.dynamic_value_rows = dynamicPayload.dynamic_value_rows;
    }
    const dataForClient = req.user.role === 'user' ? shapeControlFormJsonForProcessOwner(updatedRow) : updatedRow;
    res.status(200).json({ success: true, message: 'RACM updated successfully', data: dataForClient });
  } catch (error) {
    console.error('Error updating RACM:', error);
    res.status(500).json({ success: false, message: 'Error updating RACM', error: error.message });
  }
});

router.post('/:form_id/deficiency-response', verifyAuth, async (req, res) => {
  const normalizedFormId = String(req.params.form_id || '').trim();
  const responseType = String(req.body?.response_type || '').trim();
  const explaination = req.body?.explaination;
  const dueDate = req.body?.due_date;
  const concernedPerson = req.body?.concerned_person;
  const attachments = Array.isArray(req.body?.attachments) ? req.body.attachments : [];
  const submittedByEmail = String(req.user?.email_id || '').trim();

  if (!normalizedFormId) {
    return res.status(400).json({ success: false, message: 'Form id is required' });
  }

  if (!['mitigation_plan', 'compensatory_racm'].includes(responseType)) {
    return res.status(400).json({ success: false, message: 'response_type must be either mitigation_plan or compensatory_racm' });
  }

  if (!String(explaination || '').trim()) {
    return res.status(400).json({ success: false, message: 'Explaination is required' });
  }

  if (responseType === 'mitigation_plan') {
    if (!String(concernedPerson || '').trim()) {
      return res.status(400).json({ success: false, message: 'Concerned Person is required for mitigation plan' });
    }
    if (!String(dueDate || '').trim()) {
      return res.status(400).json({ success: false, message: 'Due date is required for mitigation plan' });
    }
  }

  if (responseType === 'compensatory_racm' && attachments.length === 0) {
    return res.status(400).json({ success: false, message: 'Please upload at least one document for compensatory RACM' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const authorized = await getAuthorizedControlFormForDeficiency(client, normalizedFormId, req.user);
    if (authorized.error) {
      await client.query('ROLLBACK');
      return res.status(authorized.error.status).json({ success: false, message: authorized.error.message });
    }

    const currentForm = authorized.form;
    if (!currentForm.deficiency_action_status) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: 'Deficiency response can only be submitted when action is required for this RACM',
      });
    }

    const currentDeficiencyResponse = await getDeficiencyResponseByFormId(client, normalizedFormId);
    if (currentDeficiencyResponse && currentDeficiencyResponse.status === 'submitted') {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: 'A deficiency response is already submitted and pending approver review',
      });
    }

    if (currentDeficiencyResponse && !isDeficiencyResponseEditable(currentDeficiencyResponse.status)) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: 'Deficiency response cannot be updated in its current status',
      });
    }

    const saved = await createOrResubmitDeficiencyResponse(client, {
      formId: normalizedFormId,
      companyIdentifier: currentForm.company_identifier,
      unitId: currentForm.unit_id,
      responseType,
      explaination,
      dueDate: responseType === 'mitigation_plan' ? dueDate : null,
      concernedPerson: responseType === 'mitigation_plan' ? concernedPerson : null,
      submittedByEmail,
      attachments,
    });

    await client.query(
      `
        UPDATE control_forms
        SET deficiency_action_status = FALSE,
            deficiency_response_status = 'submitted_for_review',
            deficiency_case_id = $2,
            updated_at = CURRENT_TIMESTAMP
        WHERE form_id = $1
      `,
      [normalizedFormId, saved.response_id]
    );

    await client.query('COMMIT');

    await logAuditEvent(
      'Deficiency Response Submitted',
      submittedByEmail,
      normalizedFormId,
      `Version ${saved.version_no}`
    );

    const formResult = await pool.query(
      `
        SELECT
          cf.*,
          ${CONTROLS_REMINDER_SELECT_SQL},
          cum.unit_name,
          NULLIF(TRIM(owner.emp_name), '') AS control_owner_name,
          approver_map.approver_email_id AS approver_email_id,
          NULLIF(TRIM(approver.emp_name), '') AS approver_name,
          approver.temp_login AS approver_temp_login,
          COALESCE(NULLIF(TRIM(approver.emp_name), ''), NULLIF(TRIM(approver_map.approver_email_id), '')) AS approver_display_name
        FROM control_forms cf
        ${CONTROLS_REMINDER_JOIN_SQL}
        LEFT JOIN company_unit_master cum
          ON cum.unit_id = cf.unit_id
         AND cum.company_identifier = cf.company_identifier
        LEFT JOIN LATERAL (
          SELECT aa.approver_email_id
          FROM approver_assignments aa
          WHERE aa.company_identifier = cf.company_identifier
            AND (
              (aa.assignment_scope = 'RACM' AND aa.form_id = cf.form_id)
              OR (
                aa.assignment_scope = 'BUSINESS_PROCESS'
                AND aa.unit_id = cf.unit_id
                AND LOWER(TRIM(aa.business_process)) = LOWER(TRIM(cf.business_process))
              )
              OR (aa.assignment_scope = 'UNIT' AND aa.unit_id = cf.unit_id)
            )
          ORDER BY
            CASE aa.assignment_scope
              WHEN 'RACM' THEN 1
              WHEN 'BUSINESS_PROCESS' THEN 2
              WHEN 'UNIT' THEN 3
              ELSE 4
            END
          LIMIT 1
        ) approver_map ON TRUE
        LEFT JOIN ifc_users owner
          ON LOWER(TRIM(owner.email_id)) = LOWER(TRIM(cf.control_owner))
        LEFT JOIN ifc_users approver
          ON LOWER(TRIM(approver.email_id)) = LOWER(TRIM(COALESCE(approver_map.approver_email_id, '')))
        WHERE cf.form_id = $1
      `,
      [normalizedFormId]
    );

    const updatedForm = formResult.rows[0];
    await attachControlFormDocuments(pool, [updatedForm]);
    updatedForm.deficiency_response = await getDeficiencyResponseByFormId(pool, normalizedFormId);
    try {
      await notifyDeficiencyResponseSubmitted({
        form: updatedForm,
        deficiencyResponse: updatedForm.deficiency_response,
      });
    } catch (notifyError) {
      console.error('Error sending deficiency response submitted email:', notifyError);
    }
    const dataForClient = req.user.role === 'user' ? shapeControlFormJsonForProcessOwner(updatedForm) : updatedForm;

    return res.status(200).json({
      success: true,
      message: currentDeficiencyResponse ? 'Deficiency response resubmitted successfully' : 'Deficiency response submitted successfully',
      data: dataForClient,
    });
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackError) {
      console.error('Deficiency response rollback error:', rollbackError);
    }
    console.error('Deficiency response submit error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to submit deficiency response',
      error: error.message,
    });
  } finally {
    client.release();
  }
});

router.post(
  '/:form_id/deficiency-response/upload-attachments',
  verifyAuth,
  handleDeficiencyResponseUpload,
  async (req, res) => {
    const normalizedFormId = String(req.params.form_id || '').trim();
    const responseType = String(req.body?.response_type || '').trim();
    const files = [
      ...((req.files && req.files.documents) || []),
      ...((req.files && req.files.document) || []),
    ];

    if (!normalizedFormId) {
      return res.status(400).json({ success: false, message: 'Form id is required' });
    }

    if (files.length === 0) {
      return res.status(400).json({ success: false, message: 'No files uploaded' });
    }

    if (!['mitigation_plan', 'compensatory_racm'].includes(responseType)) {
      return res.status(400).json({
        success: false,
        message: 'response_type must be either mitigation_plan or compensatory_racm',
      });
    }

    try {
      const authorized = await getAuthorizedControlFormForDeficiency(pool, normalizedFormId, req.user);
      if (authorized.error) {
        return res.status(authorized.error.status).json({ success: false, message: authorized.error.message });
      }

      if (!authorized.form.deficiency_action_status) {
        return res.status(400).json({
          success: false,
          message: 'Deficiency response attachment upload is allowed only when action is required for this RACM',
        });
      }

      const docContext = await getControlFormUserDocumentContext(pool, normalizedFormId);
      if (!docContext) {
        return res.status(404).json({
          success: false,
          message: 'RACM not found',
        });
      }

      const deficiencyResponseFolderPath = buildDeficiencyResponseS3FolderPath({
        companyName: docContext.company_name,
        unitName: docContext.unit_name,
        businessProcess: docContext.business_process,
        formId: docContext.form_id,
      }, responseType);

      const uploadedFiles = [];
      for (const file of files) {
        const s3Key = await uploadFileToS3(
          file.buffer,
          file.originalname,
          deficiencyResponseFolderPath,
          { preserveFileName: true }
        );
        uploadedFiles.push({
          file_url: s3Key,
          original_name: file.originalname,
        });
      }

      return res.status(200).json({
        success: true,
        message: uploadedFiles.length === 1 ? 'Attachment uploaded successfully' : 'Attachments uploaded successfully',
        data: {
          form_id: normalizedFormId,
          attachments: uploadedFiles,
        },
      });
    } catch (error) {
      console.error('Deficiency response attachment upload error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to upload deficiency response attachment',
        error: error.message,
      });
    }
  }
);

router.post('/:form_id/request-change', verifyAuth, async (req, res) => {
  const normalizedFormId = String(req.params.form_id || '').trim();
  const requesterEmail = String(req.user?.email_id || '').trim();
  const requesterRole = String(req.user?.role || '').trim().toLowerCase();
  const submittedChanges = Array.isArray(req.body?.changes) ? req.body.changes : [];
  const requestReason = req.body?.request_reason == null ? null : String(req.body.request_reason).trim() || null;

  if (requesterRole !== 'user') {
    return res.status(403).json({
      success: false,
      message: 'Only process owners can request RACM changes',
    });
  }

  if (!normalizedFormId) {
    return res.status(400).json({
      success: false,
      message: 'Form id is required',
    });
  }

  if (submittedChanges.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'No change items were provided',
    });
  }

  const client = await connectPgClient();
  let dbError;
  try {
    await client.query('BEGIN');

    const formResult = await client.query(
      `
        SELECT *
        FROM control_forms
        WHERE form_id = $1
        FOR UPDATE
      `,
      [normalizedFormId]
    );

    if (formResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        message: 'RACM not found',
      });
    }

    const currentForm = formResult.rows[0];

    if (isCoordinatorAssignedRacm(currentForm)) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: 'Change requests are not available for coordinator-assigned RACMs.',
      });
    }

    const processOwnerEmail = String(currentForm.control_owner || '').trim().toLowerCase();
    if (processOwnerEmail !== requesterEmail.toLowerCase()) {
      await client.query('ROLLBACK');
      return res.status(403).json({
        success: false,
        message: 'Access denied. You are not authorized to request changes for this RACM.',
      });
    }

    if (Boolean(currentForm.pending_changes)) {
      await client.query('ROLLBACK');
      return res.status(409).json({
        success: false,
        message: 'A change request is already pending for this RACM',
      });
    }

    const currentStatus = String(currentForm.status || '').trim().toLowerCase();
    if (currentStatus === 'sent for approval' || currentStatus === 'approved') {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: 'Change requests cannot be submitted for RACMs that are already under approval or approved',
      });
    }

    const sanitizedItems = [];
    const seenFields = new Set();
    const templateId = currentForm.template_id;
    const templateSchemaReady = await isRacmTemplateSchemaReady(client);
    const { extraFieldByKey, dynamicValues } = templateSchemaReady && templateId
      ? await loadRequestChangeExtraFieldContext(client, templateId, normalizedFormId)
      : { extraFieldByKey: new Map(), dynamicValues: {} };

    for (let index = 0; index < submittedChanges.length; index++) {
      const rawItem = submittedChanges[index] || {};
      const fieldDbName = String(rawItem.field_db_name || '').trim();
      const fieldKind = resolveRequestChangeFieldKind(fieldDbName, extraFieldByKey);
      if (!fieldKind) {
        continue;
      }
      if (seenFields.has(fieldDbName)) {
        continue;
      }
      seenFields.add(fieldDbName);

      let oldValueText;
      let newValueText;
      let fieldLabel;

      if (fieldKind === 'dynamic') {
        const extraField = extraFieldByKey.get(fieldDbName);
        oldValueText = normalizeChangeRequestTextValue(fieldDbName, dynamicValues[fieldDbName]);
        newValueText = normalizeChangeRequestTextValue(fieldDbName, rawItem.new_value_text);
        fieldLabel = getRequestChangeFieldLabel(fieldDbName, rawItem.field_label || extraField?.label);
      } else {
        oldValueText = normalizeChangeRequestTextValue(fieldDbName, currentForm[fieldDbName]);
        newValueText = normalizeChangeRequestTextValue(fieldDbName, rawItem.new_value_text);
        fieldLabel = getRequestChangeFieldLabel(fieldDbName, rawItem.field_label);
      }

      if (oldValueText === newValueText) {
        continue;
      }

      sanitizedItems.push({
        fieldDbName,
        fieldLabel,
        oldValueText,
        newValueText,
        displayOrder: Number.isInteger(rawItem.display_order) ? rawItem.display_order : index,
      });
    }

    if (sanitizedItems.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: 'No valid field changes detected',
      });
    }

    const requestId = generateChangeRequestId();
    const insertRequestResult = await client.query(
      `
        INSERT INTO change_request (
          request_id,
          form_id,
          company_identifier,
          unit_id,
          requested_by_email,
          requested_at,
          status,
          request_reason,
          created_at,
          updated_at
        )
        VALUES (
          $1,
          $2,
          $3,
          $4,
          $5,
          CURRENT_TIMESTAMP AT TIME ZONE 'UTC',
          'Review Pending',
          $6,
          CURRENT_TIMESTAMP AT TIME ZONE 'UTC',
          CURRENT_TIMESTAMP AT TIME ZONE 'UTC'
        )
        RETURNING id, request_id, status, requested_at, request_reason
      `,
      [
        requestId,
        normalizedFormId,
        currentForm.company_identifier,
        currentForm.unit_id,
        requesterEmail,
        requestReason,
      ]
    );

    const insertedRequest = insertRequestResult.rows[0];

    for (const item of sanitizedItems) {
      await client.query(
        `
          INSERT INTO change_request_item (
            change_request_id,
            field_db_name,
            field_label,
            old_value_text,
            new_value_text,
            status,
            rejection_reason,
            display_order,
            created_at,
            updated_at
          )
          VALUES (
            $1,
            $2,
            $3,
            $4,
            $5,
            'Pending',
            NULL,
            $6,
            CURRENT_TIMESTAMP AT TIME ZONE 'UTC',
            CURRENT_TIMESTAMP AT TIME ZONE 'UTC'
          )
        `,
        [
          insertedRequest.id,
          item.fieldDbName,
          item.fieldLabel,
          item.oldValueText,
          item.newValueText,
          item.displayOrder,
        ]
      );
    }

    await client.query(
      `
        UPDATE control_forms
        SET pending_changes = TRUE,
            updated_at = CURRENT_TIMESTAMP
        WHERE form_id = $1
      `,
      [normalizedFormId]
    );

    await client.query('COMMIT');

    await logAuditEvent(
      'RACM Change Requested',
      requesterEmail,
      normalizedFormId,
      insertedRequest.request_id
    );

    return res.status(201).json({
      success: true,
      message: 'RACM change request submitted successfully',
      data: {
        request_id: insertedRequest.request_id,
        status: insertedRequest.status,
        requested_at: insertedRequest.requested_at,
        request_reason: insertedRequest.request_reason,
        pending_changes: true,
        items: sanitizedItems.map((item) => ({
          field_db_name: item.fieldDbName,
          field_label: item.fieldLabel,
          old_value_text: item.oldValueText,
          new_value_text: item.newValueText,
          display_order: item.displayOrder,
        })),
      },
    });
  } catch (error) {
    dbError = error;
    try {
      await client.query('ROLLBACK');
    } catch (rollbackError) {
      console.error('Request change rollback error:', rollbackError);
    }
    console.error('Request change error:', error);
    return res.status(isPgConnectionError(error) ? 503 : 500).json({
      success: false,
      message: isPgConnectionError(error)
        ? getDatabaseUnavailableMessage()
        : 'Failed to submit RACM change request',
    });
  } finally {
    releasePgClient(client, dbError);
  }
});

router.get('/:form_id/change-request/active', verifyAuth, async (req, res) => {
  const normalizedFormId = String(req.params.form_id || '').trim();
  if (!normalizedFormId) {
    return res.status(400).json({
      success: false,
      message: 'Form id is required',
    });
  }

  try {
    const authResult = await getAuthorizedControlFormForChangeRequest(pool, normalizedFormId, req.user);
    if (authResult.error) {
      return res.status(authResult.error.status).json({
        success: false,
        message: authResult.error.message,
      });
    }

    const requestResult = await pool.query(
      `
        SELECT
          cr.id,
          cr.request_id,
          cr.form_id,
          cr.requested_by_email,
          COALESCE(NULLIF(TRIM(requested_user.emp_name), ''), cr.requested_by_email) AS requested_by_display,
          cr.requested_at,
          cr.status,
          cr.reviewed_by_email,
          cr.reviewed_at,
          COALESCE(NULLIF(TRIM(reviewed_user.emp_name), ''), cr.reviewed_by_email) AS reviewed_by_display,
          cr.request_reason,
          cr.reviewer_comment,
          cr.created_at,
          cr.updated_at
        FROM change_request cr
        LEFT JOIN ifc_users requested_user
          ON LOWER(TRIM(requested_user.email_id)) = LOWER(TRIM(cr.requested_by_email))
        LEFT JOIN ifc_users reviewed_user
          ON LOWER(TRIM(reviewed_user.email_id)) = LOWER(TRIM(cr.reviewed_by_email))
        WHERE cr.form_id = $1
          AND cr.status = 'Review Pending'
        ORDER BY cr.created_at DESC, cr.id DESC
        LIMIT 1
      `,
      [normalizedFormId]
    );

    if (requestResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No active change request found',
      });
    }

    const activeRequest = requestResult.rows[0];
    const itemsResult = await pool.query(
      `
        SELECT
          id,
          change_request_id,
          field_db_name,
          field_label,
          old_value_text,
          new_value_text,
          status,
          rejection_reason,
          display_order,
          created_at,
          updated_at
        FROM change_request_item
        WHERE change_request_id = $1
        ORDER BY display_order ASC, id ASC
      `,
      [activeRequest.id]
    );

    return res.status(200).json({
      success: true,
      data: {
        ...activeRequest,
        items: itemsResult.rows,
      },
    });
  } catch (error) {
    console.error('Get active change request error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch active change request',
    });
  }
});

router.get('/:form_id/change-request/history', verifyAuth, async (req, res) => {
  const normalizedFormId = String(req.params.form_id || '').trim();
  if (!normalizedFormId) {
    return res.status(400).json({
      success: false,
      message: 'Form id is required',
    });
  }

  try {
    const authResult = await getAuthorizedControlFormForChangeRequest(pool, normalizedFormId, req.user);
    if (authResult.error) {
      return res.status(authResult.error.status).json({
        success: false,
        message: authResult.error.message,
      });
    }

    const userRole = String(req.user?.role || '').trim().toLowerCase();
    const userEmail = String(req.user?.email_id || '').trim();
    let filterSql = '';
    const queryParams = [normalizedFormId];

    if (userRole === 'user') {
      filterSql = 'AND LOWER(TRIM(requested_by_email)) = LOWER(TRIM($2))';
      queryParams.push(userEmail);
    } else if (userRole === 'company_co') {
      filterSql = 'AND LOWER(TRIM(COALESCE(reviewed_by_email, \'\'))) = LOWER(TRIM($2))';
      queryParams.push(userEmail);
    }

    const requestsResult = await pool.query(
      `
        SELECT
          cr.id,
          cr.request_id,
          cr.form_id,
          cr.requested_by_email,
          COALESCE(NULLIF(TRIM(requested_user.emp_name), ''), cr.requested_by_email) AS requested_by_display,
          cr.requested_at,
          cr.status,
          cr.reviewed_by_email,
          cr.reviewed_at,
          COALESCE(NULLIF(TRIM(reviewed_user.emp_name), ''), cr.reviewed_by_email) AS reviewed_by_display,
          cr.request_reason,
          cr.reviewer_comment,
          cr.created_at,
          cr.updated_at
        FROM change_request cr
        LEFT JOIN ifc_users requested_user
          ON LOWER(TRIM(requested_user.email_id)) = LOWER(TRIM(cr.requested_by_email))
        LEFT JOIN ifc_users reviewed_user
          ON LOWER(TRIM(reviewed_user.email_id)) = LOWER(TRIM(cr.reviewed_by_email))
        WHERE cr.form_id = $1
          ${filterSql}
        ORDER BY cr.created_at DESC, cr.id DESC
      `,
      queryParams
    );

    const requests = requestsResult.rows;
    if (requests.length === 0) {
      return res.status(200).json({
        success: true,
        data: {
          count: 0,
          requests: [],
        },
      });
    }

    const requestIds = requests.map((row) => row.id);
    const itemsResult = await pool.query(
      `
        SELECT
          id,
          change_request_id,
          field_db_name,
          field_label,
          old_value_text,
          new_value_text,
          status,
          rejection_reason,
          display_order,
          created_at,
          updated_at
        FROM change_request_item
        WHERE change_request_id = ANY($1::bigint[])
        ORDER BY change_request_id ASC, display_order ASC, id ASC
      `,
      [requestIds]
    );

    const itemsByRequestId = new Map();
    for (const item of itemsResult.rows) {
      const key = String(item.change_request_id);
      if (!itemsByRequestId.has(key)) {
        itemsByRequestId.set(key, []);
      }
      itemsByRequestId.get(key).push(item);
    }

    const hydratedRequests = requests.map((request) => ({
      ...request,
      items: itemsByRequestId.get(String(request.id)) || [],
    }));

    return res.status(200).json({
      success: true,
      data: {
        count: hydratedRequests.length,
        requests: hydratedRequests,
      },
    });
  } catch (error) {
    console.error('Get change request history error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch change request history',
    });
  }
});

router.post('/:form_id/change-request/:request_id/review', verifyAuth, async (req, res) => {
  const normalizedFormId = String(req.params.form_id || '').trim();
  const normalizedRequestId = String(req.params.request_id || '').trim();
  const reviewerEmail = String(req.user?.email_id || '').trim();
  const reviewerRole = String(req.user?.role || '').trim().toLowerCase();
  const submittedItems = Array.isArray(req.body?.items) ? req.body.items : [];
  const reviewerComment = req.body?.reviewer_comment == null ? null : String(req.body.reviewer_comment).trim() || null;

  if (reviewerRole !== 'company_co') {
    return res.status(403).json({
      success: false,
      message: 'Only company coordinators can review suggested changes',
    });
  }

  if (!normalizedFormId || !normalizedRequestId) {
    return res.status(400).json({
      success: false,
      message: 'Form id and request id are required',
    });
  }

  if (submittedItems.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'No review decisions were provided',
    });
  }

  const client = await connectPgClient();
  let dbError;
  try {
    await client.query('BEGIN');

    const authResult = await getAuthorizedControlFormForChangeRequest(client, normalizedFormId, req.user);
    if (authResult.error) {
      await client.query('ROLLBACK');
      return res.status(authResult.error.status).json({
        success: false,
        message: authResult.error.message,
      });
    }

    const requestResult = await client.query(
      `
        SELECT id, request_id, status
        FROM change_request
        WHERE form_id = $1
          AND request_id = $2
        FOR UPDATE
      `,
      [normalizedFormId, normalizedRequestId]
    );

    if (requestResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        message: 'Change request not found',
      });
    }

    const activeRequest = requestResult.rows[0];
    if (String(activeRequest.status || '').trim() !== 'Review Pending') {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: 'Only Review Pending change requests can be reviewed',
      });
    }

    const dbItemsResult = await client.query(
      `
        SELECT id, field_db_name, field_label, old_value_text, new_value_text, display_order
        FROM change_request_item
        WHERE change_request_id = $1
        ORDER BY display_order ASC, id ASC
        FOR UPDATE
      `,
      [activeRequest.id]
    );

    const dbItems = dbItemsResult.rows;
    if (dbItems.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: 'No change request items found for review',
      });
    }

    const dbItemsById = new Map(dbItems.map((item) => [String(item.id), item]));
    if (submittedItems.length !== dbItems.length) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: 'Every requested field must be approved or rejected before submitting',
      });
    }

    const approvedItems = [];
    let approvedCount = 0;
    let rejectedCount = 0;

    for (const submittedItem of submittedItems) {
      const itemId = String(submittedItem?.id || '').trim();
      const decision = String(submittedItem?.status || '').trim();
      const dbItem = dbItemsById.get(itemId);

      if (!dbItem) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          success: false,
          message: 'Invalid change request item received',
        });
      }

      if (decision !== 'Approved' && decision !== 'Rejected') {
        await client.query('ROLLBACK');
        return res.status(400).json({
          success: false,
          message: 'Each field must be marked as Approved or Rejected',
        });
      }

      const rejectionReason = submittedItem?.rejection_reason == null
        ? null
        : String(submittedItem.rejection_reason).trim() || null;

      await client.query(
        `
          UPDATE change_request_item
          SET status = $1,
              rejection_reason = $2,
              updated_at = CURRENT_TIMESTAMP AT TIME ZONE 'UTC'
          WHERE id = $3
        `,
        [decision, rejectionReason, dbItem.id]
      );

      if (decision === 'Approved') {
        approvedCount += 1;
        approvedItems.push(dbItem);
      } else {
        rejectedCount += 1;
      }
    }

    let finalStatus = 'Rejected';
    if (approvedCount === dbItems.length) {
      finalStatus = 'Approved';
    } else if (approvedCount > 0 && rejectedCount > 0) {
      finalStatus = 'Partially approved';
    }

    if (approvedItems.length > 0) {
      const formTemplateResult = await client.query(
        `
          SELECT template_id
          FROM control_forms
          WHERE form_id = $1
          LIMIT 1
        `,
        [normalizedFormId]
      );
      const templateId = formTemplateResult.rows[0]?.template_id;
      const templateSchemaReady = await isRacmTemplateSchemaReady(client);
      const { extraFieldByKey } = templateSchemaReady && templateId
        ? await loadRequestChangeExtraFieldContext(client, templateId, normalizedFormId)
        : { extraFieldByKey: new Map() };

      const updateAssignments = [];
      const updateValues = [normalizedFormId];
      const dynamicApprovedChanges = {};
      let paramIndex = 2;

      for (const approvedItem of approvedItems) {
        const fieldName = String(approvedItem.field_db_name || '').trim();
        if (extraFieldByKey.has(fieldName)) {
          dynamicApprovedChanges[fieldName] = approvedItem.new_value_text;
          continue;
        }
        if (!REQUEST_CHANGE_ALLOWED_FIELDS.has(fieldName)) {
          continue;
        }
        const parsedValue = parseApprovedChangeRequestValue(fieldName, approvedItem.new_value_text);
        updateAssignments.push(`${quoteIdentifier(fieldName)} = $${paramIndex}`);
        updateValues.push(parsedValue);
        paramIndex += 1;
      }

      if (updateAssignments.length > 0) {
        updateAssignments.push(`pending_changes = FALSE`, `updated_at = CURRENT_TIMESTAMP`);
        await client.query(
          `
            UPDATE control_forms
            SET ${updateAssignments.join(', ')}
            WHERE form_id = $1
          `,
          updateValues
        );

        const approvedFieldNames = approvedItems.map((item) => String(item.field_db_name || '').trim());
        if (approvedFieldNames.includes('control_frequency') || approvedFieldNames.includes('sample_size')) {
          const formAfterUpdate = await client.query(
            `
              SELECT control_frequency, created_at, company_identifier, unit_id, sample_size
              FROM control_forms
              WHERE form_id = $1
              LIMIT 1
            `,
            [normalizedFormId]
          );
          const formRow = formAfterUpdate.rows[0];
          if (formRow) {
            const resolvedSample = await resolveEffectiveSampleSizeForUnit(client, {
              companyIdentifier: formRow.company_identifier,
              unitId: formRow.unit_id,
              controlFrequency: formRow.control_frequency,
              explicitSampleSize: formRow.sample_size,
            });
            if (resolvedSample.ok) {
              const builtSample = buildSampleSizeForFrequency(
                formRow.control_frequency,
                formRow.created_at || new Date(),
                resolvedSample.sampleSize
              );
              if (builtSample.ok) {
                await client.query(
                  `
                    UPDATE control_forms
                    SET sample_size = $2,
                        sample_required = $3,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE form_id = $1
                  `,
                  [normalizedFormId, String(builtSample.sampleSize), builtSample.sampleRequired]
                );
              }
            }
          }
        }
      } else {
        await client.query(
          `
            UPDATE control_forms
            SET pending_changes = FALSE,
                updated_at = CURRENT_TIMESTAMP
            WHERE form_id = $1
          `,
          [normalizedFormId]
        );
      }

      if (Object.keys(dynamicApprovedChanges).length > 0 && templateId) {
        const applyDynamicResult = await applyApprovedDynamicFieldChanges(
          client,
          normalizedFormId,
          templateId,
          dynamicApprovedChanges
        );
        if (!applyDynamicResult.ok) {
          await client.query('ROLLBACK');
          return res.status(400).json({
            success: false,
            message: applyDynamicResult.message || 'Failed to apply approved custom field changes',
          });
        }
      }
    } else {
      await client.query(
        `
          UPDATE control_forms
          SET pending_changes = FALSE,
              updated_at = CURRENT_TIMESTAMP
          WHERE form_id = $1
        `,
        [normalizedFormId]
      );
    }

    await client.query(
      `
        UPDATE change_request
        SET status = $1,
            reviewed_by_email = $2,
            reviewed_at = CURRENT_TIMESTAMP AT TIME ZONE 'UTC',
            reviewer_comment = $3,
            updated_at = CURRENT_TIMESTAMP AT TIME ZONE 'UTC'
        WHERE id = $4
      `,
      [finalStatus, reviewerEmail, reviewerComment, activeRequest.id]
    );

    await client.query('COMMIT');

    await logAuditEvent(
      'RACM Change Request Reviewed',
      reviewerEmail,
      normalizedFormId,
      normalizedRequestId
    );

    return res.status(200).json({
      success: true,
      message: 'Suggested changes reviewed successfully',
      data: {
        request_id: normalizedRequestId,
        status: finalStatus,
        approved_count: approvedCount,
        rejected_count: rejectedCount,
        pending_changes: false,
      },
    });
  } catch (error) {
    dbError = error;
    try {
      await client.query('ROLLBACK');
    } catch (rollbackError) {
      console.error('Review change request rollback error:', rollbackError);
    }
    console.error('Review change request error:', error);
    return res.status(isPgConnectionError(error) ? 503 : 500).json({
      success: false,
      message: isPgConnectionError(error)
        ? getDatabaseUnavailableMessage()
        : 'Failed to review suggested changes',
    });
  } finally {
    releasePgClient(client, dbError);
  }
});

// Bulk update forms to active based on filters
router.post('/bulk-set-active', verifyAuth, async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const { company_identifier, business_process, active } = req.body;
    
    // Get user's company_identifier if not provided
    let userCompanyIdentifier = company_identifier;
    if (!userCompanyIdentifier) {
      const userEmail = req.user.email_id;
      const getUserQuery = 'SELECT company_identifier FROM ifc_users WHERE email_id = $1';
      const userResult = await client.query(getUserQuery, [userEmail]);
      if (userResult.rows.length > 0 && userResult.rows[0].company_identifier) {
        userCompanyIdentifier = userResult.rows[0].company_identifier;
      }
    }
    
    // Build WHERE clause based on filters
    let query = `UPDATE control_forms
                 SET active = $1,
                     updated_at = CURRENT_TIMESTAMP,
                     user_mail_sent = CASE
                      WHEN $1 = TRUE THEN FALSE
                       ELSE user_mail_sent
                     END
                 WHERE 1=1`;
    const queryParams = [true];
    let paramIndex = 2;
    
    // Filter by company_identifier (required for company_co)
    if (userCompanyIdentifier) {
      query += ` AND company_identifier = $${paramIndex}`;
      queryParams.push(userCompanyIdentifier);
      paramIndex++;
    }
    
    // Filter by business_process if provided
    if (business_process && business_process !== 'all') {
      query += ` AND business_process IS NOT NULL AND LOWER(TRIM(business_process)) = $${paramIndex}`;
      queryParams.push(business_process.trim().toLowerCase());
      paramIndex++;
    }
    
    // Filter by active status if provided (to only update inactive forms, for example)
    if (active !== undefined) {
      const activeFilter = parseActiveFilter(active);
      if (activeFilter === true) {
        query += ` AND active = TRUE`;
      } else if (activeFilter === false) {
        query += ` AND COALESCE(active, FALSE) = FALSE`;
      }
    }
    
    // Get forms that will be updated (before updating) to send emails
    // Build SELECT query with same WHERE conditions but correct parameter indices
    let getFormsQuery = 'SELECT form_id, control_owner, standard_control_description, active, company_identifier, business_process, unit_id FROM control_forms WHERE 1=1';
    const getFormsParams = [];
    let getFormsParamIndex = 1;
    
    // Filter by company_identifier (required for company_co)
    if (userCompanyIdentifier) {
      getFormsQuery += ` AND company_identifier = $${getFormsParamIndex}`;
      getFormsParams.push(userCompanyIdentifier);
      getFormsParamIndex++;
    }
    
    // Filter by business_process if provided
    if (business_process && business_process !== 'all') {
      getFormsQuery += ` AND business_process IS NOT NULL AND LOWER(TRIM(business_process)) = $${getFormsParamIndex}`;
      getFormsParams.push(business_process.trim().toLowerCase());
      getFormsParamIndex++;
    }
    
    // Filter by active status if provided (to only update inactive forms, for example)
    if (active !== undefined) {
      const activeFilter = parseActiveFilter(active);
      if (activeFilter === true) {
        getFormsQuery += ` AND active = TRUE`;
      } else if (activeFilter === false) {
        getFormsQuery += ` AND COALESCE(active, FALSE) = FALSE`;
      }
    }
    
    const formsToUpdate = await client.query(getFormsQuery, getFormsParams);
    
    // Perform the update
    const result = await client.query(query, queryParams);
    
    await client.query('COMMIT');

    // Log audit event for each RACM transitioned to active='1' in bulk action
    if (req.user && req.user.email_id && formsToUpdate.rows.length > 0) {
      for (const form of formsToUpdate.rows) {
        const wasActive = Boolean(form.active);
        if (!wasActive) {
          await logAuditEvent('Set RACM Active', req.user.email_id, form.form_id);
        }
      }
    }
    
    // User notification email is handled by background scheduler
    // using active != 0 and user_mail_sent = FALSE.
    
    res.status(200).json({
      success: true,
      message: `Successfully set ${result.rowCount} form(s) to active`,
      count: result.rowCount
    });
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error bulk updating forms:', error);
    res.status(500).json({
      success: false,
      message: 'Error bulk updating forms',
      error: error.message
    });
  } finally {
    client.release();
  }
});

// Bulk set due_date and reminder_frequency for specific RACM(s)
router.post('/bulk-set-due-date', verifyAuth, async (req, res) => {
  try {
    const userRole = req.user?.role;
    if (userRole !== 'company_co') {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const companyIdentifier = req.user?.company_identifier;
    if (!companyIdentifier) {
      return res.status(400).json({ success: false, message: 'Company identifier is required' });
    }

    const formIdsRaw = req.body?.form_ids;
    const dueDate = req.body?.due_date ? String(req.body.due_date).trim() : '';
    const reminderFrequency = req.body?.reminder_frequency ? String(req.body.reminder_frequency).trim() : '';

    if (!Array.isArray(formIdsRaw) || formIdsRaw.length === 0) {
      return res.status(400).json({ success: false, message: 'form_ids is required' });
    }

    // Require both inputs (same policy used in bulk upload)
    if (!dueDate || !reminderFrequency) {
      return res.status(400).json({
        success: false,
        message: 'Please provide both due_date and reminder_frequency',
      });
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid due_date format. Expected YYYY-MM-DD',
      });
    }

    const allowed = new Set(['Daily', 'Weekly', 'Monthly']);
    if (!allowed.has(reminderFrequency)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid reminder_frequency. Allowed values: Daily, Weekly, Monthly',
      });
    }

    const formIds = [...new Set(formIdsRaw.map((v) => String(v).trim()).filter(Boolean))];
    if (formIds.length === 0) {
      return res.status(400).json({ success: false, message: 'form_ids is required' });
    }

    const dueDateValue = new Date(`${dueDate}T00:00:00.000Z`);

    // Only update RACMs that belong to the coordinator's company.
    const eligible = await prisma.controlForm.findMany({
      where: {
        companyIdentifier,
        formId: { in: formIds },
      },
      select: { formId: true },
    });
    const eligibleFormIds = eligible.map((r) => r.formId).filter(Boolean);

    if (eligibleFormIds.length === 0) {
      return res.status(404).json({ success: false, message: 'No matching RACM(s) found' });
    }

    // Reset reminder_datetime so the reminder scheduler starts from the new due date/frequency.
    await prisma.controlForm.updateMany({
      where: {
        companyIdentifier,
        formId: { in: eligibleFormIds },
      },
      data: {
        dueDate: dueDateValue,
        reminderFrequency,
      },
    });
    await resetReminderDatetimeForForms(eligibleFormIds);

    return res.status(200).json({
      success: true,
      message: `Updated due date for ${eligibleFormIds.length} RACM(s)`,
      updatedCount: eligibleFormIds.length,
      skippedCount: formIds.length - eligibleFormIds.length,
    });
  } catch (error) {
    console.error('Error bulk setting due date:', error);
    return res.status(500).json({
      success: false,
      message: 'Error bulk setting due date',
    });
  }
});

// Create single RACM
router.post('/', verifyAuth, async (req, res) => {
  const {
    standard_control_description, sub_process, risk_description,
    whether_fraud_risks_exist, control_objective, ipe_reference,
    nature_of_control, control_frequency,
    control_number, area, risk_heat,
    process_walkthrough, control_relies_on_ipe, audit_evidence_accuracy,
    key_control, application_name, control_performer, control_owner,
    control_type_fo, control_type_ma,
    company_identifier, business_process, financial_year, unit_id,
    sample_size,
  } = req.body;

  const unitId = unit_id != null ? String(unit_id).trim() : '';
  const missingRequiredFields = getMissingRacmRequiredFields({
    business_process,
    financial_year,
    unit_id: unitId,
  });
  if (missingRequiredFields.length > 0) {
    return res.status(400).json({
      success: false,
      message: formatMissingRacmRequiredFields(missingRequiredFields),
      missingFields: missingRequiredFields,
    });
  }

  const dueDateRaw = req.body.due_date != null ? String(req.body.due_date).trim() : '';
  const reminderFrequencyRaw =
    req.body.reminder_frequency != null ? String(req.body.reminder_frequency).trim() : '';
  const hasDueDate = !!dueDateRaw;
  const hasReminderFrequency = !!reminderFrequencyRaw;
  if (hasDueDate !== hasReminderFrequency) {
    return res.status(400).json({
      success: false,
      message: 'Please provide both due_date and reminder_frequency, or keep both empty',
    });
  }
  if (hasDueDate) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDateRaw)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid due_date format. Expected YYYY-MM-DD',
      });
    }
    const allowedReminder = new Set(['Daily', 'Weekly', 'Monthly']);
    if (!allowedReminder.has(reminderFrequencyRaw)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid reminder_frequency. Allowed values: Daily, Weekly, Monthly',
      });
    }
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Get user's company_identifier if not provided in request body
    let userCompanyIdentifier = company_identifier;
    if (!userCompanyIdentifier) {
      const userEmail = req.user.email_id;
      const getUserQuery = 'SELECT company_identifier FROM ifc_users WHERE email_id = $1';
      const userResult = await client.query(getUserQuery, [userEmail]);
      
      if (userResult.rows.length > 0 && userResult.rows[0].company_identifier) {
        userCompanyIdentifier = userResult.rows[0].company_identifier;
      }
    }

    if (req.user.role === 'company_co') {
      const unitResult = await client.query(
        `
          SELECT unit_id
          FROM coordinator_unit_assignments
          WHERE company_identifier = $1
            AND unit_id = $2
            AND LOWER(TRIM(coordinator_email_id)) = LOWER(TRIM($3))
          LIMIT 1
        `,
        [userCompanyIdentifier, unitId, req.user.email_id]
      );

      if (unitResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          success: false,
          message: 'Invalid unit selected',
        });
      }
    }

    const ownerValidation = await validateRacmUnitUserAssignment(client, {
      companyIdentifier: userCompanyIdentifier,
      unitId,
      email: control_owner,
      fieldLabel: 'Process owner',
      requireUserRole: true,
    });
    if (!ownerValidation.ok) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: ownerValidation.message });
    }

    const shouldActivateOnCreate = shouldAutoActivateRacmOnCreate({
      controlOwner: control_owner,
      dueDate: hasDueDate ? dueDateRaw : '',
      reminderFrequency: hasReminderFrequency ? reminderFrequencyRaw : '',
      ownerValidationResult: ownerValidation,
    });

    const performerValidation = await validateRacmUnitUserAssignment(client, {
      companyIdentifier: userCompanyIdentifier,
      unitId,
      email: control_performer,
      fieldLabel: 'Control performer',
      requireUserRole: true,
    });
    if (!performerValidation.ok) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: performerValidation.message });
    }

    // Prevent duplicate RACM creation (company_identifier + control_number)
    const cnKey = control_number != null ? String(control_number).trim() : ''
    if (userCompanyIdentifier && cnKey) {
      const dup = await client.query(
        `
          SELECT 1
          FROM control_forms
          WHERE company_identifier = $1
            AND TRIM(control_number) = TRIM($2)
          LIMIT 1
        `,
        [userCompanyIdentifier, cnKey]
      )
      if (dup.rows.length > 0) {
        await client.query('ROLLBACK');
        return res.status(409).json({
          success: false,
          message: DUPLICATE_RACM_COMPANY_SCOPED_MESSAGE,
        });
      }
    }

    // Generate unique form_id
    const formId = await generateUniqueFormId(client);

    // Calculate sample_required based on control_frequency and current timestamp
    // We use current timestamp which will match the created_at value set by the database
    const currentTimestamp = new Date();
    // Ensure control_frequency is a string and handle null/undefined
    const controlFrequencyValue = control_frequency ? String(control_frequency).trim() : null;
    const resolvedSample = await resolveEffectiveSampleSizeForUnit(client, {
      companyIdentifier: userCompanyIdentifier,
      unitId: unit_id ? String(unit_id).trim() : '',
      controlFrequency: controlFrequencyValue,
      explicitSampleSize: sample_size,
    });
    if (!resolvedSample.ok) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: resolvedSample.message });
    }
    const builtSample = buildSampleSizeForFrequency(
      controlFrequencyValue,
      currentTimestamp,
      resolvedSample.sampleSize
    );
    if (!builtSample.ok) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: builtSample.message });
    }
    const sampleSize = builtSample.sampleSize;
    const sampleRequired = builtSample.sampleRequired;
    console.log('[control_forms POST] control_frequency:', control_frequency, 'normalized:', controlFrequencyValue, 'sample_required result:', sampleRequired);

    let activeTemplateId = null;
    let validatedDynamicValues = {};
    if (await isRacmTemplateSchemaReady(client)) {
      const templateResult = await ensureActiveTemplateForUnit(client, {
        companyIdentifier: userCompanyIdentifier,
        unitId,
        createdBy: req.user.email_id,
      });
      if (!templateResult.ok) {
        await client.query('ROLLBACK');
        return res.status(400).json({ success: false, message: templateResult.message });
      }

      activeTemplateId = templateResult.template.id;
      const templateDetails = await getTemplateWithFieldsById(client, activeTemplateId);
      const dynamicValidation = validateDynamicValuesAgainstTemplate(
        templateDetails.extra_fields || [],
        req.body.dynamic_values
      );
      if (!dynamicValidation.ok) {
        await client.query('ROLLBACK');
        return res.status(400).json({ success: false, message: dynamicValidation.message });
      }
      validatedDynamicValues = dynamicValidation.dynamicValues;
    }

    const insertQuery = `
      INSERT INTO control_forms (
        standard_control_description, sub_process, risk_description,
        whether_fraud_risks_exist, control_objective, ipe_reference,
        nature_of_control, control_frequency,
        control_number, area, risk_heat,
        process_walkthrough, control_relies_on_ipe, audit_evidence_accuracy,
        key_control, application_name, control_performer, control_owner,
        sample_size, control_type_fo, control_type_ma,
        form_id, company_identifier, business_process, financial_year, unit_id, sample_required,
        due_date, reminder_frequency,
        template_id,
        active,
        created_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, NOW() AT TIME ZONE 'UTC')
      RETURNING *;
    `;

    const result = await client.query(insertQuery, [
      standard_control_description, sub_process, risk_description,
      whether_fraud_risks_exist, control_objective, ipe_reference,
      nature_of_control, control_frequency,
      control_number || null, area || null, risk_heat || null,
      process_walkthrough || null, control_relies_on_ipe || null, audit_evidence_accuracy || null,
      key_control || null, application_name || null, control_performer || null, control_owner || null,
      sampleSize !== null ? String(sampleSize) : null, control_type_fo || null, control_type_ma || null,
      formId, userCompanyIdentifier, business_process, financial_year || null, unitId, sampleRequired,
      hasDueDate ? dueDateRaw : null,
      hasReminderFrequency ? reminderFrequencyRaw : null,
      activeTemplateId,
      shouldActivateOnCreate,
    ]);

    console.log('[control_forms POST] Inserted RACM - sample_required in DB:', result.rows[0]?.sample_required);

    if (activeTemplateId && Object.keys(validatedDynamicValues).length > 0) {
      const saveDynamicResult = await saveDynamicFieldValues(
        client,
        formId,
        activeTemplateId,
        validatedDynamicValues
      );
      if (!saveDynamicResult.ok) {
        await client.query('ROLLBACK');
        return res.status(400).json({ success: false, message: saveDynamicResult.message });
      }
    }

    if (activeTemplateId) {
      await incrementTemplateLinkedRacmCount(client, activeTemplateId);
    }

    await client.query('COMMIT');

    await logAuditEvent('RACM created', req.user.email_id, formId);
    if (shouldActivateOnCreate) {
      await logAuditEvent('Set RACM Active', req.user.email_id, formId);
    }

    res.status(201).json({
      success: true,
      message: shouldActivateOnCreate
        ? 'RACM created and set to Active successfully'
        : 'RACM created successfully',
      data: result.rows[0]
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating RACM:', error);

    if (error.code === '23505') {
      return res.status(409).json({
        success: false,
        message: DUPLICATE_RACM_COMPANY_SCOPED_MESSAGE,
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Error creating RACM',
      error: error.message
    });
  } finally {
    client.release();
  }
});

// Replicate RACMs (bulk)
// Creates new control_forms rows copied from selected form_ids, excluding specific columns,
// generating a new form_id, and setting financial_year to the provided target.
router.post('/replicate', verifyAuth, async (req, res) => {
  const { form_ids, financial_year } = req.body || {};

  if (!Array.isArray(form_ids) || form_ids.length === 0) {
    return res.status(400).json({ success: false, message: 'form_ids is required' });
  }
  if (!financial_year || String(financial_year).trim() === '') {
    return res.status(400).json({ success: false, message: 'financial_year is required' });
  }

  const client = await pool.connect();
  try {
    // Check if user is company coordinator
    const userEmail = req.user.email_id;
    const getUserQuery = 'SELECT role, company_identifier FROM ifc_users WHERE email_id = $1';
    const userResult = await client.query(getUserQuery, [userEmail]);

    if (userResult.rows.length === 0) {
      return res.status(401).json({ success: false, message: 'User not found' });
    }
    const userRole = userResult.rows[0].role;
    const coordinatorCompany = userResult.rows[0].company_identifier;
    if (userRole !== 'company_co') {
      return res.status(403).json({ success: false, message: 'Access denied. Only company coordinators can replicate RACMs.' });
    }

    await client.query('BEGIN');

    // Fetch selected forms (ensure they belong to coordinator company)
    const placeholders = form_ids.map((_, idx) => `$${idx + 1}`).join(', ');
    const selectQuery = `SELECT * FROM control_forms WHERE form_id IN (${placeholders})`;
    const selectResult = await client.query(selectQuery, form_ids);

    if (selectResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'No RACMs found to replicate' });
    }

    // Ensure all belong to same company (coordinator company)
    if (coordinatorCompany) {
      const invalid = selectResult.rows.find(r => r.company_identifier !== coordinatorCompany);
      if (invalid) {
        await client.query('ROLLBACK');
        return res.status(403).json({ success: false, message: 'Access denied. You can only replicate RACMs from your own company.' });
      }
    }

    const excludedColumns = new Set([
      'id',
      'control_owner',
      'doc_uploaded_by_user',
      'active',
      'user_mail_sent',
      'status',
      'reason_by_approver',
      'remarks_by_user',
      'sample_doc',
      'due_date',
      'form_id',
      'approval_status_change_timestamp',
      'sent_for_approval_timestamp',
      'updated_at',
      // Design / conclusion fields should not be carried over on replication
      'control_design_procs',
      'control_design_conclusion',
      'design_deficiency_desc',
      'assigned_to_coordinator',
      'coordinator_assigned_by',
      'coordinator_assigned_at',
      // created_at handled by DB default (current timestamp)
      'created_at',
    ]);

    const createdFormIds = [];
    const skippedDuplicates = [];

    for (const row of selectResult.rows) {
      // Build insert columns dynamically based on fetched row keys
      const insertObj = {};
      for (const [key, value] of Object.entries(row)) {
        if (excludedColumns.has(key)) continue;
        insertObj[key] = value;
      }

      // Override required fields
      insertObj.form_id = await generateUniqueFormId(client);
      insertObj.financial_year = String(financial_year).trim();

      // Generate new control_number using existing business-process-code sequence logic.
      try {
        const companyId = coordinatorCompany || insertObj.company_identifier || null;
        const businessProcessName = insertObj.business_process != null
          ? String(insertObj.business_process).trim()
          : '';
        if (companyId && businessProcessName) {
          const generatedPrefix = await getBusinessProcessCodeForName(client, companyId, businessProcessName);
          const nextControlNumber = await getNextGeneratedControlNumber(client, companyId, generatedPrefix);
          if (nextControlNumber) {
            insertObj.control_number = nextControlNumber;
          }
        }
      } catch (e) {
        console.error('[control_forms replicate] control number generation error:', e);
      }

      // Prevent duplicate RACM creation (same company + control_number)
      try {
        const companyId = coordinatorCompany || insertObj.company_identifier || null
        const cnKey = insertObj.control_number != null ? String(insertObj.control_number).trim() : ''
        if (companyId && cnKey) {
          const dup = await client.query(
            `
              SELECT 1
              FROM control_forms
              WHERE company_identifier = $1
                AND TRIM(control_number) = TRIM($2)
              LIMIT 1
            `,
            [companyId, cnKey]
          )
          if (dup.rows.length > 0) {
            skippedDuplicates.push(row.form_id)
            continue
          }
        }
      } catch (e) {
        console.error('[control_forms replicate] duplicate check error:', e)
      }

      const currentTimestamp = new Date();
      const controlFrequencyValue = insertObj.control_frequency ? String(insertObj.control_frequency).trim() : null;

      try {
        const companyId = coordinatorCompany || insertObj.company_identifier || null;
        const unitIdValue = insertObj.unit_id ? String(insertObj.unit_id).trim() : '';
        const resolvedSample = await resolveEffectiveSampleSizeForUnit(client, {
          companyIdentifier: companyId,
          unitId: unitIdValue,
          controlFrequency: controlFrequencyValue,
        });
        if (resolvedSample.ok) {
          const builtSample = buildSampleSizeForFrequency(
            controlFrequencyValue,
            currentTimestamp,
            resolvedSample.sampleSize
          );
          if (builtSample.ok) {
            if ('sample_required' in insertObj) {
              insertObj.sample_required = builtSample.sampleRequired;
            }
            if ('sample_size' in insertObj) {
              insertObj.sample_size = String(builtSample.sampleSize);
            }
          }
        }
      } catch (e) {
        console.error('[control_forms replicate] sample_required recalculation error:', e);
      }

      const columns = Object.keys(insertObj);
      const values = Object.values(insertObj);
      const insertPlaceholders = columns.map((_, idx) => `$${idx + 1}`).join(', ');
      const insertQuery = `INSERT INTO control_forms (${columns.join(', ')}) VALUES (${insertPlaceholders}) RETURNING form_id`;
      const insertResult = await client.query(insertQuery, values);
      createdFormIds.push(insertResult.rows[0].form_id);
    }

    await client.query('COMMIT');

    // Audit each created RACM individually so every new form_id is traceable.
    for (const createdFormId of createdFormIds) {
      await logAuditEvent('RACM created', userEmail, createdFormId);
    }

    res.status(201).json({
      success: true,
      message: 'RACMs replicated successfully',
      count: createdFormIds.length,
      skipped_duplicates: skippedDuplicates.length,
      data: { form_ids: createdFormIds },
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error replicating RACMs:', error);
    res.status(500).json({ success: false, message: 'Error replicating RACMs', error: error.message });
  } finally {
    client.release();
  }
});

// Delete a RACM
router.delete('/:form_id', verifyAuth, async (req, res) => {
  const { form_id } = req.params;

  try {
    // Check if user is company coordinator
    const userEmail = req.user.email_id;
    const user = await prisma.ifcUser.findFirst({
      where: {
        emailId: {
          equals: userEmail,
          mode: 'insensitive',
        },
      },
      select: {
        role: true,
        companyIdentifier: true,
      },
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not found'
      });
    }

    const userRole = user.role;
    if (userRole !== 'company_co') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Only company coordinators can delete RACM entries.'
      });
    }

    // Check if form exists.
    const form = await prisma.controlForm.findFirst({
      where: { formId: form_id },
      select: {
        id: true,
        companyIdentifier: true,
        active: true,
        templateId: true,
      },
    });

    if (!form) {
      return res.status(404).json({
        success: false,
        message: 'RACM not found'
      });
    }

    // Verify that the coordinator can only delete forms from their own company
    const coordinatorCompany = user.companyIdentifier || null;
    if (form.companyIdentifier !== coordinatorCompany) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only delete forms from your own company.'
      });
    }

    const activeDeleteError = getActiveRacmDeleteError(form.active);
    if (activeDeleteError) {
      return res.status(400).json({
        success: false,
        message: activeDeleteError,
      });
    }

    // Delete all sample, user-uploaded, and deficiency response documents from S3 before deleting DB rows.
    const docUrlsToDelete = await collectRacmS3DocumentKeys(prisma, form_id);

    try {
      for (const s3Key of docUrlsToDelete) {
        await deleteFileFromS3(s3Key);
      }
    } catch (s3Error) {
      console.error('Error deleting associated documents from S3 for RACM:', s3Error);
      return res.status(500).json({
        success: false,
        message: 'Error deleting associated documents from storage',
        error: s3Error.message
      });
    }

    const deleteResult = await prisma.$transaction(async (tx) => {
      const deletedUserDocsResult = await tx.racmDoc.deleteMany({
        where: { formId: form_id },
      });
      const deletedSampleDocsResult = await tx.sampleDoc.deleteMany({
        where: { formId: form_id },
      });
      await tx.controlForm.deleteMany({
        where: { formId: form_id },
      });
      return {
        user_uploaded_rows: deletedUserDocsResult.count,
        sample_doc_rows: deletedSampleDocsResult.count,
      };
    });

    if (form.templateId && (await isRacmTemplateSchemaReady(pool))) {
      const countClient = await pool.connect();
      try {
        await decrementTemplateLinkedRacmCount(countClient, form.templateId);
      } finally {
        countClient.release();
      }
    }

    res.status(200).json({
      success: true,
      message: 'RACM deleted successfully',
      deleted_documents: {
        s3_objects: docUrlsToDelete.length,
        user_uploaded_rows: deleteResult.user_uploaded_rows,
        sample_doc_rows: deleteResult.sample_doc_rows,
      }
    });

  } catch (error) {
    console.error('Error deleting RACM:', error);
    
    res.status(500).json({
      success: false,
      message: 'Error deleting RACM',
      error: error.message
    });
  }
});

router.get('/:form_id/approver-status', verifyUserAuth, async (req, res) => {
  const { form_id } = req.params;

  try {
    const approverDetails = await getControlFormApproverDetails(pool, form_id);

    if (!approverDetails) {
      return res.status(404).json({
        success: false,
        message: 'RACM not found',
      });
    }

    const processOwnerEmail = String(approverDetails.control_owner || '').trim().toLowerCase();
    const userEmail = String(req.user?.email_id || '').trim().toLowerCase();

    if (processOwnerEmail !== userEmail) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You are not authorized to view this form.',
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        approver_email_id: approverDetails.approver_email_id || null,
        approver_name: approverDetails.approver_name || null,
        approver_display_name: approverDetails.approver_display_name || approverDetails.approver_email_id || null,
        approver_user_id: approverDetails.approver_user_id || null,
        approver_temp_login: approverDetails.approver_temp_login,
        approver_assigned: isApproverAssigned(approverDetails),
      },
    });
  } catch (error) {
    console.error('Error checking RACM approver status:', error);
    return res.status(500).json({
      success: false,
      message: 'Error checking RACM approver status',
      error: error.message,
    });
  }
});

// Upload user document for a specific form and persist it immediately.
router.post(
  '/:form_id/self-assign',
  verifyAuth,
  async (req, res) => {
    const { form_id } = req.params;

    if (req.user?.role !== 'company_co') {
      return res.status(403).json({
        success: false,
        message: 'Only company coordinators can self-assign RACMs.',
      });
    }

    try {
      const form = await getControlFormCoordinatorContext(pool, form_id);
      if (!form) {
        return res.status(404).json({ success: false, message: 'RACM not found' });
      }

      if (isCoordinatorAssignedRacm(form)) {
        return res.status(400).json({
          success: false,
          message: 'This RACM is already assigned to a coordinator.',
        });
      }

      const hasValidOwner = await hasValidProcessOwnerAssignment(pool, form_id);
      if (hasValidOwner) {
        return res.status(400).json({
          success: false,
          message: 'This RACM is already assigned to a process owner.',
        });
      }

      if (!hasCoordinatorScheduleConfigured(form)) {
        return res.status(400).json({
          success: false,
          message: 'Due date and reminder frequency must be configured before self-assignment.',
        });
      }

      const status = String(form.status || '').trim().toLowerCase();
      if (status === 'sent for approval' || status === 'approved') {
        return res.status(400).json({
          success: false,
          message: 'This RACM cannot be self-assigned in its current approval status.',
        });
      }

      const coordinatorEmail = String(req.user.email_id || '').trim().toLowerCase();
      const hasUnitAccess = await coordinatorHasUnitAccess(pool, {
        companyIdentifier: form.company_identifier,
        unitId: form.unit_id,
        coordinatorEmail,
      });
      if (!hasUnitAccess) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. You are not assigned to this RACM unit.',
        });
      }

      const updated = await prisma.controlForm.update({
        where: { formId: String(form_id).trim() },
        data: {
          assignedToCoordinator: true,
          coordinatorAssignedBy: req.user.email_id,
          coordinatorAssignedAt: new Date(),
          controlOwner: null,
          active: true,
          inactiveMailPending: false,
        },
      });

      await logAuditEvent('Coordinator Self-Assignment', req.user.email_id, form_id);

      return res.status(200).json({
        success: true,
        message: 'RACM self-assigned successfully',
        data: {
          form_id: updated.formId,
          assigned_to_coordinator: updated.assignedToCoordinator,
          coordinator_assigned_by: updated.coordinatorAssignedBy,
          coordinator_assigned_at: updated.coordinatorAssignedAt,
          control_owner: updated.controlOwner,
          active: updated.active,
        },
      });
    } catch (error) {
      console.error('Coordinator self-assign error:', error);
      return res.status(500).json({
        success: false,
        message: 'Error self-assigning RACM',
      });
    }
  }
);

// Upload user document for a specific form and persist it immediately.
router.post(
  '/:form_id/upload-document',
  verifyAuth,
  handleUserDocumentUpload,
  async (req, res) => {
  const { form_id } = req.params;
  const files = [
    ...((req.files && req.files.documents) || []),
    ...((req.files && req.files.document) || []),
  ];
  
  if (files.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'No files uploaded'
    });
  }

  try {
    const coordinatorForm = await getControlFormCoordinatorContext(pool, form_id);
    const isCoordinatorAssigned = isCoordinatorAssignedRacm(coordinatorForm);

    if (isCoordinatorAssigned) {
      const coordinatorAccess = await assertCoordinatorAssignedRacmAccess(coordinatorForm, req.user);
      if (!coordinatorAccess.ok) {
        return res.status(coordinatorAccess.status).json({
          success: false,
          message: coordinatorAccess.message,
        });
      }

      const coordinatorBlockMessage = getCoordinatorSubmissionBlockMessage(coordinatorForm);
      if (coordinatorBlockMessage) {
        return res.status(400).json({
          success: false,
          message: coordinatorBlockMessage,
        });
      }
    } else {
      if (req.user?.role !== 'user') {
        return res.status(403).json({
          success: false,
          message: 'Access denied. You are not authorized to update this form.',
        });
      }

      const approverDetails = await getControlFormApproverDetails(pool, form_id);

      if (!approverDetails) {
        return res.status(404).json({
          success: false,
          message: 'RACM not found',
        });
      }

      const processOwnerEmail = String(approverDetails.control_owner || '').trim().toLowerCase();
      const userEmail = String(req.user?.email_id || '').trim().toLowerCase();

      if (processOwnerEmail !== userEmail) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. You are not authorized to update this form.',
        });
      }

      const approverBlockMessage = getApproverSubmissionBlockMessage(approverDetails);
      if (approverBlockMessage) {
        return res.status(400).json({
          success: false,
          message: approverBlockMessage,
        });
      }
    }

    const docContext = await getControlFormUserDocumentContext(pool, form_id);
    if (!docContext) {
      return res.status(404).json({
        success: false,
        message: 'RACM not found',
      });
    }

    const userDocumentFolderPath = buildUserDocumentS3FolderPath({
      companyName: docContext.company_name,
      unitName: docContext.unit_name,
      businessProcess: docContext.business_process,
      formId: docContext.form_id,
    });

    const uploadedDocs = [];

    for (const file of files) {
      const fileName = file.originalname;
      const fileBuffer = file.buffer;

      // Upload file to S3
      console.log(`Uploading user document to S3: ${fileName}`);
      const s3Key = await uploadFileToS3(fileBuffer, fileName, userDocumentFolderPath, {
        preserveFileName: true,
      });
      console.log(`User document uploaded to S3 with key: ${s3Key}`);

      const insertedDoc = await insertUserDocument(pool, form_id, s3Key, req.user?.email_id || null);
      uploadedDocs.push({
        id: insertedDoc?.id || null,
        form_id: insertedDoc?.form_id || form_id,
        doc_uploaded_by_user: s3Key,
        user_id: insertedDoc?.user_id || req.user?.email_id || null,
        created_at: insertedDoc?.created_at || null,
        file_name: fileName,
      });
    }

    const latestDoc = uploadedDocs[uploadedDocs.length - 1] || null;

    res.status(200).json({
      success: true,
      message: uploadedDocs.length === 1
        ? 'Document uploaded successfully'
        : 'Documents uploaded successfully',
      data: {
        form_id,
        doc_uploaded_by_user: latestDoc?.doc_uploaded_by_user || null,
        doc_uploaded_by_user_docs: uploadedDocs,
        file_names: uploadedDocs.map((doc) => doc.file_name)
      }
    });
  } catch (error) {
    console.error('Error uploading document to S3:', error);
    
    res.status(500).json({
      success: false,
      message: 'Error uploading document to S3',
      error: error.message
    });
  }
});

// Check if sampling document exists for a form
router.get('/:form_id/check-sampling-exists', verifyAuth, async (req, res) => {
  const { form_id } = req.params;
  const client = await pool.connect();

  try {
    const formResult = await client.query('SELECT 1 FROM control_forms WHERE form_id = $1 LIMIT 1', [form_id]);
    if (formResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'RACM not found',
      });
    }

    const sampleResult = await client.query(
      'SELECT 1 FROM sample_docs WHERE form_id = $1 AND NULLIF(TRIM(sample_doc), \'\') IS NOT NULL LIMIT 1',
      [form_id]
    );
    const exists = sampleResult.rows.length > 0;

    res.status(200).json({
      success: true,
      exists: exists
    });
  } catch (error) {
    console.error('Error checking sampling document:', error);
    res.status(500).json({
      success: false,
      message: 'Error checking sampling document',
      error: error.message
    });
  } finally {
    client.release();
  }
});

// Delete one sample document for a RACM
router.delete('/:form_id/sample-docs/:sample_doc_id', verifyAuth, async (req, res) => {
  const { form_id, sample_doc_id } = req.params;
  const client = await pool.connect();

  try {
    if (!/^\d+$/.test(String(sample_doc_id || ''))) {
      return res.status(400).json({
        success: false,
        message: 'Invalid sample document id',
      });
    }

    if (req.user?.role !== 'company_co') {
      return res.status(403).json({
        success: false,
        message: 'Access denied',
      });
    }

    await client.query('BEGIN');

    const docResult = await client.query(
      `
        SELECT sd.id, sd.form_id, sd.sample_doc, cf.company_identifier
        FROM sample_docs sd
        JOIN control_forms cf ON cf.form_id = sd.form_id
        WHERE sd.id = $1 AND sd.form_id = $2
        LIMIT 1
      `,
      [sample_doc_id, form_id]
    );

    if (docResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        message: 'Sample document not found',
      });
    }

    const sampleDoc = docResult.rows[0];
    const userCompanyIdentifier = String(req.user?.company_identifier || '').trim();
    const formCompanyIdentifier = String(sampleDoc.company_identifier || '').trim();
    if (userCompanyIdentifier && formCompanyIdentifier && userCompanyIdentifier !== formCompanyIdentifier) {
      await client.query('ROLLBACK');
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only delete sample documents from your own company.',
      });
    }

    const s3Key = String(sampleDoc.sample_doc || '').trim();
    if (s3Key) {
      await deleteFileFromS3(s3Key);
    }

    await client.query(
      'DELETE FROM sample_docs WHERE id = $1 AND form_id = $2',
      [sample_doc_id, form_id]
    );

    await client.query('COMMIT');

    return res.status(200).json({
      success: true,
      message: 'Sample document deleted successfully',
      data: {
        id: sampleDoc.id,
        form_id,
        sample_doc: sampleDoc.sample_doc,
      },
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error deleting sample document:', error);
    return res.status(500).json({
      success: false,
      message: 'Error deleting sample document',
      error: error.message,
    });
  } finally {
    client.release();
  }
});

// Upload one or more sample documents for a specific form
router.post(
  '/:form_id/upload-sampling-excel',
  verifyAuth,
  handleSampleDocumentUpload,
  async (req, res) => {
  const { form_id } = req.params;
  const files = [
    ...((req.files && req.files.excelFiles) || []),
    ...((req.files && req.files.excelFile) || []),
  ];
  
  if (files.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'No file uploaded'
    });
  }

  try {
    const form = await prisma.controlForm.findFirst({
      where: { formId: form_id },
      select: { formId: true },
    });

    if (!form) {
      return res.status(404).json({
        success: false,
        message: 'Control form not found'
      });
    }

    const docContext = await getControlFormUserDocumentContext(pool, form_id);
    if (!docContext) {
      return res.status(404).json({
        success: false,
        message: 'Control form not found'
      });
    }

    const sampleDocumentFolderPath = buildSampleDocumentS3FolderPath({
      companyName: docContext.company_name,
      unitName: docContext.unit_name,
      businessProcess: docContext.business_process,
      formId: docContext.form_id,
    });

    const uploaderEmailId = req.user?.email_id ? String(req.user.email_id).trim() : null;

    const uploadedS3Keys = [];
    const sampleDocs = [];
    try {
      for (const file of files) {
        const fileName = file.originalname;
        const fileBuffer = file.buffer;

        // Upload file to S3 first (outside DB transaction to avoid long txn wait/P2028)
        console.log(`Uploading sampling Excel file to S3: ${fileName}`);
        const s3Key = await uploadFileToS3(fileBuffer, fileName, sampleDocumentFolderPath, {
          preserveFileName: true,
        });
        console.log(`Sampling Excel file uploaded to S3 with key: ${s3Key}`);
        uploadedS3Keys.push(s3Key);

        const insertedDoc = await insertSampleDocument(pool, form_id, s3Key, uploaderEmailId);
        if (!insertedDoc) {
          throw new Error('Failed to save sample document record');
        }

        sampleDocs.push({
          id: insertedDoc.id,
          form_id: insertedDoc.form_id,
          sample_doc: insertedDoc.sample_doc,
          user_id: insertedDoc.user_id,
          created_at: insertedDoc.created_at,
        });
      }
    } catch (innerError) {
      // Best-effort cleanup if something fails after upload
      for (const key of uploadedS3Keys) {
        try {
          await deleteFileFromS3(key);
        } catch (cleanupError) {
          console.warn(`Failed to cleanup sampling doc from S3: ${key}`, cleanupError);
        }
      }
      throw innerError;
    }

    res.status(200).json({
      success: true,
      message: 'Sampling Excel file(s) uploaded successfully',
      data: {
        form_id,
        sample_doc: sampleDocs[sampleDocs.length - 1]?.sample_doc || null,
        sample_docs: sampleDocs,
        file_names: files.map((file) => file.originalname)
      }
    });

  } catch (error) {
    console.error('Error uploading sampling Excel file to S3:', error);
    
    res.status(500).json({
      success: false,
      message: 'Error uploading sampling Excel file',
      error: error.message
    });
  }
});


module.exports = router;
