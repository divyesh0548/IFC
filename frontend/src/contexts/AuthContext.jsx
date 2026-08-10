import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { apiUrl } from '../config/api'

const AuthContext = createContext(null)

/** Shared in-flight verify so StrictMode double-mount does not duplicate the request. */
let sharedVerifyPromise = null

async function requestVerify() {
  if (sharedVerifyPromise) {
    return sharedVerifyPromise
  }

  sharedVerifyPromise = (async () => {
    try {
      const response = await fetch(apiUrl('/api/auth/verify'), {
        method: 'GET',
        credentials: 'include',
      })
      const data = await response.json().catch(() => ({}))

      if (response.ok && data?.success && data?.user) {
        return {
          ok: true,
          user: data.user,
          requiresPasswordUpdate: Boolean(data.requiresPasswordUpdate),
        }
      }

      return {
        ok: false,
        user: null,
        requiresPasswordUpdate: false,
      }
    } catch (error) {
      console.error('Auth verification error:', error)
      return {
        ok: false,
        user: null,
        requiresPasswordUpdate: false,
      }
    } finally {
      sharedVerifyPromise = null
    }
  })()

  return sharedVerifyPromise
}

let externalClearAuthHandler = null

export function registerAuthClearHandler(handler) {
  externalClearAuthHandler = typeof handler === 'function' ? handler : null
}

export function clearAuthFromSessionHandler() {
  if (typeof externalClearAuthHandler === 'function') {
    externalClearAuthHandler()
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [requiresPasswordUpdate, setRequiresPasswordUpdate] = useState(false)
  const [status, setStatus] = useState('loading') // loading | authenticated | unauthenticated
  const hasResolvedRef = useRef(false)

  const applySession = useCallback((nextUser, nextRequiresPasswordUpdate = false) => {
    if (nextUser) {
      setUser(nextUser)
      setRequiresPasswordUpdate(Boolean(nextRequiresPasswordUpdate))
      setStatus('authenticated')
    } else {
      setUser(null)
      setRequiresPasswordUpdate(false)
      setStatus('unauthenticated')
    }
    hasResolvedRef.current = true
  }, [])

  const clearAuth = useCallback(() => {
    setUser(null)
    setRequiresPasswordUpdate(false)
    setStatus('unauthenticated')
    hasResolvedRef.current = true
  }, [])

  const refreshAuth = useCallback(async ({ force = false } = {}) => {
    if (!force && hasResolvedRef.current) {
      return {
        ok: status === 'authenticated',
        user,
        requiresPasswordUpdate,
      }
    }

    if (!hasResolvedRef.current) {
      setStatus('loading')
    }

    const result = await requestVerify()
    if (result.ok) {
      applySession(result.user, result.requiresPasswordUpdate)
    } else {
      clearAuth()
    }
    return result
  }, [applySession, clearAuth, requiresPasswordUpdate, status, user])

  useEffect(() => {
    let cancelled = false

    const bootstrap = async () => {
      const result = await requestVerify()
      if (cancelled) return
      if (result.ok) {
        applySession(result.user, result.requiresPasswordUpdate)
      } else {
        clearAuth()
      }
    }

    bootstrap()

    return () => {
      cancelled = true
    }
  }, [applySession, clearAuth])

  useEffect(() => {
    registerAuthClearHandler(clearAuth)
    return () => {
      registerAuthClearHandler(null)
    }
  }, [clearAuth])

  const value = useMemo(
    () => ({
      user,
      role: user?.role || null,
      email: user?.email_id || null,
      companyIdentifier: user?.company_identifier ?? null,
      isAuthenticated: status === 'authenticated',
      requiresPasswordUpdate,
      status,
      loading: status === 'loading',
      refreshAuth,
      setSession: applySession,
      clearAuth,
    }),
    [
      applySession,
      clearAuth,
      refreshAuth,
      requiresPasswordUpdate,
      status,
      user,
    ],
  )

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return ctx
}
