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
