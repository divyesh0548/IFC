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
}) {
  const approverUrl = buildApproverFormDetailUrl(form?.form_id);
  const declarerLabel = String(declaredByName || declaredByEmail || 'Process Owner').trim();
  const effectiveCompanyName = String(companyName || '').trim() || 'IFC';
  const trimmedComment = String(ownerComment || '').trim();
  const subject = `Internal Financial Controls - No Further Submission Declared`;

  let text = `Dear Approver,\n\n`;
  text += `${declarerLabel} has declared that there will be no further submission for this RACM.\n\n`;
  text += buildRacmDetailsSection(form, [
    ['Comment', trimmedComment || 'Not provided'],
  ], 'RACM Details:');
  text += '\n\n';
  text += 'This declaration closes the process owner submission cycle for this RACM and reminder emails have been stopped.\n';
  if (approverUrl) {
    text += `\nRACM: ${approverUrl}\n`;
  }
  text += `\nRegards,\n${effectiveCompanyName}`;

  return { subject, text };
}

module.exports = {
  buildNoFurtherSubmissionEmail,
  getProcessOwnerDeclarationByFormId,
  hasProcessOwnerDeclaration,
};
