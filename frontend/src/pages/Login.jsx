import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { alpha, useTheme } from '@mui/material/styles'
import Button from '@mui/material/Button'
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import TextField from '@mui/material/TextField'
import InputAdornment from '@mui/material/InputAdornment'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import Visibility from '@mui/icons-material/Visibility'
import VisibilityOff from '@mui/icons-material/VisibilityOff'
import LightModeIcon from '@mui/icons-material/LightMode'
import DarkModeIcon from '@mui/icons-material/DarkMode'
import Alert from '@mui/material/Alert'
import { toast } from 'react-hot-toast'
import {
  STORAGE_KEYS,
  clearCachedUserProfile,
  clearStoredUserDisplayName,
  writeCachedUserProfile,
  writeStoredUserDisplayName,
} from '../storageKeys'
import { useThemeMode } from '../contexts/ThemeContext'
import { useAuth } from '../contexts/AuthContext'
import { useSyncGlobalLoading } from '../contexts/GlobalLoadingContext'
import { apiUrl } from '../config/api'

async function cacheCompanyContext() {
  try {
    const profileResponse = await fetch(apiUrl('/api/auth/profile'), {
      method: 'GET',
      credentials: 'include',
    })

    const profileData = await profileResponse.json()
    if (!profileResponse.ok || !profileData?.success) {
      return
    }

    writeCachedUserProfile(profileData.profile)
    writeStoredUserDisplayName(profileData.profile)

    const companyIdentifier = String(profileData?.profile?.company_identifier || '').trim()
    const companyName = String(profileData?.profile?.company_name || '').trim()

    if (companyIdentifier) {
      localStorage.setItem(STORAGE_KEYS.companyIdentifier, companyIdentifier)
    } else {
      localStorage.removeItem(STORAGE_KEYS.companyIdentifier)
    }

    if (companyName) {
      localStorage.setItem(STORAGE_KEYS.companyName, companyName)
    } else {
      localStorage.removeItem(STORAGE_KEYS.companyName)
    }
  } catch (error) {
    console.warn('Failed to prefetch company context:', error)
  }
}

