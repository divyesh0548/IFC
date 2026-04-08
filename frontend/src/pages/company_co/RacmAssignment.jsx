import React, { useState, useEffect, useRef } from 'react'
import { useTheme, alpha } from '@mui/material/styles'
import Button from '@mui/material/Button'
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import FormControl from '@mui/material/FormControl'
import InputLabel from '@mui/material/InputLabel'
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import Tooltip from '@mui/material/Tooltip'
import Switch from '@mui/material/Switch'
import FormControlLabel from '@mui/material/FormControlLabel'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import TextField from '@mui/material/TextField'
import Autocomplete from '@mui/material/Autocomplete'
import Checkbox from '@mui/material/Checkbox'
import { toast } from 'react-hot-toast'
import {
  FILTER_DROPDOWN_MIN_WIDTH_LG,
  PAGE_SUBHEADER_TEXT_SX,
  TABLE_HEADER_BG,
  TABLE_ROW_HOVER_BG,
} from '../../uiConstants'
import { useSyncGlobalLoading } from '../../contexts/GlobalLoadingContext'

function RacmAssignment() {
  const theme = useTheme()
  const [userRole, setUserRole] = useState(null)
  const [companyIdentifier, setCompanyIdentifier] = useState(null)
  const [forms, setForms] = useState([])
  const [companyUsers, setCompanyUsers] = useState([])
  const [usersLoading, setUsersLoading] = useState(false)
  const [filterAssignment, setFilterAssignment] = useState('all') // 'all' | 'assigned' | 'unassigned'
  const [filterBusinessProcess, setFilterBusinessProcess] = useState('all') // 'all' or specific business process
  const [filterFinancialYear, setFilterFinancialYear] = useState('all') // 'all' or specific financial year
  const [filterSubProcess, setFilterSubProcess] = useState('all') // 'all' or specific sub_process
  const [financialYearOptions, setFinancialYearOptions] = useState([])
  const [subProcessOptions, setSubProcessOptions] = useState([])
  const [cellWordWrap, setCellWordWrap] = useState(false)
  const [loading, setLoading] = useState(true)
  const [assignmentDialogOpen, setAssignmentDialogOpen] = useState(false)
  const [bulkAssignmentMode, setBulkAssignmentMode] = useState(false)
  const [bulkAssignmentDialogOpen, setBulkAssignmentDialogOpen] = useState(false)
  const [selectedForm, setSelectedForm] = useState(null)
  const [selectedUser, setSelectedUser] = useState(null)
  const [bulkSelectedUser, setBulkSelectedUser] = useState(null)
  const [userSearchText, setUserSearchText] = useState('')
  const [bulkUserSearchText, setBulkUserSearchText] = useState('')
  const [updatingAssignment, setUpdatingAssignment] = useState(false)
  const [selectedForms, setSelectedForms] = useState(new Set())
  const bulkAssignmentContainerRef = useRef(null)
  useSyncGlobalLoading(loading || usersLoading || updatingAssignment)
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

  const extractUniqueSubProcesses = (rows) => {
    return [...new Set(
      (rows || [])
        .map((form) => form.sub_process?.toString().trim())
        .filter((sp) => sp && sp !== '')
    )].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
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
  }, [companyIdentifier, filterAssignment, filterBusinessProcess, filterFinancialYear, filterSubProcess])

  useEffect(() => {
    if (!bulkAssignmentMode) {
      setSelectedForms(new Set())
    }
  }, [bulkAssignmentMode])

  useEffect(() => {
    if (bulkAssignmentMode) {
      setSelectedForms(new Set())
    }
  }, [bulkAssignmentMode, filterAssignment, filterBusinessProcess, filterFinancialYear, filterSubProcess])

  const cancelBulkAssignmentMode = () => {
    setBulkAssignmentMode(false)
    setSelectedForms(new Set())
    setBulkAssignmentDialogOpen(false)
    setBulkSelectedUser(null)
    setBulkUserSearchText('')
  }

  const handleClickOutsideBulkAssignment = (e) => {
    if (!bulkAssignmentMode) return
    const el = bulkAssignmentContainerRef.current
    if (!el) return
    if (el.contains(e.target)) return
    cancelBulkAssignmentMode()
  }

  // Click outside handler (match RacmManagementDashboard behavior)
  useEffect(() => {
    if (!bulkAssignmentMode) return
    const timeoutId = setTimeout(() => {
      document.addEventListener('click', handleClickOutsideBulkAssignment, true)
    }, 100)
    return () => {
      clearTimeout(timeoutId)
      document.removeEventListener('click', handleClickOutsideBulkAssignment, true)
    }
  }, [bulkAssignmentMode])

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

      if (filterSubProcess !== 'all') {
        url += `&sub_process=${encodeURIComponent(filterSubProcess)}`
      }
      
      const cacheBustUrl = `${url}&_ts=${Date.now()}`
      const response = await fetch(cacheBustUrl, {
        method: 'GET',
        credentials: 'include',
        cache: 'no-store',
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

        const eligibleForms = sortedForms.filter((form) => {
          const hasDueDate = !!form?.due_date
          const hasReminderFrequency =
            form?.reminder_frequency !== null &&
            form?.reminder_frequency !== undefined &&
            String(form.reminder_frequency).trim() !== ''
          const hasSampleDoc =
            form?.sample_doc !== null &&
            form?.sample_doc !== undefined &&
            String(form.sample_doc).trim() !== ''

          return hasDueDate && hasReminderFrequency && hasSampleDoc
        })

        const assignmentFilteredForms = eligibleForms.filter((form) => {
          if (filterAssignment === 'all') return true
          const hasControlOwner = Boolean(form.control_owner && form.control_owner.trim() !== '')
          return filterAssignment === 'assigned' ? hasControlOwner : !hasControlOwner
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

        const latestSubProcesses = extractUniqueSubProcesses(data.data)
        if (latestSubProcesses.length > 0) {
          setSubProcessOptions((prev) => {
            const merged = [...new Set([...(prev || []), ...latestSubProcesses])].sort((a, b) =>
              a.localeCompare(b, undefined, { sensitivity: 'base' })
            )
            if (merged.join('|') === (prev || []).join('|')) return prev
            return merged
          })
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

  const filterFormControlSx = {
    minWidth: { xs: '100%', sm: FILTER_DROPDOWN_MIN_WIDTH_LG },
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

  const handleFormClick = async (form) => {
    if (bulkAssignmentMode) {
      handleSelectForm(form.form_id)
      return
    }

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

  const handleBulkAssignmentModeToggle = async () => {
    if (!bulkAssignmentMode && companyUsers.length === 0) {
      await fetchCompanyUsers()
    }

    if (bulkAssignmentMode) {
      cancelBulkAssignmentMode()
      return
    }
    setBulkAssignmentMode(true)
    setBulkAssignmentDialogOpen(false)
    setBulkSelectedUser(null)
    setBulkUserSearchText('')
  }

  const handleSelectForm = (formId) => {
    setSelectedForms((prev) => {
      const next = new Set(prev)
      if (next.has(formId)) {
        next.delete(formId)
      } else {
        next.add(formId)
      }
      return next
    })
  }

  const handleSelectAllForms = () => {
    const allVisibleSelected = forms.length > 0 && forms.every((form) => selectedForms.has(form.form_id))
    if (allVisibleSelected) {
      setSelectedForms(new Set())
      return
    }

    setSelectedForms(new Set(forms.map((form) => form.form_id)))
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
          control_owner: selectedUser.email_id,
          active: '1',
          modifiedFields: ['control_owner'],
        }),
      })

      const data = await response.json()
      if (response.ok && data.success) {
        setForms((prev) =>
          prev.map((form) =>
            form.form_id === selectedForm.form_id
              ? {
                  ...form,
                  control_owner: selectedUser.email_id,
                  control_owner_name: selectedUser.emp_name || form.control_owner_name || null,
                }
              : form
          )
        )
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

  const handleOpenBulkAssignmentDialog = async () => {
    if (selectedForms.size === 0) {
      toast.error('Select at least one RACM')
      return
    }

    setBulkSelectedUser(null)
    setBulkUserSearchText('')
    setBulkAssignmentDialogOpen(true)

    if (companyUsers.length === 0) {
      await fetchCompanyUsers()
    }
  }

  const handleCloseBulkAssignmentDialog = () => {
    if (updatingAssignment) return
    setBulkAssignmentDialogOpen(false)
    setBulkSelectedUser(null)
    setBulkUserSearchText('')
  }

  const handleBulkUpdateAssignment = async () => {
    if (!bulkSelectedUser?.email_id || selectedForms.size === 0) return

    setUpdatingAssignment(true)
    try {
      const targetFormIds = Array.from(selectedForms)
      let successCount = 0
      let failCount = 0

      for (const formId of targetFormIds) {
        try {
          const response = await fetch(`http://localhost:3000/api/control-forms/${formId}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
            },
            credentials: 'include',
            body: JSON.stringify({
              control_owner: bulkSelectedUser.email_id,
              active: '1',
              modifiedFields: ['control_owner'],
            }),
          })

          const data = await response.json()
          if (response.ok && data.success) {
            successCount += 1
          } else {
            failCount += 1
          }
        } catch (error) {
          console.error(`Error updating bulk assignment for form ${formId}:`, error)
          failCount += 1
        }
      }

      handleCloseBulkAssignmentDialog()
      setBulkAssignmentMode(false)

      if (successCount > 0) {
        toast.success(`Sucessfully Updated ${successCount} RACM Assignment(s)`)
      }
      if (failCount > 0) {
        toast.error(`Failed to update ${failCount} RACM Assignment(s)`)
      }

      if (successCount > 0) {
        const selectedIds = new Set(targetFormIds)
        setForms((prev) =>
          prev.map((form) =>
            selectedIds.has(form.form_id)
              ? {
                  ...form,
                  control_owner: bulkSelectedUser.email_id,
                  control_owner_name: bulkSelectedUser.emp_name || form.control_owner_name || null,
                }
              : form
          )
        )
      }

      fetchForms()
    } catch (error) {
      console.error('Error updating bulk assignments:', error)
      toast.error('Failed to update RACM assignments')
    } finally {
      setUpdatingAssignment(false)
    }
  }

  const popupLabelSx = {
    minWidth: '300px',
    maxWidth: '300px',
    fontWeight: 600,
    color: theme.palette.text.primary,
  }

  const popupRowSx = {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 1,
    lineHeight: 1.6,
  }

  const popupValue = (value) => {
    if (value === null || value === undefined) return 'None'
    const stringValue = String(value).trim()
    return stringValue === '' ? 'None' : stringValue
  }

  const toolbarBtnRadius = 1
  const toolbarBtnBase = {
    textTransform: 'none',
    fontSize: '0.8125rem',
    fontWeight: 600,
    minWidth: '148px',
    py: 0.7,
    px: 1.75,
    borderRadius: toolbarBtnRadius,
    boxShadow: 'none',
  }
  const tooltipSx = {
    bgcolor: theme.palette.mode === 'dark' ? 'rgba(17, 24, 39, 0.96)' : 'rgba(17, 24, 39, 0.92)',
    color: '#ffffff',
    fontSize: '0.75rem',
    lineHeight: 1.4,
    borderRadius: '8px',
    px: 1.25,
    py: 0.75,
    maxWidth: 420,
    boxShadow: '0 8px 20px rgba(15, 23, 42, 0.25)',
  }
  const truncatedTextSx = {
    display: 'block',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  }
  const wrappedTextSx = {
    display: 'block',
    maxWidth: '100%',
    whiteSpace: 'normal',
    wordBreak: 'break-word',
    overflow: 'visible',
  }
  const dataCellTextSx = cellWordWrap ? wrappedTextSx : truncatedTextSx
  const dataCellSx = (base) => ({
    ...base,
    ...(cellWordWrap
      ? {
          whiteSpace: 'normal',
          wordBreak: 'break-word',
          overflow: 'visible',
          textOverflow: 'clip',
          verticalAlign: 'top',
        }
      : {
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }),
  })

  return (
    <Box sx={{ maxWidth: '100%', mx: 'auto', px: 0, py: 4 }}>
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'flex-end',
          alignItems: 'center',
          mb: 2,
          gap: 1.5,
        }}
      >
        {bulkAssignmentMode && (
          <Button
            variant="contained"
            color={theme.palette.mode === 'dark' ? 'primary' : 'secondary'}
            onClick={handleOpenBulkAssignmentDialog}
            disabled={selectedForms.size === 0 || updatingAssignment}
            size="small"
            sx={{
              ...toolbarBtnBase,
              '&:hover': { boxShadow: 'none' },
            }}
          >
            {selectedForms.size > 0 ? `Assign Selected (${selectedForms.size})` : 'Assign Selected'}
          </Button>
        )}
        {!bulkAssignmentMode && (
          <Button
            variant="contained"
            color="secondary"
            onClick={handleBulkAssignmentModeToggle}
            disabled={updatingAssignment}
            size="small"
            sx={{
              ...toolbarBtnBase,
              '&:hover': { boxShadow: 'none' },
            }}
          >
            Bulk Assignment
          </Button>
        )}
      </Box>

        {/* Forms Section */}
        <Paper 
          elevation={3}
          ref={bulkAssignmentContainerRef}
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
                }}
              >
                RACM Assignment
              </Typography>
              <Typography
                sx={PAGE_SUBHEADER_TEXT_SX}
              >
                Assign RACM to control owners and manage existing RACM assignments.
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
              {/* Sub Process Filter (unique values from loaded RACMs) */}
              <FormControl
                variant="outlined"
                sx={filterFormControlSx}
              >
                <InputLabel id="sub-process-filter-label">Sub Process</InputLabel>
                <Select
                  labelId="sub-process-filter-label"
                  id="sub-process-filter"
                  value={filterSubProcess}
                  label="Sub Process"
                  onChange={(e) => setFilterSubProcess(e.target.value)}
                >
                  <MenuItem value="all">All</MenuItem>
                  {subProcessOptions.map((option) => (
                    <MenuItem key={option} value={option}>
                      {option}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              {/* Financial Year Filter */}
              <FormControl 
                variant="outlined" 
                sx={filterFormControlSx}
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
                sx={filterFormControlSx}
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

              {/* Assignment Filter */}
              <FormControl 
                variant="outlined" 
                sx={filterFormControlSx}
              >
                <InputLabel id="assignment-filter-label">Assignment</InputLabel>
                <Select
                  labelId="assignment-filter-label"
                  id="assignment-filter"
                  value={filterAssignment}
                  label="Assignment"
                  onChange={(e) => setFilterAssignment(e.target.value)}
                >
                  <MenuItem value="all">All</MenuItem>
                  <MenuItem value="assigned">Assigned</MenuItem>
                  <MenuItem value="unassigned">Unassigned</MenuItem>
                </Select>
              </FormControl>
              
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
            <Box>
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  alignItems: 'center',
                  mb: 1.5,
                  flexWrap: 'wrap',
                  gap: 1,
                }}
              >
                <FormControlLabel
                  control={
                    <Switch
                      checked={cellWordWrap}
                      onChange={(e) => setCellWordWrap(e.target.checked)}
                      size="small"
                      color="primary"
                    />
                  }
                  label="Word wrap"
                  sx={{
                    mr: 0,
                    userSelect: 'none',
                    '& .MuiFormControlLabel-label': {
                      fontSize: '0.8125rem',
                      color: theme.palette.text.secondary,
                    },
                  }}
                />
              </Box>
            <Box sx={{ overflowX: 'auto' }}>
              <Box
                component="table"
                sx={{
                  width: '100%',
                  tableLayout: 'fixed',
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
                  {bulkAssignmentMode && (
                    <Box
                      component="th"
                      sx={{
                        px: 2,
                        py: 1.5,
                        textAlign: 'center',
                        width: '60px',
                        minWidth: '60px',
                        maxWidth: '60px',
                      }}
                    >
                      <Checkbox
                        checked={forms.length > 0 && forms.every((form) => selectedForms.has(form.form_id))}
                        indeterminate={selectedForms.size > 0 && selectedForms.size < forms.length}
                        onChange={handleSelectAllForms}
                        size="small"
                      />
                    </Box>
                  )}
                  <Box
                    component="th"
                    sx={{
                      px: 2,
                      py: 1.5,
                      textAlign: 'left',
                      fontSize: '0.75rem',
                      fontWeight: 500,
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      color: theme.palette.text.secondary,
                      width: '11%',
                      minWidth: '132px',
                      maxWidth: '160px',
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
                      width: '28%',
                      minWidth: '280px',
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
                      width: '18%',
                      minWidth: '200px',
                    }}
                  >
                    Sub Process
                  </Box>
                    <Box
                      component="th"
                      sx={{
                        px: 2,
                        py: 1.5,
                        textAlign: 'left',
                        fontSize: '0.75rem',
                        fontWeight: 500,
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        color: theme.palette.text.secondary,
                        width: '9%',
                        minWidth: '96px',
                        maxWidth: '120px',
                      }}
                    >
                      Financial Year
                    </Box>
                    <Box
                      component="th"
                      sx={{
                        px: 2,
                        py: 1.5,
                        textAlign: 'left',
                        fontSize: '0.75rem',
                        fontWeight: 500,
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        color: theme.palette.text.secondary,
                        width: '17%',
                        minWidth: '180px',
                      }}
                    >
                      Control Owner
                    </Box>
                    <Box
                      component="th"
                      sx={{
                        px: 2,
                        py: 1.5,
                        textAlign: 'left',
                        fontSize: '0.75rem',
                        fontWeight: 500,
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        color: theme.palette.text.secondary,
                        width: '17%',
                        minWidth: '160px',
                      }}
                    >
                      Name of Control Owner
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
                            backgroundColor: TABLE_ROW_HOVER_BG,
                          },
                        }}
                      >
                        {bulkAssignmentMode && (
                          <Box
                            component="td"
                            sx={{
                              px: 2,
                              py: 2,
                              textAlign: 'center',
                              width: '60px',
                              minWidth: '60px',
                              maxWidth: '60px',
                            }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Checkbox
                              checked={selectedForms.has(form.form_id)}
                              onChange={() => handleSelectForm(form.form_id)}
                              size="small"
                            />
                          </Box>
                        )}
                        <Box
                          component="td"
                          title={form.business_process || 'N/A'}
                          sx={dataCellSx({
                            px: 2,
                            py: 2,
                            width: '11%',
                            minWidth: '132px',
                            maxWidth: '160px',
                            fontSize: '0.875rem',
                            color: theme.palette.text.primary,
                          })}
                        >
                          <Tooltip
                            title={form.business_process || 'N/A'}
                            arrow
                            slotProps={{ tooltip: { sx: tooltipSx } }}
                          >
                            <Box component="span" sx={dataCellTextSx}>
                              {form.business_process || 'N/A'}
                            </Box>
                          </Tooltip>
                        </Box>
                        <Box
                          component="td"
                          title={form.standard_control_description || 'N/A'}
                          sx={dataCellSx({
                            px: 3,
                            py: 2,
                            width: '28%',
                            minWidth: '280px',
                            fontSize: '0.875rem',
                            color: theme.palette.text.primary,
                          })}
                        >
                          <Tooltip
                            title={form.standard_control_description || 'N/A'}
                            arrow
                            slotProps={{ tooltip: { sx: tooltipSx } }}
                          >
                            <Box component="span" sx={dataCellTextSx}>
                              {form.standard_control_description || 'N/A'}
                            </Box>
                          </Tooltip>
                        </Box>
                        <Box
                          component="td"
                          title={form.sub_process || 'N/A'}
                          sx={dataCellSx({
                            px: 3,
                            py: 2,
                            width: '18%',
                            minWidth: '200px',
                            fontSize: '0.875rem',
                            color: theme.palette.text.primary,
                          })}
                        >
                          <Tooltip
                            title={form.sub_process || 'N/A'}
                            arrow
                            slotProps={{ tooltip: { sx: tooltipSx } }}
                          >
                            <Box component="span" sx={dataCellTextSx}>
                              {form.sub_process || 'N/A'}
                            </Box>
                          </Tooltip>
                        </Box>
                        <Box
                          component="td"
                          sx={dataCellSx({
                            px: 2,
                            py: 2,
                            width: '9%',
                            minWidth: '96px',
                            maxWidth: '120px',
                            fontSize: '0.875rem',
                            color: theme.palette.text.primary,
                          })}
                        >
                          <Tooltip
                            title={form.financial_year || 'N/A'}
                            arrow
                            slotProps={{ tooltip: { sx: tooltipSx } }}
                          >
                            <Box component="span" sx={dataCellTextSx}>
                              {form.financial_year || 'N/A'}
                            </Box>
                          </Tooltip>
                        </Box>
                        <Box
                          component="td"
                          title={form.control_owner || 'N/A'}
                          sx={dataCellSx({
                            px: 2,
                            py: 2,
                            width: '17%',
                            minWidth: '180px',
                            fontSize: '0.875rem',
                            color: theme.palette.text.primary,
                          })}
                        >
                          <Tooltip
                            title={form.control_owner || 'N/A'}
                            arrow
                            slotProps={{ tooltip: { sx: tooltipSx } }}
                          >
                            <Box component="span" sx={dataCellTextSx}>
                              {form.control_owner || 'N/A'}
                            </Box>
                          </Tooltip>
                        </Box>
                        <Box
                          component="td"
                          title={form.control_owner_name || '-'}
                          sx={dataCellSx({
                            px: 2,
                            py: 2,
                            width: '17%',
                            minWidth: '160px',
                            fontSize: '0.875rem',
                            color: theme.palette.text.primary,
                          })}
                        >
                          <Tooltip
                            title={form.control_owner_name || '-'}
                            arrow
                            slotProps={{ tooltip: { sx: tooltipSx } }}
                          >
                            <Box component="span" sx={dataCellTextSx}>
                              {form.control_owner_name || '-'}
                            </Box>
                          </Tooltip>
                        </Box>
                      </Box>
                    )
                  })}
                </Box>
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
                <Box sx={popupRowSx}>
                  <Typography variant="body2" component="span" sx={popupLabelSx}>Standard Control Description:</Typography>
                  <Typography variant="body2" component="span">{popupValue(selectedForm.standard_control_description)}</Typography>
                </Box>
                <Box sx={popupRowSx}>
                  <Typography variant="body2" component="span" sx={popupLabelSx}>Business Process:</Typography>
                  <Typography variant="body2" component="span">{popupValue(selectedForm.business_process)}</Typography>
                </Box>
                <Box sx={popupRowSx}>
                  <Typography variant="body2" component="span" sx={popupLabelSx}>Sub Process:</Typography>
                  <Typography variant="body2" component="span">{popupValue(selectedForm.sub_process)}</Typography>
                </Box>
                <Box sx={popupRowSx}>
                  <Typography variant="body2" component="span" sx={popupLabelSx}>Financial Year:</Typography>
                  <Typography variant="body2" component="span">{popupValue(selectedForm.financial_year)}</Typography>
                </Box>
                <Box sx={popupRowSx}>
                  <Typography variant="body2" component="span" sx={popupLabelSx}>Current Control Owner Name:</Typography>
                  <Typography variant="body2" component="span">{popupValue(selectedForm.control_owner_name)}</Typography>
                </Box>
                <Box sx={{ ...popupRowSx, mb: 2 }}>
                  <Typography variant="body2" component="span" sx={popupLabelSx}>Current Control Owner Email:</Typography>
                  <Typography variant="body2" component="span">{popupValue(selectedForm.control_owner)}</Typography>
                </Box>

                <Autocomplete
                  options={
                    assignableUsers.filter((user) => {
                      const currentOwner = (selectedForm?.control_owner || '').trim().toLowerCase()
                      const userEmail = (user.email_id || '').trim().toLowerCase()
                      // Exclude the user who is already assigned as control owner for this RACM
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

        <Dialog
          open={bulkAssignmentDialogOpen}
          onClose={handleCloseBulkAssignmentDialog}
          fullWidth
          maxWidth="md"
        >
          <DialogTitle sx={{ fontWeight: 700 }}>
            Bulk RACM Assignment
          </DialogTitle>
          <DialogContent dividers>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              <Box sx={popupRowSx}>
                <Typography variant="body2" component="span" sx={popupLabelSx}>Total selected RACMs:</Typography>
                <Typography variant="body2" component="span">{popupValue(selectedForms.size)}</Typography>
              </Box>
              <Typography variant="body2" sx={{ mb: 2, color: 'text.secondary' }}>
                The selected user will overwrite the current Control Owner for all selected RACMs.
              </Typography>

              <Autocomplete
                options={assignableUsers}
                loading={usersLoading}
                value={bulkSelectedUser}
                inputValue={bulkUserSearchText}
                onInputChange={(_, newInputValue) => setBulkUserSearchText(newInputValue)}
                onChange={(_, newValue) => setBulkSelectedUser(newValue)}
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
                {bulkSelectedUser?.email_id || ' '}
              </Typography>
            </Box>
          </DialogContent>
          <DialogActions sx={{ px: 3, py: 2 }}>
            <Button onClick={handleCloseBulkAssignmentDialog} disabled={updatingAssignment}>
              Cancel
            </Button>
            {bulkSelectedUser?.email_id && (
              <Button
                variant="contained"
                color="secondary"
                onClick={handleBulkUpdateAssignment}
                disabled={updatingAssignment}
              >
                {updatingAssignment ? 'Updating...' : 'Update Assignments'}
              </Button>
            )}
          </DialogActions>
        </Dialog>
      </Box>
  )
}

export default RacmAssignment
