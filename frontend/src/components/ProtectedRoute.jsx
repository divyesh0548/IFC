import { useState, useEffect } from 'react'
import { Navigate, useLocation } from 'react-router-dom'

function ProtectedRoute({ children }) {
  const [isAuthenticated, setIsAuthenticated] = useState(null)
  const [requiresPasswordUpdate, setRequiresPasswordUpdate] = useState(false)
  const [loading, setLoading] = useState(true)
  const [verifiedPath, setVerifiedPath] = useState(null)
  const location = useLocation()

  useEffect(() => {
    let cancelled = false
    const pathBeingVerified = location.pathname

    const verifyToken = async () => {
      setLoading(true)
      try {
        const response = await fetch('http://localhost:3000/api/auth/verify', {
          method: 'GET',
          credentials: 'include', // Important: sends cookies
        })

        const data = await response.json()

        if (cancelled) return

        if (response.ok && data.success && data.user?.role === 'siteadmin') {
          setIsAuthenticated(true)
          setRequiresPasswordUpdate(Boolean(data.requiresPasswordUpdate))
        } else {
          setIsAuthenticated(false)
          setRequiresPasswordUpdate(false)
        }
      } catch (error) {
        if (cancelled) return
        console.error('Token verification error:', error)
        setIsAuthenticated(false)
        setRequiresPasswordUpdate(false)
      } finally {
        if (!cancelled) {
          setVerifiedPath(pathBeingVerified)
          setLoading(false)
        }
      }
    }

    verifyToken()

    return () => {
      cancelled = true
    }
  }, [location.pathname])

  if (loading || verifiedPath !== location.pathname) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-primary">
        <div className="text-secondary text-lg">Loading...</div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  if (requiresPasswordUpdate && location.pathname !== '/update-password') {
    return <Navigate to="/update-password" replace state={{ from: location }} />
  }

  return children
}

export default ProtectedRoute

