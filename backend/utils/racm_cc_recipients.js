const { pool } = require('./db');

const ALL_PROCESSES_KEYWORD = 'All_Processes';

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

/**
 * Resolve CC emails for a RACM:
 * - process-wide rows (empty racm_identifier) for the RACM's business process or All_Processes
 * - RACM-specific rows where racm_identifier = form_id
 */
async function getCcEmailsForRacm({
  companyIdentifier,
  businessProcess,
  unitId,
  formId,
  excludeEmail,
}) {
  const normalizedCompany = String(companyIdentifier || '').trim();
  const normalizedProcess = String(businessProcess || '').trim();
  const normalizedUnit = String(unitId || '').trim();
  const normalizedFormId = String(formId || '').trim();
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
        AND COALESCE(TRIM(email_id), '') <> ''
        AND (
          (
            COALESCE(TRIM(racm_identifier), '') = ''
            AND (
              TRIM(COALESCE(business_process, '')) = $3
              OR TRIM(COALESCE(business_process, '')) = $4
            )
          )
          OR (
            $5::text <> ''
            AND TRIM(COALESCE(racm_identifier, '')) = $5::text
          )
        )
      ORDER BY email_id ASC
    `,
    [
      normalizedCompany,
      normalizedUnit,
      normalizedProcess,
      ALL_PROCESSES_KEYWORD,
      normalizedFormId,
    ]
  );

  return result.rows
    .map((row) => normalizeEmail(row.email_id))
    .filter((email) => email && email !== exclude);
}

module.exports = {
  ALL_PROCESSES_KEYWORD,
  getCcEmailsForRacm,
};
