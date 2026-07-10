import React, { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { alpha, useTheme } from '@mui/material/styles'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Chip from '@mui/material/Chip'
import CircularProgress from '@mui/material/CircularProgress'
import Dialog from '@mui/material/Dialog'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import Divider from '@mui/material/Divider'
import Grid from '@mui/material/Grid'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import ArrowOutwardRoundedIcon from '@mui/icons-material/ArrowOutwardRounded'
import BusinessRoundedIcon from '@mui/icons-material/BusinessRounded'
import DescriptionRoundedIcon from '@mui/icons-material/DescriptionRounded'
import HubRoundedIcon from '@mui/icons-material/HubRounded'
import ManageAccountsRoundedIcon from '@mui/icons-material/ManageAccountsRounded'
import PolicyRoundedIcon from '@mui/icons-material/PolicyRounded'
import { apiUrl } from '../../config/api'
import { useSyncGlobalLoading } from '../../contexts/GlobalLoadingContext'
import { parseDateValue } from '../../lib/dateTime'

function formatDate(dateString) {
  if (!dateString) return 'N/A'

  const timestamp = parseDateValue(dateString)?.getTime()
  if (Number.isNaN(timestamp)) return 'N/A'

  return new Date(timestamp).toLocaleString('en-IN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function DetailRow({ label, value }) {
  const theme = useTheme()

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', sm: '190px minmax(0, 1fr)' },
        gap: { xs: 0.4, sm: 2 },
        py: 1.15,
        borderBottom: `1px solid ${alpha(theme.palette.divider, 0.8)}`,
        '&:last-of-type': {
          borderBottom: 'none',
        },
      }}
    >
      <Typography sx={{ fontSize: '0.82rem', fontWeight: 800, color: theme.palette.text.secondary }}>
        {label}
      </Typography>
      <Typography sx={{ fontSize: '0.95rem', fontWeight: 700, color: theme.palette.text.primary, wordBreak: 'break-word' }}>
        {value || 'N/A'}
      </Typography>
    </Box>
  )
}

function CompanyUnitCard({ unit }) {
  const theme = useTheme()

  return (
    <Card
      variant="outlined"
      sx={{
        borderRadius: 2.5,
        borderColor: alpha(theme.palette.divider, 0.9),
        backgroundColor: alpha(theme.palette.background.default, theme.palette.mode === 'dark' ? 0.28 : 0.72),
      }}
    >
      <CardContent sx={{ p: 2.25 }}>
        <Stack spacing={1.35}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
            <Typography sx={{ fontSize: '1rem', fontWeight: 800, color: theme.palette.text.primary }}>
              {unit.unit_name || 'Unit'}
            </Typography>
          </Box>

          <DetailRow label="Unit Address" value={unit.unit_address || 'N/A'} />
          <DetailRow label="Coordinator" value={unit.coordinator_display_name || unit.coordinator_email_id || 'Not mapped'} />
          <DetailRow label="Coordinator Email" value={unit.coordinator_email_id || 'Not mapped'} />
          <DetailRow label="Approver" value={unit.approver_display_name || unit.approver_email_id || 'Not mapped'} />
          <DetailRow label="Approver Email" value={unit.approver_email_id || 'Not mapped'} />
        </Stack>
      </CardContent>
    </Card>
  )
}

