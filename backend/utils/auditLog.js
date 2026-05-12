const { prisma } = require('../lib/prisma');
const { pool } = require('./db');
const fs = require('fs');
const path = require('path');

/** Session events in audit_logs (ref_data unused). */
const AUTH_AUDIT_ACTIONS = new Set(['Logged In', 'Logged Out']);

/** Non-session events stored in audit_logs (ref_data not used for these actions). */
const AUDIT_LOGS_APP_ACTIONS = new Set(['Excel bulk RACM upload']);

/** @type {string} */
const EXCEL_BULK_RACM_UPLOAD_ACTION = 'Excel bulk RACM upload';
const AUDIT_FALLBACK_LOG_PATH = path.join(__dirname, '..', 'Audit_logs.txt');
const AUDIT_LOG_VERBOSE = process.env.AUDIT_LOG_VERBOSE === '1';

function logInternal(...args) {
  if (AUDIT_LOG_VERBOSE) {
    console.warn(...args);
  }
}

function usesAuditLogsTable(action) {
  return AUTH_AUDIT_ACTIONS.has(action) || AUDIT_LOGS_APP_ACTIONS.has(action);
}

/**
 * Logs an audit event: login/logout and configured app events → audit_logs; RACM actions → audit_logs_racm.
 * @param {string} action - e.g. 'Logged In', 'Excel bulk RACM upload', 'RACM Approved'
 * @param {string} userEmailId - Email of the user performing the action
 * @param {string|null} formId - Optional form_id (audit_logs_racm only)
 * @param {string|null} refData - Optional reference data (audit_logs_racm only; audit_logs always stores null for ref_data)
 * @returns {Promise<boolean>}
 */
async function logAuditEvent(action, userEmailId, formId = null, refData = null) {
  try {
    if (usesAuditLogsTable(action)) {
      await prisma.auditLog.create({
        data: {
          action,
          userEmailId,
          refData: null,
        },
      });
    } else {
      await prisma.auditLogsRacm.create({
        data: {
          action,
          userEmailId,
          formId,
          refData,
        },
      });
    }
    return true;
  } catch (prismaError) {
    logInternal('Audit write via Prisma failed, trying pg fallback:', prismaError?.message || prismaError);
    try {
      if (usesAuditLogsTable(action)) {
        await pool.query(
          `
            INSERT INTO public.audit_logs (action, user_email_id, ref_data)
            VALUES ($1, $2, $3)
          `,
          [action, userEmailId, null]
        );
      } else {
        await pool.query(
          `
            INSERT INTO public.audit_logs_racm (action, user_email_id, form_id, ref_data)
            VALUES ($1, $2, $3, $4)
          `,
          [action, userEmailId, formId, refData]
        );
      }
      return true;
    } catch (fallbackError) {
      logInternal('Audit write via pg fallback failed, writing to file fallback:', fallbackError?.message || fallbackError);
      try {
        const fallbackEntry = JSON.stringify({
          timestamp: new Date().toISOString(),
          action,
          user_email_id: userEmailId,
          form_id: formId,
          ref_data: refData,
          reason: 'db_write_failed',
        });
        fs.appendFileSync(AUDIT_FALLBACK_LOG_PATH, `\n${fallbackEntry}`);
      } catch (fileError) {
        logInternal('Audit file fallback write failed:', fileError?.message || fileError);
      }
      return false;
    }
  }
}

module.exports = {
  logAuditEvent,
  EXCEL_BULK_RACM_UPLOAD_ACTION,
};
