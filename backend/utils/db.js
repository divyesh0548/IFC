/**
 * Single shared database connection pool for the application.
 * Import { pool } from this module everywhere; do not create new Pool() elsewhere.
 */
const { Pool } = require('pg');
const { getPoolConfig } = require('./resolveDbName');

const pool = new Pool({
  ...getPoolConfig(),
  keepAlive: true,
  max: 20,
  // Match Prisma v6-style idle lifetime so RDS idle timeouts don't kill reused clients.
  idleTimeoutMillis: 300_000,
  connectionTimeoutMillis: 30_000,
  allowExitOnIdle: false,
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
    code === '57P01' ||
    code === 'P1017' ||
    message.includes('econnreset') ||
    message.includes('connection timeout') ||
    message.includes('connection terminated') ||
    message.includes('server has closed the connection') ||
    message.includes('connectionclosed') ||
    message.includes('connection closed')
  );
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

async function queryWithRetry(sql, params, { retries = 1 } = {}) {
  let lastError;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await pool.query(sql, params);
    } catch (error) {
      lastError = error;
      if (!isPgConnectionError(error) || attempt >= retries) {
        throw error;
      }
      console.warn(`PostgreSQL query retry after connection error (attempt ${attempt + 1}):`, error.message);
    }
  }

  throw lastError;
}

module.exports = {
  pool,
  connectPgClient,
  releasePgClient,
  isPgConnectionError,
  getDatabaseUnavailableMessage,
  queryWithRetry,
};
