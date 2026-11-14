const { hasAutomaticFailureSchema, getAutoFailGraceDays } = require('../../utils/racm_failure');
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
const { getCcEmailsForRacm } = require('../../utils/racm_cc_recipients');
const { getCoordinatorEmailForUnit } = require('../../utils/deficiency_response_notifications');
const {
  updateIneffectiveReminderDatetime,
  recordFinalIneffectiveReminder,
  getReminderFinalAfter,
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

async function fetchFormsDueForIneffectiveReminder(client, trackingReady = true) {
  const reminderDueSql = buildIneffectiveReminderDatetimeDueSql();
  const query = `
    SELECT
      cf.form_id,
      ${trackingReady ? 'COALESCE(cr.ineffective_reminder_sent_count, 0)' : '0'} AS ineffective_reminder_sent_count,
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
      AND cf.active = TRUE
      AND LOWER(TRIM(COALESCE(cf.status, ''))) = 'approved'
      ${trackingReady ? 'AND cr.ineffective_final_reminder_sent_at IS NULL' : ''}
      AND LOWER(TRIM(COALESCE(cf.deficiency_response_status, ''))) IN ('awaiting_owner_action', 'resubmission_required')
      AND COALESCE(cf.deficiency_action_status, FALSE) = TRUE
      AND COALESCE(pod.no_furthure_submission, FALSE) = FALSE
      AND cf.ineffective_due_date IS NOT NULL
      AND ${IST_CURRENT_DATE_SQL} >= cf.ineffective_due_date
      AND ${reminderDueSql}
  `;
  const result = await client.query(query);
  return result.rows;
}

function buildIneffectiveReminderEmailBody(form, { finalReminder = false } = {}) {
  const companyName = String(form.company_name || '').trim();
  const ownerSalutation =
    String(form.control_owner_emp_name || '').trim() || 'Process Owner';
  const formUrl = buildUserFormDetailUrl(form.form_id);

  return `Dear ${ownerSalutation},

This is a reminder that your RACM has been marked as ineffective and requires Mitigation/Compensatory Plan.

${buildRacmDetailsSection(form, [])}

${finalReminder ? `This is the final reminder. Submit your mitigation/compensatory response or make a no-further-submission declaration within ${getAutoFailGraceDays()} day(s). Otherwise, the conclusion will automatically become Failed and this RACM will become read-only.` : 'Please submit a response at your earliest convenience.'}
${formUrl ? `\nRACM Link : ${formUrl}` : ''}

Regards,
${companyName}
`;
}

async function runIneffectiveReminderEmails() {
  const client = await pool.connect();
  let hasJobLock = false;
  try {
    const lock = await client.query('SELECT pg_try_advisory_lock($1) AS locked', [9043302]);
    hasJobLock = lock.rows[0]?.locked === true;
    if (!hasJobLock) return;
    const trackingReady = await hasAutomaticFailureSchema(client);
    const forms = await fetchFormsDueForIneffectiveReminder(client, trackingReady);
    if (forms.length === 0) return;
    const intervalDays = getIneffectiveReminderIntervalDays();

    for (const form of forms) {
      const to = String(form.control_owner || '').trim();

      if (!isValidEmail(to)) {
        console.warn(`[ineffective_reminder_emails] Invalid owner address for form_id=${form.form_id}; no reminder counted.`);
        continue;
      }

      const controlNumberText = String(form.control_number || '').trim() || String(form.form_id || '').trim() || 'N/A';
      const businessProcessText = String(form.business_process || '').trim() || 'Business Process';
      const isFinalReminder = trackingReady && Number(form.ineffective_reminder_sent_count || 0) >= getReminderFinalAfter();
      const subject = `${isFinalReminder ? 'Final reminder' : 'Reminder'} : Control ${controlNumberText} - ${businessProcessText} is ineffective`;
      const text = buildIneffectiveReminderEmailBody(form, { finalReminder: isFinalReminder });

      const coordinatorEmail = await getCoordinatorEmailForUnit(form.company_identifier, form.unit_id);
      const matrixCcEmails = await getCcEmailsForRacm({
        companyIdentifier: form.company_identifier,
        businessProcess: form.business_process,
        unitId: form.unit_id,
        formId: form.form_id,
        excludeEmail: to,
      });
      const ccEmails = Array.from(
        new Set(
          [
            coordinatorEmail
              && coordinatorEmail.toLowerCase() !== to.toLowerCase()
              ? coordinatorEmail
              : null,
            ...matrixCcEmails,
          ]
            .map((email) => String(email || '').trim().toLowerCase())
            .filter(Boolean)
        )
      );

      const sent = await sendEmail(to, subject, text, ccEmails.length ? { cc: ccEmails } : undefined);
      if (sent) {
        if (isFinalReminder) {
          await recordFinalIneffectiveReminder(client, form.form_id);
          continue;
        }
        const updatedAt = await updateIneffectiveReminderDatetime(client, form.form_id, { trackCount: trackingReady });
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
    if (hasJobLock) {
      try { await client.query('SELECT pg_advisory_unlock($1)', [9043302]); }
      catch (error) { client.release(error); return; }
    }
    client.release();
  }
}

module.exports = { runIneffectiveReminderEmails };
