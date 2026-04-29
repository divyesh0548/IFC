/**
 * Reminder emails job for control_forms.
 * Runs every 1 minute. reminder_frequency has three values: Daily, Weekly, Monthly.
 *
 * Send conditions:
 * - active = 1, status != 'Approved', current date >= due_date
 * - First time: reminder_datetime is empty → send as soon as current date is ahead of due_date
 * - Next times: send when current datetime reaches reminder_datetime
 * reminder_datetime is treated as the "next trigger at" timestamp.
 * After sending, reminder_datetime is updated to current IST time + interval.
 */

const { pool } = require('../utils/db');
const { sendEmail } = require('../utils/send_email');

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

function formatDateInMumbai(dt) {
  // En-CA gives YYYY-MM-DD and respects the provided IANA timezone.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(dt);
}

function formatDueDateDisplay(dueDateRaw) {
  if (!dueDateRaw) return 'TBD';

  // Most drivers return DATE either as 'YYYY-MM-DD' string or a Date object.
  if (typeof dueDateRaw === 'string') {
    const str = dueDateRaw.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
    const dt = new Date(str);
    if (Number.isNaN(dt.getTime())) return 'TBD';
    return formatDateInMumbai(dt);
  }

  const dt = dueDateRaw instanceof Date ? dueDateRaw : new Date(dueDateRaw);
  if (Number.isNaN(dt.getTime())) return 'TBD';
  return formatDateInMumbai(dt);
}

/**
 * Parse a DB timestamp value and interpret it as Asia/Kolkata local time
 * if the value is timezone-less (common with `timestamp without time zone`).
 *
 * @param {Date|string|null|undefined} value
 * @returns {Date|null}
 */
function parseTimestampAsMumbai(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  const str = String(value).trim();
  if (!str) return null;

  // If the string already includes timezone info, let JS parse it normally.
  // Examples: "...Z", "...+05:30"
  if (/[zZ]$/.test(str) || /[+-]\d\d:\d\d$/.test(str)) {
    const d = new Date(str);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  // Handle common formats like "YYYY-MM-DD HH:MM:SS[.ffffff]"
  // by appending the fixed IST offset.
  const m = str.match(
    /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})(\.\d+)?$/
  );
  if (!m) {
    const d = new Date(str);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  const [, datePart, timePart, fractional] = m;
  const isoLike = `${datePart}T${timePart}${fractional || ''}+05:30`;
  const d = new Date(isoLike);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Fetch rows that qualify for a reminder.
 */
async function fetchFormsDueForReminder(client) {
  const query = `
    SELECT
      form_id,
      control_owner,
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
      AND (
        reminder_datetime IS NULL
        OR (
          -- reminder_datetime stores the next trigger timestamp
          (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata') >= reminder_datetime::timestamp
        )
      )
  `;
  const result = await client.query(query);
  return result.rows;
}

/**
 * Normalize reminder frequency into a valid SQL interval string.
 */
function getIntervalLiteral(reminderFrequency) {
  const str = String(reminderFrequency || '').trim();
  switch (str) {
    case 'Weekly':
      return '7 days';
    case 'Monthly':
      return '30 days';
    case 'Daily':
    default:
      return '1 day';
  }
}

/**
 * Update reminder_datetime for a form (next trigger at).
 */
async function updateReminderDatetime(client, formId, reminderFrequency) {
  const intervalLiteral = getIntervalLiteral(reminderFrequency);
  const result = await client.query(
    `
      UPDATE control_forms
      -- Store next trigger timestamp in IST wall-clock time.
      SET reminder_datetime = (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata') + ($2::interval)
      WHERE form_id = $1
      RETURNING reminder_datetime;
    `,
    [formId, intervalLiteral]
  );
  return result.rows?.[0]?.reminder_datetime || null;
}

/**
 * Build reminder email body.
 */
function buildReminderEmailBody(form) {
  const dueStr = formatDueDateDisplay(form.due_date);
  const formUrl = process.env.FRONTEND_URL
    ? `${process.env.FRONTEND_URL}/user/form/${form.form_id}`
    : null;
  return `Hello ${form.control_owner || 'Control Owner'},

This is a reminder that your RACM (Risk and Control Matrix) is pending.

Business Process: ${form.business_process || 'N/A'}
Control: ${form.standard_control_description || 'N/A'}
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
    // Enforce IST for this session explicitly (defensive even though pool connect sets it).
    await client.query(`SET TIME ZONE 'Asia/Kolkata'`);

    const forms = await fetchFormsDueForReminder(client);
    if (forms.length === 0) return;

    for (const form of forms) {
      const to = (form.control_owner || '').trim();

      // Validate email before attempting to send. If invalid/missing, skip send but still update reminder_datetime.
      if (!isValidEmail(to)) {
        const updatedAt = await updateReminderDatetime(client, form.form_id, form.reminder_frequency);
        const updatedAtMumbai = updatedAt ? formatDateInMumbai(parseTimestampAsMumbai(updatedAt)) : null;
        console.warn(
          `[reminder_emails] form_id=${form.form_id} has invalid/empty control_owner "${to}", skipped email, updated reminder_datetime to ${
            updatedAt ? updatedAtMumbai : 'null'
          } (UTC=${updatedAt ? new Date(updatedAt).toISOString() : 'null'})`
        );
        continue;
      }

      const subject = 'Reminder: RACM pending – ' + (form.business_process || 'IFC');
      const text = buildReminderEmailBody(form);

      const sent = await sendEmail(to, subject, text);
      if (sent) {
        const updatedAt = await updateReminderDatetime(client, form.form_id, form.reminder_frequency);
        const updatedAtMumbai = updatedAt ? formatDateInMumbai(parseTimestampAsMumbai(updatedAt)) : null;
        console.log(
          `[reminder_emails] Sent reminder to ${to} for form_id=${form.form_id}, updated reminder_datetime to ${
            updatedAt ? updatedAtMumbai : 'null'
          } (UTC=${updatedAt ? new Date(updatedAt).toISOString() : 'null'})`
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
