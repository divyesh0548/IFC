/**
 * Ensures the target PostgreSQL database exists (connects to maintenance DB `postgres`).
 * Uses DATABASE_URL when set; otherwise DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME.
 */
const { Client } = require('pg');

function getTargetDatabaseName() {
  const url = process.env.DATABASE_URL;
  if (url) {
    try {
      const pathname = new URL(url).pathname || '';
      const name = pathname.replace(/^\//, '').split('?')[0];
      if (name) {
        return decodeURIComponent(name);
      }
    } catch {
      // fall through
    }
  }
  return process.env.DB_NAME || 'postgres';
}

function getServerConnectionOptions() {
  const url = process.env.DATABASE_URL;
  if (url) {
    try {
      const u = new URL(url);
      const password = u.password ? decodeURIComponent(u.password) : '';
      const user = u.username ? decodeURIComponent(u.username) : 'postgres';
      const host = u.hostname;
      const port = u.port ? parseInt(u.port, 10) : 5432;
      const isLocal = host === 'localhost' || host === '127.0.0.1';
      const ssl = isLocal ? false : { rejectUnauthorized: false };
      return { host, port, user, password, ssl };
    } catch (e) {
      throw new Error(`Invalid DATABASE_URL: ${e.message}`);
    }
  }

  const dbHost = process.env.DB_HOST || 'localhost';
  const isLocal = dbHost === 'localhost' || dbHost === '127.0.0.1';
  return {
    host: dbHost,
    port: parseInt(process.env.DB_PORT || '5432', 10),
    user: process.env.DB_USER || 'postgres',
    password: String(process.env.DB_PASSWORD || ''),
    ssl: isLocal ? false : { rejectUnauthorized: false },
  };
}

function quoteIdent(name) {
  return `"${String(name).replace(/"/g, '""')}"`;
}

async function ensureDatabaseExists() {
  const dbName = getTargetDatabaseName();
  const opts = getServerConnectionOptions();

  const client = new Client({
    ...opts,
    database: 'postgres',
  });

  await client.connect();
  try {
    const check = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [dbName]);
    if (check.rows.length > 0) {
      return;
    }

    await client.query(`CREATE DATABASE ${quoteIdent(dbName)}`);
    console.log(`[db-init] Created database ${dbName}`);
  } finally {
    await client.end();
  }
}

module.exports = {
  ensureDatabaseExists,
  getTargetDatabaseName,
};
