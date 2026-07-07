import { formatDateOnly } from './dateTime'

export function formatChangeRequestDisplayValue(fieldDbName, value) {
  const normalizedField = String(fieldDbName || '').trim()
  const raw = value == null ? '' : String(value).trim()
  if (!raw) return '-'

  if (normalizedField === 'due_date') {
    return formatDateOnly(raw)
  }

  return raw
}

export function getChangeRequestOutcomeSx(status) {
  const normalized = String(status || '').trim().toLowerCase()

  if (normalized === 'approved') {
    return { color: 'success.main', fontWeight: 600 }
  }

  if (normalized === 'rejected') {
    return { color: 'error.main', fontWeight: 600 }
  }

  if (normalized === 'partially approved') {
    return { color: 'info.main', fontWeight: 600 }
  }

  return { color: 'text.secondary', fontWeight: 600 }
}

export function formatChangeRequestOutcome(status) {
  return String(status || '').trim() || '-'
}
