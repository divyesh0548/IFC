/**
 * Reminder emails job for control_forms.
 * Runs every 1 minute. reminder_frequency has three values: Daily, Weekly, Monthly.
 *
 * Send conditions:
 * - active = TRUE, status != 'Approved', current date >= due_date
 * - Cycle is still open (final_reminder_sent_at is empty)
 * - First time: reminder_datetime is empty → send as soon as current date is ahead of due_date
 * - Next times: send when current datetime reaches reminder_datetime
 * reminder_datetime is treated as the "next trigger at" timestamp.
 * After a normal send, reminder_sent_count increases and reminder_datetime moves forward.
 * Once reminder_sent_count reaches REMINDER_FINAL_AFTER, the next email is the final
 * reminder. That send sets final_reminder_sent_at and no further emails are sent
 * until the due date reset clears the cycle.
 */

const { pool } = require('../../utils/db');
const { sendEmail } = require('../../utils/send_email');
const { getCcEmailsForRacm } = require('../../utils/racm_cc_recipients');
const {
  updateReminderDatetime,
  recordNormalProcessOwnerReminder,
  recordFinalProcessOwnerReminder,
  getReminderFinalAfter,
  REMINDER_DATETIME_DUE_SQL,
  formatReminderTimestampForLog,
  formatDueDateForEmail,
} = require('../../utils/controls_reminder');
const { utcTs } = require('../../utils/sqlUtcTimestamps');
const { buildRacmDetailsSection } = require('../../utils/racm_email_details');
const { isCoordinatorAssignedRacm, buildCoordinatorFormDetailUrl } = require('../../utils/racm_coordinator_assignment');
const { buildUserFormDetailUrl } = require('../../utils/racm_status_user_email');

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
      cf.assigned_to_coordinator,
      cf.coordinator_assigned_by,
      owner_u.emp_name AS control_owner_emp_name,
      coordinator_u.emp_name AS coordinator_emp_name,
      cf.control_number,
      cf.standard_control_description,
      cf.business_process,
      cf.due_date,
      cf.reminder_frequency,
      COALESCE(cr.reminder_sent_count, 0) AS reminder_sent_count,
      ${utcTs('cr.reminder_datetime')},
      c.company_name
    FROM control_forms cf
    LEFT JOIN controls_reminder cr
      ON cr.form_id = cf.form_id
    LEFT JOIN ifc_users owner_u
      ON owner_u.company_identifier = cf.company_identifier
     AND LOWER(TRIM(COALESCE(owner_u.email_id, ''))) = LOWER(TRIM(COALESCE(cf.control_owner, '')))
    LEFT JOIN ifc_users coordinator_u
      ON coordinator_u.company_identifier = cf.company_identifier
     AND LOWER(TRIM(COALESCE(coordinator_u.email_id, ''))) = LOWER(TRIM(COALESCE(cf.coordinator_assigned_by, '')))
    LEFT JOIN companies c
      ON c.company_identifier = cf.company_identifier
    LEFT JOIN process_owner_declaration pod
      ON pod.form_id = cf.form_id
    WHERE active = TRUE
      AND (status IS NULL OR TRIM(status) = '' OR status != 'Approved')
      AND COALESCE(pod.no_furthure_submission, FALSE) = FALSE
      AND due_date IS NOT NULL
      AND ${IST_CURRENT_DATE_SQL} >= due_date
      AND cr.final_reminder_sent_at IS NULL
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
function buildReminderEmailBody(form, { finalReminder = false } = {}) {
  const dueStr = formatDueDateForEmail(form.due_date);
  const companyName = String(form.company_name || '').trim();
  const controlNumberText = String(form.control_number || '').trim() || String(form.form_id || '').trim() || 'N/A';
  const isCoordinatorAssigned = isCoordinatorAssignedRacm(form);
  const ownerSalutation = isCoordinatorAssigned
    ? (String(form.coordinator_emp_name || '').trim() || 'Coordinator')
    : (String(form.control_owner_emp_name || '').trim() || 'Process Owner');
  const formUrl = isCoordinatorAssigned
    ? buildCoordinatorFormDetailUrl(form.form_id)
    : buildUserFormDetailUrl(form.form_id);
  const opening = finalReminder
    ? `This is the final reminder that uploading documents for ${controlNumberText} control is still pending. The reminder cycle for this control is now closed, and no further reminder emails will be sent.`
    : `This is a reminder that uploading documents for ${controlNumberText} control is pending.`;
  const closing = finalReminder
    ? 'Upload the documents and submit without further delay.'
    : 'Please upload the documents and submit at your earliest convenience.';
  return `Dear ${ownerSalutation},

${opening}

${buildRacmDetailsSection(form, [
  ['Due Date', dueStr],
])}

${closing}
${formUrl ? `\nRACM: ${formUrl}` : ''}

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
      const isCoordinatorAssigned = isCoordinatorAssignedRacm(form);
      const to = isCoordinatorAssigned
        ? String(form.coordinator_assigned_by || '').trim()
        : String(form.control_owner || '').trim();

      const sentCount = Number(form.reminder_sent_count) || 0;
      const isFinalReminder = sentCount >= getReminderFinalAfter();
      const controlNumberText = String(form.control_number || '').trim() || String(form.form_id || '').trim() || 'N/A';
      const businessProcessText = String(form.business_process || '').trim() || 'Business Process';

      // Invalid address: move the next trigger forward, but do not count it or close the cycle.
      if (!isValidEmail(to)) {
        const updatedAt = await updateReminderDatetime(client, form.form_id, form.reminder_frequency);
        console.warn(
          `[reminder_emails] form_id=${form.form_id} has invalid/empty control_owner "${to}", skipped email, updated reminder_datetime to ${
            formatReminderTimestampForLog(updatedAt) || 'null'
          }`
        );
        continue;
      }

      const subject = isFinalReminder
        ? `Final reminder - Control ${controlNumberText} - ${businessProcessText} submission pending`
        : `Reminder - Control ${controlNumberText} - ${businessProcessText} submission pending`;
      const text = buildReminderEmailBody(form, { finalReminder: isFinalReminder });

      const ccEmails = await getCcEmailsForRacm({
        companyIdentifier: form.company_identifier,
        businessProcess: form.business_process,
        unitId: form.unit_id,
        formId: form.form_id,
        excludeEmail: to,
      });

      const sent = await sendEmail(to, subject, text, ccEmails.length ? { cc: ccEmails } : undefined);
      if (!sent) continue;

      if (isFinalReminder) {
        const closedAt = await recordFinalProcessOwnerReminder(client, form.form_id);
        console.log(
          `[reminder_emails] Sent final reminder to ${to} for form_id=${form.form_id}, closed cycle at ${
            formatReminderTimestampForLog(closedAt) || 'null'
          }`
        );
        continue;
      }

      const updated = await recordNormalProcessOwnerReminder(client, form.form_id, form.reminder_frequency);
      console.log(
        `[reminder_emails] Sent reminder to ${to} for form_id=${form.form_id}, sent_count=${
          updated?.reminder_sent_count ?? 'unknown'
        }, updated reminder_datetime to ${formatReminderTimestampForLog(updated?.reminder_datetime) || 'null'}`
      );
    }
  } catch (err) {
    console.error('[reminder_emails] Error:', err);
  } finally {
    client.release();
  }
}

module.exports = { runReminderEmails };
