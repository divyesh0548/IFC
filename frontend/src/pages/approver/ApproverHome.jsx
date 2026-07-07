import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { alpha, useTheme } from '@mui/material/styles'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Paper from '@mui/material/Paper'
import DomainRoundedIcon from '@mui/icons-material/DomainRounded'
import DashboardRoundedIcon from '@mui/icons-material/DashboardRounded'
import ArrowOutwardRoundedIcon from '@mui/icons-material/ArrowOutwardRounded'
import InsightsRoundedIcon from '@mui/icons-material/InsightsRounded'
import { useSyncGlobalLoading } from '../../contexts/GlobalLoadingContext'
import { apiUrl } from '../../config/api'
import { formatDisplayName } from '../../utils/displayName'
import DashboardGreeting from '../../components/DashboardGreeting'
import HomeHelpSupport from '../../components/help/HomeHelpSupport'
import { readStoredUserDisplayName, writeStoredUserDisplayName } from '../../storageKeys'

function ApproverHome() {
  const theme = useTheme()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  useSyncGlobalLoading(loading)
  const [stats, setStats] = useState({
    approver_name: '',
    company_identifier: '',
    company_name: '',
    company_details: {},
    mapped_units: [],
    total_users: 0,
    total_active_racms: 0,
    total_approved_racms: 0,
    total_rejected_racms: 0,
    total_pending_racms: 0,
    total_racms: 0,
  })

  useEffect(() => {
    const fetchHomeStats = async () => {
      try {
        const response = await fetch(apiUrl('/api/approver/home-stats'), {
          method: 'GET',
          credentials: 'include',
        })

        const data = await response.json()

        if (response.ok && data.success) {
          setStats(data.data)
          writeStoredUserDisplayName(data.data?.approver_name, 'Approver')
        }
      } catch (error) {
        console.error('Failed to fetch approver home stats:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchHomeStats()
  }, [])

  const displayName = readStoredUserDisplayName() || formatDisplayName(stats.approver_name, 'Approver')
  const blueTokens = theme.palette.blueTheme?.[theme.palette.mode] || {}
  const mappedUnits = Array.isArray(stats.mapped_units) ? stats.mapped_units : []

  const workTiles = [
    {
      eyebrow: 'Primary',
      title: 'Approval Dashboard',
      description: 'Open the full approval queue to filter RACMs, inspect details, and submit decisions.',
      icon: <DashboardRoundedIcon sx={{ fontSize: 38 }} />,
      action: 'Open dashboard',
      path: '/approver/dashboard',
      accent: theme.palette.primary.main,
    },
    {
      eyebrow: 'Company',
      title: 'Company Details',
      description: 'View company information and the units mapped to your approval queue.',
      icon: <DomainRoundedIcon sx={{ fontSize: 38 }} />,
      action: 'View details',
      path: '/approver/company-details',
      accent: blueTokens.accent || theme.palette.info.main,
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
          background: theme.palette.gradients?.hero || `linear-gradient(135deg, ${alpha(theme.palette.primary.light, 0.22)} 0%, ${alpha(theme.palette.background.paper, 0.96)} 100%)`,
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
                Approver workspace
              </Typography>
            </Box>

            <DashboardGreeting
              displayName={displayName}
              primarySx={{
                fontSize: { xs: '1.85rem', sm: '2.35rem', md: '2.7rem' },
                fontWeight: 900,
                color: theme.palette.text.primary,
                lineHeight: 1.08,
                letterSpacing: '-0.03em',
                maxWidth: '100%',
              }}
            />

            <Typography
              sx={{
                mt: 1.4,
                maxWidth: { xs: '100%', lg: 720 },
                color: theme.palette.text.secondary,
                fontSize: { xs: '0.98rem', sm: '1.03rem' },
                lineHeight: 1.7,
              }}
            >
              Review approval activity for your assigned units, keep pending RACMs moving, and use the dashboard as the operational hub for decisions.
            </Typography>

            <Box sx={{ mt: 2.4, display: 'flex', flexDirection: 'column', gap: 1.1, maxWidth: 760 }}>
              {mappedUnits.length > 0 ? (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.7 }}>
                  {mappedUnits.map((unit) => (
                    <Box
                      key={`${unit.company_identifier || 'company'}-${unit.unit_id}`}
                      sx={{
                        px: 1,
                        py: 0.45,
                        borderRadius: 999,
                        border: `1px solid ${alpha(theme.palette.text.primary, theme.palette.mode === 'dark' ? 0.2 : 0.13)}`,
                        backgroundColor: alpha(theme.palette.background.paper, theme.palette.mode === 'dark' ? 0.2 : 0.54),
                        maxWidth: '100%',
                      }}
                    >
                      <Typography sx={{ fontSize: '0.78rem', fontWeight: 800, color: theme.palette.text.primary }}>
                        {unit.unit_name || unit.unit_id || 'Unit'}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              ) : (
                <Typography sx={{ fontSize: '0.82rem', color: theme.palette.text.secondary }}>
                  No units are currently mapped to this approver.
                </Typography>
              )}
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
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, mb: 0 }}>
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
                  Approval Overview
                </Typography>
              </Box>
            </Box>

            <Box sx={{ display: 'grid', gap: 0.85 }}>
              {[
                { label: 'Total RACMs', value: stats.total_racms, color: theme.palette.primary.main },
                { label: 'Pending RACMs', value: stats.total_pending_racms, color: theme.palette.warning.main },
                { label: 'Approved RACMs', value: stats.total_approved_racms, color: theme.palette.success.main },
                { label: 'Rejected RACMs', value: stats.total_rejected_racms, color: theme.palette.error.main },
              ].map((item) => (
                <Box
                  key={item.label}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 2,
                    py: 0.85,
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
        <HomeHelpSupport />
      </Box>

      <Box
        sx={{
          width: '100%',
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
          gap: 2.5,
        }}
      >
        {workTiles.map((tile) => (
          <Paper
            key={tile.title}
            onClick={() => {
              if (tile.onClick) {
                tile.onClick()
                return
              }
              navigate(tile.path)
            }}
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
              transition: 'box-shadow 220ms ease-out, border-color 220ms ease-out, background-color 220ms ease-out',
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
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  gap: 1.5,
                  width: '100%',
                }}
              >
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
                    color:
                      theme.palette.mode === 'dark'
                        ? alpha(theme.palette.common.white, 0.86)
                        : tile.accent,
                  }}
                >
                  <Typography sx={{ fontSize: '0.72rem', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                    {tile.eyebrow}
                  </Typography>
                </Box>
              </Box>

              <Box sx={{ display: 'grid', gap: 0.9 }}>
                <Typography
                  sx={{
                    fontWeight: 800,
                    color: theme.palette.text.primary,
                    fontSize: '1.08rem',
                    lineHeight: 1.3,
                  }}
                >
                  {tile.title}
                </Typography>
                <Typography
                  sx={{
                    textAlign: 'left',
                    color: alpha(theme.palette.text.secondary, 0.92),
                    fontSize: '0.92rem',
                    lineHeight: 1.6,
                  }}
                >
                  {tile.description}
                </Typography>
              </Box>

              <Box
                sx={{
                  mt: 'auto',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.8,
                  color: tile.accent,
                }}
              >
                <Typography sx={{ fontSize: '0.88rem', fontWeight: 800 }}>
                  {tile.action}
                </Typography>
                <ArrowOutwardRoundedIcon sx={{ fontSize: 18 }} />
              </Box>
            </Box>
          </Paper>
        ))}
      </Box>
    </Box>
  )
}

export default ApproverHome
