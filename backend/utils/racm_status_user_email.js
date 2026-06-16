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

function getPortalUrl() {
  return process.env.VITE_FRONTEND_URL || process.env.FRONTEND_URL || '';
}

function buildRacmActiveUserEmail({
  businessProcess,
  processOwnerName,
  coordinatorName,
  coordinatorCompanyName,
  dueDate,
}) {
  const recipientName = processOwnerName || 'Process Owner';
  const coordinatorDisplayName = coordinatorName || 'Company Coordinator';
  const coordinatorCompanyDisplayName = coordinatorCompanyName || 'Company';
  const formattedDueDate = formatDueDateDisplay(dueDate);
  const portalUrl = getPortalUrl();

  return {
    shouldSend: true,
    subject: `Your IFC testing for ${businessProcess || 'your assignment'} is ready`,
    text: `Hi ${recipientName},

Hope you're having a good week!

I'm reaching out because your Internal Financial Controls assignment for ${businessProcess || 'your business process'} is now ready in the system. Nothing complicated; we just need your help to keep things moving.

Here's what we need from you:

1. You'll see the risk and control matrix from last year. Take a quick look through from here (View of the Risk & Control key issues) especially the risks we identified and the controls we put in place. You'll also spot the evidence that was submitted last year, which should give you a good sense of what we're looking for. (You will be able to download the evidence that was submitted last year.)

2. Upload the evidence for this year's testing against each control. The period and the amount of samples can be viewed in the RACM detail page.

What happens next?

Once you submit your evidence, our tester will review it to check if the control is operating effectively. They'll either pass or fail the control based on what they see. So the clearer your evidence, the smoother that review goes!

Deadline: ${formattedDueDate}
${portalUrl ? `\nPortal: ${portalUrl}` : ''}

Just shout if you hit any snags or have questions or you have any feedback on the performance of the controls or have noted any significant breaches; I'm happy to help.

Thanks for cooperating.

Regards,
${coordinatorDisplayName}
${coordinatorCompanyDisplayName}
`,
  };
}

function buildRacmInactiveUserEmail({
  businessProcess,
  processOwnerName,
  coordinatorName,
  coordinatorCompanyName,
}) {
  const recipientName = processOwnerName || 'Process Owner';
  const coordinatorDisplayName = coordinatorName || 'Company Coordinator';
  const coordinatorCompanyDisplayName = coordinatorCompanyName || 'Company';
  const portalUrl = getPortalUrl();
  const processLabel = businessProcess || 'your business process';

  return {
    shouldSend: true,
    subject: `Your IFC testing for ${processLabel} is now inactive`,
    text: `Hi ${recipientName},

Your Internal Financial Controls assignment for ${processLabel} has been set to Inactive.

This RACM will no longer appear on your dashboard until it is set to Active again by your company coordinator.

If you have any questions, please contact your coordinator.
${portalUrl ? `\nPortal: ${portalUrl}` : ''}

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
    LOWER(TRIM(cf.control_owner)) AS control_owner_email,
    NULLIF(TRIM(owner.emp_name), '') AS control_owner_name,
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
  LEFT JOIN ifc_users coordinator
    ON LOWER(TRIM(coordinator.email_id)) = LOWER(TRIM(COALESCE(cum.coordinator_email_id, '')))
   AND coordinator.company_identifier = cf.company_identifier
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

  const processOwnerEmail = String(row.control_owner_email || '').trim().toLowerCase();
  if (!processOwnerEmail) return false;

  const payload = buildRacmInactiveUserEmail({
    businessProcess: row.business_process || '',
    processOwnerName: row.control_owner_name || '',
    coordinatorName: row.coordinator_name || '',
    coordinatorCompanyName: row.company_name || '',
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
  buildRacmActiveUserEmail,
  buildRacmInactiveUserEmail,
  sendInactiveRacmUserEmailForFormId,
  RACM_STATUS_EMAIL_SELECT,
};
