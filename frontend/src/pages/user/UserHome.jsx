import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { alpha, useTheme } from '@mui/material/styles'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Paper from '@mui/material/Paper'
import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import BusinessRoundedIcon from '@mui/icons-material/BusinessRounded'
import DashboardRoundedIcon from '@mui/icons-material/DashboardRounded'
import FactCheckRoundedIcon from '@mui/icons-material/FactCheckRounded'
import PendingActionsRoundedIcon from '@mui/icons-material/PendingActionsRounded'
import TaskAltRoundedIcon from '@mui/icons-material/TaskAltRounded'
import ArrowOutwardRoundedIcon from '@mui/icons-material/ArrowOutwardRounded'
import InsightsRoundedIcon from '@mui/icons-material/InsightsRounded'
import { toast } from 'react-hot-toast'
import { useSyncGlobalLoading } from '../../contexts/GlobalLoadingContext'

function normalizeStatus(status) {
  return String(status || '').trim().toLowerCase()
}

const COMPANY_DETAIL_LABELS = {
  company_name: 'Company Name',
  registered_email: 'Registered Email',
  registered_address: 'Registered Address',
  unique_identification_number: 'Unique Identification Number',
  gst: 'GST',
  pan: 'PAN',
  number_of_corporate_offices: 'Corporate Offices',
  number_of_factory_units: 'Factory Units',
}

function DetailRow({ label, value }) {
  const theme = useTheme()
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', sm: '160px minmax(0, 1fr)' },
        gap: { xs: 0.4, sm: 2 },
        py: 1.2,
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
        {value || '-'}
      </Typography>
    </Box>
  )
}

