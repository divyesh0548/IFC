require('dotenv/config');
const { PrismaClient } = require('../generated/prisma');
const { PrismaPg } = require('@prisma/adapter-pg');

function buildConnectionString() {
  if (process.env.DATABASE_URL) {
    try {
      const u = new URL(process.env.DATABASE_URL);
      const host = u.hostname;
      const isLocal = host === 'localhost' || host === '127.0.0.1';
      if (!isLocal) {
        // Avoid TLS verification failures with RDS/self-signed chains in Node runtime.
        u.searchParams.delete('sslmode');
        u.searchParams.set('sslmode', 'no-verify');
      }
      // Global session timezone for all Prisma queries/defaults (UTC storage).
      const existingOptions = u.searchParams.get('options') || '';
      if (!existingOptions.includes('timezone=UTC')) {
        const tzOption = '-c timezone=UTC';
        u.searchParams.set('options', existingOptions ? `${existingOptions} ${tzOption}` : tzOption);
      }
      return u.toString();
    } catch {
      return process.env.DATABASE_URL;
    }
  }

  const host = process.env.DB_HOST || 'localhost';
  const port = process.env.DB_PORT || '5432';
  const user = encodeURIComponent(process.env.DB_USER || 'postgres');
  const password = encodeURIComponent(String(process.env.DB_PASSWORD || ''));
  const database = encodeURIComponent(process.env.DB_NAME || 'ifc_dev');
  const isLocal = host === 'localhost' || host === '127.0.0.1';
  const sslPart = isLocal ? '' : '&sslmode=no-verify';
  return `postgresql://${user}:${password}@${host}:${port}/${database}?schema=public${sslPart}&options=-c%20timezone%3DUTC`;
}

const adapter = new PrismaPg({ connectionString: buildConnectionString() });
const prisma = new PrismaClient({ adapter });

module.exports = { prisma };