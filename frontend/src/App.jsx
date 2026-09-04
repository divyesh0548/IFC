import './index.css'
import { useEffect, lazy, Suspense } from 'react'
import { Navigate, Routes, Route, useLocation } from 'react-router-dom'
import { alpha, useTheme } from '@mui/material/styles'
import LinearProgress from '@mui/material/LinearProgress'
import Box from '@mui/material/Box'
import CircularProgress from '@mui/material/CircularProgress'
import RoleBasedProtectedRoute from './components/RoleBasedProtectedRoute'
import { Toaster } from 'react-hot-toast'
import { GlobalLoadingProvider, useGlobalLoading } from './contexts/GlobalLoadingContext'
import { useAuth } from './contexts/AuthContext'
import { installGlobalAuthSessionHandler } from './utils/authSession'

const Home = lazy(() => import('./pages/Home'))
const Login = lazy(() => import('./pages/Login'))
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'))
const UpdatePassword = lazy(() => import('./pages/UpdatePassword'))

const Company_Management = lazy(() => import('./pages/siteadmin/Company_Management'))
const CompanyCreation = lazy(() => import('./pages/siteadmin/CompanyCreation'))
const CompanyDetail = lazy(() => import('./pages/siteadmin/CompanyDetail'))
const AuditorManagement = lazy(() => import('./pages/siteadmin/AuditorManagement'))
const Siteadmin_Dashboard = lazy(() => import('./pages/siteadmin/Siteadmin_Dashboard'))
const SiteadminBusinessProcessManagement = lazy(() => import('./pages/siteadmin/BusinessProcessManagement'))
const ControlsLibraryUpload = lazy(() => import('./pages/siteadmin/ControlsLibraryUpload'))
const ControlsLibrary = lazy(() => import('./pages/siteadmin/ControlsLibrary'))
const ControlsLibraryEdit = lazy(() => import('./pages/siteadmin/ControlsLibraryEdit'))
const UserQueries = lazy(() => import('./pages/siteadmin/UserQueries'))

const AuditorHome = lazy(() => import('./pages/auditor/Auditor_Home'))
const Auditor_dashboard = lazy(() => import('./pages/auditor/Auditor_dashboard'))
const AuditorRacmDashboard = lazy(() => import('./pages/auditor/AuditorRacmDashboard'))
const AuditorFormDetail = lazy(() => import('./pages/auditor/AuditorFormDetail'))

const User_dashboard = lazy(() => import('./pages/user/User_dashboard'))
const UserHome = lazy(() => import('./pages/user/UserHome'))
const UserFormDetail = lazy(() => import('./pages/user/UserFormDetail'))