function AuditorCompaniesPage() {
  const theme = useTheme()
  const [companies, setCompanies] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedCompany, setSelectedCompany] = useState(null)

  useSyncGlobalLoading(loading)

  useEffect(() => {
    let cancelled = false

    const fetchCompanies = async () => {
      setLoading(true)
      setError('')

      try {
        const response = await fetch(apiUrl('/api/auditor/companies'), {
          method: 'GET',
          credentials: 'include',
        })
        const data = await response.json()

        if (cancelled) return

        if (response.ok && data.success) {
          setCompanies(Array.isArray(data.data) ? data.data : [])
        } else {
          setError(data.message || 'Failed to load companies')
          setCompanies([])
        }
      } catch (err) {
        console.error('Auditor companies page error:', err)
        if (!cancelled) {
          setError('Network error while loading companies')
          setCompanies([])
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    fetchCompanies()

    return () => {
      cancelled = true
    }
  }, [])

  return (
    <Box sx={{ py: 2, display: 'flex', flexDirection: 'column', gap: 3 }}>
      {error && (
        <Alert severity="error" sx={{ borderRadius: 2.5 }}>
          {error}
        </Alert>
      )}

      {loading ? (
        <Box sx={{ minHeight: 280, display: 'grid', placeItems: 'center' }}>
          <CircularProgress size={32} />
        </Box>
      ) : companies.length === 0 ? (
        <Alert severity="info" sx={{ borderRadius: 2.5 }}>
          No companies are available for the auditor view.
        </Alert>
      ) : (
        <Grid container spacing={2.5}>
          {companies.map((company) => (
            <Grid key={company.company_identifier || company.id} size={{ xs: 12, sm: 6, lg: 4, xl: 3 }}>
              <Card
                onClick={() => setSelectedCompany(company)}
                sx={{
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  borderRadius: '10px',
                  border: `1px solid ${theme.palette.divider}`,
                  boxShadow: theme.palette.mode === 'dark'
                    ? '0 1px 3px rgba(0,0,0,0.3)'
                    : '0 1px 3px rgba(0,0,0,0.12)',
                  transition: 'all 0.2s ease-in-out',
                  backgroundColor: theme.palette.background.paper,
                  cursor: 'pointer',
                  '&:hover': {
                    borderColor: theme.palette.mode === 'dark'
                      ? alpha(theme.palette.primary.light, 0.34)
                      : alpha(theme.palette.primary.main, 0.32),
                    boxShadow: theme.palette.mode === 'dark'
                      ? '0 8px 22px rgba(0,0,0,0.4)'
                      : '0 10px 26px rgba(18,52,88,0.12)',
                    transform: 'translateY(-2px)',
                  },
                }}
              >
                <CardContent sx={{ display: 'flex', flexDirection: 'column', height: '100%', p: 3 }}>
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1.5, mb: 2.5 }}>
                    <Box
                      sx={{
                        width: 52,
                        height: 52,
                        borderRadius: 2.5,
                        display: 'grid',
                        placeItems: 'center',
                        color: alpha(theme.palette.primary.main, 0.95),
                        backgroundColor: alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.2 : 0.1),
                        border: `1px solid ${alpha(theme.palette.primary.main, 0.18)}`,
                        flexShrink: 0,
                      }}
                    >
                      <BusinessRoundedIcon sx={{ fontSize: 30 }} />
                    </Box>
                    <Chip
                      label={`${Number(company.total_units || 0)} unit${Number(company.total_units || 0) === 1 ? '' : 's'}`}
                      size="small"
                      sx={{
                        fontWeight: 800,
                        borderRadius: 1.5,
                        backgroundColor: alpha(theme.palette.secondary.main, theme.palette.mode === 'dark' ? 0.18 : 0.1),
                      }}
                    />
                  </Box>

                  <Typography
                    variant="h6"
                    sx={{
                      fontWeight: 700,
                      mb: 2.25,
                      color: theme.palette.text.primary,
                      fontSize: '1.1rem',
                      lineHeight: 1.4,
                      borderBottom: `1px solid ${theme.palette.divider}`,
                      pb: 2,
                    }}
                  >
                    {company.company_name || 'N/A'}
                  </Typography>

                  <Stack spacing={2}>
                    <Box>
                      <Typography variant="caption" sx={{ fontWeight: 700, color: theme.palette.text.secondary, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                        Registered Email
                      </Typography>
                      <Typography sx={{ mt: 0.65, color: theme.palette.text.primary, fontSize: '0.9rem', lineHeight: 1.55, wordBreak: 'break-word' }}>
                        {company.registered_email || 'N/A'}
                      </Typography>
                    </Box>

                    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 1.2 }}>
                      <Box sx={{ p: 1.4, borderRadius: 2, backgroundColor: alpha(theme.palette.info.main, theme.palette.mode === 'dark' ? 0.16 : 0.08) }}>
                        <Typography sx={{ fontSize: '0.72rem', fontWeight: 800, color: theme.palette.text.secondary, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                          Users
                        </Typography>
                        <Typography sx={{ mt: 0.4, fontSize: '1.1rem', fontWeight: 900, color: theme.palette.text.primary }}>
                          {Number(company.total_users || 0)}
                        </Typography>
                      </Box>
                      <Box sx={{ p: 1.4, borderRadius: 2, backgroundColor: alpha(theme.palette.success.main, theme.palette.mode === 'dark' ? 0.16 : 0.08) }}>
                        <Typography sx={{ fontSize: '0.72rem', fontWeight: 800, color: theme.palette.text.secondary, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                          RACMs
                        </Typography>
                        <Typography sx={{ mt: 0.4, fontSize: '1.1rem', fontWeight: 900, color: theme.palette.text.primary }}>
                          {Number(company.total_racms || 0)}
                        </Typography>
                      </Box>
                    </Box>
                  </Stack>

                  <Box sx={{ mt: 'auto', pt: 2.25, display: 'flex', alignItems: 'center', gap: 0.8, color: theme.palette.primary.main }}>
                    <Typography sx={{ fontSize: '0.88rem', fontWeight: 800 }}>
                      View company details
                    </Typography>
                    <ArrowOutwardRoundedIcon sx={{ fontSize: 18 }} />
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      <Dialog
        open={Boolean(selectedCompany)}
        onClose={() => setSelectedCompany(null)}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 3,
          },
        }}
      >
        <DialogTitle sx={{ fontWeight: 800, pb: 1.5 }}>
          {selectedCompany?.company_name || 'Company Details'}
        </DialogTitle>
        <DialogContent sx={{ pb: 3 }}>
          {selectedCompany && (
            <Stack spacing={3}>
              <Paper
                variant="outlined"
                sx={{
                  p: 2.5,
                  borderRadius: 2.5,
                  borderColor: alpha(theme.palette.divider, 0.95),
                }}
              >
                <Stack divider={<Divider />} sx={{ width: '100%' }}>
                  <DetailRow label="Registered Email" value={selectedCompany.registered_email} />
                  <DetailRow label="Registered Address" value={selectedCompany.registered_address} />
                  <DetailRow label="Unique Identification Number" value={selectedCompany.unique_identification_number} />
                  <DetailRow label="GST" value={selectedCompany.gst} />
                  <DetailRow label="PAN" value={selectedCompany.pan} />
                  <DetailRow label="Corporate Offices" value={selectedCompany.number_of_corporate_offices} />
                  <DetailRow label="Factory Units" value={selectedCompany.number_of_factory_units} />
                  <DetailRow label="Created At" value={formatDate(selectedCompany.created_at)} />
                </Stack>
              </Paper>

              <Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                  <HubRoundedIcon sx={{ color: theme.palette.primary.main }} />
                  <Typography sx={{ fontSize: '1.05rem', fontWeight: 800, color: theme.palette.text.primary }}>
                    Unit Details
                  </Typography>
                </Box>

                {Array.isArray(selectedCompany.company_units) && selectedCompany.company_units.length > 0 ? (
                  <Stack spacing={2}>
                    {selectedCompany.company_units.map((unit) => (
                      <CompanyUnitCard key={unit.id || unit.unit_id} unit={unit} />
                    ))}
                  </Stack>
                ) : (
                  <Alert severity="info" sx={{ borderRadius: 2.5 }}>
                    No unit details are available for this company.
                  </Alert>
                )}
              </Box>
            </Stack>
          )}
        </DialogContent>
      </Dialog>
    </Box>
  )
}

function PlaceholderPanel({ title, description, icon }) {
  const theme = useTheme()

  return (
    <Paper
      sx={{
        p: 3,
        borderRadius: 3,
        border: '1px solid',
        borderColor: alpha(theme.palette.primary.main, 0.14),
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, mb: 1.25 }}>
        <Box
          sx={{
            width: 44,
            height: 44,
            borderRadius: 2.5,
            display: 'grid',
            placeItems: 'center',
            color: theme.palette.primary.contrastText,
            background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
          }}
        >
          {icon}
        </Box>
        <Typography variant="h5" sx={{ fontWeight: 800 }}>
          {title}
        </Typography>
      </Box>
      <Typography variant="body2" sx={{ color: 'text.secondary', lineHeight: 1.7 }}>
        {description}
      </Typography>
    </Paper>
  )
}

function Auditor_dashboard() {
  const location = useLocation()

  if (location.pathname === '/auditor/companies') {
    return <AuditorCompaniesPage />
  }

  if (location.pathname === '/auditor/users') {
    return (
      <Box sx={{ py: 2 }}>
        <PlaceholderPanel
          title="Users"
          description="The auditor users page is still on the placeholder flow. Company and unit-aware read-only user browsing can be added next in the same design language."
          icon={<ManageAccountsRoundedIcon />}
        />
      </Box>
    )
  }

  if (location.pathname === '/auditor/racms') {
    return (
      <Box sx={{ py: 2 }}>
        <PlaceholderPanel
          title="RACMs"
          description="The auditor RACM view is still on the placeholder flow. The companies experience is now live with card drill-down and unit-level mapping details."
          icon={<DescriptionRoundedIcon />}
        />
      </Box>
    )
  }

  return (
    <Box sx={{ py: 2 }}>
      <PlaceholderPanel
        title="Auditor Dashboard"
        description="Select a module from the auditor home page."
        icon={<PolicyRoundedIcon />}
      />
    </Box>
  )
}

export default Auditor_dashboard
