const { pool } = require('./db');
const { sendEmail } = require('./send_email');
const { getCcEmailsForRacm } = require('./racm_cc_recipients');
const {
  resolveDeficiencyResponseEmailFields,
} = require('./racm_email_details');
const { buildApproverFormDetailUrl, buildUserFormDetailUrl } = require('./racm_status_user_email');
const { buildCoordinatorFormDetailUrl } = require('./racm_coordinator_assignment');

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function formatDueDateDisplay(dueDateRaw) {
  if (!dueDateRaw) return 'TBD';

  let year;
  let month;
  let day;
  const str = String(dueDateRaw).trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    const parts = str.split('-');
    year = Number(parts[0]);
    month = Number(parts[1]);
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

  return `${day} ${monthNames[month - 1] || ''} ${year}`.trim();
}

async function getCoordinatorEmailForUnit(companyIdentifier, unitId) {
  const normalizedCompany = String(companyIdentifier || '').trim();
  const normalizedUnit = String(unitId || '').trim();

  if (!normalizedCompany || !normalizedUnit) {
    return '';
  }

  const result = await pool.query(
    `
      SELECT LOWER(TRIM(coordinator_email_id)) AS coordinator_email_id
      FROM coordinator_unit_assignments
      WHERE company_identifier = $1
        AND unit_id = $2
        AND COALESCE(TRIM(coordinator_email_id), '') <> ''
      LIMIT 1
    `,
    [normalizedCompany, normalizedUnit]
  );

  return String(result.rows[0]?.coordinator_email_id || '').trim();
}

function getCounterpartEmail({ submittedByEmail, controlOwnerEmail, coordinatorEmail }) {
  const submitted = normalizeEmail(submittedByEmail);
  const owner = normalizeEmail(controlOwnerEmail);
  const coordinator = normalizeEmail(coordinatorEmail);

  if (!submitted) return '';
  if (submitted === owner) return coordinator;
  if (submitted === coordinator) return owner;

  return owner && owner !== submitted
    ? owner
    : coordinator && coordinator !== submitted
      ? coordinator
      : '';
}

function buildCcEmailList(...emails) {
  const seen = new Set();
  const ccList = [];

  emails.forEach((email) => {
    const normalized = normalizeEmail(email);
    if (!normalized || seen.has(normalized)) {
      return;
    }
    seen.add(normalized);
    ccList.push(normalized);
  });

  return ccList;
}

async function getCommunicationMatrixCcEmails(form, excludeEmails = []) {
  const excludeSet = new Set(
    excludeEmails
      .map((email) => normalizeEmail(email))
      .filter(Boolean)
  );

  const ccEmails = await getCcEmailsForRacm({
    companyIdentifier: form?.company_identifier,
    businessProcess: form?.business_process,
    unitId: form?.unit_id,
  });

  return ccEmails.filter((email) => !excludeSet.has(normalizeEmail(email)));
}

function resolveSubmitterRacmUrl(form, submittedByEmail, coordinatorEmail) {
  const ownerEmail = normalizeEmail(form?.control_owner);
  const submitter = normalizeEmail(submittedByEmail);
  const coordinator = normalizeEmail(coordinatorEmail);
  if (submitter && submitter === coordinator) {
    return buildCoordinatorFormDetailUrl(form?.form_id);
  }
  if (!submitter || submitter === ownerEmail) {
    return buildUserFormDetailUrl(form?.form_id);
  }
  return buildUserFormDetailUrl(form?.form_id);
}

async function notifyDeficiencyResponseSubmitted({
  form,
  deficiencyResponse,
}) {
  const approverEmail = String(form?.approver_email_id || '').trim();
  if (!approverEmail) {
    console.warn(`⚠️  No approver email found for form ${form?.form_id || ''}, deficiency response submit email not sent`);
    return;
  }

  const submittedByEmail = String(
    deficiencyResponse?.current_submission?.submitted_by_email
    || deficiencyResponse?.submitted_by_email
    || ''
  ).trim();
  const coordinatorEmail = await getCoordinatorEmailForUnit(form?.company_identifier, form?.unit_id);
  const racmUrl = buildApproverFormDetailUrl(form?.form_id);
  const responseFields = resolveDeficiencyResponseEmailFields(deficiencyResponse);
  const isCompensatoryRacm = String(responseFields.responseType || '').trim().toLowerCase() === 'compensatory_racm';
  const responseTypeLabel = isCompensatoryRacm ? 'Compensatory RACM' : 'Mitigation Plan';

  const responseDetailLines = ['Response Details:'];
  responseDetailLines.push(`- Submitted By: ${String(responseFields.submittedBy || '').trim() || 'N/A'}`);
  if (isCompensatoryRacm) {
    const documentCount = Number.isFinite(Number(responseFields.attachmentCount))
      ? Number(responseFields.attachmentCount)
      : 0;
    responseDetailLines.push(`- No of Documents: ${documentCount}`);
  } else {
    responseDetailLines.push(`- Concerned Person: ${String(responseFields.concernedPerson || '').trim() || 'N/A'}`);
    responseDetailLines.push(`- Due Date: ${formatDueDateDisplay(responseFields.dueDate)}`);
  }
  const responseDetailsBlock = responseDetailLines.join('\n');

  const controlNumberText = String(form?.control_number || '').trim() || String(form?.form_id || '').trim() || 'N/A';
  const businessProcessText = String(form?.business_process || '').trim() || 'Business Process';
  const emailSubject = `${responseTypeLabel} submitted for Control ${controlNumberText} - ${businessProcessText}`;

  let emailBody = 'Dear Approver,\n\n';
  emailBody += `A ${responseTypeLabel} has been submitted for your review.\n\n`;
  emailBody += `${responseDetailsBlock}\n\n`;
  emailBody += 'Please review the plan and mark RACM as effective if requirements are satisfied.\n\n';
  if (racmUrl) {
    emailBody += `RACM Link : ${racmUrl}\n\n`;
  }
  emailBody += 'Best regards,\nIFC System';

  const communicationMatrixCcEmails = await getCommunicationMatrixCcEmails(form, [approverEmail]);
  const ccEmails = buildCcEmailList(
    form?.control_owner,
    coordinatorEmail,
    ...communicationMatrixCcEmails
  ).filter((email) => email !== normalizeEmail(approverEmail));
  const emailSent = await sendEmail(
    approverEmail,
    emailSubject,
    emailBody,
    { cc: ccEmails }
  );

  if (!emailSent) {
    console.error(`⚠️  Failed to send deficiency response submit email for form ${form?.form_id || ''}`);
  }
}

