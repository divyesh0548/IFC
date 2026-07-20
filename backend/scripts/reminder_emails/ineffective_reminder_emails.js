/**
 * Reminder emails for process owners on ineffective RACMs pending deficiency response.
 * Runs every 1 minute.
 *
 * Send conditions:
 * - control_design_conclusion = 'Not Effective' (trimmed, case-insensitive)
 * - deficiency_action_status = TRUE
 * - ineffective_due_date is set and IST current date >= ineffective_due_date
 * - ineffective_reminder_datetime is NULL (never reminded), OR
 *   UTC now >= last reminder + INEFFECTIVE_REMINDER_INTERVAL_DAYS (env)
 *
 * On RACM marked ineffective / resubmission required:
 * - control_forms.ineffective_due_date = IST today + INEFFECTIVE_DUE_DAYS (env)
 * - controls_reminder.ineffective_reminder_datetime cleared (last-sent)
 *
 * After sending, ineffective_reminder_datetime is set to UTC now (last triggered).
 */

const { pool } = require('../../utils/db');
const { sendEmail } = require('../../utils/send_email');
const { getCoordinatorEmailForUnit } = require('../../utils/deficiency_response_notifications');
const {
  updateIneffectiveReminderDatetime,
  buildIneffectiveReminderDatetimeDueSql,
  IST_CURRENT_DATE_SQL,
  NOT_EFFECTIVE_CONCLUSION_WHERE_SQL,
  formatReminderTimestampForLog,
  getIneffectiveReminderIntervalDays,
} = require('../../utils/controls_reminder');
const { buildRacmDetailsSection } = require('../../utils/racm_email_details');
const { buildUserFormDetailUrl } = require('../../utils/racm_status_user_email');

function isValidEmail(value) {
  const email = String(value || '').trim();
  if (!email) return false;
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  return re.test(email);
}

async function fetchFormsDueForIneffectiveReminder(client) {
  const reminderDueSql = buildIneffectiveReminderDatetimeDueSql();
  const query = `
    SELECT
      cf.form_id,
      cf.control_number,
      cf.company_identifier,
      cf.unit_id,
      cf.control_owner,
      owner_u.emp_name AS control_owner_emp_name,
      cf.standard_control_description,
      cf.business_process,
      cf.financial_year,
      cf.ineffective_due_date,
      cf.design_deficiency_desc,
      c.company_name
    FROM control_forms cf
    LEFT JOIN controls_reminder cr
      ON cr.form_id = cf.form_id
    LEFT JOIN ifc_users owner_u
      ON owner_u.company_identifier = cf.company_identifier
     AND LOWER(TRIM(COALESCE(owner_u.email_id, ''))) = LOWER(TRIM(COALESCE(cf.control_owner, '')))
    LEFT JOIN companies c
      ON c.company_identifier = cf.company_identifier
    LEFT JOIN process_owner_declaration pod
      ON pod.form_id = cf.form_id
    WHERE ${NOT_EFFECTIVE_CONCLUSION_WHERE_SQL}
      AND COALESCE(cf.deficiency_action_status, FALSE) = TRUE
      AND COALESCE(pod.no_furthure_submission, FALSE) = FALSE
      AND cf.ineffective_due_date IS NOT NULL
      AND ${IST_CURRENT_DATE_SQL} >= cf.ineffective_due_date
      AND ${reminderDueSql}
  `;
  const result = await client.query(query);
  return result.rows;
}

function buildIneffectiveReminderEmailBody(form) {
  const companyName = String(form.company_name || '').trim();
  const ownerSalutation =
    String(form.control_owner_emp_name || '').trim() || 'Process Owner';
  const formUrl = buildUserFormDetailUrl(form.form_id);

  return `Dear ${ownerSalutation},

This is a reminder that your RACM has been marked as ineffective and requires Mitigation/Compensatory Plan.

${buildRacmDetailsSection(form, [])}

Please submit a response at your earliest convenience.
${formUrl ? `\nRACM Link : ${formUrl}` : ''}

Regards,
${companyName}
`;
}

async function runIneffectiveReminderEmails() {
  const client = await pool.connect();
  try {
    const forms = await fetchFormsDueForIneffectiveReminder(client);
    if (forms.length === 0) return;
    const intervalDays = getIneffectiveReminderIntervalDays();

    for (const form of forms) {
      const to = String(form.control_owner || '').trim();

      if (!isValidEmail(to)) {
        const updatedAt = await updateIneffectiveReminderDatetime(client, form.form_id);
        console.warn(
          `[ineffective_reminder_emails] form_id=${form.form_id} has invalid/empty control_owner "${to}", skipped email, updated last ineffective_reminder_datetime to ${
            formatReminderTimestampForLog(updatedAt) || 'null'
          } (interval=${intervalDays}d)`
        );
        continue;
      }

      const controlNumberText = String(form.control_number || '').trim() || String(form.form_id || '').trim() || 'N/A';
      const businessProcessText = String(form.business_process || '').trim() || 'Business Process';
      const subject = `Reminder : Control ${controlNumberText} - ${businessProcessText} is ineffective`;
      const text = buildIneffectiveReminderEmailBody(form);

      const coordinatorEmail = await getCoordinatorEmailForUnit(form.company_identifier, form.unit_id);
      const ccEmails = coordinatorEmail
        && coordinatorEmail.toLowerCase() !== to.toLowerCase()
        ? [coordinatorEmail]
        : [];

      const sent = await sendEmail(to, subject, text, ccEmails.length ? { cc: ccEmails } : undefined);
      if (sent) {
        const updatedAt = await updateIneffectiveReminderDatetime(client, form.form_id);
        console.log(
          `[ineffective_reminder_emails] Sent reminder to ${to} for form_id=${form.form_id}, last ineffective_reminder_datetime=${
            formatReminderTimestampForLog(updatedAt) || 'null'
          } (interval=${intervalDays}d)`
        );
      }
    }
  } catch (err) {
    console.error('[ineffective_reminder_emails] Error:', err);
  } finally {
    client.release();
  }
}

module.exports = { runIneffectiveReminderEmails };
