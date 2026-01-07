import React, { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useTheme } from '@mui/material/styles'
import Navbar from '../../components/Siteadmin_navbar'
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Button from '@mui/material/Button';
import Box from '@mui/material/Box';

function Company_Co_dashboard() {
  const theme = useTheme()
  const navigate = useNavigate()
  const [userRole, setUserRole] = useState(null)
  const [companyIdentifier, setCompanyIdentifier] = useState(null)
  const [forms, setForms] = useState([])
  const [filterActive, setFilterActive] = useState('all') // 'all', 'active', 'inactive'
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Fetch user role and company_identifier on component mount
    const fetchUserInfo = async () => {
      try {
        const response = await fetch('http://localhost:3000/api/auth/user/verify', {
          method: 'GET',
          credentials: 'include',
        })

        const data = await response.json()

        if (response.ok && data.success) {
          setUserRole(data.user.role)
          setCompanyIdentifier(data.user.company_identifier)
        }
      } catch (error) {
        console.error('Error fetching user info:', error)
      }
    }

    fetchUserInfo()
  }, [])

  useEffect(() => {
    // Fetch forms when company_identifier is available
    if (companyIdentifier) {
      fetchForms()
    }
  }, [companyIdentifier, filterActive])

  const fetchForms = async () => {
    if (!companyIdentifier) return
    
    setLoading(true)
    try {
      let url = `http://localhost:3000/api/control-forms?company_identifier=${encodeURIComponent(companyIdentifier)}`
      
      if (filterActive === 'active') {
        url += '&active=true'
      } else if (filterActive === 'inactive') {
        url += '&active=false'
      }
      
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

  const handleLogout = async () => {
    try {
      const response = await fetch('http://localhost:3000/api/auth/user/logout', {
        method: 'POST',
        credentials: 'include', // Important: sends cookies
      })

      const data = await response.json()

      if (response.ok && data.success) {
        // Redirect to login page
        navigate('/user/login')
      } else {
        console.error('Logout failed:', data.message)
        // Still redirect to login even if logout API fails
        navigate('/user/login')
      }
    } catch (error) {
      console.error('Logout error:', error)
      // Still redirect to login even if there's an error
      navigate('/user/login')
    }
  }

  const handleFormClick = (formId) => {
    window.open(`/company_co/form/${formId}`, '_blank')
  }

  return (
    <div className="min-h-screen bg-primary">
      <Navbar onLogout={handleLogout} header="Company Coordinator Dashboard" />

      {/* Dashboard Content */}
      <div className="container mx-auto px-4 py-8">
        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 2, mb: 4 }}>
          {/* Create User Button */}
          <Button
            component={Link}
            to="/company_co/create-user"
            variant="contained"
            color="secondary"
            sx={{
              px: 3,
              py: 1.5,
              fontSize: theme.typography.customSizes.medium,
              fontWeight: 500,
              textTransform: 'none',
            }}
          >
            Create New User
          </Button>

          {/* Upload Excel Button */}
          <Button
            component={Link}
            to="/company_co/upload-excel"
            variant="contained"
            color="secondary"
            sx={{
              px: 3,
              py: 1.5,
              fontSize: theme.typography.customSizes.medium,
              fontWeight: 500,
              textTransform: 'none',
            }}
          >
            Upload Control Forms (Excel)
          </Button>
        </Box>

        {/* Forms Section */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <div className="flex flex-col sm:flex-row justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-secondary mb-4 sm:mb-0">Control Forms</h2>
            
            {/* Filter Options */}
            <div className="flex gap-2">
              <Button
                onClick={() => setFilterActive('all')}
                variant={filterActive === 'all' ? 'contained' : 'outlined'}
                color={filterActive === 'all' ? 'secondary' : 'inherit'}
                sx={{
                  minWidth: '80px',
                  textTransform: 'none',
                  ...(filterActive === 'all' && {
                    backgroundColor: '#0369a1',
                    color: '#ffffff',
                    '&:hover': {
                      backgroundColor: '#075985',
                    },
                  }),
                  ...(filterActive !== 'all' && {
                    borderColor: '#d1d5db',
                    color: '#374151',
                    '&:hover': {
                      borderColor: '#9ca3af',
                      backgroundColor: '#f3f4f6',
                    },
                  }),
                }}
              >
                All
              </Button>
              <Button
                onClick={() => setFilterActive('active')}
                variant={filterActive === 'active' ? 'contained' : 'outlined'}
                color={filterActive === 'active' ? 'secondary' : 'inherit'}
                sx={{
                  minWidth: '80px',
                  textTransform: 'none',
                  ...(filterActive === 'active' && {
                    backgroundColor: '#0369a1',
                    color: '#ffffff',
                    '&:hover': {
                      backgroundColor: '#075985',
                    },
                  }),
                  ...(filterActive !== 'active' && {
                    borderColor: '#d1d5db',
                    color: '#374151',
                    '&:hover': {
                      borderColor: '#9ca3af',
                      backgroundColor: '#f3f4f6',
                    },
                  }),
                }}
              >
                Active
              </Button>
              <Button
                onClick={() => setFilterActive('inactive')}
                variant={filterActive === 'inactive' ? 'contained' : 'outlined'}
                color={filterActive === 'inactive' ? 'secondary' : 'inherit'}
                sx={{
                  minWidth: '80px',
                  textTransform: 'none',
                  ...(filterActive === 'inactive' && {
                    backgroundColor: '#0369a1',
                    color: '#ffffff',
                    '&:hover': {
                      backgroundColor: '#075985',
                    },
                  }),
                  ...(filterActive !== 'inactive' && {
                    borderColor: '#d1d5db',
                    color: '#374151',
                    '&:hover': {
                      borderColor: '#9ca3af',
                      backgroundColor: '#f3f4f6',
                    },
                  }),
                }}
              >
                Inactive
              </Button>
            </div>
          </div>

          {loading ? (
            <div className="text-center py-8">
              <p className="text-secondary">Loading forms...</p>
            </div>
          ) : forms.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-secondary">No forms found.</p>
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
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Created At
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {forms.map((form, index) => {
                    const isActive = form.active && form.active !== '' && form.active !== '0'
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
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                              isActive
                                ? 'bg-green-100 text-green-800'
                                : 'bg-red-100 text-red-800'
                            }`}
                          >
                            {isActive ? 'Active' : 'Inactive'}
                          </span>
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

export default Company_Co_dashboard