import { useCallback, useEffect, useState } from 'react'
import { apiUrl } from '../config/api'

function normalizeBusinessProcessRow(row) {
  return {
    ...row,
    business_process: String(row?.business_process || '').trim(),
    business_process_code: String(row?.business_process_code || '').trim(),
  }
}

export function useBusinessProcesses() {
  const [businessProcesses, setBusinessProcesses] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchBusinessProcesses = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch(apiUrl('/api/business-processes'), {
        credentials: 'include',
      })
      const result = await response.json()

      if (response.ok && result?.success) {
        setBusinessProcesses(
          Array.isArray(result.data) ? result.data.map(normalizeBusinessProcessRow) : []
        )
      } else {
        setBusinessProcesses([])
      }
    } catch (error) {
      console.error('Failed to fetch business processes:', error)
      setBusinessProcesses([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchBusinessProcesses()
  }, [fetchBusinessProcesses])

  return {
    businessProcesses,
    businessProcessOptions: businessProcesses
      .map((row) => row.business_process)
      .filter(Boolean),
    loading,
    refreshBusinessProcesses: fetchBusinessProcesses,
  }
}
