const ACTIVE_RACM_DELETE_MESSAGE =
  'Active RACM cannot be deleted. Please set the RACM Inactive first.';

function isRacmMarkedActive(active) {
  if (active === true || active === 1) {
    return true;
  }
  if (active === false || active === 0 || active == null) {
    return false;
  }
  const normalized = String(active).trim().toLowerCase();
  return normalized === 'true' || normalized === '1';
}

function getActiveRacmDeleteError(active) {
  return isRacmMarkedActive(active) ? ACTIVE_RACM_DELETE_MESSAGE : null;
}

const INACTIVE_RACM_APPROVER_MESSAGE =
  'Inactive RACMs cannot be accessed or reviewed by approvers.';

function getInactiveRacmApproverAccessError(active) {
  return isRacmMarkedActive(active) ? null : INACTIVE_RACM_APPROVER_MESSAGE;
}

async function deleteApproverAssignmentsForRacms(tx, { formIds, companyIdentifier = null }) {
  const normalizedFormIds = [...new Set(
    (Array.isArray(formIds) ? formIds : [formIds])
      .map((id) => String(id || '').trim())
      .filter(Boolean)
  )];
  if (normalizedFormIds.length === 0) {
    return 0;
  }

  const where = {
    formId: { in: normalizedFormIds },
  };
  const normalizedCompanyIdentifier = String(companyIdentifier || '').trim();
  if (normalizedCompanyIdentifier) {
    where.companyIdentifier = normalizedCompanyIdentifier;
  }

  const result = await tx.approverAssignment.deleteMany({ where });
  return result.count;
}

const { isDevelopment } = require('./node_env');

function isRacmDeleteEnabled() {
  return isDevelopment();
}

/**
 * Remove every row stored for one control. Cascade would only clear some tables;
 * history, audit rows, AI results, and RACM-specific CC rows are deleted here too.
 */
async function deleteAllFormScopedRows(tx, formId) {
  const id = String(formId || '').trim();
  if (!id) return;

  await tx.$executeRaw`
    DELETE FROM deficiency_response_attachment
    WHERE submission_id IN (
      SELECT s.id
      FROM deficiency_response_submission s
      INNER JOIN deficiency_response r ON r.id = s.deficiency_response_id
      WHERE r.form_id = ${id}
    )
  `;
  await tx.$executeRaw`
    DELETE FROM deficiency_response_submission
    WHERE deficiency_response_id IN (
      SELECT id FROM deficiency_response WHERE form_id = ${id}
    )
  `;
  await tx.$executeRaw`DELETE FROM deficiency_response WHERE form_id = ${id}`;
  await tx.$executeRaw`
    DELETE FROM change_request_item
    WHERE change_request_id IN (
      SELECT id FROM change_request WHERE form_id = ${id}
    )
  `;
  await tx.$executeRaw`DELETE FROM change_request WHERE form_id = ${id}`;
  await tx.$executeRaw`DELETE FROM process_owner_declaration WHERE form_id = ${id}`;
  await tx.$executeRaw`DELETE FROM controls_reminder WHERE form_id = ${id}`;
  await tx.$executeRaw`DELETE FROM design_gap_insights WHERE form_id = ${id}`;
  await tx.$executeRaw`DELETE FROM racm_field_values WHERE form_id = ${id}`;
  await tx.$executeRaw`DELETE FROM sample_docs WHERE form_id = ${id}`;
  await tx.$executeRaw`DELETE FROM racm_docs WHERE form_id = ${id}`;
  await tx.$executeRaw`DELETE FROM control_form_history WHERE form_id = ${id}`;
  await tx.$executeRaw`DELETE FROM audit_logs_racm WHERE form_id = ${id}`;
  await tx.$executeRaw`
    DELETE FROM key_manual_ai_insights_run_table rt
    WHERE EXISTS (
      SELECT 1
      FROM key_manual_ai_insights_row_data r
      WHERE r.run_id = rt.id AND r.form_id = ${id}
    )
    AND NOT EXISTS (
      SELECT 1
      FROM key_manual_ai_insights_row_data r
      WHERE r.run_id = rt.id AND r.form_id IS DISTINCT FROM ${id}
    )
  `;
  await tx.$executeRaw`DELETE FROM key_manual_ai_insights_row_data WHERE form_id = ${id}`;
  await tx.$executeRaw`DELETE FROM risk_analysis WHERE form_id = ${id}`;
  await tx.$executeRaw`DELETE FROM approver_assignments WHERE form_id = ${id}`;
  await tx.$executeRaw`DELETE FROM racm_cc_users WHERE racm_identifier = ${id}`;
  await tx.$executeRaw`DELETE FROM control_forms WHERE form_id = ${id}`;
}

module.exports = {
  ACTIVE_RACM_DELETE_MESSAGE,
  INACTIVE_RACM_APPROVER_MESSAGE,
  isRacmMarkedActive,
  getActiveRacmDeleteError,
  getInactiveRacmApproverAccessError,
  deleteApproverAssignmentsForRacms,
  isRacmDeleteEnabled,
  deleteAllFormScopedRows,
};
