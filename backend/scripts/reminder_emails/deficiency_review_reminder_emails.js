/**
 * Reminder emails for approvers on deficiency responses pending review.
 * Runs every 1 minute. Fixed reminder interval: 2 days.
 *
 * Send conditions:
 * - deficiency_response_status = 'submitted_for_review'
 * - deficiency_review_reminder_datetime is set and current UTC datetime has reached it
 *
 * deficiency_review_reminder_datetime is seeded to UTC now + 2 days when a deficiency
 * response is submitted. After sending, it is updated to UTC now + 2 days.
 */

const { pool } = require('../../utils/db');
const { sendEmail } = require('../../utils/send_email');
const {
  updateDeficiencyReviewReminderDatetime,
  DEFICIENCY_REVIEW_REMINDER_DATETIME_DUE_SQL,
  formatReminderTimestampForLog,
  formatDueDateForEmail,
} = require('../../utils/controls_reminder');
const {
  buildDeficiencyResponseDetailsSection,
} = require('../../utils/racm_email_details');
const { buildApproverFormDetailUrl } = require('../../utils/racm_status_user_email');

function isValidEmail(value) {
  const email = String(value || '').trim();
  if (!email) return false;
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  return re.test(email);
}

async function fetchFormsDueForDeficiencyReviewReminder(client) {
  const query = `
    SELECT
      cf.form_id,
      cf.standard_control_description,
      cf.business_process,
      cf.financial_year,
      cf.due_date,
      cr.deficiency_review_reminder_datetime,
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
    WHERE LOWER(TRIM(COALESCE(cf.deficiency_response_status, ''))) = 'submitted_for_review'
      AND cr.deficiency_review_reminder_datetime IS NOT NULL
      AND ${DEFICIENCY_REVIEW_REMINDER_DATETIME_DUE_SQL}
  `;
  const result = await client.query(query);
  return result.rows;
}

function buildDeficiencyReviewReminderEmailBody(form) {
  const approverSalutation = String(form.approver_name || '').trim() || 'Approver';
  const racmUrl = buildApproverFormDetailUrl(form.form_id);
  const responseDetailsBlock = buildDeficiencyResponseDetailsSection({
    responseType: form.response_type,
    submittedBy: form.submitted_by_email,
    concernedPerson: form.concerned_person,
    dueDate: formatDueDateForEmail(form.deficiency_due_date),
    attachmentCount: form.attachment_count,
  });

  return `Dear ${approverSalutation},

This is a reminder that a deficiency response is pending your review.

${responseDetailsBlock}

Please review the deficiency response in the IFC system.
${racmUrl ? `\nRACM: ${racmUrl}` : ''}

Regards,
IFC System
`;
}

async function runDeficiencyReviewReminderEmails() {
  const client = await pool.connect();
  try {
    const forms = await fetchFormsDueForDeficiencyReviewReminder(client);
    if (forms.length === 0) return;

    for (const form of forms) {
      const to = String(form.approver_email_id || '').trim();

      if (!isValidEmail(to)) {
        const updatedAt = await updateDeficiencyReviewReminderDatetime(client, form.form_id);
        console.warn(
          `[deficiency_review_reminder_emails] form_id=${form.form_id} has invalid/empty approver_email_id "${to}", skipped email, updated deficiency_review_reminder_datetime to ${
            formatReminderTimestampForLog(updatedAt) || 'null'
          }`
        );
        continue;
      }

      const subject = 'Reminder: Deficiency response pending review – ' + (form.business_process || 'IFC');
      const text = buildDeficiencyReviewReminderEmailBody(form);

      const sent = await sendEmail(to, subject, text);
      if (sent) {
        const updatedAt = await updateDeficiencyReviewReminderDatetime(client, form.form_id);
        console.log(
          `[deficiency_review_reminder_emails] Sent reminder to ${to} for form_id=${form.form_id}, updated deficiency_review_reminder_datetime to ${
            formatReminderTimestampForLog(updatedAt) || 'null'
          }`
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
