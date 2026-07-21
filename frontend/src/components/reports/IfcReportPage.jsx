import React, { useCallback, useEffect, useState } from 'react'
import { apiUrl } from '../../config/api'
import { useSyncGlobalLoading } from '../../contexts/GlobalLoadingContext'
import IfcReportView from './IfcReportView'

function IfcReportPage({
  endpoint,
  title = 'IFC Report',
  subtitle,
  backPath,
}) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useSyncGlobalLoading(loading)

  const fetchReport = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const response = await fetch(apiUrl(endpoint), {
        method: 'GET',
        credentials: 'include',
      })
      const result = await response.json()
      if (!response.ok || !result?.success) {
        throw new Error(result?.message || 'Failed to load IFC report')
      }
      setData(result.data || null)
    } catch (fetchError) {
      console.error(`IFC report error for ${endpoint}:`, fetchError)
      setData(null)
      setError(fetchError.message || 'Failed to load IFC report')
    } finally {
      setLoading(false)
    }
  }, [endpoint])

  useEffect(() => {
    fetchReport()
  }, [fetchReport])

  return (
    <IfcReportView
      title={title}
      subtitle={subtitle}
      backPath={backPath}
      data={data}
      loading={loading}
      error={error}
      onRefresh={fetchReport}
    />
  )
}

export default IfcReportPage
