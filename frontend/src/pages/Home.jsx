import React from 'react'
import { Link } from 'react-router-dom'

function Home() {
  return (
    <div className="min-h-screen bg-primary flex items-center justify-center px-4">
      <div className="text-center">
        <h1 className="text-5xl font-bold text-secondary mb-8">
          IFC
        </h1>
        <p className="text-xl text-secondary mb-12">
          Welcome to IFC Platform
        </p>
        
        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
          <Link
            to="/user/login"
            className="bg-secondary text-primary px-8 py-3 rounded-md font-semibold hover:bg-hover transition-colors focus:outline-none focus:ring-2 focus:ring-secondary focus:ring-offset-2 cursor-pointer min-w-[200px] text-center"
          >
            User Login
          </Link>
          
          <Link
            to="/siteadmin/login"
            className="bg-secondary text-primary px-8 py-3 rounded-md font-semibold hover:bg-hover transition-colors focus:outline-none focus:ring-2 focus:ring-secondary focus:ring-offset-2 cursor-pointer min-w-[200px] text-center"
          >
            Site Admin Login
          </Link>
          <Link
            to="/auditor/login"
            className="bg-secondary text-primary px-8 py-3 rounded-md font-semibold hover:bg-hover transition-colors focus:outline-none focus:ring-2 focus:ring-secondary focus:ring-offset-2 cursor-pointer min-w-[200px] text-center"
          >
            Auditor Login
          </Link>
        </div>
      </div>
    </div>
  )
}

export default Home
