const rawBackendUrl = import.meta.env.VITE_BACKEND_URL || ''

function stripTrailingSlashes(value) {
  return String(value || '').replace(/\/+$/, '')
}

function isLoopbackHostname(hostname) {
  const normalizedHostname = String(hostname || '').toLowerCase()
  return normalizedHostname === 'localhost' || normalizedHostname === '127.0.0.1' || normalizedHostname === '::1'
}

function resolveApiBaseUrl() {
  const configuredBaseUrl = stripTrailingSlashes(rawBackendUrl)
  if (!configuredBaseUrl || typeof window === 'undefined') {
    return configuredBaseUrl
  }

  try {
    const configuredUrl = new URL(configuredBaseUrl)
    const currentUrl = new URL(window.location.origin)

    // Ignore a localhost-only API target when the app is opened from a non-localhost origin.
    if (isLoopbackHostname(configuredUrl.hostname) && !isLoopbackHostname(currentUrl.hostname)) {
      return ''
    }
  } catch (_) {
    return ''
  }

  return configuredBaseUrl
}

export const API_BASE_URL = resolveApiBaseUrl()

export function apiUrl(path = '') {
  const normalizedPath = String(path || '')
  if (!normalizedPath) return API_BASE_URL
  return normalizedPath.startsWith('/') ? `${API_BASE_URL}${normalizedPath}` : `${API_BASE_URL}/${normalizedPath}`
}
