const { pool } = require('./db');
const { buildRacmDetailsSection } = require('./racm_email_details');
const { buildApproverFormDetailUrl } = require('./racm_status_user_email');

async function getProcessOwnerDeclarationByFormId(clientOrPool, formId) {
  const normalizedFormId = String(formId || '').trim();
  if (!normalizedFormId) return null;

  const result = await clientOrPool.query(
    `
      SELECT
        pod.form_id,
        pod.no_furthure_submission,
        pod.declaration_type,
        pod.declaration_confirmed,
        pod.owner_comment,
        pod.process_owner_email,
        COALESCE(NULLIF(TRIM(u.emp_name), ''), NULLIF(TRIM(pod.process_owner_email), '')) AS declared_by,
        pod."timestamp" AT TIME ZONE 'UTC' AS "timestamp"
      FROM process_owner_declaration pod
      LEFT JOIN ifc_users u
        ON LOWER(TRIM(COALESCE(u.email_id, ''))) = LOWER(TRIM(COALESCE(pod.process_owner_email, '')))
      WHERE pod.form_id = $1
      LIMIT 1
    `,
    [normalizedFormId]
  );

  return result.rows[0] || null;
}

async function hasProcessOwnerDeclaration(clientOrPool, formId) {
  const declaration = await getProcessOwnerDeclarationByFormId(clientOrPool, formId);
  return Boolean(declaration?.no_furthure_submission);
}

function buildNoFurtherSubmissionEmail({
  form,
  declaredByName,
  declaredByEmail,
  companyName,
  ownerComment,
  declarationType,
}) {
  const approverUrl = buildApproverFormDetailUrl(form?.form_id);
  const declarerLabel = String(declaredByName || declaredByEmail || 'Process Owner').trim();
  const effectiveCompanyName = String(companyName || '').trim();
  const trimmedComment = String(ownerComment || '').trim();
  const isNoEvent = declarationType === 'no_submission_available';
  const businessProcess = String(form?.business_process || '').trim() || 'Business Process';
  const controlNumber = String(form?.control_number || '').trim() || String(form?.form_id || '').trim() || 'Control';
  const subject = isNoEvent
    ? `${businessProcess} - ${controlNumber} - No Submission Available declaration`
    : `${businessProcess} - ${controlNumber} - No Further Submission Declared`;
  const declarationSentence = isNoEvent
    ? `${declarerLabel} has declared that no submission is available because no transaction or event happened during the audit period.`
    : `${declarerLabel} has declared that further submission is not possible for this RACM.`;

  let text = `Dear Approver,\n\n`;
  text += `${declarationSentence}\n\n`;
  const detailRows = trimmedComment ? [['Comment', trimmedComment]] : [];
  text += buildRacmDetailsSection(form, detailRows, 'RACM Details:');
  text += '\n\n';
  text += 'Please record one conclusion: Effective, Not Effective, Accepted under deviation, or Not Applicable. That conclusion closes the control cycle.\n';
  if (approverUrl) {
    text += `\nRACM: ${approverUrl}\n`;
  }
  text += effectiveCompanyName ? `\nRegards,\n${effectiveCompanyName}` : '\nRegards,';

  return { subject, text };
}

module.exports = {
  buildNoFurtherSubmissionEmail,
  getProcessOwnerDeclarationByFormId,
  hasProcessOwnerDeclaration,
};
