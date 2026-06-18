import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { alpha, useTheme } from '@mui/material/styles'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  Chip,
  Divider,
  IconButton,
  Skeleton,
  Stack,
  Typography,
} from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import RefreshIcon from '@mui/icons-material/Refresh'
import SettingsRoundedIcon from '@mui/icons-material/SettingsRounded'
import { MAIN_CONTENT_MAX_WIDTH } from '../../uiConstants'
import { useSyncGlobalLoading } from '../../contexts/GlobalLoadingContext'
import { apiUrl } from '../../config/api'

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

  const loadCompany = useCallback(async () => {
    setLoading(true)
    setError(null)

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

  const fields = useMemo(() => {
    if (!company) return []
    return [
      { label: 'Company Name', value: company.company_name, strong: true },
      { label: 'Registered Email', value: company.registered_email },
      { label: 'Registered Address', value: company.registered_address },
      { label: 'Unique Identification Number', value: company.unique_identification_number },
      { label: 'GST', value: company.gst },
      { label: 'PAN', value: company.pan },
      { label: 'Corporate Offices', value: company.number_of_corporate_offices },
      { label: 'Factory Units', value: company.number_of_factory_units },
      { label: 'Registration Date', value: formatDate(company.created_at) },
    ]
  }, [company])

  const unitNames = useMemo(
    () =>
      Array.isArray(company?.company_units)
        ? company.company_units
            .map((unit) => String(unit.unit_name || '').trim())
            .filter(Boolean)
        : [],
    [company]
  )

  const detailCardSx = {
    borderRadius: 3,
    overflow: 'hidden',
    bgcolor: 'background.paper',
    boxShadow: theme.palette.mode === 'dark'
      ? '0 6px 24px rgba(0,0,0,0.35)'
      : '0 6px 20px rgba(0,0,0,0.08)',
  }

  const DetailItem = ({ label, value, strong = false }) => (
    <Box sx={{ py: 2.25, textAlign: 'left' }}>
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
      <Typography variant="body1" sx={{ fontWeight: strong ? 800 : 500, wordBreak: 'break-word', lineHeight: 1.7 }}>
        {value || 'N/A'}
      </Typography>
    </Box>
  )

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <Box sx={{ width: '100%', maxWidth: MAIN_CONTENT_MAX_WIDTH, mx: 'auto', px: 0, py: { xs: 3, sm: 4 } }}>
        <Stack spacing={2.5}>
          {error && (
            <Alert
              severity="error"
              action={
                <Button
                  onClick={() => navigate('/siteadmin/company-management')}
                  startIcon={<ArrowBackIcon />}
                  variant="outlined"
                >
                  Back
                </Button>
              }
              sx={{ alignItems: 'center' }}
            >
              {error}
            </Alert>
          )}

          {!error && !loading && !company && (
            <Alert
              severity="info"
              action={
                <Button
                  onClick={() => navigate('/siteadmin/company-management')}
                  startIcon={<ArrowBackIcon />}
                  variant="outlined"
                >
                  Back
                </Button>
              }
              sx={{ alignItems: 'center' }}
            >
              Company not found
            </Alert>
          )}

          <Card variant="outlined" sx={detailCardSx}>
            <CardHeader
              title={<Typography variant="h5" sx={{ fontWeight: 800 }}>Company Details</Typography>}
              action={
                <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" justifyContent="flex-end">
                  {!loading && company ? (
                    <Button
                      variant="contained"
                      startIcon={<SettingsRoundedIcon />}
                      onClick={() => navigate(`/siteadmin/company/${company_identifier}/unit-management`)}
                      sx={{ textTransform: 'none', fontWeight: 700 }}
                    >
                      Unit Management
                    </Button>
                  ) : null}
                  <IconButton onClick={() => navigate('/siteadmin/company-management')} aria-label="back">
                    <ArrowBackIcon />
                  </IconButton>
                  <IconButton onClick={loadCompany} aria-label="refresh">
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
                <Stack spacing={4}>
                  <Stack divider={<Divider />} sx={{ width: '100%' }}>
                    {fields.map((field) => (
                      <DetailItem
                        key={field.label}
                        label={field.label}
                        value={field.value}
                        strong={field.strong}
                      />
                    ))}
                  </Stack>

                  <Box
                    sx={{
                      borderRadius: 3,
                      border: '1px solid',
                      borderColor: theme.palette.divider,
                      backgroundColor: alpha(theme.palette.background.default, 0.6),
                      p: { xs: 2, sm: 2.5 },
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
                        mb: 1.25,
                      }}
                    >
                      Units
                    </Typography>
                    {unitNames.length === 0 ? (
                      <Typography color="text.secondary">No units found.</Typography>
                    ) : (
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                        {unitNames.map((unitName) => (
                          <Chip key={unitName} label={unitName} sx={{ fontWeight: 600 }} />
                        ))}
                      </Box>
                    )}
                  </Box>
                </Stack>
              )}
            </CardContent>
          </Card>
        </Stack>
      </Box>
    </Box>
  )
}

export default CompanyDetail
