import React, { useState, useEffect } from 'react'
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
import DialogActions from '@mui/material/DialogActions'
import TextField from '@mui/material/TextField'
import Autocomplete from '@mui/material/Autocomplete'
import { toast } from 'react-hot-toast'

function RacmAssignment() {
  const theme = useTheme()
  const [userRole, setUserRole] = useState(null)
  const [companyIdentifier, setCompanyIdentifier] = useState(null)
  const [forms, setForms] = useState([])
  const [companyUsers, setCompanyUsers] = useState([])
  const [usersLoading, setUsersLoading] = useState(false)
  const [filterAssignment, setFilterAssignment] = useState('assigned') // 'assigned' or 'unassigned'
  const [filterBusinessProcess, setFilterBusinessProcess] = useState('all') // 'all' or specific business process
  const [filterFinancialYear, setFilterFinancialYear] = useState('all') // 'all' or specific financial year
  const [financialYearOptions, setFinancialYearOptions] = useState([])
  const [loading, setLoading] = useState(true)
  const [assignmentDialogOpen, setAssignmentDialogOpen] = useState(false)
  const [selectedForm, setSelectedForm] = useState(null)
  const [selectedUser, setSelectedUser] = useState(null)
  const [userSearchText, setUserSearchText] = useState('')
  const [updatingAssignment, setUpdatingAssignment] = useState(false)
  const assignableUsers = companyUsers.filter((user) => {
    const coordinatorCompany = (companyIdentifier || '').trim()
    const userCompany = (user.company_identifier || '').trim()
    const isSameCompany = !userCompany || userCompany === coordinatorCompany
    return isSameCompany && user.role === 'user'
  })

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

  const getFinancialYearStorageKey = (companyId) => `ifc_financial_year_options_${companyId}`

  const extractUniqueFinancialYears = (rows) => {
    return [...new Set(
      (rows || [])
        .map(form => form.financial_year?.toString().trim())
        .filter(year => year && year !== '')
    )]
  }

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
    if (companyIdentifier) {
      loadFinancialYearOptions(companyIdentifier)
    }
  }, [companyIdentifier])

  const loadFinancialYearOptions = async (companyId) => {
    const storageKey = getFinancialYearStorageKey(companyId)
    try {
      const cached = localStorage.getItem(storageKey)
      if (cached) {
        const parsed = JSON.parse(cached)
        if (Array.isArray(parsed) && parsed.length > 0) {
          setFinancialYearOptions(parsed)
          return
        }
      }
    } catch (error) {
      console.error('Error reading financial year options from localStorage (RacmAssignment):', error)
    }

    try {
      const url = `http://localhost:3000/api/control-forms?company_identifier=${encodeURIComponent(companyId)}`
      const response = await fetch(url, {
        method: 'GET',
        credentials: 'include',
      })
      const data = await response.json()
      if (response.ok && data.success) {
        const years = extractUniqueFinancialYears(data.data)
        setFinancialYearOptions(years)
        localStorage.setItem(storageKey, JSON.stringify(years))
      }
    } catch (error) {
      console.error('Error bootstrapping financial year options (RacmAssignment):', error)
    }
  }

  useEffect(() => {
    // Fetch forms when company_identifier is available
    if (companyIdentifier) {
      fetchForms()
    }
  }, [companyIdentifier, filterAssignment, filterBusinessProcess, filterFinancialYear])

  const fetchForms = async () => {
    if (!companyIdentifier) return
    
    setLoading(true)
    try {
      let url = `http://localhost:3000/api/control-forms?company_identifier=${encodeURIComponent(companyIdentifier)}`
      
      if (filterBusinessProcess !== 'all') {
        url += `&business_process=${encodeURIComponent(filterBusinessProcess)}`
      }
      
      if (filterFinancialYear !== 'all') {
        url += `&financial_year=${encodeURIComponent(filterFinancialYear)}`
      }
      
      const response = await fetch(url, {
        method: 'GET',
        credentials: 'include',
      })

      const data = await response.json()

      if (response.ok && data.success) {
        let fetchedForms = data.data
        
        // Sort forms by created_at timestamp (newest first)
        const sortedForms = [...fetchedForms].sort((a, b) => {
          const dateA = a.created_at ? new Date(a.created_at).getTime() : 0
          const dateB = b.created_at ? new Date(b.created_at).getTime() : 0
          return dateB - dateA // Descending order (newest first)
        })

        const assignmentFilteredForms = sortedForms.filter((form) => {
          const hasProcessOwner = Boolean(form.process_owner && form.process_owner.trim() !== '')
          return filterAssignment === 'assigned' ? hasProcessOwner : !hasProcessOwner
        })

        setForms(assignmentFilteredForms)

        // Keep cached financial year options updated with any newly seen values
        const latestYears = extractUniqueFinancialYears(data.data)
        if (latestYears.length > 0) {
          const mergedYears = [...new Set([...(financialYearOptions || []), ...latestYears])]
          if (mergedYears.length !== financialYearOptions.length) {
            setFinancialYearOptions(mergedYears)
            if (companyIdentifier) {
              localStorage.setItem(getFinancialYearStorageKey(companyIdentifier), JSON.stringify(mergedYears))
            }
          }
        }
      } else {
        console.error('Error fetching forms:', data.message)
      }
    } catch (error) {
      console.error('Error fetching forms:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchCompanyUsers = async () => {
    setUsersLoading(true)
    try {
      const response = await fetch('http://localhost:3000/api/company-co/users', {
        method: 'GET',
        credentials: 'include',
      })
      const data = await response.json()

      if (response.ok && data.success) {
        setCompanyUsers(Array.isArray(data.users) ? data.users : [])
      } else {
        setCompanyUsers([])
      }
    } catch (error) {
      console.error('Error fetching company users:', error)
      setCompanyUsers([])
    } finally {
      setUsersLoading(false)
    }
  }

  const handleFormClick = async (form) => {
    setSelectedForm(form)
    setSelectedUser(null)
    setUserSearchText('')
    setAssignmentDialogOpen(true)

    if (companyUsers.length === 0) {
      await fetchCompanyUsers()
    }
  }

  const handleCloseAssignmentDialog = () => {
    if (updatingAssignment) return
    setAssignmentDialogOpen(false)
    setSelectedForm(null)
    setSelectedUser(null)
    setUserSearchText('')
  }

  const handleUpdateAssignment = async () => {
    if (!selectedForm?.form_id || !selectedUser?.email_id) return

    setUpdatingAssignment(true)
    try {
      const response = await fetch(`http://localhost:3000/api/control-forms/${selectedForm.form_id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          process_owner: selectedUser.email_id,
          modifiedFields: ['process_owner'],
        }),
      })

      const data = await response.json()
      if (response.ok && data.success) {
        handleCloseAssignmentDialog()
        toast.success('Sucessfully Updated RACM Assignment')
        fetchForms()
      } else {
        toast.error(data.message || 'Failed to update RACM assignment')
      }
    } catch (error) {
      console.error('Error updating assignment:', error)
      toast.error('Failed to update RACM assignment')
    } finally {
      setUpdatingAssignment(false)
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
                RACM
              </Typography>
            </Box>
            
            {/* Filter Options */}
            <Box sx={{ 
              display: 'flex', 
              flexDirection: { xs: 'column', sm: 'row' },
              gap: 2,
              alignItems: { xs: 'stretch', sm: 'flex-start' },
              width: { xs: '100%', sm: 'auto' },
              flexWrap: 'wrap'
            }}>
              {/* Financial Year Filter */}
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
                <InputLabel id="financial-year-filter-label">Financial Year</InputLabel>
                <Select
                  labelId="financial-year-filter-label"
                  id="financial-year-filter"
                  value={filterFinancialYear}
                  label="Financial Year"
                  onChange={(e) => setFilterFinancialYear(e.target.value)}
                >
                  <MenuItem value="all">All</MenuItem>
                  {financialYearOptions.map((option) => (
                    <MenuItem key={option} value={option}>
                      {option}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

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
              
              {/* Assigned/Unassigned Filter Buttons */}
              <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                onClick={() => setFilterAssignment('assigned')}
                variant={filterAssignment === 'assigned' ? 'contained' : 'outlined'}
                color="secondary"
                sx={{
                  minWidth: '90px',
                  textTransform: 'none',
                  fontSize: '0.8rem',
                }}
              >
                Assigned
              </Button>
              <Button
                onClick={() => setFilterAssignment('unassigned')}
                variant={filterAssignment === 'unassigned' ? 'contained' : 'outlined'}
                color="secondary"
                sx={{
                  minWidth: '90px',
                  textTransform: 'none',
                  fontSize: '0.8rem',
                }}
              >
                Unassigned
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
                      width: '320px',
                      minWidth: '320px',
                      maxWidth: '320px',
                    }}
                  >
                    Standard Control Description
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
                      Financial Year
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
                      Process Owner
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
                      Name of Process Owner
                    </Box>
                  </Box>
                </Box>
                <Box component="tbody">
                  {forms.map((form) => {
                    return (
                      <Box
                        component="tr"
                        key={form.id}
                        onClick={() => handleFormClick(form)}
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
                          title={form.standard_control_description || 'N/A'}
                          sx={{
                            px: 3,
                            py: 2,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            width: '320px',
                            minWidth: '320px',
                            maxWidth: '320px',
                            fontSize: '0.875rem',
                            color: theme.palette.text.primary,
                          }}
                        >
                          {form.standard_control_description || 'N/A'}
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
                            fontSize: '0.875rem',
                            color: theme.palette.text.primary,
                          }}
                        >
                          {form.financial_year || 'N/A'}
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
                          {form.process_owner || 'N/A'}
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
                          {form.process_owner_name || '-'}
                        </Box>
                      </Box>
                    )
                  })}
                </Box>
              </Box>
            </Box>
          )}
        </Paper>

        <Dialog
          open={assignmentDialogOpen}
          onClose={handleCloseAssignmentDialog}
          fullWidth
          maxWidth="md"
        >
          <DialogTitle sx={{ fontWeight: 700 }}>
            RACM Assignment
          </DialogTitle>
          <DialogContent dividers>
            {selectedForm && (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                <Typography variant="body2">
                  <strong>Standard Control Description:</strong> {selectedForm.standard_control_description || 'N/A'}
                </Typography>
                <Typography variant="body2">
                  <strong>Business Process:</strong> {selectedForm.business_process || 'N/A'}
                </Typography>
                <Typography variant="body2">
                  <strong>Financial Year:</strong> {selectedForm.financial_year || 'N/A'}
                </Typography>
                <Typography variant="body2">
                  <strong>Current Process Owner Name:</strong> {selectedForm.process_owner_name || '-'}
                </Typography>
                <Typography variant="body2" sx={{ mb: 2 }}>
                  <strong>Current Process Owner Email:</strong> {selectedForm.process_owner || '-'}
                </Typography>

                <Autocomplete
                  options={
                    assignableUsers.filter((user) => {
                      const currentOwner = (selectedForm?.process_owner || '').trim().toLowerCase()
                      const userEmail = (user.email_id || '').trim().toLowerCase()
                      // Exclude the user who is already assigned as process owner for this RACM
                      return currentOwner === '' || userEmail !== currentOwner
                    })
                  }
                  loading={usersLoading}
                  value={selectedUser}
                  inputValue={userSearchText}
                  onInputChange={(_, newInputValue) => setUserSearchText(newInputValue)}
                  onChange={(_, newValue) => setSelectedUser(newValue)}
                  getOptionLabel={(option) => option?.emp_name || option?.email_id || ''}
                  isOptionEqualToValue={(option, value) => option.email_id === value.email_id}
                  filterOptions={(options, state) => {
                    const input = state.inputValue.trim().toLowerCase()
                    if (!input) return options
                    return options.filter((user) => (user.emp_name || '').toLowerCase().includes(input))
                  }}
                  renderOption={(props, option) => (
                    <Box component="li" {...props}>
                      <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                        <Typography variant="body2">{option.emp_name || '-'}</Typography>
                        <Typography variant="caption" color="text.secondary">{option.email_id || '-'}</Typography>
                      </Box>
                    </Box>
                  )}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Search Username"
                      placeholder="Type username..."
                    />
                  )}
                />

                <Typography variant="caption" color="text.secondary">
                  {selectedUser?.email_id || ' '}
                </Typography>
              </Box>
            )}
          </DialogContent>
          <DialogActions sx={{ px: 3, py: 2 }}>
            <Button onClick={handleCloseAssignmentDialog} disabled={updatingAssignment}>
              Cancel
            </Button>
            {selectedUser?.email_id && (
              <Button
                variant="contained"
                color="secondary"
                onClick={handleUpdateAssignment}
                disabled={updatingAssignment}
              >
                {updatingAssignment ? 'Updating...' : 'Update Assignment'}
              </Button>
            )}
          </DialogActions>
        </Dialog>
      </Box>
  )
}

export default RacmAssignment
