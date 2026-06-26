import { RACM_BULK_IMPORT_MAPPABLE_FIELDS } from '../racmFormDetailFields'
import {
  detectExtraFieldKeyFromHeader,
  parseExtraFieldMappingValue,
  toExtraFieldMappingValue,
} from './racmTemplateKeywords'

export const BULK_IMPORT_AUTO = '__auto__'
export const BULK_IMPORT_SKIP = '__skip__'

function hasKeywordMatch(normalizedHeader, keyword) {
  const tokens = normalizedHeader.split(' ').filter(Boolean)
  const k = keyword.toLowerCase()
  if (k.length <= 2) return tokens.some((t) => t === k)
  return tokens.some((t) => t === k || t.startsWith(k))
}

function getHeaderWords(normalizedHeader) {
  return new Set(
    String(normalizedHeader || '')
      .split(' ')
      .map((word) => word.trim().toLowerCase())
      .filter(Boolean)
  )
}

export function detectDbColumnFromHeader(excelHeader, mappingConfig) {
  if (!excelHeader) return null
  if (!mappingConfig?.simpleColumnMapping || !Array.isArray(mappingConfig?.columnPatterns)) return null
  const { simpleColumnMapping, columnPatterns } = mappingConfig
  const normalized = String(excelHeader)
    .trim()
    .toLowerCase()
    .replace(/[/()&-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  const requiredFrequencyWords = ['frequency', 'control', 'of']
  if (requiredFrequencyWords.every((word) => hasKeywordMatch(normalized, word))) {
    return 'control_frequency'
  }

  if (simpleColumnMapping[normalized]) return simpleColumnMapping[normalized]

  const withUnderscores = normalized.replace(/\s+/g, '_')
  if (simpleColumnMapping[withUnderscores]) return simpleColumnMapping[withUnderscores]

  let bestMatch = null
  let bestScore = 0
  const headerWords = getHeaderWords(normalized)
  for (const pattern of columnPatterns) {
    const keywordSets = Array.isArray(pattern.keywordGroups) && pattern.keywordGroups.length > 0
      ? pattern.keywordGroups
      : [pattern.keywords || []]

    let patternBestScore = 0
    for (const keywords of keywordSets) {
      if (!Array.isArray(keywords) || keywords.length === 0) continue

      if (Array.isArray(pattern.keywordGroups) && pattern.keywordGroups.length > 0) {
        const hasAllGroupWords = keywords.every((keyword) => headerWords.has(String(keyword).toLowerCase()))
        if (!hasAllGroupWords) continue
        patternBestScore = Math.max(patternBestScore, pattern.priority || 1)
        continue
      }

      let matchCount = 0
      for (const keyword of keywords) {
        if (hasKeywordMatch(normalized, keyword)) matchCount++
      }
      if (matchCount > 0) {
        if (pattern.requireAllKeywords && matchCount !== keywords.length) continue
        const score = (matchCount / keywords.length) * pattern.priority
        if (score > patternBestScore) {
          patternBestScore = score
        }
      }
    }
    if (patternBestScore > bestScore) {
      bestScore = patternBestScore
      bestMatch = pattern.dbColumn
    }
  }
  if (bestMatch && bestScore >= 0.5) return bestMatch

  if (hasKeywordMatch(normalized, 'risk') && !hasKeywordMatch(normalized, 'heat')) {
    return 'risk_description'
  }

  return normalized.replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '') || null
}

export function collectBulkImportHeaders(rows) {
  const set = new Set()
  ;(rows || []).forEach((row) => {
    Object.keys(row || {}).forEach((key) => set.add(key))
  })
  return [...set]
}

function isMappableFieldValue(value, mappableSet) {
  if (!value) return false
  return mappableSet.has(value)
}

export function buildMappableFieldSet(templateExtraFields = []) {
  const set = new Set(RACM_BULK_IMPORT_MAPPABLE_FIELDS)
  templateExtraFields.forEach((field) => {
    set.add(toExtraFieldMappingValue(field.field_key))
  })
  return set
}

export function buildUniqueAutoDetectedByHeader(
  headers,
  mappingConfig,
  extraFields = [],
  mappableSet = buildMappableFieldSet(extraFields)
) {
  const usedFields = new Set()
  const out = {}
  headers.forEach((header) => {
    const extraDetected = detectExtraFieldKeyFromHeader(header, extraFields)
    if (extraDetected) {
      const mappingValue = toExtraFieldMappingValue(extraDetected)
      if (isMappableFieldValue(mappingValue, mappableSet) && !usedFields.has(mappingValue)) {
        out[header] = mappingValue
        usedFields.add(mappingValue)
        return
      }
    }

    const detected = detectDbColumnFromHeader(header, mappingConfig)
    const resolved = detected && mappableSet.has(detected) ? detected : null
    if (resolved && !usedFields.has(resolved)) {
      out[header] = resolved
      usedFields.add(resolved)
    } else {
      out[header] = null
    }
  })
  return out
}

export function getEffectiveMappedField(
  excelHeader,
  selections,
  autoDetectedByHeader,
  mappingConfig,
  mappableSet
) {
  const v = selections[excelHeader]
  if (v === BULK_IMPORT_SKIP) return null
  if (v && v !== BULK_IMPORT_AUTO) {
    return isMappableFieldValue(v, mappableSet) ? v : null
  }
  const detected = autoDetectedByHeader[excelHeader]
  if (detected && isMappableFieldValue(detected, mappableSet)) return detected
  const fallback = detectDbColumnFromHeader(excelHeader, mappingConfig)
  return fallback && mappableSet.has(fallback) ? fallback : null
}

export function buildColumnMapping(
  headers,
  selections,
  autoDetectedByHeader,
  mappingConfig,
  mappableSet
) {
  const out = {}
  for (const header of headers) {
    const selection = selections[header]
    if (selection === BULK_IMPORT_SKIP) {
      out[header] = null
      continue
    }
    if (selection && selection !== BULK_IMPORT_AUTO) {
      out[header] = selection
      continue
    }
    const resolved = getEffectiveMappedField(
      header,
      selections,
      autoDetectedByHeader,
      mappingConfig,
      mappableSet
    )
    if (resolved) {
      out[header] = resolved
    }
  }
  return out
}

export function buildAutomaticColumnMappingForRows(rows, mappingConfig, templateExtraFields = []) {
  const headers = collectBulkImportHeaders(rows)
  const mappableSet = buildMappableFieldSet(templateExtraFields)
  const autoDetectedByHeader = buildUniqueAutoDetectedByHeader(
    headers,
    mappingConfig,
    templateExtraFields,
    mappableSet
  )
  const selections = {}
  headers.forEach((header) => {
    selections[header] = autoDetectedByHeader[header] ? BULK_IMPORT_AUTO : BULK_IMPORT_SKIP
  })
  return buildColumnMapping(headers, selections, autoDetectedByHeader, mappingConfig, mappableSet)
}

export { parseExtraFieldMappingValue }
