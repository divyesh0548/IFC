/**
 * Single shared database connection pool for the application.
 * Import { pool } from this module everywhere; do not create new Pool() elsewhere.
 */
const { Pool } = require('pg');

/**
 * Build `pg` Pool config:
 * - Prefer DATABASE_URL (keeps Node pg aligned with Prisma)
 * - Fall back to DB_* env vars for legacy/local setups
 */
function getPoolConfig() {
  const url = process.env.DATABASE_URL;
  if (url) {
    try {
      const u = new URL(url);
      const host = u.hostname;
      const isLocal = host === 'localhost' || host === '127.0.0.1';
      // pg treats sslmode=require as certificate validation in current versions.
      // Remove sslmode for app pool and enforce explicit TLS config below.
      u.searchParams.delete('sslmode');
      return {
        connectionString: u.toString(),
        ssl: isLocal ? false : { rejectUnauthorized: false }, // Explicitly disable/enable SSL certificate
        options: '-c timezone=UTC',
      };
    } catch (error) {
      console.error('Error parsing DATABASE_URL:', error);
      console.error('Malformed DATABASE_URL:', url);
    }
  }

  throw new Error('DATABASE_URL is not set');
}

const pool = new Pool({
  ...getPoolConfig(),
  keepAlive: true,
  max: 20, // Maximum number of PostgreSQL clients/connections that this pool can have at once.
  idleTimeoutMillis: 300_000,  // connection will be closed if it has been idle for 5 minutes
  connectionTimeoutMillis: 15_000,  // connection will be closed if it takes longer than 15 seconds to establish
  allowExitOnIdle: false,  // prevent the pool from exiting when all connections are idle
});

pool.on('error', (error) => {
  console.error('Unexpected database pool error:', error.message);
});

function isPgConnectionError(error) {
  const code = String(error?.code || '').toUpperCase();
  const message = String(error?.message || error?.cause?.message || '').toLowerCase();

  return (
    code === 'ECONNRESET' ||
    code === 'ECONNREFUSED' ||
    code === 'ETIMEDOUT' ||
    code === 'ENOTFOUND' ||
    code === 'EHOSTUNREACH' ||
    code === '57P01' ||
    code === 'P1001' ||
    code === 'P1002' ||
    code === 'P1008' ||
    code === 'P1017' ||
    message.includes('econnreset') ||
    message.includes('etimedout') ||
    message.includes('connection timeout') ||
    message.includes('timeout expired') ||
    message.includes('connection terminated') ||
    message.includes('server has closed the connection') ||
    message.includes('connectionclosed') ||
    message.includes('connection closed') ||
    message.includes('sockettimeout') ||
    message.includes('operation has timed out') ||
    message.includes("can't reach database server")
  );
}

function getDbEndpointHint() {
  try {
    const config = getPoolConfig();
    if (config.connectionString) {
      const parsed = new URL(config.connectionString);
      return `${parsed.hostname}:${parsed.port || 5432}`;
    }
    return `${config.host || 'unknown'}:${config.port || 5432}`;
  } catch {
    return 'configured database host';
  }
}

function formatDbConnectionError(error) {
  const endpoint = getDbEndpointHint();
  const code = String(error?.code || '').toUpperCase();
  if (code === 'ETIMEDOUT' || String(error?.message || '').toLowerCase().includes('etimedout')) {
    return (
      `Cannot reach PostgreSQL at ${endpoint} (ETIMEDOUT). `
      + 'Check VPN, RDS security group inbound rules for your current public IP, '
      + 'and that the instance is publicly reachable if connecting from outside AWS.'
    );
  }
  return `Database unavailable at ${endpoint}: ${error?.message || error}`;
}

function attachPgClientErrorHandler(client) {
  const handler = (error) => {
    console.error('PostgreSQL client error:', error?.message || error);
  };
  client.on('error', handler);
  return () => client.removeListener('error', handler);
}

async function connectPgClient() {
  const client = await pool.connect();
  attachPgClientErrorHandler(client);
  return client;
}

function releasePgClient(client, error = null) {
  if (!client) return;

  try {
    if (error && isPgConnectionError(error)) {
      client.release(error);
      return;
    }
    client.release();
  } catch (releaseError) {
    console.error('PostgreSQL client release error:', releaseError?.message || releaseError);
  }
}

function getDatabaseUnavailableMessage() {
  return 'Database connection was interrupted. Please try again.';
}

async function queryWithRetry(sql, params, { retries = 2 } = {}) {
  let lastError;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await pool.query(sql, params);
    } catch (error) {
      lastError = error;
      if (!isPgConnectionError(error) || attempt >= retries) {
        throw error;
      }
      const delayMs = Math.min(5000, 400 * (2 ** attempt));
      console.warn(
        `PostgreSQL query retry after connection error (attempt ${attempt + 1}/${retries}):`,
        error.message
      );
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  throw lastError;
}

/**
 * Lightweight connectivity probe used at startup / diagnostics.
 */
async function checkDatabaseConnectivity() {
  try {
    await queryWithRetry('SELECT 1 AS ok', [], { retries: 2 });
    return { ok: true, message: `Database reachable at ${getDbEndpointHint()}` };
  } catch (error) {
    return {
      ok: false,
      error,
      message: formatDbConnectionError(error),
    };
  }
}

module.exports = {
  pool,
  connectPgClient,
  releasePgClient,
  isPgConnectionError,
  getDatabaseUnavailableMessage,
  queryWithRetry,
  checkDatabaseConnectivity,
  formatDbConnectionError,
  getDbEndpointHint,
};
