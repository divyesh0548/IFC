import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Box, Container, Typography, Button, Card, CardContent, IconButton, Grid, Tooltip } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import LightModeIcon from '@mui/icons-material/LightMode'
import DarkModeIcon from '@mui/icons-material/DarkMode'
import BusinessIcon from '@mui/icons-material/Business'
import PeopleIcon from '@mui/icons-material/People'
import { useThemeMode } from '../contexts/ThemeContext'

function Home() {
  const theme = useTheme()
  const { toggleTheme, mode } = useThemeMode()
  const [stats, setStats] = useState({ companies: 0, users: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchStats()
  }, [])

  const fetchStats = async () => {
    try {
      const response = await fetch('http://localhost:3000/api/stats', {
        method: 'GET',
        credentials: 'include',
      })
      
      if (!response.ok) {
        console.error('Stats API response not OK:', response.status, response.statusText)
        return
      }
      
      const data = await response.json()
      console.log('Stats API response:', data)
      
      if (data.success && data.data) {
        setStats({
          companies: data.data.companies || 0,
          users: data.data.users || 0
        })
      } else {
        console.error('Stats API response missing success or data:', data)
      }
    } catch (error) {
      console.error('Error fetching stats:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Box
      sx={{
        minHeight: '100vh',
        backgroundColor: 'background.default',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
      }}
    >
      {/* Theme Toggle Button - Top Right */}
      <Box
        sx={{
          position: 'absolute',
          top: 16,
          right: 16,
          zIndex: 1,
        }}
      >
        <Tooltip title={mode === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'} arrow>
          <IconButton
            onClick={toggleTheme}
            sx={{
              color: theme.palette.text.primary,
              '&:hover': {
                backgroundColor: theme.palette.mode === 'dark' 
                  ? 'rgba(255, 255, 255, 0.08)' 
                  : 'rgba(0, 0, 0, 0.04)',
              },
            }}
            aria-label="toggle theme"
          >
            {mode === 'light' ? <DarkModeIcon /> : <LightModeIcon />}
          </IconButton>
        </Tooltip>
      </Box>

      {/* Main Content */}
      <Container maxWidth="md" sx={{ flex: 1, display: 'flex', alignItems: 'center', py: 6 }}>
        <Box sx={{ width: '100%' }}>
          {/* Title Section */}
          <Box sx={{ textAlign: 'center', mb: 6 }}>
            <Typography
              variant="h3"
              component="h1"
              sx={{
                fontWeight: 700,
                mb: 2,
                color: 'primary.main',
                fontSize: { xs: '2rem', sm: '2.5rem', md: '3rem' },
              }}
            >
              Internal Financial Control Audit
            </Typography>
            <Typography
              variant="h6"
              component="p"
              sx={{
                color: 'text.secondary',
                fontWeight: 400,
                maxWidth: '600px',
                mx: 'auto',
                lineHeight: 1.6,
              }}
            >
              Comprehensive platform for managing and auditing internal financial controls, ensuring compliance and operational excellence.
            </Typography>
          </Box>

          {/* Stats Cards */}
          <Grid container spacing={3} sx={{ mb: 5, justifyContent: 'center' }}>
            {/* Companies Card */}
            <Grid item xs={12} sm={6} sx={{ display: 'flex', justifyContent: 'center' }}>
              <Card
                sx={{
                  width: '100%',
                  width: '300px',
                  height: '220px',
                  borderRadius: 3,
                  boxShadow: theme.palette.mode === 'dark'
                    ? '0 4px 20px rgba(0, 0, 0, 0.3)'
                    : '0 2px 12px rgba(0, 0, 0, 0.08)',
                  border: '1px solid',
                  borderColor: theme.palette.mode === 'dark'
                    ? 'rgba(255, 255, 255, 0.12)'
                    : 'rgba(0, 0, 0, 0.08)',
                  transition: 'transform 0.2s ease-in-out',
                  display: 'flex',
                  flexDirection: 'column',
                  '&:hover': {
                    transform: 'translateY(-4px)',
                    boxShadow: theme.palette.mode === 'dark'
                      ? '0 8px 24px rgba(0, 0, 0, 0.4)'
                      : '0 4px 16px rgba(0, 0, 0, 0.12)',
                  },
                }}
              >
                <CardContent 
                  sx={{ 
                    p: 4, 
                    flex: 1, 
                    display: 'flex', 
                    flexDirection: 'column', 
                    justifyContent: 'center',
                    alignItems: 'center',
                    textAlign: 'center',
                  }}
                >
                  <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
                    <BusinessIcon
                      sx={{
                        fontSize: 48,
                        color: 'primary.main',
                      }}
                    />
                  </Box>
                  <Typography
                    variant="h4"
                    component="div"
                    sx={{
                      fontWeight: 700,
                      mb: 1,
                      color: 'text.primary',
                    }}
                  >
                    {loading ? '...' : stats.companies}
                  </Typography>
                  <Typography
                    variant="body1"
                    sx={{
                      color: 'text.secondary',
                      fontWeight: 500,
                    }}
                  >
                    Companies Registered
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            {/* Users Card */}
            <Grid item xs={12} sm={6} sx={{ display: 'flex', justifyContent: 'center' }}>
              <Card
                sx={{
                  width: '100%',
                  width: '300px',
                  height: '220px',
                  borderRadius: 3,
                  boxShadow: theme.palette.mode === 'dark'
                    ? '0 4px 20px rgba(0, 0, 0, 0.3)'
                    : '0 2px 12px rgba(0, 0, 0, 0.08)',
                  border: '1px solid',
                  borderColor: theme.palette.mode === 'dark'
                    ? 'rgba(255, 255, 255, 0.12)'
                    : 'rgba(0, 0, 0, 0.08)',
                  transition: 'transform 0.2s ease-in-out',
                  display: 'flex',
                  flexDirection: 'column',
                  '&:hover': {
                    transform: 'translateY(-4px)',
                    boxShadow: theme.palette.mode === 'dark'
                      ? '0 8px 24px rgba(0, 0, 0, 0.4)'
                      : '0 4px 16px rgba(0, 0, 0, 0.12)',
                  },
                }}
              >
                <CardContent 
                  sx={{ 
                    p: 4, 
                    flex: 1, 
                    display: 'flex', 
                    flexDirection: 'column', 
                    justifyContent: 'center',
                    alignItems: 'center',
                    textAlign: 'center',
                  }}
                >
                  <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
                    <PeopleIcon
                      sx={{
                        fontSize: 48,
                        color: 'primary.main',
                      }}
                    />
                  </Box>
                  <Typography
                    variant="h4"
                    component="div"
                    sx={{
                      fontWeight: 700,
                      mb: 1,
                      color: 'text.primary',
                    }}
                  >
                    {loading ? '...' : stats.users}
                  </Typography>
                  <Typography
                    variant="body1"
                    sx={{
                      color: 'text.secondary',
                      fontWeight: 500,
                    }}
                  >
                    Users Registered
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {/* Login Button */}
          <Box sx={{ textAlign: 'center' }}>
            <Button
              component={Link}
              to="/login"
              variant="contained"
              color="secondary"
              size="large"
              sx={{
                minWidth: '200px',
                py: 1.75,
                px: 4,
                textTransform: 'none',
                fontWeight: 600,
                fontSize: '1rem',
                borderRadius: 2,
                boxShadow: theme.palette.mode === 'dark'
                  ? '0 4px 12px rgba(3, 105, 161, 0.3)'
                  : '0 2px 8px rgba(3, 105, 161, 0.2)',
                '&:hover': {
                  boxShadow: theme.palette.mode === 'dark'
                    ? '0 6px 16px rgba(3, 105, 161, 0.4)'
                    : '0 4px 12px rgba(3, 105, 161, 0.3)',
                  transform: 'translateY(-2px)',
                },
                transition: 'all 0.2s ease-in-out',
              }}
            >
              Login
            </Button>
          </Box>
        </Box>
      </Container>
    </Box>
  )
}

export default Home
