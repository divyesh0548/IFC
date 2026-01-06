import React from 'react'
import { useNavigate } from 'react-router-dom'
import Navbar from '../../components/Siteadmin_navbar'

function Auditor_dashboard() {
  const navigate = useNavigate()

  const handleLogout = async () => {
    try {
      const response = await fetch('http://localhost:3000/api/auth/auditor/logout', {
        method: 'POST',
        credentials: 'include', // Important: sends cookies
      })

      const data = await response.json()

      if (response.ok && data.success) {
        // Redirect to login page
        navigate('/auditor/login')
      } else {
        console.error('Logout failed:', data.message)
        // Still redirect to login even if logout API fails
        navigate('/auditor/login')
      }
    } catch (error) {
      console.error('Logout error:', error)
      // Still redirect to login even if there's an error
      navigate('/auditor/login')
    }
  }

  return (
    <div className="min-h-screen bg-primary">
      <Navbar onLogout={handleLogout} header="Auditor Dashboard" />

      {/* Dashboard Content */}
      <div className="flex items-center justify-center min-h-[calc(100vh-4rem)]">
        <h1 className="text-4xl font-bold text-secondary">Auditor Dashboard</h1>
      </div>
    </div>
  )
}

export default Auditor_dashboard

