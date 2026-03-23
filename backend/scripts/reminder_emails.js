/**
 * Reminder emails job for control_forms.
 * Runs every 1 minute. reminder_frequency has three values: Daily, Weekly, Monthly.
 *
 * Send conditions:
 * - active = 1, status != 'Approved', current date >= due_date
 * - First time: reminder_datetime is empty → send as soon as current date is ahead of due_date
 * - Next times:
 *   - Daily: send when current datetime is 24 hours ahead of reminder_datetime
 *   - Weekly: send when current datetime is 7 days ahead of reminder_datetime
 *   - Monthly: send when current datetime is 30 days ahead of reminder_datetime
 * After sending, reminder_datetime is set to next run (now + 24h / 7d / 30d).
 */

const nodemailer = require('nodemailer');
const { pool } = require('../utils/db');

/**
 * Basic RFC5322-inspired email validation.
 * Intentionally conservative: ensures there is one "@", non-empty local/domain,
 * domain has at least one dot, and no spaces.
 */
function isValidEmail(value) {
  const email = String(value || '').trim();
  if (!email) return false;
  // Simple, practical regex (not exhaustive by design)
  const re =
    /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  return re.test(email);
}

async function sendEmail(to, subject, text) {
  if (!to || !String(to).trim()) return false;
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT, 10) || 587,
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: to.trim(),
      subject,
      text,
    });
    return true;
  } catch (err) {
    console.error('[reminder_emails] Send error:', err.message);
    return false;
  }
}

/**
 * Get next reminder datetime based on reminder_frequency.
 * Only three values: Daily (24h), Weekly (7 days), Monthly (30 days).
 * Returns a Date = now + interval so the next run triggers when current datetime is ahead of it.
 */
function getNextReminderDatetime(reminderFrequency) {
  const now = new Date();
  const str = String(reminderFrequency || '').trim();
  const next = new Date(now);

  switch (str) {
    case 'Daily':
      next.setDate(next.getDate() + 1); // 24 hours ahead
      return next;
    case 'Weekly':
      next.setDate(next.getDate() + 7); // 7 days ahead
      return next;
    case 'Monthly':
      next.setDate(next.getDate() + 30); // 30 days ahead
      return next;
    default:
      // Unknown: treat as Daily (24h)
      next.setDate(next.getDate() + 1);
      return next;
  }
}

function formatDueDateDisplay(dueDateRaw) {
  if (!dueDateRaw) return 'TBD';
  const str = String(dueDateRaw).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  const dt = new Date(str);
  if (Number.isNaN(dt.getTime())) return 'TBD';
  return dt.toISOString().slice(0, 10);
}

/**
 * Fetch rows that qualify for a reminder.
 */
async function fetchFormsDueForReminder(client) {
  const query = `
    SELECT
      form_id,
      process_owner,
      standard_control_description,
      business_process,
      due_date,
      reminder_frequency,
      reminder_datetime
    FROM control_forms
    WHERE active IS NOT NULL AND TRIM(active) != '' AND active != '0'
      AND (status IS NULL OR TRIM(status) = '' OR status != 'Approved')
      AND due_date IS NOT NULL
      AND CURRENT_DATE >= due_date
      AND (reminder_datetime IS NULL OR CURRENT_TIMESTAMP >= reminder_datetime)
  `;
  const result = await client.query(query);
  return result.rows;
}

/**
 * Update reminder_datetime for a form (next run time).
 */
async function updateReminderDatetime(client, formId, nextDatetime) {
  await client.query(
    `UPDATE control_forms SET reminder_datetime = $1 WHERE form_id = $2`,
    [nextDatetime, formId]
  );
}

/**
 * Build reminder email body.
 */
function buildReminderEmailBody(form) {
  const dueStr = formatDueDateDisplay(form.due_date);
  const formUrl = process.env.FRONTEND_URL
    ? `${process.env.FRONTEND_URL}/user/form/${form.form_id}`
    : null;
  return `Hi,

This is a reminder that your RACM (Risk and Control Matrix) is pending.

Control: ${form.standard_control_description || 'N/A'}
Business Process: ${form.business_process || 'N/A'}
Due date: ${dueStr}

${formUrl ? `Access your RACM: ${formUrl}\n\n` : ''}${process.env.FRONTEND_URL ? `Portal: ${process.env.FRONTEND_URL}` : ''}

Please complete and submit your evidence at your earliest convenience.

Regards,
IFC System
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
      const to = (form.process_owner || '').trim();
      const next = getNextReminderDatetime(form.reminder_frequency);

      // Validate email before attempting to send. If invalid/missing, skip send but still update reminder_datetime.
      if (!isValidEmail(to)) {
        await updateReminderDatetime(client, form.form_id, next);
        console.warn(
          `[reminder_emails] form_id=${form.form_id} has invalid/empty process_owner "${to}", skipped email, next at ${next.toISOString()}`
        );
        continue;
      }

      const subject = 'Reminder: RACM pending – ' + (form.business_process || 'IFC');
      const text = buildReminderEmailBody(form);

      const sent = await sendEmail(to, subject, text);
      if (sent) {
        await updateReminderDatetime(client, form.form_id, next);
        console.log(
          `[reminder_emails] Sent reminder to ${to} for form_id=${form.form_id}, next at ${next.toISOString()}`
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
