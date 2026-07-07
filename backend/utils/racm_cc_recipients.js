const { pool } = require('./db');

const ALL_PROCESSES_KEYWORD = 'All_Processes';

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

async function getCcEmailsForRacm({
  companyIdentifier,
  businessProcess,
  unitId,
  excludeEmail,
}) {
  const normalizedCompany = String(companyIdentifier || '').trim();
  const normalizedProcess = String(businessProcess || '').trim();
  const normalizedUnit = String(unitId || '').trim();
  const exclude = normalizeEmail(excludeEmail);

  if (!normalizedCompany || !normalizedProcess || !normalizedUnit) {
    return [];
  }

  const result = await pool.query(
    `
      SELECT DISTINCT LOWER(TRIM(email_id)) AS email_id
      FROM racm_cc_users
      WHERE company_identifier = $1
        AND unit_id = $2
        AND (
          TRIM(COALESCE(business_process, '')) = $3
          OR TRIM(COALESCE(business_process, '')) = $4
        )
        AND COALESCE(TRIM(email_id), '') <> ''
      ORDER BY email_id ASC
    `,
    [normalizedCompany, normalizedUnit, normalizedProcess, ALL_PROCESSES_KEYWORD]
  );

  return result.rows
    .map((row) => normalizeEmail(row.email_id))
    .filter((email) => email && email !== exclude);
}

module.exports = {
  ALL_PROCESSES_KEYWORD,
  getCcEmailsForRacm,
};
