import { Navigate, useLocation } from 'react-router-dom'
import Box from '@mui/material/Box'
import CircularProgress from '@mui/material/CircularProgress'
import Typography from '@mui/material/Typography'
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
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 1.5,
          bgcolor: 'background.default',
          color: 'text.secondary',
        }}
      >
        <CircularProgress color="secondary" />
        <Typography variant="body2">Loading your workspace…</Typography>
      </Box>
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
