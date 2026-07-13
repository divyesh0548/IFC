/**
 * Force UTC timestamptz on raw-SQL SELECT/RETURNING of timestamp-without-time-zone columns.
 *
 * Storage remains TIMESTAMP (UTC wall-clock). Selecting `col AT TIME ZONE 'UTC'` yields
 * TIMESTAMPTZ so node-pg returns a timezone-aware instant (not a bare UTC string).
 *
 * Do not use these casts for Prisma Client queries.
 */

function utcTs(qualifiedColumn, asName = null) {
  const alias = asName || String(qualifiedColumn).split('.').pop();
  return `${qualifiedColumn} AT TIME ZONE 'UTC' AS ${alias}`;
}

function utcTsList(qualifiedColumns) {
  return qualifiedColumns.map((column) => utcTs(column)).join(',\n  ');
}

const CONTROL_FORM_TIMESTAMP_COLUMNS = [
  'created_at',
  'updated_at',
  'sent_for_approval_timestamp',
  'approval_status_change_timestamp',
  'last_rejected_at',
  'coordinator_assigned_at',
];

const CONTROLS_REMINDER_TIMESTAMP_COLUMNS = [
  'reminder_datetime',
  'reminder_to_approver_datetime',
  'ineffective_reminder_datetime',
  'deficiency_review_reminder_datetime',
];

const CHANGE_REQUEST_TIMESTAMP_COLUMNS = [
  'requested_at',
  'reviewed_at',
  'created_at',
  'updated_at',
];

const CHANGE_REQUEST_ITEM_TIMESTAMP_COLUMNS = [
  'created_at',
  'updated_at',
];

const DEFICIENCY_RESPONSE_TIMESTAMP_COLUMNS = [
  'created_at',
  'updated_at',
];

const DEFICIENCY_SUBMISSION_TIMESTAMP_COLUMNS = [
  'submitted_at',
  'reviewed_at',
  'created_at',
];

const DEFICIENCY_ATTACHMENT_TIMESTAMP_COLUMNS = [
  'created_at',
];

/** Override fragment after `cf.*` (or alias.*) so node-pg keeps the cast columns. */
function controlFormsUtcOverridesSql(alias = 'cf') {
  return utcTsList(CONTROL_FORM_TIMESTAMP_COLUMNS.map((col) => `${alias}.${col}`));
}

/** Unqualified overrides for `RETURNING *, …` on control_forms. */
function controlFormsUtcReturningOverridesSql() {
  return utcTsList(CONTROL_FORM_TIMESTAMP_COLUMNS);
}

function controlsReminderUtcSelectSql(alias = 'cr') {
  return utcTsList(CONTROLS_REMINDER_TIMESTAMP_COLUMNS.map((col) => `${alias}.${col}`));
}

function controlsReminderUtcReturningSql(column) {
  return utcTs(column);
}

function changeRequestUtcOverridesSql(alias = 'cr') {
  return utcTsList(CHANGE_REQUEST_TIMESTAMP_COLUMNS.map((col) => `${alias}.${col}`));
}

function changeRequestItemUtcOverridesSql(alias = 'cri') {
  return utcTsList(CHANGE_REQUEST_ITEM_TIMESTAMP_COLUMNS.map((col) => `${alias}.${col}`));
}

function changeRequestUtcReturningSql() {
  return utcTsList(CHANGE_REQUEST_TIMESTAMP_COLUMNS);
}

function changeRequestItemUtcReturningSql() {
  return utcTsList(CHANGE_REQUEST_ITEM_TIMESTAMP_COLUMNS);
}

function deficiencyResponseUtcOverridesSql(alias = 'dr') {
  return utcTsList(DEFICIENCY_RESPONSE_TIMESTAMP_COLUMNS.map((col) => `${alias}.${col}`));
}

function deficiencySubmissionUtcOverridesSql(alias = 'drs') {
  return utcTsList(DEFICIENCY_SUBMISSION_TIMESTAMP_COLUMNS.map((col) => `${alias}.${col}`));
}

function deficiencyAttachmentUtcOverridesSql(alias = 'dra') {
  return utcTsList(DEFICIENCY_ATTACHMENT_TIMESTAMP_COLUMNS.map((col) => `${alias}.${col}`));
}

function createdAtUtcSql(qualifiedOrBare = 'created_at') {
  return utcTs(qualifiedOrBare, 'created_at');
}

function createdAtUpdatedAtUtcSql(alias = null) {
  if (!alias) {
    return utcTsList(['created_at', 'updated_at']);
  }
  return utcTsList([`${alias}.created_at`, `${alias}.updated_at`]);
}

function timestampUtcSql(qualifiedOrBare = 'timestamp') {
  return utcTs(qualifiedOrBare, 'timestamp');
}

function rejectionTimestampUtcSql(qualifiedOrBare = 'rejection_timestamp') {
  return utcTs(qualifiedOrBare, 'rejection_timestamp');
}

module.exports = {
  utcTs,
  utcTsList,
  CONTROL_FORM_TIMESTAMP_COLUMNS,
  CONTROLS_REMINDER_TIMESTAMP_COLUMNS,
  controlFormsUtcOverridesSql,
  controlFormsUtcReturningOverridesSql,
  controlsReminderUtcSelectSql,
  controlsReminderUtcReturningSql,
  changeRequestUtcOverridesSql,
  changeRequestItemUtcOverridesSql,
  changeRequestUtcReturningSql,
  changeRequestItemUtcReturningSql,
  deficiencyResponseUtcOverridesSql,
  deficiencySubmissionUtcOverridesSql,
  deficiencyAttachmentUtcOverridesSql,
  createdAtUtcSql,
  createdAtUpdatedAtUtcSql,
  timestampUtcSql,
  rejectionTimestampUtcSql,
  requestedAtUtcSql: (qualifiedOrBare = 'requested_at') => utcTs(qualifiedOrBare, 'requested_at'),
  reviewedAtUtcSql: (qualifiedOrBare = 'reviewed_at') => utcTs(qualifiedOrBare, 'reviewed_at'),
};
