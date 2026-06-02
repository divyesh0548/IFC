import './index.css'
import { useEffect, useState, lazy, Suspense } from 'react'
import { Navigate, Routes, Route, useLocation } from 'react-router-dom'
import { useTheme } from '@mui/material/styles'
import LinearProgress from '@mui/material/LinearProgress'
import Box from '@mui/material/Box'
import CircularProgress from '@mui/material/CircularProgress'
import RoleBasedProtectedRoute from './components/RoleBasedProtectedRoute'
import { Toaster } from 'react-hot-toast'
import { GlobalLoadingProvider, useGlobalLoading } from './contexts/GlobalLoadingContext'
import { apiUrl } from './config/api'

const Home = lazy(() => import('./pages/Home'))
const Login = lazy(() => import('./pages/Login'))
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'))
const UpdatePassword = lazy(() => import('./pages/UpdatePassword'))

const Company_Management = lazy(() => import('./pages/siteadmin/Company_Management'))
const CompanyCreation = lazy(() => import('./pages/siteadmin/CompanyCreation'))
const CompanyDetail = lazy(() => import('./pages/siteadmin/CompanyDetail'))
const AuditorManagement = lazy(() => import('./pages/siteadmin/AuditorManagement'))
const Siteadmin_Dashboard = lazy(() => import('./pages/siteadmin/Siteadmin_dashboard'))
const SiteadminBusinessProcessManagement = lazy(() => import('./pages/siteadmin/BusinessProcessManagement'))

const AuditorHome = lazy(() => import('./pages/auditor/Auditor_Home'))
const Auditor_dashboard = lazy(() => import('./pages/auditor/Auditor_dashboard'))
const AuditorRacmDashboard = lazy(() => import('./pages/auditor/AuditorRacmDashboard'))
const AuditorFormDetail = lazy(() => import('./pages/auditor/AuditorFormDetail'))

const User_dashboard = lazy(() => import('./pages/user/User_dashboard'))
const UserHome = lazy(() => import('./pages/user/UserHome'))
const UserFormDetail = lazy(() => import('./pages/user/UserFormDetail'))

const Company_Co_dashboard = lazy(() => import('./pages/company_co/Company_co_dashboard'))
const RacmAssignment = lazy(() => import('./pages/company_co/RacmAssignment'))
const UserManagement = lazy(() => import('./pages/company_co/User_Management'))
const UnitManagement = lazy(() => import('./pages/company_co/UnitManagement'))
const ExcelUpload = lazy(() => import('./pages/forms/ExcelUpload'))
const ExcelColumnMap = lazy(() => import('./pages/forms/ExcelColumnMap'))
const FormDetail = lazy(() => import('./pages/company_co/FormDetail'))
const CreateControlForm = lazy(() => import('./pages/company_co/CreateControlForm'))
const RacmManagementDashboard = lazy(() => import('./pages/company_co/RacmManagementDashboard'))
const CommunicationMatrix = lazy(() => import('./pages/company_co/CommunicationMatrix'))
const CompanyCoordinatorBusinessProcessManagement = lazy(() => import('./pages/company_co/BusinessProcessManagement'))
const Company_co_home = lazy(() => import('./pages/company_co/Company_co_home'))
const CreateUser = lazy(() => import('./pages/company_co/CreateUser'))
const UnclassifiedControls = lazy(() => import('./pages/company_co/UnclassifiedControls'))
const KeyManualAiInsightsSummary = lazy(() => import('./pages/company_co/KeyManualAiInsightsSummary'))

const ApproverHome = lazy(() => import('./pages/approver/ApproverHome'))
const ApproverDashboard = lazy(() => import('./pages/approver/ApproverDashboard'))
const ApproverFormDetail = lazy(() => import('./pages/approver/ApproverFormDetail'))

const DashboardLayout = lazy(() => import('./components/DashboardLayout'))
const ProfilePage = lazy(() => import('./pages/ProfilePage'))

function RouteLoadingFallback() {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '40vh',
        width: '100%',
      }}
    >
      <CircularProgress color="secondary" />
    </Box>
  )
}

