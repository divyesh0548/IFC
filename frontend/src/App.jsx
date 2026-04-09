import './index.css'
import Home from './pages/Home'
import Login from './pages/Login'
import { Routes, Route, useLocation } from 'react-router-dom'
import { useTheme } from '@mui/material/styles'
import LinearProgress from '@mui/material/LinearProgress'
import Company_Management from './pages/siteadmin/Company_Management'
import CompanyCreation from './pages/siteadmin/CompanyCreation'
import CompanyDetail from './pages/siteadmin/CompanyDetail'
import Siteadmin_Dashboard from './pages/siteadmin/Siteadmin_dashboard'
import Auditor_dashboard from './pages/auditor/Auditor_dashboard'
import User_dashboard from './pages/user/User_dashboard'
import ForgotPassword from './pages/ForgotPassword'
import UpdatePassword from './pages/UpdatePassword'
import RoleBasedProtectedRoute from './components/RoleBasedProtectedRoute'
import Company_Co_dashboard from './pages/company_co/Company_co_dashboard'
import RacmAssignment from './pages/company_co/RacmAssignment'
import UserManagement from './pages/company_co/User_Management'
import ExcelUpload from './pages/forms/ExcelUpload'
import FormDetail from './pages/company_co/FormDetail'
import CreateControlForm from './pages/company_co/CreateControlForm'
import RacmManagementDashboard from './pages/company_co/RacmManagementDashboard'
import ApproverHome from './pages/approver/ApproverHome'
import ApproverDashboard from './pages/approver/ApproverDashboard'
import ApproverFormDetail from './pages/approver/ApproverFormDetail'
import UserFormDetail from './pages/user/UserFormDetail'
import DashboardLayout from './components/DashboardLayout'
import Company_co_home from './pages/company_co/Company_co_home'
import ProfilePage from './pages/ProfilePage'
import { Toaster } from 'react-hot-toast'
import { GlobalLoadingProvider, useGlobalLoading } from './contexts/GlobalLoadingContext'

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

function App() {
  return (
    <GlobalLoadingProvider>
      <GlobalLoadingStrip />
      <div className='scrollbar'>
        <Toaster />
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
          <Route path="dashboard" element={<Siteadmin_Dashboard />} />
          <Route path="profile" element={<ProfilePage />} />
          <Route path="company-management" element={<Company_Management />} />
          <Route path="create-company" element={<CompanyCreation />} />
          <Route path="company/:company_identifier" element={<CompanyDetail />} />
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
          <Route path="dashboard" element={<Auditor_dashboard />} />
          <Route path="profile" element={<ProfilePage />} />
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
          <Route path="home" element={<ApproverHome />} />
          <Route path="dashboard" element={<ApproverDashboard />} />
          <Route path="form/:form_id" element={<ApproverFormDetail />} />
          <Route path="profile" element={<ProfilePage />} />
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
          <Route path="dashboard" element={<User_dashboard />} />
          <Route path="form/:form_id" element={<UserFormDetail />} />
          <Route path="profile" element={<ProfilePage />} />
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
          <Route path="home" element={<Company_co_home />} />
          <Route path="dashboard" element={<Company_Co_dashboard />} />
          <Route path="racm-management" element={<RacmManagementDashboard />} />
          <Route path="racm-assignment" element={<RacmAssignment />} />
          <Route path="user-management" element={<UserManagement />} />
          <Route path="upload-excel" element={<ExcelUpload />} />
          <Route path="create-form" element={<CreateControlForm />} />
          <Route path="form/:form_id" element={<FormDetail />} />
          <Route path="profile" element={<ProfilePage />} />
        </Route>
        
        </Routes>
      </div>
    </GlobalLoadingProvider>
  )
}

export default App
