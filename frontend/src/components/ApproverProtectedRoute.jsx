import { useState, useEffect } from 'react'
import { Navigate, useLocation } from 'react-router-dom'

function ApproverProtectedRoute({ children }) {
  const [isAuthenticated, setIsAuthenticated] = useState(null)
  const [loading, setLoading] = useState(true)
  const location = useLocation()

  useEffect(() => {
    const verifyToken = async () => {
      setLoading(true)
      try {
        const response = await fetch('http://localhost:3000/api/auth/approver/verify', {
          method: 'GET',
          credentials: 'include', // Important: sends cookies
        })

        const data = await response.json()

        if (response.ok && data.success) {
          setIsAuthenticated(true)
        } else {
          setIsAuthenticated(false)
        }
      } catch (error) {
        console.error('Token verification error:', error)
        setIsAuthenticated(false)
      } finally {
        setLoading(false)
      }
    }

    verifyToken()
  }, [location.pathname]) // Re-verify when route changes

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-primary">
        <div className="text-secondary text-lg">Loading...</div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/approver/login" replace />
  }

  return children
}

export default ApproverProtectedRoute

