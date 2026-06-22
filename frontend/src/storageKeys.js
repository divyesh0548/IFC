import { formatDisplayName } from './utils/displayName'

export const STORAGE_KEYS = {
  companyName: 'ifc_company_name',
  companyIdentifier: 'ifc_company_identifier',
  approverCompanyNames: 'ifc_approver_company_names',
  approverFinancialYears: 'ifc_approver_financial_years',
  userDisplayName: 'ifc_user_display_name',
  /** JSON profile from GET /api/auth/profile; cleared on logout / new login */
  cachedUserProfile: 'ifc_cached_user_profile',
}

export function readCachedUserProfile() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.cachedUserProfile)
    if (!raw) return null
    const p = JSON.parse(raw)
    if (p && typeof p === 'object' && typeof p.email_id === 'string') {
      return p
    }
    return null
  } catch (_) {
    return null
  }
}

export function writeCachedUserProfile(profile) {
  try {
    localStorage.setItem(STORAGE_KEYS.cachedUserProfile, JSON.stringify(profile))
  } catch (e) {
    console.warn('Failed to cache user profile', e)
  }
}

export function clearCachedUserProfile() {
  try {
    localStorage.removeItem(STORAGE_KEYS.cachedUserProfile)
  } catch (_) {
    /* ignore */
  }
}

export function readStoredUserDisplayName() {
  try {
    return String(localStorage.getItem(STORAGE_KEYS.userDisplayName) || '').trim()
  } catch (_) {
    return ''
  }
}

export function writeStoredUserDisplayName(value, fallback = 'User') {
  try {
    const normalizedValue = typeof value === 'string'
      ? formatDisplayName(value, fallback)
      : formatDisplayName(
          value?.emp_name?.trim()
            || value?.email_id
            || value?.email
            || value?.approver_email
            || value?.coordinatorEmail
            || '',
          fallback,
        )

    if (normalizedValue) {
      localStorage.setItem(STORAGE_KEYS.userDisplayName, normalizedValue)
    } else {
      localStorage.removeItem(STORAGE_KEYS.userDisplayName)
    }
  } catch (e) {
    console.warn('Failed to cache user display name', e)
  }
}

export function clearStoredUserDisplayName() {
  try {
    localStorage.removeItem(STORAGE_KEYS.userDisplayName)
  } catch (_) {
    /* ignore */
  }
}

export function clearCompanyFinancialYearOptionsCache() {
  try {
    Object.keys(localStorage).forEach((key) => {
      if (key.startsWith('ifc_financial_year_options_')) {
        localStorage.removeItem(key)
      }
    })
  } catch (_) {
    /* ignore */
  }
}

