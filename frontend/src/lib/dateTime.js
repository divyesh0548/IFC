// Backend stores reminder/control timestamps in UTC (timestamp without time zone).
// Use formatIndianDateTime* helpers below when displaying them in the UI.

export function parseDateValue(value) {
  if (!value) return null
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
    : raw.replace(' ', 'T') + 'Z'

  return new Date(normalized)
}

export function formatIndianDateTime(value, fallback = 'N/A') {
  const date = parseDateValue(value)
  if (!date || Number.isNaN(date.getTime())) return fallback
  const istDate = new Date(date.getTime() + (330 * 60 * 1000))

  return istDate.toLocaleString('en-IN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    timeZone: 'UTC',
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

  const date = parseDateValue(value)
  if (!date || Number.isNaN(date.getTime())) {
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
  const date = parseDateValue(value)
  if (!date || Number.isNaN(date.getTime())) return fallback
  const istDate = new Date(date.getTime() + (330 * 60 * 1000))
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'UTC',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(istDate)
  const get = (type) => parts.find((p) => p.type === type)?.value || ''
  return `${get('day')}/${get('month')}/${get('year')} ${get('hour')}:${get('minute')}:${get('second')}`
}
