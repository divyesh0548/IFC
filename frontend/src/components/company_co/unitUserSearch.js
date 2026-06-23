import { apiUrl } from '../../config/api'

export const UNIT_USER_SEARCH_INITIAL_LIMIT = 5
export const UNIT_USER_SEARCH_LIMIT = 50
export const UNIT_USER_SEARCH_DEBOUNCE_MS = 300
export const USER_SEARCH_VISIBLE_OPTION_COUNT = 3

export function sortUnitUsersByQuery(users, query) {
  const normalizedQuery = String(query || '').trim().toLowerCase()
  if (!normalizedQuery) return users

  const scoreUser = (user) => {
    const name = String(user?.emp_name || '').trim().toLowerCase()
    const email = String(user?.email_id || '').trim().toLowerCase()
    if (name.includes(normalizedQuery)) return 0
    if (email.includes(normalizedQuery)) return 1
    return 2
  }

  return [...users].sort((left, right) => {
    const scoreDiff = scoreUser(left) - scoreUser(right)
    if (scoreDiff !== 0) return scoreDiff

    const leftName = String(left?.emp_name || left?.email_id || '').trim()
    const rightName = String(right?.emp_name || right?.email_id || '').trim()
    return leftName.localeCompare(rightName, undefined, { sensitivity: 'base' })
  })
}

export async function fetchUnitUsers({ unitId, q = '', limit = UNIT_USER_SEARCH_INITIAL_LIMIT } = {}) {
  const trimmedUnitId = String(unitId || '').trim()
  if (!trimmedUnitId) return []

  const params = new URLSearchParams({
    role: 'user',
    unit_id: trimmedUnitId,
    limit: String(limit),
  })

  const trimmedQuery = String(q || '').trim()
  if (trimmedQuery) {
    params.set('q', trimmedQuery)
  }

  const response = await fetch(apiUrl(`/api/company-co/users?${params.toString()}`), {
    method: 'GET',
    credentials: 'include',
  })
  const data = await response.json()

  if (!response.ok || !data.success || !Array.isArray(data.users)) {
    return []
  }

  return sortUnitUsersByQuery(data.users, trimmedQuery)
}

export function getUnitUserDisplayLabel(option) {
  const name = String(option?.emp_name || '').trim()
  const email = String(option?.email_id || '').trim()
  if (name && email) return `${name} (${email})`
  return name || email || '-'
}

export function getUnitUserOptionLabel(option) {
  return getUnitUserDisplayLabel(option)
}

export function isSameUnitUserOption(option, value) {
  return (
    String(option?.email_id || '').trim().toLowerCase() ===
    String(value?.email_id || '').trim().toLowerCase()
  )
}

export function excludeUnitUsers(users, excludeEmails = []) {
  const excluded = new Set(
    (Array.isArray(excludeEmails) ? excludeEmails : [excludeEmails])
      .map((email) => String(email || '').trim().toLowerCase())
      .filter(Boolean)
  )

  if (excluded.size === 0) return users

  return users.filter((user) => !excluded.has(String(user?.email_id || '').trim().toLowerCase()))
}
