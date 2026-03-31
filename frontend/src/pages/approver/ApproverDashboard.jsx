import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTheme } from '@mui/material/styles'
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import Tooltip from '@mui/material/Tooltip'
import FormControl from '@mui/material/FormControl'
import InputLabel from '@mui/material/InputLabel'
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import {
  FILTER_BOX_MIN_WIDTH,
  PAGE_SUBHEADER_TEXT_SX,
  TABLE_HEADER_BG,
  TABLE_ROW_HOVER_BG,
} from '../../uiConstants'
import { STORAGE_KEYS } from '../../storageKeys'

function ApproverDashboard() {
  const theme = useTheme()
  const navigate = useNavigate()
  const [approver, setApprover] = useState(null)
  const [forms, setForms] = useState([])
  const [companyOptions, setCompanyOptions] = useState([])
  const [financialYearOptions, setFinancialYearOptions] = useState([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState('pending') // 'pending', 'all', 'approved', 'rejected'
  const [filterCompany, setFilterCompany] = useState('all')
  const [filterBusinessProcess, setFilterBusinessProcess] = useState('all')
  const [filterFinancialYear, setFilterFinancialYear] = useState('all')

  const businessProcessOptions = [
    'Purchase to Pay',
    'Order to Cash',
    'Hire to Retire',
    'Capital Expenditure',
    'Treasury',
    'Financial Statement Closure Process',
    'Information Technology General Controls',
    'Entity Level Controls',
  ]

  const getDistinctCompanyNames = (rows) => {
    return [...new Set(
      (rows || [])
        .map((form) => (form.company_name ?? '').toString().trim())
        .filter(Boolean)
    )].sort((a, b) => a.localeCompare(b))
  }

  const getDistinctFinancialYears = (rows) => {
    return [...new Set(
      (rows || [])
        .map((form) => (form.financial_year ?? '').toString().trim())
        .filter(Boolean)
    )].sort((a, b) => a.localeCompare(b))
  }

  const loadCachedCompanyOptions = () => {
    try {
      const cached = localStorage.getItem(STORAGE_KEYS.approverCompanyNames)
      if (!cached) return

      const parsed = JSON.parse(cached)
      if (Array.isArray(parsed)) {
        setCompanyOptions(parsed)
      }
    } catch (error) {
      console.error('Error reading approver company options from localStorage:', error)
    }
  }

  const loadCachedFinancialYearOptions = () => {
    try {
      const cached = localStorage.getItem(STORAGE_KEYS.approverFinancialYears)
      if (!cached) return

      const parsed = JSON.parse(cached)
      if (Array.isArray(parsed)) {
        setFinancialYearOptions(parsed)
      }
    } catch (error) {
      console.error('Error reading approver financial year options from localStorage:', error)
    }
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
          if (data.user.role !== 'approver') {
            localStorage.removeItem(STORAGE_KEYS.approverCompanyNames)
            localStorage.removeItem(STORAGE_KEYS.approverFinancialYears)
            navigate('/login')
            return
          }

          // Store user info as approver for compatibility
          setApprover({
            id: data.user.id,
            email_id: data.user.email_id
          })
        } else {
          localStorage.removeItem(STORAGE_KEYS.approverCompanyNames)
          localStorage.removeItem(STORAGE_KEYS.approverFinancialYears)
          navigate('/login')
        }
      } catch (error) {
        console.error('Error fetching user info:', error)
        localStorage.removeItem(STORAGE_KEYS.approverCompanyNames)
        localStorage.removeItem(STORAGE_KEYS.approverFinancialYears)
        navigate('/login')
      }
    }

    loadCachedCompanyOptions()
    loadCachedFinancialYearOptions()
    fetchUserInfo()
  }, [navigate])

  useEffect(() => {
    if (approver) {
      bootstrapFilterOptions()
    }
  }, [approver])

  useEffect(() => {
    if (approver) {
      fetchForms()
    }
  }, [approver])

  useEffect(() => {
    if (filterCompany !== 'all' && !companyOptions.includes(filterCompany)) {
      setFilterCompany('all')
    }
  }, [companyOptions, filterCompany])

  useEffect(() => {
    if (filterFinancialYear !== 'all' && !financialYearOptions.includes(filterFinancialYear)) {
      setFilterFinancialYear('all')
    }
  }, [financialYearOptions, filterFinancialYear])

  const bootstrapFilterOptions = async () => {
    try {
      const response = await fetch('http://localhost:3000/api/approver/control-forms', {
        method: 'GET',
        credentials: 'include',
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        console.error('Error loading approver filter options:', data.message)
        return
      }

      const companies = getDistinctCompanyNames(data.data)
      const years = getDistinctFinancialYears(data.data)
      setCompanyOptions(companies)
      setFinancialYearOptions(years)
      localStorage.setItem(STORAGE_KEYS.approverCompanyNames, JSON.stringify(companies))
      localStorage.setItem(STORAGE_KEYS.approverFinancialYears, JSON.stringify(years))
    } catch (error) {
      console.error('Error loading approver filter options:', error)
    }
  }

  const formatStatus = (status) => {
    if (!status || status === '' || status === null) {
      return 'Pending'
    }
    if (status === 'sent for approval') {
      return 'Pending'
    }
    return status.charAt(0).toUpperCase() + status.slice(1)
  }

  const fetchForms = async () => {
    setLoading(true)
    try {
      const url = 'http://localhost:3000/api/approver/control-forms'

      const response = await fetch(url, {
        method: 'GET',
        credentials: 'include',
      })

      const data = await response.json()

      if (response.ok && data.success) {
        const sortedForms = [...data.data].sort((a, b) => {
          const dateA = a.created_at ? new Date(a.created_at).getTime() : 0
          const dateB = b.created_at ? new Date(b.created_at).getTime() : 0
          return dateB - dateA // Descending order (newest first)
        })

        const latestCompanyOptions = getDistinctCompanyNames(data.data)
        const latestFinancialYears = getDistinctFinancialYears(data.data)
        if (latestCompanyOptions.length > 0) {
          setCompanyOptions((currentOptions) => {
            const mergedCompanyOptions = [...new Set([...(currentOptions || []), ...latestCompanyOptions])]
              .sort((a, b) => a.localeCompare(b))

            if (JSON.stringify(mergedCompanyOptions) !== JSON.stringify(currentOptions)) {
              localStorage.setItem(STORAGE_KEYS.approverCompanyNames, JSON.stringify(mergedCompanyOptions))
              return mergedCompanyOptions
            }

            return currentOptions
          })
        }

        if (latestFinancialYears.length > 0) {
          setFinancialYearOptions((currentOptions) => {
            const mergedFinancialYears = [...new Set([...(currentOptions || []), ...latestFinancialYears])]
              .sort((a, b) => a.localeCompare(b))

            if (JSON.stringify(mergedFinancialYears) !== JSON.stringify(currentOptions)) {
              localStorage.setItem(STORAGE_KEYS.approverFinancialYears, JSON.stringify(mergedFinancialYears))
              return mergedFinancialYears
            }

            return currentOptions
          })
        }

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
    navigate(`/approver/form/${formId}`)
  }

  const formsToDisplay = forms.filter((form) => {
    const normalizedCompany = (form.company_name ?? '').toString().trim()
    const normalizedBusinessProcess = (form.business_process ?? '').toString().trim()
    const normalizedFinancialYear = (form.financial_year ?? '').toString().trim()
    const normalizedStatus = formatStatus(form.status)
    const isActive = form.active && form.active !== '' && form.active !== '0'

    if (filterCompany !== 'all' && normalizedCompany !== filterCompany) {
      return false
    }

    if (filterBusinessProcess !== 'all' && normalizedBusinessProcess !== filterBusinessProcess) {
      return false
    }

    if (filterFinancialYear !== 'all' && normalizedFinancialYear !== filterFinancialYear) {
      return false
    }

    if (filterStatus !== 'all' && normalizedStatus.toLowerCase() !== filterStatus.toLowerCase()) {
      return false
    }

    if (!isActive) {
      return false
    }

    return true
  })
  const truncatedTextSx = {
    display: 'inline-block',
    maxWidth: '100%',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  }
  const tooltipSx = {
    bgcolor: theme.palette.mode === 'dark' ? 'grey.900' : 'grey.800',
    fontSize: '0.75rem',
    maxWidth: 420,
  }
  const filterControlSx = {
    minWidth: FILTER_BOX_MIN_WIDTH,
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
  }

  return (
    <Box
      sx={{
        maxWidth: '100%',
        mx: 'auto',
        px: 0,
        py: 4,
      }}
    >
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
            gap: 2,
          }}
        >
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <Typography
              variant="h5"
              component="h2"
              sx={{
                fontWeight: 700,
                color:
                  theme.palette.mode === 'dark'
                    ? theme.palette.text.primary
                    : theme.palette.secondary.main,
              }}
            >
              {filterStatus === 'pending'
                ? 'Pending Approvals'
                : filterStatus === 'approved'
                ? 'Approved RACM'
                : filterStatus === 'rejected'
                ? 'Rejected RACM'
                : 'All RACM'}
            </Typography>
            <Typography sx={PAGE_SUBHEADER_TEXT_SX}>
              Review active RACMs across companies, and open a control to approve or reject.
            </Typography>
          </Box>

          <Box
            sx={{
              display: 'flex',
              flexDirection: { xs: 'column', sm: 'row' },
              gap: 2,
              alignItems: { xs: 'stretch', sm: 'center' },
              width: { xs: '100%', sm: 'auto' },
            }}
          >
            <FormControl variant="outlined" sx={filterControlSx}>
              <InputLabel id="approver-business-process-filter-label">Business Process</InputLabel>
              <Select
                labelId="approver-business-process-filter-label"
                id="approver-business-process-filter"
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

            <FormControl variant="outlined" sx={filterControlSx}>
              <InputLabel id="approver-financial-year-filter-label">Financial Year</InputLabel>
              <Select
                labelId="approver-financial-year-filter-label"
                id="approver-financial-year-filter"
                value={filterFinancialYear}
                label="Financial Year"
                onChange={(e) => setFilterFinancialYear(e.target.value)}
              >
                <MenuItem value="all">All</MenuItem>
                {financialYearOptions.map((year) => (
                  <MenuItem key={year} value={year}>
                    {year}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl variant="outlined" sx={filterControlSx}>
              <InputLabel id="approver-company-filter-label">Company</InputLabel>
              <Select
                labelId="approver-company-filter-label"
                id="approver-company-filter"
                value={filterCompany}
                label="Company"
                onChange={(e) => setFilterCompany(e.target.value)}
              >
                <MenuItem value="all">All</MenuItem>
                {companyOptions.map((company) => (
                  <MenuItem key={company} value={company}>
                    {company}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl variant="outlined" sx={filterControlSx}>
              <InputLabel id="approver-status-filter-label">Status</InputLabel>
              <Select
                labelId="approver-status-filter-label"
                id="approver-status-filter"
                value={filterStatus}
                label="Status"
                onChange={(e) => setFilterStatus(e.target.value)}
              >
                <MenuItem value="all">All</MenuItem>
                <MenuItem value="pending">Pending</MenuItem>
                <MenuItem value="approved">Approved</MenuItem>
                <MenuItem value="rejected">Rejected</MenuItem>
              </Select>
            </FormControl>
          </Box>
        </Box>

        {loading ? (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Typography color="text.secondary">Loading forms...</Typography>
          </Box>
        ) : formsToDisplay.length === 0 ? (
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
                  backgroundColor: TABLE_HEADER_BG,
                }}
              >
                <Box component="tr">
                  <Box
                    component="th"
                    sx={{
                      px: 2.5,
                      py: 1.5,
                      textAlign: 'left',
                      fontSize: '0.75rem',
                      fontWeight: 500,
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      color: theme.palette.text.secondary,
                      width: '72px',
                      minWidth: '72px',
                      maxWidth: '72px',
                    }}
                  >
                    #
                  </Box>
                  <Box
                    component="th"
                    sx={{
                      px: 2.5,
                      py: 1.5,
                      textAlign: 'left',
                      fontSize: '0.75rem',
                      fontWeight: 500,
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      color: theme.palette.text.secondary,
                      width: '280px',
                      minWidth: '240px',
                      maxWidth: '320px',
                    }}
                  >
                    Standard Control Description
                  </Box>
                  <Box
                    component="th"
                    sx={{
                      px: 2.5,
                      py: 1.5,
                      textAlign: 'left',
                      fontSize: '0.75rem',
                      fontWeight: 500,
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      color: theme.palette.text.secondary,
                      width: '200px',
                      minWidth: '180px',
                      maxWidth: '220px',
                    }}
                  >
                    Business Process
                  </Box>
                  <Box
                    component="th"
                    sx={{
                      px: 2.5,
                      py: 1.5,
                      textAlign: 'left',
                      fontSize: '0.75rem',
                      fontWeight: 500,
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      color: theme.palette.text.secondary,
                      width: '140px',
                      minWidth: '140px',
                      maxWidth: '140px',
                    }}
                  >
                    Financial Year
                  </Box>
                  <Box
                    component="th"
                    sx={{
                      px: 2.5,
                      py: 1.5,
                      textAlign: 'left',
                      fontSize: '0.75rem',
                      fontWeight: 500,
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      color: theme.palette.text.secondary,
                      width: '220px',
                      minWidth: '200px',
                      maxWidth: '240px',
                    }}
                  >
                    Company
                  </Box>
                  <Box
                    component="th"
                    sx={{
                      px: 2.5,
                      py: 1.5,
                      textAlign: 'left',
                      fontSize: '0.75rem',
                      fontWeight: 500,
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      color: theme.palette.text.secondary,
                      width: '220px',
                      minWidth: '200px',
                      maxWidth: '240px',
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
                      width: '120px',
                      minWidth: '120px',
                      maxWidth: '120px',
                    }}
                  >
                    Approval Status
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
                      width: '180px',
                      minWidth: '180px',
                      maxWidth: '180px',
                    }}
                  >
                    Created At
                  </Box>
                </Box>
              </Box>
              <Box component="tbody">
                {formsToDisplay.map((form, index) => {
                  const status = formatStatus(form.status)

                  return (
                    <Box
                      component="tr"
                      key={form.id}
                      onClick={() => handleFormClick(form.form_id)}
                      sx={{
                        cursor: 'pointer',
                        transition: 'background-color 0.2s',
                        '&:hover': {
                          backgroundColor: TABLE_ROW_HOVER_BG,
                        },
                      }}
                    >
                      <Box
                        component="td"
                        sx={{
                          px: 2.5,
                          py: 2,
                          width: '72px',
                          minWidth: '72px',
                          maxWidth: '72px',
                          fontSize: '0.875rem',
                          color: theme.palette.text.primary,
                        }}
                      >
                        {index + 1}
                      </Box>
                      <Box
                        component="td"
                        sx={{
                          px: 2.5,
                          py: 2,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          width: '280px',
                          minWidth: '240px',
                          maxWidth: '320px',
                          fontSize: '0.875rem',
                          color: theme.palette.text.primary,
                        }}
                      >
                        <Tooltip
                          title={form.standard_control_description || 'N/A'}
                          arrow
                          slotProps={{ tooltip: { sx: tooltipSx } }}
                        >
                          <Box component="span" sx={truncatedTextSx}>
                            {form.standard_control_description || 'N/A'}
                          </Box>
                        </Tooltip>
                      </Box>
                      <Box
                        component="td"
                        sx={{
                          px: 2.5,
                          py: 2,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          width: '200px',
                          minWidth: '180px',
                          maxWidth: '220px',
                          fontSize: '0.875rem',
                          color: theme.palette.text.primary,
                        }}
                        >
                        <Box component="span" sx={truncatedTextSx}>
                          {form.business_process || 'N/A'}
                        </Box>
                      </Box>
                      <Box
                        component="td"
                        sx={{
                          px: 2.5,
                          py: 2,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          width: '140px',
                          minWidth: '140px',
                          maxWidth: '140px',
                          fontSize: '0.875rem',
                          color: theme.palette.text.primary,
                        }}
                      >
                        <Box component="span" sx={truncatedTextSx}>
                          {form.financial_year || 'N/A'}
                        </Box>
                      </Box>
                      <Box
                        component="td"
                        sx={{
                          px: 2.5,
                          py: 2,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          width: '220px',
                          minWidth: '200px',
                          maxWidth: '240px',
                          fontSize: '0.875rem',
                          color: theme.palette.text.primary,
                        }}
                      >
                        <Tooltip
                          title={form.company_name || 'N/A'}
                          arrow
                          slotProps={{ tooltip: { sx: tooltipSx } }}
                        >
                          <Box component="span" sx={truncatedTextSx}>
                            {form.company_name || 'N/A'}
                          </Box>
                        </Tooltip>
                      </Box>
                      <Box
                        component="td"
                        sx={{
                          px: 2.5,
                          py: 2,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          width: '220px',
                          minWidth: '200px',
                          maxWidth: '240px',
                          fontSize: '0.875rem',
                          color: theme.palette.text.primary,
                        }}
                      >
                        <Tooltip
                          title={form.process_owner_name || form.process_owner || 'N/A'}
                          arrow
                          slotProps={{ tooltip: { sx: tooltipSx } }}
                        >
                          <Box component="span" sx={truncatedTextSx}>
                            {form.process_owner_name || form.process_owner || 'N/A'}
                          </Box>
                        </Tooltip>
                      </Box>
                      <Box
                        component="td"
                        sx={{
                          px: 3,
                          py: 2,
                          whiteSpace: 'nowrap',
                          width: '120px',
                          minWidth: '120px',
                          maxWidth: '120px',
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
                            backgroundColor: status === 'Approved'
                              ? (theme.palette.mode === 'dark' ? 'rgba(16, 185, 129, 0.2)' : '#d1fae5')
                              : status === 'Rejected'
                              ? (theme.palette.mode === 'dark' ? 'rgba(239, 68, 68, 0.2)' : '#fee2e2')
                              : (theme.palette.mode === 'dark' ? 'rgba(245, 158, 11, 0.2)' : '#fef3c7'),
                            color: status === 'Approved'
                              ? (theme.palette.mode === 'dark' ? '#10b981' : '#065f46')
                              : status === 'Rejected'
                              ? (theme.palette.mode === 'dark' ? '#ef4444' : '#991b1b')
                              : (theme.palette.mode === 'dark' ? '#f59e0b' : '#92400e'),
                          }}
                        >
                          {status}
                        </Box>
                      </Box>
                      <Box
                        component="td"
                        sx={{
                          px: 3,
                          py: 2,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          width: '180px',
                          minWidth: '180px',
                          maxWidth: '180px',
                          fontSize: '0.875rem',
                          color: theme.palette.text.primary,
                        }}
                      >
                        <Box component="span" sx={truncatedTextSx}>
                          {form.created_at
                            ? new Date(form.created_at).toLocaleDateString('en-IN', {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })
                            : 'N/A'}
                        </Box>
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

export default ApproverDashboard
