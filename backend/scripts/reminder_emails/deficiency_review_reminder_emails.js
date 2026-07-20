/**
 * Reminder emails for approvers on deficiency responses pending review.
 * Runs every 1 minute.
 *
 * Send conditions (RACM/deficiency state unchanged):
 * - deficiency_response_status = 'submitted_for_review'
 * - no further submission declaration is false
 * - deficiency_review_due_date is set and IST current date >= deficiency_review_due_date
 * - deficiency_review_reminder_datetime is NULL (never reminded), OR
 *   UTC now >= last reminder + DEFICIENCY_REVIEW_REMINDER_INTERVAL_DAYS (env)
 *
 * On deficiency response submit:
 * - control_forms.deficiency_review_due_date = IST today + DEFICIENCY_REVIEW_DUE_DAYS (env)
 * - controls_reminder.deficiency_review_reminder_datetime cleared (last-sent)
 *
 * After sending, deficiency_review_reminder_datetime is set to UTC now (last triggered).
 */

const { pool } = require('../../utils/db');
const { sendEmail } = require('../../utils/send_email');
const {
  updateDeficiencyReviewReminderDatetime,
  buildDeficiencyReviewReminderDatetimeDueSql,
  IST_CURRENT_DATE_SQL,
  formatReminderTimestampForLog,
  formatDueDateForEmail,
  getDeficiencyReviewReminderIntervalDays,
} = require('../../utils/controls_reminder');
const { utcTs } = require('../../utils/sqlUtcTimestamps');
const { buildApproverFormDetailUrl } = require('../../utils/racm_status_user_email');

function isValidEmail(value) {
  const email = String(value || '').trim();
  if (!email) return false;
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  return re.test(email);
}

async function fetchFormsDueForDeficiencyReviewReminder(client) {
  const reminderDueSql = buildDeficiencyReviewReminderDatetimeDueSql();
  const query = `
    SELECT
      cf.form_id,
      cf.control_number,
      cf.standard_control_description,
      cf.business_process,
      cf.financial_year,
      cf.due_date,
      cf.deficiency_review_due_date,
      ${utcTs('cr.deficiency_review_reminder_datetime')},
      approver_map.approver_email_id AS approver_email_id,
      NULLIF(TRIM(approver.emp_name), '') AS approver_name,
      dr.submitted_by_email,
      dr.concerned_person,
      dr.due_date AS deficiency_due_date,
      COALESCE(drs.submission_type, dr.response_type) AS response_type,
      (
        SELECT COUNT(*)::int
        FROM deficiency_response_attachment dra
        WHERE dra.submission_id = drs.id
      ) AS attachment_count
    FROM control_forms cf
    LEFT JOIN controls_reminder cr
      ON cr.form_id = cf.form_id
    LEFT JOIN deficiency_response dr
      ON dr.form_id = cf.form_id
     AND LOWER(TRIM(COALESCE(dr.status, ''))) = 'submitted'
    LEFT JOIN deficiency_response_submission drs
      ON drs.deficiency_response_id = dr.id
     AND drs.version_no = dr.current_version
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
    LEFT JOIN process_owner_declaration pod
      ON pod.form_id = cf.form_id
    WHERE LOWER(TRIM(COALESCE(cf.deficiency_response_status, ''))) = 'submitted_for_review'
      AND COALESCE(pod.no_furthure_submission, FALSE) = FALSE
      AND cf.deficiency_review_due_date IS NOT NULL
      AND ${IST_CURRENT_DATE_SQL} >= cf.deficiency_review_due_date
      AND ${reminderDueSql}
  `;
  const result = await client.query(query);
  return result.rows;
}

function getResponseTypeLabel(responseType) {
  return String(responseType || '').trim().toLowerCase() === 'compensatory_racm'
    ? 'Compensatory RACM'
    : 'Mitigation Plan';
}

function buildDeficiencyReviewReminderEmailBody(form) {
  const approverSalutation = String(form.approver_name || '').trim() || 'Approver';
  const racmUrl = buildApproverFormDetailUrl(form.form_id);
  const isCompensatoryRacm = String(form.response_type || '').trim().toLowerCase() === 'compensatory_racm';
  const responseTypeLabel = getResponseTypeLabel(form.response_type);

  const responseDetailLines = ['Response Details:'];
  responseDetailLines.push(`- Submitted By: ${String(form.submitted_by_email || '').trim() || 'N/A'}`);
  if (isCompensatoryRacm) {
    const documentCount = Number.isFinite(Number(form.attachment_count)) ? Number(form.attachment_count) : 0;
    responseDetailLines.push(`- No of Documents: ${documentCount}`);
  } else {
    responseDetailLines.push(`- Concerned Person: ${String(form.concerned_person || '').trim() || 'N/A'}`);
    responseDetailLines.push(`- Due Date: ${formatDueDateForEmail(form.deficiency_due_date)}`);
  }
  const responseDetailsBlock = responseDetailLines.join('\n');

  return `Dear ${approverSalutation},

This is a reminder that a ${responseTypeLabel} is pending for your review.

${responseDetailsBlock}

Please review the plan and mark RACM as Effective if requirements are satisfied.
${racmUrl ? `\nRACM: ${racmUrl}` : ''}

Best regards,
IFC System
`;
}

async function runDeficiencyReviewReminderEmails() {
  const client = await pool.connect();
  try {
    const forms = await fetchFormsDueForDeficiencyReviewReminder(client);
    if (forms.length === 0) return;

    const intervalDays = getDeficiencyReviewReminderIntervalDays();

    for (const form of forms) {
      const to = String(form.approver_email_id || '').trim();

      if (!isValidEmail(to)) {
        const updatedAt = await updateDeficiencyReviewReminderDatetime(client, form.form_id);
        console.warn(
          `[deficiency_review_reminder_emails] form_id=${form.form_id} has invalid/empty approver_email_id "${to}", skipped email, updated last deficiency_review_reminder_datetime to ${
            formatReminderTimestampForLog(updatedAt) || 'null'
          } (interval=${intervalDays}d)`
        );
        continue;
      }

      const controlNumberText = String(form.control_number || '').trim() || String(form.form_id || '').trim() || 'N/A';
      const businessProcessText = String(form.business_process || '').trim() || 'Business Process';
      const responseTypeLabel = getResponseTypeLabel(form.response_type);
      const subject = `Reminder: Control ${controlNumberText} - ${businessProcessText} - ${responseTypeLabel} awaiting review`;
      const text = buildDeficiencyReviewReminderEmailBody(form);

      const sent = await sendEmail(to, subject, text);
      if (sent) {
        const updatedAt = await updateDeficiencyReviewReminderDatetime(client, form.form_id);
        console.log(
          `[deficiency_review_reminder_emails] Sent reminder to ${to} for form_id=${form.form_id}, last deficiency_review_reminder_datetime=${
            formatReminderTimestampForLog(updatedAt) || 'null'
          } (interval=${intervalDays}d)`
        );
      }
    }
  } catch (err) {
    console.error('[deficiency_review_reminder_emails] Error:', err);
  } finally {
    client.release();
  }
}

module.exports = { runDeficiencyReviewReminderEmails };
