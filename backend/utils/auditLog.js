const { Pool } = require('pg');

// Database connection pool (reuse the same pool pattern)
const dbHost = process.env.DB_HOST || 'localhost';
const isLocalhost = dbHost === 'localhost' || dbHost === '127.0.0.1';

const pool = new Pool({
  user: process.env.DB_USER || 'divyesh',
  host: dbHost,
  database: process.env.DB_NAME || 'ifc_dev',
  password: String(process.env.DB_PASSWORD || '0548'),
  port: parseInt(process.env.DB_PORT || '5432', 10),
  // Enable SSL for remote connections (AWS RDS requires SSL)
  ssl: isLocalhost ? false : {
    rejectUnauthorized: false
  }
});

// Set timezone to IST for all connections
pool.on('connect', async (client) => {
  await client.query("SET timezone = 'Asia/Kolkata'");
});

/**
 * Logs an audit event to the audit_logs table
 * @param {string} action - The action being logged (e.g., 'Logged In', 'Logged Out', 'Form Approved', 'Form Rejected')
 * @param {string} userEmailId - The email ID of the user performing the action
 * @param {string|null} formId - Optional form_id for form-related actions (null for login/logout)
 * @param {string|null} refData - Optional reference data (e.g., modified columns list)
 * @returns {Promise<boolean>} - Returns true if logging was successful, false otherwise
 */
async function logAuditEvent(action, userEmailId, formId = null, refData = null) {
  try {
    // Explicitly set timestamp in IST timezone
    const query = `
      INSERT INTO public.audit_logs (timestamp, action, user_email_id, form_id, ref_data)
      VALUES (NOW() AT TIME ZONE 'Asia/Kolkata', $1, $2, $3, $4)
    `;
    
    await pool.query(query, [action, userEmailId, formId, refData]);
    return true;
  } catch (error) {
    // Log error but don't throw - we don't want audit logging to break the main flow
    console.error('Error logging audit event:', error);
    return false;
  }
}

module.exports = {
  logAuditEvent
};

