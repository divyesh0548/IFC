import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTheme } from '@mui/material/styles'
import Button from '@mui/material/Button'
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'

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

  const handleFormClick = (formId) => {
    navigate(`/company_co/form/${formId}`)
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
          <Box sx={{ 
            display: 'flex', 
            flexDirection: { xs: 'column', sm: 'row' }, 
            justifyContent: 'space-between', 
            alignItems: 'center', 
            mb: 3 
          }}>
            <Typography 
              variant="h5" 
              component="h2"
              sx={{ 
                fontWeight: 700, 
                color: theme.palette.secondary.main,
                mb: { xs: 2, sm: 0 }
              }}
            >
              Control Forms
            </Typography>
            
            {/* Filter Options */}
            <Box sx={{ display: 'flex', gap: 1 }}>
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
                    borderColor: theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.23)' : '#d1d5db',
                    color: theme.palette.text.primary,
                    '&:hover': {
                      borderColor: theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.3)' : '#9ca3af',
                      backgroundColor: theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.08)' : '#f3f4f6',
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
                    borderColor: theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.23)' : '#d1d5db',
                    color: theme.palette.text.primary,
                    '&:hover': {
                      borderColor: theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.3)' : '#9ca3af',
                      backgroundColor: theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.08)' : '#f3f4f6',
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
                    borderColor: theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.23)' : '#d1d5db',
                    color: theme.palette.text.primary,
                    '&:hover': {
                      borderColor: theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.3)' : '#9ca3af',
                      backgroundColor: theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.08)' : '#f3f4f6',
                    },
                  }),
                }}
              >
                Inactive
              </Button>
            </Box>
          </Box>

          {loading ? (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Typography color="text.secondary">Loading forms...</Typography>
            </Box>
          ) : forms.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Typography color="text.secondary">No forms found.</Typography>
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
                      Status
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
                    const isActive = form.active && form.active !== '' && form.active !== '0'
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
                          }}
                        >
                          <Box
                            component="span"
                            sx={{
                              px: 1,
                              py: 0.5,
                              display: 'inline-flex',
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              borderRadius: '9999px',
                              backgroundColor: isActive
                                ? (theme.palette.mode === 'dark' ? 'rgba(34, 197, 94, 0.2)' : '#d1fae5')
                                : (theme.palette.mode === 'dark' ? 'rgba(239, 68, 68, 0.2)' : '#fee2e2'),
                              color: isActive
                                ? (theme.palette.mode === 'dark' ? '#4ade80' : '#065f46')
                                : (theme.palette.mode === 'dark' ? '#f87171' : '#991b1b'),
                            }}
                          >
                            {isActive ? 'Active' : 'Inactive'}
                          </Box>
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

export default Company_Co_dashboard