async function notifyDeficiencyResponseReviewed({
  form,
  deficiencyResponse,
  reviewDecision,
  reviewComment,
}) {
  const submittedByEmail = String(
    deficiencyResponse?.current_submission?.submitted_by_email
    || deficiencyResponse?.submitted_by_email
    || ''
  ).trim();

  if (!submittedByEmail) {
    console.warn(`⚠️  No submitted_by_email found for form ${form?.form_id || ''}, deficiency response review email not sent`);
    return;
  }

  const coordinatorEmail = await getCoordinatorEmailForUnit(form?.company_identifier, form?.unit_id);
  const counterpartEmail = getCounterpartEmail({
    submittedByEmail,
    controlOwnerEmail: form?.control_owner,
    coordinatorEmail,
  });

  const normalizedDecision = String(reviewDecision || '').trim().toLowerCase();
  const isRejected = normalizedDecision === 'rejected' || normalizedDecision === 'reject';
  const statusLabel = isRejected ? 'Rejected' : 'Approved';
  const racmUrl = resolveSubmitterRacmUrl(form, submittedByEmail, coordinatorEmail);
  const responseFields = resolveDeficiencyResponseEmailFields(deficiencyResponse);
  const isCompensatoryRacm = String(responseFields.responseType || '').trim().toLowerCase() === 'compensatory_racm';
  const responseTypeLabel = isCompensatoryRacm ? 'Compensatory RACM' : 'Mitigation Plan';
  const controlNumberText = String(form?.control_number || '').trim() || String(form?.form_id || '').trim() || 'N/A';
  const businessProcessText = String(form?.business_process || '').trim() || 'Business Process';
  const subject = `Control ${controlNumberText} - ${businessProcessText} - ${responseTypeLabel} ${statusLabel}`;
  const reviewDecisionText = isRejected
    ? 'Rejected'
    : (String(reviewDecision || '').trim() || '-');
  const approverCommentText = String(reviewComment || '').trim() || '-';

  const responseDetailsBlock = [
    'Response Details:',
    `- Review Decision: ${reviewDecisionText}`,
    `- Approver Comment: ${approverCommentText}`,
  ].join('\n');

  let emailBody = 'Dear User,\n\n';
  emailBody += `Your ${responseTypeLabel} has been ${isRejected ? 'rejected' : 'approved'}.\n\n`;
  emailBody += `${responseDetailsBlock}\n\n`;

  if (isRejected) {
    emailBody += 'Please review the approver feedback and resubmit the Mitigation/Compensatory Plan on the IFC portal. Otherwise this RACM will remain ineffective.\n\n';
  } else {
    emailBody += 'No further action is required on this.\n\n';
  }

  if (racmUrl) {
    emailBody += `RACM: ${racmUrl}\n\n`;
  }
  emailBody += 'Best regards,\nIFC System';

  const communicationMatrixCcEmails = await getCommunicationMatrixCcEmails(form, [submittedByEmail]);
  const ccEmails = buildCcEmailList(
    counterpartEmail,
    ...communicationMatrixCcEmails
  ).filter((email) => email !== normalizeEmail(submittedByEmail));
  const emailSent = await sendEmail(
    submittedByEmail,
    subject,
    emailBody,
    { cc: ccEmails }
  );

  if (!emailSent) {
    console.error(`⚠️  Failed to send deficiency response review email for form ${form?.form_id || ''}`);
  }
}

module.exports = {
  getCoordinatorEmailForUnit,
  notifyDeficiencyResponseReviewed,
  notifyDeficiencyResponseSubmitted,
};
