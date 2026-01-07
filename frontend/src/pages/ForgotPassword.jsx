import React, { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useTheme } from '@mui/material/styles'
import Button from '@mui/material/Button'
import Box from '@mui/material/Box'
import TextField from '@mui/material/TextField'
import Alert from '@mui/material/Alert'

function ForgotPassword() {
  const theme = useTheme()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [email_id, setEmail_id] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

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
    <div className="min-h-screen flex items-center justify-center bg-primary px-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <h1 className="text-3xl font-bold text-secondary mb-8 text-center">
            Forgot Password
          </h1>
          
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
        </div>
      </div>
    </div>
  )
}

export default ForgotPassword

