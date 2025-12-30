import { useState } from 'react'
import './index.css'
import Login from './pages/Login'
import { Routes, Route } from 'react-router-dom'
import Siteadmin_Login from './pages/siteadmin/Siteadmin_Login'
import Siteadmin_dashboard from './pages/siteadmin/Siteadmin_dashboard'
import User_dashboard from './pages/user/User_dashboard'
import ForgotPassword from './pages/ForgotPassword'
import UpdatePassword from './pages/UpdatePassword'
import ProtectedRoute from './components/ProtectedRoute'
import RoleBasedProtectedRoute from './components/RoleBasedProtectedRoute'
import Company_Co_dashboard from './pages/company_co/Company_co_dashboard'

function App() {

  return (
    <>
      <Routes>
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
          path="/user/dashboard" 
          element={
            <RoleBasedProtectedRoute allowedRoles={['user']}>
              <User_dashboard />
            </RoleBasedProtectedRoute>
          } 
        />
        <Route 
          path="/company_co/dashboard" 
          element={
            <RoleBasedProtectedRoute allowedRoles={['company_co']}>
              <Company_Co_dashboard />
            </RoleBasedProtectedRoute>
          } 
        />
      </Routes>
    </>
  )
}

export default App
