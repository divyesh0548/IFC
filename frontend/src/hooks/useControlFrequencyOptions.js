import { useCallback, useEffect, useState } from 'react'
import { apiUrl } from '../config/api'

function normalizeFrequencyOption(row) {
  return {
    value: String(row?.value || '').trim(),
    sampleSize: row?.sampleSize ?? null,
  }
}

export function useControlFrequencyOptions() {
  const [options, setOptions] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchOptions = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch(apiUrl('/api/control-forms/control-frequency-options'), {
        credentials: 'include',
      })
      const result = await response.json()

      if (response.ok && result?.success) {
        setOptions(Array.isArray(result.data) ? result.data.map(normalizeFrequencyOption) : [])
      } else {
        setOptions([])
      }
    } catch (error) {
      console.error('Failed to fetch control frequency options:', error)
      setOptions([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchOptions()
  }, [fetchOptions])

  return {
    controlFrequencyOptions: options,
    loading,
    refreshControlFrequencyOptions: fetchOptions,
  }
}
