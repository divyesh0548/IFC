const crypto = require('crypto');
const { normalizeColumnName } = require('./column_mapping');
const { logAuditEvent } = require('./auditLog');
const {
  getSampleSizeByFrequency,
  normalizeControlFrequencyValue,
} = require('./sample_required');
const {
  loadUnitFrequencySampleSizeMap,
  resolveUnitDefaultSampleSize,
  buildSampleSizeForFrequency,
} = require('./sample_size_resolver');
const { getBusinessProcessCodeForCompany } = require('./business_process_master');
const {
  ensureActiveTemplateForUnit,
  getTemplateWithFieldsById,
  validateDynamicValuesAgainstTemplate,
  isRacmTemplateSchemaReady,
  RACM_TEMPLATE_SECTIONS,
} = require('./racm_templates');

const EXTRA_FIELD_MAPPING_PREFIX = 'extra:';

function parseExtraFieldMappingValue(value) {
  const raw = String(value || '');
  if (!raw.startsWith(EXTRA_FIELD_MAPPING_PREFIX)) return null;
  const fieldKey = raw.slice(EXTRA_FIELD_MAPPING_PREFIX.length).trim();
  return fieldKey || null;
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

function normalizeBusinessProcessValue(value) {
  return String(value || '').trim();
}

function parseControlNumberSuffix(controlNumber, prefix) {
  const raw = String(controlNumber || '').trim();
  const normalizedPrefix = String(prefix || '').trim();
  if (!raw || !normalizedPrefix) return null;
  if (!raw.toUpperCase().startsWith(normalizedPrefix.toUpperCase())) return null;

  const suffix = raw.slice(normalizedPrefix.length).trim();
  if (!/^\d+$/.test(suffix)) return null;
  return Number.parseInt(suffix, 10);
}

async function getNextGeneratedControlNumberStart(client, companyIdentifier, prefix, transformedData) {
  const companyId = String(companyIdentifier || '').trim();
  const normalizedPrefix = String(prefix || '').trim();
  if (!companyId || !normalizedPrefix) return 1;

  const result = await client.query(
    `
      SELECT control_number
      FROM control_forms
      WHERE company_identifier = $1
        AND NULLIF(TRIM(COALESCE(control_number, '')), '') IS NOT NULL
        AND UPPER(TRIM(control_number)) LIKE UPPER($2)
    `,
    [companyId, `${normalizedPrefix}%`]
  );

  let maxSuffix = 0;
  for (const row of result.rows) {
    const suffix = parseControlNumberSuffix(row.control_number, normalizedPrefix);
    if (suffix !== null && suffix > maxSuffix) {
      maxSuffix = suffix;
    }
  }

  for (const row of transformedData || []) {
    const suffix = parseControlNumberSuffix(row?.control_number, normalizedPrefix);
    if (suffix !== null && suffix > maxSuffix) {
      maxSuffix = suffix;
    }
  }

  return maxSuffix + 1;
}

async function findExistingCompanyControlNumberDuplicates(client, companyIdentifier, transformedData) {
  const companyId = String(companyIdentifier || '').trim();
  if (!companyId) return [];

  const uploadControlNumbers = Array.from(
    new Set(
      (transformedData || [])
        .map((row) => (row?.control_number != null ? String(row.control_number).trim() : ''))
        .filter(Boolean)
    )
  );

  if (uploadControlNumbers.length === 0) return [];

  const result = await client.query(
    `
      SELECT DISTINCT TRIM(control_number) AS control_number
      FROM control_forms
      WHERE company_identifier = $1
        AND NULLIF(TRIM(COALESCE(control_number, '')), '') IS NOT NULL
        AND TRIM(control_number) = ANY($2::text[])
      ORDER BY TRIM(control_number) ASC
    `,
    [companyId, uploadControlNumbers]
  );

  return result.rows
    .map((row) => String(row.control_number || '').trim())
    .filter(Boolean);
}

function findDuplicateControlNumbersWithinUpload(transformedData) {
  const counts = new Map();

  for (const row of transformedData || []) {
    const displayValue = row?.control_number != null ? String(row.control_number).trim() : '';
    if (!displayValue) continue;
    counts.set(displayValue, (counts.get(displayValue) || 0) + 1);
  }

  return Array.from(counts.entries())
    .filter(([, count]) => count > 1)
    .map(([value]) => value)
    .sort((a, b) => a.localeCompare(b));
}

async function prepareBulkImportRows(client, options) {
  const { transformedData, companyIdentifier, businessProcess } = options;
  const preparedRows = (transformedData || []).map((row) => ({ ...row }));

  const rowsMissingControlNumber = preparedRows.filter((row) => {
    const cn = row?.control_number != null ? String(row.control_number).trim() : '';
    return cn === '';
  });

  if (rowsMissingControlNumber.length > 0) {
    const generatedControlNumberPrefix = await getBusinessProcessCodeForCompany(client, companyIdentifier, businessProcess);
    if (!generatedControlNumberPrefix) {
      const error = new Error('No Business Process code found for the selected Business Process');
      error.statusCode = 400;
      throw error;
    }

    let nextGeneratedControlNumber = await getNextGeneratedControlNumberStart(
      client,
      companyIdentifier,
      generatedControlNumberPrefix,
      preparedRows
    );

    for (const row of preparedRows) {
      const currentControlNumber =
        row.control_number !== null && row.control_number !== undefined
          ? String(row.control_number).trim()
          : '';
      if (!currentControlNumber) {
        row.control_number = `${generatedControlNumberPrefix}${nextGeneratedControlNumber}`;
        nextGeneratedControlNumber += 1;
      }
    }
  }

  return {
    preparedRows,
    duplicateControlNumbersInUpload: findDuplicateControlNumbersWithinUpload(preparedRows),
    duplicateExistingCompanyControlNumbers: await findExistingCompanyControlNumberDuplicates(
      client,
      companyIdentifier,
      preparedRows
    ),
  };
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
]);

