import { useState, useEffect } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useSyncGlobalLoading } from '../contexts/GlobalLoadingContext'
import { apiUrl } from '../config/api'

function RoleBasedProtectedRoute({ children, allowedRoles = [] }) {
  const [isAuthenticated, setIsAuthenticated] = useState(null)
  const [userRole, setUserRole] = useState(null)
  const [requiresPasswordUpdate, setRequiresPasswordUpdate] = useState(false)
  const [loading, setLoading] = useState(true)
  const [verifiedPath, setVerifiedPath] = useState(null)
  const location = useLocation()
  useSyncGlobalLoading(loading)

  useEffect(() => {
    let cancelled = false
    const pathBeingVerified = location.pathname

    const verifyToken = async () => {
      setLoading(true)
      try {
        // Use unified verify endpoint
        const response = await fetch(apiUrl('/api/auth/verify'), {
          method: 'GET',
          credentials: 'include',
        })

        const data = await response.json()

        if (cancelled) return

        if (response.ok && data.success) {
          setIsAuthenticated(true)
          setUserRole(data.user.role)
          setRequiresPasswordUpdate(Boolean(data.requiresPasswordUpdate))
        } else {
          // Verification failed
          setIsAuthenticated(false)
          setUserRole(null)
          setRequiresPasswordUpdate(false)
        }
      } catch (error) {
        if (cancelled) return
        console.error('Token verification error:', error)
        setIsAuthenticated(false)
        setUserRole(null)
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
    // Redirect to unified login page
    return <Navigate to="/login" replace />
  }

  if (requiresPasswordUpdate && location.pathname !== '/update-password') {
    return <Navigate to="/update-password" replace state={{ from: location }} />
  }

  // Check if user role is allowed
  if (allowedRoles.length > 0 && !allowedRoles.includes(userRole)) {
    // Redirect based on role to appropriate dashboard
    const roleDashboards = {
      'user': '/user/home',
      'company_co': '/company_co/home',
      'approver': '/approver/home',
      'siteadmin': '/siteadmin/dashboard',
      'auditor': '/auditor/home'
    }
    
    const redirectPath = roleDashboards[userRole] || '/login'
    return <Navigate to={redirectPath} replace />
  }

  return children
}

export default RoleBasedProtectedRoute

