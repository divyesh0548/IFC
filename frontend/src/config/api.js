const rawBackendUrl = import.meta.env.VITE_BACKEND_URL || ''

export const API_BASE_URL = rawBackendUrl.replace(/\/+$/, '')

export function apiUrl(path = '') {
  const normalizedPath = String(path || '')
  if (!normalizedPath) return API_BASE_URL
  return normalizedPath.startsWith('/') ? `${API_BASE_URL}${normalizedPath}` : `${API_BASE_URL}/${normalizedPath}`
}
