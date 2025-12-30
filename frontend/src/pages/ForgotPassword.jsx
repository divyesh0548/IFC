import React, { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'

function ForgotPassword() {
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
            <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-md">
              {error}
            </div>
          )}

          {success && (
            <div className="mb-4 p-3 bg-green-100 border border-green-400 text-green-700 rounded-md">
              {success}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label 
                htmlFor="email_id" 
                className="block text-sm font-medium text-secondary mb-2"
              >
                Email ID
              </label>
              <input
                type="email"
                id="email_id"
                value={email_id}
                onChange={(e) => setEmail_id(e.target.value)}
                required
                disabled={loading}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-secondary focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
                placeholder="Enter your email"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-secondary text-primary py-3 rounded-md font-semibold hover:bg-hover transition-colors focus:outline-none focus:ring-2 focus:ring-secondary focus:ring-offset-2 cursor-pointer disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {loading ? 'Sending...' : 'Send Temporary Password'}
            </button>

            <div className="text-center">
              <button
                type="button"
                onClick={() => navigate('/user/login')}
                className="text-sm text-secondary hover:text-hover transition-colors cursor-pointer"
              >
                Back to Login
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

export default ForgotPassword

