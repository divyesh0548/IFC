const { pool } = require('./db');
const { prisma } = require('../lib/prisma');
const {
  controlsReminderUtcSelectSql,
  controlsReminderUtcReturningSql,
} = require('./sqlUtcTimestamps');

const CONTROLS_REMINDER_JOIN_SQL = `
  LEFT JOIN controls_reminder cr ON cr.form_id = cf.form_id
`;

const CONTROLS_REMINDER_SELECT_SQL = controlsReminderUtcSelectSql('cr');

const DEFAULT_APPROVER_DUE_DAYS = 3;
const DEFAULT_APPROVER_REMINDER_INTERVAL_DAYS = 3;
const DEFAULT_INEFFECTIVE_DUE_DAYS = 2;
const DEFAULT_INEFFECTIVE_REMINDER_INTERVAL_DAYS = 2;
const DEFAULT_DEFICIENCY_REVIEW_DUE_DAYS = 2;
const DEFAULT_DEFICIENCY_REVIEW_REMINDER_INTERVAL_DAYS = 2;

/** UTC wall-clock "now" for reminder timestamp storage and comparisons. */
const UTC_NOW_SQL = `(CURRENT_TIMESTAMP AT TIME ZONE 'UTC')`;
const IST_CURRENT_DATE_SQL = `((CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::date)`;

function parsePositiveIntEnv(value, fallback) {
  const parsed = Number.parseInt(String(value ?? '').trim(), 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return parsed;
}

/** Days after submission until approver review is due (fixed due date). */
function getApproverDueDays() {
  return parsePositiveIntEnv(process.env.APPROVER_DUE_DAYS, DEFAULT_APPROVER_DUE_DAYS);
}

/** Days between approver reminder emails after the due date / last send. */
function getApproverReminderIntervalDays() {
  return parsePositiveIntEnv(
    process.env.APPROVER_REMINDER_INTERVAL_DAYS,
    DEFAULT_APPROVER_REMINDER_INTERVAL_DAYS
  );
}

/** Days after deficiency response submit until review reminders may start. */
function getDeficiencyReviewDueDays() {
  return parsePositiveIntEnv(
    process.env.DEFICIENCY_REVIEW_DUE_DAYS,
    DEFAULT_DEFICIENCY_REVIEW_DUE_DAYS
  );
}

/** Days after a RACM is marked ineffective until owner reminder emails may start. */
function getIneffectiveDueDays() {
  return parsePositiveIntEnv(
    process.env.INEFFECTIVE_DUE_DAYS,
    DEFAULT_INEFFECTIVE_DUE_DAYS
  );
}

/** Days between ineffective reminder emails after due date / last send. */
function getIneffectiveReminderIntervalDays() {
  return parsePositiveIntEnv(
    process.env.INEFFECTIVE_REMINDER_INTERVAL_DAYS,
    DEFAULT_INEFFECTIVE_REMINDER_INTERVAL_DAYS
  );
}

/** Days between deficiency-review reminder emails after due date / last send. */
function getDeficiencyReviewReminderIntervalDays() {
  return parsePositiveIntEnv(
    process.env.DEFICIENCY_REVIEW_REMINDER_INTERVAL_DAYS,
    DEFAULT_DEFICIENCY_REVIEW_REMINDER_INTERVAL_DAYS
  );
}

/** @deprecated Prefer getApproverReminderIntervalDays(); kept for callers that expect an interval string. */
const APPROVER_REMINDER_INTERVAL = `${DEFAULT_APPROVER_REMINDER_INTERVAL_DAYS} days`;
/** @deprecated Prefer getIneffectiveReminderIntervalDays(). */
const INEFFECTIVE_REMINDER_INTERVAL = `${DEFAULT_INEFFECTIVE_REMINDER_INTERVAL_DAYS} days`;
/** @deprecated Prefer getDeficiencyReviewReminderIntervalDays(). */
const DEFICIENCY_REVIEW_REMINDER_INTERVAL = `${DEFAULT_DEFICIENCY_REVIEW_REMINDER_INTERVAL_DAYS} days`;

const REMINDER_DATETIME_DUE_SQL = `${UTC_NOW_SQL} >= cr.reminder_datetime::timestamp`;

/**
 * Approver reminder is due when:
 * - last send is NULL (never reminded) — first send allowed once past approver_due_date (checked separately), OR
 * - now >= last_send + APPROVER_REMINDER_INTERVAL_DAYS (env, so interval changes apply without rewriting next-trigger)
 */
function buildReminderToApproverDatetimeDueSql() {
  const intervalDays = getApproverReminderIntervalDays();
  return `(
    cr.reminder_to_approver_datetime IS NULL
    OR ${UTC_NOW_SQL} >= cr.reminder_to_approver_datetime::timestamp + make_interval(days => ${intervalDays})
  )`;
}

/** Evaluated at require-time for backward-compatible imports; prefer buildReminderToApproverDatetimeDueSql() in jobs. */
const REMINDER_TO_APPROVER_DATETIME_DUE_SQL = buildReminderToApproverDatetimeDueSql();

function buildIneffectiveReminderDatetimeDueSql() {
  const intervalDays = getIneffectiveReminderIntervalDays();
  return `(
    cr.ineffective_reminder_datetime IS NULL
    OR ${UTC_NOW_SQL} >= cr.ineffective_reminder_datetime::timestamp + make_interval(days => ${intervalDays})
  )`;
}

/** @deprecated Prefer buildIneffectiveReminderDatetimeDueSql() in jobs. */
const INEFFECTIVE_REMINDER_DATETIME_DUE_SQL = buildIneffectiveReminderDatetimeDueSql();

function buildDeficiencyReviewReminderDatetimeDueSql() {
  const intervalDays = getDeficiencyReviewReminderIntervalDays();
  return `(
    cr.deficiency_review_reminder_datetime IS NULL
    OR ${UTC_NOW_SQL} >= cr.deficiency_review_reminder_datetime::timestamp + make_interval(days => ${intervalDays})
  )`;
}

/** @deprecated Prefer buildDeficiencyReviewReminderDatetimeDueSql() in jobs. */
const DEFICIENCY_REVIEW_REMINDER_DATETIME_DUE_SQL = buildDeficiencyReviewReminderDatetimeDueSql();

const NOT_EFFECTIVE_CONCLUSION_WHERE_SQL = `
  LOWER(TRIM(COALESCE(cf.control_design_conclusion, ''))) = 'not effective'
`;

function normalizeDesignConclusion(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, ' ');
}

