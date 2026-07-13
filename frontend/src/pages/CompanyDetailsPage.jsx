import React, { useEffect, useState } from 'react'
import CompanyDetailsView from '../components/company/CompanyDetailsView'
import { apiUrl } from '../config/api'

function CompanyDetailsPage() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false

    const fetchCompanyDetails = async () => {
      setLoading(true)
      try {
        const response = await fetch(apiUrl('/api/auth/company-details'), {
          credentials: 'include',
        })
        const result = await response.json()

        if (cancelled) return

        if (!response.ok || !result?.success) {
          throw new Error(result?.message || 'Failed to load company details')
        }

        setData(result.data || null)
        setError('')
      } catch (fetchError) {
        console.error('Company details page error:', fetchError)
        if (!cancelled) {
          setData(null)
          setError(fetchError.message || 'Failed to load company details')
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    fetchCompanyDetails()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <CompanyDetailsView
      companyName={data?.company_name}
      companyIdentifier={data?.company_identifier}
      companyDetails={data?.company_details}
      companyAdmins={Array.isArray(data?.company_admins) ? data.company_admins : []}
      units={Array.isArray(data?.units) ? data.units : []}
      linkedUnitIds={Array.isArray(data?.linked_unit_ids) ? data.linked_unit_ids : []}
      showLinkedUnitLegend={Boolean(data?.show_linked_unit_legend)}
      loading={loading}
      error={error}
    />
  )
}

export default CompanyDetailsPage
