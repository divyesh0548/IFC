import React from 'react'

function Navbar({ onLogout, header = 'Site Admin' }) {
  return (
    <nav className="bg-secondary text-primary shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center">
            <h1 className="text-xl font-bold">{header}</h1>
          </div>
          <div className="flex items-center">
            <button
              onClick={onLogout}
              className="bg-hover hover:bg-opacity-90 text-primary px-4 py-2 rounded-md font-semibold transition-colors cursor-pointer"
            >
              Logout
            </button>
          </div>
        </div>
      </div>
    </nav>
  )
}

export default Navbar

