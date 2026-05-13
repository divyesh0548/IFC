import React, { useState, useEffect, useRef } from 'react'
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
import Switch from '@mui/material/Switch'
import FormControlLabel from '@mui/material/FormControlLabel'
import Alert from '@mui/material/Alert'
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
import { apiUrl, API_BASE_URL } from '../../config/api'
import { useBusinessProcesses } from '../../hooks/useBusinessProcesses'

function RacmAssignment() {
  const UNIT_MISMATCH_TOAST_ID = 'racm-assignment-unit-mismatch'
  const theme = useTheme()
  const [companyIdentifier, setCompanyIdentifier] = useState(null)
  const [forms, setForms] = useState([])
  const [companyUsers, setCompanyUsers] = useState([])
  const [usersLoading, setUsersLoading] = useState(false)
  const [filterAssignment, setFilterAssignment] = useState('all') // 'all' | 'assigned' | 'unassigned'
  const [filterBusinessProcess, setFilterBusinessProcess] = useState('all') // 'all' or specific business process
  const [filterFinancialYear, setFilterFinancialYear] = useState('all') // 'all' or specific financial year
  const [filterSubProcess, setFilterSubProcess] = useState('all') // 'all' or specific sub_process
  const [filterUnit, setFilterUnit] = useState('all') // 'all' or specific unit_id
  const [filterActive, setFilterActive] = useState('all') // 'all' | 'active' | 'inactive'
  const [financialYearOptions, setFinancialYearOptions] = useState([])
  const [subProcessOptions, setSubProcessOptions] = useState([])
  const [coordinatorUnits, setCoordinatorUnits] = useState([])
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
  const { businessProcessOptions } = useBusinessProcesses()
  useSyncGlobalLoading(loading || usersLoading || updatingAssignment)
  const assignableUsers = companyUsers.filter((user) => {
    const coordinatorCompany = (companyIdentifier || '').trim()
    const userCompany = (user.company_identifier || '').trim()
    const isSameCompany = !userCompany || userCompany === coordinatorCompany
    return isSameCompany && user.role === 'user'
  })
  const getFormUnitId = (form) => String(form?.unit_id || '').trim()
  const isFormActive = (form) => Boolean(form?.active)
  const getFormUnitName = (form) => {
    const unitName = String(form?.unit_name || '').trim()
    if (unitName) return unitName
    const unitId = getFormUnitId(form)
    const mappedUnit = coordinatorUnits.find((unit) => String(unit.unit_id || '').trim() === unitId)
    return mappedUnit?.unit_name || unitId || 'N/A'
  }
  const filterUsersByUnit = (users, unitId) => {
    const targetUnitId = String(unitId || '').trim()
    if (!targetUnitId) return []
    return users.filter((user) => String(user.unit_id || '').trim() === targetUnitId)
  }
  const selectedFormRows = forms.filter((form) => selectedForms.has(form.form_id))
  const selectedBulkUnitId = selectedFormRows.length > 0 ? getFormUnitId(selectedFormRows[0]) : ''
  const selectedBulkUnitName = selectedFormRows.length > 0 ? getFormUnitName(selectedFormRows[0]) : ''
  const hasSelectedActiveRacm = selectedFormRows.some((form) => isFormActive(form))
  const selectedUnitUserOptions = filterUsersByUnit(assignableUsers, getFormUnitId(selectedForm))
  const bulkUnitUserOptions = filterUsersByUnit(assignableUsers, selectedBulkUnitId)

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

  const racmHasSampleDocument = (form) => {
    if (Array.isArray(form?.sample_docs) && form.sample_docs.some((doc) => String(doc?.sample_doc || '').trim() !== '')) {
      return true
    }
    return String(form?.sample_doc || '').trim() !== ''
  }

  useEffect(() => {
    // Fetch user role and company_identifier on component mount
    const fetchUserInfo = async () => {
      try {
        const response = await fetch(apiUrl('/api/auth/verify'), {
          method: 'GET',
          credentials: 'include',
        })

        const data = await response.json()

        if (response.ok && data.success) {
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
      fetchCoordinatorUnits()
    }
  }, [companyIdentifier])

  const fetchCoordinatorUnits = async () => {
    try {
      const response = await fetch(apiUrl('/api/company-co/unit-management'), {
        method: 'GET',
        credentials: 'include',
      })
      const data = await response.json()

      if (response.ok && data.success) {
        const units = Array.isArray(data.data?.currentCoordinatorUnits)
          ? data.data.currentCoordinatorUnits
          : []
        setCoordinatorUnits(units)
        if (units.length === 1) {
          setFilterUnit(units[0].unit_id || 'all')
        }
      } else {
        setCoordinatorUnits([])
      }
    } catch (error) {
      console.error('Error fetching coordinator units:', error)
      setCoordinatorUnits([])
    }
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
      console.error('Error reading financial year options from localStorage (RacmAssignment):', error)
    }

    try {
      const url = `${API_BASE_URL}/api/control-forms/assignment-eligible?company_identifier=${encodeURIComponent(companyId)}`
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
  }, [companyIdentifier, filterAssignment, filterBusinessProcess, filterFinancialYear, filterSubProcess, filterUnit, filterActive])

  useEffect(() => {
    if (!bulkAssignmentMode) {
      setSelectedForms(new Set())
    }
  }, [bulkAssignmentMode])

  useEffect(() => {
    if (bulkAssignmentMode) {
      setSelectedForms(new Set())
    }
  }, [bulkAssignmentMode, filterAssignment, filterBusinessProcess, filterFinancialYear, filterSubProcess, filterUnit])

  const cancelBulkAssignmentMode = () => {
    setBulkAssignmentMode(false)
    setSelectedForms(new Set())
    setBulkAssignmentDialogOpen(false)
    setBulkSelectedUser(null)
    setBulkUserSearchText('')
  }

  const handleClickOutsideBulkAssignment = (e) => {
    if (!bulkAssignmentMode) return
    if (bulkAssignmentDialogOpen) return
    if (e.target instanceof Element && e.target.closest('[data-bulk-assignment-action="true"]')) return
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
  }, [bulkAssignmentMode, bulkAssignmentDialogOpen])

  const fetchForms = async () => {
    if (!companyIdentifier) return
    
    setLoading(true)
    try {
      let url = `${API_BASE_URL}/api/control-forms/assignment-eligible?company_identifier=${encodeURIComponent(companyIdentifier)}`
      
      if (filterBusinessProcess !== 'all') {
        url += `&business_process=${encodeURIComponent(filterBusinessProcess)}`
      }
      
      if (filterFinancialYear !== 'all') {
        url += `&financial_year=${encodeURIComponent(filterFinancialYear)}`
      }

      if (filterSubProcess !== 'all') {
        url += `&sub_process=${encodeURIComponent(filterSubProcess)}`
      }

      if (filterUnit !== 'all') {
        url += `&unit_id=${encodeURIComponent(filterUnit)}`
      }

      if (filterActive !== 'all') {
        url += `&active=${encodeURIComponent(filterActive === 'active' ? 'true' : 'false')}`
      }

      if (filterAssignment !== 'all') {
        url += `&assignment=${encodeURIComponent(filterAssignment)}`
      }
      
      const cacheBustUrl = `${url}&_ts=${Date.now()}`
      const response = await fetch(cacheBustUrl, {
        method: 'GET',
        credentials: 'include',
        cache: 'no-store',
      })

      const data = await response.json()

      if (response.ok && data.success) {
        const fetchedForms = Array.isArray(data.data) ? data.data : []
        setForms(fetchedForms)

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
      const response = await fetch(apiUrl('/api/company-co/users'), {
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
    const targetForm = forms.find((form) => form.form_id === formId)
    const targetUnitId = getFormUnitId(targetForm)

    setSelectedForms((prev) => {
      const next = new Set(prev)
      if (next.has(formId)) {
        next.delete(formId)
        toast.dismiss(UNIT_MISMATCH_TOAST_ID)
        setBulkSelectedUser(null)
        setBulkUserSearchText('')
      } else {
        const existingForm = forms.find((form) => next.has(form.form_id))
        const existingUnitId = getFormUnitId(existingForm)
        if (existingUnitId && targetUnitId && existingUnitId !== targetUnitId) {
          toast.error('RACMs from different units cannot be selected for bulk assignment', {
            id: UNIT_MISMATCH_TOAST_ID,
          })
          return prev
        }
        next.add(formId)
        toast.dismiss(UNIT_MISMATCH_TOAST_ID)
        setBulkSelectedUser(null)
        setBulkUserSearchText('')
      }
      return next
    })
  }

  const handleSelectAllForms = () => {
    const allVisibleSelected = forms.length > 0 && forms.every((form) => selectedForms.has(form.form_id))
    if (allVisibleSelected) {
      setSelectedForms(new Set())
      toast.dismiss(UNIT_MISMATCH_TOAST_ID)
      setBulkSelectedUser(null)
      setBulkUserSearchText('')
      return
    }

    const unitIds = [...new Set(forms.map((form) => getFormUnitId(form)).filter(Boolean))]
    if (unitIds.length > 1) {
      toast.error('RACMs from different units cannot be selected for bulk assignment', {
        id: UNIT_MISMATCH_TOAST_ID,
      })
      return
    }

    toast.dismiss(UNIT_MISMATCH_TOAST_ID)
    setBulkSelectedUser(null)
    setBulkUserSearchText('')
    setSelectedForms(new Set(forms.map((form) => form.form_id)))
  }

  const handleUpdateAssignment = async () => {
    if (!selectedForm?.form_id || !selectedUser?.email_id) return
    if (isFormActive(selectedForm)) return

    setUpdatingAssignment(true)
    try {
      if (!racmHasSampleDocument(selectedForm)) {
        toast('1 RACM does not have Sample documents, Proceeding to Set Active.')
      }

      const response = await fetch(`${API_BASE_URL}/api/control-forms/${selectedForm.form_id}`, {
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

    const unitIds = [...new Set(selectedFormRows.map((form) => getFormUnitId(form)).filter(Boolean))]
    if (unitIds.length > 1) {
      toast.error('RACMs from different units cannot be selected for bulk assignment')
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
    if (hasSelectedActiveRacm) return

    setUpdatingAssignment(true)
    try {
      const targetFormIds = Array.from(selectedForms)
      const missingSampleDocCount = targetFormIds.filter((formId) => {
        const form = forms.find((item) => item.form_id === formId)
        return !racmHasSampleDocument(form)
      }).length
      let successCount = 0
      let failCount = 0

      if (missingSampleDocCount > 0) {
        toast(`${missingSampleDocCount} RACM(s) do not have Sample documents, Proceeding to Set Active.`)
      }

      for (const formId of targetFormIds) {
        try {
          const response = await fetch(`${API_BASE_URL}/api/control-forms/${formId}`, {
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
            data-bulk-assignment-action="true"
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
            data-bulk-assignment-action="true"
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
                Assign RACM to Process Owners and manage existing RACM assignments.
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
              {coordinatorUnits.length > 1 && (
                <FormControl
                  variant="outlined"
                  sx={filterFormControlSx}
                >
                  <InputLabel id="unit-filter-label">Unit</InputLabel>
                  <Select
                    labelId="unit-filter-label"
                    id="unit-filter"
                    value={filterUnit}
                    label="Unit"
                    onChange={(e) => setFilterUnit(e.target.value)}
                  >
                    <MenuItem value="all">All</MenuItem>
                    {coordinatorUnits.map((unit) => (
                      <MenuItem key={unit.unit_id || unit.id} value={unit.unit_id}>
                        {unit.unit_name || unit.unit_id}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              )}

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

              <FormControl
                variant="outlined"
                sx={filterFormControlSx}
              >
                <InputLabel id="active-filter-label">Status</InputLabel>
                <Select
                  labelId="active-filter-label"
                  id="active-filter"
                  value={filterActive}
                  label="Status"
                  onChange={(e) => setFilterActive(e.target.value)}
                >
                  <MenuItem value="all">All</MenuItem>
                  <MenuItem value="active">Active</MenuItem>
                  <MenuItem value="inactive">Inactive</MenuItem>
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
              {bulkAssignmentMode && hasSelectedActiveRacm && (
                <Alert severity="warning" sx={{ mb: 2 }}>
                  Active RACM assignment cannot be changed. Remove the selected active RACM(s) before bulk assignment.
                </Alert>
              )}
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
                      width: '10%',
                      minWidth: '128px',
                      maxWidth: '150px',
                    }}
                  >
                    Business Process
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
                      width: '10%',
                      minWidth: '128px',
                      maxWidth: '150px',
                    }}
                  >
                    Unit
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
                      width: '23%',
                      minWidth: '250px',
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
                      width: '15%',
                      minWidth: '180px',
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
                        width: '8%',
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
                        width: '8%',
                        minWidth: '90px',
                        maxWidth: '110px',
                      }}
                    >
                      Active
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
                      Process Owner
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
                      Process Owner Name
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
                            width: '10%',
                            minWidth: '128px',
                            maxWidth: '150px',
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
                          title={getFormUnitName(form)}
                          sx={dataCellSx({
                            px: 2,
                            py: 2,
                            width: '10%',
                            minWidth: '128px',
                            maxWidth: '150px',
                            fontSize: '0.875rem',
                            color: theme.palette.text.primary,
                          })}
                        >
                          <Tooltip
                            title={getFormUnitName(form)}
                            arrow
                            slotProps={{ tooltip: { sx: tooltipSx } }}
                          >
                            <Box component="span" sx={dataCellTextSx}>
                              {getFormUnitName(form)}
                            </Box>
                          </Tooltip>
                        </Box>
                        <Box
                          component="td"
                          title={form.standard_control_description || 'N/A'}
                          sx={dataCellSx({
                            px: 3,
                            py: 2,
                            width: '23%',
                            minWidth: '250px',
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
                            width: '15%',
                            minWidth: '180px',
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
                            width: '8%',
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
                          sx={dataCellSx({
                            px: 2,
                            py: 2,
                            width: '8%',
                            minWidth: '90px',
                            maxWidth: '110px',
                            fontSize: '0.875rem',
                            color: theme.palette.text.primary,
                          })}
                        >
                          <Tooltip
                            title={isFormActive(form) ? 'Active' : 'Inactive'}
                            arrow
                            slotProps={{ tooltip: { sx: tooltipSx } }}
                          >
                            <Box component="span" sx={dataCellTextSx}>
                              {isFormActive(form) ? 'Active' : 'Inactive'}
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
                {isFormActive(selectedForm) && (
                  <Alert severity="warning">
                    This RACM is Active. Active RACM assignment cannot be changed.
                  </Alert>
                )}
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
                  <Typography variant="body2" component="span" sx={popupLabelSx}>Unit:</Typography>
                  <Typography variant="body2" component="span">{popupValue(getFormUnitName(selectedForm))}</Typography>
                </Box>
                <Box sx={popupRowSx}>
                  <Typography variant="body2" component="span" sx={popupLabelSx}>Current Process Owner Name:</Typography>
                  <Typography variant="body2" component="span">{popupValue(selectedForm.control_owner_name)}</Typography>
                </Box>
                <Box sx={{ ...popupRowSx, mb: 2 }}>
                  <Typography variant="body2" component="span" sx={popupLabelSx}>Current Process Owner Email:</Typography>
                  <Typography variant="body2" component="span">{popupValue(selectedForm.control_owner)}</Typography>
                </Box>

                <Autocomplete
                  options={
                    selectedUnitUserOptions.filter((user) => {
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
                  disabled={isFormActive(selectedForm)}
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
                  {selectedUser?.email_id || `Users from ${getFormUnitName(selectedForm)} only`}
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
                disabled={updatingAssignment || isFormActive(selectedForm)}
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
              {hasSelectedActiveRacm && (
                <Alert severity="warning">
                  Active RACM assignment cannot be changed. Remove the active RACM(s) from this selection to continue.
                </Alert>
              )}
              <Box sx={popupRowSx}>
                <Typography variant="body2" component="span" sx={popupLabelSx}>Total selected RACMs:</Typography>
                <Typography variant="body2" component="span">{popupValue(selectedForms.size)}</Typography>
              </Box>
              <Box sx={popupRowSx}>
                <Typography variant="body2" component="span" sx={popupLabelSx}>Unit:</Typography>
                <Typography variant="body2" component="span">{popupValue(selectedBulkUnitName)}</Typography>
              </Box>
              <Typography variant="body2" sx={{ mb: 2, color: 'text.secondary' }}>
                The selected user will overwrite the current Process Owner for all selected RACMs.
              </Typography>

              <Autocomplete
                options={bulkUnitUserOptions}
                loading={usersLoading}
                value={bulkSelectedUser}
                inputValue={bulkUserSearchText}
                onInputChange={(_, newInputValue) => setBulkUserSearchText(newInputValue)}
                onChange={(_, newValue) => setBulkSelectedUser(newValue)}
                disabled={hasSelectedActiveRacm}
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
                {bulkSelectedUser?.email_id || (selectedBulkUnitName ? `Users from ${selectedBulkUnitName} only` : ' ')}
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
                disabled={updatingAssignment || hasSelectedActiveRacm}
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
