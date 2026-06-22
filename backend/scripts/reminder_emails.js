/**
 * Reminder emails job for control_forms.
 * Runs every 1 minute. reminder_frequency has three values: Daily, Weekly, Monthly.
 *
 * Send conditions:
 * - active = TRUE, status != 'Approved', current date >= due_date
 * - First time: reminder_datetime is empty → send as soon as current date is ahead of due_date
 * - Next times: send when current datetime reaches reminder_datetime
 * reminder_datetime is treated as the "next trigger at" timestamp.
 * After sending, reminder_datetime is updated to current UTC time + interval.
 */

const { pool } = require('../utils/db');
const { sendEmail } = require('../utils/send_email');
const {
  updateReminderDatetime,
  REMINDER_DATETIME_DUE_SQL,
  formatReminderTimestampForLog,
  formatDueDateForEmail,
} = require('../utils/controls_reminder');
const { buildRacmDetailsSection } = require('../utils/racm_email_details');

const IST_CURRENT_DATE_SQL = `((CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::date)`;

function isValidEmail(value) {
  const email = String(value || '').trim();
  if (!email) return false;
  // Simple, practical regex (not exhaustive by design)
  const re =
    /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  return re.test(email);
}

/**
 * Get next reminder datetime based on reminder_frequency.
 * Only three values: Daily (24h), Weekly (7 days), Monthly (30 days).
 * Returns a Date = now + interval so the next run triggers when current datetime is ahead of it.
 */
// (Kept for reference; next send time is computed in SQL now.)
function getNextReminderDatetime(reminderFrequency) {
  const now = new Date();
  const str = String(reminderFrequency || '').trim();
  const next = new Date(now);

  switch (str) {
    case 'Daily':
      next.setDate(next.getDate() + 1);
      return next;
    case 'Weekly':
      next.setDate(next.getDate() + 7);
      return next;
    case 'Monthly':
      next.setDate(next.getDate() + 30);
      return next;
    default:
      next.setDate(next.getDate() + 1);
      return next;
  }
}

/**
 * Fetch rows that qualify for a reminder.
 */
async function fetchFormsDueForReminder(client) {
  const query = `
    SELECT
      cf.form_id,
      cf.control_owner,
      owner_u.emp_name AS control_owner_emp_name,
      cf.standard_control_description,
      cf.business_process,
      cf.due_date,
      cf.reminder_frequency,
      cr.reminder_datetime,
      c.company_name
    FROM control_forms cf
    LEFT JOIN controls_reminder cr
      ON cr.form_id = cf.form_id
    LEFT JOIN ifc_users owner_u
      ON owner_u.company_identifier = cf.company_identifier
     AND LOWER(TRIM(COALESCE(owner_u.email_id, ''))) = LOWER(TRIM(COALESCE(cf.control_owner, '')))
    LEFT JOIN companies c
      ON c.company_identifier = cf.company_identifier
    WHERE active = TRUE
      AND (status IS NULL OR TRIM(status) = '' OR status != 'Approved')
      AND due_date IS NOT NULL
      AND ${IST_CURRENT_DATE_SQL} >= due_date
      AND (
        cr.reminder_datetime IS NULL
        OR (
          -- reminder_datetime stores the next trigger timestamp (UTC)
          ${REMINDER_DATETIME_DUE_SQL}
        )
      )
  `;
  const result = await client.query(query);
  return result.rows;
}

/**
 * Build reminder email body.
 */
function buildReminderEmailBody(form) {
  const dueStr = formatDueDateForEmail(form.due_date);
  const companyName = String(form.company_name || '').trim() || 'IFC';
  const ownerSalutation =
    String(form.control_owner_emp_name || '').trim() || 'Process Owner';
  const formUrl = process.env.FRONTEND_URL
    ? `${process.env.FRONTEND_URL}/user/form/${form.form_id}`
    : null;
  return `Dear ${ownerSalutation},

This is a reminder that your RACM (Risk and Control Matrix) is pending.

${buildRacmDetailsSection(form, [
  ['Due Date', dueStr],
])}

${process.env.FRONTEND_URL ? `Portal: ${process.env.FRONTEND_URL}` : ''}

Please complete and submit your evidence at your earliest convenience.

Regards,
${companyName}
`;
}

/**
 * Run one cycle: find forms due for reminder, send emails, update reminder_datetime.
 */
async function runReminderEmails() {
  const client = await pool.connect();
  try {
    const forms = await fetchFormsDueForReminder(client);
    if (forms.length === 0) return;

    for (const form of forms) {
      const to = (form.control_owner || '').trim();

      // Validate email before attempting to send. If invalid/missing, skip send but still update reminder_datetime.
      if (!isValidEmail(to)) {
        const updatedAt = await updateReminderDatetime(client, form.form_id, form.reminder_frequency);
        console.warn(
          `[reminder_emails] form_id=${form.form_id} has invalid/empty control_owner "${to}", skipped email, updated reminder_datetime to ${
            formatReminderTimestampForLog(updatedAt) || 'null'
          }`
        );
        continue;
      }

      const subject = 'Reminder: RACM pending – ' + (form.business_process || 'IFC');
      const text = buildReminderEmailBody(form);

      const sent = await sendEmail(to, subject, text);
      if (sent) {
        const updatedAt = await updateReminderDatetime(client, form.form_id, form.reminder_frequency);
        console.log(
          `[reminder_emails] Sent reminder to ${to} for form_id=${form.form_id}, updated reminder_datetime to ${
            formatReminderTimestampForLog(updatedAt) || 'null'
          }`
        );
      }
    }
  } catch (err) {
    console.error('[reminder_emails] Error:', err);
  } finally {
    client.release();
  }
}

module.exports = { runReminderEmails };
