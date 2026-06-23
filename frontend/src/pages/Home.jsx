import React, { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { alpha, useTheme } from '@mui/material/styles'
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  Grid,
  IconButton,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material'
import LightModeIcon from '@mui/icons-material/LightMode'
import DarkModeIcon from '@mui/icons-material/DarkMode'
import ShieldOutlinedIcon from '@mui/icons-material/ShieldOutlined'
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined'
import SyncAltOutlinedIcon from '@mui/icons-material/SyncAltOutlined'
import CheckCircleOutlineRoundedIcon from '@mui/icons-material/CheckCircleOutlineRounded'
import { useThemeMode } from '../contexts/ThemeContext'
import { clearCachedUserProfile, clearStoredUserDisplayName } from '../storageKeys'
import { MAIN_CONTENT_MAX_WIDTH } from '../uiConstants'
import { apiUrl } from '../config/api'

const portalContent = {
  hero: {
    eyebrow: 'Internal Financial Controls Portal',
    title: 'A clearer control workflow for teams, coordinators, and approvers.',
    body: [
      'Modern organizations deal with complex control environments, multiple stakeholders, and increasing regulatory scrutiny. Managing Internal Financial Controls manually leads to inefficiencies, weak visibility, and avoidable audit risk.',
      'This portal centralizes RACM activity, evidence, review decisions, and accountability into one structured operating surface.',
    ],
  },
  highlights: [
    {
      value: '1',
      label: 'central source',
      description: 'RACMs, evidence, approvals, and history stay in a single governed workspace.',
      icon: ShieldOutlinedIcon,
    },
    {
      value: '24/7',
      label: 'live visibility',
      description: 'Stakeholders can track status, pending actions, and gaps without chasing updates.',
      icon: VisibilityOutlinedIcon,
    },
    {
      value: 'End-to-end',
      label: 'traceability',
      description: 'Every update, decision, and supporting input stays linked to the form lifecycle.',
      icon: SyncAltOutlinedIcon,
    },
  ],
  sections: [
    {
      title: 'Need for Digitalization',
      intro:
        'The portal removes fragmented manual coordination and replaces it with a consistent operating flow.',
      subsections: [
        {
          title: 'Eliminates Manual Dependency',
          bullets: [
            'Reduces reliance on emails, spreadsheets, and offline trackers.',
            'Minimizes human errors and version-control confusion.',
          ],
        },
        {
          title: 'Real-Time Visibility',
          bullets: [
            'Instant access to control status, testing progress, and gaps.',
            'Enables management to take timely decisions.',
          ],
        },
        {
          title: 'Centralized Data Repository',
          bullets: [
            'All RACMs, evidence, and approvals stored in one place.',
            'Easy retrieval during audits and reviews.',
          ],
        },
        {
          title: 'Standardization of Processes',
          bullets: [
            'Uniform workflows across departments and locations.',
            'Consistent control execution and documentation.',
          ],
        },
      ],
    },
    {
      title: 'Improved Audit Trail Management',
      intro:
        'Audit readiness improves when the underlying workflow records decisions and supporting evidence by default.',
      subsections: [
        {
          title: 'End-to-End Traceability',
          bullets: [
            'Tracks every action from creation to approval.',
            'Maintains a clear history of control activity.',
          ],
        },
        {
          title: 'Evidence-Based Compliance',
          bullets: [
            'Supports uploading and linking of supporting documents.',
            'Keeps records audit-ready throughout the year.',
          ],
        },
        {
          title: 'Reduced Audit Effort',
          bullets: [
            'Eliminates last-minute data collection.',
            'Auditors can access required information faster.',
          ],
        },
        {
          title: 'Accountability and Ownership',
          bullets: [
            'Defines roles and responsibilities clearly.',
            'Makes owners and reviewers easy to identify.',
          ],
        },
      ],
    },
    {
      title: 'Operational Efficiency and Control Strengthening',
      intro:
        'A stronger control environment comes from timely movement, clearer priorities, and repeatable execution.',
      subsections: [
        {
          title: 'Automated Workflows',
          bullets: [
            'Notifications, reminders, and approvals reduce delays.',
            'Supports timely completion of control activities.',
          ],
        },
        {
          title: 'Risk-Based Monitoring',
          bullets: [
            'Keeps focus on high-risk areas with better tracking.',
            'Helps teams identify issues earlier.',
          ],
        },
        {
          title: 'Scalability',
          bullets: [
            'Supports growing business complexity and regulatory requirements.',
            'Adapts across entities and locations.',
          ],
        },
        {
          title: 'Business Impact',
          bullets: [
            'Faster audits and reduced compliance effort.',
            'Enhanced transparency and governance.',
            'Improved decision-making through structured data.',
            'A stronger internal control environment.',
          ],
        },
      ],
    },
  ],
  closing:
    'An IFC portal shifts control management from reactive follow-up to a proactive, transparent, and audit-ready operating model.',
  legalDisclaimer:
    'All services provided by [Your Company Name] are in compliance with applicable financial and regulatory standards. For more details on our privacy policy and terms of service, please visit [link to privacy policy].',
}

function Home() {
  const theme = useTheme()
  const { toggleTheme, mode } = useThemeMode()
  const [authStatus, setAuthStatus] = useState('checking')
  const [userRole, setUserRole] = useState(null)
  const navigate = useNavigate()

  useEffect(() => {
    let cancelled = false

    const checkAuthOnHome = async () => {
      try {
        const response = await fetch(apiUrl('/api/auth/verify'), {
          method: 'GET',
          credentials: 'include',
        })
        const data = await response.json()

        if (cancelled) return

        if (response.ok && data.success) {
          setAuthStatus('authenticated')
          setUserRole(data.user?.role || null)
        } else {
          setAuthStatus('unauthenticated')
          setUserRole(null)
        }
      } catch (error) {
        if (!cancelled) {
          console.error('Error verifying auth token on Home:', error)
          setAuthStatus('unauthenticated')
          setUserRole(null)
        }
      }
    }

    checkAuthOnHome()

    return () => {
      cancelled = true
    }
  }, [])

  const getDashboardPath = () => {
    if (!userRole) return '/login'
    if (userRole === 'user') return '/user/home'
    if (userRole === 'company_co') return '/company_co/home'
    if (userRole === 'approver') return '/approver/home'
    return `/${userRole}/dashboard`
  }

  const handleLogout = async () => {
    try {
      await fetch(apiUrl('/api/auth/logout'), {
        method: 'POST',
        credentials: 'include',
      })
    } catch (error) {
      console.error('Error during logout:', error)
    } finally {
      clearCachedUserProfile()
      clearStoredUserDisplayName()
      setAuthStatus('unauthenticated')
      setUserRole(null)
      navigate('/', { replace: true })
    }
  }

  const isAuthResolved = authStatus !== 'checking'
  const isAuthenticated = authStatus === 'authenticated'

  const navButtonSx = {
    textTransform: 'none',
    borderRadius: 999,
    px: 2.25,
    py: 0.95,
    fontWeight: 700,
  }

  const pageShellSx = {
    minHeight: '100vh',
    background:
      theme.palette.mode === 'dark'
        ? `
          radial-gradient(circle at 0% 0%, rgba(56, 189, 248, 0.14), transparent 24%),
          radial-gradient(circle at 100% 10%, rgba(14, 165, 233, 0.14), transparent 28%),
          radial-gradient(circle at 50% 100%, rgba(34, 197, 94, 0.10), transparent 28%),
          linear-gradient(180deg, #07111e 0%, #0d1a2b 45%, #132338 100%)
        `
        : `
          radial-gradient(circle at 0% 0%, rgba(14, 165, 233, 0.14), transparent 24%),
          radial-gradient(circle at 100% 12%, rgba(8, 145, 178, 0.14), transparent 30%),
          radial-gradient(circle at 45% 100%, rgba(132, 204, 22, 0.10), transparent 30%),
          linear-gradient(180deg, #f4f8fb 0%, #edf3f4 45%, #e7efeb 100%)
        `,
    '@keyframes homeFadeUp': {
      '0%': { opacity: 0, transform: 'translateY(22px)' },
      '100%': { opacity: 1, transform: 'translateY(0)' },
    },
  }

  const shellInnerSx = {
    width: '100%',
    maxWidth: MAIN_CONTENT_MAX_WIDTH,
    mx: 'auto',
    px: { xs: 2, sm: 3, md: 4.5, lg: 5 },
  }

  const panelSx = {
    borderRadius: 6,
    border: '1px solid',
    borderColor: alpha(theme.palette.text.primary, theme.palette.mode === 'dark' ? 0.1 : 0.08),
    backgroundColor: alpha(theme.palette.background.paper, theme.palette.mode === 'dark' ? 0.72 : 0.84),
    backdropFilter: 'blur(18px)',
    boxShadow:
      theme.palette.mode === 'dark'
        ? '0 24px 60px rgba(0, 0, 0, 0.28)'
        : '0 24px 60px rgba(15, 23, 42, 0.08)',
  }

  const sectionCardPaddingSx = { xs: 3, sm: 3.5, md: 4.25 }

  const bulletListSx = {
    m: 0,
    pl: 2.5,
    '& li': {
      color: 'text.secondary',
      lineHeight: 1.75,
      marginBottom: 0.8,
      paddingLeft: 0.35,
    },
    '& li::marker': {
      color: theme.palette.primary.main,
    },
  }

  const heroHighlightCardSx = {
    width: '100%',
    minHeight: 116,
    p: 2.25,
    borderRadius: 4,
    border: '1px solid',
    borderColor: alpha(theme.palette.text.primary, 0.1),
    backgroundColor: alpha(theme.palette.background.paper, theme.palette.mode === 'dark' ? 0.08 : 0.55),
    boxSizing: 'border-box',
    display: 'flex',
    alignItems: 'stretch',
  }

  const subsectionCardSx = {
    width: '100%',
    height: '100%',
    p: 2.5,
    borderRadius: 4,
    border: '1px solid',
    borderColor: alpha(theme.palette.text.primary, theme.palette.mode === 'dark' ? 0.1 : 0.07),
    backgroundColor: alpha(theme.palette.background.paper, theme.palette.mode === 'dark' ? 0.08 : 0.58),
    boxSizing: 'border-box',
  }

  return (
    <Box sx={pageShellSx}>
      <Box
        sx={{
          position: 'sticky',
          top: 0,
          zIndex: 20,
          borderBottom: '1px solid',
          borderColor: alpha(theme.palette.text.primary, theme.palette.mode === 'dark' ? 0.1 : 0.08),
          backgroundColor: alpha(theme.palette.background.paper, theme.palette.mode === 'dark' ? 0.72 : 0.76),
          backdropFilter: 'blur(20px)',
        }}
      >
        <Box sx={{ ...shellInnerSx, py: 1.5 }}>
          <Stack
            direction={{ xs: 'column', md: 'row' }}
            spacing={2}
            sx={{ alignItems: { xs: 'flex-start', md: 'center' }, justifyContent: 'space-between' }}
          >
            <Box>
              <Typography sx={{ fontWeight: 800, letterSpacing: '-0.03em', fontSize: { xs: '1rem', md: '1.05rem' } }}>
                Internal Financial Controls
              </Typography>
              <Typography sx={{ color: 'text.secondary', fontSize: '0.86rem', mt: 0.25 }}>
                Structured governance, evidence tracking, and approval workflow
              </Typography>
            </Box>

            <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
              {isAuthResolved && (isAuthenticated ? (
                <>
                  <Button variant="contained" color="primary" onClick={() => navigate(getDashboardPath())} sx={navButtonSx}>
                    Go to Dashboard
                  </Button>
                  <Button variant="outlined" color="primary" onClick={handleLogout} sx={navButtonSx}>
                    Logout
                  </Button>
                </>
              ) : (
                <Button component={Link} to="/login" variant="contained" color="primary" sx={navButtonSx}>
                  Login
                </Button>
              ))}
              <Tooltip title={mode === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'} arrow>
                <IconButton
                  onClick={toggleTheme}
                  sx={{
                    border: '1px solid',
                    borderColor: alpha(theme.palette.text.primary, 0.12),
                    backgroundColor: alpha(theme.palette.background.paper, 0.55),
                  }}
                >
                  {mode === 'light' ? <DarkModeIcon /> : <LightModeIcon />}
                </IconButton>
              </Tooltip>
            </Stack>
          </Stack>
        </Box>
      </Box>

      <Box sx={{ ...shellInnerSx, py: { xs: 4, sm: 5, md: 6.5 } }}>
        <Stack spacing={{ xs: 3, md: 4 }} sx={{ animation: 'homeFadeUp 720ms ease-out' }}>
          <Card sx={{ ...panelSx, overflow: 'hidden' }}>
            <CardContent sx={{ p: sectionCardPaddingSx }}>
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1fr) minmax(0, 1fr)' },
                  alignItems: 'stretch',
                  gap: { xs: 3, md: 4 },
                }}
              >
                <Box
                  sx={{
                    minWidth: 0,
                    display: 'flex',
                  }}
                >
                  <Stack spacing={2.5} sx={{ width: '100%', justifyContent: 'center' }}>
                    <Chip
                      label={portalContent.hero.eyebrow}
                      sx={{
                        alignSelf: 'flex-start',
                        height: 34,
                        borderRadius: 999,
                        backgroundColor: alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.22 : 0.12),
                        color: theme.palette.text.primary,
                        fontWeight: 700,
                        letterSpacing: '0.02em',
                      }}
                    />
                    <Typography
                      component="h1"
                      sx={{
                        fontFamily: '"Aldrich", sans-serif',
                        fontSize: { xs: '2.3rem', sm: '2.9rem', md: '3.6rem' },
                        lineHeight: 1.02,
                        letterSpacing: '-0.04em',
                        maxWidth: '16ch',
                      }}
                    >
                      {portalContent.hero.title}
                    </Typography>
                    <Stack spacing={1.5}>
                      {portalContent.hero.body.map((paragraph) => (
                        <Typography
                          key={paragraph.slice(0, 40)}
                          sx={{
                            color: 'text.secondary',
                            fontSize: { xs: '1rem', md: '1.05rem' },
                            lineHeight: 1.85,
                          }}
                        >
                          {paragraph}
                        </Typography>
                      ))}
                    </Stack>
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ pt: 1 }}>
                      {isAuthResolved && (isAuthenticated ? (
                        <Button variant="contained" color="primary" onClick={() => navigate(getDashboardPath())} sx={{ ...navButtonSx, px: 3 }}>
                          Open workspace
                        </Button>
                      ) : (
                        <Button component={Link} to="/login" variant="contained" color="primary" sx={{ ...navButtonSx, px: 3 }}>
                          Access portal
                        </Button>
                      ))}
                      <Button
                        variant="outlined"
                        color="primary"
                        sx={{ ...navButtonSx, px: 3 }}
                        onClick={() => {
                          const target = document.getElementById('ifc-value-sections')
                          if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' })
                        }}
                      >
                        Explore benefits
                      </Button>
                    </Stack>
                  </Stack>
                </Box>

                <Box
                  sx={{
                    minWidth: 0,
                    display: 'flex',
                  }}
                >
                  <Box
                    sx={{
                      height: '100%',
                      minHeight: { xs: 320, md: 360 },
                      display: 'flex',
                      flexDirection: 'column',
                      borderRadius: 5,
                      width: '100%',
                      p: { xs: 3, md: 3.5 },
                      position: 'relative',
                      overflow: 'hidden',
                      boxSizing: 'border-box',
                      background:
                        theme.palette.mode === 'dark'
                          ? 'linear-gradient(160deg, rgba(10,25,47,0.94) 0%, rgba(13,35,63,0.9) 52%, rgba(8,20,36,0.96) 100%)'
                          : 'linear-gradient(160deg, rgba(255,255,255,0.92) 0%, rgba(231,244,244,0.96) 55%, rgba(224,238,236,0.98) 100%)',
                      border: '1px solid',
                      borderColor: alpha(theme.palette.primary.main, 0.18),
                    }}
                  >
                    <Box
                      sx={{
                        position: 'absolute',
                        width: 220,
                        height: 220,
                        borderRadius: '50%',
                        top: -70,
                        right: -60,
                        backgroundColor: alpha(theme.palette.primary.main, 0.16),
                        filter: 'blur(10px)',
                      }}
                    />
                    <Box
                      sx={{
                        position: 'absolute',
                        width: 180,
                        height: 180,
                        borderRadius: '50%',
                        bottom: -70,
                        left: -40,
                        backgroundColor: alpha(theme.palette.secondary.main, 0.22),
                        filter: 'blur(10px)',
                      }}
                    />
                    <Stack
                      spacing={2.2}
                      sx={{
                        position: 'relative',
                        zIndex: 1,
                        height: '100%',
                        justifyContent: 'space-between',
                      }}
                    >
                      <Box>
                        <Typography sx={{ color: 'text.secondary', fontSize: '0.82rem', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                          What this portal improves
                        </Typography>
                        <Typography sx={{ fontWeight: 800, fontSize: { xs: '1.3rem', md: '1.55rem' }, mt: 1 }}>
                          Better control operations with less manual follow-up
                        </Typography>
                      </Box>

                      <Stack spacing={1.5} sx={{ width: '100%' }}>
                        {portalContent.highlights.map((item) => {
                          const Icon = item.icon
                          return (
                            <Box key={item.label} sx={heroHighlightCardSx}>
                              <Stack direction="row" spacing={1.5} sx={{ alignItems: 'flex-start' }}>
                                <Box
                                  sx={{
                                    width: 42,
                                    height: 42,
                                    borderRadius: 3,
                                    display: 'grid',
                                    placeItems: 'center',
                                    backgroundColor: alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.22 : 0.12),
                                    color: theme.palette.primary.main,
                                    flexShrink: 0,
                                  }}
                                >
                                  <Icon fontSize="small" />
                                </Box>
                                <Box>
                                  <Typography sx={{ fontWeight: 800, fontSize: '1.05rem', lineHeight: 1.2 }}>
                                    {item.value}{' '}
                                    <Box component="span" sx={{ fontWeight: 700, color: 'text.secondary', fontSize: '0.88rem' }}>
                                      {item.label}
                                    </Box>
                                  </Typography>
                                  <Typography sx={{ color: 'text.secondary', mt: 0.5, lineHeight: 1.7, fontSize: '0.92rem' }}>
                                    {item.description}
                                  </Typography>
                                </Box>
                              </Stack>
                            </Box>
                          )
                        })}
                      </Stack>
                    </Stack>
                  </Box>
                </Box>
              </Box>
            </CardContent>
          </Card>

          <Stack id="ifc-value-sections" spacing={{ xs: 3, md: 3.5 }}>
            {portalContent.sections.map((section) => (
              <Card key={section.title} sx={{ ...panelSx, overflow: 'hidden' }}>
                <CardContent sx={{ p: sectionCardPaddingSx }}>
                  <Grid container spacing={{ xs: 3, md: 4 }} alignItems="stretch">
                    <Grid item xs={12} lg={4}>
                      <Stack
                        spacing={2}
                        sx={{
                          height: '100%',
                          justifyContent: 'center',
                          pr: { lg: 1 },
                        }}
                      >
                        <Typography sx={{ fontWeight: 800, fontSize: { xs: '1.55rem', md: '1.9rem' }, lineHeight: 1.15 }}>
                          {section.title}
                        </Typography>
                        <Typography sx={{ color: 'text.secondary', lineHeight: 1.8 }}>{section.intro}</Typography>
                      </Stack>
                    </Grid>

                    <Grid item xs={12} lg={8}>
                      <Grid container spacing={2.25} alignItems="stretch">
                        {section.subsections.map((sub) => (
                          <Grid item xs={12} md={6} key={sub.title} sx={{ display: 'flex' }}>
                            <Box sx={subsectionCardSx}>
                              <Stack spacing={1.25}>
                                <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                                  <CheckCircleOutlineRoundedIcon sx={{ fontSize: 18, color: theme.palette.primary.main }} />
                                  <Typography sx={{ fontWeight: 700, lineHeight: 1.35 }}>{sub.title}</Typography>
                                </Stack>
                                <Box component="ul" sx={bulletListSx}>
                                  {sub.bullets.map((bullet) => (
                                    <Box component="li" key={bullet}>
                                      {bullet}
                                    </Box>
                                  ))}
                                </Box>
                              </Stack>
                            </Box>
                          </Grid>
                        ))}
                      </Grid>
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>
            ))}
          </Stack>

          <Card
            sx={{
              ...panelSx,
              background:
                theme.palette.mode === 'dark'
                  ? `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.22)} 0%, ${alpha(theme.palette.background.paper, 0.72)} 100%)`
                  : `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.12)} 0%, ${alpha(theme.palette.background.paper, 0.9)} 100%)`,
            }}
          >
            <CardContent sx={{ p: sectionCardPaddingSx }}>
              <Stack spacing={2} sx={{ textAlign: 'center', alignItems: 'center' }}>
                <Typography sx={{ fontWeight: 800, fontSize: { xs: '1.4rem', md: '1.8rem' }, maxWidth: 900, lineHeight: 1.3 }}>
                  {portalContent.closing}
                </Typography>
                <Typography sx={{ color: 'text.secondary', maxWidth: 820, lineHeight: 1.8 }}>
                  Centralized workflow, audit visibility, and stronger ownership are what make the system useful in practice,
                  not just documented on paper.
                </Typography>
                {isAuthenticated ? (
                  <Button variant="contained" color="primary" onClick={() => navigate(getDashboardPath())} sx={{ ...navButtonSx, px: 3 }}>
                    Continue to dashboard
                  </Button>
                ) : null}
              </Stack>
            </CardContent>
          </Card>

          <Card sx={panelSx}>
            <CardContent sx={{ p: sectionCardPaddingSx }}>
              <Stack spacing={2}>
                <Typography sx={{ fontWeight: 800, fontSize: '1rem' }}>Legal disclaimer</Typography>
                <Divider />
                <Typography sx={{ color: 'text.secondary', lineHeight: 1.8, fontSize: '0.94rem' }}>
                  {portalContent.legalDisclaimer}
                </Typography>
              </Stack>
            </CardContent>
          </Card>
        </Stack>
      </Box>
    </Box>
  )
}

export default Home
