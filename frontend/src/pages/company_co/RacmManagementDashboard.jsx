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
import Tooltip from '@mui/material/Tooltip'
import Checkbox from '@mui/material/Checkbox'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogContentText from '@mui/material/DialogContentText'
import DialogActions from '@mui/material/DialogActions'
import { toast } from 'react-hot-toast'

function RacmManagementDashboard() {
  const theme = useTheme()
  const navigate = useNavigate()
  const [userRole, setUserRole] = useState(null)
  const [companyIdentifier, setCompanyIdentifier] = useState(null)
  const [forms, setForms] = useState([])
  const [filterActive, setFilterActive] = useState('all') // 'all', 'active', 'inactive'
  const [filterStatus, setFilterStatus] = useState('all') // 'all', 'Approved', 'Rejected', 'Pending'
  const [filterBusinessProcess, setFilterBusinessProcess] = useState('all') // 'all' or specific business process
  const [filterFinancialYear, setFilterFinancialYear] = useState('all') // 'all' or specific financial year
  const [financialYearOptions, setFinancialYearOptions] = useState([])
  const [loading, setLoading] = useState(true)
  const [bulkUpdating, setBulkUpdating] = useState(false)
  const [missingUsersDialogOpen, setMissingUsersDialogOpen] = useState(false)
  const [missingProcessOwners, setMissingProcessOwners] = useState([])
  const [deleteMode, setDeleteMode] = useState(false)
  const [setActiveMode, setSetActiveMode] = useState(false)
  const [replicateMode, setReplicateMode] = useState(false)
  const [selectedForms, setSelectedForms] = useState(new Set())
  const [deleteConfirmDialogOpen, setDeleteConfirmDialogOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [setActiveConfirmDialogOpen, setSetActiveConfirmDialogOpen] = useState(false)
  const [replicateDialogOpen, setReplicateDialogOpen] = useState(false)
  const [replicateTargetFY, setReplicateTargetFY] = useState('')
  const [replicating, setReplicating] = useState(false)
  const [formsToActivateAfterMissingUsersConfirm, setFormsToActivateAfterMissingUsersConfirm] = useState([])
  const [missingRacmCount, setMissingRacmCount] = useState(0)

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
  }, [companyIdentifier, filterActive, filterStatus, filterBusinessProcess, filterFinancialYear])

  useEffect(() => {
    if (companyIdentifier) {
      loadFinancialYearOptions(companyIdentifier)
    }
  }, [companyIdentifier])

  // Reset selected forms when selection modes are turned off
  useEffect(() => {
    if (!deleteMode && !setActiveMode && !replicateMode) {
      setSelectedForms(new Set())
    }
  }, [deleteMode, setActiveMode, replicateMode])

  const getFinancialYearStorageKey = (companyId) => `ifc_financial_year_options_${companyId}`

  const extractUniqueFinancialYears = (rows) => {
    return [...new Set(
      (rows || [])
        .map(form => form.financial_year?.toString().trim())
        .filter(year => year && year !== '')
    )]
  }

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
      console.error('Error reading financial year options from localStorage:', error)
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
      console.error('Error bootstrapping financial year options:', error)
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
    if (!companyIdentifier) return
    
    setLoading(true)
    try {
      let url = `http://localhost:3000/api/control-forms?company_identifier=${encodeURIComponent(companyIdentifier)}`
      
      if (filterActive === 'active') {
        url += '&active=true'
      } else if (filterActive === 'inactive') {
        url += '&active=false'
      }
      
      if (filterStatus !== 'all' && filterStatus !== 'Pending') {
        // Backend expects lowercase status values: 'approved', 'rejected', etc.
        url += `&status=${encodeURIComponent(filterStatus.toLowerCase())}`
      }
      
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
        // Filter for Pending status on client side if needed
        let filteredData = data.data
        if (filterStatus === 'Pending') {
          filteredData = data.data.filter(form => {
            const status = form.status || ''
            return !status || status === '' || status.toLowerCase() === 'sent for approval'
          })
        }
        
        // Sort forms by created_at timestamp (newest first)
        const sortedForms = [...filteredData].sort((a, b) => {
          const dateA = a.created_at ? new Date(a.created_at).getTime() : 0
          const dateB = b.created_at ? new Date(b.created_at).getTime() : 0
          return dateB - dateA // Descending order (newest first)
        })
        setForms(sortedForms)

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

  const handleFormClick = (formId, e) => {
    // Prevent navigation when in delete mode, set active mode, or when clicking checkbox
    if (deleteMode || setActiveMode || replicateMode || (e && e.target.type === 'checkbox')) {
      return
    }
    navigate(`/company_co/form/${formId}`)
  }

  const handleSetActiveModeToggle = () => {
    // Enter set active mode
    setSetActiveMode(true)
    setSelectedForms(new Set())
    // Exit delete mode if active
    if (deleteMode) {
      setDeleteMode(false)
    }
    if (replicateMode) {
      setReplicateMode(false)
      setReplicateTargetFY('')
    }
  }

  // Handle click outside to cancel selection mode
  const handleClickOutside = (e) => {
    // If any dialog is open, do not cancel selection modes
    if (setActiveConfirmDialogOpen || replicateDialogOpen || deleteConfirmDialogOpen || missingUsersDialogOpen) {
      return
    }

    // Don't cancel if clicking on:
    // - Checkboxes (input type="checkbox" or their labels)
    // - The action buttons (Set Active/Delete) - but allow if clicking the button to proceed
    // - Inside dialogs
    const target = e.target
    const isCheckbox = target.type === 'checkbox' || 
                       target.closest('input[type="checkbox"]') || 
                       target.closest('label[for]') ||
                       target.closest('[role="checkbox"]')
    const isDialog = target.closest('[role="dialog"]')
    
    // Allow button clicks to proceed (they handle their own logic)
    const clickedButton = target.closest('button')
    if (clickedButton && (clickedButton.textContent?.includes('Set Active') || clickedButton.textContent?.includes('Delete') || clickedButton.textContent?.includes('Replicate'))) {
      // Let the button's onClick handle it
      return
    }
    
    if (isCheckbox || isDialog) {
      return
    }
    
    // Cancel selection mode
    if (setActiveMode || deleteMode || replicateMode) {
      setSetActiveMode(false)
      setDeleteMode(false)
      setReplicateMode(false)
      setReplicateTargetFY('')
      setSelectedForms(new Set())
    }
  }


  const checkUserExists = async (email) => {
    if (!email || !email.trim()) return false
    
    try {
      const response = await fetch(`http://localhost:3000/api/company-co/check-user/${encodeURIComponent(email.trim())}`, {
        method: 'GET',
        credentials: 'include',
      })

      const data = await response.json()
      return data.success && data.exists
    } catch (error) {
      console.error('Error checking user:', error)
      return false
    }
  }

  const handleSetActiveClick = () => {
    if (selectedForms.size === 0) {
      // If no selection, just exit the mode
      setSetActiveMode(false)
      return
    }
    setSetActiveConfirmDialogOpen(true)
  }

  const handleSetActiveCancel = () => {
    setSetActiveConfirmDialogOpen(false)
  }

  const handleSetActiveConfirm = async () => {
    setSetActiveConfirmDialogOpen(false)
    
    if (!companyIdentifier) {
      toast.error('Company identifier not found')
      return
    }

    // Get selected forms
    const selectedFormIds = Array.from(selectedForms)
    const selectedFormsData = forms.filter(form => selectedFormIds.includes(form.form_id))

    // First, check all process owners from selected forms
    const processOwnerEmails = selectedFormsData
      .map(form => form.process_owner?.trim())
      .filter(email => email && email !== '')
    
    // Remove duplicates
    const uniqueProcessOwnerEmails = [...new Set(processOwnerEmails)]
    
    // Check which process owners exist / don't exist
    const missingEmails = []
    const existingEmails = []
    for (const email of uniqueProcessOwnerEmails) {
      const exists = await checkUserExists(email)
      if (exists) {
        existingEmails.push(email)
      } else {
        missingEmails.push(email)
      }
    }

    if (missingEmails.length > 0) {
      // Count how many selected RACMs are impacted (whose process owner email is missing)
      const affectedRacmsCount = selectedFormsData.filter(form => {
        const email = form.process_owner?.trim()
        return email && missingEmails.includes(email)
      }).length

      // Determine which selected RACMs can still be set active (users exist under the given conditions)
      const validFormIds = selectedFormsData
        .filter(form => {
          const email = form.process_owner?.trim()
          return email && existingEmails.includes(email)
        })
        .map(form => form.form_id)

      setMissingProcessOwners(missingEmails)
      setMissingRacmCount(affectedRacmsCount)
      setFormsToActivateAfterMissingUsersConfirm(validFormIds)
      setMissingUsersDialogOpen(true)
      return
    }

    // If all users exist, proceed with setting selected forms to active
    await performSetActive()
  }

  const performSetActive = async (formIdsOverride) => {
    if (!companyIdentifier) {
      toast.error('Company identifier not found')
      return
    }

    setBulkUpdating(true)
    try {
      // Update each selected form individually
      const selectedFormIds = Array.isArray(formIdsOverride) && formIdsOverride.length > 0
        ? formIdsOverride
        : Array.from(selectedForms)
      let successCount = 0
      let failCount = 0

      for (const formId of selectedFormIds) {
        try {
          const response = await fetch(`http://localhost:3000/api/control-forms/${formId}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
            },
            credentials: 'include',
            body: JSON.stringify({
              active: '1',
              modifiedFields: ['active']
            })
          })

          const data = await response.json()

          if (response.ok && data.success) {
            successCount++
          } else {
            failCount++
            console.error(`Failed to set form ${formId} to active:`, data.message)
          }
        } catch (error) {
          failCount++
          console.error(`Error setting form ${formId} to active:`, error)
        }
      }

      if (successCount > 0) {
        toast.success(`Successfully set ${successCount} RACM(s) to active`)
      }
      if (failCount > 0) {
        toast.error(`Failed to set ${failCount} RACM(s) to active`)
      }

      // Reset set active mode and refresh forms
      setSetActiveMode(false)
      setSelectedForms(new Set())
      setFormsToActivateAfterMissingUsersConfirm([])
      setMissingRacmCount(0)
      fetchForms()
    } catch (error) {
      console.error('Error setting forms to active:', error)
      toast.error('Error setting forms to active')
    } finally {
      setBulkUpdating(false)
    }
  }

  const handleMissingUsersCancel = () => {
    setMissingUsersDialogOpen(false)
    setMissingProcessOwners([])
    setFormsToActivateAfterMissingUsersConfirm([])
    setMissingRacmCount(0)
  }

  // Check if all filtered forms are already active
  const allFormsActive = forms.length > 0 && forms.every(form => {
    const isActive = form.active && form.active !== '' && form.active !== '0'
    return isActive
  })

  // Delete mode handlers
  const handleDeleteModeToggle = () => {
    // Enter delete mode
    setDeleteMode(true)
    setSelectedForms(new Set())
    // Exit set active mode if active
    if (setActiveMode) {
      setSetActiveMode(false)
    }
    if (replicateMode) {
      setReplicateMode(false)
      setReplicateTargetFY('')
    }
  }

  const handleReplicateModeToggle = () => {
    // Enter replicate mode
    setReplicateMode(true)
    setSelectedForms(new Set())
    setReplicateTargetFY('')
    // Exit other modes if active
    if (setActiveMode) setSetActiveMode(false)
    if (deleteMode) setDeleteMode(false)
  }

  const getSelectedFormsData = () => {
    const ids = Array.from(selectedForms)
    return forms.filter(f => ids.includes(f.form_id))
  }

  // Given a Financial Year like "2025-26" or "2025-2026" or even "2025",
  // return the next two FYs in "YYYY-YY" format.
  // Example: "2025-26" -> ["2026-27", "2027-28"]
  const parseNextTwoFYs = (fy) => {
    const input = (fy ?? '').toString().trim()
    if (!input) return []

    // Extract the first 4-digit year from the string
    const match = input.match(/(\d{4})/)
    if (!match) return []

    const startYear = Number(match[1])
    const options = []

    for (let offset = 1; offset <= 2; offset += 1) {
      const nextStart = startYear + offset
      const endYearShort = String((nextStart + 1) % 100).padStart(2, '0')
      options.push(`${nextStart}-${endYearShort}`)
    }

    return options
  }

  const openReplicateDialog = () => {
    const selectedData = getSelectedFormsData()
    if (selectedData.length === 0) return

    const fySet = new Set(
      selectedData
        .map(r => (r.financial_year ?? '').toString().trim())
        .filter(Boolean)
    )

    if (fySet.size !== 1) {
      toast.error('Select RACMs of only one Financial Year')
      return
    }

    setReplicateTargetFY('')
    setReplicateDialogOpen(true)
  }

  const handleReplicateConfirm = async () => {
    const selectedData = getSelectedFormsData()
    const fySet = new Set(
      selectedData
        .map(r => (r.financial_year ?? '').toString().trim())
        .filter(Boolean)
    )

    if (fySet.size !== 1) {
      toast.error('Select RACMs of only one Financial Year')
      return
    }

    if (!replicateTargetFY || replicateTargetFY.trim() === '') {
      toast.error('Please select a Financial Year')
      return
    }

    setReplicating(true)
    try {
      const response = await fetch('http://localhost:3000/api/control-forms/replicate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          form_ids: Array.from(selectedForms),
          financial_year: replicateTargetFY.trim(),
        })
      })

      const data = await response.json()

      if (response.ok && data.success) {
        toast.success(`Replicated ${data.count || selectedForms.size} RACM(s)`)
        setReplicateDialogOpen(false)
        setReplicateMode(false)
        setSelectedForms(new Set())
        setReplicateTargetFY('')
        fetchForms()
      } else {
        toast.error(data.message || 'Failed to replicate RACMs')
      }
    } catch (error) {
      console.error('Error replicating RACMs:', error)
      toast.error('Error replicating RACMs')
    } finally {
      setReplicating(false)
    }
  }

  const handleSelectForm = (formId) => {
    const newSelected = new Set(selectedForms)
    if (newSelected.has(formId)) {
      newSelected.delete(formId)
    } else {
      newSelected.add(formId)
    }
    setSelectedForms(newSelected)
  }

  const handleSelectAll = () => {
    if (selectedForms.size === forms.length) {
      // Deselect all
      setSelectedForms(new Set())
    } else {
      // Select all visible forms
      const allFormIds = new Set(forms.map(form => form.form_id))
      setSelectedForms(allFormIds)
    }
  }

  const handleDeleteClick = () => {
    if (selectedForms.size === 0) {
      // If no selection, just exit the mode
      setDeleteMode(false)
      return
    }
    setDeleteConfirmDialogOpen(true)
  }

  const handleDeleteCancel = () => {
    setDeleteConfirmDialogOpen(false)
  }

  const handleDeleteConfirm = async () => {
    setDeleteConfirmDialogOpen(false)
    setDeleting(true)

    try {
      const formIds = Array.from(selectedForms)
      let successCount = 0
      let failCount = 0

      // Delete each form sequentially
      for (const formId of formIds) {
        try {
          const response = await fetch(`http://localhost:3000/api/control-forms/${formId}`, {
            method: 'DELETE',
            credentials: 'include',
          })

          const data = await response.json()

          if (response.ok && data.success) {
            successCount++
          } else {
            failCount++
            console.error(`Failed to delete form ${formId}:`, data.message)
          }
        } catch (error) {
          failCount++
          console.error(`Error deleting form ${formId}:`, error)
        }
      }

      if (successCount > 0) {
        toast.success(`Successfully deleted ${successCount} RACM(s)`)
      }
      if (failCount > 0) {
        toast.error(`Failed to delete ${failCount} RACM(s)`)
      }

      // Reset delete mode and refresh forms
      setDeleteMode(false)
      setSelectedForms(new Set())
      fetchForms()
    } catch (error) {
      console.error('Error during bulk delete:', error)
      toast.error('Error deleting RACMs')
    } finally {
      setDeleting(false)
    }
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

  // Handle Activity filter change (independent of Status filter)
  const handleActivityChange = (value) => {
    setFilterActive(value)
  }

  // Add click outside handler
  useEffect(() => {
    if (setActiveMode || deleteMode || replicateMode) {
      // Use setTimeout to avoid immediate cancellation on button click
      const timeoutId = setTimeout(() => {
        document.addEventListener('click', handleClickOutside, true)
      }, 100)
      
      return () => {
        clearTimeout(timeoutId)
        document.removeEventListener('click', handleClickOutside, true)
      }
    }
  }, [
    setActiveMode,
    deleteMode,
    replicateMode,
    setActiveConfirmDialogOpen,
    replicateDialogOpen,
    deleteConfirmDialogOpen,
    missingUsersDialogOpen,
  ])

  return (
    <Box sx={{ maxWidth: '100%', mx: 'auto', px: 2, py: 4 }}>
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'flex-end',
          alignItems: 'center',
          mb: 2,
          gap: 1.5,
        }}
      >
        <Button
              onClick={(e) => {
                e.stopPropagation()
                if (setActiveMode) {
                  // In mode: if has selections, show confirmation; otherwise do nothing (button disabled)
                  if (selectedForms.size > 0) {
                    handleSetActiveClick()
                  }
                } else {
                  // Not in mode: enter mode
                  handleSetActiveModeToggle()
                }
              }}
              disabled={
                loading || 
                forms.length === 0 || 
                allFormsActive || 
                deleteMode || 
                replicateMode ||
                bulkUpdating ||
                (setActiveMode && selectedForms.size === 0) // Disable if in mode but no selections
              }
              variant={setActiveMode ? 'contained' : 'outlined'}
              color={theme.palette.mode === 'dark' ? 'primary' : 'secondary'}
              size="small"
              sx={{
                minWidth: '140px',
                textTransform: 'none',
                fontSize: '0.8rem',
                py: 0.75,
              }}
            >
              {setActiveMode 
                ? (selectedForms.size > 0 ? `Set Active (${selectedForms.size})` : 'Set Active')
                : 'Set Active'}
            </Button>

            <Button
              onClick={(e) => {
                e.stopPropagation()
                if (replicateMode) {
                  if (selectedForms.size > 0) {
                    openReplicateDialog()
                  }
                } else {
                  handleReplicateModeToggle()
                }
              }}
              disabled={
                loading ||
                forms.length === 0 ||
                setActiveMode ||
                deleteMode ||
                replicating ||
                (replicateMode && selectedForms.size === 0)
              }
              variant={replicateMode ? 'contained' : 'outlined'}
              color={theme.palette.mode === 'dark' ? 'primary' : 'secondary'}
              size="small"
              sx={{
                minWidth: '140px',
                textTransform: 'none',
                fontSize: '0.8rem',
                py: 0.75,
              }}
            >
              {replicateMode
                ? (selectedForms.size > 0 ? `Replicate (${selectedForms.size})` : 'Replicate')
                : 'Replicate'}
            </Button>

            <Button
              onClick={(e) => {
                e.stopPropagation()
                if (deleteMode) {
                  // In mode: if has selections, show confirmation; otherwise do nothing (button disabled)
                  if (selectedForms.size > 0) {
                    handleDeleteClick()
                  }
                } else {
                  // Not in mode: enter mode
                  handleDeleteModeToggle()
                }
              }}
              disabled={
                loading || 
                forms.length === 0 || 
                setActiveMode || 
                replicateMode ||
                deleting ||
                (deleteMode && selectedForms.size === 0) // Disable if in mode but no selections
              }
              variant={deleteMode ? 'contained' : 'outlined'}
              color="error"
              size="small"
              sx={{
                minWidth: '140px',
                textTransform: 'none',
                fontSize: '0.8rem',
                py: 0.75,
              }}
            >
              {deleteMode
                ? (selectedForms.size > 0 ? `Delete (${selectedForms.size})` : 'Delete')
                : 'Delete'}
            </Button>
          </Box>

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
            RACM Management
          </Typography>

          <Box
            sx={{
              display: 'flex',
              flexDirection: { xs: 'column', sm: 'row' },
              gap: 2,
              alignItems: { xs: 'stretch', sm: 'center' },
              width: { xs: '100%', sm: 'auto' },
            }}
          >
              {/* Business Process Filter */}
              <FormControl 
                variant="outlined" 
                disabled={deleteMode || setActiveMode || replicateMode}
                sx={{ 
                  minWidth: '200px',
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

              {/* Financial Year Filter */}
              <FormControl
                variant="outlined"
                disabled={deleteMode || setActiveMode || replicateMode}
                sx={{
                  minWidth: '200px',
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
              
              {/* Activity Filter Dropdown */}
              <FormControl
                variant="outlined"
                disabled={deleteMode || setActiveMode || replicateMode}
                sx={{
                  minWidth: '200px',
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
                <InputLabel id="activity-filter-label">Activity</InputLabel>
                <Select
                  labelId="activity-filter-label"
                  id="activity-filter"
                  value={filterActive}
                  label="Activity"
                  onChange={(e) => handleActivityChange(e.target.value)}
                >
                  <MenuItem value="all">All</MenuItem>
                  <MenuItem value="active">Active</MenuItem>
                  <MenuItem value="inactive">Inactive</MenuItem>
                </Select>
              </FormControl>

              {/* Status Filter Dropdown */}
              <FormControl
                variant="outlined"
                disabled={deleteMode || setActiveMode || replicateMode}
                sx={{
                  minWidth: '200px',
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
                <InputLabel id="status-filter-label">Status</InputLabel>
                <Select
                  labelId="status-filter-label"
                  id="status-filter"
                  value={filterStatus}
                  label="Status"
                  onChange={(e) => setFilterStatus(e.target.value)}
                >
                  <MenuItem value="all">All</MenuItem>
                  <MenuItem value="Approved">Approved</MenuItem>
                  <MenuItem value="Rejected">Rejected</MenuItem>
                  <MenuItem value="Pending">Pending</MenuItem>
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
                    {(deleteMode || setActiveMode || replicateMode) && (
                      <Box
                        component="th"
                        sx={{
                          px: 2,
                          py: 1.5,
                          textAlign: 'center',
                          fontSize: '0.75rem',
                          fontWeight: 500,
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em',
                          color: theme.palette.text.secondary,
                          width: '60px',
                          minWidth: '60px',
                          maxWidth: '60px',
                        }}
                      >
                        <Checkbox
                          checked={selectedForms.size === forms.length && forms.length > 0}
                          indeterminate={selectedForms.size > 0 && selectedForms.size < forms.length}
                          onChange={(e) => {
                            e.stopPropagation()
                            handleSelectAll()
                          }}
                          onClick={(e) => e.stopPropagation()}
                          size="small"
                        />
                      </Box>
                    )}
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
                        width: '220px',
                        minWidth: '200px',
                        maxWidth: '260px',
                      }}
                    >
                      Sub Process
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
                        width: '260px',
                        minWidth: '220px',
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
                        width: '120px',
                        minWidth: '120px',
                        maxWidth: '120px',
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
                        width: '140px',
                        minWidth: '140px',
                        maxWidth: '140px',
                      }}
                    >
                      Created At
                    </Box>
                  </Box>
                </Box>
                <Box component="tbody">
                  {forms.map((form) => {
                    const isActive = form.active && form.active !== '' && form.active !== '0'
                    const status = formatStatus(form.status)
                    const isSelected = selectedForms.has(form.form_id)
                    return (
                      <Box
                        component="tr"
                        key={form.id}
                        onClick={(e) => {
                          e.stopPropagation()
                          handleFormClick(form.form_id, e)
                        }}
                        sx={{
                          cursor: (deleteMode || setActiveMode || replicateMode) ? 'default' : 'pointer',
                          transition: 'background-color 0.2s',
                          backgroundColor: isSelected 
                            ? (deleteMode 
                                ? (theme.palette.mode === 'dark' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(239, 68, 68, 0.1)')
                                : (theme.palette.mode === 'dark' ? 'rgba(3, 105, 161, 0.2)' : 'rgba(3, 105, 161, 0.1)'))
                            : 'transparent',
                          '&:hover': {
                            backgroundColor: (deleteMode || setActiveMode || replicateMode)
                              ? (isSelected 
                                  ? (deleteMode 
                                      ? (theme.palette.mode === 'dark' ? 'rgba(239, 68, 68, 0.25)' : 'rgba(239, 68, 68, 0.15)')
                                      : (theme.palette.mode === 'dark' ? 'rgba(3, 105, 161, 0.25)' : 'rgba(3, 105, 161, 0.15)'))
                                  : (theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.05)' : '#f9fafb'))
                              : (theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.05)' : '#f9fafb'),
                          },
                        }}
                      >
                        {(deleteMode || setActiveMode || replicateMode) && (
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
                              checked={isSelected}
                              onChange={(e) => {
                                e.stopPropagation()
                                handleSelectForm(form.form_id)
                              }}
                              onClick={(e) => e.stopPropagation()}
                              size="small"
                            />
                          </Box>
                        )}
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
                            width: '220px',
                            minWidth: '200px',
                            maxWidth: '260px',
                            fontSize: '0.875rem',
                            color: theme.palette.text.primary,
                          }}
                        >
                          <Tooltip title={form.sub_process || 'N/A'} arrow slotProps={{ tooltip: { sx: tooltipSx } }}>
                            <Box component="span" sx={truncatedTextSx}>
                              {form.sub_process || 'N/A'}
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
                            width: '260px',
                            minWidth: '220px',
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
                            px: 3,
                            py: 2,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            width: '120px',
                            minWidth: '120px',
                            maxWidth: '120px',
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
                            width: '140px',
                            minWidth: '140px',
                            maxWidth: '140px',
                            fontSize: '0.875rem',
                            color: theme.palette.text.primary,
                          }}
                        >
                          <Box component="span" sx={truncatedTextSx}>
                            {form.created_at
                              ? new Date(form.created_at).toLocaleDateString()
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

        {/* Set Active Confirmation Dialog */}
        <Dialog
          open={setActiveConfirmDialogOpen}
          onClose={handleSetActiveCancel}
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
            Confirm Set Active
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
              Are you sure you want to set the selected RACM(s) to active?
            </DialogContentText>
            <Box sx={{ mt: 2 }}>
              <Typography
                variant="body2"
                sx={{
                  color: theme.palette.text.primary,
                  fontWeight: 500,
                }}
              >
                Total number of RACM(s) selected: <strong>{selectedForms.size}</strong>
              </Typography>
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
              onClick={handleSetActiveCancel}
              variant="outlined"
              disabled={bulkUpdating}
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
              onClick={handleSetActiveConfirm} 
              variant="contained" 
              color="secondary"
              disabled={bulkUpdating}
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
              {bulkUpdating ? 'Setting...' : 'Set Active'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Replicate Dialog */}
        <Dialog
          open={replicateDialogOpen}
          onClose={() => {
            if (!replicating) {
              setReplicateDialogOpen(false)
              setReplicateTargetFY('')
            }
          }}
          aria-labelledby="replicate-dialog-title"
          aria-describedby="replicate-dialog-description"
          PaperProps={{
            sx: {
              borderRadius: 2,
              minWidth: { xs: '90%', sm: '460px' },
              boxShadow: theme.palette.mode === 'dark'
                ? '0 8px 32px rgba(0, 0, 0, 0.4)'
                : '0 8px 32px rgba(0, 0, 0, 0.12)',
            },
          }}
        >
          <DialogTitle
            id="replicate-dialog-title"
            sx={{
              pb: 2.5,
              pt: 3,
              px: 3,
              fontWeight: 600,
              fontSize: '1.25rem',
              color: theme.palette.text.primary,
            }}
          >
            Replicate RACM(s)
          </DialogTitle>
          <DialogContent sx={{ px: 3, pt: 3, pb: 3 }}>
            <DialogContentText
              id="replicate-dialog-description"
              sx={{
                color: theme.palette.text.secondary,
                fontSize: '0.9375rem',
                lineHeight: 1.5,
                m: 0,
                mb: 2,
              }}
            >
              Select the target Financial Year for the replicated RACM(s).
            </DialogContentText>

            <Box sx={{ mt: 2 }}>
              <Typography
                variant="body2"
                sx={{
                  color: theme.palette.text.primary,
                  fontWeight: 500,
                  mb: 1.5,
                }}
              >
                Total selected: <strong>{selectedForms.size}</strong>
              </Typography>

              <FormControl
                fullWidth
                variant="outlined"
                disabled={replicating}
                sx={{
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
                <InputLabel id="replicate-fy-label">Financial Year</InputLabel>
                <Select
                  labelId="replicate-fy-label"
                  id="replicate-fy"
                  value={replicateTargetFY}
                  label="Financial Year"
                  onChange={(e) => setReplicateTargetFY(e.target.value)}
                >
                  <MenuItem value="">Select</MenuItem>
                  {(() => {
                    const selectedData = getSelectedFormsData()
                    const fySet = new Set(
                      selectedData
                        .map(r => (r.financial_year ?? '').toString().trim())
                        .filter(Boolean)
                    )
                    const selectedFY = fySet.size === 1 ? Array.from(fySet)[0] : ''
                    const options = parseNextTwoFYs(selectedFY)
                    return options.map(opt => (
                      <MenuItem key={opt} value={opt}>{opt}</MenuItem>
                    ))
                  })()}
                </Select>
              </FormControl>
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
              onClick={() => {
                if (!replicating) {
                  setReplicateDialogOpen(false)
                  setReplicateTargetFY('')
                }
              }}
              variant="outlined"
              disabled={replicating}
              sx={{
                textTransform: 'none',
                px: 3,
                py: 1,
                minWidth: '100px',
                borderColor: theme.palette.mode === 'dark'
                  ? 'rgba(255, 255, 255, 0.23)'
                  : 'rgba(0, 0, 0, 0.23)',
                color: theme.palette.text.primary,
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleReplicateConfirm}
              variant="contained"
              color="secondary"
              disabled={replicating || !replicateTargetFY}
              sx={{
                textTransform: 'none',
                px: 3,
                py: 1,
                minWidth: '120px',
                fontWeight: 600,
              }}
            >
              {replicating ? 'Replicating...' : 'Replicate'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Missing Process Owners Dialog */}
        <Dialog
          open={missingUsersDialogOpen}
          onClose={handleMissingUsersCancel}
          aria-labelledby="missing-users-dialog-title"
          aria-describedby="missing-users-dialog-description"
          PaperProps={{
            sx: {
              borderRadius: 2,
              minWidth: { xs: '90%', sm: '500px' },
              maxWidth: { xs: '90%', sm: '600px' },
              boxShadow: theme.palette.mode === 'dark'
                ? '0 8px 32px rgba(0, 0, 0, 0.4)'
                : '0 8px 32px rgba(0, 0, 0, 0.12)',
            },
          }}
        >
          <DialogTitle 
            id="missing-users-dialog-title"
            sx={{
              pb: 2.5,
              pt: 3,
              px: 3,
              fontWeight: 600,
              fontSize: '1.25rem',
              color: theme.palette.text.primary,
            }}
          >
            Create Missing Users
          </DialogTitle>
          <DialogContent sx={{ px: 3, pt: 3, pb: 3 }}>
            <DialogContentText 
              id="missing-users-dialog-description"
              sx={{
                color: theme.palette.text.secondary,
                fontSize: '0.9375rem',
                lineHeight: 1.5,
                m: 0,
                mb: 2,
              }}
            >
              The following Process Owner email addresses do not exist as users in your company (with role set to &quot;user&quot;).
              Please create user accounts for these emails from the Create User screen.
            </DialogContentText>
            <Box sx={{ mt: 2 }}>
              <Typography
                variant="body2"
                sx={{
                  color: theme.palette.text.primary,
                  fontWeight: 500,
                  mb: 0.5,
                }}
              >
                Total number of RACM(s) whose user doesn&apos;t exist: <strong>{missingRacmCount}</strong>
              </Typography>
              {formsToActivateAfterMissingUsersConfirm.length > 0 && (
                <Typography
                  variant="body2"
                  sx={{
                    color: theme.palette.text.primary,
                    mt: 0.5,
                  }}
                >
                  Would you like to set Active the other RACM(s) whose users exist? These RACM(s) count:{' '}
                  <strong>{formsToActivateAfterMissingUsersConfirm.length}</strong>
                </Typography>
              )}
            </Box>
            <Box sx={{ mt: 2, mb: 2 }}>
              <Typography
                variant="body2"
                sx={{
                  color: theme.palette.text.primary,
                  fontWeight: 500,
                  mb: 1.5,
                }}
              >
                Missing Process Owners ({missingProcessOwners.length}):
              </Typography>
              <Box
                sx={{
                  maxHeight: '300px',
                  overflowY: 'auto',
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: 1,
                  p: 2,
                  backgroundColor: theme.palette.mode === 'dark' 
                    ? 'rgba(255, 255, 255, 0.05)' 
                    : 'rgba(0, 0, 0, 0.02)',
                }}
              >
                {missingProcessOwners.map((email, index) => (
                  <Typography
                    key={index}
                    variant="body2"
                    sx={{
                      color: theme.palette.text.primary,
                      py: 0.5,
                      borderBottom: index < missingProcessOwners.length - 1 ? '1px solid' : 'none',
                      borderColor: 'divider',
                    }}
                  >
                    {email}
                  </Typography>
                ))}
              </Box>
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
              onClick={handleMissingUsersCancel}
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
              Close
            </Button>
            {formsToActivateAfterMissingUsersConfirm.length > 0 && (
              <Button 
                onClick={async () => {
                  setMissingUsersDialogOpen(false)
                  const idsToActivate = [...formsToActivateAfterMissingUsersConfirm]
                  setFormsToActivateAfterMissingUsersConfirm([])
                  setMissingRacmCount(0)
                  await performSetActive(idsToActivate)
                }}
                variant="contained"
                color="secondary"
                disabled={bulkUpdating}
                sx={{
                  textTransform: 'none',
                  px: 3,
                  py: 1,
                  minWidth: '160px',
                  fontWeight: 600,
                }}
              >
                {bulkUpdating ? 'Setting...' : 'Set Active Other RACM(s)'}
              </Button>
            )}
          </DialogActions>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <Dialog
          open={deleteConfirmDialogOpen}
          onClose={handleDeleteCancel}
          aria-labelledby="delete-dialog-title"
          aria-describedby="delete-dialog-description"
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
            id="delete-dialog-title"
            sx={{
              pb: 2.5,
              pt: 3,
              px: 3,
              fontWeight: 600,
              fontSize: '1.25rem',
              color: theme.palette.text.primary,
            }}
          >
            Confirm Delete
          </DialogTitle>
          <DialogContent sx={{ px: 3, pt: 3, pb: 3 }}>
            <DialogContentText 
              id="delete-dialog-description"
              sx={{
                color: theme.palette.text.secondary,
                fontSize: '0.9375rem',
                lineHeight: 1.5,
                m: 0,
                mb: 2,
              }}
            >
              Are you sure you want to delete the selected RACM(s)? This action cannot be undone.
            </DialogContentText>
            <Box sx={{ mt: 2 }}>
              <Typography
                variant="body2"
                sx={{
                  color: theme.palette.text.primary,
                  fontWeight: 500,
                }}
              >
                Total number of RACM(s) selected: <strong>{selectedForms.size}</strong>
              </Typography>
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
              onClick={handleDeleteCancel}
              variant="outlined"
              disabled={deleting}
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
              onClick={handleDeleteConfirm} 
              variant="contained" 
              color="error"
              disabled={deleting}
              autoFocus
              sx={{
                textTransform: 'none',
                px: 3,
                py: 1,
                minWidth: '100px',
                fontWeight: 600,
                backgroundColor: '#ef4444',
                '&:hover': {
                  backgroundColor: '#dc2626',
                },
              }}
            >
              {deleting ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
  )
}

export default RacmManagementDashboard
