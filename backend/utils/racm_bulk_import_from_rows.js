const crypto = require('crypto');
const { normalizeColumnName } = require('./column_mapping');
const { logAuditEvent } = require('./auditLog');
const { calculateSampleRequired, getSampleSizeByFrequency } = require('./sample_required');

function generateFormId() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 15; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

async function generateUniqueFormId(client) {
  let formId;
  let isUnique = false;
  let attempts = 0;
  const maxAttempts = 100;

  while (!isUnique && attempts < maxAttempts) {
    formId = generateFormId();
    const checkQuery = 'SELECT id FROM control_forms WHERE form_id = $1';
    const result = await client.query(checkQuery, [formId]);
    if (result.rows.length === 0) {
      isUnique = true;
    } else {
      attempts++;
    }
  }

  if (!isUnique) {
    formId = crypto.randomBytes(8).toString('hex').toUpperCase().substring(0, 15);
    while (formId.length < 15) {
      formId += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'.charAt(Math.floor(Math.random() * 36));
    }
  }

  return formId;
}

function countEmptyValues(row) {
  let emptyCount = 0;
  Object.keys(row).forEach((key) => {
    const value = row[key];
    if (value === null || value === undefined || value === '' || String(value).trim() === '') {
      emptyCount++;
    }
  });
  return emptyCount;
}

function normalizeExcelTruthyToBoolean(value, columnName) {
  if (value === null || value === undefined) return false;
  const raw = String(value).trim();
  if (raw === '') return false;

  const normalized = raw.toLowerCase().replace(/[&/()-]/g, ' ').replace(/\s+/g, ' ').trim();
  const placeholders = new Set(['na', 'n a', 'n/a', 'none', '-', '--']);
  if (placeholders.has(normalized)) return false;

  const headerLikeByColumn = {
    completeness: new Set(['completeness']),
    existence_occurrence: new Set(['existence occurrence', 'existence and occurrence', 'existence  occurrence']),
    rights_and_obligation: new Set(['rights and obligations', 'rights obligations', 'rights and obligation']),
    valuation_and_allocation: new Set(['valuation and allocation', 'valuation allocation']),
    presentation_and_disclosure: new Set(['presentation and disclosure', 'presentation disclosure']),
  };

  const disallowed = headerLikeByColumn[columnName];
  if (disallowed && disallowed.has(normalized)) return false;

  return true;
}

/** True if same company already has a row with this business_process + financial_year + control_number. */
async function checkDuplicateForm(client, row, companyIdentifier, businessProcess, financialYear) {
  try {
    const bpKey = businessProcess != null ? String(businessProcess).trim() : '';
    const fyKey = financialYear != null ? String(financialYear).trim() : '';
    const cnKey =
      row.control_number !== null && row.control_number !== undefined && row.control_number !== ''
        ? String(row.control_number).trim()
        : '';

    if (!companyIdentifier || !bpKey || !fyKey || !cnKey) {
      return false;
    }

    const result = await client.query(
      `
        SELECT 1
        FROM control_forms
        WHERE company_identifier = $1
          AND LOWER(TRIM(business_process)) = LOWER(TRIM($2))
          AND TRIM(financial_year) = TRIM($3)
          AND TRIM(control_number) = TRIM($4)
        LIMIT 1;
      `,
      [companyIdentifier, bpKey, fyKey, cnKey]
    );

    return result.rows.length > 0;
  } catch (error) {
    console.error('Error checking for duplicate form:', error);
    return false;
  }
}

/** DB columns users may assign via custom header mapping (bulk import UI). financial_year comes from the upload form, not Excel. */
const MAPPABLE_DB_COLUMNS = new Set([
  'standard_control_description',
  'sub_process',
  'risk_description',
  'whether_fraud_risks_exist',
  'control_objective',
  'ipe_reference',
  'nature_of_control',
  'control_frequency',
  'control_number',
  'area',
  'risk_heat',
  'process_walkthrough',
  'control_relies_on_ipe',
  'audit_evidence_accuracy',
  'key_control',
  'application_name',
  'control_performer',
  'control_owner',
  'control_type_fo',
  'control_type_ma',
  'completeness',
  'existence_occurrence',
  'rights_and_obligation',
  'valuation_and_allocation',
  'presentation_and_disclosure',
]);

/**
 * Never take these from Excel row cells (set by server, upload form, or DB defaults).
 * Aligns with columns excluded from Excel import / manual create form.
 */
const SERVER_FILLED_DB_COLUMNS = new Set([
  'company_identifier',
  'form_id',
  'business_process',
  'financial_year',
  'due_date',
  'reminder_frequency',
  'sample_required',
  'sample_size',
  'doc_uploaded_by_user',
  'active',
  'status',
  'reason_by_approver',
  'remarks_by_user',
  'created_at',
  'sample_doc',
  'reminder_datetime',
  'approval_status_change_timestamp',
  'control_design_procs',
  'control_design_conclusion',
  'design_deficiency_desc',
]);

/** Same column order as POST /api/control-forms (manual create) + due_date/reminder_frequency from bulk upload form. */
const INSERT_COLUMNS = [
  'standard_control_description',
  'sub_process',
  'risk_description',
  'whether_fraud_risks_exist',
  'control_objective',
  'ipe_reference',
  'nature_of_control',
  'control_frequency',
  'control_number',
  'area',
  'risk_heat',
  'process_walkthrough',
  'control_relies_on_ipe',
  'audit_evidence_accuracy',
  'key_control',
  'application_name',
  'control_performer',
  'control_owner',
  'sample_size',
  'control_type_fo',
  'control_type_ma',
  'form_id',
  'company_identifier',
  'business_process',
  'financial_year',
  'sample_required',
  'due_date',
  'reminder_frequency',
  'completeness',
  'existence_occurrence',
  'rights_and_obligation',
  'valuation_and_allocation',
  'presentation_and_disclosure',
];

