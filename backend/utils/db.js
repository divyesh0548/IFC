/**
 * Single shared database connection pool for the application.
 * Import { pool } from this module everywhere; do not create new Pool() elsewhere.
 */
const { Pool } = require('pg');

const dbHost = process.env.DB_HOST || 'localhost';
const isLocalhost = dbHost === 'localhost' || dbHost === '127.0.0.1';

const pool = new Pool({
  user: process.env.DB_USER || 'divyesh',
  host: dbHost,
  database: process.env.DB_NAME || 'ifc_dev',
  password: String(process.env.DB_PASSWORD || '0548'),
  port: parseInt(process.env.DB_PORT || '5432', 10),
  ssl: isLocalhost ? false : { rejectUnauthorized: false },
});

pool.on('connect', async (client) => {
  await client.query("SET timezone = 'Asia/Kolkata'");
});

module.exports = { pool };
