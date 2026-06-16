const { pool } = require('../utils/db');
const { sendEmail } = require('../utils/send_email');
const { getCcEmailsForRacm } = require('../utils/racm_cc_recipients');
const {
  buildRacmInactiveUserEmail,
  RACM_STATUS_EMAIL_SELECT,
} = require('../utils/racm_status_user_email');

async function runPendingRacmInactiveUserEmails() {
  const pendingResult = await pool.query(
    `
      ${RACM_STATUS_EMAIL_SELECT}
      WHERE COALESCE(TRIM(cf.control_owner), '') <> ''
        AND COALESCE(cf.inactive_mail_pending, FALSE) = TRUE
        AND COALESCE(cf.active, FALSE) = FALSE
      ORDER BY cf.updated_at ASC NULLS LAST, cf.id ASC
    `
  );

  if (pendingResult.rows.length === 0) return;

  for (const row of pendingResult.rows) {
    const processOwnerEmail = String(row.control_owner_email || '').trim().toLowerCase();
    if (!processOwnerEmail) continue;

    const payload = buildRacmInactiveUserEmail({
      businessProcess: row.business_process || '',
      processOwnerName: row.control_owner_name || '',
      coordinatorName: row.coordinator_name || '',
      coordinatorCompanyName: row.company_name || '',
    });
    if (!payload.shouldSend) continue;

    try {
      const ccEmails = await getCcEmailsForRacm({
        companyIdentifier: row.company_identifier,
        businessProcess: row.business_process,
        unitId: row.unit_id,
        excludeEmail: processOwnerEmail,
      });
      const emailSent = await sendEmail(processOwnerEmail, payload.subject, payload.text, { cc: ccEmails });
      if (!emailSent) {
        console.warn(`[racm-inactive-user-email] Failed email for form ${row.form_id}`);
        continue;
      }

      await pool.query(
        `
          UPDATE control_forms
          SET inactive_mail_pending = FALSE,
              updated_at = CURRENT_TIMESTAMP
          WHERE form_id = $1
        `,
        [row.form_id]
      );
      console.log(`[racm-inactive-user-email] Email sent and marked for form ${row.form_id}`);
    } catch (error) {
      console.error(`[racm-inactive-user-email] Error processing form ${row.form_id}:`, error);
    }
  }
}

module.exports = { runPendingRacmInactiveUserEmails };
