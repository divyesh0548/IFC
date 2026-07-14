import React, { useState, useEffect, useRef, useMemo } from 'react'
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
import IconButton from '@mui/material/IconButton'
import LightbulbOutlinedIcon from '@mui/icons-material/LightbulbOutlined'
import ArrowOutwardIcon from '@mui/icons-material/ArrowOutward'
import Switch from '@mui/material/Switch'
import FormControlLabel from '@mui/material/FormControlLabel'
import Alert from '@mui/material/Alert'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Checkbox from '@mui/material/Checkbox'
import { toast } from 'react-hot-toast'
import {
  DASHBOARD_PAGE_OUTER_SX,
  DASHBOARD_PAPER_SX,
  DASHBOARD_TABLE_WRAP_SX,
  FILTER_DROPDOWN_MIN_WIDTH_LG,
  PAGE_SUBHEADER_TEXT_SX,
  TABLE_HEADER_BG,
  TABLE_ROW_HOVER_BG,
  getApprovalStatusBadgeSolidColors,
  getApprovalStatusBadgePillSx,
  formatRacmApprovalStatusLabel,
} from '../../uiConstants'
import UnitUserSearchAutocomplete from '../../components/company_co/UnitUserSearchAutocomplete'
import CompanyUserSearchAutocomplete from '../../components/company_co/CompanyUserSearchAutocomplete'
import { useSyncGlobalLoading } from '../../contexts/GlobalLoadingContext'
import { apiUrl, API_BASE_URL } from '../../config/api'
import { isCoordinatorAssignedRacm } from '../../racmFormDetailFields'
import { useBusinessProcesses } from '../../hooks/useBusinessProcesses'
import ApproverAssignmentHelpDialog from '../../components/approver/ApproverAssignmentHelpDialog'

function normalizeRacmApprovalStatus(status) {
  const normalized = String(status ?? '').trim().toLowerCase()
  if (!normalized || normalized === 'null') return 'pending'
  return normalized
}

function isApproverBulkAssignableRacm(form) {
  const status = normalizeRacmApprovalStatus(form?.status)
  return status !== 'sent for approval'
}

function isApproverAssignmentStatusLocked(form) {
  const status = normalizeRacmApprovalStatus(form?.status)
  return status === 'sent for approval'
}

function hasRacmSpecificApprover(form) {
  return Boolean(String(form?.racm_specific_approver_email_id || '').trim())
}

