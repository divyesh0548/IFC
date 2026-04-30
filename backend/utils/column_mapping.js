// Simple column mapping for most columns (exact/simple matching)
const simpleColumnMapping = {
  'control number': 'control_number',
  'control name': 'standard_control_description',
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
  'control owner': 'control_owner',
};

// Columns that should never be imported from Excel into control_forms (cells / header mapping).
const ignoredControlFormImportColumns = new Set([
  'control_design_procs',
  'control_design_conclusion',
  'design_deficiency_desc',
  'doc_uploaded_by_user',
  'active',
  'status',
  'reason_by_approver',
  'created_at',
  'company_identifier',
  'form_id',
  'remarks_by_user',
  'sample_doc',
  'sample_required',
  'sample_size',
  'due_date',
  'reminder_frequency',
  'reminder_datetime',
  'approval_status_change_timestamp',
  'financial_year',
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

function getHeaderWords(normalizedHeader) {
  return new Set(
    String(normalizedHeader || '')
      .split(' ')
      .map((word) => word.trim().toLowerCase())
      .filter(Boolean)
  );
}

const columnPatterns = [
  {
    keywords: ['other', 'affected'],
    dbColumn: 'sub_process',
    priority: 1
  },
  {
    keywords: ['account', 'balance', 'disclosure'],
    dbColumn: 'area',
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
    priority: 2,
    requireAllKeywords: true
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
    priority: 1,
    // Prevent partial matches like "Control Description" from incorrectly mapping here.
    // Standard Control Description should map only when all keywords are present.
    requireAllKeywords: true
  },
  {
    keywords: ['walkthrough'],
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
    keywords: ['ipe'],
    dbColumn: 'ipe_reference',
    priority: 1
  },
  {
    keywords: ['frequency'],
    dbColumn: 'control_frequency',
    priority: 1
  },
  {
    keywords: ['application'],
    dbColumn: 'application_name',
    priority: 1
  },
  {
    keywords: ['control', 'owner'],
    dbColumn: 'control_owner',
    priority: 1,
    requireAllKeywords: true
  },
  {
    keywords: ['fraud', 'risk', 'whether'],
    dbColumn: 'whether_fraud_risks_exist',
    priority: 1
  }
]

function getColumnMappingConfig() {
  return {
    simpleColumnMapping: { ...simpleColumnMapping },
    columnPatterns: columnPatterns.map((pattern) => ({
      ...pattern,
      keywords: Array.isArray(pattern.keywords) ? [...pattern.keywords] : undefined,
      keywordGroups: Array.isArray(pattern.keywordGroups)
        ? pattern.keywordGroups.map((group) => (Array.isArray(group) ? [...group] : group))
        : undefined,
    })),
  };
}


// Function to normalize column names
function normalizeColumnName(excelColumnName) {
  if (!excelColumnName) return null;
  
  const trimmed = excelColumnName.trim();
  const normalized = trimmed.toLowerCase()
    .replace(/[\/\(\)&-]/g, ' ') // Replace special chars with spaces
    .replace(/\s+/g, ' ') // Normalize multiple spaces
    .trim();
  
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
  const headerWords = getHeaderWords(normalized);
  
  for (const pattern of columnPatterns) {
    const keywordSets = Array.isArray(pattern.keywordGroups) && pattern.keywordGroups.length > 0
      ? pattern.keywordGroups
      : [pattern.keywords || []]

    let patternBestScore = 0

    for (const keywords of keywordSets) {
      if (!Array.isArray(keywords) || keywords.length === 0) continue

      if (Array.isArray(pattern.keywordGroups) && pattern.keywordGroups.length > 0) {
        // For keyword groups, map only when all listed words exist individually in the header.
        const hasAllGroupWords = keywords.every((keyword) => headerWords.has(String(keyword).toLowerCase()))
        if (!hasAllGroupWords) continue
        patternBestScore = Math.max(patternBestScore, pattern.priority || 1)
        continue
      }

    // Count how many keywords match
      let matchCount = 0;
      for (const keyword of keywords) {
        if (hasKeywordMatch(normalized, keyword)) {
          matchCount++;
        }
      }

      // Calculate score: match count / total keywords * priority
      if (matchCount > 0) {
        if (pattern.requireAllKeywords && matchCount !== keywords.length) {
          continue
        }
        const score = (matchCount / keywords.length) * pattern.priority;
        if (score > patternBestScore) {
          patternBestScore = score;
        }
      }
    }

    if (patternBestScore > bestScore) {
      bestScore = patternBestScore
      bestMatch = pattern.dbColumn
    }
  }
  
  // If we found a good match (at least 50% of keywords), return it
  if (bestMatch && bestScore >= 0.5) {
    return isIgnoredControlFormImportColumn(bestMatch) ? null : bestMatch;
  }

  if (hasKeywordMatch(normalized, 'risk') && !hasKeywordMatch(normalized, 'heat')) {
    return 'risk_description';
  }
  
  // Fallback: convert to snake_case
  const fallbackColumn = normalized.replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
  return isIgnoredControlFormImportColumn(fallbackColumn) ? null : fallbackColumn;
}

module.exports = {
  normalizeColumnName,
  getColumnMappingConfig,
};

