import { Navigate, useLocation } from 'react-router-dom'
import { useSyncGlobalLoading } from '../contexts/GlobalLoadingContext'
import { useAuth } from '../contexts/AuthContext'

const ROLE_DASHBOARDS = {
  user: '/user/home',
  company_co: '/company-co/home',
  company_admin: '/company_admin/home',
  approver: '/approver/home',
  siteadmin: '/siteadmin/dashboard',
  auditor: '/auditor/home',
}

function RoleBasedProtectedRoute({ children, allowedRoles = [] }) {
  const location = useLocation()
  const {
    loading,
    isAuthenticated,
    role: userRole,
    requiresPasswordUpdate,
  } = useAuth()

  useSyncGlobalLoading(loading)

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

  if (requiresPasswordUpdate && location.pathname !== '/update-password') {
    return <Navigate to="/update-password" replace state={{ from: location }} />
  }

  if (allowedRoles.length > 0 && !allowedRoles.includes(userRole)) {
    const redirectPath = ROLE_DASHBOARDS[userRole] || '/login'
    return <Navigate to={redirectPath} replace />
  }

  return children
}

export default RoleBasedProtectedRoute