function UserHome() {
  const theme = useTheme()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [companyDialogOpen, setCompanyDialogOpen] = useState(false)
  const [profile, setProfile] = useState(null)
  const [forms, setForms] = useState([])
  useSyncGlobalLoading(loading)

  useEffect(() => {
    let cancelled = false

    const fetchHomeData = async () => {
      setLoading(true)
      try {
        const profileResponse = await fetch('http://localhost:3000/api/auth/profile', {
          method: 'GET',
          credentials: 'include',
        })
        const profileData = await profileResponse.json()

        if (profileResponse.status === 401) {
          navigate('/login', { replace: true })
          return
        }

        if (!profileResponse.ok || !profileData?.success) {
          throw new Error(profileData?.message || 'Failed to fetch profile')
        }

        const nextProfile = profileData.profile || {}
        if (cancelled) return
        setProfile(nextProfile)

        if (!nextProfile.email_id) {
          setForms([])
          return
        }

        const formsResponse = await fetch(
          `http://localhost:3000/api/control-forms?control_owner=${encodeURIComponent(nextProfile.email_id)}&active=true`,
          {
            method: 'GET',
            credentials: 'include',
          },
        )
        const formsData = await formsResponse.json()

        if (formsResponse.status === 401) {
          navigate('/login', { replace: true })
          return
        }

        if (!formsResponse.ok || !formsData?.success) {
          throw new Error(formsData?.message || 'Failed to fetch RACM stats')
        }

        if (!cancelled) {
          setForms(Array.isArray(formsData.data) ? formsData.data : [])
        }
      } catch (error) {
        console.error('Failed to fetch user home data:', error)
        if (!cancelled) {
          toast.error('Failed to load user home data')
          setForms([])
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    fetchHomeData()

    return () => {
      cancelled = true
    }
  }, [navigate])

  const stats = useMemo(() => {
    return forms.reduce(
      (acc, form) => {
        const status = normalizeStatus(form.status)
        acc.totalRacms += 1
        if (status === 'approved') {
          acc.approvedRacms += 1
        } else if (status !== 'rejected') {
          acc.pendingRacms += 1
        }
        return acc
      },
      {
        totalRacms: 0,
        approvedRacms: 0,
        pendingRacms: 0,
      },
    )
  }, [forms])

  const displayName = profile?.emp_name?.trim() || profile?.email_id || 'User'
  const unitDisplay = profile?.unit_name || profile?.unit_id || '-'
  const blueTokens = theme.palette.blueTheme?.[theme.palette.mode] || {}
  const companyDetailRows = Object.entries(profile?.company_details || {})
    .filter(([key]) => !['id', 'company_identifier', 'created_at'].includes(key))
    .map(([key, value]) => ({
      label: COMPANY_DETAIL_LABELS[key] || key.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase()),
      value,
    }))

  const statCards = [
    {
      label: 'Total RACMs',
      value: stats.totalRacms,
      icon: <FactCheckRoundedIcon sx={{ fontSize: 22 }} />,
      color: theme.palette.primary.main,
    },
    {
      label: 'Pending RACMs',
      value: stats.pendingRacms,
      icon: <PendingActionsRoundedIcon sx={{ fontSize: 22 }} />,
      color: theme.palette.warning.main,
    },
    {
      label: 'Approved RACMs',
      value: stats.approvedRacms,
      icon: <TaskAltRoundedIcon sx={{ fontSize: 22 }} />,
      color: theme.palette.success.main,
    },
  ]

  const tiles = [
    {
      eyebrow: 'Company',
      title: 'Company Details',
      description: 'View your company profile and the unit mapped to your user account.',
      action: 'View details',
      icon: <BusinessRoundedIcon sx={{ fontSize: 38 }} />,
      accent: theme.palette.primary.main,
      onClick: () => setCompanyDialogOpen(true),
    },
    {
      eyebrow: 'RACM',
      title: 'Dashboard',
      description: 'Open your RACM list to review assignments, upload evidence, and track status.',
      action: 'Open dashboard',
      icon: <DashboardRoundedIcon sx={{ fontSize: 38 }} />,
      accent: blueTokens.accent || theme.palette.info.main,
      onClick: () => navigate('/user/dashboard'),
    },
  ]

  return (
    <Box
      sx={{
        px: 0,
        py: 2,
        minHeight: 'calc(100vh - 64px)',
        display: 'flex',
        flexDirection: 'column',
        gap: 3,
      }}
    >
      <Box
        sx={{
          position: 'relative',
          overflow: 'hidden',
          borderRadius: 4,
          border: '1px solid',
          borderColor:
            theme.palette.mode === 'dark'
              ? alpha(theme.palette.common.white, 0.08)
              : alpha(theme.palette.primary.main, 0.12),
          background: theme.palette.gradients?.hero,
          boxShadow:
            theme.palette.mode === 'dark'
              ? '0 20px 48px rgba(0, 0, 0, 0.32)'
              : '0 20px 48px rgba(15, 23, 42, 0.08)',
        }}
      >
        <Box
          sx={{
            position: 'absolute',
            top: -70,
            right: -30,
            width: 220,
            height: 220,
            borderRadius: '50%',
            background: `radial-gradient(circle, ${alpha(blueTokens.heroGlow || theme.palette.primary.main, 0.22)} 0%, transparent 72%)`,
          }}
        />
        <Box
          sx={{
            position: 'absolute',
            bottom: -90,
            left: -40,
            width: 240,
            height: 240,
            borderRadius: '50%',
            background: `radial-gradient(circle, ${alpha(blueTokens.accent || theme.palette.secondary.main, 0.16)} 0%, transparent 70%)`,
          }}
        />

        <Box
          sx={{
            position: 'relative',
            p: { xs: 2.5, sm: 3.5, md: 4 },
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1.45fr) minmax(280px, 0.95fr)' },
            gap: 3,
            alignItems: 'stretch',
          }}
        >
          <Box sx={{ minWidth: 0 }}>
            <Box
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 1,
                px: 1.4,
                py: 0.7,
                borderRadius: 999,
                mb: 2,
                backgroundColor: alpha(theme.palette.background.paper, theme.palette.mode === 'dark' ? 0.12 : 0.72),
                border: `1px solid ${alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.24 : 0.16)}`,
              }}
            >
              <Box
                sx={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  backgroundColor: theme.palette.success.main,
                  boxShadow: `0 0 0 4px ${alpha(theme.palette.success.main, 0.16)}`,
                }}
              />
              <Typography sx={{ fontSize: '0.82rem', fontWeight: 700, color: theme.palette.text.secondary }}>
                User workspace
              </Typography>
            </Box>

            <Typography
              sx={{
                fontSize: { xs: '1.85rem', sm: '2.35rem', md: '2.7rem' },
                fontWeight: 900,
                color: theme.palette.text.primary,
                lineHeight: 1.08,
                letterSpacing: '-0.03em',
                maxWidth: '100%',
              }}
            >
              Welcome back, {displayName}
            </Typography>

            <Typography
              sx={{
                mt: 1.4,
                maxWidth: { xs: '100%', lg: 720 },
                color: theme.palette.text.secondary,
                fontSize: { xs: '0.98rem', sm: '1.03rem' },
                lineHeight: 1.7,
              }}
            >
              Track your assigned RACMs, monitor pending evidence work, and open the dashboard whenever you need the full list.
            </Typography>

            <Box
              sx={{
                mt: 2.5,
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, minmax(0, 1fr))' },
                gap: 1.5,
                maxWidth: 760,
              }}
            >
              {statCards.map((card) => (
                <Paper
                  key={card.label}
                  elevation={0}
                  sx={{
                    p: 1.35,
                    borderRadius: 2,
                    border: `1px dashed ${alpha(theme.palette.text.primary, theme.palette.mode === 'dark' ? 0.28 : 0.2)}`,
                    backgroundColor: 'transparent',
                    boxShadow: 'none',
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
                    <Box
                      sx={{
                        width: 40,
                        height: 40,
                        borderRadius: '50%',
                        display: 'grid',
                        placeItems: 'center',
                        flexShrink: 0,
                        color: card.color,
                        border: `1px solid ${alpha(card.color, 0.45)}`,
                        backgroundColor: alpha(card.color, theme.palette.mode === 'dark' ? 0.12 : 0.08),
                      }}
                    >
                      {card.icon}
                    </Box>
                    <Box sx={{ minWidth: 0 }}>
                      <Typography
                        sx={{
                          fontSize: '0.68rem',
                          fontWeight: 800,
                          letterSpacing: '0.12em',
                          textTransform: 'uppercase',
                          color: theme.palette.text.secondary,
                          mb: 0.25,
                        }}
                      >
                        {card.label}
                      </Typography>
                      <Typography
                        sx={{
                          fontSize: '1.35rem',
                          fontWeight: 800,
                          color: theme.palette.text.primary,
                          fontVariantNumeric: 'tabular-nums',
                          lineHeight: 1.2,
                        }}
                      >
                        {loading ? '--' : card.value}
                      </Typography>
                    </Box>
                  </Box>
                </Paper>
              ))}
            </Box>
          </Box>

          <Paper
            elevation={0}
            sx={{
              p: 2.4,
              borderRadius: 3,
              border: '1px solid',
              borderColor:
                theme.palette.mode === 'dark'
                  ? alpha(theme.palette.common.white, 0.08)
                  : alpha(theme.palette.divider, 1),
              backgroundColor: alpha(theme.palette.background.paper, theme.palette.mode === 'dark' ? 0.5 : 0.82),
              backdropFilter: 'blur(8px)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'flex-start',
              gap: 1.15,
              minHeight: 'auto',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
              <Box
                sx={{
                  width: 42,
                  height: 42,
                  borderRadius: 2.5,
                  display: 'grid',
                  placeItems: 'center',
                  color: theme.palette.primary.contrastText,
                  background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
                }}
              >
                <InsightsRoundedIcon sx={{ fontSize: 22 }} />
              </Box>
              <Box>
                <Typography sx={{ fontSize: '0.84rem', fontWeight: 700, color: theme.palette.text.secondary }}>
                  Snapshot
                </Typography>
                <Typography sx={{ fontSize: '1.05rem', fontWeight: 800, color: theme.palette.text.primary }}>
                  RACM Overview
                </Typography>
              </Box>
            </Box>

            <Box sx={{ display: 'grid', gap: 0.85 }}>
              {statCards.map((item) => (
                <Box
                  key={item.label}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 2,
                    py: 0.9,
                    borderBottom: `1px solid ${alpha(theme.palette.divider, 0.75)}`,
                    '&:last-of-type': {
                      borderBottom: 'none',
                      pb: 0,
                    },
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2, minWidth: 0 }}>
                    <Box
                      sx={{
                        width: 10,
                        height: 10,
                        borderRadius: '50%',
                        backgroundColor: item.color,
                        flexShrink: 0,
                      }}
                    />
                    <Typography sx={{ fontSize: '0.92rem', fontWeight: 700, color: theme.palette.text.secondary }}>
                      {item.label}
                    </Typography>
                  </Box>
                  <Typography sx={{ fontSize: '1rem', fontWeight: 900, color: theme.palette.text.primary }}>
                    {loading ? '--' : item.value}
                  </Typography>
                </Box>
              ))}
            </Box>
          </Paper>
        </Box>
      </Box>

      <Box
        sx={{
          width: '100%',
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' },
          gap: 2.5,
        }}
      >
        {tiles.map((tile) => (
          <Paper
            key={tile.title}
            onClick={tile.onClick}
            elevation={0}
            sx={{
              p: 0,
              width: '100%',
              minHeight: 176,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-start',
              justifyContent: 'flex-start',
              borderRadius: 3,
              cursor: 'pointer',
              overflow: 'hidden',
              transition: 'box-shadow 220ms ease-out, border-color 220ms ease-out, background-color 220ms ease-out, transform 220ms ease-out',
              backgroundColor: alpha(theme.palette.background.paper, 0.92),
              border: `1px solid ${
                theme.palette.mode === 'dark'
                  ? alpha(tile.accent, 0.12)
                  : alpha(theme.palette.divider, 0.9)
              }`,
              boxShadow:
                theme.palette.mode === 'dark'
                  ? '0 10px 24px rgba(0, 0, 0, 0.18)'
                  : '0 10px 24px rgba(15, 23, 42, 0.05)',
              '&:hover': {
                transform: 'translateY(-2px)',
                borderColor: alpha(tile.accent, 0.5),
                boxShadow:
                  theme.palette.mode === 'dark'
                    ? `0 18px 36px rgba(0, 0, 0, 0.24), inset 0 0 0 1px ${alpha(tile.accent, 0.18)}`
                    : `0 18px 36px rgba(15, 23, 42, 0.08), inset 0 0 0 1px ${alpha(tile.accent, 0.12)}`,
                backgroundColor:
                  theme.palette.mode === 'dark'
                    ? alpha(theme.palette.background.paper, 0.98)
                    : alpha(theme.palette.background.paper, 1),
              },
            }}
          >
            <Box
              sx={{
                width: '100%',
                p: 2.75,
                display: 'flex',
                flexDirection: 'column',
                gap: 2.2,
                minHeight: 176,
                background: `linear-gradient(180deg, ${alpha(tile.accent, theme.palette.mode === 'dark' ? 0.18 : 0.08)} 0%, transparent 100%)`,
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1.5, width: '100%' }}>
                <Box
                  sx={{
                    width: 56,
                    height: 56,
                    borderRadius: '16px',
                    display: 'grid',
                    placeItems: 'center',
                    color:
                      theme.palette.mode === 'dark'
                        ? alpha(theme.palette.common.white, 0.92)
                        : alpha(tile.accent, 0.92),
                    backgroundColor: alpha(tile.accent, theme.palette.mode === 'dark' ? 0.18 : 0.12),
                    border: `1px solid ${alpha(tile.accent, theme.palette.mode === 'dark' ? 0.18 : 0.16)}`,
                    flexShrink: 0,
                  }}
                >
                  {tile.icon}
                </Box>
                <Box
                  sx={{
                    px: 1.1,
                    py: 0.65,
                    borderRadius: 999,
                    backgroundColor: alpha(tile.accent, theme.palette.mode === 'dark' ? 0.14 : 0.1),
                    color: theme.palette.mode === 'dark' ? alpha(theme.palette.common.white, 0.86) : tile.accent,
                  }}
                >
                  <Typography sx={{ fontSize: '0.72rem', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                    {tile.eyebrow}
                  </Typography>
                </Box>
              </Box>

              <Box sx={{ display: 'grid', gap: 0.9 }}>
                <Typography sx={{ fontWeight: 800, color: theme.palette.text.primary, fontSize: '1.08rem', lineHeight: 1.3 }}>
                  {tile.title}
                </Typography>
                <Typography sx={{ textAlign: 'left', color: alpha(theme.palette.text.secondary, 0.92), fontSize: '0.92rem', lineHeight: 1.6 }}>
                  {tile.description}
                </Typography>
              </Box>

              <Box sx={{ mt: 'auto', display: 'flex', alignItems: 'center', gap: 0.8, color: tile.accent }}>
                <Typography sx={{ fontSize: '0.88rem', fontWeight: 800 }}>
                  {tile.action}
                </Typography>
                <ArrowOutwardRoundedIcon sx={{ fontSize: 18 }} />
              </Box>
            </Box>
          </Paper>
        ))}
      </Box>

      <Dialog
        open={companyDialogOpen}
        onClose={() => setCompanyDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}
      >
        <DialogTitle sx={{ fontWeight: 800 }}>Company Details</DialogTitle>
        <DialogContent>
          <Box
            sx={{
              p: 2,
              borderRadius: 2,
              border: '1px solid',
              borderColor: 'divider',
              backgroundColor: alpha(theme.palette.background.paper, 0.75),
            }}
          >
            {companyDetailRows.map((row) => (
              <DetailRow key={row.label} label={row.label} value={row.value} />
            ))}
            <DetailRow label="Unit" value={unitDisplay} />
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button
            variant="contained"
            color="secondary"
            onClick={() => setCompanyDialogOpen(false)}
            sx={{ textTransform: 'none', fontWeight: 700 }}
          >
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

export default UserHome
