const { pool } = require('./db');
const FAILED_MESSAGE = 'This RACM is Failed and read-only. Late submission and reopening are not available.';

let schemaConfirmed = false;
async function hasAutomaticFailureSchema(client = pool) {
  if (schemaConfirmed) return true;
  const result = await client.query(`SELECT (
    (SELECT COUNT(*) FROM pg_attribute WHERE attrelid = to_regclass('public.controls_reminder')
      AND attname IN ('ineffective_reminder_sent_count', 'ineffective_final_reminder_sent_at') AND NOT attisdropped) = 2
    AND EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid = to_regclass('public.control_forms')
      AND tgname = 'failed_racm_read_only' AND NOT tgisinternal)
  ) AS ready`);
  schemaConfirmed = result.rows[0]?.ready === true;
  return schemaConfirmed;
}

function getAutoFailGraceDays() {
  const raw = process.env.RACM_AUTO_FAIL_AFTER_FINAL_REMINDER_DAYS;
  if (raw == null || String(raw).trim() === '') return 1;
  const days = Number(raw);
  if (!Number.isInteger(days) || days < 1) throw new Error('RACM_AUTO_FAIL_AFTER_FINAL_REMINDER_DAYS must be a positive integer');
  return days;
}

// Runs after authentication, before uploads or other side effects.
async function rejectFailedRacmMutation(req, res, next) {
  try {
    const ids = req.params?.form_id ? [req.params.form_id] : (req.body?.form_ids || (req.body?.form_id ? [req.body.form_id] : null));
    if (!Array.isArray(ids) || !ids.length) return next();
    const found = await pool.query(`SELECT 1 FROM control_forms
      WHERE form_id = ANY($1::text[]) AND company_identifier = $2
        AND LOWER(TRIM(COALESCE(control_design_conclusion, ''))) = 'failed' LIMIT 1`,
    [ids, req.user?.company_identifier]);
    if (found.rows.length) return res.status(409).json({ success: false, message: FAILED_MESSAGE });
    return next();
  } catch (error) { return next(error); }
}

// One statement locks eligible controls, checks current owner-action state and
// declarations, changes the conclusion, and records the previous conclusion.
const AUTO_FAIL_SQL = `
  WITH eligible AS MATERIALIZED (
    SELECT cf.form_id, cf.control_design_conclusion AS previous_conclusion,
      CASE WHEN LOWER(TRIM(COALESCE(cf.status, ''))) = 'approved' AND LOWER(TRIM(COALESCE(cf.control_design_conclusion, ''))) = 'not effective'
        THEN 'ineffective_response' ELSE 'submission' END AS stage,
      CASE WHEN LOWER(TRIM(COALESCE(cf.status, ''))) = 'approved' AND LOWER(TRIM(COALESCE(cf.control_design_conclusion, ''))) = 'not effective'
        THEN cr.ineffective_final_reminder_sent_at ELSE cr.final_reminder_sent_at END AS final_sent_at
    FROM control_forms cf JOIN controls_reminder cr ON cr.form_id = cf.form_id
    WHERE cf.active = TRUE
      AND LOWER(TRIM(COALESCE(cf.control_design_conclusion, ''))) <> 'failed'
      AND (LOWER(TRIM(COALESCE(cf.status, ''))) = 'rejected' OR LOWER(TRIM(COALESCE(cf.control_design_conclusion, ''))) NOT IN ('effective', 'accepted under deviation', 'not applicable'))
      AND NOT EXISTS (SELECT 1 FROM process_owner_declaration pod
        WHERE pod.form_id = cf.form_id AND pod.no_furthure_submission = TRUE)
      AND (
        (LOWER(TRIM(COALESCE(cf.status, ''))) IN ('', 'pending', 'rejected', 'null')
          AND (LOWER(TRIM(COALESCE(cf.status, ''))) = 'rejected' OR LOWER(TRIM(COALESCE(cf.control_design_conclusion, ''))) <> 'not effective')
          AND cr.final_reminder_sent_at IS NOT NULL
          AND cr.final_reminder_sent_at + make_interval(days => $1) <= (CURRENT_TIMESTAMP AT TIME ZONE 'UTC'))
        OR (LOWER(TRIM(COALESCE(cf.status, ''))) = 'approved'
          AND LOWER(TRIM(COALESCE(cf.control_design_conclusion, ''))) = 'not effective'
          AND cf.deficiency_action_status = TRUE
          AND LOWER(TRIM(COALESCE(cf.deficiency_response_status, ''))) IN ('awaiting_owner_action', 'resubmission_required')
          AND cr.ineffective_final_reminder_sent_at IS NOT NULL
          AND cr.ineffective_final_reminder_sent_at + make_interval(days => $1) <= (CURRENT_TIMESTAMP AT TIME ZONE 'UTC'))
      )
    FOR UPDATE OF cf, cr SKIP LOCKED
  ), changed AS (
    UPDATE control_forms cf SET control_design_conclusion = 'Failed',
      deficiency_action_status = FALSE, updated_at = (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')
    FROM eligible e WHERE cf.form_id = e.form_id RETURNING cf.form_id,
      e.previous_conclusion, e.stage, e.final_sent_at
  )
  INSERT INTO audit_logs_racm (form_id, action, ref_data)
  SELECT form_id, 'RACM automatically marked Failed', jsonb_build_object(
    'previous_conclusion', previous_conclusion, 'stage', stage,
    'final_reminder_sent_at', final_sent_at, 'grace_days', $1,
    'reason', 'No submission or declaration after final reminder')::text FROM changed
  RETURNING form_id
`;

async function runAutomaticRacmFailure() {
  if (!(await hasAutomaticFailureSchema())) return 0;
  const result = await pool.query(AUTO_FAIL_SQL, [getAutoFailGraceDays()]);
  return result.rows.length;
}

module.exports = { hasAutomaticFailureSchema, FAILED_MESSAGE, getAutoFailGraceDays, rejectFailedRacmMutation, AUTO_FAIL_SQL, runAutomaticRacmFailure };
