/**
 * Reminder emails for process owners on ineffective RACMs pending deficiency response.
 * Runs every 1 minute. Fixed reminder interval: 2 days.
 *
 * Send conditions:
 * - control_design_conclusion = 'Not Effective' (trimmed, case-insensitive)
 * - deficiency_action_status = TRUE
 * - ineffective_reminder_datetime is set and current UTC datetime has reached it
 *
 * ineffective_reminder_datetime is seeded to UTC now + 2 days when the approver
 * marks a RACM as Not Effective. After sending, it is updated to UTC now + 2 days.
 */

const { pool } = require('../../utils/db');
const { sendEmail } = require('../../utils/send_email');
const { getCoordinatorEmailForUnit } = require('../../utils/deficiency_response_notifications');
const {
  updateIneffectiveReminderDatetime,
  INEFFECTIVE_REMINDER_DATETIME_DUE_SQL,
  NOT_EFFECTIVE_CONCLUSION_WHERE_SQL,
  formatDueDateForEmail,
  formatReminderTimestampForLog,
} = require('../../utils/controls_reminder');
const { utcTs } = require('../../utils/sqlUtcTimestamps');
const { buildRacmDetailsSection } = require('../../utils/racm_email_details');
const { buildUserFormDetailUrl } = require('../../utils/racm_status_user_email');

function isValidEmail(value) {
  const email = String(value || '').trim();
  if (!email) return false;
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  return re.test(email);
}

async function fetchFormsDueForIneffectiveReminder(client) {
  const query = `
    SELECT
      cf.form_id,
      cf.company_identifier,
      cf.unit_id,
      cf.control_owner,
      owner_u.emp_name AS control_owner_emp_name,
      cf.standard_control_description,
      cf.business_process,
      cf.financial_year,
      cf.sub_process,
      cf.due_date,
      cf.design_deficiency_desc,
      ${utcTs('cr.ineffective_reminder_datetime')},
      c.company_name
    FROM control_forms cf
    LEFT JOIN controls_reminder cr
      ON cr.form_id = cf.form_id
    LEFT JOIN ifc_users owner_u
      ON owner_u.company_identifier = cf.company_identifier
     AND LOWER(TRIM(COALESCE(owner_u.email_id, ''))) = LOWER(TRIM(COALESCE(cf.control_owner, '')))
    LEFT JOIN companies c
      ON c.company_identifier = cf.company_identifier
    WHERE ${NOT_EFFECTIVE_CONCLUSION_WHERE_SQL}
      AND COALESCE(cf.deficiency_action_status, FALSE) = TRUE
      AND cr.ineffective_reminder_datetime IS NOT NULL
      AND ${INEFFECTIVE_REMINDER_DATETIME_DUE_SQL}
  `;
  const result = await client.query(query);
  return result.rows;
}

function buildIneffectiveReminderEmailBody(form) {
  const companyName = String(form.company_name || '').trim() || 'IFC';
  const ownerSalutation =
    String(form.control_owner_emp_name || '').trim() || 'Process Owner';
  const formUrl = buildUserFormDetailUrl(form.form_id);

  return `Dear ${ownerSalutation},

This is a reminder that your RACM has been marked as Not Effective and requires a Deficiency Response.

${buildRacmDetailsSection(form, [
  ['Deficiency Description', form.design_deficiency_desc],
  ['Due Date', formatDueDateForEmail(form.due_date)],
])}

Please submit a Deficiency Response by providing either a Mitigation Plan or a Compensatory RACM.
${formUrl ? `\nRACM: ${formUrl}` : ''}

Regards,
${companyName}
`;
}

async function runIneffectiveReminderEmails() {
  const client = await pool.connect();
  try {
    const forms = await fetchFormsDueForIneffectiveReminder(client);
    if (forms.length === 0) return;

    for (const form of forms) {
      const to = String(form.control_owner || '').trim();

      if (!isValidEmail(to)) {
        const updatedAt = await updateIneffectiveReminderDatetime(client, form.form_id);
        console.warn(
          `[ineffective_reminder_emails] form_id=${form.form_id} has invalid/empty control_owner "${to}", skipped email, updated ineffective_reminder_datetime to ${
            formatReminderTimestampForLog(updatedAt) || 'null'
          }`
        );
        continue;
      }

      const subject = 'Reminder: Deficiency response required – ' + (form.business_process || 'IFC');
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
          `[ineffective_reminder_emails] Sent reminder to ${to} for form_id=${form.form_id}, updated ineffective_reminder_datetime to ${
            formatReminderTimestampForLog(updatedAt) || 'null'
          }`
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
