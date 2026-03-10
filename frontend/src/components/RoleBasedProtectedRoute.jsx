import { useState, useEffect, useRef } from 'react'
import { Navigate, useLocation } from 'react-router-dom'

function RoleBasedProtectedRoute({ children, allowedRoles = [] }) {
  const [isAuthenticated, setIsAuthenticated] = useState(null)
  const [userRole, setUserRole] = useState(null)
  const [loading, setLoading] = useState(true)
  const location = useLocation()
  const hasVerifiedRef = useRef(false)

  useEffect(() => {
    // Only verify on initial mount, not on every route change
    // Skip verification if we've already verified successfully
    if (hasVerifiedRef.current) {
      return
    }

    const verifyToken = async () => {
      setLoading(true)
      try {
        // Use unified verify endpoint
        const response = await fetch('http://localhost:3000/api/auth/verify', {
          method: 'GET',
          credentials: 'include',
        })

        const data = await response.json()

        if (response.ok && data.success) {
          setIsAuthenticated(true)
          setUserRole(data.user.role)
          setLoading(false)
          hasVerifiedRef.current = true
        } else {
          // Verification failed
          setIsAuthenticated(false)
          setUserRole(null)
          hasVerifiedRef.current = false
          setLoading(false)
        }
      } catch (error) {
        console.error('Token verification error:', error)
        setIsAuthenticated(false)
        setUserRole(null)
        hasVerifiedRef.current = false
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
    // Redirect to unified login page
    return <Navigate to="/login" replace />
  }

  // Check if user role is allowed
  if (allowedRoles.length > 0 && !allowedRoles.includes(userRole)) {
    // Redirect based on role to appropriate dashboard
    const roleDashboards = {
      'user': '/user/dashboard',
      'company_co': '/company_co/home',
      'approver': '/approver/dashboard',
      'siteadmin': '/siteadmin/dashboard',
      'auditor': '/auditor/dashboard'
    }
    
    const redirectPath = roleDashboards[userRole] || '/login'
    return <Navigate to={redirectPath} replace />
  }

  return children
}

export default RoleBasedProtectedRoute

