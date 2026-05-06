const { Client } = require('pg');
const { hashPassword, getPasswordPepper } = require('../utils/password');
let bootstrapPromise = null;

function getDbSslConfig() {
  const dbHost = process.env.DB_HOST || 'localhost';
  const isLocalhost = dbHost === 'localhost' || dbHost === '127.0.0.1';
  return isLocalhost ? false : { rejectUnauthorized: false };
}

function assertSafeDbName(dbName) {
  const name = String(dbName || '').trim();
  if (!name) {
    throw new Error('[bootstrap] DB_NAME is missing.');
  }
  // Identifiers cannot be parameterized in CREATE DATABASE. Keep it strict.
  if (!/^[a-zA-Z0-9_]+$/.test(name)) {
    throw new Error(
      `[bootstrap] Unsafe DB_NAME "${name}". Use only letters, numbers, underscore.`
    );
  }
  return name;
}

async function ensureDatabaseExists() {
  const dbName = assertSafeDbName(process.env.DB_NAME || 'ifc_dev');
  const maintenanceDb =
    String(process.env.DB_MAINTENANCE_DB || '').trim() || 'postgres';

  const client = new Client({
    user: process.env.DB_USER || 'divyesh',
    host: process.env.DB_HOST || 'localhost',
    database: maintenanceDb,
    password: String(process.env.DB_PASSWORD || '0548'),
    port: parseInt(process.env.DB_PORT || '5432', 10),
    ssl: getDbSslConfig(),
  });

  await client.connect();
  try {
    const exists = await client.query(
      'SELECT 1 FROM pg_database WHERE datname = $1 LIMIT 1',
      [dbName]
    );
    if (exists.rows.length > 0) {
      return;
    }

    console.log(`[bootstrap] Database "${dbName}" not found. Creating...`);
    await client.query(`CREATE DATABASE "${dbName}"`);
    console.log(`[bootstrap] Database "${dbName}" created.`);
  } finally {
    await client.end();
  }
}

async function ensureAdminUserFromEnv() {
  const { pool } = require('../utils/db');
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
      await ensureDatabaseExists();
      const { ensureRequiredTablesAndColumns } = require('./db_table_init');
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
