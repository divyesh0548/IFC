const { pool } = require('./db');

const VALID_RACM_PROCESS_OWNER_ASSIGNMENT_EXISTS_SQL = `
  EXISTS (
    SELECT 1
    FROM ifc_users valid_owner
    INNER JOIN user_unit_memberships valid_membership
      ON valid_membership.company_identifier = valid_owner.company_identifier
     AND LOWER(TRIM(valid_membership.user_email_id)) = LOWER(TRIM(valid_owner.email_id))
     AND valid_membership.unit_id = cf.unit_id
    WHERE LOWER(TRIM(valid_owner.email_id)) = LOWER(TRIM(COALESCE(cf.control_owner, '')))
      AND valid_owner.company_identifier = cf.company_identifier
      AND valid_owner.role = 'user'
  )
`;

const VALID_RACM_ASSIGNMENT_EXISTS_SQL = `
  (
    COALESCE(cf.assigned_to_coordinator, FALSE) = TRUE
    OR ${VALID_RACM_PROCESS_OWNER_ASSIGNMENT_EXISTS_SQL}
  )
`;

const RACM_ASSIGNMENT_COMPUTED_SELECT_SQL = `
  (${VALID_RACM_PROCESS_OWNER_ASSIGNMENT_EXISTS_SQL}) AS has_valid_process_owner_assignment,
  (${VALID_RACM_ASSIGNMENT_EXISTS_SQL}) AS is_racm_assigned
`;

function isTruthyFlag(value) {
  if (value === true || value === 1) return true;
  if (value === false || value === 0 || value == null) return false;
  const normalized = String(value).trim().toLowerCase();
  return normalized === 'true' || normalized === '1';
}

function isCoordinatorAssignedRacm(form) {
  if (!form) return false;
  const flag = form.assigned_to_coordinator ?? form.assignedToCoordinator;
  return isTruthyFlag(flag);
}

function hasCoordinatorScheduleConfigured(form) {
  const dueDate = form?.due_date ?? form?.dueDate;
  const reminderFrequency = form?.reminder_frequency ?? form?.reminderFrequency;
  const hasDueDate = dueDate != null && String(dueDate).trim() !== '';
  const hasReminder = reminderFrequency != null && String(reminderFrequency).trim() !== '';
  return hasDueDate && hasReminder;
}

async function coordinatorHasUnitAccess(clientOrPool, {
  companyIdentifier,
  unitId,
  coordinatorEmail,
}) {
  const companyId = String(companyIdentifier || '').trim();
  const normalizedUnitId = String(unitId || '').trim();
  const email = String(coordinatorEmail || '').trim().toLowerCase();
  if (!companyId || !normalizedUnitId || !email) {
    return false;
  }

  const result = await clientOrPool.query(
    `
      SELECT 1
      FROM coordinator_unit_assignments
      WHERE company_identifier = $1
        AND unit_id = $2
        AND LOWER(TRIM(coordinator_email_id)) = $3
      LIMIT 1
    `,
    [companyId, normalizedUnitId, email]
  );
  return result.rows.length > 0;
}

async function getControlFormCoordinatorContext(clientOrPool, formId) {
  const normalizedFormId = String(formId || '').trim();
  if (!normalizedFormId) return null;

  const result = await clientOrPool.query(
    `
      SELECT
        form_id,
        company_identifier,
        unit_id,
        control_owner,
        active,
        status,
        due_date,
        reminder_frequency,
        assigned_to_coordinator,
        coordinator_assigned_by,
        coordinator_assigned_at
      FROM control_forms
      WHERE form_id = $1
      LIMIT 1
    `,
    [normalizedFormId]
  );
  return result.rows[0] || null;
}

async function assertCoordinatorAssignedRacmAccess(form, user) {
  const userRole = String(user?.role || '').trim().toLowerCase();
  const userEmail = String(user?.email_id || '').trim().toLowerCase();
  const userCompany = String(user?.company_identifier || '').trim();
  const formCompany = String(form?.company_identifier || '').trim();

  if (!isCoordinatorAssignedRacm(form)) {
    return {
      ok: false,
      status: 403,
      message: 'This RACM is not assigned to a coordinator for submission.',
    };
  }

  if (userRole !== 'company_co') {
    return {
      ok: false,
      status: 403,
      message: 'Only company coordinators can perform this action on coordinator-assigned RACMs.',
    };
  }

  if (!userCompany || userCompany !== formCompany) {
    return {
      ok: false,
      status: 403,
      message: 'Access denied. RACM is not assigned to this company coordinator.',
    };
  }

  const hasAccess = await coordinatorHasUnitAccess(pool, {
    companyIdentifier: formCompany,
    unitId: form.unit_id,
    coordinatorEmail: userEmail,
  });
  if (!hasAccess) {
    return {
      ok: false,
      status: 403,
      message: 'Access denied. You are not assigned to this RACM unit.',
    };
  }

  return { ok: true };
}

function getCoordinatorSubmissionBlockMessage(form) {
  const status = String(form?.status || '').trim().toLowerCase();
  if (status === 'sent for approval') {
    return 'This RACM is already sent for approval.';
  }
  if (status === 'approved') {
    return 'Approved RACMs cannot be resubmitted from this screen.';
  }
  return '';
}

function buildCoordinatorFormDetailUrl(formId) {
  const base = String(process.env.VITE_FRONTEND_URL || process.env.FRONTEND_URL || '').trim().replace(/\/$/, '');
  if (!base || !formId) return null;
  return `${base}/company-co/form/${encodeURIComponent(String(formId).trim())}`;
}

async function hasValidProcessOwnerAssignment(clientOrPool, formId) {
  const normalizedFormId = String(formId || '').trim();
  if (!normalizedFormId) return false;

  const result = await clientOrPool.query(
    `
      SELECT (${VALID_RACM_PROCESS_OWNER_ASSIGNMENT_EXISTS_SQL}) AS assigned
      FROM control_forms cf
      WHERE cf.form_id = $1
      LIMIT 1
    `,
    [normalizedFormId]
  );
  return result.rows[0]?.assigned === true;
}

module.exports = {
  VALID_RACM_PROCESS_OWNER_ASSIGNMENT_EXISTS_SQL,
  VALID_RACM_ASSIGNMENT_EXISTS_SQL,
  RACM_ASSIGNMENT_COMPUTED_SELECT_SQL,
  isTruthyFlag,
  isCoordinatorAssignedRacm,
  hasCoordinatorScheduleConfigured,
  coordinatorHasUnitAccess,
  getControlFormCoordinatorContext,
  assertCoordinatorAssignedRacmAccess,
  getCoordinatorSubmissionBlockMessage,
  buildCoordinatorFormDetailUrl,
  hasValidProcessOwnerAssignment,
};