function isNotEffectiveConclusion(value) {
  return normalizeDesignConclusion(value) === 'not effective';
}

function getIntervalLiteral(reminderFrequency) {
  const str = String(reminderFrequency || '').trim();
  switch (str) {
    case 'Weekly':
      return '7 days';
    case 'Monthly':
      return '30 days';
    case 'Daily':
    default:
      return '1 day';
  }
}

function formatReminderTimestampForLog(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/**
 * Format a PostgreSQL DATE (string or Date from node-pg) without timezone shift.
 * node-pg parses DATE as local calendar midnight; toISOString() can show the previous day in UTC+ zones.
 */
function formatDueDateForEmail(dueDateRaw) {
  if (!dueDateRaw) return 'TBD';

  const str = typeof dueDateRaw === 'string' ? dueDateRaw.trim() : '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;

  const dt = dueDateRaw instanceof Date ? dueDateRaw : new Date(dueDateRaw);
  if (Number.isNaN(dt.getTime())) return 'TBD';

  const year = dt.getFullYear();
  const month = String(dt.getMonth() + 1).padStart(2, '0');
  const day = String(dt.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Reset reminder_datetime for one or more forms (scheduler restarts from due date).
 */
async function resetReminderDatetimeForForms(formIds, clientOrPool = pool) {
  const ids = [...new Set((formIds || []).map((id) => String(id || '').trim()).filter(Boolean))];
  if (ids.length === 0) return;

  await clientOrPool.query(
    `
      INSERT INTO controls_reminder (form_id, reminder_datetime)
      SELECT unnest($1::varchar[]), NULL
      ON CONFLICT (form_id) DO UPDATE
      SET reminder_datetime = NULL
    `,
    [ids]
  );
}

/**
 * Update reminder_datetime for a form (next trigger at, stored in UTC).
 */
async function updateReminderDatetime(client, formId, reminderFrequency) {
  const intervalLiteral = getIntervalLiteral(reminderFrequency);
  const result = await client.query(
    `
      INSERT INTO controls_reminder (form_id, reminder_datetime)
      VALUES (
        $1,
        ${UTC_NOW_SQL} + ($2::interval)
      )
      ON CONFLICT (form_id) DO UPDATE
      SET reminder_datetime = EXCLUDED.reminder_datetime
      RETURNING ${controlsReminderUtcReturningSql('reminder_datetime')};
    `,
    [formId, intervalLiteral]
  );
  return result.rows?.[0]?.reminder_datetime || null;
}

/**
 * Mark approver reminder as last-sent-at = UTC now.
 * Next eligibility is computed as last_sent + APPROVER_REMINDER_INTERVAL_DAYS (env).
 */
async function updateReminderToApproverDatetime(client, formId) {
  const result = await client.query(
    `
      INSERT INTO controls_reminder (form_id, reminder_to_approver_datetime)
      VALUES ($1, ${UTC_NOW_SQL})
      ON CONFLICT (form_id) DO UPDATE
      SET reminder_to_approver_datetime = EXCLUDED.reminder_to_approver_datetime
      RETURNING ${controlsReminderUtcReturningSql('reminder_to_approver_datetime')}
    `,
    [formId]
  );
  return result.rows?.[0]?.reminder_to_approver_datetime || null;
}

/**
 * On "sent for approval":
 * - Set fixed control_forms.approver_due_date = IST today + APPROVER_DUE_DAYS
 * - Clear reminder_to_approver_datetime (last-sent) so first reminder waits until due date
 */
async function seedReminderToApproverDatetime(tx, formId) {
  const normalizedFormId = String(formId || '').trim();
  if (!normalizedFormId) return null;

  const dueDays = getApproverDueDays();

  await tx.$executeRaw`
    UPDATE control_forms
    SET approver_due_date = (
      ((CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::date)
      + make_interval(days => ${dueDays})
    )::date
    WHERE form_id = ${normalizedFormId}
  `;

  const rows = await tx.$queryRaw`
    INSERT INTO controls_reminder (form_id, reminder_to_approver_datetime)
    VALUES (${normalizedFormId}, NULL)
    ON CONFLICT (form_id) DO UPDATE
    SET reminder_to_approver_datetime = NULL
    RETURNING reminder_to_approver_datetime AT TIME ZONE 'UTC' AS reminder_to_approver_datetime
  `;
  return rows?.[0]?.reminder_to_approver_datetime ?? null;
}

/**
 * Mark ineffective reminder as last-sent-at = UTC now.
 * Next eligibility is computed as last_sent + INEFFECTIVE_REMINDER_INTERVAL_DAYS (env).
 */
async function updateIneffectiveReminderDatetime(client, formId) {
  const result = await client.query(
    `
      INSERT INTO controls_reminder (form_id, ineffective_reminder_datetime)
      VALUES ($1, ${UTC_NOW_SQL})
      ON CONFLICT (form_id) DO UPDATE
      SET ineffective_reminder_datetime = EXCLUDED.ineffective_reminder_datetime
      RETURNING ${controlsReminderUtcReturningSql('ineffective_reminder_datetime')}
    `,
    [formId]
  );
  return result.rows?.[0]?.ineffective_reminder_datetime || null;
}

/**
 * On RACM marked as not effective / resubmission required:
 * - Set fixed control_forms.ineffective_due_date = IST today + INEFFECTIVE_DUE_DAYS
 * - Clear ineffective_reminder_datetime (last-sent)
 */
async function seedIneffectiveReminderDatetime(client, formId) {
  const normalizedFormId = String(formId || '').trim();
  if (!normalizedFormId) return null;

  const dueDays = getIneffectiveDueDays();

  await client.query(
    `
      UPDATE control_forms
      SET ineffective_due_date = (
        ((CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::date)
        + make_interval(days => $2)
      )::date
      WHERE form_id = $1
    `,
    [normalizedFormId, dueDays]
  );

  const result = await client.query(
    `
      INSERT INTO controls_reminder (form_id, ineffective_reminder_datetime)
      VALUES ($1, NULL)
      ON CONFLICT (form_id) DO UPDATE
      SET ineffective_reminder_datetime = NULL
      RETURNING ${controlsReminderUtcReturningSql('ineffective_reminder_datetime')}
    `,
    [normalizedFormId]
  );
  return result.rows?.[0]?.ineffective_reminder_datetime || null;
}

async function resetIneffectiveReminderDatetime(client, formId) {
  const normalizedFormId = String(formId || '').trim();
  if (!normalizedFormId) return;

  await client.query(
    `
      INSERT INTO controls_reminder (form_id, ineffective_reminder_datetime)
      VALUES ($1, NULL)
      ON CONFLICT (form_id) DO UPDATE
      SET ineffective_reminder_datetime = NULL
    `,
    [normalizedFormId]
  );

  await client.query(
    `
      UPDATE control_forms
      SET ineffective_due_date = NULL
      WHERE form_id = $1
    `,
    [normalizedFormId]
  );
}

/**
 * Mark deficiency-review reminder as last-sent-at = UTC now.
 * Next eligibility is last_sent + DEFICIENCY_REVIEW_REMINDER_INTERVAL_DAYS (env).
 */
async function updateDeficiencyReviewReminderDatetime(client, formId) {
  const result = await client.query(
    `
      INSERT INTO controls_reminder (form_id, deficiency_review_reminder_datetime)
      VALUES ($1, ${UTC_NOW_SQL})
      ON CONFLICT (form_id) DO UPDATE
      SET deficiency_review_reminder_datetime = EXCLUDED.deficiency_review_reminder_datetime
      RETURNING ${controlsReminderUtcReturningSql('deficiency_review_reminder_datetime')}
    `,
    [formId]
  );
  return result.rows?.[0]?.deficiency_review_reminder_datetime || null;
}

/**
 * On deficiency response submit:
 * - Set fixed control_forms.deficiency_review_due_date = IST today + DEFICIENCY_REVIEW_DUE_DAYS
 * - Clear deficiency_review_reminder_datetime (last-sent)
 */
async function seedDeficiencyReviewReminderDatetime(client, formId) {
  const normalizedFormId = String(formId || '').trim();
  if (!normalizedFormId) return null;

  const dueDays = getDeficiencyReviewDueDays();

  await client.query(
    `
      UPDATE control_forms
      SET deficiency_review_due_date = (
        ((CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::date)
        + make_interval(days => $2)
      )::date
      WHERE form_id = $1
    `,
    [normalizedFormId, dueDays]
  );

  const result = await client.query(
    `
      INSERT INTO controls_reminder (form_id, deficiency_review_reminder_datetime)
      VALUES ($1, NULL)
      ON CONFLICT (form_id) DO UPDATE
      SET deficiency_review_reminder_datetime = NULL
      RETURNING ${controlsReminderUtcReturningSql('deficiency_review_reminder_datetime')}
    `,
    [normalizedFormId]
  );
  return result.rows?.[0]?.deficiency_review_reminder_datetime || null;
}

async function resetDeficiencyReviewReminderDatetime(client, formId) {
  const normalizedFormId = String(formId || '').trim();
  if (!normalizedFormId) return;

  await client.query(
    `
      INSERT INTO controls_reminder (form_id, deficiency_review_reminder_datetime)
      VALUES ($1, NULL)
      ON CONFLICT (form_id) DO UPDATE
      SET deficiency_review_reminder_datetime = NULL
    `,
    [normalizedFormId]
  );

  await client.query(
    `
      UPDATE control_forms
      SET deficiency_review_due_date = NULL
      WHERE form_id = $1
    `,
    [normalizedFormId]
  );
}

/**
 * Reset last-sent approver reminder timestamp and clear fixed approver due date.
 */
async function resetReminderToApproverDatetimeForForms(formIds, clientOrPool = pool) {
  const ids = [...new Set((formIds || []).map((id) => String(id || '').trim()).filter(Boolean))];
  if (ids.length === 0) return;

  await clientOrPool.query(
    `
      INSERT INTO controls_reminder (form_id, reminder_to_approver_datetime)
      SELECT unnest($1::varchar[]), NULL
      ON CONFLICT (form_id) DO UPDATE
      SET reminder_to_approver_datetime = NULL
    `,
    [ids]
  );

  await clientOrPool.query(
    `
      UPDATE control_forms
      SET approver_due_date = NULL
      WHERE form_id = ANY($1::text[])
    `,
    [ids]
  );
}

function mapControlsReminderToApi(reminder) {
  if (!reminder) {
    return {
      reminder_datetime: null,
      reminder_to_approver_datetime: null,
      ineffective_reminder_datetime: null,
      deficiency_review_reminder_datetime: null,
    };
  }

  return {
    reminder_datetime: reminder.reminderDatetime ?? reminder.reminder_datetime ?? null,
    reminder_to_approver_datetime:
      reminder.reminderToApproverDatetime ?? reminder.reminder_to_approver_datetime ?? null,
    ineffective_reminder_datetime:
      reminder.ineffectiveReminderDatetime ?? reminder.ineffective_reminder_datetime ?? null,
    deficiency_review_reminder_datetime:
      reminder.deficiencyReviewReminderDatetime ?? reminder.deficiency_review_reminder_datetime ?? null,
  };
}

async function getControlsReminderByFormId(formId) {
  return prisma.controlsReminder.findUnique({
    where: { formId: String(formId || '').trim() },
  });
}

module.exports = {
  CONTROLS_REMINDER_JOIN_SQL,
  CONTROLS_REMINDER_SELECT_SQL,
  APPROVER_REMINDER_INTERVAL,
  INEFFECTIVE_REMINDER_INTERVAL,
  DEFICIENCY_REVIEW_REMINDER_INTERVAL,
  IST_CURRENT_DATE_SQL,
  REMINDER_DATETIME_DUE_SQL,
  REMINDER_TO_APPROVER_DATETIME_DUE_SQL,
  INEFFECTIVE_REMINDER_DATETIME_DUE_SQL,
  DEFICIENCY_REVIEW_REMINDER_DATETIME_DUE_SQL,
  NOT_EFFECTIVE_CONCLUSION_WHERE_SQL,
  normalizeDesignConclusion,
  isNotEffectiveConclusion,
  parsePositiveIntEnv,
  getApproverDueDays,
  getApproverReminderIntervalDays,
  getIneffectiveDueDays,
  getIneffectiveReminderIntervalDays,
  getDeficiencyReviewDueDays,
  getDeficiencyReviewReminderIntervalDays,
  buildReminderToApproverDatetimeDueSql,
  buildIneffectiveReminderDatetimeDueSql,
  buildDeficiencyReviewReminderDatetimeDueSql,
  formatReminderTimestampForLog,
  formatDueDateForEmail,
  getIntervalLiteral,
  resetReminderDatetimeForForms,
  resetReminderToApproverDatetimeForForms,
  updateReminderDatetime,
  updateReminderToApproverDatetime,
  updateIneffectiveReminderDatetime,
  updateDeficiencyReviewReminderDatetime,
  seedReminderToApproverDatetime,
  seedIneffectiveReminderDatetime,
  seedDeficiencyReviewReminderDatetime,
  resetIneffectiveReminderDatetime,
  resetDeficiencyReviewReminderDatetime,
  mapControlsReminderToApi,
  getControlsReminderByFormId,
};
