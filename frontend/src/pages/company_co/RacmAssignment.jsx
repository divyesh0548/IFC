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
import DialogContentText from '@mui/material/DialogContentText'
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
import { useAuth } from '../../contexts/AuthContext'
import { apiUrl, API_BASE_URL } from '../../config/api'
import { isCoordinatorAssignedRacm, getRacmReassignmentBlockMessage, hasValidProcessOwnerAssignment } from '../../racmFormDetailFields'
import { useBusinessProcesses } from '../../hooks/useBusinessProcesses'
import ApproverAssignmentHelpDialog from '../../components/approver/ApproverAssignmentHelpDialog'

function isApproverBulkAssignableRacm(form) {
  return !getRacmReassignmentBlockMessage(form)
}

function isApproverAssignmentStatusLocked(form) {
  return Boolean(getRacmReassignmentBlockMessage(form))
}

function hasReminderSettingsConfigured(form) {
  const hasDueDate = Boolean(String(form?.due_date || '').trim())
  const hasReminderFrequency = Boolean(String(form?.reminder_frequency || '').trim())
  return hasDueDate && hasReminderFrequency
}

function canCoordinatorSelfAssignRacm(form) {
  if (!form) return false
  if (isCoordinatorAssignedRacm(form)) return false
  if (hasValidProcessOwnerAssignment(form)) return false
  if (!hasReminderSettingsConfigured(form)) return false
  const status = String(form?.status || '').trim().toLowerCase()
  if (status === 'sent for approval' || status === 'approved') return false
  return true
}

function getCoordinatorSelfAssignBlockMessage(form) {
  if (!form) return 'RACM is not available for self-assignment.'
  if (isCoordinatorAssignedRacm(form)) {
    return 'This RACM is already coordinator-assigned.'
  }
  if (hasValidProcessOwnerAssignment(form)) {
    return 'This RACM is already assigned to a process owner.'
  }
  if (!hasReminderSettingsConfigured(form)) {
    return 'Configure due date and reminder frequency before self-assignment.'
  }
  const status = String(form?.status || '').trim().toLowerCase()
  if (status === 'sent for approval' || status === 'approved') {
    return 'This RACM cannot be self-assigned in its current approval status.'
  }
  return ''
}

function hasRacmSpecificApprover(form) {
  return Boolean(String(form?.racm_specific_approver_email_id || '').trim())
}

