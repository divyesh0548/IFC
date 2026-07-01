const { pool } = require('./db');
const { sendEmail } = require('./send_email');
const { getCcEmailsForRacm } = require('./racm_cc_recipients');
const {
  buildDeficiencyResponseDetailsSection,
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
  const responseDetailsBlock = buildDeficiencyResponseDetailsSection({
    ...responseFields,
    dueDate: formatDueDateDisplay(responseFields.dueDate),
  });

  let emailBody = 'Dear Approver,\n\n';
  emailBody += 'A deficiency response has been submitted for your review.\n\n';
  emailBody += `${responseDetailsBlock}\n\n`;
  emailBody += 'Please review the deficiency response in the IFC system.\n\n';
  if (racmUrl) {
    emailBody += `RACM: ${racmUrl}\n\n`;
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
    'Internal Financial Controls - Deficiency Response Submitted',
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
  const subject = `Internal Financial Controls - Deficiency Response ${isRejected ? 'Rejected' : 'Approved'}`;
  const racmUrl = resolveSubmitterRacmUrl(form, submittedByEmail, coordinatorEmail);
  const responseFields = resolveDeficiencyResponseEmailFields(deficiencyResponse);
  const responseDetailsBlock = buildDeficiencyResponseDetailsSection({
    ...responseFields,
    dueDate: formatDueDateDisplay(responseFields.dueDate),
    reviewDecision: String(reviewDecision || '').trim() || '-',
  });

  let emailBody = 'Dear User,\n\n';
  emailBody += `Your deficiency response has been ${isRejected ? 'rejected' : 'approved'}.\n\n`;
  emailBody += `${responseDetailsBlock}\n`;

  if (String(reviewComment || '').trim()) {
    emailBody += `\nApprover Comment:\n${String(reviewComment).trim()}\n`;
  }

  if (isRejected) {
    emailBody += '\nPlease review the approver feedback and resubmit the deficiency response in the IFC system.\n\n';
  } else {
    emailBody += '\nNo further action is required on this deficiency response.\n\n';
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
