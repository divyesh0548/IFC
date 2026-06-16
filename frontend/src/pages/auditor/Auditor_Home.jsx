import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { alpha, useTheme } from '@mui/material/styles'
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import Alert from '@mui/material/Alert'
import BusinessRoundedIcon from '@mui/icons-material/BusinessRounded'
import GroupRoundedIcon from '@mui/icons-material/GroupRounded'
import FactCheckRoundedIcon from '@mui/icons-material/FactCheckRounded'
import FolderCopyRoundedIcon from '@mui/icons-material/FolderCopyRounded'
import ArrowOutwardRoundedIcon from '@mui/icons-material/ArrowOutwardRounded'
import InsightsRoundedIcon from '@mui/icons-material/InsightsRounded'
import PolicyRoundedIcon from '@mui/icons-material/PolicyRounded'
import { apiUrl } from '../../config/api'
import { useSyncGlobalLoading } from '../../contexts/GlobalLoadingContext'
import { formatDisplayName } from '../../utils/displayName'

function AuditorHome() {
  const theme = useTheme()
  const navigate = useNavigate()
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useSyncGlobalLoading(loading)

  useEffect(() => {
    let cancelled = false

    const fetchStats = async () => {
      setLoading(true)
      setError('')
      try {
        const response = await fetch(apiUrl('/api/auditor/home-stats'), {
          method: 'GET',
          credentials: 'include',
        })
        const data = await response.json()
        if (cancelled) return

        if (response.ok && data.success) {
          setStats(data.data || {})
        } else {
          setError(data.message || 'Failed to load auditor dashboard')
        }
      } catch (err) {
        console.error('Auditor home stats error:', err)
        if (!cancelled) setError('Network error while loading auditor dashboard')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchStats()

    return () => {
      cancelled = true
    }
  }, [])

  const blueTokens = theme.palette.blueTheme?.[theme.palette.mode] || {}
  const displayName = formatDisplayName(stats?.auditor_name, 'Auditor')

  const quickStats = [
    {
      label: 'Companies',
      value: stats?.total_companies ?? 0,
      accent: theme.palette.primary.main,
    },
    {
      label: 'Total Users',
      value: stats?.total_users ?? 0,
      accent: blueTokens.accent || theme.palette.info.main,
    },
    {
      label: 'RACMs',
      value: stats?.total_racms ?? 0,
      accent: theme.palette.success.main,
    },
  ]

  const snapshotRows = [
    {
      label: 'Registered Companies',
      value: stats?.total_companies ?? 0,
      color: theme.palette.primary.main,
    },
    {
      label: 'Total Users',
      value: stats?.total_users ?? 0,
      color: blueTokens.accent || theme.palette.info.main,
    },
    {
      label: 'Available RACMs',
      value: stats?.total_racms ?? 0,
      color: theme.palette.success.main,
    },
  ]

  const routeTiles = [
    {
      eyebrow: 'Registry',
      title: 'Companies',
      description: 'Review company master records, identifiers, and the unit structure mapped for audit visibility.',
      action: 'Open companies',
      icon: <BusinessRoundedIcon sx={{ fontSize: 38 }} />,
      accent: theme.palette.primary.main,
      path: '/auditor/companies',
    },
    {
      eyebrow: 'Access',
      title: 'Users',
      description: 'Inspect user accounts, roles, and company or unit mappings without changing production data.',
      action: 'Open users',
      icon: <GroupRoundedIcon sx={{ fontSize: 38 }} />,
      accent: blueTokens.accent || theme.palette.info.main,
      path: '/auditor/users',
    },
    {
      eyebrow: 'Controls',
      title: 'RACMs & Evidence',
      description: 'Browse RACMs together with linked sample files and uploaded evidence documents for review.',
      action: 'Open RACMs',
      icon: <FolderCopyRoundedIcon sx={{ fontSize: 38 }} />,
      accent: theme.palette.success.main,
      path: '/auditor/racms',
    },
  ]

  if (loading) {
    return <Box sx={{ minHeight: 'calc(100vh - 8rem)' }} />
  }

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
          <Box sx={{ minWidth: 0, maxWidth: { lg: 700 } }}>
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
                Audit workspace
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
                maxWidth: { xs: '100%', lg: 640 },
                color: theme.palette.text.secondary,
                fontSize: { xs: '0.98rem', sm: '1.03rem' },
                lineHeight: 1.7,
              }}
            >
              Review the IFC landscape with read-only access to companies, users, RACMs, and supporting evidence from one place.
            </Typography>

            <Box
              sx={{
                mt: 2.4,
                width: '100%',
                maxWidth: { xs: '100%', lg: 640 },
                display: 'flex',
                flexWrap: 'wrap',
                gap: 1,
                alignItems: 'center',
              }}
            >
              {quickStats.map((item) => (
                <Box
                  key={item.label}
                  sx={{
                    display: 'inline-flex',
                    alignItems: 'baseline',
                    gap: 0.75,
                    px: 1.15,
                    py: 0.65,
                    borderRadius: 1.5,
                    border: `1px solid ${alpha(item.accent, theme.palette.mode === 'dark' ? 0.28 : 0.18)}`,
                    backgroundColor: alpha(item.accent, theme.palette.mode === 'dark' ? 0.1 : 0.055),
                  }}
                >
                  <Typography
                    sx={{
                      fontSize: '1rem',
                      fontWeight: 900,
                      lineHeight: 1,
                      color: theme.palette.text.primary,
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {loading ? '-' : item.value}
                  </Typography>
                  <Typography sx={{ fontSize: '0.76rem', fontWeight: 800, color: theme.palette.text.secondary }}>
                    {item.label}
                  </Typography>
                </Box>
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
                  Audit Overview
                </Typography>
              </Box>
            </Box>

            <Box sx={{ display: 'grid', gap: 0.85 }}>
              {snapshotRows.map((item) => (
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

            <Box
              sx={{
                mt: 1,
                p: 1.4,
                borderRadius: 2.5,
                display: 'flex',
                gap: 1.2,
                alignItems: 'flex-start',
                border: `1px solid ${alpha(theme.palette.warning.main, theme.palette.mode === 'dark' ? 0.24 : 0.18)}`,
                backgroundColor: alpha(theme.palette.warning.main, theme.palette.mode === 'dark' ? 0.12 : 0.08),
              }}
            >
              <PolicyRoundedIcon sx={{ color: theme.palette.warning.main, fontSize: 20, mt: 0.15 }} />
              <Typography sx={{ fontSize: '0.84rem', lineHeight: 1.65, color: theme.palette.text.secondary }}>
                Auditor access is view-only. Use these sections to inspect records and supporting evidence without changing source data.
              </Typography>
            </Box>
          </Paper>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ borderRadius: 2.5 }}>
          {error}
        </Alert>
      )}

      <Box
        sx={{
          width: '100%',
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: 'repeat(3, minmax(0, 1fr))' },
          gap: 2.5,
        }}
      >
        {routeTiles.map((tile) => (
          <Paper
            key={tile.title}
            onClick={() => navigate(tile.path)}
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
    </Box>
  )
}

export default AuditorHome
