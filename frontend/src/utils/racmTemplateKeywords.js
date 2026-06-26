export function deriveKeywordsFromLabel(label) {
  return String(label || '')
    .trim()
    .split(/\s+/)
    .map((word) => word.replace(/[^a-zA-Z0-9]/g, ''))
    .filter(Boolean)
}

/** Lowercase alphanumeric only — for duplicate column label checks. */
export function normalizeColumnLabelForComparison(label) {
  return String(label || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

export function findDuplicateColumnLabel(
  label,
  { extraFields = [], fixedFields = [], excludeClientId = null } = {}
) {
  const normalized = normalizeColumnLabelForComparison(label)
  if (!normalized) return null

  for (const field of fixedFields) {
    const fixedLabel = String(field?.label || '').trim()
    if (fixedLabel && normalizeColumnLabelForComparison(fixedLabel) === normalized) {
      return fixedLabel
    }
  }

  for (const field of extraFields) {
    if (excludeClientId && field.clientId === excludeClientId) continue
    const fieldLabel = String(field?.label || '').trim()
    if (!fieldLabel) continue
    if (normalizeColumnLabelForComparison(fieldLabel) === normalized) {
      return fieldLabel
    }
  }

  return null
}

export function normalizeKeywordList(keywords) {
  if (!Array.isArray(keywords)) return []
  const seen = new Set()
  const normalized = []
  for (const item of keywords) {
    const value = String(item || '').replace(/[^a-zA-Z0-9]/g, '').trim()
    if (!value) continue
    const key = value.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    normalized.push(value)
  }
  return normalized
}

export function resolveExtraFieldKeywords(field) {
  const explicit = normalizeKeywordList(field?.excel_keywords)
  if (explicit.length > 0) return explicit
  return deriveKeywordsFromLabel(field?.label)
}

function hasKeywordMatch(normalizedHeader, keyword) {
  const tokens = normalizedHeader.split(' ').filter(Boolean)
  const keywordLower = String(keyword || '').toLowerCase()
  if (!keywordLower) return false
  if (keywordLower.length <= 2) {
    return tokens.some((token) => token === keywordLower)
  }
  return tokens.some((token) => token === keywordLower || token.startsWith(keywordLower))
}

export function normalizeExcelHeader(header) {
  return String(header || '')
    .trim()
    .toLowerCase()
    .replace(/[/()&-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function detectExtraFieldKeyFromHeader(header, extraFields) {
  const normalized = normalizeExcelHeader(header)
  if (!normalized || !Array.isArray(extraFields) || extraFields.length === 0) return null

  let bestMatch = null
  let bestScore = 0

  for (const field of extraFields) {
    const keywords = resolveExtraFieldKeywords(field)
    if (keywords.length === 0) continue

    const allMatch = keywords.every((keyword) => hasKeywordMatch(normalized, keyword))
    if (!allMatch) continue

    const score = keywords.length
    if (score > bestScore) {
      bestScore = score
      bestMatch = field.field_key
    }
  }

  return bestMatch
}

export const EXTRA_FIELD_MAPPING_PREFIX = 'extra:'

export function toExtraFieldMappingValue(fieldKey) {
  return `${EXTRA_FIELD_MAPPING_PREFIX}${fieldKey}`
}

export function parseExtraFieldMappingValue(value) {
  const raw = String(value || '')
  if (!raw.startsWith(EXTRA_FIELD_MAPPING_PREFIX)) return null
  const fieldKey = raw.slice(EXTRA_FIELD_MAPPING_PREFIX.length).trim()
  return fieldKey || null
}

export function isExtraFieldMappingValue(value) {
  return parseExtraFieldMappingValue(value) !== null
}
