const GST_CODE_POINTS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'

// Current GST state and union territory codes. 25 and 28 are not issued.
const GST_STATE_CODES = new Set([
  '01', '02', '03', '04', '05', '06', '07', '08', '09',
  '10', '11', '12', '13', '14', '15', '16', '17', '18', '19',
  '20', '21', '22', '23', '24', '26', '27',
  '29', '30', '31', '32', '33', '34', '35', '36', '37', '38',
])

const PAN_IN_GSTIN = /^[A-Z]{5}[0-9]{4}[A-Z]$/

export function normalizeGstin(value) {
  return String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 15)
}

function gstinChecksumCharacter(first14) {
  let factor = 2
  let sum = 0
  for (let index = first14.length - 1; index >= 0; index -= 1) {
    const codePoint = GST_CODE_POINTS.indexOf(first14[index])
    let addend = factor * codePoint
    addend = Math.floor(addend / 36) + (addend % 36)
    sum += addend
    factor = factor === 2 ? 1 : 2
  }
  return GST_CODE_POINTS[(36 - (sum % 36)) % 36]
}

export function getGstValidationError(value) {
  const gstin = normalizeGstin(value)
  if (!gstin) return ''
  if (gstin.length !== 15) return 'GSTIN must be exactly 15 characters'
  if (!GST_STATE_CODES.has(gstin.slice(0, 2))) {
    return 'GSTIN state code is not a valid GST state or union territory code'
  }
  if (!PAN_IN_GSTIN.test(gstin.slice(2, 12))) {
    return 'GSTIN characters 3–12 must be a PAN: 5 letters, 4 digits, then 1 letter'
  }
  if (!/^[1-9A-Z]$/.test(gstin[12])) {
    return 'GSTIN character 13 must be 1–9 or A–Z'
  }
  if (gstin[13] !== 'Z') return 'GSTIN character 14 must be Z'
  if (!/^[A-Z0-9]$/.test(gstin[14])) return 'GSTIN checksum character must be a letter or digit'
  if (gstin[14] !== gstinChecksumCharacter(gstin.slice(0, 14))) {
    return 'GSTIN checksum is invalid'
  }
  return ''
}