function RacmAssignment() {
  const UNIT_MISMATCH_TOAST_ID = 'racm-assignment-unit-mismatch'
  const ACTIVE_RACM_SELECTION_TOAST_ID = 'racm-assignment-active-selection'
  const theme = useTheme()
  const [companyIdentifier, setCompanyIdentifier] = useState(null)
  const [forms, setForms] = useState([])
  const [assignmentTarget, setAssignmentTarget] = useState('process_owner')
  const [filterAssignment, setFilterAssignment] = useState('all') // 'all' | 'assigned' | 'unassigned'
  const [filterBusinessProcess, setFilterBusinessProcess] = useState('all') // 'all' or specific business process
  const [filterFinancialYear, setFilterFinancialYear] = useState('all') // 'all' or specific financial year
  const [filterUnit, setFilterUnit] = useState('all') // 'all' or specific unit_id
  const [filterActive, setFilterActive] = useState('all') // 'all' | 'active' | 'inactive'
  const [filterApprovalStatus, setFilterApprovalStatus] = useState('all') // 'all' | 'Pending' | 'Sent for Approval' | 'Approved' | 'Rejected'
  const [financialYearOptions, setFinancialYearOptions] = useState([])
  const [coordinatorUnits, setCoordinatorUnits] = useState([])
  const [cellWordWrap, setCellWordWrap] = useState(false)
  const [assignmentHelpOpen, setAssignmentHelpOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [assignmentDialogOpen, setAssignmentDialogOpen] = useState(false)
  const [bulkAssignmentMode, setBulkAssignmentMode] = useState(false)
  const [bulkAssignmentDialogOpen, setBulkAssignmentDialogOpen] = useState(false)
  const [selectedForm, setSelectedForm] = useState(null)
  const [selectedUser, setSelectedUser] = useState(null)
  const [bulkSelectedUser, setBulkSelectedUser] = useState(null)
  const [updatingAssignment, setUpdatingAssignment] = useState(false)
  const [selectedForms, setSelectedForms] = useState(new Set())
  const bulkAssignmentContainerRef = useRef(null)
  const { businessProcessOptions } = useBusinessProcesses()
  useSyncGlobalLoading(loading || updatingAssignment)
  const getFormUnitId = (form) => String(form?.unit_id || '').trim()
  const isFormActive = (form) => Boolean(form?.active)
  const getFormUnitName = (form) => {
    const unitName = String(form?.unit_name || '').trim()
    if (unitName) return unitName
    const unitId = getFormUnitId(form)
    const mappedUnit = coordinatorUnits.find((unit) => String(unit.unit_id || '').trim() === unitId)
    return mappedUnit?.unit_name || unitId || 'N/A'
  }
  const selectedFormRows = forms.filter((form) => selectedForms.has(form.form_id))
  const selectedBulkUnitId = selectedFormRows.length > 0 ? getFormUnitId(selectedFormRows[0]) : ''
  const selectedBulkUnitName = selectedFormRows.length > 0 ? getFormUnitName(selectedFormRows[0]) : ''
  const hasSelectedActiveRacm = selectedFormRows.some((form) => isFormActive(form))
  const hasMultipleCoordinatorUnits = coordinatorUnits.length > 1
  const isApproverMode = assignmentTarget === 'approver'
  const assignmentSubjectLabel = isApproverMode ? 'Approver' : 'Process Owner'
  const assignmentPageTitle = isApproverMode ? 'Approver Assignment' : 'RACM Assignment'
  const assignmentPageDescription = isApproverMode
    ? 'Assign RACM-specific approvers and manage existing approver overrides.'
    : 'Assign RACM to Process Owners and manage existing RACM assignments.'
  const isProcessOwnerAssignmentLocked = (form) => (
    isFormActive(form) || isCoordinatorAssignedRacm(form)
  )
  const isCurrentAssignmentLocked = (form) => (
    isApproverMode ? isApproverAssignmentStatusLocked(form) : isProcessOwnerAssignmentLocked(form)
  )
  const openRacmInNewPage = (form) => {
    const normalizedFormId = String(form?.form_id || '').trim()
    if (!normalizedFormId) return
    window.open(`/company_co/form/${encodeURIComponent(normalizedFormId)}`, '_blank', 'noopener,noreferrer')
  }
  const showActiveRacmSelectionToast = () => {
    toast.error('Active RACMs cannot be selected for bulk assignment', {
      id: ACTIVE_RACM_SELECTION_TOAST_ID,
    })
  }
  const tableForms = useMemo(() => {
    if (isApproverMode && bulkAssignmentMode) {
      return forms.filter(isApproverBulkAssignableRacm)
    }
    return forms
  }, [forms, isApproverMode, bulkAssignmentMode])
  const selectableTableForms = useMemo(() => {
    if (!bulkAssignmentMode || isApproverMode) {
      return tableForms
    }
    return tableForms.filter((form) => !isFormActive(form))
  }, [bulkAssignmentMode, isApproverMode, tableForms])
  const selectedSelectableFormCount = useMemo(
    () => selectableTableForms.filter((form) => selectedForms.has(form.form_id)).length,
    [selectableTableForms, selectedForms]
  )
  const getCurrentAssigneeEmail = (form) => {
    if (isApproverMode) {
      return String(form?.approver_email_id || '').trim() || 'N/A'
    }
    if (isCoordinatorAssignedRacm(form)) {
      return 'Coordinator (Self)'
    }
    return String(form?.control_owner || '').trim() || 'N/A'
  }
  const getCurrentAssigneeName = (form) => {
    if (isApproverMode) {
      return String(form?.approver_display_name || form?.approver_name || '').trim() || '-'
    }
    if (isCoordinatorAssignedRacm(form)) {
      return 'Coordinator (Self)'
    }
    return String(form?.control_owner_name || '').trim() || '-'
  }
  const selectedApprovalLockedForms = selectedFormRows.filter((form) => isApproverAssignmentStatusLocked(form))
  const hasSelectedApproverLockedRacm = selectedApprovalLockedForms.length > 0
  const selectedRacmsWithSpecificApprover = useMemo(
    () => (isApproverMode ? selectedFormRows.filter(hasRacmSpecificApprover) : []),
    [isApproverMode, selectedFormRows]
  )
  const singleRacmHasSpecificApprover = Boolean(
    isApproverMode && selectedForm && hasRacmSpecificApprover(selectedForm)
  )

  const getFinancialYearStorageKey = (companyId) => `ifc_financial_year_options_${companyId}`

  const extractUniqueFinancialYears = (rows) => {
    return [...new Set(
      (rows || [])
        .map(form => form.financial_year?.toString().trim())
        .filter(year => year && year !== '')
    )]
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
      const response = await fetch(apiUrl('/api/company-co/assigned-units'), {
        method: 'GET',
        credentials: 'include',
      })
      const data = await response.json()

      if (response.ok && data.success) {
        const units = Array.isArray(data.units)
          ? data.units
          : Array.isArray(data.data?.currentCoordinatorUnits)
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
  }, [companyIdentifier, filterAssignment, filterBusinessProcess, filterFinancialYear, filterUnit, filterActive, filterApprovalStatus, isApproverMode])

  useEffect(() => {
    if (!bulkAssignmentMode) {
      setSelectedForms(new Set())
    }
  }, [bulkAssignmentMode])

  useEffect(() => {
    if (bulkAssignmentMode) {
      setSelectedForms(new Set())
    }
  }, [bulkAssignmentMode, filterAssignment, filterBusinessProcess, filterFinancialYear, filterUnit, filterApprovalStatus, assignmentTarget])

  useEffect(() => {
    setSelectedUser(null)
    setBulkSelectedUser(null)
    setSelectedForm(null)
    setAssignmentDialogOpen(false)
    setBulkAssignmentDialogOpen(false)
    setSelectedForms(new Set())
    setBulkAssignmentMode(false)
  }, [assignmentTarget])

  const cancelBulkAssignmentMode = () => {
    setBulkAssignmentMode(false)
    setSelectedForms(new Set())
    setBulkAssignmentDialogOpen(false)
    setBulkSelectedUser(null)
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

      if (filterUnit !== 'all') {
        url += `&unit_id=${encodeURIComponent(filterUnit)}`
      }

      if (filterActive !== 'all') {
        url += `&active=${encodeURIComponent(filterActive === 'active' ? 'true' : 'false')}`
      }

      if (filterApprovalStatus !== 'all') {
        const statusParam = filterApprovalStatus === 'Pending'
          ? 'pending'
          : filterApprovalStatus === 'Sent for Approval'
            ? 'sent for approval'
            : filterApprovalStatus.toLowerCase()
        url += `&status=${encodeURIComponent(statusParam)}`
      }

      if (filterAssignment !== 'all') {
        url += `&assignment=${encodeURIComponent(filterAssignment)}`
      }
      if (isApproverMode) {
        url += '&assignment_target=approver'
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

      } else {
        console.error('Error fetching forms:', data.message)
      }
    } catch (error) {
      console.error('Error fetching forms:', error)
    } finally {
      setLoading(false)
    }
  }

  const filterFormControlSx = {
    flex: { xs: '1 1 100%', sm: '1 1 0' },
    minWidth: { xs: '100%', sm: 110 },
    maxWidth: { xs: '100%', sm: FILTER_DROPDOWN_MIN_WIDTH_LG },
    width: { xs: '100%', sm: 'auto' },
    '& .MuiOutlinedInput-root': {
      width: '100%',
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
    '& .MuiSelect-select': {
      overflow: 'hidden',
      textOverflow: 'ellipsis',
    },
  }

  const handleFormClick = (form) => {
    if (bulkAssignmentMode) {
      handleSelectForm(form.form_id)
      return
    }

    setSelectedForm(form)
    setSelectedUser(null)
    setAssignmentDialogOpen(true)
  }

  const handleCloseAssignmentDialog = () => {
    if (updatingAssignment) return
    setAssignmentDialogOpen(false)
    setSelectedForm(null)
    setSelectedUser(null)
  }

  const handleBulkAssignmentModeToggle = () => {
    if (bulkAssignmentMode) {
      cancelBulkAssignmentMode()
      return
    }
    setBulkAssignmentMode(true)
    setBulkAssignmentDialogOpen(false)
    setBulkSelectedUser(null)
  }

  const handleSelectForm = (formId) => {
    const targetForm = forms.find((form) => form.form_id === formId)
    if (!targetForm) return

    if (!isApproverMode && isFormActive(targetForm)) {
      showActiveRacmSelectionToast()
      return
    }

    const targetUnitId = getFormUnitId(targetForm)

    setSelectedForms((prev) => {
      const next = new Set(prev)
      if (next.has(formId)) {
        next.delete(formId)
        toast.dismiss(UNIT_MISMATCH_TOAST_ID)
        toast.dismiss(ACTIVE_RACM_SELECTION_TOAST_ID)
        setBulkSelectedUser(null)
      } else {
        const existingForm = forms.find((form) => next.has(form.form_id))
        const existingUnitId = getFormUnitId(existingForm)
        if (!isApproverMode && existingUnitId && targetUnitId && existingUnitId !== targetUnitId) {
          toast.error('RACMs from different units cannot be selected for bulk assignment', {
            id: UNIT_MISMATCH_TOAST_ID,
          })
          return prev
        }
        next.add(formId)
        toast.dismiss(UNIT_MISMATCH_TOAST_ID)
        toast.dismiss(ACTIVE_RACM_SELECTION_TOAST_ID)
        setBulkSelectedUser(null)
      }
      return next
    })
  }

  const handleSelectAllForms = () => {
    const allSelectableSelected = selectableTableForms.length > 0 && selectableTableForms.every((form) => selectedForms.has(form.form_id))
    if (allSelectableSelected) {
      setSelectedForms(new Set())
      toast.dismiss(UNIT_MISMATCH_TOAST_ID)
      toast.dismiss(ACTIVE_RACM_SELECTION_TOAST_ID)
      setBulkSelectedUser(null)
      return
    }

    if (!isApproverMode && tableForms.some((form) => isFormActive(form))) {
      showActiveRacmSelectionToast()
    }

    if (selectableTableForms.length === 0) {
      return
    }

    const unitIds = [...new Set(selectableTableForms.map((form) => getFormUnitId(form)).filter(Boolean))]
    if (!isApproverMode && unitIds.length > 1) {
      toast.error('RACMs from different units cannot be selected for bulk assignment', {
        id: UNIT_MISMATCH_TOAST_ID,
      })
      return
    }

    toast.dismiss(UNIT_MISMATCH_TOAST_ID)
    setBulkSelectedUser(null)
    setSelectedForms(new Set(selectableTableForms.map((form) => form.form_id)))
  }

  const handleUpdateAssignment = async () => {
    if (!selectedForm?.form_id || !selectedUser?.email_id) return
    if (isApproverMode && isApproverAssignmentStatusLocked(selectedForm)) {
      toast.error('Approver assignment cannot be changed while RACM is sent for approval')
      return
    }
    if (!isApproverMode && isProcessOwnerAssignmentLocked(selectedForm)) return

    setUpdatingAssignment(true)
    try {
      if (!isApproverMode && !racmHasSampleDocument(selectedForm)) {
        toast('1 RACM does not have Sample documents, Proceeding to Set Active.')
      }

      const performRequest = async (confirmReplaceExisting = false) => {
        if (isApproverMode) {
          return fetch(`${API_BASE_URL}/api/company-co/racm-approver-assignments`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            credentials: 'include',
            body: JSON.stringify({
              approver_email_id: selectedUser.email_id,
              form_ids: [selectedForm.form_id],
              confirm_replace_existing: confirmReplaceExisting,
            }),
          })
        }

        return fetch(`${API_BASE_URL}/api/control-forms/${selectedForm.form_id}`, {
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
      }

      let response = await performRequest(false)
      let data = await response.json()

      if (response.status === 409 && data?.code === 'RACM_APPROVER_ASSIGNMENT_LOCKED') {
        toast.error(data.message || 'Approver assignment cannot be changed for RACMs that are sent for approval')
        return
      }

      if (response.status === 409 && data?.code === 'CONFIRM_REPLACE_RACM_APPROVER') {
        const existingAssignments = Array.isArray(data.existingAssignments) ? data.existingAssignments : []
        const affectedList = existingAssignments
          .slice(0, 5)
          .map((item) => item.control_number || item.form_id)
          .filter(Boolean)
          .join(', ')
        const shouldReplace = window.confirm(
          `RACM-level approver is already assigned for ${existingAssignments.length} selected RACM${existingAssignments.length === 1 ? '' : 's'}${affectedList ? ` (${affectedList})` : ''}. Replace with ${selectedUser.email_id}?`
        )
        if (!shouldReplace) {
          return
        }
        response = await performRequest(true)
        data = await response.json()
        if (response.status === 409 && data?.code === 'RACM_APPROVER_ASSIGNMENT_LOCKED') {
          toast.error(data.message || 'Approver assignment cannot be changed for RACMs that are sent for approval')
          return
        }
      }

      if (response.ok && data.success) {
        setForms((prev) =>
          prev.map((form) =>
            form.form_id === selectedForm.form_id
              ? {
                  ...form,
                  ...(isApproverMode
                    ? {
                        approver_email_id: selectedUser.email_id,
                        approver_name: selectedUser.emp_name || form.approver_name || null,
                        approver_display_name: selectedUser.emp_name || selectedUser.email_id,
                      }
                    : {
                        control_owner: selectedUser.email_id,
                        control_owner_name: selectedUser.emp_name || form.control_owner_name || null,
                      }),
                }
              : form
          )
        )
        handleCloseAssignmentDialog()
        toast.success(`Successfully updated ${isApproverMode ? 'approver' : 'RACM'} assignment`)
        fetchForms()
      } else {
        toast.error(data.message || `Failed to update ${isApproverMode ? 'approver' : 'RACM'} assignment`)
      }
    } catch (error) {
      console.error('Error updating assignment:', error)
      toast.error(`Failed to update ${isApproverMode ? 'approver' : 'RACM'} assignment`)
    } finally {
      setUpdatingAssignment(false)
    }
  }

  const handleOpenBulkAssignmentDialog = () => {
    if (selectedForms.size === 0) {
      toast.error('Select at least one RACM')
      return
    }

    const unitIds = [...new Set(selectedFormRows.map((form) => getFormUnitId(form)).filter(Boolean))]
    if (!isApproverMode && unitIds.length > 1) {
      toast.error('RACMs from different units cannot be selected for bulk assignment')
      return
    }

    setBulkSelectedUser(null)
    setBulkAssignmentDialogOpen(true)
  }

  const handleCloseBulkAssignmentDialog = () => {
    if (updatingAssignment) return
    setBulkAssignmentDialogOpen(false)
    setBulkSelectedUser(null)
  }

  const handleBulkUpdateAssignment = async () => {
    if (!bulkSelectedUser?.email_id || selectedForms.size === 0) return
    if (isApproverMode && hasSelectedApproverLockedRacm) {
      toast.error('Remove RACMs with status Sent for Approval before updating approver assignment')
      return
    }
    if (!isApproverMode && hasSelectedActiveRacm) return

    setUpdatingAssignment(true)
    try {
      const targetFormIds = Array.from(selectedForms)
      const missingSampleDocCount = !isApproverMode ? targetFormIds.filter((formId) => {
        const form = forms.find((item) => item.form_id === formId)
        return !racmHasSampleDocument(form)
      }).length : 0
      let successCount = 0
      let failCount = 0

      if (missingSampleDocCount > 0) {
        toast(`${missingSampleDocCount} RACM(s) do not have Sample documents, Proceeding to Set Active.`)
      }

      if (isApproverMode) {
        const performRequest = async (confirmReplaceExisting = false) =>
          fetch(`${API_BASE_URL}/api/company-co/racm-approver-assignments`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            credentials: 'include',
            body: JSON.stringify({
              approver_email_id: bulkSelectedUser.email_id,
              form_ids: targetFormIds,
              confirm_replace_existing: confirmReplaceExisting,
            }),
          })

        let response = await performRequest(false)
        let data = await response.json()

        if (response.status === 409 && data?.code === 'RACM_APPROVER_ASSIGNMENT_LOCKED') {
          toast.error(data.message || 'Approver assignment cannot be changed for RACMs that are sent for approval')
          return
        }

        if (response.status === 409 && data?.code === 'CONFIRM_REPLACE_RACM_APPROVER') {
          const existingAssignments = Array.isArray(data.existingAssignments) ? data.existingAssignments : []
          const affectedList = existingAssignments
            .slice(0, 8)
            .map((item) => item.control_number || item.form_id)
            .filter(Boolean)
            .join(', ')
          const shouldReplace = window.confirm(
            `RACM-level approver is already assigned for ${existingAssignments.length} selected RACM${existingAssignments.length === 1 ? '' : 's'}${affectedList ? ` (${affectedList})` : ''}. Replace with ${bulkSelectedUser.email_id}?`
          )
          if (!shouldReplace) {
            return
          }
          response = await performRequest(true)
          data = await response.json()
          if (response.status === 409 && data?.code === 'RACM_APPROVER_ASSIGNMENT_LOCKED') {
            toast.error(data.message || 'Approver assignment cannot be changed for RACMs that are sent for approval')
            return
          }
        }

        if (response.ok && data.success) {
          successCount = targetFormIds.length
          const selectedIds = new Set(targetFormIds)
          setForms((prev) =>
            prev.map((form) =>
              selectedIds.has(form.form_id)
                ? {
                    ...form,
                    approver_email_id: bulkSelectedUser.email_id,
                    approver_name: bulkSelectedUser.emp_name || form.approver_name || null,
                    approver_display_name: bulkSelectedUser.emp_name || bulkSelectedUser.email_id,
                  }
                : form
            )
          )
        } else {
          failCount = targetFormIds.length
        }
      } else {
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
      }

      handleCloseBulkAssignmentDialog()
      setBulkAssignmentMode(false)

      if (successCount > 0) {
        toast.success(`Successfully updated ${successCount} ${isApproverMode ? 'approver' : 'RACM'} assignment(s)`)
      }
      if (failCount > 0) {
        toast.error(`Failed to update ${failCount} ${isApproverMode ? 'approver' : 'RACM'} assignment(s)`)
      }

      if (successCount > 0 && !isApproverMode) {
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
      toast.error(`Failed to update ${isApproverMode ? 'approver' : 'RACM'} assignments`)
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

  const tableColumnCount =
    7 + (hasMultipleCoordinatorUnits ? 1 : 0) + (bulkAssignmentMode ? 1 : 0)
  const showEmptyState = !loading && tableForms.length === 0
  const ASSIGN_TABLE_COL_PX = {
    checkbox: 44,
    controlNumber: 95,
    businessProcess: 130,
    standardControl: 195,
    unit: 100,
    financialYear: 85,
    active: 80,
    status: 95,
    assignment: 130,
  }
  const assignTableColWidthsOrdered = [
    ...(bulkAssignmentMode ? [ASSIGN_TABLE_COL_PX.checkbox] : []),
    ASSIGN_TABLE_COL_PX.controlNumber,
    ASSIGN_TABLE_COL_PX.businessProcess,
    ASSIGN_TABLE_COL_PX.standardControl,
    ...(hasMultipleCoordinatorUnits ? [ASSIGN_TABLE_COL_PX.unit] : []),
    ASSIGN_TABLE_COL_PX.financialYear,
    ASSIGN_TABLE_COL_PX.active,
    ASSIGN_TABLE_COL_PX.status,
    ASSIGN_TABLE_COL_PX.assignment,
  ]
  const assignTableTotalWidthPx = assignTableColWidthsOrdered.reduce((a, b) => a + b, 0)
  const pctColSx = (px) => {
    const pct = (100 * px) / assignTableTotalWidthPx
    const s = `${pct}%`
    return {
      width: s,
      minWidth: s,
      maxWidth: s,
      boxSizing: 'border-box',
    }
  }
  const selectedBulkUnitSummary = selectedFormRows.length === 0
    ? ''
    : isApproverMode
      ? ([...new Set(selectedFormRows.map((form) => getFormUnitName(form)).filter(Boolean))].length > 1
          ? 'Multiple units'
          : selectedBulkUnitName)
      : selectedBulkUnitName

  const renderTableBody = () => {
    if (loading) {
      return (
        <Box component="tr">
          <Box
            component="td"
            colSpan={tableColumnCount}
            sx={{
              px: 2.5,
              py: 6,
              textAlign: 'center',
              color: 'text.secondary',
              fontSize: '0.875rem',
            }}
          >
            Loading RACMs...
          </Box>
        </Box>
      )
    }

    if (showEmptyState) {
      return (
        <Box component="tr">
          <Box
            component="td"
            colSpan={tableColumnCount}
            sx={{
              px: 2.5,
              py: 6,
              textAlign: 'center',
              color: 'text.secondary',
              fontSize: '0.875rem',
            }}
          >
            {isApproverMode && bulkAssignmentMode && forms.length > 0
              ? 'No RACMs available for bulk approver assignment (Sent for Approval RACMs are excluded).'
              : 'No forms found.'}
          </Box>
        </Box>
      )
    }

    return tableForms.map((form) => (
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
              ...pctColSx(ASSIGN_TABLE_COL_PX.checkbox),
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
          sx={dataCellSx({
            px: 2,
            py: 2,
            fontSize: '0.875rem',
            fontWeight: 600,
            color: theme.palette.text.primary,
            ...pctColSx(ASSIGN_TABLE_COL_PX.controlNumber),
          })}
        >
          <Box component="span" sx={dataCellTextSx}>
            {form.control_number || form.form_id || 'N/A'}
          </Box>
        </Box>
        <Box
          component="td"
          title={form.business_process || 'N/A'}
          sx={dataCellSx({
            px: 2,
            py: 2,
            fontSize: '0.875rem',
            color: theme.palette.text.primary,
            ...pctColSx(ASSIGN_TABLE_COL_PX.businessProcess),
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
            fontSize: '0.875rem',
            color: theme.palette.text.primary,
            ...pctColSx(ASSIGN_TABLE_COL_PX.standardControl),
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
        {hasMultipleCoordinatorUnits && (
          <Box
            component="td"
            title={getFormUnitName(form)}
            sx={dataCellSx({
              px: 2,
              py: 2,
              fontSize: '0.875rem',
              color: theme.palette.text.primary,
              ...pctColSx(ASSIGN_TABLE_COL_PX.unit),
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
        )}
        <Box
          component="td"
          sx={dataCellSx({
            px: 2,
            py: 2,
            fontSize: '0.875rem',
            color: theme.palette.text.primary,
            ...pctColSx(ASSIGN_TABLE_COL_PX.financialYear),
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
            fontSize: '0.875rem',
            color: theme.palette.text.primary,
            ...pctColSx(ASSIGN_TABLE_COL_PX.active),
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
          sx={dataCellSx({
            px: 2,
            py: 2,
            fontSize: '0.875rem',
            color: theme.palette.text.primary,
            ...pctColSx(ASSIGN_TABLE_COL_PX.status),
          })}
        >
          <Box
            component="span"
            sx={{
              ...getApprovalStatusBadgePillSx(formatRacmApprovalStatusLabel(form.status)),
              ...getApprovalStatusBadgeSolidColors(formatRacmApprovalStatusLabel(form.status)),
            }}
          >
            {formatRacmApprovalStatusLabel(form.status)}
          </Box>
        </Box>
        <Box
          component="td"
          title={getCurrentAssigneeEmail(form)}
          sx={dataCellSx({
            px: 2,
            py: 2,
            fontSize: '0.875rem',
            color: theme.palette.text.primary,
            ...pctColSx(ASSIGN_TABLE_COL_PX.assignment),
          })}
        >
          <Tooltip
            title={getCurrentAssigneeEmail(form)}
            arrow
            slotProps={{ tooltip: { sx: tooltipSx } }}
          >
            <Box component="span" sx={dataCellTextSx}>
              {getCurrentAssigneeEmail(form)}
            </Box>
          </Tooltip>
        </Box>
      </Box>
    ))
  }

  return (
    <Box sx={DASHBOARD_PAGE_OUTER_SX}>
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
            ...DASHBOARD_PAPER_SX,
            p: 3,
            backgroundColor: theme.palette.background.paper,
            borderRadius: 2,
          }}
        >
          <Box sx={{ 
            display: 'flex', 
            flexDirection: { xs: 'column', lg: 'row' }, 
            justifyContent: 'space-between', 
            alignItems: { xs: 'stretch', lg: 'flex-start' },
            gap: 2,
            mb: 3,
            minWidth: 0,
          }}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, flexShrink: 0 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                <Typography 
                  variant="h5" 
                  component="h2"
                  sx={{ 
                    fontWeight: 700, 
                  }}
                >
                  {assignmentPageTitle}
                </Typography>
                {isApproverMode ? (
                  <Tooltip title="How approver assignment works">
                    <IconButton
                      size="small"
                      onClick={() => setAssignmentHelpOpen(true)}
                      aria-label="How approver assignment works"
                      sx={{ color: 'warning.main' }}
                    >
                      <LightbulbOutlinedIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                ) : null}
              </Box>
              <Typography
                sx={PAGE_SUBHEADER_TEXT_SX}
              >
                {assignmentPageDescription}
              </Typography>
            </Box>
            
            {/* Filter Options */}
            <Box sx={{ 
              display: 'flex', 
              flexDirection: { xs: 'column', sm: 'row' },
              gap: 2,
              alignItems: { xs: 'stretch', sm: 'flex-start' },
              width: '100%',
              flex: { lg: '1 1 0' },
              minWidth: 0,
              flexWrap: { xs: 'wrap', sm: 'nowrap' },
              justifyContent: { sm: 'flex-end' },
            }}>
              <FormControl
                variant="outlined"
                sx={filterFormControlSx}
              >
                <InputLabel id="assignment-target-filter-label">Assignment Type</InputLabel>
                <Select
                  labelId="assignment-target-filter-label"
                  id="assignment-target-filter"
                  value={assignmentTarget}
                  label="Assignment Type"
                  onChange={(e) => setAssignmentTarget(e.target.value)}
                >
                  <MenuItem value="process_owner">Process Owner</MenuItem>
                  <MenuItem value="approver">Approver</MenuItem>
                </Select>
              </FormControl>
              {hasMultipleCoordinatorUnits && (
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
                <InputLabel id="activity-filter-label">Activity</InputLabel>
                <Select
                  labelId="activity-filter-label"
                  id="activity-filter"
                  value={filterActive}
                  label="Activity"
                  onChange={(e) => setFilterActive(e.target.value)}
                >
                  <MenuItem value="all">All</MenuItem>
                  <MenuItem value="active">Active</MenuItem>
                  <MenuItem value="inactive">Inactive</MenuItem>
                </Select>
              </FormControl>

              <FormControl
                variant="outlined"
                sx={filterFormControlSx}
              >
                <InputLabel id="approval-status-filter-label">Status</InputLabel>
                <Select
                  labelId="approval-status-filter-label"
                  id="approval-status-filter"
                  value={filterApprovalStatus}
                  label="Status"
                  onChange={(e) => setFilterApprovalStatus(e.target.value)}
                >
                  <MenuItem value="all">All</MenuItem>
                  <MenuItem value="Pending">Pending</MenuItem>
                  <MenuItem value="Sent for Approval">Sent for Approval</MenuItem>
                  <MenuItem value="Approved">Approved</MenuItem>
                  <MenuItem value="Rejected">Rejected</MenuItem>
                </Select>
              </FormControl>
              
            </Box>
          </Box>

          <Box sx={{ width: '100%', minWidth: 0 }}>
            {bulkAssignmentMode && !isApproverMode && hasSelectedActiveRacm && !loading && forms.length > 0 && (
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
                    disabled={loading}
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
            <Box sx={DASHBOARD_TABLE_WRAP_SX}>
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
                <Box component="colgroup">
                  {assignTableColWidthsOrdered.map((w, i) => (
                    <Box key={i} component="col" sx={pctColSx(w)} />
                  ))}
                </Box>
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
                        ...pctColSx(ASSIGN_TABLE_COL_PX.checkbox),
                      }}
                    >
                      <Checkbox
                        checked={selectableTableForms.length > 0 && selectableTableForms.every((form) => selectedForms.has(form.form_id))}
                        indeterminate={selectedSelectableFormCount > 0 && selectedSelectableFormCount < selectableTableForms.length}
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
                      ...pctColSx(ASSIGN_TABLE_COL_PX.controlNumber),
                    }}
                  >
                    Control Number
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
                      ...pctColSx(ASSIGN_TABLE_COL_PX.businessProcess),
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
                      ...pctColSx(ASSIGN_TABLE_COL_PX.standardControl),
                    }}
                  >
                    Standard Control Description
                  </Box>
                  {hasMultipleCoordinatorUnits && (
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
                        ...pctColSx(ASSIGN_TABLE_COL_PX.unit),
                      }}
                    >
                      Unit
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
                        ...pctColSx(ASSIGN_TABLE_COL_PX.financialYear),
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
                        ...pctColSx(ASSIGN_TABLE_COL_PX.active),
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
                        ...pctColSx(ASSIGN_TABLE_COL_PX.status),
                      }}
                    >
                      Status
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
                        ...pctColSx(ASSIGN_TABLE_COL_PX.assignment),
                      }}
                    >
                      {assignmentSubjectLabel}
                    </Box>
                  </Box>
                </Box>
                <Box component="tbody">{renderTableBody()}</Box>
              </Box>
            </Box>
          </Box>
        </Paper>

        <Dialog
          open={assignmentDialogOpen}
          onClose={handleCloseAssignmentDialog}
          fullWidth
          maxWidth="md"
        >
          <DialogTitle
            sx={{
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 2,
            }}
          >
            <Box component="span">{assignmentPageTitle}</Box>
            {selectedForm?.form_id ? (
              <Button
                variant="outlined"
                size="small"
                color="secondary"
                endIcon={<ArrowOutwardIcon fontSize="small" />}
                onClick={() => openRacmInNewPage(selectedForm)}
              >
                Open RACM
              </Button>
            ) : null}
          </DialogTitle>
          <DialogContent dividers>
            {selectedForm && (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                {isApproverMode && isApproverAssignmentStatusLocked(selectedForm) && (
                  <Alert severity="warning">
                    This RACM is sent for approval. Approver assignment cannot be changed.
                  </Alert>
                )}
                {!isApproverMode && isProcessOwnerAssignmentLocked(selectedForm) && (
                  <Alert severity="warning">
                    This RACM is Active. Active RACM assignment cannot be changed.
                  </Alert>
                )}
                {isApproverMode && singleRacmHasSpecificApprover && (
                  <Alert severity="warning">
                    Current approver will be replaced.
                  </Alert>
                )}
                {isApproverMode ? (
                  <Box sx={popupRowSx}>
                    <Typography variant="body2" component="span" sx={popupLabelSx}>Total RACMs:</Typography>
                    <Typography variant="body2" component="span">1</Typography>
                  </Box>
                ) : null}
                <Box sx={popupRowSx}>
                  <Typography variant="body2" component="span" sx={popupLabelSx}>Business Process:</Typography>
                  <Typography variant="body2" component="span">{popupValue(selectedForm.business_process)}</Typography>
                </Box>
                <Box sx={popupRowSx}>
                  <Typography variant="body2" component="span" sx={popupLabelSx}>Sub Process:</Typography>
                  <Typography variant="body2" component="span">{popupValue(selectedForm.sub_process)}</Typography>
                </Box>
                <Box sx={popupRowSx}>
                  <Typography variant="body2" component="span" sx={popupLabelSx}>Standard Control Description:</Typography>
                  <Typography variant="body2" component="span">{popupValue(selectedForm.standard_control_description)}</Typography>
                </Box>
                <Box sx={popupRowSx}>
                  <Typography variant="body2" component="span" sx={popupLabelSx}>FY:</Typography>
                  <Typography variant="body2" component="span">{popupValue(selectedForm.financial_year)}</Typography>
                </Box>
                <Box sx={popupRowSx}>
                  <Typography variant="body2" component="span" sx={popupLabelSx}>Unit:</Typography>
                  <Typography variant="body2" component="span">{popupValue(getFormUnitName(selectedForm))}</Typography>
                </Box>
                <Box sx={popupRowSx}>
                  <Typography variant="body2" component="span" sx={popupLabelSx}>{`Current ${assignmentSubjectLabel} Name:`}</Typography>
                  <Typography variant="body2" component="span">{popupValue(getCurrentAssigneeName(selectedForm))}</Typography>
                </Box>
                <Box sx={{ ...popupRowSx, mb: 2 }}>
                  <Typography variant="body2" component="span" sx={popupLabelSx}>{`Current ${assignmentSubjectLabel} Email:`}</Typography>
                  <Typography variant="body2" component="span">{popupValue(getCurrentAssigneeEmail(selectedForm))}</Typography>
                </Box>

                {isApproverMode ? (
                  <CompanyUserSearchAutocomplete
                    role="approver"
                    label="Search Approver"
                    value={selectedUser}
                    onChange={setSelectedUser}
                    excludeEmails={[selectedForm?.approver_email_id]}
                    prefetch={assignmentDialogOpen}
                    helperText={selectedUser?.email_id || 'All approvers in this company are available'}
                  />
                ) : (
                  <UnitUserSearchAutocomplete
                    unitId={getFormUnitId(selectedForm)}
                    value={selectedUser}
                    onChange={setSelectedUser}
                    excludeEmails={[selectedForm?.control_owner]}
                    prefetch={assignmentDialogOpen}
                    disabled={isCurrentAssignmentLocked(selectedForm)}
                    helperText={
                      selectedUser?.email_id || `Users from ${getFormUnitName(selectedForm)} only`
                    }
                  />
                )}
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
                disabled={updatingAssignment || isCurrentAssignmentLocked(selectedForm)}
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
            {`Bulk ${assignmentPageTitle}`}
          </DialogTitle>
          <DialogContent dividers>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              {!isApproverMode && hasSelectedActiveRacm && (
                <Alert severity="warning">
                  Active RACM assignment cannot be changed. Remove the active RACM(s) from this selection to continue.
                </Alert>
              )}
              {isApproverMode && hasSelectedApproverLockedRacm && (
                <Alert severity="warning">
                  Remove RACMs with status Sent for Approval before updating approver assignment.
                </Alert>
              )}
              {isApproverMode && selectedRacmsWithSpecificApprover.length > 0 && (
                <Alert severity="warning">
                  Current approver will be replaced for {selectedRacmsWithSpecificApprover.length} of {selectedForms.size} selected RACM{selectedForms.size === 1 ? '' : 's'}.
                </Alert>
              )}
              <Box sx={popupRowSx}>
                <Typography variant="body2" component="span" sx={popupLabelSx}>Total RACMs:</Typography>
                <Typography variant="body2" component="span">{popupValue(selectedForms.size)}</Typography>
              </Box>
              <Box sx={popupRowSx}>
                <Typography variant="body2" component="span" sx={popupLabelSx}>Unit:</Typography>
                <Typography variant="body2" component="span">{popupValue(selectedBulkUnitSummary)}</Typography>
              </Box>
              {!isApproverMode ? (
                <Typography variant="body2" sx={{ mb: 2, color: 'text.secondary' }}>
                  The selected user will overwrite the current Process Owner for all selected RACMs.
                </Typography>
              ) : null}

              {isApproverMode ? (
                <CompanyUserSearchAutocomplete
                  role="approver"
                  label="Search Approver"
                  value={bulkSelectedUser}
                  onChange={setBulkSelectedUser}
                  prefetch={bulkAssignmentDialogOpen}
                  helperText="All approvers in this company are available"
                />
              ) : (
                <UnitUserSearchAutocomplete
                  unitId={selectedBulkUnitId}
                  value={bulkSelectedUser}
                  onChange={setBulkSelectedUser}
                  prefetch={bulkAssignmentDialogOpen}
                  disabled={hasSelectedActiveRacm}
                  helperText={selectedBulkUnitName ? `Users from ${selectedBulkUnitName} only` : ''}
                />
              )}
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
                disabled={updatingAssignment || (!isApproverMode && hasSelectedActiveRacm) || (isApproverMode && hasSelectedApproverLockedRacm)}
              >
                {updatingAssignment ? 'Updating...' : 'Update Assignments'}
              </Button>
            )}
          </DialogActions>
        </Dialog>

      <ApproverAssignmentHelpDialog
        open={assignmentHelpOpen}
        onClose={() => setAssignmentHelpOpen(false)}
        variant="coordinator"
      />
    </Box>
  )
}

export default RacmAssignment
