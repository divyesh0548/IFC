import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTheme } from '@mui/material/styles'
import Navbar from '../../components/Siteadmin_navbar'
import Button from '@mui/material/Button'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'

function CreateUser() {
  const theme = useTheme()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const handleLogout = async () => {
    try {
      const response = await fetch('http://localhost:3000/api/auth/user/logout', {
        method: 'POST',
        credentials: 'include',
      })

      const data = await response.json()

      if (response.ok && data.success) {
        navigate('/user/login')
      } else {
        navigate('/user/login')
      }
    } catch (error) {
      console.error('Logout error:', error)
      navigate('/user/login')
    }
  }

  const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    // Validate email
    if (!email.trim()) {
      setError('Email ID is required')
      return
    }

    if (!validateEmail(email)) {
      setError('Please enter a valid email address')
      return
    }

    setLoading(true)

    try {
      const response = await fetch('http://localhost:3000/api/company-co/create-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ email_id: email.trim() })
      })

      const data = await response.json()

      if (response.ok && data.success) {
        setSuccess(`User created successfully! ${data.emailSent ? 'An email with temporary password has been sent.' : 'Note: Email sending failed, but user was created.'}`)
        setEmail('')
        
        // Clear success message after 5 seconds
        setTimeout(() => {
          setSuccess('')
        }, 5000)
      } else {
        setError(data.message || 'Failed to create user')
      }
    } catch (err) {
      console.error('Create user error:', err)
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-primary">
      <Navbar onLogout={handleLogout} header="Create User" />

      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-4rem)] px-4">
        <div className="w-full max-w-md">
          <h1 className="text-3xl font-bold text-secondary mb-6 text-center">
            Create New User
          </h1>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Email Input */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-secondary mb-2">
                Email ID
              </label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
                placeholder="user@example.com"
                disabled={loading}
                required
              />
            </div>

            {/* Error Message */}
            {error && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {error}
              </Alert>
            )}

            {/* Success Message */}
            {success && (
              <Alert severity="success" sx={{ mb: 2 }}>
                {success}
              </Alert>
            )}

            {/* Submit Button */}
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
              {loading ? 'Creating User...' : 'Create User'}
            </Button>

            {/* Back Button */}
            <Button
              type="button"
              onClick={() => navigate('/company_co/dashboard')}
              variant="contained"
              fullWidth
              sx={{
                py: 1.5,
                fontSize: theme.typography.customSizes.medium,
                fontWeight: 600,
                textTransform: 'none',
                backgroundColor: '#6b7280',
                color: '#ffffff',
                '&:hover': {
                  backgroundColor: '#4b5563',
                },
              }}
            >
              Back to Dashboard
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}

export default CreateUser

