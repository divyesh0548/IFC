import { apiUrl } from '../../config/api'
import {
  UNIT_USER_SEARCH_DEBOUNCE_MS,
  UNIT_USER_SEARCH_INITIAL_LIMIT,
  UNIT_USER_SEARCH_LIMIT,
  USER_SEARCH_VISIBLE_OPTION_COUNT,
  excludeUnitUsers,
  getUnitUserDisplayLabel,
  getUnitUserOptionLabel,
  isSameUnitUserOption,
  sortUnitUsersByQuery,
} from './unitUserSearch'

export {
  UNIT_USER_SEARCH_DEBOUNCE_MS,
  UNIT_USER_SEARCH_INITIAL_LIMIT,
  UNIT_USER_SEARCH_LIMIT,
  USER_SEARCH_VISIBLE_OPTION_COUNT,
  excludeUnitUsers,
  getUnitUserDisplayLabel,
  getUnitUserOptionLabel,
  isSameUnitUserOption,
}

export async function fetchCompanyUsers({
  role,
  q = '',
  limit = UNIT_USER_SEARCH_INITIAL_LIMIT,
} = {}) {
  const trimmedRole = String(role || '').trim()
  if (!trimmedRole) return []

  const params = new URLSearchParams({
    role: trimmedRole,
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
