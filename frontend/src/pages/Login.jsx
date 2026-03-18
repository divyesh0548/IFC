import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTheme } from '@mui/material/styles'
import Button from '@mui/material/Button'
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import TextField from '@mui/material/TextField'
import InputAdornment from '@mui/material/InputAdornment'
import IconButton from '@mui/material/IconButton'
import Visibility from '@mui/icons-material/Visibility'
import VisibilityOff from '@mui/icons-material/VisibilityOff'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import Alert from '@mui/material/Alert'
import { toast } from 'react-hot-toast'
import { STORAGE_KEYS } from '../storageKeys'

function Login() {
  const theme = useTheme()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // If user is already authenticated (token cookie valid), redirect away from Login
  useEffect(() => {
    const checkExistingSession = async () => {
      try {
        const response = await fetch('http://localhost:3000/api/auth/verify', {
          method: 'GET',
          credentials: 'include',
        })

        const data = await response.json()

        if (response.ok && data.success) {
          const companyIdentifier = data.user?.company_identifier
          if (companyIdentifier) {
            try {
              const companyRes = await fetch(`http://localhost:3000/api/companies/${encodeURIComponent(companyIdentifier)}`, {
                method: 'GET',
                credentials: 'include',
              })
              const companyData = await companyRes.json()
              if (companyRes.ok && companyData?.success && companyData?.data?.company_name) {
                localStorage.setItem(STORAGE_KEYS.companyIdentifier, companyIdentifier)
                localStorage.setItem(STORAGE_KEYS.companyName, String(companyData.data.company_name))
              }
            } catch (e) {
              console.warn('Failed to prefetch company name:', e)
            }
          }

          // Check if there's a redirect parameter in the URL
          const urlParams = new URLSearchParams(window.location.search)
          const redirectPath = urlParams.get('redirect')
          
          if (redirectPath) {
            // Redirect to the specified path
            navigate(decodeURIComponent(redirectPath), { replace: true })
          } else {
            // Default role-based redirect
            const role = data.user?.role
            const roleRoutes = {
              user: '/user/dashboard',
              company_co: '/company_co/home',
              approver: '/approver/dashboard',
              siteadmin: '/siteadmin/dashboard',
              auditor: '/auditor/dashboard',
            }
            const defaultRedirectPath = roleRoutes[role]
            if (defaultRedirectPath) {
              navigate(defaultRedirectPath, { replace: true })
            }
          }
        }
      } catch (err) {
        console.error('Error checking existing session on Login:', err)
      }
    }

    checkExistingSession()
  }, [navigate])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const response = await fetch('http://localhost:3000/api/auth/login', {
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

        // Prefetch company name once and store in localStorage
        const companyIdentifier = data.user?.company_identifier
        if (companyIdentifier) {
          try {
            const companyRes = await fetch(`http://localhost:3000/api/companies/${encodeURIComponent(companyIdentifier)}`, {
              method: 'GET',
              credentials: 'include',
            })
            const companyData = await companyRes.json()
            if (companyRes.ok && companyData?.success && companyData?.data?.company_name) {
              localStorage.setItem(STORAGE_KEYS.companyIdentifier, companyIdentifier)
              localStorage.setItem(STORAGE_KEYS.companyName, String(companyData.data.company_name))
            }
          } catch (e) {
            console.warn('Failed to fetch company name after login:', e)
          }
        }

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
            'user': '/user/dashboard',
            'company_co': '/company_co/home',
            'approver': '/approver/dashboard',
            'siteadmin': '/siteadmin/dashboard',
            'auditor': '/auditor/dashboard'
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
        backgroundColor: theme.palette.background.default,
        px: 2,
      }}
    >
      <Box sx={{ width: '100%', maxWidth: '448px' }}>
        <Paper
          elevation={3}
          sx={{
            p: 4,
            backgroundColor: theme.palette.background.paper,
            borderRadius: 2,
          }}
        >
          <Typography
            variant="h4"
            component="h1"
            sx={{
              fontWeight: 700,
              color: theme.palette.secondary.main,
              mb: 4,
              textAlign: 'center',
            }}
          >
            IFC Login
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
                  '& input:-webkit-autofill': {
                    WebkitBoxShadow: `0 0 0 1000px ${theme.palette.mode === 'dark' ? theme.palette.background.paper : 'rgba(0, 0, 0, 0.06)'} inset`,
                    WebkitTextFillColor: theme.palette.text.primary,
                  },
                  '& input:-webkit-autofill:hover': {
                    WebkitBoxShadow: `0 0 0 1000px ${theme.palette.mode === 'dark' ? theme.palette.background.paper : 'rgba(0, 0, 0, 0.06)'} inset`,
                  },
                  '& input:-webkit-autofill:focus': {
                    WebkitBoxShadow: `0 0 0 1000px ${theme.palette.mode === 'dark' ? theme.palette.background.paper : 'rgba(0, 0, 0, 0.06)'} inset`,
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
                  '& input:-webkit-autofill': {
                    WebkitBoxShadow: `0 0 0 1000px ${theme.palette.mode === 'dark' ? theme.palette.background.paper : 'rgba(0, 0, 0, 0.06)'} inset`,
                    WebkitTextFillColor: theme.palette.text.primary,
                  },
                  '& input:-webkit-autofill:hover': {
                    WebkitBoxShadow: `0 0 0 1000px ${theme.palette.mode === 'dark' ? theme.palette.background.paper : 'rgba(0, 0, 0, 0.06)'} inset`,
                  },
                  '& input:-webkit-autofill:focus': {
                    WebkitBoxShadow: `0 0 0 1000px ${theme.palette.mode === 'dark' ? theme.palette.background.paper : 'rgba(0, 0, 0, 0.06)'} inset`,
                  },
                }}
                InputProps={{
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
