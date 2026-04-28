import React, { useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTheme } from '@mui/material/styles'

import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  Divider,
  IconButton,
  Skeleton,
  Stack,
  Typography,
  Grid,
} from '@mui/material'

import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import RefreshIcon from '@mui/icons-material/Refresh'
import { MAIN_CONTENT_MAX_WIDTH } from '../../uiConstants'
import { useSyncGlobalLoading } from '../../contexts/GlobalLoadingContext'
import { API_BASE_URL } from '../../config/api'

function CompanyDetail() {
  const theme = useTheme()
  const navigate = useNavigate()
  const { company_identifier } = useParams()

  const [company, setCompany] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  useSyncGlobalLoading(loading)

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A'
    const date = new Date(dateString)
    return date.toLocaleString('en-IN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Kolkata',
    })
  }

  const fetchCompany = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/siteadmin/companies/${company_identifier}`,
        { method: 'GET', credentials: 'include' }
      )
      const data = await response.json()

      if (response.ok && data.success) setCompany(data.data)
      else setError(data.message || 'Failed to fetch company data')
    } catch (err) {
      console.error('Error fetching company:', err)
      setError('Error fetching company data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCompany()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [company_identifier])

  const fields = useMemo(() => {
    if (!company) return []
    return [
      { label: 'Company Name', value: company.company_name, strong: true },
      // { label: 'Company Identifier', value: company.company_identifier },
      { label: 'Registered Email', value: company.registered_email },
      { label: 'Registered Address', value: company.registered_address, full: true },
      { label: 'Unique Identification Number', value: company.unique_identification_number },
      { label: 'GST', value: company.gst },
      { label: 'PAN', value: company.pan },
      { label: 'Corporate Offices', value: company.number_of_corporate_offices },
      { label: 'Factory Units', value: company.number_of_factory_units },
      { label: 'Registration Date', value: formatDate(company.created_at) },
    ]
  }, [company])

  const companyUnits = Array.isArray(company?.company_units) ? company.company_units : []

  const DetailItem = ({ label, value, strong }) => (
    <Box
      sx={{
        width: '100%',
        py: 2.25,
        textAlign: 'left',
      }}
    >
      <Typography
        variant="caption"
        sx={{
          display: 'block',
          fontWeight: 700,
          color: 'text.secondary',
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          mb: 0.75,
        }}
      >
        {label}
      </Typography>

      <Typography
        variant="body1"
        sx={{
          fontWeight: strong ? 800 : 500,
          wordBreak: 'break-word',
          lineHeight: 1.7,
        }}
      >
        {value || 'N/A'}
      </Typography>
    </Box>
  )


  const BackButton = (
    <Button
      onClick={() => navigate('/siteadmin/company-management')}
      startIcon={<ArrowBackIcon />}
      variant="outlined"
    >
      Back
    </Button>
  )

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <Box
        sx={{
          width: '100%',
          maxWidth: MAIN_CONTENT_MAX_WIDTH,
          mx: 'auto',
          px: 0,
          py: { xs: 3, sm: 4 },
        }}
      >
        <Stack spacing={2.5}>
          {error && (
            <Alert
              severity="error"
              action={BackButton}
              sx={{ alignItems: 'center' }}
            >
              {error}
            </Alert>
          )}

          {!error && !loading && !company && (
            <Alert
              severity="info"
              action={BackButton}
              sx={{ alignItems: 'center' }}
            >
              Company not found
            </Alert>
          )}

          <Card
            variant="outlined"
            sx={{
              borderRadius: 3,
              overflow: 'hidden',
              bgcolor: 'background.paper',
              boxShadow:
                theme.palette.mode === 'dark'
                  ? '0 6px 24px rgba(0,0,0,0.35)'
                  : '0 6px 20px rgba(0,0,0,0.08)',
            }}
          >
            <CardHeader
              title={
                <Typography variant="h5" sx={{ fontWeight: 800 }}>
                  Company Details
                </Typography>
              }

              action={
                <Stack direction="row" spacing={1} alignItems="center">
                  <IconButton
                    onClick={() => navigate('/siteadmin/company-management')}
                    aria-label="back"
                  >
                    <ArrowBackIcon />
                  </IconButton>
                  <IconButton onClick={fetchCompany} aria-label="refresh">
                    <RefreshIcon />
                  </IconButton>
                </Stack>
              }
            />
            <Divider />

            <CardContent sx={{ p: { xs: 2.5, sm: 3 } }}>
              {loading ? (
                <Stack spacing={2}>
                  <Skeleton height={28} width="55%" />
                  <Skeleton height={22} width="35%" />
                  <Skeleton height={22} width="45%" />
                  <Skeleton height={22} width="80%" />
                  <Skeleton height={22} width="60%" />
                  <Skeleton height={22} width="40%" />
                </Stack>
              ) : (
                <Box sx={{ width: '100%' }}>
                  <Stack
                    divider={<Divider />}
                    sx={{
                      width: '100%',
                      alignItems: 'stretch',
                    }}
                  >
                    {fields.map((f) => (
                      <DetailItem
                        key={f.label}
                        label={f.label}
                        value={f.value}
                        strong={f.strong}
                      />
                    ))}
                  </Stack>

                  <Box sx={{ mt: 4 }}>
                    <Typography
                      variant="h6"
                      sx={{
                        fontWeight: 800,
                        mb: 2,
                        color: 'text.primary',
                      }}
                    >
                      Unit Details
                    </Typography>

                    {companyUnits.length === 0 ? (
                      <Alert severity="info">
                        No unit details available.
                      </Alert>
                    ) : (
                      <Grid container spacing={2}>
                        {companyUnits.map((unit) => (
                          <Grid item xs={12} key={unit.id || unit.unit_id} sx={{ width: '100%' }}>
                            <Card
                              variant="outlined"
                              sx={{
                                width: '100%',
                                borderRadius: 2,
                                bgcolor: 'background.default',
                              }}
                            >
                              <CardContent sx={{ p: { xs: 2, sm: 2.5 } }}>
                                <Typography variant="subtitle1" sx={{ fontWeight: 800, color: 'text.primary' }}>
                                  {unit.unit_name || 'N/A'}
                                </Typography>
                                <Box sx={{ mt: 0.5 }}>
                                  <DetailItem label="Unit Address" value={unit.unit_address || 'N/A'} />
                                </Box>
                              </CardContent>
                            </Card>
                          </Grid>
                        ))}
                      </Grid>
                    )}
                  </Box>
                </Box>
              )}
            </CardContent>

          </Card>
        </Stack>
      </Box>
    </Box>
  )
}

export default CompanyDetail