/**
 * Never take these from Excel row cells (set by server, upload form, or DB defaults).
 * Aligns with columns excluded from Excel import / manual create form.
 */
const SERVER_FILLED_DB_COLUMNS = new Set([
  'company_identifier',
  'form_id',
  'unit_id',
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
  'reminder_to_approver_datetime',
  'ineffective_reminder_datetime',
  'deficiency_review_reminder_datetime',
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
  'unit_id',
  'active',
  'business_process',
  'financial_year',
  'sample_required',
  'due_date',
  'reminder_frequency',
  'template_id',
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
function transformExcelDataWithColumnMapping(excelRows, columnMapping, allowedExtraFieldKeys = null) {
  const hasExplicitMapping =
    columnMapping && typeof columnMapping === 'object' && !Array.isArray(columnMapping);

  if (hasExplicitMapping) {
    const usedTargets = new Map();
    for (const [header, rawTarget] of Object.entries(columnMapping)) {
      if (rawTarget == null || rawTarget === '' || rawTarget === '__skip__') continue;
      const target = String(rawTarget).trim();
      if (usedTargets.has(target)) {
        const error = new Error(`RACM field "${target}" cannot map to more than one Excel column ("${usedTargets.get(target)}", "${header}").`);
        error.statusCode = 400;
        throw error;
      }
      usedTargets.set(target, header);
    }
  }

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
        const extraFieldKey = parseExtraFieldMappingValue(mapped);
        if (extraFieldKey) {
          if (allowedExtraFieldKeys && !allowedExtraFieldKeys.has(extraFieldKey)) {
            return;
          }
          if (!dbRow.dynamic_values) dbRow.dynamic_values = {};
          const value = row[excelColumn];
          dbRow.dynamic_values[extraFieldKey] =
            value !== null && value !== undefined && String(value).trim() !== ''
              ? String(value).trim()
              : '';
          return;
        }
        if (!MAPPABLE_DB_COLUMNS.has(mapped)) {
          return;
        }
        dbColumn = mapped;
      } else if (hasExplicitMapping) {
        return; // Explicit maps never infer targets for omitted columns.
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

function validateBulkImportControlFrequencies(transformedData) {
  const rows = Array.isArray(transformedData) ? transformedData : [];
  const controlFrequencyValues = [];
  let hasControlFrequencyColumn = false;
  let hasBlankControlFrequency = false;

  for (const row of rows) {
    if (row && Object.prototype.hasOwnProperty.call(row, 'control_frequency')) {
      hasControlFrequencyColumn = true;
    }

    const rawValue = row?.control_frequency;
    const trimmedValue = rawValue !== null && rawValue !== undefined ? String(rawValue).trim() : '';

    if (trimmedValue === '') {
      hasBlankControlFrequency = true;
      continue;
    }

    controlFrequencyValues.push(trimmedValue);
  }

  if (!hasControlFrequencyColumn && controlFrequencyValues.length === 0) {
    return {
      ok: false,
      reason: 'missing_column',
      message: 'Control Frequency column was not found in the Excel data. No RACMs were imported.',
      invalidValues: [],
    };
  }

  if (hasBlankControlFrequency) {
    return {
      ok: false,
      reason: 'blank_value',
      message: 'Control Frequency is missing for one or more Excel rows. Update the Excel file and upload again.',
      invalidValues: [],
    };
  }

  const invalidValues = Array.from(
    new Set(
      controlFrequencyValues.filter((value) => getSampleSizeByFrequency(value) === null)
    )
  ).sort((a, b) => a.localeCompare(b));

  if (invalidValues.length > 0) {
    return {
      ok: false,
      reason: 'invalid_value',
      message: `Unsupported Control Frequency value(s) found in Excel: ${invalidValues.join(', ')}. Update the Excel file and upload again.`,
      invalidValues,
      normalizedInvalidValues: invalidValues.map((value) => normalizeControlFrequencyValue(value)),
    };
  }

  return {
    ok: true,
    reason: null,
    message: '',
    invalidValues: [],
  };
}

function applyControlFrequencyValueMapping(transformedData, controlFrequencyValueMapping) {
  if (
    !controlFrequencyValueMapping ||
    typeof controlFrequencyValueMapping !== 'object' ||
    Array.isArray(controlFrequencyValueMapping)
  ) {
    return Array.isArray(transformedData) ? transformedData.map((row) => ({ ...row })) : [];
  }

  const exactMapping = new Map();
  const normalizedMapping = new Map();

  for (const [rawKey, rawValue] of Object.entries(controlFrequencyValueMapping)) {
    const source = String(rawKey || '').trim();
    const target = String(rawValue || '').trim();
    if (!source || !target) continue;
    exactMapping.set(source, target);
    normalizedMapping.set(normalizeControlFrequencyValue(source), target);
  }

  return (Array.isArray(transformedData) ? transformedData : []).map((row) => {
    const nextRow = { ...row };
    const rawValue = nextRow.control_frequency;
    const trimmedValue = rawValue !== null && rawValue !== undefined ? String(rawValue).trim() : '';

    if (!trimmedValue) {
      return nextRow;
    }

    const exactMatch = exactMapping.get(trimmedValue);
    if (exactMatch) {
      nextRow.control_frequency = exactMatch;
      return nextRow;
    }

    const normalizedMatch = normalizedMapping.get(normalizeControlFrequencyValue(trimmedValue));
    if (normalizedMatch) {
      nextRow.control_frequency = normalizedMatch;
    }

    return nextRow;
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
    unitId,
  } = options;

  const columnList = INSERT_COLUMNS.join(', ');


  let insertedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;
  let duplicateCount = 0;
  const duplicateControlNumberSamples = [];
  const createdAuditEvents = [];
  const unitSampleSizeMap = unitId
    ? await loadUnitFrequencySampleSizeMap(client, companyIdentifier, unitId)
    : new Map();

  let activeTemplateId = null;
  let extraFields = [];
  if (unitId && await isRacmTemplateSchemaReady(client)) {
    const templateResult = await ensureActiveTemplateForUnit(client, {
      companyIdentifier,
      unitId,
      createdBy: coordinatorEmailId || 'system',
    });
    if (templateResult.ok) {
      activeTemplateId = templateResult.template.id;
      const templateDetails = await getTemplateWithFieldsById(client, activeTemplateId);
      if (templateDetails.ok) {
        extraFields = (templateDetails.extra_fields || []).filter(
          (field) => String(field.section_key || '').trim() !== RACM_TEMPLATE_SECTIONS.DESIGN_IMPLEMENTATION
        );
      }
    }
  }

  // Validate every row before writing controls, then use bounded multi-row inserts.
  const candidates = [];
  for (let i = 0; i < transformedData.length; i++) {
    const row = transformedData[i];
    if (countEmptyValues(row) > 15) {
      skippedCount++;
      continue;
    }
    const controlFrequency = row.control_frequency ? String(row.control_frequency).trim() : null;
    const builtSample = buildSampleSizeForFrequency(
      controlFrequency, new Date(), resolveUnitDefaultSampleSize(controlFrequency, unitSampleSizeMap)
    );
    const dynamicValues = {};
    for (const field of extraFields) {
      if (Object.prototype.hasOwnProperty.call(row.dynamic_values || {}, field.field_key)) {
        dynamicValues[field.field_key] = row.dynamic_values[field.field_key];
      }
    }
    const validation = validateDynamicValuesAgainstTemplate(extraFields, dynamicValues);
    if (!builtSample.ok || !validation.ok) {
      const error = new Error(`Row ${i + 1}: ${!builtSample.ok ? builtSample.message : validation.message}. No RACMs were imported.`);
      error.statusCode = 400;
      throw error;
    }
    candidates.push({ row, builtSample, dynamicValues: validation.dynamicValues || {} });
  }

  const generatedIds = new Set();
  for (const candidate of candidates) {
    let formId;
    do { formId = crypto.randomBytes(8).toString('hex').toUpperCase().slice(0, 15); }
    while (generatedIds.has(formId));
    generatedIds.add(formId);
    candidate.formId = formId;
  }
  // Collision detection is one query for the whole upload, rather than one per row.
  if (candidates.length) {
    const existing = await client.query('SELECT form_id FROM control_forms WHERE form_id = ANY($1::text[])', [[...generatedIds]]);
    if (existing.rows.length) throw new Error('An identifier collision occurred. Please retry the import.');
  }
  const batchSize = Math.min(250, Math.floor(60000 / INSERT_COLUMNS.length));
  for (let offset = 0; offset < candidates.length; offset += batchSize) {
    const batch = candidates.slice(offset, offset + batchSize);
    const values = [];
    const groups = batch.map(({ row, formId, builtSample }) => {
      const serverValues = {
        company_identifier: companyIdentifier, form_id: formId, unit_id: unitId || null,
        business_process: businessProcess, financial_year: financialYear || null,
        due_date: fileDueDate || null, reminder_frequency: fileReminderFrequency || null,
        sample_required: builtSample.sampleRequired,
        sample_size: builtSample.sampleSize !== null ? String(builtSample.sampleSize) : null,
        active: false, template_id: activeTemplateId,
      };
      return '(' + INSERT_COLUMNS.map((col) => {
        values.push(Object.prototype.hasOwnProperty.call(serverValues, col) ? serverValues[col] : row[col] || null);
        return `$${values.length}`;
      }).join(', ') + ')';
    });
    try {
      await client.query(`INSERT INTO control_forms (${columnList}) VALUES ${groups.join(', ')}`, values);
    } catch (error) {
      if (error.code === '23505') {
        error.statusCode = 409;
        error.message = 'Duplicate Control Number already exists for this company. No RACMs were imported.';
      }
      throw error;
    }
    for (const candidate of batch) {
      if (coordinatorEmailId) {
        createdAuditEvents.push({ action: 'RACM created', userEmailId: coordinatorEmailId, formId: candidate.formId });
      }
    }
    insertedCount += batch.length;
  }
  if (activeTemplateId) {
    const fieldsByKey = new Map(extraFields.map((field) => [field.field_key, field.id]));
    const dynamicRecords = candidates.flatMap((candidate) => Object.entries(candidate.dynamicValues).map(([key, value]) => ({
      form_id: candidate.formId, template_field_id: fieldsByKey.get(key), value_text: value,
    })));
    if (dynamicRecords.length) {
      await client.query(`
        INSERT INTO racm_field_values (form_id, template_field_id, value_text)
        SELECT form_id, template_field_id, value_text
        FROM jsonb_to_recordset($1::jsonb) AS field(form_id text, template_field_id int, value_text text)
      `, [JSON.stringify(dynamicRecords)]);
    }
  }
  if (activeTemplateId && insertedCount) {
    await client.query('UPDATE racm_templates SET linked_racm_count = linked_racm_count + $2 WHERE id = $1', [activeTemplateId, insertedCount]);
  }

  return {
    insertedCount,
    skippedCount,
    duplicateCount,
    errorCount,
    duplicateControlNumberSamples,
    createdAuditEvents,
  };
}

module.exports = {
  applyControlFrequencyValueMapping,
  prepareBulkImportRows,
  transformExcelData,
  transformExcelDataWithColumnMapping,
  insertRacmRowsFromTransformedData,
  validateBulkImportControlFrequencies,
};
