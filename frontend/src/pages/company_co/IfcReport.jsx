import React, { useCallback, useEffect, useState } from 'react'
import { apiUrl } from '../../config/api'
import { useSyncGlobalLoading } from '../../contexts/GlobalLoadingContext'
import IfcReportView from '../../components/reports/IfcReportView'

function CompanyCoIfcReport() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useSyncGlobalLoading(loading)

  const fetchReport = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const response = await fetch(apiUrl('/api/company-co/ifc-report'), {
        method: 'GET',
        credentials: 'include',
      })
      const result = await response.json()
      if (!response.ok || !result?.success) {
        throw new Error(result?.message || 'Failed to load IFC report')
      }
      setData(result.data || null)
    } catch (fetchError) {
      console.error('Company coordinator IFC report error:', fetchError)
      setData(null)
      setError(fetchError.message || 'Failed to load IFC report')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchReport()
  }, [fetchReport])

  return (
    <IfcReportView
      title="IFC Report"
      subtitle="Scoped to your assigned units. Live aggregates refresh on each load."
      backPath="/company_co/racm-management"
      data={data}
      loading={loading}
      error={error}
      onRefresh={fetchReport}
    />
  )
}

export default CompanyCoIfcReport
