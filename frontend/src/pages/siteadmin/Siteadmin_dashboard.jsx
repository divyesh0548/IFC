import React from 'react'
import { Link } from 'react-router-dom'
import Navbar from '../../components/Siteadmin_navbar'
import { useSiteadminLogout } from '../../hooks/useSiteadminLogout'

function Siteadmin_dashboard() {
  const handleLogout = useSiteadminLogout()

  return (
    <div className="min-h-screen bg-primary">
      <Navbar onLogout={handleLogout} />

      {/* Dashboard Content */}
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-4rem)] px-4">
        <h1 className="text-4xl font-bold text-secondary mb-8">Siteadmin Dashboard</h1>
        
        <Link
          to="/siteadmin/create-company"
          className="bg-secondary text-primary px-8 py-3 rounded-md font-semibold hover:bg-hover transition-colors focus:outline-none focus:ring-2 focus:ring-secondary focus:ring-offset-2 cursor-pointer"
        >
          Create Company
        </Link>
      </div>
    </div>
  )
}

export default Siteadmin_dashboard