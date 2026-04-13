/**
 * Client-side RACM Excel parsing — mirrors backend/scripts/process_excel_files.js
 * header detection so rows match what the server expects for bulk import.
 */
import * as XLSX from 'xlsx'

const headerKeywords = [
  'control number',
  'sub process',
  'risk',
  'risk heat',
  'control objective',
  'standard control description',
  'ipe reference',
  'control frequency',
  'nature of control',
  'control performer',
  'control owner',
]

function normalizeText(text) {
  if (!text) return ''
  return String(text)
    .toLowerCase()
    .trim()
    .replace(/[/()&-]/g, ' ')
    .replace(/\s+/g, ' ')
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

        for (const keyword of headerKeywords) {
          if (cellValue.includes(keyword) || keyword.includes(cellValue)) {
            matchCount++
            break
          }
        }
      }
    }

    if (matchCount > bestMatchCount && matchCount >= 4) {
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

function parseSheet(worksheet, sheetName) {
  if (!worksheet['!ref']) {
    return []
  }

  const headerLocation = findHeaderRow(worksheet)
  const headers = extractHeaders(worksheet, headerLocation)
  const dataRows = extractDataRows(worksheet, headers, headerLocation)

  if (dataRows.length === 0) {
    return []
  }

  return dataRows
}

/**
 * @param {ArrayBuffer} arrayBuffer — from File.arrayBuffer()
 * @returns {Array<Record<string, string|null>>} Raw row objects keyed by Excel header labels
 */
export function parseRacmExcelFromArrayBuffer(arrayBuffer) {
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
        const sheetData = parseSheet(worksheet, sheetName)
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
