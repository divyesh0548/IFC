/**
 * Client-side RACM Excel parsing — mirrors backend/scripts/process_excel_files.js
 * header detection so rows match what the server expects for bulk import.
 */
import * as XLSX from 'xlsx'

const headerLooseMatchKeywords = [
  'control',
  'account',
  'process',
  'risk',
  'heat',
  'objective',
  'standard',
  'description',
  'fraud',
  'reference',
  'frequency',
  'nature',
  'performer',
  'owner',
  'key',
  'application',
  'whether',
  'walkthrough',
  'financial',
  'operational',
  'manual',
  'automated',
  'completeness',
  'existence',
  'occurrence',
  'rights',
  'obligation',
  'valuation',
  'allocation',
  'presentation',
  'disclosure',
]

const MIN_HEADER_KEYWORD_MATCHES = 10

function normalizeText(text) {
  if (!text) return ''
  return String(text)
    .toLowerCase()
    .trim()
    .replace(/[/()&-]/g, ' ')
    .replace(/\s+/g, ' ')
}

function getHeaderKeywordMatchCount(cellValue) {
  if (!cellValue) return 0

  const tokens = new Set(
    String(cellValue)
      .split(' ')
      .map((token) => token.trim())
      .filter(Boolean)
  )

  let matchCount = 0
  for (const keyword of headerLooseMatchKeywords) {
    const normalizedKeyword = normalizeText(keyword)
    if (!normalizedKeyword) continue

    const keywordTokens = normalizedKeyword.split(' ').filter(Boolean)
    const hasLooseMatch = keywordTokens.every((keywordToken) =>
      [...tokens].some((token) => token === keywordToken || token.startsWith(keywordToken))
    )

    if (hasLooseMatch) {
      matchCount++
    }
  }

  return matchCount
}

function findHeaderRow(worksheet) {
  const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1')
  const maxRow = range.e.r
  const maxCol = range.e.c

  let bestHeaderRow = -1
  let bestMatchCount = 0
  let headerStartCol = -1
  let headerEndCol = -1

  const searchLimit = Math.min(50, maxRow + 1)

  for (let row = 0; row < searchLimit; row++) {
    let matchCount = 0
    let firstNonEmptyCol = -1
    let lastNonEmptyCol = -1

    for (let col = 0; col <= maxCol; col++) {
      const cellAddress = XLSX.utils.encode_cell({ r: row, c: col })
      const cell = worksheet[cellAddress]

      if (cell && cell.v) {
        const cellValue = normalizeText(cell.v)
        if (firstNonEmptyCol === -1) firstNonEmptyCol = col
        lastNonEmptyCol = col

        matchCount += getHeaderKeywordMatchCount(cellValue)
      }
    }

    if (matchCount > bestMatchCount && matchCount >= MIN_HEADER_KEYWORD_MATCHES) {
      bestMatchCount = matchCount
      bestHeaderRow = row
      headerStartCol = firstNonEmptyCol
      headerEndCol = lastNonEmptyCol
    }
  }

  if (bestHeaderRow === -1) {
    throw new Error(
      'Could not find header row. Make sure the Excel file contains recognizable column headers.'
    )
  }

  return {
    row: bestHeaderRow,
    startCol: headerStartCol,
    endCol: headerEndCol,
  }
}

function findManualHeaderRow(worksheet, headerRowNumber) {
  const excelRowNumber = Number(headerRowNumber)
  if (!Number.isInteger(excelRowNumber) || excelRowNumber < 1) {
    throw new Error('Header row number must be 1 or greater.')
  }

  const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1')
  const row = excelRowNumber - 1
  if (row > range.e.r) {
    throw new Error(`Header row ${excelRowNumber} is outside the selected sheet range.`)
  }

  let firstNonEmptyCol = -1
  let lastNonEmptyCol = -1

  for (let col = range.s.c; col <= range.e.c; col++) {
    const cellAddress = XLSX.utils.encode_cell({ r: row, c: col })
    const cell = worksheet[cellAddress]
    if (cell && cell.v !== undefined && cell.v !== null && String(cell.v).trim() !== '') {
      if (firstNonEmptyCol === -1) firstNonEmptyCol = col
      lastNonEmptyCol = col
    }
  }

  if (firstNonEmptyCol === -1) {
    throw new Error(`Header row ${excelRowNumber} does not contain any headers.`)
  }

  return {
    row,
    startCol: firstNonEmptyCol,
    endCol: lastNonEmptyCol,
  }
}