const ControlDispersionDashboard = lazy(() => import('./pages/company_co/Company_co_control_dispersion'))
const RacmAssignment = lazy(() => import('./pages/company_co/RacmAssignment'))
const UserManagement = lazy(() => import('./pages/company_co/User_Management'))
const Controls_Creation = lazy(() => import('./pages/forms/Controls_Creation'))
const ExcelColumnMap = lazy(() => import('./pages/forms/ExcelColumnMap'))
const FormDetail = lazy(() => import('./pages/company_co/FormDetail'))
const CreateControlForm = lazy(() => import('./pages/company_co/CreateControlForm'))
const CreateControlFormFromLibrary = lazy(() => import('./pages/company_co/CreateControlFormFromLibrary'))
const RacmManagementDashboard = lazy(() => import('./pages/company_co/RacmManagementDashboard'))
const CompanyCoIfcReport = lazy(() => import('./pages/company_co/IfcReport'))
const RacmUserDocuments = lazy(() => import('./pages/company_co/RacmUserDocuments'))
const CommunicationMatrix = lazy(() => import('./pages/company_co/CommunicationMatrix'))
const EmailCustomization = lazy(() => import('./pages/company_co/EmailCustomization'))
const Company_co_home = lazy(() => import('./pages/company_co/Company_co_home'))
const RacmTemplates = lazy(() => import('./pages/company_co/RacmTemplates'))
const CreateUser = lazy(() => import('./pages/company_co/CreateUser'))
const UnclassifiedControls = lazy(() => import('./pages/company_co/UnclassifiedControls'))
const KeyManualAiInsightsSummary = lazy(() => import('./pages/company_co/KeyManualAiInsightsSummary'))
const RiskAnalysis = lazy(() => import('./pages/company_co/RiskAnalysis'))
const CompanyDetailsPage = lazy(() => import('./pages/CompanyDetailsPage'))
const CompanyAdminHome = lazy(() => import('./pages/company_admin/companyAdminHome'))
const CompanyAdminBusinessProcessManagement = lazy(() => import('./pages/company_admin/BusinessProcessManagement'))
const CompanyAdminUserManagement = lazy(() => import('./pages/company_admin/CompanyAdminUserManagement'))
const CompanyAdminCreateUser = lazy(() => import('./pages/company_admin/CompanyAdminCreateUser'))
const CompanyAdminUnitManagement = lazy(() => import('./pages/company_admin/CompanyAdminUnitManagement'))
const CompanyAdminApproverManagement = lazy(() => import('./pages/company_admin/CompanyAdminApproverManagement'))
const CompanyAdminRacmDashboard = lazy(() => import('./pages/company_admin/CompanyAdminRacmDashboard'))
const CompanyAdminIfcReport = lazy(() => import('./pages/company_admin/IfcReport'))
const CompanyAdminFormDetail = lazy(() => import('./pages/company_admin/CompanyAdminFormDetail'))

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
    location.pathname.startsWith('/company-co') ||
    location.pathname.startsWith('/company_admin')
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
    zIndex: theme.zIndex.drawer + 1,
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
  company_co: '/company-co/home',
  company_admin: '/company_admin/home',
  approver: '/approver/home',
  auditor: '/auditor/home',
  siteadmin: '/siteadmin/dashboard',
}

function CompanyCoLegacyPathRedirect() {
  const location = useLocation()
  const nextPath = `${location.pathname.replace(/^\/company_co(?=\/|$)/, '/company-co')}${location.search}${location.hash}`
  return <Navigate to={nextPath} replace />
}

function RouteFallbackRedirect() {
  const { loading, isAuthenticated, role } = useAuth()

  if (loading) {
    return null
  }

  if (isAuthenticated) {
    return <Navigate to={ROLE_HOME_ROUTES[role] || '/'} replace />
  }

  return <Navigate to="/" replace />
}

