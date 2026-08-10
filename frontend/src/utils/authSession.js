import { API_BASE_URL } from '../config/api'
import {
  STORAGE_KEYS,
  clearCachedUserProfile,
  clearCompanyFinancialYearOptionsCache,
  clearStoredUserDisplayName,
} from '../storageKeys'
import { clearAuthFromSessionHandler } from '../contexts/AuthContext'

let installed = false
let redirecting = false

const PUBLIC_APP_PATHS = new Set(['/', '/login', '/forgot-password'])

function isPublicAppPath(pathname) {
  return PUBLIC_APP_PATHS.has(pathname)
}

function shouldHandleUnauthorized(url) {
  if (!url) return false
  if (!url.pathname.startsWith('/api/')) return false
  if (url.pathname === '/api/auth/login') return false
  if (url.pathname === '/api/auth/forgot-password') return false
  if (url.pathname === '/api/auth/verify') return false
  return true
}

function clearClientAuthState() {
  clearCachedUserProfile()
  clearCompanyFinancialYearOptionsCache()
  clearStoredUserDisplayName()

  try {
    localStorage.removeItem(STORAGE_KEYS.companyName)
    localStorage.removeItem(STORAGE_KEYS.companyIdentifier)
    localStorage.removeItem(STORAGE_KEYS.approverCompanyNames)
    localStorage.removeItem(STORAGE_KEYS.approverFinancialYears)
  } catch (_) {
    // ignore storage cleanup failures
  }
}

function redirectToLogin() {
  if (redirecting || typeof window === 'undefined') {
    return
  }

  const currentPath = `${window.location.pathname}${window.location.search}`
  if (isPublicAppPath(window.location.pathname)) {
    return
  }

  redirecting = true
  clearClientAuthState()
  clearAuthFromSessionHandler()

  const loginPath = currentPath && currentPath !== '/login'
    ? `/login?redirect=${encodeURIComponent(currentPath)}`
    : '/login'

  window.location.replace(loginPath)
}

function resolveRequestUrl(input) {
  try {
    if (input instanceof Request) {
      return new URL(input.url, window.location.origin)
    }
    return new URL(String(input), API_BASE_URL || window.location.origin)
  } catch (_) {
    return null
  }
}

export function installGlobalAuthSessionHandler() {
  if (installed || typeof window === 'undefined' || typeof window.fetch !== 'function') {
    return
  }

  installed = true
  const originalFetch = window.fetch.bind(window)

  window.fetch = async (input, init) => {
    const response = await originalFetch(input, init)
    const requestUrl = resolveRequestUrl(input)

    if (response.status === 401 && shouldHandleUnauthorized(requestUrl)) {
      redirectToLogin()
    }

    return response
  }
}
