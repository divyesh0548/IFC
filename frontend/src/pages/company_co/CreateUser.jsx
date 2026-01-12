import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTheme } from '@mui/material/styles'
import Button from '@mui/material/Button'
import Box from '@mui/material/Box'
import TextField from '@mui/material/TextField'
import { toast } from 'react-hot-toast'

function CreateUser() {
  const theme = useTheme()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    // Validate email
    if (!email.trim()) {
      const errorMsg = 'Email ID is required'
      setError(errorMsg)
      toast.error(errorMsg)
      return
    }

    if (!validateEmail(email)) {
      const errorMsg = 'Please enter a valid email address'
      setError(errorMsg)
      toast.error(errorMsg)
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
        const successMsg = `User created successfully! ${data.emailSent ? 'An email with temporary password has been sent.' : 'Note: Email sending failed, but user was created.'}`
        toast.success(successMsg)
        setEmail('')
        setError('')
      } else {
        const errorMsg = data.message || 'Failed to create user'
        setError(errorMsg)
        toast.error(errorMsg)
      }
    } catch (err) {
      console.error('Create user error:', err)
      const errorMsg = 'Network error. Please try again.'
      setError(errorMsg)
      toast.error(errorMsg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-4rem)] px-4">
        <div className="w-full max-w-md">
          <h1 className="text-3xl font-bold text-secondary mb-6 text-center">
            Create New User
          </h1>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Email Input */}
            <TextField
              id="email"
              name="email"
              label="Email ID"
              type="email"
              variant="filled"
              value={email}
              sx={{mb: 2}}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
              placeholder="user@example.com"
              error={!!error}
              helperText={error || ''}
              fullWidth
            />

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
  )
}

export default CreateUser