function Login() {
  const theme = useTheme()
  const { toggleTheme, mode } = useThemeMode()
  const navigate = useNavigate()
  const {
    loading: authLoading,
    isAuthenticated,
    role: authRole,
    requiresPasswordUpdate,
    setSession,
  } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  useSyncGlobalLoading(loading)

  // If user is already authenticated, redirect away from Login (uses shared AuthContext).
  useEffect(() => {
    if (authLoading || !isAuthenticated) return

    const redirectAuthenticatedUser = async () => {
      if (requiresPasswordUpdate) {
        navigate('/update-password', { replace: true })
        return
      }

      await cacheCompanyContext()

      const urlParams = new URLSearchParams(window.location.search)
      const redirectPath = urlParams.get('redirect')

      if (redirectPath) {
        navigate(decodeURIComponent(redirectPath), { replace: true })
        return
      }

      const roleRoutes = {
        user: '/user/home',
        company_admin: '/company_admin/home',
        company_co: '/company_co/home',
        approver: '/approver/home',
        siteadmin: '/siteadmin/dashboard',
        auditor: '/auditor/home',
      }
      const defaultRedirectPath = roleRoutes[authRole]
      if (defaultRedirectPath) {
        navigate(defaultRedirectPath, { replace: true })
      }
    }

    redirectAuthenticatedUser()
  }, [authLoading, authRole, isAuthenticated, navigate, requiresPasswordUpdate])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    clearCachedUserProfile()
    clearStoredUserDisplayName()

    try {
      const response = await fetch(apiUrl('/api/auth/login'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Important: allows cookies to be sent/received
        body: JSON.stringify({
          email_id: email,
          password
        })
      })

      const data = await response.json()

      if (response.ok && data.success) {
        // Login successful - token is stored in httpOnly cookie
        console.log('Login successful:', data.user)
        toast.success('Login successful!')
        setSession(data.user, data.requiresPasswordUpdate)

        // Prefetch company name once and store in localStorage
        await cacheCompanyContext()

        // Check if password update is required
        if (data.requiresPasswordUpdate) {
          navigate('/update-password')
          return
        }

        // Check if there's a redirect parameter in the URL
        const urlParams = new URLSearchParams(window.location.search)
        const redirectPath = urlParams.get('redirect')
        
        if (redirectPath) {
          // Redirect to the specified path
          navigate(decodeURIComponent(redirectPath), { replace: true })
        } else {
          // Default role-based redirect
          const role = data.user.role
          const roleRoutes = {
            'user': '/user/home',
            'company_admin': '/company_admin/home',
            'company_co': '/company_co/home',
            'approver': '/approver/home',
            'siteadmin': '/siteadmin/dashboard',
            'auditor': '/auditor/home'
          }

          const defaultRedirectPath = roleRoutes[role]
          if (defaultRedirectPath) {
            navigate(defaultRedirectPath)
          } else {
            toast.error('Invalid user role')
            setError('Invalid user role')
          }
        }
      } else {
        const errorMessage = data.message || 'Login failed'
        setError(errorMessage)
        toast.error(errorMessage)
      }
    } catch (err) {
      console.error('Login error:', err)
      const errorMessage = 'Network error. Please try again.'
      setError(errorMessage)
      toast.error(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  const handleForgotPassword = () => {
    // Pass email as URL parameter if it exists
    const emailParam = email ? `?email=${encodeURIComponent(email)}` : ''
    navigate(`/forgot-password${emailParam}`)
  }

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        px: { xs: 2, md: 4 },
        background:
          theme.palette.mode === 'dark'
            ? 'radial-gradient(circle at 10% 10%, rgba(56,189,248,0.18) 0%, transparent 28%), radial-gradient(circle at 90% 20%, rgba(250,204,21,0.12) 0%, transparent 26%), linear-gradient(180deg, #0b1220 0%, #101827 100%)'
            : 'radial-gradient(circle at 10% 10%, rgba(15,118,110,0.18) 0%, transparent 28%), radial-gradient(circle at 90% 20%, rgba(217,119,6,0.12) 0%, transparent 26%), linear-gradient(180deg, #f7f8f4 0%, #eef2e7 100%)',
      }}
    >
      <Box sx={{ position: 'absolute', top: { xs: 14, md: 18 }, right: { xs: 14, md: 18 }, zIndex: 5 }}>
        <Tooltip title={mode === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'} arrow>
          <IconButton
            onClick={toggleTheme}
            sx={{
              border: '1px solid',
              borderColor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.10)',
              backgroundColor: alpha(theme.palette.background.paper, theme.palette.mode === 'dark' ? 0.18 : 0.55),
              backdropFilter: 'blur(10px)',
            }}
            aria-label="toggle theme"
          >
            {mode === 'light' ? <DarkModeIcon /> : <LightModeIcon />}
          </IconButton>
        </Tooltip>
      </Box>
      <Box
        sx={{
          width: '100%',
          maxWidth: 980,
          display: { xs: 'block', md: 'grid' },
          gridTemplateColumns: { md: '1.08fr 0.92fr' },
          gap: 3,
          alignItems: 'stretch',
        }}
      >
        <Box
          sx={{
            display: { xs: 'none', md: 'flex' },
            flexDirection: 'column',
            justifyContent: 'center',
            p: 4.5,
            borderRadius: 4,
            border: '1px solid',
            borderColor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.06)',
            backgroundColor:
              theme.palette.mode === 'dark'
                ? alpha(theme.palette.background.paper, 0.06)
                : alpha(theme.palette.background.paper, 0.65),
            backdropFilter: 'blur(10px)',
          }}
        >
          <Typography
            variant="h4"
            component="h1"
            sx={{
              fontWeight: 800,
              letterSpacing: '-0.03em',
              color: 'text.primary',
              mb: 1,
            }}
          >
            Internal Financial Controls
          </Typography>
          <Typography sx={{ color: 'text.secondary', lineHeight: 1.8, maxWidth: 52 * 10 }}>
            Secure sign-in to access your IFC workflow. Manage RACMs, approvals, and audits in one place.
          </Typography>
          <Box
            sx={{
              mt: 3,
              display: 'grid',
              gridTemplateColumns: '1fr',
              gap: 1.2,
            }}
          >
            {[
              { title: 'Role-based access', subtitle: 'Different dashboards for different teams' },
              { title: 'Centralized RACM tracking', subtitle: 'Set owners and keep status up to date' },
              { title: 'Audit-ready records', subtitle: 'Evidence upload and reminders' },
            ].map((item) => (
              <Box
                key={item.title}
                sx={{
                  p: 1.6,
                  borderRadius: 3,
                  border: '1px solid',
                  borderColor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.06)',
                  backgroundColor:
                    theme.palette.mode === 'dark'
                      ? alpha(theme.palette.background.paper, 0.06)
                      : alpha(theme.palette.background.paper, 0.85),
                }}
              >
                <Typography sx={{ fontWeight: 800, color: 'text.primary' }}>{item.title}</Typography>
                <Typography sx={{ mt: 0.5, color: 'text.secondary', lineHeight: 1.6, fontSize: '0.92rem' }}>
                  {item.subtitle}
                </Typography>
              </Box>
            ))}
          </Box>
        </Box>

        <Paper
          elevation={3}
          sx={{
            p: { xs: 3, md: 4 },
            backgroundColor:
              theme.palette.mode === 'dark'
                ? alpha(theme.palette.background.paper, 0.22)
                : alpha(theme.palette.background.paper, 0.92),
            borderRadius: 4,
            border: '1px solid',
            borderColor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.06)',
            backdropFilter: 'blur(16px)',
          }}
        >
          <Typography
            variant="h4"
            component="h1"
            sx={{
              fontWeight: 800,
              color: 'text.primary',
              mb: 1,
              textAlign: 'center',
            }}
          >
            Welcome Back
          </Typography>
          <Typography sx={{ mb: 3, textAlign: 'center', color: 'text.secondary', lineHeight: 1.7 }}>
            Sign in to continue to your IFC dashboard.
          </Typography>
          
          {error && (
            <Alert severity="error" sx={{ mb: 3 }}>
              {error}
            </Alert>
          )}

          <form onSubmit={handleSubmit}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, mb: 3 }}>
              <TextField
                id="email"
                label="Email ID"
                type="email"
                variant="filled"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
                placeholder="Enter your email"
                fullWidth
                sx={{
                  '& .MuiFilledInput-root': {
                    borderRadius: 2.5,
                    backgroundColor:
                      theme.palette.mode === 'dark'
                        ? alpha(theme.palette.background.paper, 0.08)
                        : alpha(theme.palette.background.paper, 0.7),
                    border: '1px solid',
                    borderColor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.06)',
                  },
                }}
              />

              <TextField
                id="password"
                label="Password"
                type={showPassword ? 'text' : 'password'}
                variant="filled"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
                placeholder="Enter your password"
                fullWidth
                sx={{
                  '& .MuiFilledInput-root': {
                    borderRadius: 2.5,
                    backgroundColor:
                      theme.palette.mode === 'dark'
                        ? alpha(theme.palette.background.paper, 0.08)
                        : alpha(theme.palette.background.paper, 0.7),
                    border: '1px solid',
                    borderColor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.06)',
                  },
                }}
                slotProps={{
                  input: {
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          aria-label="toggle password visibility"
                          onClick={() => setShowPassword(!showPassword)}
                          onMouseDown={(e) => e.preventDefault()}
                          edge="end"
                          disabled={loading}
                        >
                          {showPassword ? <VisibilityOff /> : <Visibility />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  },
                }}
              />
            </Box>

            <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Button
                type="button"
                onClick={handleForgotPassword}
                disabled={loading}
                variant="text"
                sx={{
                  textTransform: 'none',
                  fontSize: theme.typography.customSizes.small,
                  color: 'text.primary',
                  '&:hover': {
                    backgroundColor: 'transparent',
                    textDecoration: 'underline',
                  },
                }}
              >
                Forgot Password?
              </Button>
            </Box>

            <Button
              type="submit"
              disabled={loading}
              variant="contained"
              color="secondary"
              fullWidth
              sx={{
                py: 1.5,
                fontSize: theme.typography.customSizes.medium,
                fontWeight: 600,
                textTransform: 'none',
                mb: 2,
                borderRadius: 2.5,
                boxShadow:
                  theme.palette.mode === 'dark'
                    ? '0 12px 30px rgba(0,0,0,0.35)'
                    : '0 10px 26px rgba(15,23,42,0.12)',
              }}
            >
              {loading ? 'Logging in...' : 'Login'}
            </Button>

            <Box sx={{ display: 'flex', justifyContent: 'center' }}>
              <Button
                variant="text"
                onClick={() => navigate('/')}
                sx={{
                  textTransform: 'none',
                  color: theme.palette.text.primary,
                  '&:hover': {
                    backgroundColor: 'transparent',
                    textDecoration: 'underline',
                  },
                }}
              >
                Back
              </Button>
            </Box>
          </form>
        </Paper>
      </Box>
    </Box>
  )
}

export default Login
