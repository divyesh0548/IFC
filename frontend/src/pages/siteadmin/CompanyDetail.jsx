import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import CompanyDetailsView from '../../components/company/CompanyDetailsView'
import { useSyncGlobalLoading } from '../../contexts/GlobalLoadingContext'
import { apiUrl } from '../../config/api'

function CompanyDetail() {
  const navigate = useNavigate()
  const { company_identifier } = useParams()

  const [company, setCompany] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useSyncGlobalLoading(loading)

  const loadCompany = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const response = await fetch(apiUrl(`/api/siteadmin/companies/${company_identifier}`), {
        method: 'GET',
        credentials: 'include',
      })
      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Failed to fetch company data')
      }

      setCompany(data.data)
    } catch (fetchError) {
      console.error('Error loading company detail:', fetchError)
      setError(fetchError.message || 'Error fetching company data')
      setCompany(null)
    } finally {
      setLoading(false)
    }
  }, [company_identifier])

  useEffect(() => {
    loadCompany()
  }, [loadCompany])

  const companyDetails = useMemo(() => {
    if (!company) return {}
    return {
      company_name: company.company_name,
      registered_email: company.registered_email,
      registered_address: company.registered_address,
      unique_identification_number: company.unique_identification_number,
      gst: company.gst,
      pan: company.pan,
      number_of_corporate_offices: company.number_of_corporate_offices,
      number_of_factory_units: company.number_of_factory_units,
    }
  }, [company])

  const units = useMemo(() => (
    Array.isArray(company?.company_units)
      ? company.company_units.map((unit) => ({
        unit_id: unit.unit_id,
        unit_name: unit.unit_name,
        unit_address: unit.unit_address,
      }))
      : []
  ), [company])

  return (
    <Box>
      <Box sx={{ px: { xs: 2, sm: 3 }, pt: 2 }}>
        <Button
          onClick={() => navigate('/siteadmin/company-management')}
          startIcon={<ArrowBackIcon />}
          sx={{ textTransform: 'none', fontWeight: 700 }}
        >
          Back to Company Management
        </Button>
      </Box>
      <CompanyDetailsView
        companyName={company?.company_name}
        companyIdentifier={company?.company_identifier || company_identifier}
        companyDetails={companyDetails}
        units={units}
        linkedUnitIds={[]}
        showLinkedUnitLegend={false}
        loading={loading}
        error={error}
      />
    </Box>
  )
}

export default CompanyDetail
