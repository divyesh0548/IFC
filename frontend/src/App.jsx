import { useState } from 'react'
import './index.css'
import Home from './pages/Home'
import Login from './pages/Login'
import { Routes, Route } from 'react-router-dom'
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
import CreateUser from './pages/company_co/CreateUser'
import ExcelUpload from './pages/forms/ExcelUpload'
import FormDetail from './pages/company_co/FormDetail'
import CreateControlForm from './pages/company_co/CreateControlForm'
import ApproverDashboard from './pages/approver/ApproverDashboard'
import ApproverFormDetail from './pages/approver/ApproverFormDetail'
import UserFormDetail from './pages/user/UserFormDetail'
import DashboardLayout from './components/DashboardLayout'
import Company_co_home from './pages/company_co/Company_co_home'
import { Toaster } from 'react-hot-toast';

function App() {

  return (
    <>
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
          <Route path="dashboard" element={<ApproverDashboard />} />
          <Route path="form/:form_id" element={<ApproverFormDetail />} />
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
          <Route path="racm-assignment" element={<RacmAssignment />} />
          <Route path="user-management" element={<CreateUser />} />
          <Route path="upload-excel" element={<ExcelUpload />} />
          <Route path="create-form" element={<CreateControlForm />} />
          <Route path="form/:form_id" element={<FormDetail />} />
        </Route>
        
      </Routes>
      </div>
    </>
  )
}

export default App
