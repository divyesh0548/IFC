/**
 * Single shared database connection pool for the application.
 * Import { pool } from this module everywhere; do not create new Pool() elsewhere.
 */
const { Pool } = require('pg');
const { getPoolConfig } = require('./resolveDbName');

const pool = new Pool(getPoolConfig());

pool.on('error', (error) => {
  console.error('Unexpected database pool error:', error.message);
});

module.exports = { pool };
