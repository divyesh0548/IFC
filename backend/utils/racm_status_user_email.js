const { pool } = require('./db');
const { sendEmail } = require('./send_email');
const { getCcEmailsForRacm } = require('./racm_cc_recipients');

function formatDueDateDisplay(dueDate) {
  if (!dueDate) return 'Not specified';
  const date = new Date(dueDate);
  if (Number.isNaN(date.getTime())) return String(dueDate);
  const day = date.getUTCDate();
  const monthName = date.toLocaleString('en-US', { month: 'long', timeZone: 'UTC' });
  const year = date.getUTCFullYear();
  const getOrdinal = (n) => {
    const lastTwo = n % 100;
    if (lastTwo >= 11 && lastTwo <= 13) return `${n}th`;
    switch (n % 10) {
      case 1: return `${n}st`;
      case 2: return `${n}nd`;
      case 3: return `${n}rd`;
      default: return `${n}th`;
    }
  };
  return `${getOrdinal(day)} ${monthName}, ${year}`;
}

function getPortalBaseUrl() {
  return String(process.env.VITE_FRONTEND_URL || process.env.FRONTEND_URL || '').trim().replace(/\/$/, '');
}

function buildUserFormDetailUrl(formId) {
  const base = getPortalBaseUrl();
  const normalizedFormId = String(formId || '').trim();
  if (!base || !normalizedFormId) return '';
  return `${base}/user/form/${encodeURIComponent(normalizedFormId)}`;
}

function buildApproverFormDetailUrl(formId) {
  const base = getPortalBaseUrl();
  const normalizedFormId = String(formId || '').trim();
  if (!base || !normalizedFormId) return '';
  return `${base}/approver/form/${encodeURIComponent(normalizedFormId)}`;
}

function resolveCoordinatorDisplayName(coordinatorName) {
  const name = String(coordinatorName || '').trim();
  if (name && !name.includes('@')) return name;
  return 'Company Coordinator';
}

function replaceTemplateVariables(template, variables) {
  return String(template || '').replace(/\{\{(\w+)\}\}/g, (match, key) => {
    if (Object.prototype.hasOwnProperty.call(variables, key)) return variables[key] ?? '';
    return match;
  });
}

async function fetchCustomTemplate(companyIdentifier, unitId) {
  if (!companyIdentifier || !unitId) return null;
  try {
    const result = await pool.query(
      `SELECT email_subject, email_body FROM company_email_templates
       WHERE company_identifier = $1 AND unit_id = $2 LIMIT 1`,
      [companyIdentifier, unitId]
    );
    if (result.rows.length === 0) return null;
    const row = result.rows[0];
    if (!row.email_subject && !row.email_body) return null;
    return row;
  } catch (err) {
    console.error('[email-templates] fetchCustomTemplate error:', err);
    return null;
  }
}

function buildRacmActiveUserEmail({
  businessProcess,
  processOwnerName,
  coordinatorName,
  coordinatorCompanyName,
  dueDate,
  formId,
  customTemplate,
}) {
  const recipientName = processOwnerName || 'Process Owner';
  const coordinatorCompanyDisplayName = coordinatorCompanyName || 'Company';
  const formattedDueDate = formatDueDateDisplay(dueDate);
  const formUrl = buildUserFormDetailUrl(formId);
  const portalUrl = getPortalBaseUrl();
  const racmLink = formUrl || portalUrl || '';

  if (customTemplate && (customTemplate.email_subject || customTemplate.email_body)) {
    const vars = {
      recipientName,
      businessProcess: businessProcess || 'your business process',
      formattedDueDate,
      racmLink,
      coordinatorCompanyName: coordinatorCompanyDisplayName,
    };
    return {
      shouldSend: true,
      subject: customTemplate.email_subject
        ? replaceTemplateVariables(customTemplate.email_subject, vars)
        : `Your IFC testing for ${businessProcess || 'your assignment'} is ready`,
      text: customTemplate.email_body
        ? replaceTemplateVariables(customTemplate.email_body, vars)
        : buildDefaultActiveEmailBody({ recipientName, businessProcess, formattedDueDate, formUrl, portalUrl, coordinatorCompanyDisplayName }),
    };
  }

  return {
    shouldSend: true,
    subject: `Your IFC testing for ${businessProcess || 'your assignment'} is ready`,
    text: buildDefaultActiveEmailBody({ recipientName, businessProcess, formattedDueDate, formUrl, portalUrl, coordinatorCompanyDisplayName }),
  };
}

function buildDefaultActiveEmailBody({ recipientName, businessProcess, formattedDueDate, formUrl, portalUrl, coordinatorCompanyDisplayName }) {
  return `Hi ${recipientName},

Hope you're having a good week!

I'm reaching out because your Internal Financial Controls assignment for ${businessProcess || 'your business process'} is now ready in the system. Nothing complicated; we just need your help to keep things moving.

Here's what we need from you:

1. You'll see the risk and control matrix from last year. Take a quick look through from here (View of the Risk & Control key issues) especially the risks we identified and the controls we put in place. You'll also spot the evidence that was submitted last year, which should give you a good sense of what we're looking for. (You will be able to download the evidence that was submitted last year.)

2. Upload the evidence for this year's testing against each control. The period and the amount of samples can be viewed in the RACM detail page.

What happens next?

Once you submit your evidence, our tester will review it to check if the control is operating effectively. They'll either pass or fail the control based on what they see. So the clearer your evidence, the smoother that review goes!

Deadline: ${formattedDueDate}

Just shout if you hit any snags or have questions or you have any feedback on the performance of the controls or have noted any significant breaches; I'm happy to help.
${formUrl ? `\nRACM: ${formUrl}` : (portalUrl ? `\nRACM: ${portalUrl}` : '')}

Thanks for cooperating.

Regards,
${coordinatorCompanyDisplayName}
`;
}

