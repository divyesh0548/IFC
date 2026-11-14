import { test } from 'node:test'
import assert from 'node:assert/strict'
import XLSX from 'xlsx'
import { parseRacmExcelFromArrayBuffer } from '../../frontend/src/utils/racmExcelParse.js'

function parse(headers, values) {
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([headers, ...values]), 'RCM')
  return parseRacmExcelFromArrayBuffer(XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }), {
    sheetName: 'RCM', headerRowNumber: 1,
  })
}

test('headers differing only by trailing space block parsing and identify both columns', () => {
  assert.throws(() => parse(['Control No ', 'Risk Description', 'Control No'], [
    ['C.4.2', 'First risk', '-'], ['C.5.2', 'Second risk', '-'],
  ]), /Duplicate column headers in Excel row 1: "Control No" \(columns A, C\)/)
})

test('identical headers block parsing instead of being renamed', () => {
  assert.throws(() => parse(['Control No', 'Control No'], [['FIRST', 'SECOND']]),
    /Rename or remove the duplicate columns/)
})

test('warning lists every duplicated header and its columns', () => {
  assert.throws(() => parse(['Control No', 'Risk', 'Control No ', 'Risk'], [['A', 'B', 'C', 'D']]),
    /"Control No" \(columns A, C\); "Risk" \(columns B, D\)/)
})

test('unique header names remain unchanged', () => {
  const rows = parse(['Control No ', 'Risk Description'], [['C.1', 'Risk']])
  assert.deepEqual(Object.keys(rows[0]), ['Control No', 'Risk Description'])
})
