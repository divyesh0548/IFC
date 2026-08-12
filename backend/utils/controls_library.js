const XLSX = require('xlsx');
const { normalizeColumnName } = require('./column_mapping');

const CONTROLS_LIBRARY_REQUIRED_HEADERS = [
  'Sub-Process',
  'Risk Description',
  'Risk Heat',
  'Control Objective',
  'Standard Control Description',
  'Control type (Manual/Automated)',
  'Control type (Financial/Operational)',
  'Nature of Control (Preventive/Detective)',
  'Process Activity and Walkthrough details',
  'Key Control',
  'Application name',
  'Control Evidence to be obtained',
  'Whether fraud risk exists? (Yes/No)',
  'Control Frequency',
];

const CONTROLS_LIBRARY_INSERT_REQUIRED_HEADERS = [
  'Sub-Process',
  'Risk Description',
  'Control Objective',
  'Standard Control Description',
  'Control type (Manual/Automated)',
  'Nature of Control (Preventive/Detective)',
  'Control Frequency',
];

const EXCEL_HEADER_TO_FIELD = {
  'sub process': 'subProcess',
  'risk description': 'riskDescription',
  'risk heat': 'riskHeat',
  'control objective': 'controlObjective',
  'standard control description': 'standardControlDescription',
  'control type manual automated': 'controlTypeMa',
  'control type financial operational': 'controlTypeFo',
  'nature of control preventive detective': 'natureOfControl',
  'process activity and walkthrough details': 'processWalkthrough',
  'key control': 'keyControl',
  'application name': 'applicationName',
  'control evidence to be obtained': 'auditEvidenceAccuracy',
  'whether fraud risk exists yes no': 'whetherFraudRisksExist',
  'whether fraud risk exists': 'whetherFraudRisksExist',
  'control frequency': 'controlFrequency',
};

const FIELD_TO_DB_COLUMN = {
  subProcess: 'sub_process',
  riskDescription: 'risk_description',
  riskHeat: 'risk_heat',
  controlObjective: 'control_objective',
  standardControlDescription: 'standard_control_description',
  controlTypeMa: 'control_type_ma',
  controlTypeFo: 'control_type_fo',
  natureOfControl: 'nature_of_control',
  processWalkthrough: 'process_walkthrough',
  keyControl: 'key_control',
  applicationName: 'application_name',
  auditEvidenceAccuracy: 'audit_evidence_accuracy',
  whetherFraudRisksExist: 'whether_fraud_risks_exist',
  controlFrequency: 'control_frequency',
};

const SEARCHABLE_DB_FIELDS = [
  'sub_process',
  'risk_description',
  'control_objective',
  'standard_control_description',
  'process_walkthrough',
  'application_name',
];

const DB_COLUMN_TO_PRISMA_FIELD = {
  sub_process: 'subProcess',
  risk_description: 'riskDescription',
  risk_heat: 'riskHeat',
  control_objective: 'controlObjective',
  standard_control_description: 'standardControlDescription',
  control_type_ma: 'controlTypeMa',
  control_type_fo: 'controlTypeFo',
  nature_of_control: 'natureOfControl',
  process_walkthrough: 'processWalkthrough',
  key_control: 'keyControl',
  application_name: 'applicationName',
  audit_evidence_accuracy: 'auditEvidenceAccuracy',
  whether_fraud_risks_exist: 'whetherFraudRisksExist',
  control_frequency: 'controlFrequency',
};