function extractHeaders(worksheet, headerLocation) {
  const headers = []
  const headerRow = headerLocation.row

  for (let col = headerLocation.startCol; col <= headerLocation.endCol; col++) {
    const cellAddress = XLSX.utils.encode_cell({ r: headerRow, c: col })
    const cell = worksheet[cellAddress]
    const headerValue = cell && cell.v ? String(cell.v).trim() : `Column_${col}`
    headers.push({ colIndex: col, name: headerValue })
  }

  return headers
}

function extractDataRows(worksheet, headers, headerLocation) {
  const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1')
  const maxRow = range.e.r
  const dataStartRow = headerLocation.row + 1
  const dataRows = []

  for (let row = dataStartRow; row <= maxRow; row++) {
    const rowData = {}
    let hasData = false

    headers.forEach((header) => {
      const cellAddress = XLSX.utils.encode_cell({ r: row, c: header.colIndex })
      const cell = worksheet[cellAddress]
      const value =
        cell && cell.v !== undefined && cell.v !== null && cell.v !== ''
          ? String(cell.v).trim()
          : null

      if (value !== null) hasData = true
      rowData[header.name] = value
    })

    if (hasData) dataRows.push(rowData)
  }

  return dataRows
}

function getMeaningfulCellValues(row) {
  return Object.values(row || {})
    .map((value) => {
      if (value === null || value === undefined) return ''
      return String(value).replace(/\u00a0/g, ' ').trim()
    })
    .filter(Boolean)
}

function isEffectivelyEmptyTrailingRow(row, totalColumns) {
  const meaningfulValues = getMeaningfulCellValues(row)
  const meaningfulCount = meaningfulValues.length

  if (meaningfulCount === 0) return true

  // Be conservative: only treat a trailing row as empty-ish when it has
  // negligible content compared to the expected column width.
  const joinedLength = meaningfulValues.join(' ').length
  if (meaningfulCount <= 2 && totalColumns >= 10 && joinedLength <= 12) {
    return true
  }

  return false
}

function trimTrailingEmptyRows(rows) {
  const nextRows = Array.isArray(rows) ? [...rows] : []
  const totalColumns = nextRows[0] ? Object.keys(nextRows[0]).length : 0

  while (nextRows.length > 0) {
    const lastRow = nextRows[nextRows.length - 1]
    if (!isEffectivelyEmptyTrailingRow(lastRow, totalColumns)) {
      break
    }
    nextRows.pop()
  }

  return nextRows
}

function parseSheet(worksheet, sheetName, options = {}) {
  if (!worksheet['!ref']) {
    return []
  }

  const headerLocation = options.headerRowNumber
    ? findManualHeaderRow(worksheet, options.headerRowNumber)
    : findHeaderRow(worksheet)
  const headers = extractHeaders(worksheet, headerLocation)
  const dataRows = trimTrailingEmptyRows(extractDataRows(worksheet, headers, headerLocation))

  if (dataRows.length === 0) {
    return []
  }

  return dataRows
}

/**
 * @param {ArrayBuffer} arrayBuffer — from File.arrayBuffer()
 * @returns {Array<Record<string, string|null>>} Raw row objects keyed by Excel header labels
 */
export function parseRacmExcelFromArrayBuffer(arrayBuffer, options = {}) {
  try {
    const workbook = XLSX.read(arrayBuffer, { type: 'array' })
    const sheetNames = workbook.SheetNames

    if (!sheetNames || sheetNames.length === 0) {
      throw new Error('Excel file has no sheets')
    }

    const allDataRows = []

    for (let i = 0; i < sheetNames.length; i++) {
      const sheetName = sheetNames[i]
      const worksheet = workbook.Sheets[sheetName]
      try {
        const sheetData = parseSheet(worksheet, sheetName, options)
        allDataRows.push(...sheetData)
      } catch {
        continue
      }
    }

    if (allDataRows.length === 0) {
      throw new Error('No data rows found in any sheet')
    }

    return allDataRows
  } catch (error) {
    throw new Error(error.message || 'Error parsing Excel file')
  }
}
