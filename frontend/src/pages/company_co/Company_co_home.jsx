import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { alpha, useTheme } from '@mui/material/styles'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Paper from '@mui/material/Paper'
import PeopleAltRoundedIcon from '@mui/icons-material/PeopleAltRounded'
import AccountBalanceRoundedIcon from '@mui/icons-material/AccountBalanceRounded'
import FactCheckRoundedIcon from '@mui/icons-material/FactCheckRounded'
import UploadFileRoundedIcon from '@mui/icons-material/UploadFileRounded'
import AssignmentTurnedInRoundedIcon from '@mui/icons-material/AssignmentTurnedInRounded'
import AssessmentRoundedIcon from '@mui/icons-material/AssessmentRounded'
import MarkEmailReadRoundedIcon from '@mui/icons-material/MarkEmailReadRounded'
import TableViewRoundedIcon from '@mui/icons-material/TableViewRounded'
import ArrowOutwardRoundedIcon from '@mui/icons-material/ArrowOutwardRounded'
import { apiUrl } from '../../config/api'
import DashboardGreeting from '../../components/DashboardGreeting'
import HomeHelpSupport from '../../components/help/HomeHelpSupport'
import { readStoredUserDisplayName, writeStoredUserDisplayName } from '../../storageKeys'

function formatCoordinatorName(empName, emailId) {
  const trimmedName = String(empName || '').trim()
  if (trimmedName && !trimmedName.includes('@')) return trimmedName

  const sourceEmail = trimmedName.includes('@') ? trimmedName : String(emailId || '').trim()
  const localPart = sourceEmail.split('@')[0] || ''
  const words = localPart
    .split('.')
    .map((segment) => String(segment || '').replace(/[0-9]/g, '').trim())
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1).toLowerCase())

  return words.join(' ').trim() || 'User'
}

