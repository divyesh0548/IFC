import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { alpha, useTheme } from '@mui/material/styles'
import Button from '@mui/material/Button'
import Alert from '@mui/material/Alert'
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
import { toast } from 'react-hot-toast'
import { useThemeMode } from '../contexts/ThemeContext'
import { useSyncGlobalLoading } from '../contexts/GlobalLoadingContext'
import { apiUrl } from '../config/api'

const ROLE_HOME_ROUTES = {
  user: '/user/home',
  company_co: '/company_co/home',
  approver: '/approver/home',
  siteadmin: '/siteadmin/dashboard',
  auditor: '/auditor/home',
}

const filledFieldSx = (theme) => ({
  '& .MuiFilledInput-root': {
    borderRadius: 2.5,
    backgroundColor:
      theme.palette.mode === 'dark'
        ? alpha(theme.palette.background.paper, 0.08)
        : alpha(theme.palette.background.paper, 0.7),
    border: '1px solid',
    borderColor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.06)',
  },
})

function UpdatePassword() {
  const theme = useTheme()
  const { toggleTheme, mode } = useThemeMode()
  const navigate = useNavigate()
  const [email_id, setEmail_id] = useState('')
  const [userRole, setUserRole] = useState(null)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [checkingSession, setCheckingSession] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  useSyncGlobalLoading(loading || checkingSession)

  useEffect(() => {
    const fetchUserInfo = async () => {
      setCheckingSession(true)
      try {
        const response = await fetch(apiUrl('/api/auth/verify'), {
          method: 'GET',
          credentials: 'include',
        })

        const data = await response.json()

        if (response.ok && data.success) {
          setEmail_id(data.user.email_id)
          setUserRole(data.user.role ?? null)
        } else {
          navigate('/login', { replace: true })
        }
      } catch (err) {
        console.error('Error fetching user info:', err)
        navigate('/login', { replace: true })
      } finally {
        setCheckingSession(false)
      }
    }

    fetchUserInfo()
  }, [navigate])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (newPassword !== confirmPassword) {
      setError('New password and confirm password do not match')
      return
    }

    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters long')
      return
    }

    if (currentPassword === newPassword) {
      const msg = 'New password cannot be the same as your temporary password'
      setError(msg)
      toast.error(msg)
      return
    }

    setLoading(true)

    try {
      const response = await fetch(apiUrl('/api/auth/update-password'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          email_id,
          currentPassword,
          newPassword,
        }),
      })

      const data = await response.json()

      if (response.status === 401) {
        toast.error(data.message || 'Your session has expired. Please login again.')
        navigate('/login', { replace: true })
        return
      }

      if (response.ok && data.success) {
        toast.success(data.message || 'Password updated successfully')
        const updatedRole = data.user?.role || userRole
        const dest = (updatedRole && ROLE_HOME_ROUTES[updatedRole]) || '/login'
        navigate(dest, { replace: true })
      } else {
        setError(data.message || 'Failed to update password')
        toast.error(data.message || 'Failed to update password')
      }
    } catch (err) {
      console.error('Update password error:', err)
      const msg = 'Network error. Please try again.'
      setError(msg)
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  if (checkingSession) {
    return null
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
            You signed in with a temporary password. Set a new password you will use from now on to keep your
            account secure.
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
              { title: 'Use your temporary password once', subtitle: 'Enter it as the current password, then choose a new one.' },
              { title: 'Pick something memorable', subtitle: 'At least six characters; avoid obvious words.' },
              { title: 'Same IFC experience', subtitle: 'After updating, you will continue to your dashboard as usual.' },
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
            Set your new password
          </Typography>
          <Typography sx={{ mb: 3, textAlign: 'center', color: 'text.secondary', lineHeight: 1.7 }}>
            Enter the temporary password you used to sign in, then create and confirm your new password.
          </Typography>

          {error && (
            <Alert severity="error" sx={{ mb: 3 }}>
              {error}
            </Alert>
          )}

          <form onSubmit={handleSubmit}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, mb: 3 }}>
              <TextField
                id="currentPassword"
                label="Current / temporary password"
                type={showCurrentPassword ? 'text' : 'password'}
                variant="filled"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
                disabled={loading}
                placeholder="Temporary password from email"
                fullWidth
                sx={filledFieldSx(theme)}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        aria-label="toggle current password visibility"
                        onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                        onMouseDown={(e) => e.preventDefault()}
                        edge="end"
                        disabled={loading}
                      >
                        {showCurrentPassword ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />

              <TextField
                id="newPassword"
                label="New password"
                type={showNewPassword ? 'text' : 'password'}
                variant="filled"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                disabled={loading}
                placeholder="Choose a new password"
                fullWidth
                sx={filledFieldSx(theme)}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        aria-label="toggle new password visibility"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        onMouseDown={(e) => e.preventDefault()}
                        edge="end"
                        disabled={loading}
                      >
                        {showNewPassword ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />

              <TextField
                id="confirmPassword"
                label="Confirm new password"
                type={showConfirmPassword ? 'text' : 'password'}
                variant="filled"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                disabled={loading}
                placeholder="Re-enter new password"
                fullWidth
                sx={filledFieldSx(theme)}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        aria-label="toggle confirm password visibility"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        onMouseDown={(e) => e.preventDefault()}
                        edge="end"
                        disabled={loading}
                      >
                        {showConfirmPassword ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />
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
              {loading ? 'Updating…' : 'Update password'}
            </Button>

            <Box sx={{ display: 'flex', justifyContent: 'center' }}>
              <Button
                type="button"
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

export default UpdatePassword
