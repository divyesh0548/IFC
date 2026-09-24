/**
 * Natural / hierarchical control-number sorting.
 * e.g. C1, C2, C3.2, C3.4, C3.5, C3.5.1, C10
 */

function parseControlNumber(value) {
  const raw = String(value || '').trim().toUpperCase();
  if (!raw) {
    return { prefix: '', parts: [], raw: '' };
  }
  const match = raw.match(/^([A-Z]*)(.*)$/);
  const prefix = match?.[1] || '';
  const rest = match?.[2] || '';
  const parts = [];
  const re = /\d+/g;
  let token;
  while ((token = re.exec(rest)) !== null) {
    parts.push(Number.parseInt(token[0], 10));
  }
  return { prefix, parts, raw };
}

/**
 * Compare two control numbers for ascending natural order.
 * @returns {number} negative if a < b, positive if a > b, 0 if equal
 */
function compareControlNumbers(a, b) {
  const left = parseControlNumber(a);
  const right = parseControlNumber(b);

  if (left.prefix !== right.prefix) {
    return left.prefix.localeCompare(right.prefix);
  }

  const len = Math.max(left.parts.length, right.parts.length);
  for (let i = 0; i < len; i += 1) {
    const l = left.parts[i];
    const r = right.parts[i];
    if (l === undefined && r === undefined) break;
    if (l === undefined) return -1;
    if (r === undefined) return 1;
    if (l !== r) return l - r;
  }

  return left.raw.localeCompare(right.raw);
}

function sortByControlNumber(rows, getControlNumber = (row) => row?.control_number ?? row?.controlNumber) {
  return [...(rows || [])].sort((a, b) => compareControlNumbers(getControlNumber(a), getControlNumber(b)));
}

/**
 * PostgreSQL ORDER BY fragment for natural control-number ascending sort.
 * @param {string} columnExpr e.g. "cf.control_number"
 */
function sqlOrderByControlNumberAsc(columnExpr = 'control_number') {
  const col = `UPPER(TRIM(COALESCE(${columnExpr}, '')))`;
  return `
    COALESCE(substring(${col} from '^([A-Z]+)'), ''),
    (
      SELECT COALESCE(array_agg(part::int ORDER BY ord), ARRAY[]::int[])
      FROM (
        SELECT
          NULLIF(seg, '') AS part,
          ord
        FROM unnest(
          regexp_split_to_array(
            regexp_replace(${col}, '^[A-Z]+', ''),
            '[^0-9]+'
          )
        ) WITH ORDINALITY AS u(seg, ord)
      ) parsed
      WHERE part IS NOT NULL
        AND part ~ '^[0-9]+$'
    ),
    ${col}
  `;
}

module.exports = {
  compareControlNumbers,
  parseControlNumber,
  sortByControlNumber,
  sqlOrderByControlNumberAsc,
};
