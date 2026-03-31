import React, { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { alpha, useTheme } from '@mui/material/styles'
import Button from '@mui/material/Button'
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import TextField from '@mui/material/TextField'
import Alert from '@mui/material/Alert'
import { useSyncGlobalLoading } from '../contexts/GlobalLoadingContext'

function ForgotPassword() {
  const theme = useTheme()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [email_id, setEmail_id] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  useSyncGlobalLoading(loading)

  // Get email from URL parameter on component mount
  useEffect(() => {
    const emailFromUrl = searchParams.get('email')
    if (emailFromUrl) {
      setEmail_id(decodeURIComponent(emailFromUrl))
    }
  }, [searchParams])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccess('')

    try {
      const response = await fetch('http://localhost:3000/api/auth/forgot-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email_id
        })
      })

      const data = await response.json()

      if (response.ok && data.success) {
        setSuccess(data.message || 'If the email exists, a temporary password has been sent.')
        // Optionally redirect to login after a delay
        setTimeout(() => {
          navigate('/user/login')
        }, 3000)
      } else {
        setError(data.message || 'Failed to send temporary password')
      }
    } catch (err) {
      console.error('Forgot password error:', err)
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
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
              theme.palette.mode === 'dark' ? alpha(theme.palette.background.paper, 0.06) : alpha(theme.palette.background.paper, 0.65),
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
            Password Recovery
          </Typography>
          <Typography sx={{ color: 'text.secondary', lineHeight: 1.8, maxWidth: 52 * 10 }}>
            Enter your email and we will send a temporary password so you can securely sign in again.
          </Typography>
          <Box sx={{ mt: 3, display: 'grid', gridTemplateColumns: '1fr', gap: 1.2 }}>
            {[
              { title: 'Secure access', subtitle: 'Temporary credentials only' },
              { title: 'Quick recovery', subtitle: 'Usually takes a moment' },
              { title: 'One account', subtitle: 'Use the same email you registered' },
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
            Forgot Password
          </Typography>
          <Typography sx={{ mb: 3, textAlign: 'center', color: 'text.secondary', lineHeight: 1.7 }}>
            We will send you a temporary password to regain access.
          </Typography>
          
          {error && (
            <Alert severity="error" sx={{ mb: 3 }}>
              {error}
            </Alert>
          )}

          {success && (
            <Alert severity="success" sx={{ mb: 3 }}>
              {success}
            </Alert>
          )}

          <form onSubmit={handleSubmit}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, mb: 3 }}>
              <TextField
                id="email_id"
                label="Email ID"
                type="email"
                variant="filled"
                value={email_id}
                onChange={(e) => setEmail_id(e.target.value)}
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
                  '& .MuiInputLabel-root': {
                    color: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.72)' : 'text.secondary',
                  },
                  '& input:-webkit-autofill': {
                    WebkitBoxShadow: `0 0 0 1000px ${
                      theme.palette.mode === 'dark'
                        ? alpha(theme.palette.background.paper, 0.08)
                        : alpha(theme.palette.background.paper, 0.7)
                    } inset`,
                    WebkitTextFillColor: theme.palette.text.primary,
                  },
                  '& input:-webkit-autofill:hover': {
                    WebkitBoxShadow: `0 0 0 1000px ${
                      theme.palette.mode === 'dark'
                        ? alpha(theme.palette.background.paper, 0.08)
                        : alpha(theme.palette.background.paper, 0.7)
                    } inset`,
                  },
                  '& input:-webkit-autofill:focus': {
                    WebkitBoxShadow: `0 0 0 1000px ${
                      theme.palette.mode === 'dark'
                        ? alpha(theme.palette.background.paper, 0.08)
                        : alpha(theme.palette.background.paper, 0.7)
                    } inset`,
                  },
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
              {loading ? 'Sending...' : 'Send Temporary Password'}
            </Button>

            <Box sx={{ textAlign: 'center' }}>
              <Button
                type="button"
                onClick={() => navigate('/user/login')}
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
                Back to Login
              </Button>
            </Box>
          </form>
        </Paper>
      </Box>
    </Box>
  )
}

export default ForgotPassword

