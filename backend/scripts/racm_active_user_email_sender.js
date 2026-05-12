const { pool } = require('../utils/db');
const { sendEmail } = require('../utils/send_email');
const { getCcEmailsForRacm } = require('../utils/racm_cc_recipients');

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

function buildControlFormStatusEmail(status, businessProcess, processOwnerName, coordinatorName, coordinatorCompanyName, dueDate, formId) {
  const recipientName = processOwnerName || 'Control Owner';
  const coordinatorDisplayName = coordinatorName || 'Company Coordinator';
  const coordinatorCompanyDisplayName = coordinatorCompanyName || 'Company';
  const formattedDueDate = formatDueDateDisplay(dueDate);

  if (status !== 'Active') {
    return { shouldSend: false };
  }

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
`,
  };
}

async function runPendingRacmActiveUserEmails() {
  const pendingResult = await pool.query(
    `
      SELECT
        cf.form_id,
        cf.business_process,
        cf.due_date,
        cf.company_identifier,
        cf.unit_id,
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
      WHERE COALESCE(TRIM(cf.control_owner), '') <> ''
        AND COALESCE(cf.user_mail_sent, FALSE) = FALSE
        AND cf.active = TRUE
      ORDER BY cf.created_at ASC NULLS LAST, cf.id ASC
    `
  );

  if (pendingResult.rows.length === 0) return;

  for (const row of pendingResult.rows) {
    const processOwnerEmail = String(row.control_owner_email || '').trim().toLowerCase();
    if (!processOwnerEmail) continue;

    const payload = buildControlFormStatusEmail(
      'Active',
      row.business_process || '',
      row.control_owner_name || '',
      row.coordinator_name || '',
      row.company_name || '',
      row.due_date,
      row.form_id
    );
    if (!payload.shouldSend) continue;

    try {
      const ccEmails = await getCcEmailsForRacm({
        companyIdentifier: row.company_identifier,
        businessProcess: row.business_process,
        unitId: row.unit_id,
        excludeEmail: processOwnerEmail,
      });
      const emailSent = await sendEmail(processOwnerEmail, payload.subject, payload.text, { cc: ccEmails });
      if (!emailSent) {
        console.warn(`[racm-active-user-email] Failed email for form ${row.form_id}`);
        continue;
      }

      await pool.query(
        `
          UPDATE control_forms
          SET user_mail_sent = TRUE,
              updated_at = CURRENT_TIMESTAMP
          WHERE form_id = $1
        `,
        [row.form_id]
      );
      console.log(`[racm-active-user-email] Email sent and marked for form ${row.form_id}`);
    } catch (error) {
      console.error(`[racm-active-user-email] Error processing form ${row.form_id}:`, error);
    }
  }
}

module.exports = { runPendingRacmActiveUserEmails };
