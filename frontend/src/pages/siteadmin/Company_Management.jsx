import React, { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTheme } from '@mui/material/styles'
import Button from '@mui/material/Button'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import CircularProgress from '@mui/material/CircularProgress'
import Alert from '@mui/material/Alert'
import ManagementPageHeader from '../../components/ManagementPageHeader'
import { useSyncGlobalLoading } from '../../contexts/GlobalLoadingContext'
import { apiUrl } from '../../config/api'
import { parseDateValue } from '../../lib/dateTime'
import { getManagementTableBorderColor } from '../../uiConstants'

function Company_Management() {
  const theme = useTheme()
  const navigate = useNavigate()
  const [companies, setCompanies] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  useSyncGlobalLoading(loading)

  useEffect(() => {
    fetchCompanies()
  }, [])

  const fetchCompanies = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(apiUrl('/api/siteadmin/companies'), {
        method: 'GET',
        credentials: 'include',
      })

      const data = await response.json()

      if (response.ok && data.success) {
        setCompanies(data.data || [])
      } else {
        setError(data.message || 'Failed to fetch companies')
      }
    } catch (err) {
      console.error('Error fetching companies:', err)
      setError('Error fetching companies')
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A'
    const timestamp = parseDateValue(dateString)?.getTime()
    if (Number.isNaN(timestamp)) return 'N/A'

    return new Date(timestamp).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }

  const borderColor = getManagementTableBorderColor(theme)
  const metaLabelSx = {
    color: 'text.secondary',
    fontWeight: 600,
    fontSize: '0.7rem',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    mr: 0.75,
  }

  return (
    <ManagementPageHeader
      title="Company Management"
      subtitle={loading ? 'Loading...' : `${companies.length} ${companies.length === 1 ? 'company' : 'companies'} registered`}
      actions={
        <Button
          component={Link}
          to="/siteadmin/create-company"
          variant="contained"
          color="secondary"
          sx={{
            px: 2.5,
            py: 1,
            fontSize: '0.875rem',
            fontWeight: 700,
            textTransform: 'none',
            boxShadow: 'none',
          }}
        >
          + Add New Company
        </Button>
      }
    >
      {error ? (
        <Alert severity="error" sx={{ mb: 2, borderRadius: 0 }}>
          {error}
        </Alert>
      ) : null}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 280 }}>
          <CircularProgress size={32} />
        </Box>
      ) : companies.length === 0 ? (
        <Typography sx={{ py: 5, textAlign: 'center', color: 'text.secondary' }}>
          No companies registered yet. Create your first company to get started.
        </Typography>
      ) : (
        <Box
          sx={{
            border: `1px solid ${borderColor}`,
            borderRadius: 1.5,
            overflow: 'hidden',
            backgroundColor: theme.palette.mode === 'dark'
              ? 'rgba(15, 23, 42, 0.96)'
              : 'rgba(255, 255, 255, 0.92)',
          }}
        >
          {companies.map((company, index) => (
            <Box
              key={company.id}
              onClick={() => navigate(`/siteadmin/company/${company.company_identifier}`)}
              sx={{
                display: 'flex',
                alignItems: { xs: 'flex-start', md: 'center' },
                justifyContent: 'space-between',
                gap: 2,
                flexWrap: 'wrap',
                px: 2.25,
                py: 1.75,
                cursor: 'pointer',
                borderBottom: index === companies.length - 1 ? 0 : `1px solid ${borderColor}`,
                '&:hover': { backgroundColor: 'action.hover' },
              }}
            >
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Typography sx={{ fontWeight: 700, color: 'text.primary', lineHeight: 1.35 }}>
                  {company.company_name || 'N/A'}
                </Typography>
                <Typography
                  noWrap
                  title={company.registered_email || 'N/A'}
                  sx={{ mt: 0.35, color: 'text.secondary', fontSize: '0.875rem' }}
                >
                  {company.registered_email || 'N/A'}
                </Typography>
              </Box>

              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'baseline',
                  flexWrap: 'wrap',
                  gap: 2.5,
                  rowGap: 1,
                }}
              >
                <Typography variant="body2" sx={{ fontWeight: 500, fontSize: '0.875rem' }}>
                  <Box component="span" sx={metaLabelSx}>Units</Box>
                  {Number(company.total_units || 0)}
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 500, fontSize: '0.875rem' }}>
                  <Box component="span" sx={metaLabelSx}>Admins</Box>
                  {Number(company.total_company_admins || 0)}
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 500, fontSize: '0.875rem', color: 'text.secondary' }}>
                  {formatDate(company.created_at)}
                </Typography>
              </Box>
            </Box>
          ))}
        </Box>
      )}
    </ManagementPageHeader>
  )
}

export default Company_Management
