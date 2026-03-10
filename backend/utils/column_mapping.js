// Simple column mapping for most columns (exact/simple matching)
const simpleColumnMapping = {
  'control number': 'control_number',
  'sub process': 'sub_process',
  'sub-process': 'sub_process',
  'risk': 'risk_description',
  'risk heat': 'risk_heat',
  'whether fraud risk': 'whether_fraud_risks_exist',
  'whether fraud risks': 'whether_fraud_risks_exist',
  'whether fraud risks exist': 'whether_fraud_risks_exist',
  'completeness': 'completeness',
  'existence occurrence': 'existence_occurrence',
  'valuation allocation': 'valuation_and_allocation',
  'control objective': 'control_objective',
  'ipe reference': 'ipe_reference',
  'application name': 'application_name',
  'control performer': 'control_performer',
  'process owner': 'process_owner',
  'control owner': 'control_owner',
};

// Columns that should never be imported from Excel into control_forms
const ignoredControlFormImportColumns = new Set([
  'control_design_procs',
  'control_design_conclusion',
  'design_deficiency_desc',
]);

function isIgnoredControlFormImportColumn(dbColumn) {
  return ignoredControlFormImportColumns.has(dbColumn);
}

function hasKeywordMatch(normalizedHeader, keyword) {
  const tokens = normalizedHeader.split(' ').filter(Boolean);
  const keywordLower = keyword.toLowerCase();
  if (keywordLower.length <= 2) {
    return tokens.some((token) => token === keywordLower);
  }
  return tokens.some((token) => token === keywordLower || token.startsWith(keywordLower));
}

const columnPatterns = [
  {
    keywords: ['account', 'balance', 'disclosure'],
    dbColumn: 'account_balance_disclosure',
    priority: 1
  },
  {
    keywords: ['business', 'cycle', 'process'],
    dbColumn: 'business_process',
    priority: 1
  },
  {
    keywords: ['risk','heat'],
    dbColumn: 'risk_heat',
    priority: 2
  },
  {
    keywords: ['rights', 'obligations'],
    dbColumn: 'rights_and_obligation',
    priority: 1
  },
  {
    keywords: ['presentation', 'disclosure'],
    dbColumn: 'presentation_and_disclosure',
    priority: 1
  },
  {
    keywords: ['standard', 'control', 'description'],
    dbColumn: 'standard_control_description',
    priority: 1
  },
  {
    keywords: ['process', 'activity', 'walkthrough', 'details'],
    dbColumn: 'process_walkthrough',
    priority: 1
  },
  {
    keywords: ['type', 'operational', 'financial'],
    dbColumn: 'control_type_fo',
    priority: 1
  },
  {
    keywords: ['rely', 'information', 'produced', 'entity'],
    dbColumn: 'control_relies_on_ipe',
    priority: 1
  },
  {
    keywords: ['audit', 'evidence', 'accuracy', 'completeness'],
    dbColumn: 'audit_evidence_accuracy',
    priority: 1
  },
  {
    keywords: ['nature', 'preventive', 'detective'],
    dbColumn: 'nature_of_control',
    priority: 1
  },
  {
    keywords: ['type', 'manual', 'automated'],
    dbColumn: 'control_type_ma',
    priority: 1
  },
  {
    keywords: ['key', 'control', 'yes', 'no'],
    dbColumn: 'key_control',
    priority: 1
  },
  {
    keywords: ['fraud', 'risk', 'whether'],
    dbColumn: 'whether_fraud_risks_exist',
    priority: 1
  }
]


// Function to normalize column names
function normalizeColumnName(excelColumnName) {
  if (!excelColumnName) return null;
  
  const trimmed = excelColumnName.trim();
  const normalized = trimmed.toLowerCase()
    .replace(/[\/\(\)&-]/g, ' ') // Replace special chars with spaces
    .replace(/\s+/g, ' ') // Normalize multiple spaces
    .trim();

  // Strict detection for control_frequency:
  // map only when ALL 3 words are present in the header.
  const requiredFrequencyWords = ['frequency', 'control', 'of'];
  const hasAllFrequencyWords = requiredFrequencyWords.every((word) => hasKeywordMatch(normalized, word));
  if (hasAllFrequencyWords) {
    return 'control_frequency';
  }
  
  // First, try simple exact/normalized matching
  if (simpleColumnMapping[normalized]) {
    const mappedColumn = simpleColumnMapping[normalized];
    return isIgnoredControlFormImportColumn(mappedColumn) ? null : mappedColumn;
  }
  
  // Also check with underscores
  const withUnderscores = normalized.replace(/\s+/g, '_');
  if (simpleColumnMapping[withUnderscores]) {
    const mappedColumn = simpleColumnMapping[withUnderscores];
    return isIgnoredControlFormImportColumn(mappedColumn) ? null : mappedColumn;
  }
  
  // For complex columns, try pattern matching
  let bestMatch = null;
  let bestScore = 0;
  
  for (const pattern of columnPatterns) {
    // Count how many keywords match
    let matchCount = 0;
    for (const keyword of pattern.keywords) {
      if (hasKeywordMatch(normalized, keyword)) {
        matchCount++;
      }
    }
    
    // Calculate score: match count / total keywords * priority
    if (matchCount > 0) {
      const score = (matchCount / pattern.keywords.length) * pattern.priority;
      if (score > bestScore) {
        bestScore = score;
        bestMatch = pattern.dbColumn;
      }
    }
  }
  
  // If we found a good match (at least 50% of keywords), return it
  if (bestMatch && bestScore >= 0.5) {
    return isIgnoredControlFormImportColumn(bestMatch) ? null : bestMatch;
  }
  
  // Fallback: convert to snake_case
  const fallbackColumn = normalized.replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
  return isIgnoredControlFormImportColumn(fallbackColumn) ? null : fallbackColumn;
}

module.exports = {
  normalizeColumnName
};