function normalizeHeaderLabel(header) {
  return String(header || '')
    .trim()
    .toLowerCase()
    .replace(/[\/\(\)&?]/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function mapExcelHeaderToField(header) {
  const normalized = normalizeHeaderLabel(header);
  if (!normalized) return null;

  if (EXCEL_HEADER_TO_FIELD[normalized]) {
    return EXCEL_HEADER_TO_FIELD[normalized];
  }

  const mappedDbColumn = normalizeColumnName(header);
  if (mappedDbColumn && DB_COLUMN_TO_PRISMA_FIELD[mappedDbColumn]) {
    return DB_COLUMN_TO_PRISMA_FIELD[mappedDbColumn];
  }

  return null;
}

function normalizeCellValue(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value).trim();
  return String(value).trim();
}

function findHeaderRowIndex(rows) {
  for (let i = 0; i < Math.min(rows.length, 20); i += 1) {
    const row = rows[i];
    if (!Array.isArray(row)) continue;
    const nonEmpty = row.filter((cell) => normalizeCellValue(cell) !== '');
    if (nonEmpty.length >= 4) {
      return i;
    }
  }
  return 0;
}

function buildHeaderFieldMap(headerRow) {
  const fieldByColumnIndex = {};
  const headerLabelsByField = {};

  headerRow.forEach((header, index) => {
    const field = mapExcelHeaderToField(header);
    if (!field) return;
    if (fieldByColumnIndex[index]) return;
    fieldByColumnIndex[index] = field;
    headerLabelsByField[field] = String(header || '').trim();
  });

  return { fieldByColumnIndex, headerLabelsByField };
}

function getMissingRequiredFields(headerLabelsByField) {
  return CONTROLS_LIBRARY_INSERT_REQUIRED_HEADERS
    .map((header) => ({
      header,
      field: mapExcelHeaderToField(header),
    }))
    .filter(({ field }) => field && !headerLabelsByField[field])
    .map(({ header }) => header);
}

function parseControlsLibrarySheetRows(sheet, sheetName) {
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
  if (!rows.length) {
    return { ok: false, message: 'Worksheet is empty', sheetName };
  }

  const headerRowIndex = findHeaderRowIndex(rows);
  const headerRow = rows[headerRowIndex] || [];
  const { fieldByColumnIndex, headerLabelsByField } = buildHeaderFieldMap(headerRow);
  const missingFields = getMissingRequiredFields(headerLabelsByField);

  if (missingFields.length > 0) {
    return {
      ok: false,
      message: `Missing required columns for controls library insertion: ${missingFields.join(', ')}`,
      missingFields,
      sheetName,
    };
  }

  const parsedRows = [];
  for (let rowIndex = headerRowIndex + 1; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex];
    if (!Array.isArray(row)) continue;

    const record = {};
    Object.entries(fieldByColumnIndex).forEach(([columnIndex, field]) => {
      record[field] = normalizeCellValue(row[Number(columnIndex)]);
    });

    const hasContent = Object.values(record).some((value) => String(value || '').trim() !== '');
    if (!hasContent) continue;

    parsedRows.push(record);
  }

  return {
    ok: true,
    rows: parsedRows,
    rowCount: parsedRows.length,
    sheetName,
  };
}

function listWorkbookSheetNames(buffer) {
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: false });
  return workbook.SheetNames || [];
}

function parseControlsLibraryWorkbook(buffer, selectedSheetNames = null) {
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: false });
  const allSheetNames = workbook.SheetNames || [];
  if (!allSheetNames.length) {
    return { ok: false, message: 'Excel file has no worksheets' };
  }

  const normalizedSelection = Array.isArray(selectedSheetNames)
    ? [...new Set(selectedSheetNames.map((name) => String(name || '').trim()).filter(Boolean))]
    : [];

  let sheetsToParse = normalizedSelection;
  if (!sheetsToParse.length) {
    if (allSheetNames.length === 1) {
      sheetsToParse = [allSheetNames[0]];
    } else {
      return {
        ok: false,
        message: 'Multiple worksheets found. Select at least one sheet to import.',
        sheetNames: allSheetNames,
        requiresSheetSelection: true,
      };
    }
  }

  const mergedRows = [];
  const sheetResults = [];

  for (const sheetName of sheetsToParse) {
    if (!allSheetNames.includes(sheetName)) {
      return {
        ok: false,
        message: `Worksheet not found: ${sheetName}`,
        sheetNames: allSheetNames,
      };
    }

    const sheetResult = parseControlsLibrarySheetRows(workbook.Sheets[sheetName], sheetName);
    if (!sheetResult.ok) {
      return {
        ok: false,
        message: `Sheet "${sheetName}": ${sheetResult.message}`,
        missingFields: sheetResult.missingFields,
        sheetName,
        sheetNames: allSheetNames,
      };
    }

    mergedRows.push(...sheetResult.rows);
    sheetResults.push({
      sheet_name: sheetName,
      row_count: sheetResult.rowCount,
    });
  }

  if (!mergedRows.length) {
    return {
      ok: false,
      message: 'No control rows found in the selected worksheets',
      sheetNames: allSheetNames,
    };
  }

  return {
    ok: true,
    rows: mergedRows,
    rowCount: mergedRows.length,
    sheetNames: sheetsToParse,
    sheetResults,
  };
}

