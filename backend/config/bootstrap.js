const { pool } = require('../utils/db');
const { ensureRequiredTablesAndColumns } = require('./db_table_init');
const { hashPassword, getPasswordPepper } = require('../utils/password');
let bootstrapPromise = null;

async function ensureAdminUserFromEnv() {
  const adminEmail = String(process.env.ADMIN_EMAIL_ID || '').trim();
  const adminPassword = String(process.env.ADMIN_PASSWORD || '').trim();
  const adminRole = String(process.env.ADMIN_ROLE || 'siteadmin').trim() || 'siteadmin';

  if (!adminEmail || !adminPassword) {
    console.warn('[bootstrap] ADMIN_EMAIL_ID / ADMIN_PASSWORD not configured. Skipping admin seed.');
    return;
  }

  getPasswordPepper();

  const existing = await pool.query(
    `
      SELECT id
      FROM ifc_users
      WHERE LOWER(TRIM(email_id)) = LOWER(TRIM($1))
      LIMIT 1
    `,
    [adminEmail]
  );

  if (existing.rows.length > 0) {
    console.log(`[bootstrap] Admin user already exists for ${adminEmail}. Skipping.`);
    return;
  }

  const adminPasswordHash = await hashPassword(adminPassword);

  await pool.query(
    `
      INSERT INTO ifc_users (email_id, password, role, company_identifier, temp_login)
      VALUES ($1, $2, $3, NULL, 0)
    `,
    [adminEmail, adminPasswordHash, adminRole]
  );

  console.log(`[bootstrap] Admin user created for ${adminEmail}.`);
}

async function runBootstrap() {
  if (bootstrapPromise) {
    return bootstrapPromise;
  }

  bootstrapPromise = (async () => {
    try {
      await ensureRequiredTablesAndColumns();
      await ensureAdminUserFromEnv();
    } catch (error) {
      console.error('[bootstrap] Startup bootstrap failed:', error);
      throw error;
    }
  })();

  try {
    await bootstrapPromise;
  } catch (error) {
    // Allow retry if caller handles failure and calls again.
    bootstrapPromise = null;
    throw error;
  }
}

module.exports = {
  runBootstrap,
};
