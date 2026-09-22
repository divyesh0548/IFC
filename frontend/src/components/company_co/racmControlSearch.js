import { apiUrl } from '../../config/api'

export const RACM_CONTROL_SEARCH_INITIAL_LIMIT = 5
export const RACM_CONTROL_SEARCH_LIMIT = 5
export const RACM_CONTROL_SEARCH_DEBOUNCE_MS = 300
export const RACM_CONTROL_SEARCH_VISIBLE_OPTION_COUNT = 5

/** Strip whitespace/symbols for control-number matching (e.g. "C.1" → "C1"). */
export function normalizeControlNumberSearchText(value) {
  return String(value ?? '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase()
}

export function getRacmControlDisplayLabel(option) {
  const controlNumber = String(option?.control_number || '').trim()
  return controlNumber || String(option?.form_id || '').trim() || '-'
}

export function getRacmControlOptionLabel(option) {
  return getRacmControlDisplayLabel(option)
}

export function isSameRacmControlOption(option, value) {
  return String(option?.form_id || '').trim() === String(value?.form_id || '').trim()
}

export async function fetchRacmControlsForCc({
  businessProcess,
  unitId,
  q = '',
  limit = RACM_CONTROL_SEARCH_INITIAL_LIMIT,
} = {}) {
  const trimmedProcess = String(businessProcess || '').trim()
  const trimmedUnitId = String(unitId || '').trim()
  if (!trimmedProcess || !trimmedUnitId) return []

  const params = new URLSearchParams({
    business_process: trimmedProcess,
    unit_id: trimmedUnitId,
    limit: String(limit),
  })

  const normalizedQuery = normalizeControlNumberSearchText(q)
  if (normalizedQuery) {
    // Send normalized query so backend matching is consistent even if raw text differs
    params.set('q', normalizedQuery)
  }

  const response = await fetch(
    apiUrl(`/api/company-co/communication-matrix/controls?${params.toString()}`),
    {
      method: 'GET',
      credentials: 'include',
    }
  )
  const data = await response.json()

  if (!response.ok || !data.success || !Array.isArray(data.data)) {
    return []
  }

  return data.data
}