function Company_co_home() {
  const theme = useTheme()
  const navigate = useNavigate()
  const [username, setUsername] = useState(() => readStoredUserDisplayName())
  const [coordinatorUnits, setCoordinatorUnits] = useState([])
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalRacms: 0,
    approvedRacms: 0,
    rejectedRacms: 0,
  })
  const sharedTileAccent = theme.palette.primary.main
  const blueTokens = theme.palette.blueTheme?.[theme.palette.mode] || {}

  const tiles = [
    {
      eyebrow: 'Company',
      title: 'Company Details',
      description: 'Review the registered company profile, identifiers, and unit master.',
      path: '/company_co/company-details',
      icon: <AccountBalanceRoundedIcon sx={{ fontSize: 38 }} />,
      accent: sharedTileAccent,
    },
    {
      eyebrow: 'User',
      title: 'User Management',
      description: 'Create users and see available approvers',
      path: '/company_co/user-management',
      icon: <PeopleAltRoundedIcon sx={{ fontSize: 38 }} />,
      accent: sharedTileAccent,
    },
    {
      eyebrow: 'Communication',
      title: 'RACM Communication',
      description: 'Manage common and process-specific communication contacts for RACM workflows.',
      path: '/company_co/racm-communication',
      icon: <MarkEmailReadRoundedIcon sx={{ fontSize: 38 }} />,
      accent: sharedTileAccent,
    },
    {
      eyebrow: 'Template',
      title: 'RACM Templates',
      description: 'Review unit templates, sections, and add new template columns with versioned changes.',
      path: '/company_co/racm-templates',
      icon: <TableViewRoundedIcon sx={{ fontSize: 38 }} />,
      accent: sharedTileAccent,
    },
    {
      eyebrow: 'Bulk Upload',
      title: 'RACM Upload/Create',
      description: 'Upload RACMs in bulk or open the manual RACM creation flow for individual entries.',
      path: '/company_co/control-creation',
      icon: <UploadFileRoundedIcon sx={{ fontSize: 38 }} />,
      accent: sharedTileAccent,
    },
    {
      eyebrow: 'Management',
      title: 'RACM Management',
      description: 'Monitor RACM lifecycle, updates, and activation readiness.',
      path: '/company_co/racm-management',
      icon: <FactCheckRoundedIcon sx={{ fontSize: 38 }} />,
      accent: sharedTileAccent,
    },
    {
      eyebrow: 'Assignment',
      title: 'RACM Assignment Management',
      description: 'Assign RACMs to process owners and manage assignment status.',
      path: '/company_co/racm-assignment',
      icon: <AssignmentTurnedInRoundedIcon sx={{ fontSize: 38 }} />,
      accent: sharedTileAccent,
    },
    {
      eyebrow: 'Insights',
      title: 'Reports',
      description: 'Review RACM outcomes, progress trends, and approval summaries.',
      path: '/company_co/racm-dashboard',
      icon: <AssessmentRoundedIcon sx={{ fontSize: 38 }} />,
      accent: sharedTileAccent,
    },
  ]

  useEffect(() => {
    const fetchHomeData = async () => {
      try {
        const response = await fetch(apiUrl('/api/company-co/home-stats'), {
          credentials: 'include',
        })
        const result = await response.json()

        if (!response.ok || !result?.success) {
          throw new Error(result?.message || 'Failed to fetch company coordinator home stats')
        }

        const homeStats = result.data || {}
        const nextDisplayName = formatCoordinatorName(homeStats.coordinatorName, homeStats.coordinatorEmail)
        setUsername(nextDisplayName)
        writeStoredUserDisplayName(nextDisplayName, 'User')
        setCoordinatorUnits(Array.isArray(homeStats.coordinatorUnits) ? homeStats.coordinatorUnits : [])

        setStats({
          totalUsers: Number(homeStats.totalUsers || 0),
          totalRacms: Number(homeStats.totalRacms || 0),
          approvedRacms: Number(homeStats.approvedRacms || 0),
          rejectedRacms: Number(homeStats.rejectedRacms || 0),
        })
      } catch (error) {
        console.error('Failed to fetch company coordinator home data:', error)
        setUsername(readStoredUserDisplayName() || 'User')
        setCoordinatorUnits([])
        setStats({
          totalUsers: 0,
          totalRacms: 0,
          approvedRacms: 0,
          rejectedRacms: 0,
        })
      }
    }

    fetchHomeData()
  }, [])

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
          boxShadow: theme.palette.mode === 'dark'
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
            background: `radial-gradient(circle, ${alpha(blueTokens.accent || theme.palette.primary.light, 0.16)} 0%, transparent 70%)`,
          }}
        />
        <Box
          sx={{
            position: 'relative',
            p: { xs: 2.5, sm: 3.5, md: 4 },
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1.5fr) minmax(280px, 0.9fr)' },
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
                Coordinator workspace
              </Typography>
            </Box>
            <DashboardGreeting
              displayName={username || 'User'}
              primarySx={{
                fontSize: { xs: '1.85rem', sm: '2.3rem', md: '2.6rem' },
                fontWeight: 900,
                color: theme.palette.text.primary,
                lineHeight: 1.08,
                letterSpacing: '-0.03em',
                maxWidth: '100%',
                width: '100%',
              }}
            />
            <Typography
              sx={{
                mt: 1.4,
                maxWidth: { xs: '100%', lg: 700 },
                color: theme.palette.text.secondary,
                fontSize: { xs: '0.98rem', sm: '1.02rem' },
                lineHeight: 1.7,
              }}
            >
              Manage the IFC cycle from one place with direct access to users, RACMs, assignments, uploads, and reporting.
            </Typography>
            {coordinatorUnits.length > 0 ? (
              <Box
                sx={{
                  mt: 1.5,
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 0.75,
                  alignItems: 'center',
                }}
              >
                <Typography
                  sx={{
                    fontSize: '0.82rem',
                    fontWeight: 700,
                    color: theme.palette.text.secondary,
                  }}
                >
                  Units:
                </Typography>
                {coordinatorUnits.map((unit) => (
                  <Box
                    key={unit.unit_id || unit.unit_name}
                    sx={{
                      px: 1.15,
                      py: 0.45,
                      borderRadius: 999,
                      border: '1px solid',
                      borderColor: alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.28 : 0.16),
                      backgroundColor: alpha(theme.palette.background.paper, theme.palette.mode === 'dark' ? 0.14 : 0.6),
                    }}
                  >
                    <Typography
                      sx={{
                        fontSize: '0.78rem',
                        fontWeight: 600,
                        color: theme.palette.text.primary,
                        lineHeight: 1.2,
                      }}
                    >
                      {unit.unit_name || unit.unit_id}
                    </Typography>
                  </Box>
                ))}
              </Box>
            ) : null}
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
              justifyContent: 'space-between',
              gap: 2,
              minHeight: '100%',
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
                <AssessmentRoundedIcon sx={{ fontSize: 22 }} />
              </Box>
              <Box>
                <Typography sx={{ fontSize: '0.84rem', fontWeight: 700, color: theme.palette.text.secondary }}>
                  Snapshot
                </Typography>
                <Typography sx={{ fontSize: '1.05rem', fontWeight: 800, color: theme.palette.text.primary }}>
                  Company Statistics
                </Typography>
              </Box>
            </Box>

            <Box sx={{ display: 'grid', gap: 1.4 }}>
              {[
                { label: 'Total Users', value: stats.totalUsers, color: theme.palette.primary.main },
                {
                  label: 'Total RACMs',
                  value: stats.totalRacms,
                  color: blueTokens.accent || theme.palette.primary.light,
                },
                { label: 'Approved RACMs', value: stats.approvedRacms, color: theme.palette.success.main },
              ].map((item) => (
                <Box
                  key={item.label}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 2,
                    py: 1.1,
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
                    {item.value}
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
        {tiles.map((tile) => (
          <Paper
            key={tile.title}
            onClick={() => navigate(tile.path)}
            elevation={0}
            sx={{
              p: 0,
              width: '100%',
              minHeight: 158,
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
              boxShadow: theme.palette.mode === 'dark'
                ? '0 10px 24px rgba(0, 0, 0, 0.18)'
                : '0 10px 24px rgba(15, 23, 42, 0.05)',
              '&:hover': {
                borderColor: alpha(tile.accent, 0.5),
                boxShadow: theme.palette.mode === 'dark'
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
                minHeight: 158,
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
                  Open module
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

export default Company_co_home
