import { BULK_IMPORT_AUTO, BULK_IMPORT_SKIP } from './racmBulkImportColumnMapping'

/**
 * Apply a saved mapping as an explicit choice for every current header.
 * Missing, skipped, or removed targets stay skipped; no keyword fallback.
 *
 * @returns {{
 *   overrides: Record<string, string>,
 *   appliedCount: number,
 *   skippedTargetCount: number,
 *   unmatchedHeaderCount: number,
 * }}
 */
export function softApplySavedColumnMapping({
  savedColumnMapping,
  headers,
  mappableSet,
}) {
  const mapping =
    savedColumnMapping && typeof savedColumnMapping === 'object' && !Array.isArray(savedColumnMapping)
      ? savedColumnMapping
      : {}
  const headerList = Array.isArray(headers) ? headers : []
  const overrides = {}
  let appliedCount = 0
  let skippedTargetCount = 0
  let unmatchedHeaderCount = 0
  const targetHeaders = new Map()
  const duplicateTargets = []

  for (const header of headerList) {
    overrides[header] = BULK_IMPORT_SKIP
    if (!Object.prototype.hasOwnProperty.call(mapping, header)) {
      unmatchedHeaderCount += 1
      continue
    }
    const target = mapping[header]
    if (target == null || target === '' || target === BULK_IMPORT_AUTO) {
      appliedCount += 1
      continue
    }
    if (target === BULK_IMPORT_SKIP) {
      overrides[header] = BULK_IMPORT_SKIP
      appliedCount += 1
      continue
    }
    if (mappableSet && mappableSet.has(target)) {
      if (targetHeaders.has(target)) {
        duplicateTargets.push({ target, headers: [targetHeaders.get(target), header] })
      } else {
        targetHeaders.set(target, header)
      }
      overrides[header] = target
      appliedCount += 1
      continue
    }
    skippedTargetCount += 1
  }

  return {
    overrides,
    duplicateTargets,
    appliedCount,
    skippedTargetCount,
    unmatchedHeaderCount,
  }
}

export function mergeValueMappings(...maps) {
  const out = {}
  maps.forEach((map) => {
    if (!map || typeof map !== 'object' || Array.isArray(map)) return
    Object.entries(map).forEach(([key, value]) => {
      const k = String(key || '').trim()
      const v = String(value || '').trim()
      if (!k || !v) return
      out[k] = v
    })
  })
  return out
}

/**
 * Keep only invalid frequency values not already covered by a saved mapping.
 */
export function filterUnmappedInvalidFrequencyValues(invalidValues, savedFrequencyMapping) {
  const saved = mergeValueMappings(savedFrequencyMapping)
  return (Array.isArray(invalidValues) ? invalidValues : []).filter((value) => {
    const key = String(value || '').trim()
    return key && !Object.prototype.hasOwnProperty.call(saved, key)
  })
}

/**
 * Keep assertion symbols that still need Yes/No mapping after applying a saved map.
 */
export function filterUnmappedAssertionValues(distinctValues, savedAssertionMapping) {
  const saved = mergeValueMappings(savedAssertionMapping)
  return (Array.isArray(distinctValues) ? distinctValues : []).filter((value) => {
    const key = String(value || '').trim()
    if (!key) return false
    if (key === 'Yes' || key === 'No') return false
    const mapped = saved[key]
    return mapped !== 'Yes' && mapped !== 'No'
  })
}
