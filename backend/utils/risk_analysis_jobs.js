const { randomUUID } = require('node:crypto');
const { tryAcquireGlobalAiModelLock, releaseGlobalAiModelLock } = require('./ai_model_lock');

const ACTIVE_STATUSES = ['queued', 'generating_concise', 'generating_missing'];
const MAX_ATTEMPTS = 3;

// Called inside the import transaction, so a rolled-back import cannot leave a job.
async function enqueueRiskAnalysis(client, { companyIdentifier, unitId, businessProcess, coordinatorEmail }) {
  const id = randomUUID();
  await client.query(`
    INSERT INTO risk_analysis_jobs (id, company_identifier, unit_id, business_process, requested_by_email)
    VALUES ($1, $2, $3, $4, $5)
  `, [id, companyIdentifier, unitId, String(businessProcess).trim(), coordinatorEmail]);
  return { id, status: 'queued', unit_id: unitId, business_process: String(businessProcess).trim() };
}

function createRiskAnalysisWorker({ pool, executeConcise, executeMissing, logger = console }) {
  let running = false;
  return async function runNextRiskAnalysisJob() {
    if (running) return;
    running = true;
    let client;
    let locked = false;
    try {
      client = await pool.connect();
      // Shared by all instances AND the existing manual AI operations.
      locked = await tryAcquireGlobalAiModelLock(client);
      if (!locked) return;
      const pending = await client.query(`
        SELECT * FROM risk_analysis_jobs
        WHERE status = ANY($1::varchar[]) AND available_at <= CURRENT_TIMESTAMP
        ORDER BY created_at, id LIMIT 1
      `, [ACTIVE_STATUSES]);
      const job = pending.rows[0];
      if (!job) return;
      // A running row found while owning the global lock was interrupted by a
      // process restart. Recompute both stages from the current controls.
      if (job.attempts >= MAX_ATTEMPTS) {
        await client.query(`UPDATE risk_analysis_jobs SET status = 'failed',
          error_message = 'Analysis was interrupted repeatedly. Generate it manually from Risk Analysis.',
          updated_at = CURRENT_TIMESTAMP WHERE id = $1`, [job.id]);
        return;
      }
      await client.query(`UPDATE risk_analysis_jobs SET status = 'generating_concise',
        attempts = attempts + 1, error_message = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = $1`, [job.id]);
      try {
        const args = [job.company_identifier, job.requested_by_email, job.unit_id, job.business_process];
        const concise = await executeConcise(...args);
        if (concise.data?.dry_run) throw new Error('AI dry-run mode is enabled. Disable it and generate risks from Risk Analysis.');
        await client.query(`UPDATE risk_analysis_jobs SET status = 'generating_missing',
          updated_at = CURRENT_TIMESTAMP WHERE id = $1`, [job.id]);
        const missing = await executeMissing(...args);
        if (missing.data?.dry_run) throw new Error('AI dry-run mode is enabled. Disable it and generate risks from Risk Analysis.');
        await client.query(`UPDATE risk_analysis_jobs SET status = 'completed',
          updated_at = CURRENT_TIMESTAMP WHERE id = $1`, [job.id]);
      } catch (error) {
        const retry = job.attempts + 1 < MAX_ATTEMPTS && error.statusCode !== 403
          && !String(error.message).includes('dry-run');
        await client.query(`UPDATE risk_analysis_jobs SET status = $2, error_message = $3,
          available_at = CURRENT_TIMESTAMP + INTERVAL '30 seconds', updated_at = CURRENT_TIMESTAMP
          WHERE id = $1`, [job.id, retry ? 'queued' : 'failed', String(error.message || 'Risk analysis failed').slice(0, 2000)]);
        logger.warn('[risk-analysis queue] Job unsuccessful:', job.id, error.message);
      }
    } catch (error) {
      // Missing migration must not interfere with imports or other schedulers.
      if (error.code !== '42P01') logger.error('[risk-analysis queue]', error.message);
    } finally {
      if (client) {
        try {
          if (locked) await releaseGlobalAiModelLock(client);
        } catch (error) {
          client.release(error); // Destroy sessions whose lock cannot be released.
          client = null;
        }
        if (client) client.release();
      }
      running = false;
    }
  };
}

let worker;
function runNextRiskAnalysisJob() {
  if (!worker) {
    const { pool } = require('./db');
    const { executeConciseRiskList, executeOverallMissingRisks } = require('../controllers/company_co/company_co');
    worker = createRiskAnalysisWorker({ pool, executeConcise: executeConciseRiskList, executeMissing: executeOverallMissingRisks });
  }
  return worker();
}

module.exports = { enqueueRiskAnalysis, createRiskAnalysisWorker, runNextRiskAnalysisJob };
