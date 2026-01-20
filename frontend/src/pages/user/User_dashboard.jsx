import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTheme } from '@mui/material/styles'
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'

function User_dashboard() {
  const theme = useTheme()
  const navigate = useNavigate()
  const [userRole, setUserRole] = useState(null)
  const [userEmail, setUserEmail] = useState(null)
  const [forms, setForms] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Fetch user info on component mount
    const fetchUserInfo = async () => {
      try {
        const response = await fetch('http://localhost:3000/api/auth/verify', {
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
    navigate(`/user/form/${formId}`)
  }

  return (
    <Box sx={{ maxWidth: '100%', mx: 'auto', px: 2, py: 4 }}>
        {/* Forms Section */}
        <Paper 
          elevation={3}
          sx={{
            p: 3,
            backgroundColor: theme.palette.background.paper,
            borderRadius: 2,
          }}
        >
          <Typography 
            variant="h5" 
            component="h2"
            sx={{ 
              fontWeight: 700, 
              color: theme.palette.secondary.main,
              mb: 3
            }}
          >
            My Control Forms
          </Typography>

          {loading ? (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Typography color="text.secondary">Loading forms...</Typography>
            </Box>
          ) : forms.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Typography color="text.secondary">No active forms assigned to you.</Typography>
            </Box>
          ) : (
            <Box sx={{ overflowX: 'auto' }}>
              <Box
                component="table"
                sx={{
                  minWidth: '100%',
                  borderCollapse: 'collapse',
                  '& th, & td': {
                    borderBottom: `1px solid ${theme.palette.divider}`,
                  },
                }}
              >
                <Box
                  component="thead"
                  sx={{
                    backgroundColor: theme.palette.mode === 'dark' 
                      ? 'rgba(255, 255, 255, 0.05)' 
                      : '#f9fafb',
                  }}
                >
                  <Box component="tr">
                    <Box
                      component="th"
                      sx={{
                        px: 3,
                        py: 1.5,
                        textAlign: 'left',
                        fontSize: '0.75rem',
                        fontWeight: 500,
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        color: theme.palette.text.secondary,
                      }}
                    >
                      #
                    </Box>
                    <Box
                      component="th"
                      sx={{
                        px: 3,
                        py: 1.5,
                        textAlign: 'left',
                        fontSize: '0.75rem',
                        fontWeight: 500,
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        color: theme.palette.text.secondary,
                      }}
                    >
                      Description
                    </Box>
                    <Box
                      component="th"
                      sx={{
                        px: 3,
                        py: 1.5,
                        textAlign: 'left',
                        fontSize: '0.75rem',
                        fontWeight: 500,
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        color: theme.palette.text.secondary,
                      }}
                    >
                      Process
                    </Box>
                    <Box
                      component="th"
                      sx={{
                        px: 3,
                        py: 1.5,
                        textAlign: 'left',
                        fontSize: '0.75rem',
                        fontWeight: 500,
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        color: theme.palette.text.secondary,
                      }}
                    >
                      Created At
                    </Box>
                  </Box>
                </Box>
                <Box component="tbody">
                  {forms.map((form, index) => {
                    return (
                      <Box
                        component="tr"
                        key={form.id}
                        onClick={() => handleFormClick(form.form_id)}
                        sx={{
                          cursor: 'pointer',
                          transition: 'background-color 0.2s',
                          '&:hover': {
                            backgroundColor: theme.palette.mode === 'dark' 
                              ? 'rgba(255, 255, 255, 0.05)' 
                              : '#f9fafb',
                          },
                        }}
                      >
                        <Box
                          component="td"
                          sx={{
                            px: 3,
                            py: 2,
                            whiteSpace: 'nowrap',
                            fontSize: '0.875rem',
                            fontWeight: 500,
                            color: theme.palette.text.primary,
                          }}
                        >
                          {index + 1}
                        </Box>
                        <Box
                          component="td"
                          sx={{
                            px: 3,
                            py: 2,
                            fontSize: '0.875rem',
                            color: theme.palette.text.primary,
                          }}
                        >
                          {form.description_of_control || 'N/A'}
                        </Box>
                        <Box
                          component="td"
                          sx={{
                            px: 3,
                            py: 2,
                            whiteSpace: 'nowrap',
                            fontSize: '0.875rem',
                            color: theme.palette.text.primary,
                          }}
                        >
                          {form.process || 'N/A'}
                        </Box>
                        <Box
                          component="td"
                          sx={{
                            px: 3,
                            py: 2,
                            whiteSpace: 'nowrap',
                            fontSize: '0.875rem',
                            color: theme.palette.text.primary,
                          }}
                        >
                          {form.created_at
                            ? new Date(form.created_at).toLocaleDateString()
                            : 'N/A'}
                        </Box>
                      </Box>
                    )
                  })}
                </Box>
              </Box>
            </Box>
          )}
        </Paper>
      </Box>
  )
}

export default User_dashboard