/**
 * Reminder emails job for approvers on RACMs pending approval.
 * Runs every 1 minute.
 *
 * Send conditions (RACM state unchanged):
 * - active = TRUE, status = 'sent for approval'
 * - no further submission declaration is false
 * - approver_due_date is set and IST current date >= approver_due_date
 * - reminder_to_approver_datetime is NULL (never reminded), OR
 *   UTC now >= last reminder + APPROVER_REMINDER_INTERVAL_DAYS (env)
 *
 * On "sent for approval":
 * - control_forms.approver_due_date = IST today + APPROVER_DUE_DAYS (env)
 * - controls_reminder.reminder_to_approver_datetime cleared (last-sent)
 *
 * After sending, reminder_to_approver_datetime is set to UTC now (last triggered).
 */

const { pool } = require('../../utils/db');
const { sendEmail } = require('../../utils/send_email');
const {
  updateReminderToApproverDatetime,
  buildReminderToApproverDatetimeDueSql,
  IST_CURRENT_DATE_SQL,
  formatReminderTimestampForLog,
  formatDueDateForEmail,
  getApproverReminderIntervalDays,
} = require('../../utils/controls_reminder');
const { utcTs } = require('../../utils/sqlUtcTimestamps');
const { buildPendingApprovalRacmDetailsSection } = require('../../utils/racm_email_details');
const { buildApproverFormDetailUrl } = require('../../utils/racm_status_user_email');

function isValidEmail(value) {
  const email = String(value || '').trim();
  if (!email) return false;
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  return re.test(email);
}

async function fetchFormsDueForApproverReminder(client) {
  const reminderDueSql = buildReminderToApproverDatetimeDueSql();
  const query = `
    SELECT
      cf.form_id,
      cf.control_number,
      cf.standard_control_description,
      cf.business_process,
      cf.financial_year,
      cf.approver_due_date,
      cf.assigned_to_coordinator,
      cf.control_owner,
      cf.coordinator_assigned_by,
      ${utcTs('cr.reminder_to_approver_datetime')},
      approver_map.approver_email_id AS approver_email_id,
      NULLIF(TRIM(approver.emp_name), '') AS approver_name,
      c.company_name,
      CASE
        WHEN COALESCE(cf.assigned_to_coordinator, FALSE) = TRUE THEN
          COALESCE(NULLIF(TRIM(coord_u.emp_name), ''), NULLIF(TRIM(cf.coordinator_assigned_by), ''))
        ELSE
          COALESCE(NULLIF(TRIM(owner_u.emp_name), ''), NULLIF(TRIM(cf.control_owner), ''))
      END AS submitted_by_name
    FROM control_forms cf
    LEFT JOIN controls_reminder cr
      ON cr.form_id = cf.form_id
    LEFT JOIN ifc_users owner_u
      ON owner_u.company_identifier = cf.company_identifier
     AND LOWER(TRIM(owner_u.email_id)) = LOWER(TRIM(COALESCE(cf.control_owner, '')))
    LEFT JOIN ifc_users coord_u
      ON coord_u.company_identifier = cf.company_identifier
     AND LOWER(TRIM(coord_u.email_id)) = LOWER(TRIM(COALESCE(cf.coordinator_assigned_by, '')))
    LEFT JOIN LATERAL (
      SELECT aa.approver_email_id
      FROM approver_assignments aa
      WHERE aa.company_identifier = cf.company_identifier
        AND (
          (aa.assignment_scope = 'RACM' AND aa.form_id = cf.form_id)
          OR (
            aa.assignment_scope = 'BUSINESS_PROCESS'
            AND LOWER(TRIM(aa.business_process)) = LOWER(TRIM(cf.business_process))
          )
          OR (aa.assignment_scope = 'UNIT' AND aa.unit_id = cf.unit_id)
        )
      ORDER BY
        CASE aa.assignment_scope
          WHEN 'RACM' THEN 1
          WHEN 'BUSINESS_PROCESS' THEN 2
          WHEN 'UNIT' THEN 3
          ELSE 4
        END
      LIMIT 1
    ) approver_map ON TRUE
    LEFT JOIN ifc_users approver
      ON LOWER(TRIM(approver.email_id)) = LOWER(TRIM(COALESCE(approver_map.approver_email_id, '')))
    LEFT JOIN companies c
      ON c.company_identifier = cf.company_identifier
    LEFT JOIN process_owner_declaration pod
      ON pod.form_id = cf.form_id
    WHERE cf.active = TRUE
      AND LOWER(TRIM(COALESCE(cf.status, ''))) = 'sent for approval'
      AND COALESCE(pod.no_furthure_submission, FALSE) = FALSE
      AND cf.approver_due_date IS NOT NULL
      AND ${IST_CURRENT_DATE_SQL} >= cf.approver_due_date
      AND ${reminderDueSql}
  `;
  const result = await client.query(query);
  return result.rows;
}

function buildApproverReminderEmailBody(form) {
  const companyName = String(form.company_name || '').trim();
  const approverSalutation = String(form.approver_name || '').trim() || 'Approver';
  const dueStr = formatDueDateForEmail(form.approver_due_date);
  const submittedBy = String(form.submitted_by_name || '').trim() || 'N/A';
  const racmUrl = buildApproverFormDetailUrl(form.form_id);
  const detailsBlock = buildPendingApprovalRacmDetailsSection(form, {
    dueDate: dueStr,
    submittedBy,
  });

  return `Dear ${approverSalutation},

This is a reminder that a RACM is pending your approval.

${detailsBlock}

Please review the uploaded documents and Approve/Reject based on your judgement.
${racmUrl ? `\nRACM: ${racmUrl}` : ''}

Regards,
${companyName}
`;
}

async function runApproverReminderEmails() {
  const client = await pool.connect();
  try {
    const forms = await fetchFormsDueForApproverReminder(client);
    if (forms.length === 0) return;

    const intervalDays = getApproverReminderIntervalDays();

    for (const form of forms) {
      const to = String(form.approver_email_id || '').trim();

      if (!isValidEmail(to)) {
        const updatedAt = await updateReminderToApproverDatetime(client, form.form_id);
        console.warn(
          `[approver_reminder_emails] form_id=${form.form_id} has invalid/empty approver_email_id "${to}", skipped email, updated last reminder_to_approver_datetime to ${
            formatReminderTimestampForLog(updatedAt) || 'null'
          } (interval=${intervalDays}d)`
        );
        continue;
      }

      const controlNumberText = String(form.control_number || '').trim() || String(form.form_id || '').trim() || 'N/A';
      const businessProcessText = String(form.business_process || '').trim() || 'Business Process';
      const subject = `Reminder - Control ${controlNumberText} - ${businessProcessText} Approval pending`;
      const text = buildApproverReminderEmailBody(form);

      const sent = await sendEmail(to, subject, text);
      if (sent) {
        const updatedAt = await updateReminderToApproverDatetime(client, form.form_id);
        console.log(
          `[approver_reminder_emails] Sent reminder to ${to} for form_id=${form.form_id}, last reminder_to_approver_datetime=${
            formatReminderTimestampForLog(updatedAt) || 'null'
          } (interval=${intervalDays}d)`
        );
      }
    }
  } catch (err) {
    console.error('[approver_reminder_emails] Error:', err);
  } finally {
    client.release();
  }
}

module.exports = { runApproverReminderEmails };