function transformExcelData(excelRows) {
  return excelRows.map((row) => {
    const dbRow = {};
    Object.keys(row).forEach((excelColumn) => {
      const dbColumn = normalizeColumnName(excelColumn);
      if (!dbColumn || SERVER_FILLED_DB_COLUMNS.has(dbColumn)) return;
      if (!INSERT_COLUMNS.includes(dbColumn)) return;
      const value = row[excelColumn];
      dbRow[dbColumn] =
        value !== null && value !== undefined && value !== '' ? String(value).trim() : null;
    });
    return dbRow;
  });
}

/**
 * @param {Array<Record<string, unknown>>} excelRows
 * @param {Record<string, string|null|undefined>} columnMapping - Excel header string -> DB column or null/__skip__ to ignore; omitted keys use normalizeColumnName
 */
function transformExcelDataWithColumnMapping(excelRows, columnMapping) {
  const hasExplicitMapping =
    columnMapping && typeof columnMapping === 'object' && !Array.isArray(columnMapping);

  return excelRows.map((row) => {
    const dbRow = {};
    Object.keys(row).forEach((excelColumn) => {
      let dbColumn = null;

      if (hasExplicitMapping && Object.prototype.hasOwnProperty.call(columnMapping, excelColumn)) {
        const raw = columnMapping[excelColumn];
        if (raw === null || raw === undefined || raw === '' || raw === '__skip__') {
          return;
        }
        const mapped = String(raw).trim();
        if (!MAPPABLE_DB_COLUMNS.has(mapped)) {
          return;
        }
        dbColumn = mapped;
      } else {
        dbColumn = normalizeColumnName(excelColumn);
      }

      if (!dbColumn || SERVER_FILLED_DB_COLUMNS.has(dbColumn)) {
        return;
      }
      if (!INSERT_COLUMNS.includes(dbColumn)) {
        return;
      }

      const value = row[excelColumn];
      dbRow[dbColumn] =
        value !== null && value !== undefined && value !== '' ? String(value).trim() : null;
    });
    return dbRow;
  });
}

/**
 * Insert RACM rows from already-transformed DB-shaped rows (same rules as process_excel_files).
 * Caller manages transaction (BEGIN/COMMIT/ROLLBACK).
 */
async function insertRacmRowsFromTransformedData(client, options) {
  const {
    transformedData,
    companyIdentifier,
    coordinatorEmailId,
    businessProcess,
    financialYear,
    fileDueDate,
    fileReminderFrequency,
  } = options;

  const columnList = INSERT_COLUMNS.join(', ');
  const placeholders = INSERT_COLUMNS.map((_, index) => `$${index + 1}`).join(', ');
  const insertQuery = `
    INSERT INTO control_forms (${columnList})
    VALUES (${placeholders})
    RETURNING id;
  `;

  let insertedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;
  let duplicateCount = 0;
  const duplicateControlNumberSamples = [];
  const seenDuplicateCn = new Set();

  for (let i = 0; i < transformedData.length; i++) {
    const row = transformedData[i];
    const emptyCount = countEmptyValues(row);
    if (emptyCount > 15) {
      skippedCount++;
      continue;
    }

    try {
      const isDuplicate = await checkDuplicateForm(client, row, companyIdentifier, businessProcess, financialYear);
      if (isDuplicate) {
        duplicateCount++;
        const cn =
          row.control_number !== null && row.control_number !== undefined && row.control_number !== ''
            ? String(row.control_number).trim()
            : '';
        if (cn && duplicateControlNumberSamples.length < 8 && !seenDuplicateCn.has(cn)) {
          seenDuplicateCn.add(cn);
          duplicateControlNumberSamples.push(cn);
        }
        continue;
      }

      const formId = await generateUniqueFormId(client);
      const currentTimestamp = new Date();
      const controlFrequencyRaw = row.control_frequency || null;
      const controlFrequency = controlFrequencyRaw ? String(controlFrequencyRaw).trim() : null;
      const sampleRequired = calculateSampleRequired(controlFrequency, currentTimestamp);
      const sampleSize = getSampleSizeByFrequency(controlFrequency);

      const values = INSERT_COLUMNS.map((col) => {
        if (col === 'company_identifier') return companyIdentifier;
        if (col === 'form_id') return formId;
        if (col === 'business_process') return businessProcess;
        if (col === 'financial_year') {
          return financialYear || null;
        }
        if (col === 'due_date') return fileDueDate || null;
        if (col === 'reminder_frequency') return fileReminderFrequency || null;
        if (col === 'sample_required') return sampleRequired;
        if (col === 'sample_size') return sampleSize !== null ? String(sampleSize) : null;
        if (
          col === 'completeness' ||
          col === 'existence_occurrence' ||
          col === 'rights_and_obligation' ||
          col === 'valuation_and_allocation' ||
          col === 'presentation_and_disclosure'
        ) {
          return normalizeExcelTruthyToBoolean(row[col], col);
        }
        return row[col] || null;
      });

      await client.query(insertQuery, values);
      insertedCount++;

      if (coordinatorEmailId) {
        await logAuditEvent('RACM created', coordinatorEmailId, formId);
      }
    } catch (rowError) {
      errorCount++;
      console.error(`  ✗ Error inserting bulk-import row ${i + 1}: ${rowError.message}`);
    }
  }

  return {
    insertedCount,
    skippedCount,
    duplicateCount,
    errorCount,
    duplicateControlNumberSamples,
  };
}

module.exports = {
  transformExcelData,
  transformExcelDataWithColumnMapping,
  insertRacmRowsFromTransformedData,
};
