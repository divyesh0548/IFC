import React, { useState, useEffect } from 'react'
import Navbar from '../../components/Global_navbar'
import { useUserLogout } from '../../hooks/useUserLogout'

function User_dashboard() {
  const [userRole, setUserRole] = useState(null)
  const [userEmail, setUserEmail] = useState(null)
  const [forms, setForms] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Fetch user info on component mount
    const fetchUserInfo = async () => {
      try {
        const response = await fetch('http://localhost:3000/api/auth/user/verify', {
          method: 'GET',
          credentials: 'include',
        })

        const data = await response.json()

        if (response.ok && data.success) {
          setUserRole(data.user.role)
          setUserEmail(data.user.email_id)
        }
      } catch (error) {
        console.error('Error fetching user info:', error)
      }
    }

    fetchUserInfo()
  }, [])

  useEffect(() => {
    // Fetch forms when user email is available
    if (userEmail) {
      fetchForms()
    }
  }, [userEmail])

  const fetchForms = async () => {
    if (!userEmail) return
    
    setLoading(true)
    try {
      // Fetch forms where process_owner matches user email and form is active
      const url = `http://localhost:3000/api/control-forms?process_owner=${encodeURIComponent(userEmail)}&active=true`
      
      const response = await fetch(url, {
        method: 'GET',
        credentials: 'include',
      })

      const data = await response.json()

      if (response.ok && data.success) {
        // Sort forms by created_at timestamp (newest first)
        const sortedForms = [...data.data].sort((a, b) => {
          const dateA = a.created_at ? new Date(a.created_at).getTime() : 0
          const dateB = b.created_at ? new Date(b.created_at).getTime() : 0
          return dateB - dateA // Descending order (newest first)
        })
        setForms(sortedForms)
      } else {
        console.error('Error fetching forms:', data.message)
      }
    } catch (error) {
      console.error('Error fetching forms:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleFormClick = (formId) => {
    window.open(`/user/form/${formId}`, '_blank')
  }

  const handleLogout = useUserLogout()

  return (
    <div className="min-h-screen bg-primary">
      <Navbar onLogout={handleLogout} header="User Dashboard" />

      {/* Dashboard Content */}
      <div className="container mx-auto px-4 py-8">

        {/* Forms Section */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-2xl font-bold text-secondary mb-6">My Control Forms</h2>

          {loading ? (
            <div className="text-center py-8">
              <p className="text-secondary">Loading forms...</p>
            </div>
          ) : forms.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-secondary">No active forms assigned to you.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      #
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Description
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Process
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Created At
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {forms.map((form, index) => {
                    return (
                      <tr
                        key={form.id}
                        onClick={() => handleFormClick(form.form_id)}
                        className="hover:bg-gray-50 cursor-pointer transition-colors"
                      >
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-700">
                          {index + 1}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-700">
                          {form.description_of_control || 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                          {form.process || 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                          {form.created_at
                            ? new Date(form.created_at).toLocaleDateString()
                            : 'N/A'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default User_dashboard