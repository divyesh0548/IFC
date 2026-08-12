require('dotenv/config');
const { PrismaClient } = require('../generated/prisma');
const { PrismaPg } = require('@prisma/adapter-pg');
const { pool, isPgConnectionError } = require('../utils/db');

// Share the app pg Pool so Prisma inherits keepAlive / idle settings.
// PrismaPg's default idleTimeoutMillis is only 10s, which causes P1017
// ("Server has closed the connection") after idle periods.
const adapter = new PrismaPg(pool, {
  onPoolError: (error) => {
    console.error('Prisma pg pool error:', error?.message || error);
  },
  onConnectionError: (error) => {
    console.error('Prisma pg connection error:', error?.message || error);
  },
});

const prisma = new PrismaClient({ adapter });

function isPrismaConnectionError(error) {
  if (!error) return false;
  if (isPgConnectionError(error)) return true;

  const code = String(error.code || error?.meta?.code || '').toUpperCase();
  if (code === 'P1017' || code === 'P1001' || code === 'P1002' || code === 'P1008') return true;

  const message = String(error.message || error?.meta?.cause?.message || '').toLowerCase();
  return (
    message.includes('server has closed the connection')
    || message.includes('connectionclosed')
    || message.includes('connection closed')
    || message.includes('connection terminated')
    || message.includes('sockettimeout')
    || message.includes('etimedout')
    || message.includes('operation has timed out')
    || message.includes("can't reach database server")
  );
}

/**
 * Retry a Prisma operation after a dropped/idle/unreachable connection error.
 */
async function withPrismaRetry(operation, { retries = 2, label = 'prisma' } = {}) {
  let lastError;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (!isPrismaConnectionError(error) || attempt >= retries) {
        throw error;
      }
      const delayMs = Math.min(5000, 400 * (2 ** attempt));
      console.warn(
        `Prisma retry after connection error (${label}, attempt ${attempt + 1}/${retries}):`,
        error.message || error
      );
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  throw lastError;
}

module.exports = {
  prisma,
  withPrismaRetry,
  isPrismaConnectionError,
};
