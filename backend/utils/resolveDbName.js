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
        ssl: isLocal ? false : { rejectUnauthorized: false },
        options: '-c timezone=UTC',
      };
    } catch {
      // Ignore malformed DATABASE_URL and fall back to DB_* vars below.
    }
  }

  const dbHost = process.env.DB_HOST || 'localhost';
  const isLocalhost = dbHost === 'localhost' || dbHost === '127.0.0.1';
  return {
    user: process.env.DB_USER || 'divyesh',
    host: dbHost,
    database: process.env.DB_NAME || 'ifc_dev',
    password: String(process.env.DB_PASSWORD || '0548'),
    port: parseInt(process.env.DB_PORT || '5432', 10),
    ssl: isLocalhost ? false : { rejectUnauthorized: false },
    options: '-c timezone=UTC',
  };
}

module.exports = { getPoolConfig };
