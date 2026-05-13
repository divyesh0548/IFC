function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[\/()&-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function normalizeControlFrequencyValue(value) {
  return String(value || '')
    .toLowerCase()
    .trim()
    .replace(/&/g, 'and')
    .replace(/[-_]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function hasWords(normalizedValue, ...words) {
  return words.every((word) => normalizedValue.includes(word))
}

export function getSampleSizeByControlFrequency(value) {
  const normalizedValue = normalizeControlFrequencyValue(value)
  if (!normalizedValue) return null

  if (normalizedValue === 'yearly' || hasWords(normalizedValue, 'annual')) return 1
  if (normalizedValue === 'half yearly' || hasWords(normalizedValue, 'half', 'year')) return 2
  if (normalizedValue === 'quarterly' || normalizedValue.includes('quarter')) return 4
  if (normalizedValue === 'monthly') return 3
  if (normalizedValue === 'weekly') return 8
  if (normalizedValue === 'fortnightly' || normalizedValue.includes('fortnight')) return 4

  if (
    normalizedValue === 'as and when needed' ||
    normalizedValue === 'as and when required' ||
    (hasWords(normalizedValue, 'as', 'when') &&
      (normalizedValue.includes('needed') || normalizedValue.includes('required'))) ||
    normalizedValue === 'on event' ||
    normalizedValue === 'on going' ||
    normalizedValue === 'ongoing' ||
    hasWords(normalizedValue, 'on', 'going')
  ) {
    return 5
  }

  if (
    normalizedValue === 'recurring and periodic' ||
    normalizedValue === 'recurring and daily' ||
    normalizedValue === 'daily' ||
    (normalizedValue.includes('recurring') &&
      (normalizedValue.includes('periodic') || normalizedValue.includes('daily')))
  ) {
    return 40
  }

  return null
}

export function findDetectedControlFrequencyHeader(rows) {
  const headers = new Set()
  ;(rows || []).forEach((row) => {
    Object.keys(row || {}).forEach((header) => headers.add(header))
  })

  for (const header of headers) {
    const normalizedHeader = normalizeText(header)
    if (
      normalizedHeader === 'control frequency' ||
      normalizedHeader === 'frequency of control' ||
      (normalizedHeader.includes('control') && normalizedHeader.includes('frequency'))
    ) {
      return header
    }
  }

  return null
}

export function validateControlFrequencyColumnValues(rows, headerName) {
  const header = String(headerName || '').trim()
  if (!header) {
    return {
      ok: false,
      reason: 'missing_column',
      message: 'Control Frequency column was not detected. No RACMs were imported.',
      invalidValues: [],
    }
  }

  const invalidValues = new Set()

  for (const row of rows || []) {
    const rawValue = row?.[header]
    const trimmedValue = rawValue !== null && rawValue !== undefined ? String(rawValue).trim() : ''

    if (!trimmedValue) {
      return {
        ok: false,
        reason: 'blank_value',
        message: 'Control Frequency is missing for one or more Excel rows. Update the Excel file and upload again.',
        invalidValues: [],
      }
    }

    if (getSampleSizeByControlFrequency(trimmedValue) === null) {
      invalidValues.add(trimmedValue)
    }
  }

  if (invalidValues.size > 0) {
    const values = [...invalidValues].sort((a, b) => a.localeCompare(b))
    return {
      ok: false,
      reason: 'invalid_value',
      message: `Unsupported Control Frequency value(s) found in Excel: ${values.join(', ')}. Update the Excel file and upload again.`,
      invalidValues: values,
    }
  }

  return {
    ok: true,
    reason: null,
    message: '',
    invalidValues: [],
  }
}
