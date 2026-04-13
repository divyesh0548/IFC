import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'

/**
 * Warn user when navigating away (browser back/refresh) with unsaved work.
 * Covers:
 * - Browser refresh/close (beforeunload)
 * - Browser back/forward (popstate)
 *
 * Note: react-router doesn't provide a stable navigation-blocking API in all setups,
 * so we handle the two biggest loss cases directly.
 */
export function useUnsavedChangesWarning(when, message = 'Your progress will be lost. Continue?') {
  const navigate = useNavigate()
  const ignoreNextPopstateRef = useRef(false)

  useEffect(() => {
    if (!when) return

    const handleBeforeUnload = (e) => {
      // Most browsers show their own generic message.
      e.preventDefault()
      e.returnValue = ''
      return ''
    }

    const handlePopState = () => {
      if (!when) return
      if (ignoreNextPopstateRef.current) {
        ignoreNextPopstateRef.current = false
        return
      }
      const ok = window.confirm(message)
      if (!ok) {
        // Revert the back/forward navigation.
        ignoreNextPopstateRef.current = true
        navigate(1)
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    window.addEventListener('popstate', handlePopState)

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      window.removeEventListener('popstate', handlePopState)
    }
  }, [when, message, navigate])
}

