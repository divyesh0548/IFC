import { useState, useEffect, useRef } from 'react'
import { Navigate, useLocation } from 'react-router-dom'

function ProtectedRoute({ children }) {
  const [isAuthenticated, setIsAuthenticated] = useState(null)
  const [loading, setLoading] = useState(true)
  const location = useLocation()
  const hasVerifiedRef = useRef(false)

  useEffect(() => {
    // Only verify on initial mount, not on every route change
    if (hasVerifiedRef.current) {
      return
    }

    const verifyToken = async () => {
      setLoading(true)
      try {
        const response = await fetch('http://localhost:3000/api/auth/verify', {
          method: 'GET',
          credentials: 'include', // Important: sends cookies
        })

        const data = await response.json()

        if (response.ok && data.success && data.user?.role === 'siteadmin') {
          setIsAuthenticated(true)
          hasVerifiedRef.current = true
        } else {
          setIsAuthenticated(false)
          hasVerifiedRef.current = false
        }
      } catch (error) {
        console.error('Token verification error:', error)
        setIsAuthenticated(false)
        hasVerifiedRef.current = false
      } finally {
        setLoading(false)
      }
    }

    verifyToken()
    // Only verify on mount, not on every pathname change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-primary">
        <div className="text-secondary text-lg">Loading...</div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  return children
}

export default ProtectedRoute

