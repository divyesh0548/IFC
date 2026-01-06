import { useState } from 'react'
import './index.css'
import Home from './pages/Home'
import Login from './pages/Login'
import { Routes, Route } from 'react-router-dom'
import Siteadmin_Login from './pages/siteadmin/Siteadmin_Login'
import Siteadmin_dashboard from './pages/siteadmin/Siteadmin_dashboard'
import CompanyCreation from './pages/siteadmin/CompanyCreation'
import Auditor_Login from './pages/auditor/Auditor_Login'
import Auditor_dashboard from './pages/auditor/Auditor_dashboard'
import User_dashboard from './pages/user/User_dashboard'
import ForgotPassword from './pages/ForgotPassword'
import UpdatePassword from './pages/UpdatePassword'
import ProtectedRoute from './components/ProtectedRoute'
import AuditorProtectedRoute from './components/AuditorProtectedRoute'
import ApproverProtectedRoute from './components/ApproverProtectedRoute'
import RoleBasedProtectedRoute from './components/RoleBasedProtectedRoute'
import Company_Co_dashboard from './pages/company_co/Company_co_dashboard'
import CreateUser from './pages/company_co/CreateUser'
import ExcelUpload from './pages/forms/ExcelUpload'
import FormDetail from './pages/company_co/FormDetail'
import ApproverLogin from './pages/approver/ApproverLogin'
import ApproverDashboard from './pages/approver/ApproverDashboard'
import ApproverFormDetail from './pages/approver/ApproverFormDetail'

function App() {

  return (
    <>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/user/login" element={<Login />} />

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
        <Route path="/siteadmin/login" element={<Siteadmin_Login />} />
        <Route 
          path="/siteadmin/dashboard" 
          element={
            <ProtectedRoute>
              <Siteadmin_dashboard />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/siteadmin/create-company" 
          element={
            <ProtectedRoute>
              <CompanyCreation />
            </ProtectedRoute>
          } 
        />


{/* Auditor Routes */}
        <Route path="/auditor/login" element={<Auditor_Login />} />
        <Route 
          path="/auditor/dashboard" 
          element={
            <AuditorProtectedRoute>
              <Auditor_dashboard />
            </AuditorProtectedRoute>
          } 
        />

{/* Approver Routes */}
        <Route path="/approver/login" element={<ApproverLogin />} />
        <Route 
          path="/approver/dashboard" 
          element={
            <ApproverProtectedRoute>
              <ApproverDashboard />
            </ApproverProtectedRoute>
          } 
        />
        <Route 
          path="/approver/form/:form_id" 
          element={
            <ApproverProtectedRoute>
              <ApproverFormDetail />
            </ApproverProtectedRoute>
          } 
        />

        <Route 
          path="/user/dashboard" 
          element={
            <RoleBasedProtectedRoute allowedRoles={['user']}>
              <User_dashboard />
            </RoleBasedProtectedRoute>
          } 
        />

      {/* Company Coordinator Routes */}
        <Route 
          path="/company_co/dashboard" 
          element={
            <RoleBasedProtectedRoute allowedRoles={['company_co']}>
              <Company_Co_dashboard />
            </RoleBasedProtectedRoute>
          } 
        />
        <Route 
          path="/company_co/create-user" 
          element={
            <RoleBasedProtectedRoute allowedRoles={['company_co']}>
              <CreateUser />
            </RoleBasedProtectedRoute>
          } 
        />
        <Route 
          path="/company_co/upload-excel" 
          element={
            <RoleBasedProtectedRoute allowedRoles={['company_co']}>
              <ExcelUpload />
            </RoleBasedProtectedRoute>
          } 
        />
        <Route 
          path="/company_co/form/:form_id" 
          element={
            <RoleBasedProtectedRoute allowedRoles={['company_co']}>
              <FormDetail />
            </RoleBasedProtectedRoute>
          } 
        />
        
      </Routes>
    </>
  )
}

export default App