function buildRacmInactiveUserEmail({
  businessProcess,
  processOwnerName,
  coordinatorName,
  coordinatorCompanyName,
  formId,
}) {
  const recipientName = processOwnerName || 'Process Owner';
  const coordinatorDisplayName = resolveCoordinatorDisplayName(coordinatorName);
  const coordinatorCompanyDisplayName = coordinatorCompanyName || 'Company';
  const formUrl = buildUserFormDetailUrl(formId);
  const portalUrl = getPortalBaseUrl();
  const processLabel = businessProcess || 'your business process';

  return {
    shouldSend: true,
    subject: `Your IFC testing for ${processLabel} is now inactive`,
    text: `Hi ${recipientName},

Your Internal Financial Controls assignment for ${processLabel} has been set to Inactive.

This RACM will no longer appear on your dashboard until it is set to Active again by your company coordinator.

If you have any questions, please contact your coordinator.
${formUrl ? `\nRACM: ${formUrl}` : (portalUrl ? `\nRACM: ${portalUrl}` : '')}

Regards,
${coordinatorDisplayName}
${coordinatorCompanyDisplayName}
`,
  };
}

const RACM_STATUS_EMAIL_SELECT = `
  SELECT
    cf.form_id,
    cf.business_process,
    cf.due_date,
    cf.company_identifier,
    cf.unit_id,
    cf.active,
    cf.assigned_to_coordinator,
    LOWER(TRIM(cf.control_owner)) AS control_owner_email,
    NULLIF(TRIM(owner.emp_name), '') AS control_owner_name,
    NULLIF(TRIM(coordinator_map.coordinator_email_id), '') AS coordinator_email_id,
    NULLIF(TRIM(coordinator.emp_name), '') AS coordinator_name,
    NULLIF(TRIM(c.company_name), '') AS company_name
  FROM control_forms cf
  LEFT JOIN ifc_users owner
    ON LOWER(TRIM(owner.email_id)) = LOWER(TRIM(cf.control_owner))
   AND owner.company_identifier = cf.company_identifier
   AND owner.role = 'user'
  LEFT JOIN company_unit_master cum
    ON cum.company_identifier = cf.company_identifier
   AND cum.unit_id = cf.unit_id
  LEFT JOIN LATERAL (
    SELECT cua.coordinator_email_id
    FROM coordinator_unit_assignments cua
    WHERE cua.company_identifier = cf.company_identifier
      AND cua.unit_id = cf.unit_id
      AND COALESCE(TRIM(cua.coordinator_email_id), '') <> ''
    ORDER BY LOWER(TRIM(cua.coordinator_email_id)) ASC
    LIMIT 1
  ) coordinator_map ON TRUE
  LEFT JOIN ifc_users coordinator
    ON LOWER(TRIM(coordinator.email_id)) = LOWER(TRIM(COALESCE(coordinator_map.coordinator_email_id, '')))
  LEFT JOIN companies c
    ON c.company_identifier = cf.company_identifier
`;

async function sendInactiveRacmUserEmailForFormId(formId) {
  const normalizedFormId = String(formId || '').trim();
  if (!normalizedFormId) return false;

  const result = await pool.query(
    `${RACM_STATUS_EMAIL_SELECT}
      WHERE cf.form_id = $1
      LIMIT 1
    `,
    [normalizedFormId]
  );

  if (result.rows.length === 0) return false;

  const row = result.rows[0];
  if (row.active === true) return false;
  if (row.assigned_to_coordinator === true) return false;

  const processOwnerEmail = String(row.control_owner_email || '').trim().toLowerCase();
  if (!processOwnerEmail) return false;

  const payload = buildRacmInactiveUserEmail({
    businessProcess: row.business_process || '',
    processOwnerName: row.control_owner_name || '',
    coordinatorName: row.coordinator_name || '',
    coordinatorCompanyName: row.company_name || '',
    formId: row.form_id,
  });
  if (!payload.shouldSend) return false;

  const ccEmails = await getCcEmailsForRacm({
    companyIdentifier: row.company_identifier,
    businessProcess: row.business_process,
    unitId: row.unit_id,
    excludeEmail: processOwnerEmail,
  });

  const emailSent = await sendEmail(processOwnerEmail, payload.subject, payload.text, { cc: ccEmails });
  if (!emailSent) {
    console.warn(`[racm-inactive-user-email] Failed email for form ${normalizedFormId}`);
    return false;
  }

  console.log(`[racm-inactive-user-email] Email sent for form ${normalizedFormId}`);
  return true;
}

module.exports = {
  formatDueDateDisplay,
  buildUserFormDetailUrl,
  buildApproverFormDetailUrl,
  resolveCoordinatorDisplayName,
  buildRacmActiveUserEmail,
  buildRacmInactiveUserEmail,
  sendInactiveRacmUserEmailForFormId,
  fetchCustomTemplate,
  RACM_STATUS_EMAIL_SELECT,
};
