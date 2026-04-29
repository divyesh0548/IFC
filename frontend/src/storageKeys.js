export const STORAGE_KEYS = {
  companyName: 'ifc_company_name',
  companyIdentifier: 'ifc_company_identifier',
  approverCompanyNames: 'ifc_approver_company_names',
  approverFinancialYears: 'ifc_approver_financial_years',
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

