import { useState, useEffect } from 'react'
import { Navigate, useLocation } from 'react-router-dom'

function RoleBasedProtectedRoute({ children, allowedRoles = [] }) {
  const [isAuthenticated, setIsAuthenticated] = useState(null)
  const [userRole, setUserRole] = useState(null)
  const [loading, setLoading] = useState(true)
  const location = useLocation()

  useEffect(() => {
    const verifyToken = async () => {
      setLoading(true)
      try {
        // Try to verify as user first (check userAuthToken)
        let response = await fetch('http://localhost:3000/api/auth/user/verify', {
          method: 'GET',
          credentials: 'include',
        })

        let data = await response.json()

        if (response.ok && data.success) {
          setIsAuthenticated(true)
          setUserRole(data.user.role)
          setLoading(false)
          return
        }

        // If user verification fails, try siteadmin verification
        response = await fetch('http://localhost:3000/api/auth/siteadmin/verify', {
          method: 'GET',
          credentials: 'include',
        })

        data = await response.json()

        if (response.ok && data.success) {
          setIsAuthenticated(true)
          setUserRole('siteadmin') // Siteadmin doesn't have role in token, so set it explicitly
          setLoading(false)
          return
        }

        // Both verifications failed
        setIsAuthenticated(false)
        setUserRole(null)
      } catch (error) {
        console.error('Token verification error:', error)
        setIsAuthenticated(false)
        setUserRole(null)
      } finally {
        setLoading(false)
      }
    }

    verifyToken()
  }, [location.pathname])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-primary">
        <div className="text-secondary text-lg">Loading...</div>
      </div>
    )
  }

  if (!isAuthenticated) {
    // Redirect to appropriate login based on route
    if (location.pathname.startsWith('/user')) {
      return <Navigate to="/user/login" replace />
    }
    return <Navigate to="/siteadmin/login" replace />
  }

  // Check if user role is allowed
  if (allowedRoles.length > 0 && !allowedRoles.includes(userRole)) {
    // Redirect based on role
    if (userRole === 'siteadmin') {
      return <Navigate to="/siteadmin/dashboard" replace />
    }
    else if (userRole === 'user') {
      return <Navigate to="/user/dashboard" replace />
    }
    else if (userRole === 'company_co') {
      return <Navigate to="/company_co/dashboard" replace />
    }
    else {
      return <Navigate to="/login" replace />
    }
  }

  return children
}

export default RoleBasedProtectedRoute

