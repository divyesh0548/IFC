import React, { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { alpha, useTheme } from '@mui/material/styles'
import {
  Box,
  Button,
  Card,
  CardContent,
  Container,
  IconButton,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material'
import LightModeIcon from '@mui/icons-material/LightMode'
import DarkModeIcon from '@mui/icons-material/DarkMode'
import { useThemeMode } from '../contexts/ThemeContext'
import { clearCachedUserProfile } from '../storageKeys'

const portalContent = {
  hero: {
    title: 'Why do we need an IFC portal at first place?',
    body: [
      'Modern organizations deal with complex control environments, multiple stakeholders, and increasing regulatory scrutiny. Managing Internal Financial Controls manually leads to inefficiencies, lack of visibility, and audit risks.',
      'An IFC portal centralizes and streamlines the entire control lifecycle, making governance more structured and reliable.',
    ],
  },
  sections: [
    {
      title: 'Need for Digitalization',
      subsections: [
        {
          title: 'Eliminates Manual Dependency',
          bullets: [
            'Reduces reliance on emails, spreadsheets, and offline trackers',
            'Minimizes human errors and version control issues',
          ],
        },
        {
          title: 'Real-Time Visibility',
          bullets: [
            'Instant access to control status, testing progress, and gaps',
            'Enables management to take timely decisions',
          ],
        },
        {
          title: 'Centralized Data Repository',
          bullets: [
            'All RACMs, evidence, and approvals stored in one place',
            'Easy retrieval during audits and reviews',
          ],
        },
        {
          title: 'Standardization of Processes',
          bullets: [
            'Uniform workflows across departments and locations',
            'Consistent control execution and documentation',
          ],
        },
      ],
    },
    {
      title: 'Improved Audit Trail Management',
      subsections: [
        {
          title: 'End-to-End Traceability',
          bullets: [
            'Tracks every action: creation, modification, testing, and approval',
            'Maintains a clear history of control activities',
          ],
        },
        {
          title: 'Evidence-Based Compliance',
          bullets: [
            'Supports uploading and linking of supporting documents',
            'Ensures audit readiness at all times',
          ],
        },
        {
          title: 'Reduced Audit Effort',
          bullets: [
            'Eliminates last-minute data collection',
            'Auditors can access required information instantly',
          ],
        },
        {
          title: 'Accountability & Ownership',
          bullets: [
            'Clearly defined roles and responsibilities',
            'Easy identification of control owners and reviewers',
          ],
        },
      ],
    },
    {
      title: 'Operational Efficiency & Control Strengthening',
      subsections: [
        {
          title: 'Automated Workflows',
          bullets: [
            'Notifications, reminders, and approvals reduce delays',
            'Ensures timely completion of control activities',
          ],
        },
        {
          title: 'Risk-Based Monitoring',
          bullets: [
            'Focus on high-risk areas with better tracking',
            'Helps in proactive issue identification',
          ],
        },
        {
          title: 'Scalability',
          bullets: [
            'Supports growing business complexity and regulatory requirements',
            'Easily adaptable across entities and locations',
          ],
        },
        {
          title: 'Business Impact',
          fullWidth: true,
          bullets: [
            'Faster audits and reduced compliance costs',
            'Enhanced transparency and governance',
            'Improved decision-making through structured data',
            'Strengthened internal control environment',
          ],
        },
      ],
    },
  ],
  tagline:
    'An IFC portal transforms control management from a reactive, manual process into a proactive, transparent, and audit-ready system.',
  legalDisclaimer:
    'All services provided by [Your Company Name] are in compliance with applicable financial and regulatory standards. For more details on our privacy policy and terms of service, please visit [link to privacy policy].',
}

function Home() {
  const theme = useTheme()
  const { toggleTheme, mode } = useThemeMode()
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [userRole, setUserRole] = useState(null)
  const navigate = useNavigate()

  useEffect(() => {
    checkAuthOnHome()
  }, [])

  const checkAuthOnHome = async () => {
    try {
      const response = await fetch('http://localhost:3000/api/auth/verify', {
        method: 'GET',
        credentials: 'include',
      })
      const data = await response.json()
      if (response.ok && data.success) {
        setIsAuthenticated(true)
        setUserRole(data.user?.role || null)
      } else {
        setIsAuthenticated(false)
        setUserRole(null)
      }
    } catch (error) {
      console.error('Error verifying auth token on Home:', error)
      setIsAuthenticated(false)
      setUserRole(null)
    }
  }

  const getDashboardPath = () => {
    if (!userRole) return '/login'
    if (userRole === 'company_co') return '/company_co/home'
    if (userRole === 'approver') return '/approver/home'
    return `/${userRole}/dashboard`
  }

  const handleLogout = async () => {
    try {
      await fetch('http://localhost:3000/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      })
    } catch (error) {
      console.error('Error during logout:', error)
    } finally {
      clearCachedUserProfile()
      setIsAuthenticated(false)
      setUserRole(null)
      navigate('/', { replace: true })
    }
  }

  const navButtonSx = {
    textTransform: 'none',
    borderRadius: 999,
    px: 2.2,
    py: 0.9,
    fontWeight: 600,
  }

  const surfaceSx = {
    borderRadius: 4,
    border: '1px solid',
    borderColor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.09)' : 'rgba(15,23,42,0.08)',
    backgroundColor: alpha(theme.palette.background.paper, 0.82),
    backdropFilter: 'blur(14px)',
    boxShadow: theme.palette.mode === 'dark'
      ? '0 18px 50px rgba(0,0,0,0.28)'
      : '0 16px 40px rgba(15,23,42,0.08)',
  }

  const accent = theme.palette.mode === 'dark' ? theme.palette.primary.light : theme.palette.primary.main

  const renderBulletList = (items) => (
    <Box
      component="ul"
      sx={{
        m: 0,
        mt: 1.25,
        pl: 2.25,
        listStyleType: 'disc',
        listStylePosition: 'outside',
        '& li': {
          pl: 0.5,
          mb: 0.75,
          color: 'text.secondary',
          lineHeight: 1.75,
          fontSize: '0.9375rem',
          '&::marker': {
            color: accent,
          },
        },
      }}
    >
      {items.map((item) => (
        <Box component="li" key={item}>
          {item}
        </Box>
      ))}
    </Box>
  )

  return (
    <Box
      sx={{
        minHeight: '100vh',
        background: theme.palette.mode === 'dark'
          ? 'radial-gradient(circle at top left, rgba(56,189,248,0.14), transparent 28%), radial-gradient(circle at top right, rgba(250,204,21,0.12), transparent 24%), linear-gradient(180deg, #0b1220 0%, #101827 100%)'
          : 'radial-gradient(circle at top left, rgba(15,118,110,0.12), transparent 26%), radial-gradient(circle at top right, rgba(217,119,6,0.12), transparent 22%), linear-gradient(180deg, #f7f8f4 0%, #eef2e7 100%)',
        '@keyframes riseIn': {
          '0%': { opacity: 0, transform: 'translateY(18px)' },
          '100%': { opacity: 1, transform: 'translateY(0)' },
        },
      }}
    >
      <Box
        sx={{
          position: 'sticky',
          top: 0,
          zIndex: 10,
          borderBottom: '1px solid',
          borderColor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.08)',
          backgroundColor: alpha(theme.palette.background.paper, 0.72),
          backdropFilter: 'blur(18px)',
        }}
      >
        <Container maxWidth="xl">
          <Box sx={{ minHeight: 74, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2, py: 1.25 }}>
            <Box>
              <Typography sx={{ fontWeight: 800, fontSize: '1.05rem', letterSpacing: '-0.02em' }}>
                Internal Financial Controls
              </Typography>
              <Typography sx={{ color: 'text.secondary', fontSize: '0.82rem' }}>
                Structured control assurance and audit workflow
              </Typography>
            </Box>
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              {isAuthenticated ? (
                <>
                  <Button variant="contained" color="secondary" onClick={() => navigate(getDashboardPath())} sx={navButtonSx}>
                    Go to Dashboard
                  </Button>
                  <Button variant="outlined" color="inherit" onClick={handleLogout} sx={navButtonSx}>
                    Logout
                  </Button>
                </>
              ) : (
                <Button component={Link} to="/login" variant="contained" color="secondary" sx={navButtonSx}>
                  Login
                </Button>
              )}
              <Tooltip title={mode === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'} arrow>
                <IconButton onClick={toggleTheme} sx={{ border: '1px solid', borderColor: 'divider', backgroundColor: alpha(theme.palette.background.paper, 0.55) }}>
                  {mode === 'light' ? <DarkModeIcon /> : <LightModeIcon />}
                </IconButton>
              </Tooltip>
            </Stack>
          </Box>
        </Container>
      </Box>

      <Container maxWidth="xl" sx={{ py: { xs: 4, md: 6 } }}>
        <Stack spacing={3} sx={{ animation: 'riseIn 700ms ease-out' }}>
          <Card sx={{ ...surfaceSx, minWidth: 0 }}>
            <CardContent sx={{ p: { xs: 3, md: 5 } }}>
              <Box sx={{ width: '100%' }}>
                <Typography
                  component="h1"
                  sx={{
                    fontSize: { xs: '1.85rem', sm: '2.25rem', md: '2.65rem' },
                    lineHeight: 1.12,
                    fontWeight: 800,
                    letterSpacing: '-0.03em',
                    mb: 3,
                    textAlign: 'left',
                  }}
                >
                  {portalContent.hero.title}
                </Typography>
                <Stack spacing={2.25} sx={{ width: '100%' }}>
                  {portalContent.hero.body.map((paragraph) => (
                    <Typography
                      key={paragraph.slice(0, 48)}
                      sx={{
                        color: 'text.secondary',
                        fontSize: { xs: '1rem', md: '1.05rem' },
                        lineHeight: 1.85,
                        width: '100%',
                      }}
                    >
                      {paragraph}
                    </Typography>
                  ))}
                </Stack>
              </Box>
            </CardContent>
          </Card>

          {portalContent.sections.map((section) => (
            <Card key={section.title} sx={surfaceSx}>
              <CardContent sx={{ p: { xs: 2.5, md: 3.5 } }}>
                <Typography
                  component="h2"
                  sx={{
                    fontSize: '1.35rem',
                    fontWeight: 800,
                    mb: 3,
                    letterSpacing: '-0.02em',
                    pb: 1.5,
                    borderBottom: '1px solid',
                    borderColor: 'divider',
                  }}
                >
                  {section.title}
                </Typography>
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' },
                    columnGap: { md: 3 },
                    rowGap: { xs: 2.5, md: 3 },
                  }}
                >
                  {section.subsections.map((sub) => (
                    <Box
                      key={sub.title}
                      sx={{
                        gridColumn: sub.fullWidth ? { xs: '1 / -1', md: '1 / -1' } : undefined,
                        minWidth: 0,
                      }}
                    >
                      <Typography
                        sx={{
                          fontWeight: 700,
                          fontSize: '0.9rem',
                          letterSpacing: '0.06em',
                          textTransform: 'uppercase',
                          color: 'text.primary',
                          lineHeight: 1.35,
                          mb: 0.25,
                        }}
                      >
                        {sub.title}
                      </Typography>
                      {renderBulletList(sub.bullets)}
                    </Box>
                  ))}
                </Box>
              </CardContent>
            </Card>
          ))}

          <Box
            sx={{
              position: 'relative',
              py: { xs: 3, md: 4 },
              px: { xs: 2, md: 5 },
              textAlign: 'center',
              borderRadius: 4,
              border: '1px solid',
              borderColor: alpha(accent, 0.35),
              background: alpha(accent, theme.palette.mode === 'dark' ? 0.08 : 0.06),
              '&::before': {
                content: '""',
                position: 'absolute',
                top: 0,
                left: '50%',
                transform: 'translateX(-50%)',
                width: 64,
                height: 4,
                borderRadius: '0 0 4px 4px',
                bgcolor: accent,
              },
            }}
          >
            <Typography
              sx={{
                fontSize: { xs: '1.125rem', md: '1.35rem' },
                lineHeight: 1.65,
                fontWeight: 600,
                fontStyle: 'italic',
                color: 'text.primary',
                maxWidth: 'min(100%, 760px)',
                mx: 'auto',
              }}
            >
              {portalContent.tagline}
            </Typography>
          </Box>

          <Card sx={surfaceSx}>
            <CardContent sx={{ p: { xs: 2.5, md: 3.5 } }}>
              <Typography sx={{ fontSize: '1.05rem', fontWeight: 800, mb: 1.5 }}>Legal disclaimer</Typography>
              <Typography sx={{ color: 'text.secondary', lineHeight: 1.85, fontSize: '0.9375rem' }}>
                {portalContent.legalDisclaimer}
              </Typography>
            </CardContent>
          </Card>
        </Stack>
      </Container>
    </Box>
  )
}

export default Home
