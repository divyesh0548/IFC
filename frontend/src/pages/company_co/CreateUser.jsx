import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Navbar from '../../components/Siteadmin_navbar'

function CreateUser() {
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
              <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
                {error}
              </div>
            )}

            {/* Success Message */}
            {success && (
              <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded">
                {success}
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-secondary text-primary py-2 px-4 rounded-lg hover:bg-opacity-90 focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Creating User...' : 'Create User'}
            </button>

            {/* Back Button */}
            <button
              type="button"
              onClick={() => navigate('/company_co/dashboard')}
              className="w-full bg-gray-500 text-white py-2 px-4 rounded-lg hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors"
            >
              Back to Dashboard
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

export default CreateUser