function GlobalLoadingStrip() {
  const theme = useTheme()
  const { active } = useGlobalLoading()
  const location = useLocation()
  const onDashboardRoute =
    location.pathname.startsWith('/siteadmin') ||
    location.pathname.startsWith('/auditor') ||
    location.pathname.startsWith('/approver') ||
    location.pathname.startsWith('/user') ||
    location.pathname.startsWith('/company_co')
  const hasMountedNavbar =
    typeof document !== 'undefined' &&
    document.body.classList.contains('has-dashboard-navbar')
  if (onDashboardRoute && !hasMountedNavbar) {
    return null
  }
  if (!hasMountedNavbar) {
    return null
  }
  const topOffset = { xs: 56, sm: 64 }
  if (!active) {
    return null
  }
  const baseStripStyles = {
    position: 'fixed',
    left: 0,
    right: 0,
    top: topOffset,
    height: 4,
    zIndex: 2000,
    borderRadius: 0,
  }
  return (
    <LinearProgress
      color="secondary"
      sx={
        theme.palette.mode === 'dark'
          ? {
              ...baseStripStyles,
              backgroundColor: 'rgba(255, 255, 255, 0.18)',
              '& .MuiLinearProgress-bar': {
                backgroundColor: theme.palette.primary.light,
              },
            }
          : {
              ...baseStripStyles,
              backgroundColor: theme.palette.divider,
              boxShadow: `inset 0 -1px 0 ${theme.palette.navbar.bottomBorder}`,
              '& .MuiLinearProgress-bar': {
                backgroundColor: theme.palette.primary.main,
              },
            }
      }
    />
  )
}

const ROLE_HOME_ROUTES = {
  user: '/user/home',
  company_co: '/company_co/home',
  approver: '/approver/home',
  auditor: '/auditor/home',
  siteadmin: '/siteadmin/dashboard',
}

function RouteFallbackRedirect() {
  const [redirectPath, setRedirectPath] = useState(null)

  useEffect(() => {
    let cancelled = false

    const resolveRedirect = async () => {
      try {
        const response = await fetch(apiUrl('/api/auth/verify'), {
          method: 'GET',
          credentials: 'include',
        })
        const data = await response.json()

        if (cancelled) return

        if (response.ok && data.success) {
          const role = String(data.user?.role || '').trim()
          setRedirectPath(ROLE_HOME_ROUTES[role] || '/')
          return
        }
      } catch (error) {
        if (!cancelled) {
          console.error('Error verifying auth token for route fallback:', error)
        }
      }

      if (!cancelled) {
        setRedirectPath('/login')
      }
    }

    resolveRedirect()

    return () => {
      cancelled = true
    }
  }, [])

  if (!redirectPath) {
    return null
  }

  return <Navigate to={redirectPath} replace />
}

