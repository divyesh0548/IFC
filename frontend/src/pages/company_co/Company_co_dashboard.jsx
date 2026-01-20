import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTheme } from '@mui/material/styles'
import Button from '@mui/material/Button'
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import FormControl from '@mui/material/FormControl'
import InputLabel from '@mui/material/InputLabel'
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogContentText from '@mui/material/DialogContentText'
import DialogActions from '@mui/material/DialogActions'
import { toast } from 'react-hot-toast'

function Company_Co_dashboard() {
  const theme = useTheme()
  const navigate = useNavigate()
  const [userRole, setUserRole] = useState(null)
  const [companyIdentifier, setCompanyIdentifier] = useState(null)
  const [forms, setForms] = useState([])
  const [filterActive, setFilterActive] = useState('all') // 'all', 'active', 'inactive'
  const [filterBusinessProcess, setFilterBusinessProcess] = useState('all') // 'all' or specific business process
  const [loading, setLoading] = useState(true)
  const [bulkUpdating, setBulkUpdating] = useState(false)
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false)

  // Business process options (matching ExcelUpload.jsx)
  const businessProcessOptions = [
    'Purchase to Pay',
    'Order to Cash',
    'Hire to Retire',
    'Capital Expenditure',
    'Treasury',
    'Financial Statement Closure Process',
    'Information Technology General Controls',
    'Entity Level Controls'
  ]

  useEffect(() => {
    // Fetch user role and company_identifier on component mount
    const fetchUserInfo = async () => {
      try {
        const response = await fetch('http://localhost:3000/api/auth/verify', {
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
  }, [companyIdentifier, filterActive, filterBusinessProcess])

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
      
      if (filterBusinessProcess !== 'all') {
        url += `&business_process=${encodeURIComponent(filterBusinessProcess)}`
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

  const handleBulkSetActiveClick = () => {
    if (forms.length === 0) {
      toast.error('No forms to update')
      return
    }
    setConfirmDialogOpen(true)
  }

  const handleBulkSetActiveCancel = () => {
    setConfirmDialogOpen(false)
  }

  const handleBulkSetActiveConfirm = async () => {
    setConfirmDialogOpen(false)
    
    if (!companyIdentifier) {
      toast.error('Company identifier not found')
      return
    }

    setBulkUpdating(true)
    try {
      const requestBody = {
        company_identifier: companyIdentifier
      }

      // Add business_process filter if not 'all'
      if (filterBusinessProcess !== 'all') {
        requestBody.business_process = filterBusinessProcess
      }

      // Add active filter if not 'all' (to only update inactive forms, for example)
      if (filterActive !== 'all') {
        requestBody.active = filterActive === 'active' ? 'true' : 'false'
      }

      const response = await fetch('http://localhost:3000/api/control-forms/bulk-set-active', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(requestBody)
      })

      const data = await response.json()

      if (response.ok && data.success) {
        toast.success(data.message || `Successfully set ${data.count} form(s) to active`)
        // Refresh the forms list
        fetchForms()
      } else {
        toast.error(data.message || 'Failed to set forms to active')
      }
    } catch (error) {
      console.error('Error bulk setting forms to active:', error)
      toast.error('Error setting forms to active')
    } finally {
      setBulkUpdating(false)
    }
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
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <Typography 
                variant="h5" 
                component="h2"
                sx={{ 
                  fontWeight: 700, 
                  color: theme.palette.secondary.main,
                }}
              >
                Control Forms
              </Typography>
              
              {/* Set All Active Button */}
              <Button
                onClick={handleBulkSetActiveClick}
                disabled={bulkUpdating || loading || forms.length === 0}
                variant="contained"
                color="secondary"
                size="small"
                sx={{
                  minWidth: '140px',
                  textTransform: 'none',
                  fontSize: '0.75rem',
                  py: 0.5,
                  alignSelf: 'flex-start',
                }}
              >
                {bulkUpdating ? 'Setting...' : 'Set All Active'}
              </Button>
            </Box>
            
            {/* Filter Options */}
            <Box sx={{ 
              display: 'flex', 
              flexDirection: { xs: 'column', sm: 'row' },
              gap: 2,
              alignItems: { xs: 'stretch', sm: 'center' },
              width: { xs: '100%', sm: 'auto' }
            }}>
              {/* Business Process Filter */}
              <FormControl 
                variant="outlined" 
                sx={{ 
                  minWidth: '80px',
                  '& .MuiOutlinedInput-root': {
                    backgroundColor: 'transparent',
                    '& fieldset': {
                      borderColor: theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.23)' : '#d1d5db',
                    },
                    '&:hover fieldset': {
                      borderColor: theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.3)' : '#9ca3af',
                    },
                    '&.Mui-focused fieldset': {
                      borderColor: theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.3)' : '#9ca3af',
                    },
                  },
                  '& .MuiInputLabel-root': {
                    color: theme.palette.text.primary,
                  },
                  '& .MuiSelect-root': {
                    color: theme.palette.text.primary,
                  },
                }}
              >
                <InputLabel id="business-process-filter-label">Business Process</InputLabel>
                <Select
                  labelId="business-process-filter-label"
                  id="business-process-filter"
                  value={filterBusinessProcess}
                  label="Business Process"
                  onChange={(e) => setFilterBusinessProcess(e.target.value)}
                >
                  <MenuItem value="all">All</MenuItem>
                  {businessProcessOptions.map((option) => (
                    <MenuItem key={option} value={option}>
                      {option}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              
              {/* Active/Inactive Filter Buttons */}
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
                      Business Process
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
                            fontSize: '0.875rem',
                            color: theme.palette.text.primary,
                          }}
                        >
                          {form.business_process || 'N/A'}
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

        {/* Set All Active Confirmation Dialog */}
        <Dialog
          open={confirmDialogOpen}
          onClose={handleBulkSetActiveCancel}
          aria-labelledby="set-active-dialog-title"
          aria-describedby="set-active-dialog-description"
          PaperProps={{
            sx: {
              borderRadius: 2,
              minWidth: { xs: '90%', sm: '400px' },
              boxShadow: theme.palette.mode === 'dark'
                ? '0 8px 32px rgba(0, 0, 0, 0.4)'
                : '0 8px 32px rgba(0, 0, 0, 0.12)',
            },
          }}
        >
          <DialogTitle 
            id="set-active-dialog-title"
            sx={{
              pb: 2.5,
              pt: 3,
              px: 3,
              fontWeight: 600,
              fontSize: '1.25rem',
              color: theme.palette.text.primary,
            }}
          >
            Confirm Set All Active
          </DialogTitle>
          <DialogContent sx={{ px: 3, pt: 3, pb: 3 }}>
            <DialogContentText 
              id="set-active-dialog-description"
              sx={{
                color: theme.palette.text.secondary,
                fontSize: '0.9375rem',
                lineHeight: 1.5,
                m: 0,
                mb: 2,
              }}
            >
              Are you sure you want to set all forms to active?
            </DialogContentText>
            <Box sx={{ mt: 2 }}>
              <Typography
                variant="body2"
                sx={{
                  color: theme.palette.text.primary,
                  fontWeight: 500,
                  mb: 1,
                }}
              >
                Number of forms: <strong>{forms.length}</strong>
              </Typography>
              {filterBusinessProcess !== 'all' && (
                <Typography
                  variant="body2"
                  sx={{
                    color: theme.palette.text.primary,
                    fontWeight: 500,
                    mb: 1,
                  }}
                >
                  Business Process: <strong>{filterBusinessProcess}</strong>
                </Typography>
              )}
              {filterActive !== 'all' && (
                <Typography
                  variant="body2"
                  sx={{
                    color: theme.palette.text.primary,
                    fontWeight: 500,
                  }}
                >
                  Current Status Filter: <strong>{filterActive === 'active' ? 'Active' : 'Inactive'}</strong>
                </Typography>
              )}
            </Box>
          </DialogContent>
          <DialogActions 
            sx={{ 
              px: 3, 
              pb: 3, 
              pt: 2.5,
              gap: 1.5,
              borderTop: '1px solid',
              borderColor: 'divider',
            }}
          >
            <Button 
              onClick={handleBulkSetActiveCancel}
              variant="outlined"
              sx={{
                textTransform: 'none',
                px: 3,
                py: 1,
                minWidth: '100px',
                borderColor: theme.palette.mode === 'dark' 
                  ? 'rgba(255, 255, 255, 0.23)' 
                  : 'rgba(0, 0, 0, 0.23)',
                color: theme.palette.text.primary,
                '&:hover': {
                  borderColor: theme.palette.mode === 'dark' 
                    ? 'rgba(255, 255, 255, 0.3)' 
                    : 'rgba(0, 0, 0, 0.3)',
                  backgroundColor: theme.palette.mode === 'dark'
                    ? 'rgba(255, 255, 255, 0.05)'
                    : 'rgba(0, 0, 0, 0.04)',
                },
              }}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleBulkSetActiveConfirm} 
              variant="contained" 
              color="secondary"
              autoFocus
              sx={{
                textTransform: 'none',
                px: 3,
                py: 1,
                minWidth: '100px',
                fontWeight: 600,
                boxShadow: theme.palette.mode === 'dark'
                  ? '0 4px 12px rgba(3, 105, 161, 0.3)'
                  : '0 4px 12px rgba(3, 105, 161, 0.2)',
                '&:hover': {
                  boxShadow: theme.palette.mode === 'dark'
                    ? '0 6px 16px rgba(3, 105, 161, 0.4)'
                    : '0 6px 16px rgba(3, 105, 161, 0.3)',
                },
              }}
            >
              Set Active
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
  )
}

export default Company_Co_dashboard