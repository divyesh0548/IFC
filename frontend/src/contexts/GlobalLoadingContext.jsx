import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

const GlobalLoadingContext = createContext(null)

export function GlobalLoadingProvider({ children }) {
  const countRef = useRef(0)
  const [active, setActive] = useState(false)

  const startGlobalLoading = useCallback(() => {
    countRef.current += 1
    if (countRef.current === 1) {
      setActive(true)
    }
  }, [])

  const stopGlobalLoading = useCallback(() => {
    countRef.current = Math.max(0, countRef.current - 1)
    if (countRef.current === 0) {
      setActive(false)
    }
  }, [])

  const value = useMemo(
    () => ({ active, startGlobalLoading, stopGlobalLoading }),
    [active, startGlobalLoading, stopGlobalLoading],
  )

  return (
    <GlobalLoadingContext.Provider value={value}>
      {children}
    </GlobalLoadingContext.Provider>
  )
}

export function useGlobalLoading() {
  const ctx = useContext(GlobalLoadingContext)
  if (!ctx) {
    throw new Error('useGlobalLoading must be used within GlobalLoadingProvider')
  }
  return ctx
}

/**
 * While `isBusy` is true, holds one slot on the global loading bar (supports overlaps via ref count).
 */
export function useSyncGlobalLoading(isBusy) {
  const { startGlobalLoading, stopGlobalLoading } = useGlobalLoading()

  useEffect(() => {
    if (!isBusy) {
      return undefined
    }
    startGlobalLoading()
    return () => {
      stopGlobalLoading()
    }
  }, [isBusy, startGlobalLoading, stopGlobalLoading])
}