function buildControlsLibraryTemplateBuffer() {
  const worksheet = XLSX.utils.aoa_to_sheet([CONTROLS_LIBRARY_REQUIRED_HEADERS]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Controls Library');
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
}

function normalizeComparableText(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function splitSearchWords(searchText) {
  return String(searchText || '')
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
}

function getTextTokens(value) {
  return normalizeComparableText(value)
    .split(/\s+/)
    .filter(Boolean);
}

function matchesKeywordSearch(value, searchWords) {
  if (!searchWords.length) return true;

  const normalized = normalizeComparableText(value);
  if (!normalized) return false;

  const tokens = getTextTokens(value);

  return searchWords.every((word) => {
    if (normalized.includes(word)) return true;
    return tokens.some((token) => token.includes(word) || word.includes(token));
  });
}

function scoreKeywordSearch(value, searchWords) {
  if (!searchWords.length) return 0;

  const normalized = normalizeComparableText(value);
  const tokens = getTextTokens(value);
  let score = 0;

  searchWords.forEach((word) => {
    if (normalized === word) score += 100;
    else if (normalized.startsWith(word)) score += 50;
    else if (normalized.includes(word)) score += 25;
    else if (tokens.some((token) => token.startsWith(word))) score += 20;
    else if (tokens.some((token) => token.includes(word))) score += 10;
  });

  return score;
}

function buildPrismaCreateRows(businessProcess, parsedRows) {
  return parsedRows.map((row) => ({
    businessProcess: String(businessProcess || '').trim(),
    subProcess: row.subProcess || null,
    riskDescription: row.riskDescription || null,
    riskHeat: row.riskHeat || null,
    controlObjective: row.controlObjective || null,
    standardControlDescription: row.standardControlDescription || null,
    controlTypeMa: row.controlTypeMa || null,
    controlTypeFo: row.controlTypeFo || null,
    natureOfControl: row.natureOfControl || null,
    processWalkthrough: row.processWalkthrough || null,
    keyControl: row.keyControl || null,
    applicationName: row.applicationName || null,
    auditEvidenceAccuracy: row.auditEvidenceAccuracy || null,
    whetherFraudRisksExist: row.whetherFraudRisksExist || null,
    controlFrequency: row.controlFrequency || null,
  }));
}

function buildSuggestionsFromRows(rows, {
  field,
  searchText = '',
  subProcess = '',
  prioritizeSubProcess = false,
  librarySubProcessId = null,
}) {
  const dbField = String(field || '').trim();
  const prismaField = DB_COLUMN_TO_PRISMA_FIELD[dbField];
  if (!prismaField || !SEARCHABLE_DB_FIELDS.includes(dbField)) {
    return { ok: false, message: 'Invalid suggestion field' };
  }

  const searchWords = splitSearchWords(searchText);
  const subProcessNorm = normalizeComparableText(subProcess);
  let anchorSubProcess = subProcessNorm;

  if (librarySubProcessId) {
    const anchorRow = rows.find((row) => row.id === Number(librarySubProcessId));
    if (anchorRow?.subProcess) {
      anchorSubProcess = normalizeComparableText(anchorRow.subProcess);
    }
  }

  const valueMap = new Map();

  rows.forEach((row) => {
    const value = normalizeCellValue(row[prismaField]);
    if (!value) return;

    const rowSubProcessNorm = normalizeComparableText(row.subProcess);
    const matchedSubProcess = prioritizeSubProcess
      && anchorSubProcess
      && rowSubProcessNorm === anchorSubProcess;

    if (!matchesKeywordSearch(value, searchWords)) return;

    const key = normalizeComparableText(value);
    if (!valueMap.has(key)) {
      valueMap.set(key, {
        value,
        matched: matchedSubProcess,
        libraryIds: [],
        score: scoreKeywordSearch(value, searchWords),
      });
    }

    const entry = valueMap.get(key);
    if (matchedSubProcess) entry.matched = true;
    entry.score = Math.max(entry.score, scoreKeywordSearch(value, searchWords));
    if (row.id) entry.libraryIds.push(row.id);
  });

  const suggestions = [...valueMap.values()]
    .sort((a, b) => {
      if (a.matched !== b.matched) return a.matched ? -1 : 1;
      if (a.score !== b.score) return b.score - a.score;
      return a.value.localeCompare(b.value, undefined, { sensitivity: 'base' });
    })
    .map((entry) => ({
      value: entry.value,
      matched: entry.matched,
      libraryIds: entry.libraryIds,
    }));

  return { ok: true, suggestions };
}

module.exports = {
  CONTROLS_LIBRARY_REQUIRED_HEADERS,
  CONTROLS_LIBRARY_INSERT_REQUIRED_HEADERS,
  SEARCHABLE_DB_FIELDS,
  FIELD_TO_DB_COLUMN,
  DB_COLUMN_TO_PRISMA_FIELD,
  listWorkbookSheetNames,
  parseControlsLibraryWorkbook,
  buildControlsLibraryTemplateBuffer,
  buildPrismaCreateRows,
  buildSuggestionsFromRows,
  normalizeComparableText,
};