function App() {
  return (
    <GlobalLoadingProvider>
      <GlobalLoadingStrip />
      <div className='scrollbar'>
        <Toaster />
        <Suspense fallback={<RouteLoadingFallback />}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />

            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route
              path="/update-password"
              element={
                <RoleBasedProtectedRoute allowedRoles={[]}>
                  <UpdatePassword />
                </RoleBasedProtectedRoute>
              }
            />

            {/* Siteadmin Routes */}
            <Route
              path="/siteadmin/*"
              element={
                <RoleBasedProtectedRoute allowedRoles={['siteadmin']}>
                  <DashboardLayout />
                </RoleBasedProtectedRoute>
              }
            >
              <Route index element={<Navigate to={ROLE_HOME_ROUTES.siteadmin} replace />} />
              <Route path="dashboard" element={<Siteadmin_Dashboard />} />
              <Route path="profile" element={<ProfilePage />} />
              <Route path="company-management" element={<Company_Management />} />
              <Route path="auditors" element={<AuditorManagement />} />
              <Route path="create-company" element={<CompanyCreation />} />
              <Route path="business-processes" element={<SiteadminBusinessProcessManagement />} />
              <Route path="company/:company_identifier" element={<CompanyDetail />} />
              <Route path="*" element={<Navigate to={ROLE_HOME_ROUTES.siteadmin} replace />} />
            </Route>

            {/* Auditor Routes */}
            <Route
              path="/auditor/*"
              element={
                <RoleBasedProtectedRoute allowedRoles={['auditor']}>
                  <DashboardLayout />
                </RoleBasedProtectedRoute>
              }
            >
              <Route index element={<Navigate to={ROLE_HOME_ROUTES.auditor} replace />} />
              <Route path="home" element={<AuditorHome />} />
              <Route path="dashboard" element={<Auditor_dashboard />} />
              <Route path="companies" element={<Auditor_dashboard />} />
              <Route path="users" element={<Auditor_dashboard />} />
              <Route path="racms" element={<AuditorRacmDashboard />} />
              <Route path="form/:form_id" element={<AuditorFormDetail />} />
              <Route path="profile" element={<ProfilePage />} />
              <Route path="*" element={<Navigate to={ROLE_HOME_ROUTES.auditor} replace />} />
            </Route>

            {/* Approver Routes */}
            <Route
              path="/approver/*"
              element={
                <RoleBasedProtectedRoute allowedRoles={['approver']}>
                  <DashboardLayout />
                </RoleBasedProtectedRoute>
              }
            >
              <Route index element={<Navigate to={ROLE_HOME_ROUTES.approver} replace />} />
              <Route path="home" element={<ApproverHome />} />
              <Route path="dashboard" element={<ApproverDashboard />} />
              <Route path="form/:form_id" element={<ApproverFormDetail />} />
              <Route path="profile" element={<ProfilePage />} />
              <Route path="*" element={<Navigate to={ROLE_HOME_ROUTES.approver} replace />} />
            </Route>

            {/* User Routes */}
            <Route
              path="/user/*"
              element={
                <RoleBasedProtectedRoute allowedRoles={['user']}>
                  <DashboardLayout />
                </RoleBasedProtectedRoute>
              }
            >
              <Route index element={<Navigate to={ROLE_HOME_ROUTES.user} replace />} />
              <Route path="home" element={<UserHome />} />
              <Route path="dashboard" element={<User_dashboard />} />
              <Route path="form/:form_id" element={<UserFormDetail />} />
              <Route path="profile" element={<ProfilePage />} />
              <Route path="*" element={<Navigate to={ROLE_HOME_ROUTES.user} replace />} />
            </Route>

            {/* Company Coordinator Routes */}
            <Route
              path="/company_co/*"
              element={
                <RoleBasedProtectedRoute allowedRoles={['company_co']}>
                  <DashboardLayout />
                </RoleBasedProtectedRoute>
              }
            >
              <Route index element={<Navigate to={ROLE_HOME_ROUTES.company_co} replace />} />
              <Route path="home" element={<Company_co_home />} />
              <Route path="dashboard" element={<Company_Co_dashboard />} />
              <Route path="racm-dashboard" element={<Company_Co_dashboard />} />
              <Route path="unclassified-controls" element={<UnclassifiedControls />} />
              <Route path="key-manual-ai-insights" element={<KeyManualAiInsightsSummary />} />
              <Route path="racm-management" element={<RacmManagementDashboard />} />
              <Route path="communication-matrix" element={<CommunicationMatrix />} />
              <Route path="business-processes" element={<CompanyCoordinatorBusinessProcessManagement />} />
              <Route path="racm-assignment" element={<RacmAssignment />} />
              <Route path="user-management" element={<UserManagement />} />
              <Route path="unit-management" element={<UnitManagement />} />
              <Route path="create-user" element={<CreateUser />} />
              <Route path="upload-excel" element={<ExcelUpload />} />
              <Route path="upload-excel/column-map" element={<ExcelColumnMap />} />
              <Route path="create-form" element={<CreateControlForm />} />
              <Route path="form/:form_id" element={<FormDetail />} />
              <Route path="profile" element={<ProfilePage />} />
              <Route path="*" element={<Navigate to={ROLE_HOME_ROUTES.company_co} replace />} />
            </Route>

            <Route path="*" element={<RouteFallbackRedirect />} />
          </Routes>
        </Suspense>
      </div>
    </GlobalLoadingProvider>
  )
}

export default App