function App() {
  const theme = useTheme()

  useEffect(() => {
    installGlobalAuthSessionHandler()
  }, [])

  return (
    <GlobalLoadingProvider>
      <GlobalLoadingStrip />
      <div className='scrollbar'>
        <Toaster
          toastOptions={{
            style: {
              width: 'max-content',
              minWidth: '150px',
              maxWidth: 'min(92vw, 960px)',
              whiteSpace: 'nowrap',
              backgroundColor:
                theme.palette.mode === 'dark'
                  ? alpha(theme.palette.background.paper, 0.96)
                  : alpha(theme.palette.background.paper, 0.98),
              color: theme.palette.text.primary,
              border: `1px solid ${
                theme.palette.mode === 'dark'
                  ? 'rgba(255,255,255,0.10)'
                  : 'rgba(15,23,42,0.08)'
              }`,
              boxShadow:
                theme.palette.mode === 'dark'
                  ? '0 10px 28px rgba(0,0,0,0.28)'
                  : '0 10px 28px rgba(15,23,42,0.10)',
            },
          }}
        />
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
              <Route path="controls-library" element={<ControlsLibrary />} />
              <Route path="controls-library/upload" element={<ControlsLibraryUpload />} />
              <Route path="controls-library/:id" element={<ControlsLibraryEdit />} />
              <Route path="user-queries" element={<UserQueries />} />
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
              <Route path="company-details" element={<CompanyDetailsPage />} />
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
              <Route path="company-details" element={<CompanyDetailsPage />} />
              <Route path="dashboard" element={<User_dashboard />} />
              <Route path="form/:form_id" element={<UserFormDetail />} />
              <Route path="profile" element={<ProfilePage />} />
              <Route path="*" element={<Navigate to={ROLE_HOME_ROUTES.user} replace />} />
            </Route>

            <Route path="/company_co/*" element={<CompanyCoLegacyPathRedirect />} />

            {/* Company Coordinator Routes */}
            <Route
              path="/company-co/*"
              element={
                <RoleBasedProtectedRoute allowedRoles={['company_co']}>
                  <DashboardLayout />
                </RoleBasedProtectedRoute>
              }
            >
              <Route index element={<Navigate to={ROLE_HOME_ROUTES.company_co} replace />} />
              <Route path="home" element={<Company_co_home />} />
              {/* <Route path="dashboard" element={<Company_Co_dashboard />} /> */}
              <Route path="control-dispersion-dashboard" element={<ControlDispersionDashboard />} />
              <Route path="unclassified-controls" element={<UnclassifiedControls />} />
              <Route path="key-manual-ai-insights" element={<KeyManualAiInsightsSummary />} />
              <Route path="risk-analysis" element={<RiskAnalysis />} />
              <Route path="racm-management" element={<RacmManagementDashboard />} />
              <Route path="ifc-report" element={<CompanyCoIfcReport />} />
              <Route path="racm-user-documents" element={<RacmUserDocuments />} />
              <Route path="racm-communication" element={<CommunicationMatrix />} />
              <Route path="email-customization" element={<EmailCustomization />} />
              <Route path="racm-templates" element={<RacmTemplates />} />
              <Route path="racm-assignment" element={<RacmAssignment />} />
              <Route path="user-management" element={<UserManagement />} />
              <Route path="user-management/create-user" element={<CreateUser />} />
              <Route path="create-user" element={<Navigate to="/company-co/user-management/create-user" replace />} />
              <Route path="company-details" element={<CompanyDetailsPage />} />
              <Route path="control-creation" element={<Controls_Creation />} />
              <Route path="control-creation/column-map" element={<ExcelColumnMap />} />
              <Route path="manual-control-creation" element={<CreateControlForm />} />
              <Route path="library-control-creation" element={<CreateControlFormFromLibrary />} />
              <Route path="form/:form_id" element={<FormDetail />} />
              <Route path="profile" element={<ProfilePage />} />
              <Route path="*" element={<Navigate to={ROLE_HOME_ROUTES.company_co} replace />} />
            </Route>

            <Route
              path="/company_admin/*"
              element={
                <RoleBasedProtectedRoute allowedRoles={['company_admin']}>
                  <DashboardLayout />
                </RoleBasedProtectedRoute>
              }
            >
              <Route index element={<Navigate to={ROLE_HOME_ROUTES.company_admin} replace />} />
              <Route path="home" element={<CompanyAdminHome />} />
              <Route path="company-details" element={<CompanyDetailsPage />} />
              <Route path="business-processes" element={<CompanyAdminBusinessProcessManagement />} />
              <Route path="user-management" element={<CompanyAdminUserManagement />} />
              <Route path="create-user" element={<CompanyAdminCreateUser />} />
              <Route path="unit-management" element={<CompanyAdminUnitManagement />} />
              <Route path="approver-management" element={<CompanyAdminApproverManagement />} />
              <Route path="racms" element={<CompanyAdminRacmDashboard />} />
              <Route path="ifc-report" element={<CompanyAdminIfcReport />} />
              <Route path="form/:form_id" element={<CompanyAdminFormDetail />} />
              <Route path="profile" element={<ProfilePage />} />
              <Route path="*" element={<Navigate to={ROLE_HOME_ROUTES.company_admin} replace />} />
            </Route>

            <Route path="*" element={<RouteFallbackRedirect />} />
          </Routes>
        </Suspense>
      </div>
    </GlobalLoadingProvider>
  )
}

export default App
