// Simple column mapping for most columns (exact/simple matching)
const simpleColumnMapping = {
  'description of control': 'description_of_control',
  'process': 'process',
  'sub-process': 'sub_process',
  'whether fraud risks exist': 'whether_fraud_risks_exist',
  'control objective': 'control_objective',
  'gap description & resolution': 'gap_description_resolution',
  'relevant data elements of ipe': 'relevant_data_elements_of_ipe',
  'process owner': 'process_owner',
  'basis of sampling': 'basis_of_sampling',
  'checks performed': 'checks_performed',
  'effective or not effective': 'effective_or_not_effective',
  'remarks': 'remarks',
  'findings': 'findings'
};

const columnPatterns = [
  {
    keywords: ['risk', 'description', 'what could go wrong', 'misstatement', 'misrepresentation'],
    dbColumn: 'risk_description',
    priority: 1
  },
  {
    keywords: ['control', 'address', 'what could go wrong'],
    dbColumn: 'control_to_address',
    priority: 1
  },
  {
    keywords: ['management', 'review', 'control', 'mrc'],
    dbColumn: 'mrc_or_not',
    priority: 1
  },
  {
    keywords: ['information', 'produced', 'entity', 'ipe', 'source data', 'report logic', 'report parameters'],
    dbColumn: 'source_data_report_logic_report_parameters',
    priority: 1
  },
  {
    keywords: ['type', 'of', 'control', 'preventive', 'detective'],
    dbColumn: 'type_of_control',
    priority: 1
  },
  {
    keywords: ['nature', 'of', 'control', 'manual', 'automated'],
    dbColumn: 'nature_of_control',
    priority: 1
  },
  {
    keywords: ['risk', 'mitigation', 'method', 'insurance', 'hedging', 'sign off', 'approvals'],
    dbColumn: 'type_of_risk_mitigation_method',
    priority: 1
  },
  {
    keywords: ['reviewer', 'process', 'supervisor'],
    dbColumn: 'reviewer_process_supervisor',
    priority: 1
  },
  {
    keywords: ['control', 'frequency', 'recurring', 'weekly', 'monthly'],
    dbColumn: 'control_frequency',
    priority: 1
  },
  {
    keywords: ['documents', 'reviewed', 'dms', 'audit'],
    dbColumn: 'docs_to_review_for_dms_audit',
    priority: 1
  },
  {
    keywords: ['type', 'risk', 'associated', 'process', 'flow'],
    dbColumn: 'type_of_risk_associated',
    priority: 2
  },
  {
    keywords: ['financial', 'reporting', 'bs', 'pl'],
    dbColumn: 'financial_reporting',
    priority: 1
  }
];

// Function to normalize column names
function normalizeColumnName(excelColumnName) {
  if (!excelColumnName) return null;
  
  const trimmed = excelColumnName.trim();
  const normalized = trimmed.toLowerCase()
    .replace(/[\/\(\)&]/g, ' ') // Replace special chars with spaces
    .replace(/\s+/g, ' ') // Normalize multiple spaces
    .trim();
  
  // First, try simple exact/normalized matching
  if (simpleColumnMapping[normalized]) {
    return simpleColumnMapping[normalized];
  }
  
  // Also check with underscores
  const withUnderscores = normalized.replace(/\s+/g, '_');
  if (simpleColumnMapping[withUnderscores]) {
    return simpleColumnMapping[withUnderscores];
  }
  
  // For complex columns, try pattern matching
  let bestMatch = null;
  let bestScore = 0;
  
  for (const pattern of columnPatterns) {
    // Count how many keywords match
    let matchCount = 0;
    for (const keyword of pattern.keywords) {
      if (normalized.includes(keyword.toLowerCase())) {
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
    return bestMatch;
  }
  
  // Fallback: convert to snake_case
  return normalized.replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
}

module.exports = {
  normalizeColumnName
};

