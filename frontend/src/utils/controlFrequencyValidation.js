function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[/()&-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function normalizeControlFrequencyValue(value) {
  if (!value) {
    return ''
  }

  const normalized = String(value)
    .toLowerCase()
    .trim()
    .replace(/&/g, 'and')
    .replace(/[-_]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  if (normalized === 'annual' || normalized === 'annually') {
    return 'yearly'
  }

  return normalized
}

function hasWords(normalizedValue, ...words) {
  return words.every((word) => normalizedValue.includes(word))
}

const SUPPORTED_CONTROL_FREQUENCY_CATEGORIES = [
  { key: 'yearly', value: 'Yearly', sampleSize: 1, maxSampleSize: 3 },
  { key: 'half_yearly', value: 'Half Yearly', sampleSize: 2, maxSampleSize: 6 },
  { key: 'quarterly', value: 'Quarterly', sampleSize: 2, maxSampleSize: 12 },
  { key: 'monthly', value: 'Monthly', sampleSize: 3, maxSampleSize: 24 },
  { key: 'weekly', value: 'Weekly', sampleSize: 8, maxSampleSize: 53 },
  { key: 'fortnightly', value: 'Fortnightly', sampleSize: 4, maxSampleSize: 26 },
  { key: 'as_when_needed', value: 'As & When Needed', sampleSize: 5, maxSampleSize: 50 },
  { key: 'daily', value: 'Daily', sampleSize: 25, maxSampleSize: 100 },
  { key: 'recurring', value: 'Recurring & Periodic', sampleSize: 40, maxSampleSize: 120 },
]

function resolveControlFrequencyCategory(value) {
  const normalizedValue = normalizeControlFrequencyValue(value)
  if (!normalizedValue) return null

  const byKey = (key) => SUPPORTED_CONTROL_FREQUENCY_CATEGORIES.find((item) => item.key === key) || null

  if (normalizedValue === 'yearly' || hasWords(normalizedValue, 'annual')) {
    return byKey('yearly')
  }

  if (normalizedValue === 'half yearly' || hasWords(normalizedValue, 'half', 'year')) {
    return byKey('half_yearly')
  }

  if (normalizedValue === 'quarterly' || normalizedValue.includes('quarter')) {
    return byKey('quarterly')
  }

  if (normalizedValue === 'monthly') {
    return byKey('monthly')
  }

  if (normalizedValue === 'weekly') {
    return byKey('weekly')
  }

  if (normalizedValue === 'fortnightly' || normalizedValue.includes('fortnight')) {
    return byKey('fortnightly')
  }

  if (
    normalizedValue === 'as and when' ||
    normalizedValue === 'as and when needed' ||
    normalizedValue === 'as and when required' ||
    hasWords(normalizedValue, 'as', 'when') ||
    normalizedValue === 'on event' ||
    normalizedValue === 'on going' ||
    normalizedValue === 'ongoing' ||
    hasWords(normalizedValue, 'on', 'going')
  ) {
    return byKey('as_when_needed')
  }

  if (normalizedValue === 'daily') {
    return byKey('daily')
  }

  if (
    normalizedValue === 'recurring and periodic' ||
    normalizedValue === 'recurring' ||
    (normalizedValue.includes('recurring') && normalizedValue.includes('periodic'))
  ) {
    return byKey('recurring')
  }

  return null
}

export function getSampleSizeByControlFrequency(value) {
  const category = resolveControlFrequencyCategory(value)
  return category ? category.sampleSize : null
}

export function getMaximumSampleSizeByControlFrequency(value) {
  const category = resolveControlFrequencyCategory(value)
  return category?.maxSampleSize ?? null
}

export function getFrequencyKeyByControlFrequency(value) {
  const category = resolveControlFrequencyCategory(value)
  return category?.key ?? null
}

export function getEffectiveSampleSizeForFrequency(settings, frequencyLabel) {
  const minimum = getSampleSizeByControlFrequency(frequencyLabel)
  const frequencyKey = getFrequencyKeyByControlFrequency(frequencyLabel)
  const setting = frequencyKey
    ? (settings || []).find((row) => row.frequency_key === frequencyKey)
    : null

  if (setting) {
    return {
      sampleSize: setting.effective_sample_size ?? minimum,
      minimum: setting.minimum_sample_size ?? minimum,
      maximum: setting.maximum_sample_size ?? getMaximumSampleSizeByControlFrequency(frequencyLabel),
      isUnitOverride: setting.configured_sample_size != null,
    }
  }

  return {
    sampleSize: minimum,
    minimum,
    maximum: getMaximumSampleSizeByControlFrequency(frequencyLabel),
    isUnitOverride: false,
  }
}

export function validateSampleSizeForFrequency(settings, frequencyLabel, sampleSize) {
  const meta = getEffectiveSampleSizeForFrequency(settings, frequencyLabel)
  const parsed = Number.parseInt(String(sampleSize ?? '').trim(), 10)

  if (!Number.isFinite(parsed) || parsed < 1) {
    return { ok: false, message: 'Sample size must be a positive integer' }
  }

  if (meta.minimum != null && parsed < meta.minimum) {
    return {
      ok: false,
      message: `Sample size cannot be lower than ${meta.minimum} for the selected control frequency`,
      minimum: meta.minimum,
    }
  }

  if (meta.maximum != null && parsed > meta.maximum) {
    return {
      ok: false,
      message: `Sample size cannot exceed ${meta.maximum} for the selected control frequency`,
      maximum: meta.maximum,
      minimum: meta.minimum,
    }
  }

  return { ok: true, sampleSize: parsed, minimum: meta.minimum, maximum: meta.maximum ?? null }
}

export function getSampleSizeInputFeedback(settings, frequencyLabel, sampleSize) {
  const meta = getEffectiveSampleSizeForFrequency(settings, frequencyLabel)
  const trimmed = String(sampleSize ?? '').trim()

  if (trimmed !== '') {
    const validation = validateSampleSizeForFrequency(settings, frequencyLabel, trimmed)
    if (!validation.ok) {
      return { warning: validation.message, limits: null }
    }
  }

  const limits = [
    meta.minimum != null ? `Minimum sample size: ${meta.minimum}` : null,
    meta.maximum != null ? `Maximum sample size: ${meta.maximum}` : null,
  ].filter(Boolean).join(' | ')

  return { warning: null, limits: limits || null }
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

export function getControlFrequencyValidationDetails(rows, headerName) {
  return validateControlFrequencyColumnValues(rows, headerName)
}
