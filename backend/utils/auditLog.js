const { pool } = require('./db');

/** Session events in audit_logs (ref_data unused). */
const AUTH_AUDIT_ACTIONS = new Set(['Logged In', 'Logged Out']);

/** Non-session events stored in audit_logs (use ref_data when needed). */
const AUDIT_LOGS_APP_ACTIONS = new Set(['Excel bulk RACM upload']);

/** @type {string} */
const EXCEL_BULK_RACM_UPLOAD_ACTION = 'Excel bulk RACM upload';

function usesAuditLogsTable(action) {
  return AUTH_AUDIT_ACTIONS.has(action) || AUDIT_LOGS_APP_ACTIONS.has(action);
}

/**
 * Logs an audit event: login/logout and configured app events → audit_logs; RACM actions → audit_logs_racm.
 * @param {string} action - e.g. 'Logged In', 'Excel bulk RACM upload', 'RACM Approved'
 * @param {string} userEmailId - Email of the user performing the action
 * @param {string|null} formId - Optional form_id (audit_logs_racm only)
 * @param {string|null} refData - Optional reference data (e.g. excel_files.file_path S3 key, or audit_logs_racm payload)
 * @returns {Promise<boolean>}
 */
async function logAuditEvent(action, userEmailId, formId = null, refData = null) {
  try {
    const tsSql = `NOW() AT TIME ZONE 'Asia/Kolkata'`;

    if (usesAuditLogsTable(action)) {
      const refForLogs = AUDIT_LOGS_APP_ACTIONS.has(action) ? refData : null;
      const query = `
        INSERT INTO public.audit_logs (timestamp, action, user_email_id, ref_data)
        VALUES (${tsSql}, $1, $2, $3)
      `;
      await pool.query(query, [action, userEmailId, refForLogs]);
    } else {
      const query = `
        INSERT INTO public.audit_logs_racm (timestamp, action, user_email_id, form_id, ref_data)
        VALUES (${tsSql}, $1, $2, $3, $4)
      `;
      await pool.query(query, [action, userEmailId, formId, refData]);
    }
    return true;
  } catch (error) {
    console.error('Error logging audit event:', error);
    return false;
  }
}

module.exports = {
  logAuditEvent,
  EXCEL_BULK_RACM_UPLOAD_ACTION,
};
