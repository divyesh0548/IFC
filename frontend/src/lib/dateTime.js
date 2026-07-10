// Backend stores timestamps as UTC values.
// These helpers format them in the browser's local timezone.

function parseTimestampValue(value) {
  if (!value) return null

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value
  }

  const raw = String(value).trim()
  if (!raw) return null

  const dbTsMatch = raw.match(
    /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,6}))?$/
  )

  if (dbTsMatch) {
    const [, y, m, d, hh, mm, ss, micros = ''] = dbTsMatch
    const millis = Number((micros + '000').slice(0, 3))
    return new Date(Date.UTC(
      Number(y),
      Number(m) - 1,
      Number(d),
      Number(hh),
      Number(mm),
      Number(ss),
      millis
    ))
  }

  const normalized = /[zZ]$|[+-]\d{2}:\d{2}$/.test(raw)
    ? raw
    : raw.replace(' ', 'T')

  const date = new Date(normalized)
  return Number.isNaN(date.getTime()) ? null : date
}

export function parseDateValue(value) {
  return parseTimestampValue(value)
}

export function formatIndianDateTime(value, fallback = 'N/A') {
  const date = parseTimestampValue(value)
  if (!date) return fallback

  return date.toLocaleString('en-IN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
}

export function toDateOnlyString(value) {
  if (!value) return ''

  const raw = String(value).trim()
  if (!raw) return ''

  const dateOnlyMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (dateOnlyMatch) {
    return `${dateOnlyMatch[1]}-${dateOnlyMatch[2]}-${dateOnlyMatch[3]}`
  }

  const date = parseTimestampValue(value)
  if (!date) {
    const prefixMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})/)
    return prefixMatch ? `${prefixMatch[1]}-${prefixMatch[2]}-${prefixMatch[3]}` : ''
  }

  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

export function formatDateOnly(value, fallback = '-') {
  const dateOnly = toDateOnlyString(value)
  if (!dateOnly) return fallback

  const [year, month, day] = dateOnly.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day, 12, 0, 0))
  if (Number.isNaN(date.getTime())) return fallback

  return date.toLocaleDateString('en-IN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  })
}

export function formatIndianDateTimeCompact(value, fallback = '—') {
  const date = parseTimestampValue(value)
  if (!date) return fallback

  const parts = new Intl.DateTimeFormat('en-GB', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(date)

  const get = (type) => parts.find((p) => p.type === type)?.value || ''
  return `${get('day')}/${get('month')}/${get('year')} ${get('hour')}:${get('minute')}:${get('second')}`
}
