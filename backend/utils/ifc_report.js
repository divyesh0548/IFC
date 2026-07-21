const { pool } = require('./db');
const { utcTs } = require('./sqlUtcTimestamps');

const ASSIGNMENT_ACTION = 'RACM Assignment';
const SENT_FOR_APPROVAL_ACTION = 'Sent RACM for approval';

function normalizeUnitIds(unitIds) {
  if (!Array.isArray(unitIds)) return [];
  return [...new Set(unitIds.map((id) => String(id || '').trim()).filter(Boolean))];
}

function emptyIfcReportPayload(units = []) {
  return {
    conclusions: {
      effective: 0,
      not_effective: 0,
      accepted_under_deviation: 0,
    },
    approval_statuses: {
      pending: 0,
      approved: 0,
      rejected: 0,
    },
    units: units.map((unit) => ({
      unit_id: unit.unit_id || null,
      unit_name: unit.unit_name || unit.unit_id || 'Unknown unit',
      total_users: 0,
      total_racms: 0,
    })),
    user_unit_distribution: [],
    response_timing: {
      average_ms: null,
      average_label: 'N/A',
      pair_count: 0,
      form_count: 0,
    },
  };
}

function formatDurationLabel(ms) {
  const totalMs = Number(ms);
  if (!Number.isFinite(totalMs) || totalMs < 0) return 'N/A';

  const totalSeconds = Math.round(totalMs / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const parts = [];
  if (days) parts.push(`${days}d`);
  if (hours) parts.push(`${hours}h`);
  if (minutes) parts.push(`${minutes}m`);
  if (!days && !hours && (minutes || seconds)) parts.push(`${seconds}s`);
  if (parts.length === 0) parts.push('0s');
  return parts.join(' ');
}

/**
 * Pair Assignment -> Sent chronologically by occurrence index.
 * Pair 1: first Assignment with first Sent (when both exist).
 * Pair 2: second Assignment with second Sent (when both exist).
 */
function pairAssignmentSentDeltas(eventsByFormId) {
  const deltasMs = [];
  let formCount = 0;

  for (const events of eventsByFormId.values()) {
    const assignments = [];
    const sents = [];

    for (const event of events) {
      const action = String(event.action || '').trim();
      const ts = event.timestamp instanceof Date
        ? event.timestamp.getTime()
        : new Date(event.timestamp).getTime();
      if (!Number.isFinite(ts)) continue;

      if (action === ASSIGNMENT_ACTION) assignments.push(ts);
      if (action === SENT_FOR_APPROVAL_ACTION) sents.push(ts);
    }

    let pairsForForm = 0;
    const maxPairs = Math.min(2, assignments.length, sents.length);

    for (let index = 0; index < maxPairs; index += 1) {
      const delta = sents[index] - assignments[index];
      if (delta >= 0) {
        deltasMs.push(delta);
        pairsForForm += 1;
      }
    }

    if (pairsForForm > 0) formCount += 1;
  }

  return { deltasMs, formCount };
}

async function buildIfcReport({ companyIdentifier, units }) {
  const normalizedCompany = String(companyIdentifier || '').trim();
  const unitRows = Array.isArray(units) ? units : [];
  const unitIds = normalizeUnitIds(unitRows.map((row) => row.unit_id));

  if (!normalizedCompany || unitIds.length === 0) {
    return emptyIfcReportPayload(unitRows);
  }

  const [
    conclusionStatusResult,
    userUnitDistributionResult,
    usersByUnitResult,
    racmsByUnitResult,
    auditEventsResult,
  ] = await Promise.all([
    pool.query(
      `
        SELECT
          COUNT(*) FILTER (
            WHERE LOWER(TRIM(COALESCE(cf.control_design_conclusion, ''))) = 'effective'
          )::int AS effective_count,
          COUNT(*) FILTER (
            WHERE LOWER(TRIM(COALESCE(cf.control_design_conclusion, ''))) = 'not effective'
          )::int AS not_effective_count,
          COUNT(*) FILTER (
            WHERE LOWER(TRIM(COALESCE(cf.control_design_conclusion, ''))) = 'accepted under deviation'
          )::int AS accepted_under_deviation_count,
          COUNT(*) FILTER (
            WHERE
              COALESCE(NULLIF(TRIM(cf.status), ''), '') = ''
              OR LOWER(TRIM(COALESCE(cf.status, ''))) = 'pending'
              OR LOWER(TRIM(COALESCE(cf.status, ''))) = 'sent for approval'
              OR LOWER(TRIM(COALESCE(cf.status, ''))) = 'null'
          )::int AS pending_count,
          COUNT(*) FILTER (
            WHERE LOWER(TRIM(COALESCE(cf.status, ''))) = 'approved'
          )::int AS approved_count,
          COUNT(*) FILTER (
            WHERE LOWER(TRIM(COALESCE(cf.status, ''))) = 'rejected'
          )::int AS rejected_count
        FROM control_forms cf
        WHERE cf.company_identifier = $1
          AND NULLIF(TRIM(cf.unit_id), '') = ANY($2::text[])
      `,
      [normalizedCompany, unitIds]
    ),
    pool.query(
      `
        SELECT
          membership_scope.unit_count,
          COUNT(*)::int AS total_users
        FROM (
          SELECT
            LOWER(TRIM(u.email_id)) AS normalized_email,
            COUNT(DISTINCT NULLIF(TRIM(uum.unit_id), ''))::int AS unit_count
          FROM ifc_users u
          INNER JOIN user_unit_memberships uum
            ON uum.company_identifier = u.company_identifier
           AND LOWER(TRIM(uum.user_email_id)) = LOWER(TRIM(u.email_id))
          WHERE u.company_identifier = $1
            AND u.role = 'user'
            AND NULLIF(TRIM(uum.unit_id), '') = ANY($2::text[])
          GROUP BY LOWER(TRIM(u.email_id))
        ) membership_scope
        WHERE membership_scope.unit_count > 1
        GROUP BY membership_scope.unit_count
        ORDER BY membership_scope.unit_count ASC
      `,
      [normalizedCompany, unitIds]
    ),
    pool.query(
      `
        SELECT
          NULLIF(TRIM(uum.unit_id), '') AS unit_id,
          COUNT(DISTINCT LOWER(TRIM(uum.user_email_id)))::int AS total_users
        FROM user_unit_memberships uum
        WHERE uum.company_identifier = $1
          AND NULLIF(TRIM(uum.unit_id), '') = ANY($2::text[])
        GROUP BY NULLIF(TRIM(uum.unit_id), '')
      `,
      [normalizedCompany, unitIds]
    ),
    pool.query(
      `
        SELECT
          NULLIF(TRIM(cf.unit_id), '') AS unit_id,
          COUNT(*)::int AS total_racms
        FROM control_forms cf
        WHERE cf.company_identifier = $1
          AND NULLIF(TRIM(cf.unit_id), '') = ANY($2::text[])
        GROUP BY NULLIF(TRIM(cf.unit_id), '')
      `,
      [normalizedCompany, unitIds]
    ),
    pool.query(
      `
        SELECT
          al.form_id,
          al.action,
          ${utcTs('al.timestamp')}
        FROM audit_logs_racm al
        INNER JOIN control_forms cf
          ON cf.form_id = al.form_id
        WHERE cf.company_identifier = $1
          AND NULLIF(TRIM(cf.unit_id), '') = ANY($2::text[])
          AND al.action IN ($3, $4)
          AND al.form_id IS NOT NULL
        ORDER BY al.form_id ASC, al.timestamp ASC NULLS LAST, al.id ASC
      `,
      [normalizedCompany, unitIds, ASSIGNMENT_ACTION, SENT_FOR_APPROVAL_ACTION]
    ),
  ]);

  const totals = conclusionStatusResult.rows[0] || {};
  const usersByUnit = new Map(
    usersByUnitResult.rows
      .filter((row) => row.unit_id)
      .map((row) => [String(row.unit_id), Number(row.total_users || 0)])
  );
  const racmsByUnit = new Map(
    racmsByUnitResult.rows
      .filter((row) => row.unit_id)
      .map((row) => [String(row.unit_id), Number(row.total_racms || 0)])
  );

  const unitsPayload = unitRows.map((unit) => {
    const unitId = String(unit.unit_id || '').trim();
    return {
      unit_id: unitId || null,
      unit_name: String(unit.unit_name || unitId || 'Unknown unit').trim() || 'Unknown unit',
      total_users: usersByUnit.get(unitId) || 0,
      total_racms: racmsByUnit.get(unitId) || 0,
    };
  });
  const userUnitDistribution = userUnitDistributionResult.rows.map((row) => ({
    unit_count: Number(row.unit_count || 0),
    total_users: Number(row.total_users || 0),
  }));

  const eventsByFormId = new Map();
  for (const row of auditEventsResult.rows) {
    const formId = String(row.form_id || '').trim();
    if (!formId) continue;
    if (!eventsByFormId.has(formId)) eventsByFormId.set(formId, []);
    eventsByFormId.get(formId).push(row);
  }

  const { deltasMs, formCount } = pairAssignmentSentDeltas(eventsByFormId);
  const pairCount = deltasMs.length;
  const averageMs = pairCount > 0
    ? Math.round(deltasMs.reduce((sum, value) => sum + value, 0) / pairCount)
    : null;

  return {
    conclusions: {
      effective: Number(totals.effective_count || 0),
      not_effective: Number(totals.not_effective_count || 0),
      accepted_under_deviation: Number(totals.accepted_under_deviation_count || 0),
    },
    approval_statuses: {
      pending: Number(totals.pending_count || 0),
      approved: Number(totals.approved_count || 0),
      rejected: Number(totals.rejected_count || 0),
    },
    units: unitsPayload,
    user_unit_distribution: userUnitDistribution,
    response_timing: {
      average_ms: averageMs,
      average_label: formatDurationLabel(averageMs),
      pair_count: pairCount,
      form_count: formCount,
    },
  };
}

module.exports = {
  buildIfcReport,
  emptyIfcReportPayload,
  pairAssignmentSentDeltas,
  formatDurationLabel,
  ASSIGNMENT_ACTION,
  SENT_FOR_APPROVAL_ACTION,
};