function RacmAssignment() {
  const UNIT_MISMATCH_TOAST_ID = 'racm-assignment-unit-mismatch'
  const ACTIVE_RACM_SELECTION_TOAST_ID = 'racm-assignment-active-selection'
  const theme = useTheme()
  const { companyIdentifier } = useAuth()
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
  const [dismissedAssignmentAlerts, setDismissedAssignmentAlerts] = useState({})
  const [confirmDialog, setConfirmDialog] = useState({
    open: false,
    kind: null,
    title: '',
    description: '',
    confirmLabel: 'Confirm',
  })
  const pendingSelfAssignEligibleRef = useRef([])
  const pendingReplaceApproverRef = useRef(null)
  const bulkAssignmentContainerRef = useRef(null)
  const { businessProcessOptions } = useBusinessProcesses()
  useSyncGlobalLoading(loading || updatingAssignment)
  const getFormUnitId = (form) => String(form?.unit_id || '').trim()
  const isFormActive = (form) => Boolean(form?.active)
  // A RACM can be (re-)assigned to a process owner in bulk unless it is
  // coordinator self-assigned or locked by its approval lifecycle.
  const isBulkAssignableProcessOwnerForm = (form) => (
    !isCoordinatorAssignedRacm(form) && !getRacmReassignmentBlockMessage(form)
  )
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
  const hasSelectedLockedRacm = selectedFormRows.some((form) => !isBulkAssignableProcessOwnerForm(form))
  const hasMultipleCoordinatorUnits = coordinatorUnits.length > 1
  const isApproverMode = assignmentTarget === 'approver'
  const assignmentSubjectLabel = isApproverMode ? 'Approver' : 'Process Owner'
  const assignmentPageTitle = isApproverMode ? 'Approver Assignment' : 'RACM Assignment'
  const assignmentPageDescription = isApproverMode
    ? 'Assign RACM-specific approvers and manage existing approver overrides.'
    : 'Assign RACM to Process Owners and manage existing RACM assignments.'
  const isProcessOwnerAssignmentLocked = (form) => (
    isCoordinatorAssignedRacm(form) || Boolean(getRacmReassignmentBlockMessage(form))
  )
  const isCurrentAssignmentLocked = (form) => (
    isApproverMode ? isApproverAssignmentStatusLocked(form) : isProcessOwnerAssignmentLocked(form)
  )
  const openRacmInNewPage = (form) => {
    const normalizedFormId = String(form?.form_id || '').trim()
    if (!normalizedFormId) return
    window.open(`/company_co/form/${encodeURIComponent(normalizedFormId)}`, '_blank', 'noopener,noreferrer')
  }
  const showLockedRacmSelectionToast = () => {
    toast.error('This RACM cannot be re-assigned (sent for approval, approved, or no-further-submission declared).', {
      id: ACTIVE_RACM_SELECTION_TOAST_ID,
    })
  }
  const tableForms = useMemo(() => forms, [forms])
  const selectableTableForms = useMemo(() => {
    if (!bulkAssignmentMode) {
      return tableForms
    }
    if (isApproverMode) {
      return tableForms.filter((form) => isApproverBulkAssignableRacm(form))
    }
    return tableForms.filter((form) => isBulkAssignableProcessOwnerForm(form))
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
    setDismissedAssignmentAlerts({})
    setAssignmentDialogOpen(true)
  }

  const handleCloseAssignmentDialog = () => {
    if (updatingAssignment) return
    setAssignmentDialogOpen(false)
    setSelectedForm(null)
    setSelectedUser(null)
    setDismissedAssignmentAlerts({})
  }

  const dismissAssignmentAlert = (alertKey) => {
    setDismissedAssignmentAlerts((prev) => ({ ...prev, [alertKey]: true }))
  }

  const assignmentDialogAlertSx = {
    alignItems: 'center',
    '& .MuiAlert-icon': {
      py: 0,
      mr: 1,
      opacity: 1,
    },
    '& .MuiAlert-message': {
      py: 0,
      display: 'flex',
      alignItems: 'center',
      lineHeight: 1.45,
    },
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

    const isTargetSelectable = isApproverMode
      ? isApproverBulkAssignableRacm(targetForm)
      : isBulkAssignableProcessOwnerForm(targetForm)
    if (!isTargetSelectable) {
      showLockedRacmSelectionToast()
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
        if (existingUnitId && targetUnitId && existingUnitId !== targetUnitId) {
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

    const hasIneligibleForm = isApproverMode
      ? tableForms.some((form) => !isApproverBulkAssignableRacm(form))
      : tableForms.some((form) => !isBulkAssignableProcessOwnerForm(form))
    if (hasIneligibleForm) {
      showLockedRacmSelectionToast()
    }

    if (selectableTableForms.length === 0) {
      return
    }

    const unitIds = [...new Set(selectableTableForms.map((form) => getFormUnitId(form)).filter(Boolean))]
    if (unitIds.length > 1) {
      toast.error('RACMs from different units cannot be selected for bulk assignment', {
        id: UNIT_MISMATCH_TOAST_ID,
      })
      return
    }

    toast.dismiss(UNIT_MISMATCH_TOAST_ID)
    setBulkSelectedUser(null)
    setSelectedForms(new Set(selectableTableForms.map((form) => form.form_id)))
  }

  const closeConfirmDialog = () => {
    if (updatingAssignment) return
    setConfirmDialog({
      open: false,
      kind: null,
      title: '',
      description: '',
      confirmLabel: 'Confirm',
    })
    pendingSelfAssignEligibleRef.current = []
    pendingReplaceApproverRef.current = null
  }

  const openConfirmDialog = ({ kind, title, description, confirmLabel = 'Confirm' }) => {
    setConfirmDialog({
      open: true,
      kind,
      title,
      description,
      confirmLabel,
    })
  }

  const executeUpdateAssignment = async ({ confirmReplaceExisting = false } = {}) => {
    if (!selectedForm?.form_id || !selectedUser?.email_id) return
    if (isApproverMode && isApproverAssignmentStatusLocked(selectedForm)) {
      toast.error(getRacmReassignmentBlockMessage(selectedForm) || 'Approver assignment cannot be changed for this RACM')
      return
    }
    if (!isApproverMode && isProcessOwnerAssignmentLocked(selectedForm)) return

    setUpdatingAssignment(true)
    try {
      if (!isApproverMode && !racmHasSampleDocument(selectedForm)) {
        toast('1 RACM does not have Sample documents, Proceeding to Set Active.')
      }

      const performRequest = async (replaceExisting = false) => {
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
              confirm_replace_existing: replaceExisting,
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

      let response = await performRequest(confirmReplaceExisting)
      let data = await response.json()

      if (response.status === 409 && data?.code === 'RACM_APPROVER_ASSIGNMENT_LOCKED') {
        toast.error(data.message || 'Approver assignment cannot be changed for RACMs that are sent for approval')
        return
      }

      if (response.status === 409 && data?.code === 'CONFIRM_REPLACE_RACM_APPROVER' && !confirmReplaceExisting) {
        const existingAssignments = Array.isArray(data.existingAssignments) ? data.existingAssignments : []
        const affectedList = existingAssignments
          .slice(0, 5)
          .map((item) => item.control_number || item.form_id)
          .filter(Boolean)
          .join(', ')
        pendingReplaceApproverRef.current = { scope: 'single' }
        openConfirmDialog({
          kind: 'replace_approver',
          title: 'Replace Approver Assignment',
          description: `RACM-level approver is already assigned for ${existingAssignments.length} selected RACM${existingAssignments.length === 1 ? '' : 's'}${affectedList ? ` (${affectedList})` : ''}. Replace with ${selectedUser.email_id}?`,
          confirmLabel: 'Replace Approver',
        })
        return
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

  const handleUpdateAssignment = () => {
    if (!selectedForm?.form_id || !selectedUser?.email_id) return
    if (isApproverMode && isApproverAssignmentStatusLocked(selectedForm)) {
      toast.error(getRacmReassignmentBlockMessage(selectedForm) || 'Approver assignment cannot be changed for this RACM')
      return
    }
    if (!isApproverMode && isProcessOwnerAssignmentLocked(selectedForm)) return

    if (isApproverMode) {
      openConfirmDialog({
        kind: 'assign_single',
        title: 'Confirm Approver Assignment',
        description: `Assign ${selectedUser.email_id} as the RACM-specific approver for this RACM?`,
        confirmLabel: 'Assign Approver',
      })
      return
    }

    const currentOwner = String(selectedForm?.control_owner || '').trim()
    const nextOwner = String(selectedUser.email_id || '').trim()
    openConfirmDialog({
      kind: 'assign_single',
      title: 'Confirm Process Owner Assignment',
      description: currentOwner
        ? `Replace the current process owner (${currentOwner}) with ${nextOwner}? The RACM will be set Active, and the new process owner will be notified by email.`
        : `Assign ${nextOwner} as the process owner for this RACM? The RACM will be set Active.`,
      confirmLabel: 'Update Assignment',
    })
  }

  const applySelfAssignLocalState = (formIds) => {
    const idSet = new Set(formIds.map((id) => String(id || '').trim()).filter(Boolean))
    setForms((prev) =>
      prev.map((form) =>
        idSet.has(String(form.form_id || '').trim())
          ? {
              ...form,
              assigned_to_coordinator: true,
              control_owner: null,
              control_owner_name: null,
              active: true,
              has_valid_process_owner_assignment: false,
              is_racm_assigned: true,
            }
          : form
      )
    )
  }

  const selfAssignSingleForm = async (form) => {
    const response = await fetch(`${API_BASE_URL}/api/control-forms/${form.form_id}/self-assign`, {
      method: 'POST',
      credentials: 'include',
    })
    const data = await response.json()
    return { response, data, form }
  }

  const executeSelfAssignSingle = async () => {
    if (isApproverMode || !selectedForm?.form_id) return

    setUpdatingAssignment(true)
    try {
      const { response, data } = await selfAssignSingleForm(selectedForm)
      if (response.ok && data.success) {
        applySelfAssignLocalState([selectedForm.form_id])
        handleCloseAssignmentDialog()
        toast.success(data.message || 'RACM self-assigned successfully')
        fetchForms()
      } else {
        toast.error(data.message || 'Failed to self-assign RACM')
      }
    } catch (error) {
      console.error('Error self-assigning RACM:', error)
      toast.error('Failed to self-assign RACM')
    } finally {
      setUpdatingAssignment(false)
    }
  }

  const handleSelfAssignSingle = () => {
    if (isApproverMode || !selectedForm?.form_id) return

    const blockMessage = getCoordinatorSelfAssignBlockMessage(selectedForm)
    if (blockMessage) {
      toast.error(blockMessage)
      return
    }

    openConfirmDialog({
      kind: 'self_assign_single',
      title: 'Self Assign RACM',
      description: 'Assign this RACM to yourself for document upload and submission. Process owner assignment will be disabled after self-assignment, and the RACM will be set Active.',
      confirmLabel: 'Self Assign',
    })
  }

  const executeSelfAssignBulk = async () => {
    if (isApproverMode) return
    const eligible = pendingSelfAssignEligibleRef.current
    if (!Array.isArray(eligible) || eligible.length === 0) return

    setUpdatingAssignment(true)
    try {
      let successCount = 0
      const failedMessages = []

      for (const form of eligible) {
        try {
          const { response, data } = await selfAssignSingleForm(form)
          if (response.ok && data.success) {
            successCount += 1
          } else {
            failedMessages.push(
              `${form.control_number || form.form_id}: ${data.message || 'Failed'}`
            )
          }
        } catch (error) {
          failedMessages.push(`${form.control_number || form.form_id}: request failed`)
        }
      }

      if (successCount > 0) {
        applySelfAssignLocalState(eligible.map((form) => form.form_id))
        setSelectedForms(new Set())
        setBulkAssignmentDialogOpen(false)
        setBulkSelectedUser(null)
        toast.success(`Self-assigned ${successCount} RACM${successCount === 1 ? '' : 's'} successfully`)
        fetchForms()
      }

      if (failedMessages.length > 0) {
        toast.error(
          failedMessages.length === 1
            ? failedMessages[0]
            : `${failedMessages.length} RACM(s) could not be self-assigned`
        )
      }
    } catch (error) {
      console.error('Error bulk self-assigning RACMs:', error)
      toast.error('Failed to self-assign selected RACMs')
    } finally {
      setUpdatingAssignment(false)
      pendingSelfAssignEligibleRef.current = []
    }
  }

  const handleSelfAssignBulk = () => {
    if (isApproverMode || selectedForms.size === 0) return

    const selectedRows = selectedFormRows
    const withValidOwnerCount = selectedRows.filter((form) => hasValidProcessOwnerAssignment(form)).length
    const eligible = selectedRows.filter((form) => canCoordinatorSelfAssignRacm(form))

    if (eligible.length === 0) {
      if (withValidOwnerCount > 0) {
        toast.error(
          `${withValidOwnerCount} selected RACM${withValidOwnerCount === 1 ? '' : 's'} already ${withValidOwnerCount === 1 ? 'has' : 'have'} a valid process owner and cannot be self-assigned.`
        )
        return
      }
      const firstBlocked = selectedRows.find((form) => getCoordinatorSelfAssignBlockMessage(form))
      toast.error(
        getCoordinatorSelfAssignBlockMessage(firstBlocked)
        || 'None of the selected RACMs can be self-assigned.'
      )
      return
    }

    const skipped = selectedRows.length - eligible.length
    pendingSelfAssignEligibleRef.current = eligible
    openConfirmDialog({
      kind: 'self_assign_bulk',
      title: 'Self Assign Selected RACMs',
      description: skipped > 0
        ? `Self-assign ${eligible.length} of ${selectedRows.length} selected RACM(s)? ${skipped} will be skipped (already assigned, locked, or missing reminder settings). Eligible RACMs will be set Active.`
        : `Self-assign ${eligible.length} selected RACM(s) to yourself? They will be set to active.`,
      confirmLabel: 'Self Assign',
    })
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
    setDismissedAssignmentAlerts({})
    setBulkAssignmentDialogOpen(true)
  }

  const handleCloseBulkAssignmentDialog = () => {
    if (updatingAssignment) return
    setBulkAssignmentDialogOpen(false)
    setBulkSelectedUser(null)
    setDismissedAssignmentAlerts({})
  }

  const executeBulkUpdateAssignment = async ({ confirmReplaceExisting = false } = {}) => {
    if (!bulkSelectedUser?.email_id || selectedForms.size === 0) return
    if (isApproverMode && hasSelectedApproverLockedRacm) {
      toast.error('Remove RACMs with status Sent for Approval before updating approver assignment')
      return
    }
    if (!isApproverMode && hasSelectedLockedRacm) return

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
        const performRequest = async (replaceExisting = false) =>
          fetch(`${API_BASE_URL}/api/company-co/racm-approver-assignments`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            credentials: 'include',
            body: JSON.stringify({
              approver_email_id: bulkSelectedUser.email_id,
              form_ids: targetFormIds,
              confirm_replace_existing: replaceExisting,
            }),
          })

        let response = await performRequest(confirmReplaceExisting)
        let data = await response.json()

        if (response.status === 409 && data?.code === 'RACM_APPROVER_ASSIGNMENT_LOCKED') {
          toast.error(data.message || 'Approver assignment cannot be changed for RACMs that are sent for approval')
          return
        }

        if (response.status === 409 && data?.code === 'CONFIRM_REPLACE_RACM_APPROVER' && !confirmReplaceExisting) {
          const existingAssignments = Array.isArray(data.existingAssignments) ? data.existingAssignments : []
          const affectedList = existingAssignments
            .slice(0, 8)
            .map((item) => item.control_number || item.form_id)
            .filter(Boolean)
            .join(', ')
          pendingReplaceApproverRef.current = { scope: 'bulk' }
          openConfirmDialog({
            kind: 'replace_approver',
            title: 'Replace Approver Assignment',
            description: `RACM-level approver is already assigned for ${existingAssignments.length} selected RACM${existingAssignments.length === 1 ? '' : 's'}${affectedList ? ` (${affectedList})` : ''}. Replace with ${bulkSelectedUser.email_id}?`,
            confirmLabel: 'Replace Approver',
          })
          return
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

  const handleBulkUpdateAssignment = () => {
    if (!bulkSelectedUser?.email_id || selectedForms.size === 0) return
    if (isApproverMode && hasSelectedApproverLockedRacm) {
      toast.error('Remove RACMs with status Sent for Approval before updating approver assignment')
      return
    }
    if (!isApproverMode && hasSelectedLockedRacm) return

    if (isApproverMode) {
      openConfirmDialog({
        kind: 'assign_bulk',
        title: 'Confirm Approver Assignment',
        description: `Assign ${bulkSelectedUser.email_id} as the RACM-specific approver for ${selectedForms.size} selected RACM${selectedForms.size === 1 ? '' : 's'}?`,
        confirmLabel: 'Update Assignments',
      })
      return
    }

    openConfirmDialog({
      kind: 'assign_bulk',
      title: 'Confirm Process Owner Assignment',
      description: `Assign ${bulkSelectedUser.email_id} as the process owner for ${selectedForms.size} selected RACM${selectedForms.size === 1 ? '' : 's'}? Current process owners will be replaced, RACMs will be set Active, and the new process owner will be notified by email.`,
      confirmLabel: 'Update Assignments',
    })
  }

  const handleConfirmDialogConfirm = async () => {
    const kind = confirmDialog.kind
    setConfirmDialog((prev) => ({
      ...prev,
      open: false,
      kind: null,
    }))

    if (kind === 'self_assign_single') {
      await executeSelfAssignSingle()
      return
    }
    if (kind === 'self_assign_bulk') {
      await executeSelfAssignBulk()
      return
    }
    if (kind === 'assign_single') {
      await executeUpdateAssignment()
      return
    }
    if (kind === 'assign_bulk') {
      await executeBulkUpdateAssignment()
      return
    }
    if (kind === 'replace_approver') {
      const scope = pendingReplaceApproverRef.current?.scope
      pendingReplaceApproverRef.current = null
      if (scope === 'bulk') {
        await executeBulkUpdateAssignment({ confirmReplaceExisting: true })
      } else {
        await executeUpdateAssignment({ confirmReplaceExisting: true })
      }
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
            No forms found.
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
            {bulkAssignmentMode && !isApproverMode && hasSelectedLockedRacm && !loading && forms.length > 0 && (
              <Alert severity="warning" sx={{ mb: 2 }}>
                One or more selected RACMs cannot be re-assigned (sent for approval, approved, or no-further-submission declared). Remove them before bulk assignment.
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
                {isApproverMode && isApproverAssignmentStatusLocked(selectedForm) && !dismissedAssignmentAlerts.approverStatusLocked && (
                  <Alert
                    severity="warning"
                    onClose={() => dismissAssignmentAlert('approverStatusLocked')}
                    sx={assignmentDialogAlertSx}
                  >
                    This RACM is sent for approval. Approver assignment cannot be changed.
                  </Alert>
                )}
                {!isApproverMode && isProcessOwnerAssignmentLocked(selectedForm) && !dismissedAssignmentAlerts.processOwnerLocked && (
                  <Alert
                    severity="warning"
                    onClose={() => dismissAssignmentAlert('processOwnerLocked')}
                    sx={assignmentDialogAlertSx}
                  >
                    {isCoordinatorAssignedRacm(selectedForm)
                      ? 'This RACM is coordinator self-assigned and cannot be assigned to a process owner.'
                      : (getRacmReassignmentBlockMessage(selectedForm) || 'This RACM cannot be re-assigned.')}
                  </Alert>
                )}
                {!isApproverMode && !isProcessOwnerAssignmentLocked(selectedForm) && Boolean(String(selectedForm?.control_owner || '').trim()) && !dismissedAssignmentAlerts.processOwnerReplace && (
                  <Alert
                    severity="warning"
                    onClose={() => dismissAssignmentAlert('processOwnerReplace')}
                    sx={assignmentDialogAlertSx}
                  >
                    The current process owner will be replaced and will no longer be able to access this RACM. The new process owner will be notified by email.
                  </Alert>
                )}
                {isApproverMode && singleRacmHasSpecificApprover && !dismissedAssignmentAlerts.approverReplace && (
                  <Alert
                    severity="warning"
                    onClose={() => dismissAssignmentAlert('approverReplace')}
                    sx={assignmentDialogAlertSx}
                  >
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
          <DialogActions sx={{ px: 3, py: 2, gap: 1, flexWrap: 'wrap' }}>
            <Button onClick={handleCloseAssignmentDialog} disabled={updatingAssignment}>
              Cancel
            </Button>
            {!isApproverMode && (
              <Button
                variant="outlined"
                color="primary"
                onClick={handleSelfAssignSingle}
                disabled={
                  updatingAssignment
                  || !canCoordinatorSelfAssignRacm(selectedForm)
                }
              >
                {updatingAssignment ? 'Updating...' : 'Self Assign'}
              </Button>
            )}
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
              {!isApproverMode && hasSelectedLockedRacm && !dismissedAssignmentAlerts.bulkProcessOwnerLocked && (
                <Alert
                  severity="warning"
                  onClose={() => dismissAssignmentAlert('bulkProcessOwnerLocked')}
                  sx={assignmentDialogAlertSx}
                >
                  One or more selected RACMs cannot be re-assigned (sent for approval, approved, or no-further-submission declared). Remove them from this selection to continue.
                </Alert>
              )}
              {isApproverMode && hasSelectedApproverLockedRacm && !dismissedAssignmentAlerts.bulkApproverLocked && (
                <Alert
                  severity="warning"
                  onClose={() => dismissAssignmentAlert('bulkApproverLocked')}
                  sx={assignmentDialogAlertSx}
                >
                  Remove RACMs with status Sent for Approval before updating approver assignment.
                </Alert>
              )}
              {isApproverMode && selectedRacmsWithSpecificApprover.length > 0 && !dismissedAssignmentAlerts.bulkApproverReplace && (
                <Alert
                  severity="warning"
                  onClose={() => dismissAssignmentAlert('bulkApproverReplace')}
                  sx={assignmentDialogAlertSx}
                >
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
                  The selected user will replace the current Process Owner for all selected RACMs. Replaced process owners will no longer be able to access those RACMs, and the new process owner will be notified by email.
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
                  disabled={hasSelectedLockedRacm}
                  helperText={selectedBulkUnitName ? `Users from ${selectedBulkUnitName} only` : ''}
                />
              )}
            </Box>
          </DialogContent>
          <DialogActions sx={{ px: 3, py: 2, gap: 1, flexWrap: 'wrap' }}>
            <Button onClick={handleCloseBulkAssignmentDialog} disabled={updatingAssignment}>
              Cancel
            </Button>
            {!isApproverMode && (
              <Button
                variant="outlined"
                color="primary"
                onClick={handleSelfAssignBulk}
                disabled={
                  updatingAssignment
                  || selectedForms.size === 0
                  || hasSelectedLockedRacm
                  || selectedFormRows.every((form) => !canCoordinatorSelfAssignRacm(form))
                }
              >
                {updatingAssignment ? 'Updating...' : 'Self Assign'}
              </Button>
            )}
            {bulkSelectedUser?.email_id && (
              <Button
                variant="contained"
                color="secondary"
                onClick={handleBulkUpdateAssignment}
                disabled={updatingAssignment || (!isApproverMode && hasSelectedLockedRacm) || (isApproverMode && hasSelectedApproverLockedRacm)}
              >
                {updatingAssignment ? 'Updating...' : 'Update Assignments'}
              </Button>
            )}
          </DialogActions>
        </Dialog>

      <Dialog
        open={confirmDialog.open}
        onClose={closeConfirmDialog}
        aria-labelledby="assignment-confirm-dialog-title"
        aria-describedby="assignment-confirm-dialog-description"
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
          id="assignment-confirm-dialog-title"
          sx={{ py: 2, px: 2.5, fontWeight: 600, fontSize: '1.25rem' }}
        >
          {confirmDialog.title || 'Confirm'}
        </DialogTitle>
        <DialogContent sx={{ px: 3, pt: 1, pb: 3 }}>
          <DialogContentText
            id="assignment-confirm-dialog-description"
            sx={{ color: 'text.secondary', fontSize: '0.9375rem', lineHeight: 1.5, mt: 2 }}
          >
            {confirmDialog.description}
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3, gap: 1.5, borderTop: '1px solid', borderColor: 'divider' }}>
          <Button onClick={closeConfirmDialog} disabled={updatingAssignment} variant="outlined">
            Cancel
          </Button>
          <Button
            onClick={handleConfirmDialogConfirm}
            disabled={updatingAssignment}
            variant="contained"
            color="primary"
          >
            {updatingAssignment ? 'Working...' : (confirmDialog.confirmLabel || 'Confirm')}
          </Button>
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
