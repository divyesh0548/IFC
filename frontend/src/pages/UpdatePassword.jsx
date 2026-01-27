import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTheme } from '@mui/material/styles'
import Button from '@mui/material/Button'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import TextField from '@mui/material/TextField'

function UpdatePassword() {
  const theme = useTheme()
  const navigate = useNavigate()
  const [email_id, setEmail_id] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    // Fetch user email from verify endpoint
    const fetchUserInfo = async () => {
      try {
        const response = await fetch('http://localhost:3000/api/auth/verify', {
          method: 'GET',
          credentials: 'include',
        })

        const data = await response.json()

        if (response.ok && data.success) {
          setEmail_id(data.user.email_id)
        } else {
          navigate('/login')
        }
      } catch (error) {
        console.error('Error fetching user info:', error)
        navigate('/login')
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

    setLoading(true)

    try {
      const response = await fetch('http://localhost:3000/api/auth/update-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          email_id,
          currentPassword,
          newPassword
        })
      })

      const data = await response.json()

      if (response.ok && data.success) {
        // Password updated successfully, redirect to dashboard
        navigate('/user/dashboard')
      } else {
        setError(data.message || 'Failed to update password')
      }
    } catch (err) {
      console.error('Update password error:', err)
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
            Update Password
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
                label="Current/Temporary Password"
                type="password"
                variant="filled"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
                disabled={loading}
                placeholder="Enter current or temporary password"
                fullWidth
              />

              <TextField
                id="newPassword"
                label="New Password"
                type="password"
                variant="filled"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                disabled={loading}
                placeholder="Enter new password"
                fullWidth
              />

              <TextField
                id="confirmPassword"
                label="Confirm New Password"
                type="password"
                variant="filled"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                disabled={loading}
                placeholder="Confirm new password"
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
              }}
            >
              {loading ? 'Updating...' : 'Update Password'}
            </Button>
          </form>
        </Paper>
      </Box>
    </Box>
  )
}

export default UpdatePassword

