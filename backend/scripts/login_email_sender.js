const { pool } = require('../utils/db');
const { sendPendingLoginEmail } = require('../utils/login_email');

let running = false;

async function fetchPendingLoginEmailUsers(client, limit = 25) {
  const result = await client.query(
    `
      SELECT
        u.id,
        u.email_id,
        u.role,
        u.temp_password_encrypted,
        c.company_name
      FROM ifc_users u
      LEFT JOIN companies c ON c.company_identifier = u.company_identifier
      WHERE COALESCE(u.login_email_sent, FALSE) = FALSE
        AND u.temp_login = 1
        AND NULLIF(TRIM(COALESCE(u.temp_password_encrypted, '')), '') IS NOT NULL
      ORDER BY u.created_at ASC NULLS LAST, u.id ASC
      LIMIT $1
    `,
    [limit]
  );

  return result.rows;
}

async function runPendingLoginEmails() {
  if (running) {
    return;
  }

  running = true;
  const client = await pool.connect();
  try {
    const rows = await fetchPendingLoginEmailUsers(client);
    if (rows.length === 0) {
      return;
    }

    let sentCount = 0;
    for (const row of rows) {
      try {
        const sent = await sendPendingLoginEmail(client, row);
        if (sent) {
          sentCount += 1;
          console.log(`[login-email] Sent login email to ${row.email_id}`);
        } else {
          console.warn(`[login-email] Login email pending for ${row.email_id}; SMTP send failed.`);
        }
      } catch (error) {
        console.error(`[login-email] Failed to process login email for ${row.email_id}:`, error);
      }
    }

    if (sentCount > 0) {
      console.log(`[login-email] Sent ${sentCount}/${rows.length} pending login email(s).`);
    }
  } catch (error) {
    console.error('[login-email] Pending login email job failed:', error);
  } finally {
    client.release();
    running = false;
  }
}

module.exports = {
  runPendingLoginEmails,
};
