import { parseExtraFieldMappingValue } from './racmTemplateKeywords'

function normalizeCellValue(value) {
  if (value === null || value === undefined) return ''
  return String(value).trim()
}

/**
 * Excel headers mapped to assertion template columns (section_key === 'assertions').
 * @param {Record<string, string|null|undefined>} columnMapping
 * @param {Array<{ field_key?: string, section_key?: string }>} templateExtraFields
 * @returns {string[]}
 */
export function getAssertionExcelHeaders(columnMapping, templateExtraFields = []) {
  const assertionFieldKeys = new Set(
    (Array.isArray(templateExtraFields) ? templateExtraFields : [])
      .filter((field) => String(field?.section_key || '').trim() === 'assertions')
      .map((field) => String(field.field_key || '').trim())
      .filter(Boolean)
  )

  if (assertionFieldKeys.size === 0 || !columnMapping || typeof columnMapping !== 'object') {
    return []
  }

  const headers = []
  for (const [excelHeader, mappedValue] of Object.entries(columnMapping)) {
    const extraFieldKey = parseExtraFieldMappingValue(mappedValue)
    if (extraFieldKey && assertionFieldKeys.has(extraFieldKey)) {
      headers.push(excelHeader)
    }
  }
  return headers
}

/**
 * Distinct non-empty values found in assertion columns across Excel rows.
 * @param {Array<Record<string, unknown>>} rows
 * @param {string[]} assertionHeaders
 * @returns {string[]}
 */
export function collectDistinctAssertionValues(rows, assertionHeaders = []) {
  if (!Array.isArray(rows) || assertionHeaders.length === 0) return []

  const values = new Set()
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue
    for (const header of assertionHeaders) {
      const text = normalizeCellValue(row[header])
      if (text) values.add(text)
    }
  }

  return [...values].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
}

/**
 * Rewrite assertion cell values using Yes/No letter mapping.
 * Unmapped values are left unchanged.
 * @param {Array<Record<string, unknown>>} rows
 * @param {string[]} assertionHeaders
 * @param {Record<string, string>} yesNoMapping - excel letter/value -> 'Yes' | 'No'
 * @returns {Array<Record<string, unknown>>}
 */
export function applyAssertionYesNoMapping(rows, assertionHeaders = [], yesNoMapping = {}) {
  if (!Array.isArray(rows) || assertionHeaders.length === 0) {
    return Array.isArray(rows) ? rows : []
  }

  const mapping = {}
  Object.entries(yesNoMapping || {}).forEach(([rawKey, rawValue]) => {
    const key = normalizeCellValue(rawKey)
    const value = normalizeCellValue(rawValue)
    if (!key) return
    if (value === 'Yes' || value === 'No') {
      mapping[key] = value
    }
  })

  if (Object.keys(mapping).length === 0) {
    return rows
  }

  return rows.map((row) => {
    if (!row || typeof row !== 'object') return row
    const next = { ...row }
    for (const header of assertionHeaders) {
      const current = normalizeCellValue(next[header])
      if (!current) continue
      if (Object.prototype.hasOwnProperty.call(mapping, current)) {
        next[header] = mapping[current]
      }
    }
    return next
  })
}

/**
 * @returns {{ needed: false } | { needed: true, assertionHeaders: string[], distinctValues: string[] }}
 */
export function getAssertionYesNoMappingPrompt(rows, columnMapping, templateExtraFields = []) {
  const assertionHeaders = getAssertionExcelHeaders(columnMapping, templateExtraFields)
  const distinctValues = collectDistinctAssertionValues(rows, assertionHeaders)
  if (assertionHeaders.length === 0 || distinctValues.length === 0) {
    return { needed: false }
  }
  return {
    needed: true,
    assertionHeaders,
    distinctValues,
  }
}
