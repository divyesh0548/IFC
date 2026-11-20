/**
 * RACM uniqueness is scoped to company_identifier + control_number.
 * Different companies may reuse the same control number.
 */

const DUPLICATE_RACM_COMPANY_SCOPED_MESSAGE =
  'Your company already has a RACM with the same Control Number. Duplication is not allowed.';

function partitionUniqueCompanyControlNumbers(rows, existingByCompany = new Map()) {
  const seenByCompany = new Map();
  const uniqueRows = [];
  const duplicateRows = [];

  for (const row of rows) {
    const companyIdentifier = String(row.company_identifier || '').trim();
    const controlNumber = row.control_number != null ? String(row.control_number).trim() : '';

    if (!companyIdentifier || !controlNumber) {
      uniqueRows.push(row);
      continue;
    }

    const existingNumbers = existingByCompany.get(companyIdentifier);
    let seenNumbers = seenByCompany.get(companyIdentifier);
    if (!seenNumbers) {
      seenNumbers = new Set();
      seenByCompany.set(companyIdentifier, seenNumbers);
    }

    if (existingNumbers?.has(controlNumber) || seenNumbers.has(controlNumber)) {
      duplicateRows.push(row);
      continue;
    }

    seenNumbers.add(controlNumber);
    uniqueRows.push(row);
  }

  return { uniqueRows, duplicateRows };
}

/**
 * @param {{ skippedCount: number, duplicateCount: number, errorCount: number, duplicateControlNumberSamples?: string[] }} stats
 */
function formatBulkImportZeroInsertedMessage(stats) {
  const { skippedCount, duplicateCount, errorCount } = stats;
  const parts = [];

  if (duplicateCount > 0) {
    parts.push(
      `${duplicateCount} row(s) were not imported because your company already has a RACM with the same Control Number.`
    );
  }
  if (skippedCount > 0) {
    parts.push(
      `${skippedCount} row(s) were skipped because they had too many empty cells.`
    );
  }
  if (errorCount > 0) {
    parts.push(`${errorCount} row(s) failed due to database or validation errors.`);
  }
  if (parts.length === 0) {
    return 'No RACMs were created.';
  }
  return parts.join(' ');
}

/**
 * @param {number} insertedCount
 * @param {{ duplicateCount: number, skippedCount: number, errorCount: number }} stats
 */
function formatBulkImportSuccessMessage(insertedCount, stats) {
  const { duplicateCount, skippedCount, errorCount } = stats;
  let msg = `Successfully created ${insertedCount} RACM(s).`;
  const extras = [];
  if (duplicateCount > 0) {
    extras.push(`${duplicateCount} row(s) skipped as duplicates (same company, Control Number)`);
  }
  if (skippedCount > 0) {
    extras.push(`${skippedCount} row(s) skipped as mostly empty`);
  }
  if (errorCount > 0) {
    extras.push(`${errorCount} row(s) failed`);
  }
  if (extras.length > 0) {
    msg += ` ${extras.join('; ')}.`;
  }
  return msg;
}

module.exports = {
  DUPLICATE_RACM_COMPANY_SCOPED_MESSAGE,
  partitionUniqueCompanyControlNumbers,
  formatBulkImportZeroInsertedMessage,
  formatBulkImportSuccessMessage,
};
