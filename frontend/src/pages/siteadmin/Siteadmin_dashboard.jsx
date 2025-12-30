import React from 'react'
import { useNavigate } from 'react-router-dom'
import Navbar from '../../components/Siteadmin_navbar'

function Siteadmin_dashboard() {
  const navigate = useNavigate()

  const handleLogout = async () => {
    try {
      const response = await fetch('http://localhost:3000/api/auth/siteadmin/logout', {
        method: 'POST',
        credentials: 'include', // Important: sends cookies
      })

      const data = await response.json()

      if (response.ok && data.success) {
        // Redirect to login page
        navigate('/siteadmin/login')
      } else {
        console.error('Logout failed:', data.message)
        // Still redirect to login even if logout API fails
        navigate('/siteadmin/login')
      }
    } catch (error) {
      console.error('Logout error:', error)
      // Still redirect to login even if there's an error
      navigate('/siteadmin/login')
    }
  }

  return (
    <div className="min-h-screen bg-primary">
      <Navbar onLogout={handleLogout} />

      {/* Dashboard Content */}
      <div className="flex items-center justify-center min-h-[calc(100vh-4rem)]">
        <h1 className="text-4xl font-bold text-secondary">Siteadmin Dashboard</h1>
      </div>
    </div>
  )
}

export default Siteadmin_dashboard