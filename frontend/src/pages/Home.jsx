import React, { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { alpha, useTheme } from '@mui/material/styles'
import {
  Box,
  Button,
  Card,
  CardContent,
  Container,
  Divider,
  IconButton,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material'
import LightModeIcon from '@mui/icons-material/LightMode'
import DarkModeIcon from '@mui/icons-material/DarkMode'
import BusinessIcon from '@mui/icons-material/Business'
import PeopleIcon from '@mui/icons-material/People'
import TaskAltRoundedIcon from '@mui/icons-material/TaskAltRounded'
import InsightsRoundedIcon from '@mui/icons-material/InsightsRounded'
import PhoneInTalkRoundedIcon from '@mui/icons-material/PhoneInTalkRounded'
import MailOutlineRoundedIcon from '@mui/icons-material/MailOutlineRounded'
import LocationOnOutlinedIcon from '@mui/icons-material/LocationOnOutlined'
import { useThemeMode } from '../contexts/ThemeContext'
import { clearCachedUserProfile } from '../storageKeys'

function Home() {
  const theme = useTheme()
  const { toggleTheme, mode } = useThemeMode()
  const [stats, setStats] = useState({ companies: 0, users: 0 })
  const [loading, setLoading] = useState(true)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [userRole, setUserRole] = useState(null)
  const navigate = useNavigate()

  const sections = [
    {
      title: 'What is Internal Financial Control (IFC) Audit?',
      body: [
        'An Internal Financial Control (IFC) audit is a critical process for evaluating the effectiveness of a company\'s internal controls. It helps organizations identify and assess financial risks, mitigate fraud, ensure compliance with regulations, and improve financial reporting.',
        'The audit ensures that the organization\'s financial operations are efficient, transparent, and aligned with established standards, contributing to sound financial decision-making.',
      ],
    },
    {
      title: 'Why IFC Audit Matters?',
      bullets: [
        'Minimizes Risk: Reduces the chances of financial discrepancies, fraud, and non-compliance.',
        'Improves Decision-Making: Provides accurate and timely financial data that helps in strategic planning.',
        'Boosts Confidence: Ensures transparency for stakeholders, including investors, regulators, and auditors.',
        'Ensures Compliance: Guarantees adherence to local and international financial regulations and standards, such as the Sarbanes-Oxley Act (SOX) in the US or India’s Companies Act.',
      ],
      icon: (
        <InsightsRoundedIcon
          sx={{
            color: theme.palette.mode === 'dark' ? theme.palette.primary.light : theme.palette.secondary.main,
          }}
        />
      ),
    },
    {
      title: 'Our Approach to IFC Audit',
      bullets: [
        'Risk Assessment: Identifying potential risks in your financial systems and operations.',
        'Control Evaluation: Assessing the strength and effectiveness of current internal controls, policies, and procedures.',
        'Testing & Review: Conducting tests to ensure that financial processes and controls are working as intended.',
        'Recommendations: Providing actionable insights to enhance the internal control system and reduce financial risks.',
        'Continuous Monitoring: Ensuring ongoing improvements and keeping your financial operations aligned with best practices.',
      ],
      footer:
        'Our team of expert auditors uses advanced tools and industry-standard methodologies to deliver detailed and actionable audit reports that contribute to the long-term financial stability of your business.',
      icon: (
        <TaskAltRoundedIcon
          sx={{
            color: theme.palette.mode === 'dark' ? theme.palette.primary.light : theme.palette.secondary.main,
          }}
        />
      ),
    },
    {
      title: 'Benefits of IFC Audit for Your Business',
      bullets: [
        'Enhanced Operational Efficiency: Streamlining financial processes for better performance and cost-effectiveness.',
        'Prevention of Fraud: Identifying weaknesses and implementing stronger controls to protect against fraud and mismanagement.',
        'Increased Stakeholder Trust: Strengthening your organization’s reputation and credibility among investors, regulators, and other stakeholders.',
        'Regulatory Compliance: Ensuring compliance with financial reporting standards, tax obligations, and corporate governance requirements.',
        'Strategic Financial Insights: Gaining actionable insights that can help optimize financial strategies and decision-making.',
      ],
    },
    {
      title: 'Who Needs an IFC Audit?',
      body: [
        'IFC audits are essential for businesses across various sectors, especially those listed on stock exchanges or subject to regulatory requirements. If your organization is:',
      ],
      bullets: [
        'Publicly traded or private, seeking compliance with financial regulations',
        'Experiencing significant financial growth and changes in operations',
        'Facing risks related to fraud, errors, or inefficiencies in financial processes',
        'Seeking to improve financial transparency and governance',
      ],
      footer:
        'An IFC audit is a crucial step toward improving your financial operations, ensuring compliance, and mitigating risk.',
    },
  ]

  useEffect(() => {
    fetchStats()
    checkAuthOnHome()
  }, [])

  const fetchStats = async () => {
    try {
      const response = await fetch('http://localhost:3000/api/stats', {
        method: 'GET',
        credentials: 'include',
      })
      if (!response.ok) return
      const data = await response.json()
      if (data.success && data.data) {
        setStats({ companies: data.data.companies || 0, users: data.data.users || 0 })
      }
    } catch (error) {
      console.error('Error fetching stats:', error)
    } finally {
      setLoading(false)
    }
  }

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

  const renderBullets = (items) => (
    <Stack spacing={1.2}>
      {items.map((item) => (
        <Box key={item} sx={{ display: 'flex', gap: 1.25, alignItems: 'flex-start' }}>
          <Box
            sx={{
              width: 8,
              height: 8,
              mt: '10px',
              borderRadius: '50%',
              backgroundColor: theme.palette.mode === 'dark' ? theme.palette.primary.light : theme.palette.secondary.main,
              flexShrink: 0,
            }}
          />
          <Typography sx={{ color: 'text.secondary', lineHeight: 1.8 }}>{item}</Typography>
        </Box>
      ))}
    </Stack>
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
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 7fr) minmax(0, 3fr)' },
            alignItems: 'stretch',
            gap: 3,
            animation: 'riseIn 700ms ease-out',
          }}
        >
          <Card sx={{ ...surfaceSx, minWidth: 0 }}>
            <CardContent sx={{ p: { xs: 2.5, md: 4 } }}>
              <Typography
                component="h1"
                sx={{
                  fontSize: { xs: '2.2rem', md: '3.3rem' },
                  lineHeight: 1.05,
                  fontWeight: 800,
                  letterSpacing: '-0.03em',
                  maxWidth: { xs: '16ch', lg: 'none' },
                }}
              >
                Internal Financial Control (IFC) Audit: Ensuring Robust Financial Health and Compliance
              </Typography>
              <Typography
                sx={{
                  mt: 2.5,
                  color: 'text.secondary',
                  fontSize: '1.02rem',
                  lineHeight: 1.9,
                  maxWidth: { xs: '68ch', lg: 'none' },
                }}
              >
                An Internal Financial Control (IFC) audit is a critical process for evaluating the effectiveness of a company&apos;s internal controls. It helps organizations identify and assess financial risks, mitigate fraud, ensure compliance with regulations, and improve financial reporting.
              </Typography>
            </CardContent>
          </Card>

          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: '1fr',
              gap: 2,
              minWidth: 0,
            }}
          >
            {[
              {
                title: 'Companies Registered',
                value: loading ? '...' : stats.companies,
                icon: <BusinessIcon sx={{ fontSize: 28 }} />,
                accent: theme.palette.mode === 'dark' ? '#7dd3fc' : '#0f766e',
                note: 'Organizations covered on the platform',
              },
              {
                title: 'Users Registered',
                value: loading ? '...' : stats.users,
                icon: <PeopleIcon sx={{ fontSize: 28 }} />,
                accent: theme.palette.mode === 'dark' ? '#fcd34d' : '#b45309',
                note: 'Users participating in IFC workflows',
              },
            ].map((card) => (
              <Card
                key={card.title}
                sx={{
                  ...surfaceSx,
                  overflow: 'hidden',
                  position: 'relative',
                }}
              >
                <Box
                  sx={{
                    height: 5,
                    background: `linear-gradient(90deg, ${alpha(card.accent, 0.95)} 0%, ${alpha(card.accent, 0.3)} 100%)`,
                  }}
                />
                <CardContent sx={{ p: 2.5 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                    <Box>
                      <Typography sx={{ color: 'text.secondary', fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', mb: 0.9 }}>
                        {card.title}
                      </Typography>
                      <Typography sx={{ fontSize: '2.5rem', lineHeight: 1, fontWeight: 800, color: 'text.primary' }}>
                        {card.value}
                      </Typography>
                    </Box>
                    <Box
                      sx={{
                        width: 50,
                        height: 50,
                        borderRadius: '15px',
                        display: 'grid',
                        placeItems: 'center',
                        color: card.accent,
                        backgroundColor: alpha(card.accent, 0.14),
                        border: '1px solid',
                        borderColor: alpha(card.accent, 0.22),
                        boxShadow: `inset 0 1px 0 ${alpha('#ffffff', theme.palette.mode === 'dark' ? 0.04 : 0.35)}`,
                      }}
                    >
                      {card.icon}
                    </Box>
                  </Box>
                  <Box
                    sx={{
                      p: 1.4,
                      borderRadius: 2.5,
                      backgroundColor: alpha(card.accent, 0.07),
                      border: '1px solid',
                      borderColor: alpha(card.accent, 0.12),
                    }}
                  >
                    <Typography sx={{ color: 'text.secondary', fontSize: '0.92rem', lineHeight: 1.6 }}>
                      {card.note}
                    </Typography>
                  </Box>
                </CardContent>
              </Card>
            ))}
          </Box>
        </Box>

        <Box sx={{ mt: 4, display: 'grid', gap: 3, animation: 'riseIn 1000ms ease-out' }}>
          {sections.map((section) => (
            <Card key={section.title} sx={surfaceSx}>
              <CardContent sx={{ p: { xs: 2.5, md: 3.5 } }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, mb: 2 }}>
                  {section.icon || null}
                  <Typography sx={{ fontSize: '1.35rem', fontWeight: 800 }}>{section.title}</Typography>
                </Box>
                {(section.body || []).map((paragraph) => (
                  <Typography key={paragraph} sx={{ color: 'text.secondary', lineHeight: 1.9, mb: section.bullets ? 2 : 0 }}>
                    {paragraph}
                  </Typography>
                ))}
                {section.bullets ? renderBullets(section.bullets) : null}
                {section.footer ? (
                  <Typography sx={{ color: 'text.secondary', lineHeight: 1.9, mt: 2.2 }}>
                    {section.footer}
                  </Typography>
                ) : null}
              </CardContent>
            </Card>
          ))}

          <Card sx={surfaceSx}>
            <CardContent sx={{ p: { xs: 2.5, md: 3.5 } }}>
              <Typography sx={{ fontSize: '1.35rem', fontWeight: 800, mb: 2 }}>Contact Us</Typography>
              <Typography sx={{ color: 'text.secondary', lineHeight: 1.9, mb: 3 }}>
                Have questions about how an IFC audit can benefit your business? Contact us today to schedule a consultation and take the first step toward improving your financial controls.
              </Typography>
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(3,1fr)' }, gap: 2 }}>
                {[
                  {
                    label: 'Phone',
                    value: '[Your phone number]',
                    icon: (
                      <PhoneInTalkRoundedIcon
                        sx={{
                          color: theme.palette.mode === 'dark' ? theme.palette.primary.light : theme.palette.secondary.main,
                        }}
                      />
                    ),
                  },
                  {
                    label: 'Email',
                    value: '[Your email address]',
                    icon: (
                      <MailOutlineRoundedIcon
                        sx={{
                          color: theme.palette.mode === 'dark' ? theme.palette.primary.light : theme.palette.secondary.main,
                        }}
                      />
                    ),
                  },
                  {
                    label: 'Address',
                    value: '[Your office address]',
                    icon: (
                      <LocationOnOutlinedIcon
                        sx={{
                          color: theme.palette.mode === 'dark' ? theme.palette.primary.light : theme.palette.secondary.main,
                        }}
                      />
                    ),
                  },
                ].map((item) => (
                  <Box key={item.label} sx={{ p: 2.2, borderRadius: 3, border: '1px solid', borderColor: 'divider', backgroundColor: alpha(theme.palette.background.default, 0.3) }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.1, mb: 1 }}>
                      {item.icon}
                      <Typography sx={{ fontWeight: 700 }}>{item.label}</Typography>
                    </Box>
                    <Typography sx={{ color: 'text.secondary' }}>{item.value}</Typography>
                  </Box>
                ))}
              </Box>
            </CardContent>
          </Card>

          <Card sx={surfaceSx}>
            <CardContent sx={{ p: { xs: 2.5, md: 3.5 } }}>
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1fr auto 1fr' }, gap: 3, alignItems: 'start' }}>
                <Box>
                  <Typography sx={{ fontSize: '1.2rem', fontWeight: 800, mb: 1.2 }}>About Us</Typography>
                  <Typography sx={{ color: 'text.secondary', lineHeight: 1.9 }}>
                    [Your Company Name] is a trusted provider of auditing and financial consulting services. With over [X] years of experience, our team is committed to delivering high-quality, reliable audits that drive business growth, enhance compliance, and strengthen financial integrity.
                  </Typography>
                </Box>
                <Divider orientation="vertical" flexItem sx={{ display: { xs: 'none', lg: 'block' } }} />
                <Box>
                  <Typography sx={{ fontSize: '1.2rem', fontWeight: 800, mb: 1.2 }}>Legal Disclaimer</Typography>
                  <Typography sx={{ color: 'text.secondary', lineHeight: 1.9 }}>
                    All services provided by [Your Company Name] are in compliance with applicable financial and regulatory standards. For more details on our privacy policy and terms of service, please visit [link to privacy policy].
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Box>
      </Container>
    </Box>
  )
}

export default Home
