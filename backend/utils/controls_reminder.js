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

const APPROVER_REMINDER_INTERVAL = '2 days';
const INEFFECTIVE_REMINDER_INTERVAL = '2 days';
const DEFICIENCY_REVIEW_REMINDER_INTERVAL = '2 days';

/** UTC wall-clock "now" for reminder timestamp storage and comparisons. */
const UTC_NOW_SQL = `(CURRENT_TIMESTAMP AT TIME ZONE 'UTC')`;

const REMINDER_DATETIME_DUE_SQL = `${UTC_NOW_SQL} >= cr.reminder_datetime::timestamp`;
const REMINDER_TO_APPROVER_DATETIME_DUE_SQL = `${UTC_NOW_SQL} >= cr.reminder_to_approver_datetime::timestamp`;
const INEFFECTIVE_REMINDER_DATETIME_DUE_SQL = `${UTC_NOW_SQL} >= cr.ineffective_reminder_datetime::timestamp`;
const DEFICIENCY_REVIEW_REMINDER_DATETIME_DUE_SQL = `${UTC_NOW_SQL} >= cr.deficiency_review_reminder_datetime::timestamp`;

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

const UPSERT_REMINDER_TO_APPROVER_DATETIME_SQL = `
  INSERT INTO controls_reminder (form_id, reminder_to_approver_datetime)
  VALUES (
    $1,
    ${UTC_NOW_SQL} + ($2::interval)
  )
  ON CONFLICT (form_id) DO UPDATE
  SET reminder_to_approver_datetime = EXCLUDED.reminder_to_approver_datetime
  RETURNING ${controlsReminderUtcReturningSql('reminder_to_approver_datetime')}
`;

/**
 * Update reminder_to_approver_datetime for a form (fixed 2-day interval, UTC).
 */
async function updateReminderToApproverDatetime(client, formId) {
  const result = await client.query(UPSERT_REMINDER_TO_APPROVER_DATETIME_SQL, [
    formId,
    APPROVER_REMINDER_INTERVAL,
  ]);
  return result.rows?.[0]?.reminder_to_approver_datetime || null;
}

/**
 * Seed approver reminder timestamp inside a Prisma transaction (before status update).
 */
async function seedReminderToApproverDatetime(tx, formId) {
  const normalizedFormId = String(formId || '').trim();
  if (!normalizedFormId) return null;

  const rows = await tx.$queryRaw`
    INSERT INTO controls_reminder (form_id, reminder_to_approver_datetime)
    VALUES (
      ${normalizedFormId},
      (CURRENT_TIMESTAMP AT TIME ZONE 'UTC') + INTERVAL '2 days'
    )
    ON CONFLICT (form_id) DO UPDATE
    SET reminder_to_approver_datetime = EXCLUDED.reminder_to_approver_datetime
    RETURNING reminder_to_approver_datetime AT TIME ZONE 'UTC' AS reminder_to_approver_datetime
  `;
  return rows?.[0]?.reminder_to_approver_datetime ?? null;
}

const UPSERT_INEFFECTIVE_REMINDER_DATETIME_SQL = `
  INSERT INTO controls_reminder (form_id, ineffective_reminder_datetime)
  VALUES (
    $1,
    ${UTC_NOW_SQL} + ($2::interval)
  )
  ON CONFLICT (form_id) DO UPDATE
  SET ineffective_reminder_datetime = EXCLUDED.ineffective_reminder_datetime
  RETURNING ${controlsReminderUtcReturningSql('ineffective_reminder_datetime')}
`;

/**
 * Update ineffective_reminder_datetime for a form (fixed 2-day interval, UTC).
 */
async function updateIneffectiveReminderDatetime(client, formId) {
  const result = await client.query(UPSERT_INEFFECTIVE_REMINDER_DATETIME_SQL, [
    formId,
    INEFFECTIVE_REMINDER_INTERVAL,
  ]);
  return result.rows?.[0]?.ineffective_reminder_datetime || null;
}

/**
 * Seed ineffective reminder timestamp before marking a RACM as Not Effective.
 */
async function seedIneffectiveReminderDatetime(client, formId) {
  return updateIneffectiveReminderDatetime(client, formId);
}

const UPSERT_DEFICIENCY_REVIEW_REMINDER_DATETIME_SQL = `
  INSERT INTO controls_reminder (form_id, deficiency_review_reminder_datetime)
  VALUES (
    $1,
    ${UTC_NOW_SQL} + ($2::interval)
  )
  ON CONFLICT (form_id) DO UPDATE
  SET deficiency_review_reminder_datetime = EXCLUDED.deficiency_review_reminder_datetime
  RETURNING ${controlsReminderUtcReturningSql('deficiency_review_reminder_datetime')}
`;

async function updateDeficiencyReviewReminderDatetime(client, formId) {
  const result = await client.query(UPSERT_DEFICIENCY_REVIEW_REMINDER_DATETIME_SQL, [
    formId,
    DEFICIENCY_REVIEW_REMINDER_INTERVAL,
  ]);
  return result.rows?.[0]?.deficiency_review_reminder_datetime || null;
}

async function seedDeficiencyReviewReminderDatetime(client, formId) {
  return updateDeficiencyReviewReminderDatetime(client, formId);
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
}

/**
 * Reset reminder_to_approver_datetime for one or more forms.
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
  REMINDER_DATETIME_DUE_SQL,
  REMINDER_TO_APPROVER_DATETIME_DUE_SQL,
  INEFFECTIVE_REMINDER_DATETIME_DUE_SQL,
  DEFICIENCY_REVIEW_REMINDER_DATETIME_DUE_SQL,
  NOT_EFFECTIVE_CONCLUSION_WHERE_SQL,
  normalizeDesignConclusion,
  isNotEffectiveConclusion,
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
  resetDeficiencyReviewReminderDatetime,
  mapControlsReminderToApi,
  getControlsReminderByFormId,
};
