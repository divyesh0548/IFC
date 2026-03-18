import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTheme } from '@mui/material/styles'
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import FormControl from '@mui/material/FormControl'
import { FILTER_DROPDOWN_MIN_WIDTH_SM, FILTER_DROPDOWN_MIN_WIDTH_LG } from '../../uiConstants'
import InputLabel from '@mui/material/InputLabel'
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'

function User_dashboard() {
  const theme = useTheme()
  const navigate = useNavigate()
  const [userRole, setUserRole] = useState(null)
  const [userEmail, setUserEmail] = useState(null)
  const [forms, setForms] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all') // 'all', 'pending', 'sent for approval', 'approved', 'rejected'
  const [filterBusinessProcess, setFilterBusinessProcess] = useState('all') // 'all' or specific business process
  const [filterFinancialYear, setFilterFinancialYear] = useState('all') // 'all' or specific financial year
  const [financialYearOptions, setFinancialYearOptions] = useState([])

  // Business process options (matching other pages)
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

  const extractUniqueFinancialYears = (rows) => {
    return [...new Set(
      (rows || [])
        .map(form => form.financial_year?.toString().trim())
        .filter(year => year && year !== '')
    )]
  }

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
    // Fetch forms when user email is available or filter changes
    if (userEmail) {
      fetchForms()
    }
  }, [userEmail, filter, filterBusinessProcess, filterFinancialYear])

  const fetchForms = async () => {
    if (!userEmail) return
    
    setLoading(true)
    try {
      // Build URL with process_owner, active, and optional filters
      let url = `http://localhost:3000/api/control-forms?process_owner=${encodeURIComponent(userEmail)}&active=true`
      
      // Add status filter parameter to API (API handles all filtering)
      if (filter !== 'all') {
        url += `&status=${encodeURIComponent(filter)}`
      }

      // Add business process filter if selected
      if (filterBusinessProcess !== 'all') {
        url += `&business_process=${encodeURIComponent(filterBusinessProcess)}`
      }

      // Add financial year filter if selected
      if (filterFinancialYear !== 'all') {
        url += `&financial_year=${encodeURIComponent(filterFinancialYear)}`
      }
      
      const response = await fetch(url, {
        method: 'GET',
        credentials: 'include',
      })

      const data = await response.json()

      if (response.ok && data.success) {
        // API already filters and sorts, but we'll sort again client-side as fallback
        const sortedForms = [...data.data].sort((a, b) => {
          const dateA = a.created_at ? new Date(a.created_at).getTime() : 0
          const dateB = b.created_at ? new Date(b.created_at).getTime() : 0
          return dateB - dateA // Descending order (newest first)
        })
        
        setForms(sortedForms)

        // Update financial year options based on fetched data
        const latestYears = extractUniqueFinancialYears(data.data)
        if (latestYears.length > 0) {
          // No localStorage caching here; just derive from current data
          setFinancialYearOptions(latestYears)
        } else {
          setFinancialYearOptions([])
        }
      } else {
        console.error('Error fetching forms:', data.message)
        setForms([])
      }
    } catch (error) {
      console.error('Error fetching forms:', error)
      setForms([])
    } finally {
      setLoading(false)
    }
  }

  const handleFormClick = (formId) => {
    navigate(`/user/form/${formId}`)
  }

  const formatStatus = (status) => {
    // If status is null, empty, or undefined, return 'Pending'
    if (!status || status === '' || status === null) {
      return 'Pending'
    }
    if (status === 'sent for approval') {
      return 'pending'
    }
    // Capitalize first letter, keep rest as is
    return status.charAt(0).toUpperCase() + status.slice(1)
  }

  const getStatusColor = (status) => {
    const formattedStatus = formatStatus(status)
    if (formattedStatus === 'Pending' || formattedStatus === 'pending') {
      return { bg: '#fef3c7', color: '#f59e0b' }
    } else if (formattedStatus === 'Approved') {
      return { bg: '#d1fae5', color: '#10b981' }
    } else if (formattedStatus === 'Rejected') {
      return { bg: '#fee2e2', color: '#ef4444' }
    } else if (formattedStatus === 'Sent for approval') {
      return { bg: '#fef3c7', color: '#f59e0b' }
    }
    return { bg: '#f3f4f6', color: '#6b7280' }
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
          <Box 
            sx={{ 
              display: 'flex', 
              flexDirection: { xs: 'column', sm: 'row' }, 
              justifyContent: 'space-between', 
              alignItems: { xs: 'flex-start', sm: 'center' },
              mb: 3,
              gap: 2
            }}
          >
            <Typography 
              variant="h5" 
              component="h2"
              sx={{ 
                fontWeight: 700, 
                color: theme.palette.text.primary,
              }}
            >
              My RACM
            </Typography>

            {/* In-container filters */}
            <Box
              sx={{
                display: 'flex',
                flexDirection: { xs: 'column', sm: 'row' },
                gap: 2,
                alignItems: { xs: 'stretch', sm: 'center' },
                width: { xs: '100%', sm: 'auto' },
              }}
            >
              {/* Status Filter */}
              <Box sx={{ minWidth: { xs: '100%', sm: FILTER_DROPDOWN_MIN_WIDTH_SM } }}>
                <FormControl
                  variant="outlined"
                  fullWidth
                  size="small"
                >
                  <InputLabel id="status-filter-label">Status</InputLabel>
                  <Select
                    labelId="status-filter-label"
                    id="status-filter"
                    value={filter}
                    label="Status"
                    onChange={(e) => setFilter(e.target.value)}
                  >
                    <MenuItem value="all">All</MenuItem>
                    <MenuItem value="pending">Pending</MenuItem>
                    <MenuItem value="sent for approval">Sent for Approval</MenuItem>
                    <MenuItem value="approved">Approved</MenuItem>
                    <MenuItem value="rejected">Rejected</MenuItem>
                  </Select>
                </FormControl>
              </Box>
              {/* Business Process Filter */}
              <Box sx={{ minWidth: { xs: '100%', sm: FILTER_DROPDOWN_MIN_WIDTH_LG } }}>
                <FormControl
                  variant="outlined"
                  fullWidth
                  size="small"
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
              </Box>

              {/* Financial Year Filter */}
              <Box sx={{ minWidth: { xs: '100%', sm: FILTER_DROPDOWN_MIN_WIDTH_SM } }}>
                <FormControl
                  variant="outlined"
                  fullWidth
                  size="small"
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
              </Box>
            </Box>
          </Box>

          {loading ? (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Typography color="text.secondary">Loading forms...</Typography>
            </Box>
          ) : forms.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Typography color="text.secondary">
                {filter === 'all' 
                  ? 'No active forms assigned to you.' 
                  : filter === 'pending'
                  ? 'No pending forms.'
                  : filter === 'sent for approval'
                  ? 'No forms sent for approval.'
                  : filter === 'approved'
                  ? 'No approved forms.'
                  : 'No rejected forms.'}
              </Typography>
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
                      Sub Process
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
                          {form.sub_process || 'N/A'}
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
                          {form.standard_control_description || 'N/A'}
                        </Box>
                        <Box
                          component="td"
                          sx={{
                            px: 3,
                            py: 2,
                            whiteSpace: 'nowrap',
                          }}
                        >
                          <Chip
                            label={formatStatus(form.status)}
                            size="small"
                            sx={{
                              backgroundColor: getStatusColor(form.status).bg,
                              color: getStatusColor(form.status).color,
                              fontWeight: 600,
                            }}
                          />
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
