import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTheme } from '@mui/material/styles'
import Button from '@mui/material/Button'
import Box from '@mui/material/Box'
import TextField from '@mui/material/TextField'
import InputAdornment from '@mui/material/InputAdornment'
import IconButton from '@mui/material/IconButton'
import Visibility from '@mui/icons-material/Visibility'
import VisibilityOff from '@mui/icons-material/VisibilityOff'
import Alert from '@mui/material/Alert'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'
import { toast } from 'react-hot-toast'

function Auditor_Login() {
  const theme = useTheme()
  const navigate = useNavigate()
  const [email_id, setEmail_id] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const response = await fetch('http://localhost:3000/api/auth/auditor/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Important: allows cookies to be sent/received
        body: JSON.stringify({
          email_id,
          password
        })
      })

      const data = await response.json()

      if (response.ok && data.success) {
        // Login successful - token is stored in httpOnly cookie
        console.log('Login successful:', data.user)
        toast.success('Login successful!')
        // Redirect to dashboard
        navigate('/auditor/dashboard')
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

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'background.default',
        px: 2,
      }}
    >
      <Box sx={{ width: '100%', maxWidth: '448px' }}>
        <Card elevation={3}>
          <CardContent sx={{ p: 4 }}>
            <Typography
              variant="h4"
              component="h1"
              sx={{
                fontWeight: 700,
                mb: 4,
                textAlign: 'center',
                color: 'secondary.main',
              }}
            >
              Auditor Login
            </Typography>

            {error && (
              <Alert severity="error" sx={{ mb: 3 }}>
                {error}
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
          </CardContent>
        </Card>
      </Box>
    </Box>
  )
}

export default Auditor_Login

