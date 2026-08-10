import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

/** Legacy siteadmin-only gate. Prefer RoleBasedProtectedRoute. */
function ProtectedRoute({ children }) {
  const location = useLocation()
  const {
    loading,
    isAuthenticated,
    role,
    requiresPasswordUpdate,
  } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-primary">
        <div className="text-secondary text-lg">Loading...</div>
      </div>
    )
  }

  if (!isAuthenticated || role !== 'siteadmin') {
    return <Navigate to="/login" replace />
  }

  if (requiresPasswordUpdate && location.pathname !== '/update-password') {
    return <Navigate to="/update-password" replace state={{ from: location }} />
  }

  return children
}

export default ProtectedRoute
