import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTheme, alpha } from '@mui/material/styles'
import Button from '@mui/material/Button'
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import FormControl from '@mui/material/FormControl'
import FormControlLabel from '@mui/material/FormControlLabel'
import InputLabel from '@mui/material/InputLabel'
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import Tooltip from '@mui/material/Tooltip'
import Checkbox from '@mui/material/Checkbox'
import Switch from '@mui/material/Switch'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogContentText from '@mui/material/DialogContentText'
import DialogActions from '@mui/material/DialogActions'
import TextField from '@mui/material/TextField'
import { toast } from 'react-hot-toast'
import { useSyncGlobalLoading } from '../../contexts/GlobalLoadingContext'
import { apiUrl, API_BASE_URL } from '../../config/api'
import { useBusinessProcesses } from '../../hooks/useBusinessProcesses'
import { 
  PAGE_SUBHEADER_TEXT_SX,
  TABLE_HEADER_BG,
  TABLE_ROW_HOVER_BG,
  STATUS_BADGE_PILL_SX,
  getActivityBadgeSolidColors,
  getApprovalStatusBadgeSolidColors,
} from '../../uiConstants'

/** Display order for Set Active selection notice (single-RACM list); missing-user line last. */
const SET_ACTIVE_SINGLE_NOTICE_LINE_ORDER = [
  'RACM assignment is pending (empty Process Owner).',
  'Process Owner role is not "user".',
  'Due date / reminder frequency is missing.',
  'Process Owner user does not exist. Please create the user first.',
]

function sortSetActiveSingleNoticeLines(lines) {
  const rank = (line) => {
    const i = SET_ACTIVE_SINGLE_NOTICE_LINE_ORDER.indexOf(line)
    return i === -1 ? SET_ACTIVE_SINGLE_NOTICE_LINE_ORDER.length : i
  }
  return [...lines].sort((a, b) => rank(a) - rank(b))
}

function RacmManagementDashboard() {
  const theme = useTheme()
  const navigate = useNavigate()
  const [companyIdentifier, setCompanyIdentifier] = useState(null)
  const [forms, setForms] = useState([])
  const [filterActive, setFilterActive] = useState('all') // 'all', 'active', 'inactive'
  const [filterStatus, setFilterStatus] = useState('all') // 'all', 'Approved', 'Rejected', 'Pending'
  const [filterBusinessProcess, setFilterBusinessProcess] = useState('all') // 'all' or specific business process
  const [filterFinancialYear, setFilterFinancialYear] = useState('all') // 'all' or specific financial year
  const [filterUnit, setFilterUnit] = useState('all') // 'all' or specific assigned unit
  const [filterConclusion, setFilterConclusion] = useState('all')
  const [coordinatorUnits, setCoordinatorUnits] = useState([])
  const [financialYearOptions, setFinancialYearOptions] = useState([])
  const [loading, setLoading] = useState(true)
  const [cellWordWrap, setCellWordWrap] = useState(false)
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
  const [setDueDateMode, setSetDueDateMode] = useState(false)
  const [setDueDateDialogOpen, setSetDueDateDialogOpen] = useState(false)
  const [setDueDateValue, setSetDueDateValue] = useState('')
  const [setDueReminderFrequency, setSetDueReminderFrequency] = useState('')
  const [setDueDateSubmitting, setSetDueDateSubmitting] = useState(false)
  const [alreadyScheduledCount, setAlreadyScheduledCount] = useState(0)
  const [nonUserRoleDialogOpen, setNonUserRoleDialogOpen] = useState(false)
  const [nonUserRoleCount, setNonUserRoleCount] = useState(0)
  const [nonUserRoleEmails, setNonUserRoleEmails] = useState([])
  const [setActiveSelectionInfoDialogOpen, setSetActiveSelectionInfoDialogOpen] = useState(false)
  const [pendingAssignmentCount, setPendingAssignmentCount] = useState(0)
  const [nonUserRoleBlockedCount, setNonUserRoleBlockedCount] = useState(0)
  const [nonUserRoleBlockedEmails, setNonUserRoleBlockedEmails] = useState([])
  const [missingUsersCount, setMissingUsersCount] = useState(0)
  const [missingUserEmailsForDialog, setMissingUserEmailsForDialog] = useState([])
  const [missingReminderCount, setMissingReminderCount] = useState(0)
  const [eligibleSetActiveFormIds, setEligibleSetActiveFormIds] = useState([])
  const [isSingleSetActiveSelectionNotice, setIsSingleSetActiveSelectionNotice] = useState(false)
  const [singleSelectionProblemLines, setSingleSelectionProblemLines] = useState([])
  const [formsToActivateAfterMissingUsersConfirm, setFormsToActivateAfterMissingUsersConfirm] = useState([])
  const [missingRacmCount, setMissingRacmCount] = useState(0)
  const [validatingSetActiveSelection, setValidatingSetActiveSelection] = useState(false)
  const [creatingMissingUsers, setCreatingMissingUsers] = useState(false)
  const [setActiveClassifying, setSetActiveClassifying] = useState(false)
  const userRoleChecksRef = useRef({})
  const { businessProcessOptions } = useBusinessProcesses()

  useSyncGlobalLoading(loading)
  useSyncGlobalLoading(bulkUpdating)
  useSyncGlobalLoading(creatingMissingUsers)
  useSyncGlobalLoading(validatingSetActiveSelection)
  useSyncGlobalLoading(deleting)
  useSyncGlobalLoading(replicating)
  useSyncGlobalLoading(setActiveClassifying)

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
    // Fetch forms when company_identifier is available
    if (companyIdentifier) {
      fetchForms()
    }
  }, [companyIdentifier, filterActive, filterStatus, filterBusinessProcess, filterFinancialYear, filterUnit, filterConclusion])

  useEffect(() => {
    const fetchCoordinatorUnits = async () => {
      if (!companyIdentifier) return

      try {
        const response = await fetch(apiUrl('/api/company-co/unit-management'), {
          method: 'GET',
          credentials: 'include',
        })
        const data = await response.json()

        if (response.ok && data.success) {
          const assignedUnits = Array.isArray(data.data?.currentCoordinatorUnits)
            ? data.data.currentCoordinatorUnits
            : []
          setCoordinatorUnits(assignedUnits)

          setFilterUnit((current) => {
            if (current === 'all') return current
            return assignedUnits.some((unit) => unit.unit_id === current) ? current : 'all'
          })
        } else {
          setCoordinatorUnits([])
        }
      } catch (error) {
        console.error('Error fetching coordinator units:', error)
        setCoordinatorUnits([])
      }
    }

    fetchCoordinatorUnits()
  }, [companyIdentifier])

  useEffect(() => {
    if (companyIdentifier) {
      loadFinancialYearOptions(companyIdentifier)
    }
  }, [companyIdentifier])

  useEffect(() => {
    userRoleChecksRef.current = {}
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
      const url = `${API_BASE_URL}/api/control-forms?company_identifier=${encodeURIComponent(companyId)}`
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
    return status.charAt(0).toUpperCase() + status.slice(1)
  }

  const formatConclusion = (value) => {
    const normalized = String(value || '').trim()
    if (!normalized) return 'None'
    return normalized.charAt(0).toUpperCase() + normalized.slice(1)
  }

  const fetchForms = async () => {
    if (!companyIdentifier) return
    
    setLoading(true)
    try {
      let url = `${API_BASE_URL}/api/control-forms?company_identifier=${encodeURIComponent(companyIdentifier)}`
      
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

      if (filterUnit !== 'all') {
        url += `&unit_id=${encodeURIComponent(filterUnit)}`
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
        if (filterConclusion !== 'all') {
          filteredData = filteredData.filter((form) => formatConclusion(form.control_design_conclusion) === filterConclusion)
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
    if (deleteMode || setActiveMode || replicateMode || setDueDateMode || (e && e.target.type === 'checkbox')) {
      return
    }
    navigate(`/company_co/form/${formId}`)
  }

  const handleSetDueDateModeToggle = () => {
    setSetDueDateMode(true)
    setSelectedForms(new Set())
    if (deleteMode) setDeleteMode(false)
    if (setActiveMode) setSetActiveMode(false)
    if (replicateMode) {
      setReplicateMode(false)
      setReplicateTargetFY('')
    }
  }

  const handleSetDueDateCancel = () => {
    setSetDueDateDialogOpen(false)
    setSetDueDateSubmitting(false)
    setSetDueDateValue('')
    setSetDueReminderFrequency('')
    setAlreadyScheduledCount(0)
  }

  const openSetDueDateDialog = () => {
    const already = (forms || []).filter((f) => {
      if (!selectedForms.has(f.form_id)) return false
      const due = f?.due_date
      const rf = f?.reminder_frequency
      const hasDue = Boolean(due)
      const hasRf = rf !== null && rf !== undefined && String(rf).trim() !== ''
      return hasDue && hasRf
    }).length
    setAlreadyScheduledCount(already)
    setSetDueDateDialogOpen(true)
  }

  const handleSetDueDateSubmit = async () => {
    const due = String(setDueDateValue || '').trim()
    const freq = String(setDueReminderFrequency || '').trim()
    if (!due || !freq) {
      toast.error('Please select both Due Date and Reminder Frequency')
      return
    }

    setSetDueDateSubmitting(true)
    try {
      const response = await fetch(apiUrl('/api/control-forms/bulk-set-due-date'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          form_ids: Array.from(selectedForms),
          due_date: due,
          reminder_frequency: freq,
        }),
      })
      const data = await response.json()
      if (response.ok && data.success) {
        toast.success(data.message || 'Due date updated successfully')
        handleSetDueDateCancel()
        setSetDueDateMode(false)
        setSelectedForms(new Set())
        fetchForms()
      } else {
        toast.error(data.message || 'Failed to set due date')
      }
    } catch (e) {
      console.error('Bulk set due date error:', e)
      toast.error('Failed to set due date')
    } finally {
      setSetDueDateSubmitting(false)
    }
  }

  const handleSetActiveModeToggle = () => {
    // Enter set active mode
    setSetActiveMode(true)
    setSelectedForms(new Set())
    // Exit delete mode if active
    if (deleteMode) {
      setDeleteMode(false)
    }
    if (setDueDateMode) {
      setSetDueDateMode(false)
    }
    if (replicateMode) {
      setReplicateMode(false)
      setReplicateTargetFY('')
    }
  }

  // Handle click outside to cancel selection mode
  const handleClickOutside = (e) => {
    // If any dialog is open, do not cancel selection modes
    if (setActiveConfirmDialogOpen || replicateDialogOpen || deleteConfirmDialogOpen || setDueDateDialogOpen || missingUsersDialogOpen || nonUserRoleDialogOpen) {
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
    if (clickedButton && (clickedButton.textContent?.includes('Set Active') || clickedButton.textContent?.includes('Set Due Date') || clickedButton.textContent?.includes('Delete') || clickedButton.textContent?.includes('Replicate'))) {
      // Let the button's onClick handle it
      return
    }
    
    if (isCheckbox || isDialog) {
      return
    }
    
    // Cancel selection mode
    if (setActiveMode || setDueDateMode || deleteMode || replicateMode) {
      setSetActiveMode(false)
      setSetDueDateMode(false)
      setDeleteMode(false)
      setReplicateMode(false)
      setReplicateTargetFY('')
      setSelectedForms(new Set())
    }
  }


  const checkUserRole = async (email) => {
    if (!email || !email.trim()) return { exists: false, role: null }

    try {
      const response = await fetch(`${API_BASE_URL}/api/company-co/check-user-role/${encodeURIComponent(email.trim())}`, {
        method: 'GET',
        credentials: 'include',
      })

      const data = await response.json()
      if (!response.ok || !data.success) return { exists: false, role: null }
      return { exists: !!data.exists, role: data.role ?? null }
    } catch (error) {
      console.error('Error checking user role:', error)
      return { exists: false, role: null }
    }
  }

  const normalizeEmail = (email) => (email || '').trim().toLowerCase()
  const normalizeRole = (role) => (role || '').toString().trim().toLowerCase()
  const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(email))

  const getUserRoleCheck = async (email) => {
    const normalizedEmail = normalizeEmail(email)
    if (!normalizedEmail) {
      return { exists: false, role: null }
    }

    if (userRoleChecksRef.current[normalizedEmail]) {
      return userRoleChecksRef.current[normalizedEmail]
    }

    const result = await checkUserRole(normalizedEmail)
    userRoleChecksRef.current[normalizedEmail] = result
    return result
  }

  const classifyFormsForSetActive = async (formsToCheck) => {
    const validFormIds = []
    const missingFormIds = []
    const missingEmails = []
    const nonUserRoleForms = []
    const emptyOwnerFormIds = []
    const reminderMissingFormIds = []
    const sampleDocMissingFormIds = []

    for (const form of formsToCheck) {
      const email = normalizeEmail(form.control_owner)

      if (!email) {
        emptyOwnerFormIds.push(form.form_id)
        continue
      }

      const userRoleCheck = await getUserRoleCheck(email)

      if (!userRoleCheck.exists) {
        missingFormIds.push(form.form_id)
        missingEmails.push(email)
        continue
      }

      if (normalizeRole(userRoleCheck.role) !== 'user') {
        nonUserRoleForms.push({
          formId: form.form_id,
          email,
          role: userRoleCheck.role,
        })
        continue
      }

      // Reminder columns are the lowest-precedence gating condition.
      // Only check them after Process Owner exists and is a normal user.
      const dueDate = form?.due_date
      const reminderFrequency = form?.reminder_frequency
      const hasDueDate = Boolean(dueDate)
      const hasReminderFrequency = reminderFrequency !== null && reminderFrequency !== undefined && String(reminderFrequency).trim() !== ''
      if (!hasDueDate || !hasReminderFrequency) {
        reminderMissingFormIds.push(form.form_id)
        continue
      }

      const hasSampleDoc =
        form?.sample_doc !== null &&
        form?.sample_doc !== undefined &&
        String(form.sample_doc).trim() !== ''
      if (!hasSampleDoc) {
        sampleDocMissingFormIds.push(form.form_id)
      }

      validFormIds.push(form.form_id)
    }

    return {
      validFormIds,
      // Only eligible RACMs can be selected for Set Active.
      selectedFormIds: [...validFormIds],
      missingEmails: [...new Set(missingEmails)],
      missingFormIds,
      nonUserRoleForms,
      emptyOwnerFormIds,
      reminderMissingFormIds,
      sampleDocMissingFormIds,
    }
  }

  const showSetActiveSelectionInfoDialog = ({
    emptyOwnerCount = 0,
    nonUserRoleForms = [],
    missingUserEmails = [],
    reminderMissingCount = 0,
    sampleDocMissingCount = 0,
    eligibleFormIds = [],
    isSingle = false,
    singleProblemLines = [],
  }) => {
    const uniqueNonUserEmails = [...new Set((nonUserRoleForms || []).map((item) => item.email).filter(Boolean))]
    const uniqueMissingUserEmails = [...new Set((missingUserEmails || []).filter(Boolean))]

    setPendingAssignmentCount(emptyOwnerCount)
    setNonUserRoleBlockedCount((nonUserRoleForms || []).length)
    setNonUserRoleBlockedEmails(uniqueNonUserEmails)
    setMissingUsersCount(uniqueMissingUserEmails.length)
    setMissingUserEmailsForDialog(uniqueMissingUserEmails)
    // Keep in sync with selection notice so "Create User" works from any path (confirm vs checkbox / select-all).
    setMissingProcessOwners(uniqueMissingUserEmails)
    setMissingReminderCount(reminderMissingCount)
    setEligibleSetActiveFormIds(Array.isArray(eligibleFormIds) ? eligibleFormIds : [])
    setIsSingleSetActiveSelectionNotice(Boolean(isSingle))
    setSingleSelectionProblemLines(Array.isArray(singleProblemLines) ? singleProblemLines : [])
    setSetActiveSelectionInfoDialogOpen(true)
  }

  const handleSetActiveSelectionInfoCancel = () => {
    setSetActiveSelectionInfoDialogOpen(false)
    setPendingAssignmentCount(0)
    setNonUserRoleBlockedCount(0)
    setNonUserRoleBlockedEmails([])
    setMissingUsersCount(0)
    setMissingUserEmailsForDialog([])
    setMissingReminderCount(0)
    setEligibleSetActiveFormIds([])
    setIsSingleSetActiveSelectionNotice(false)
    setSingleSelectionProblemLines([])
    setMissingProcessOwners([])
    setFormsToActivateAfterMissingUsersConfirm([])
    setMissingRacmCount(0)
    setSetActiveMode(false)
    setSelectedForms(new Set())
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

    let classification
    setSetActiveClassifying(true)
    try {
      classification = await classifyFormsForSetActive(selectedFormsData)
    } finally {
      setSetActiveClassifying(false)
    }

    const {
      validFormIds,
      missingEmails,
      missingFormIds,
      nonUserRoleForms,
      emptyOwnerFormIds,
      reminderMissingFormIds,
      sampleDocMissingFormIds,
    } = classification

    const hasAnyIssues =
      (emptyOwnerFormIds?.length || 0) > 0 ||
      (reminderMissingFormIds?.length || 0) > 0 ||
      (nonUserRoleForms?.length || 0) > 0 ||
      (missingFormIds?.length || 0) > 0

    if (hasAnyIssues) {
      // Keep these for existing user-creation handler
      setMissingProcessOwners(missingEmails)
      setMissingRacmCount(missingFormIds.length)
      setFormsToActivateAfterMissingUsersConfirm(validFormIds)

      showSetActiveSelectionInfoDialog({
        emptyOwnerCount: emptyOwnerFormIds?.length || 0,
        reminderMissingCount: reminderMissingFormIds?.length || 0,
        sampleDocMissingCount: sampleDocMissingFormIds?.length || 0,
        nonUserRoleForms: nonUserRoleForms || [],
        missingUserEmails: missingEmails || [],
        eligibleFormIds: validFormIds || [],
        isSingle: false,
      })
      return
    }

    if (validFormIds.length === 0) {
      toast.error('No eligible RACMs to set Active (control_owner role must be "user")')
      return
    }

    if ((sampleDocMissingFormIds?.length || 0) > 0) {
      toast(`${sampleDocMissingFormIds.length} RACM(s) missing sample document. Proceeding to set Active.`)
    }

    await performSetActive(validFormIds)
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
          const response = await fetch(`${API_BASE_URL}/api/control-forms/${formId}`, {
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
      setNonUserRoleCount(0)
      setNonUserRoleEmails([])
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

  const handleCreateMissingUsers = async () => {
    const emailsToCreate = missingProcessOwners.length > 0
      ? missingProcessOwners
      : missingUserEmailsForDialog
    if (!emailsToCreate.length) {
      toast.error('No missing Process Owner email IDs found')
      return
    }

    const validEmails = emailsToCreate.filter((email) => isValidEmail(email))
    const invalidEmails = emailsToCreate.filter((email) => !isValidEmail(email))

    if (invalidEmails.length > 0) {
      const invalidPreview = invalidEmails.slice(0, 3).join(', ')
      const extraCount = invalidEmails.length - Math.min(invalidEmails.length, 3)
      const suffix = extraCount > 0 ? ` and ${extraCount} more` : ''
      toast.error(`Invalid email ID(s) selected for user creation: ${invalidPreview}${suffix}`)
      return
    }

    if (validEmails.length === 0) {
      toast.error('No valid email IDs found for user creation')
      return
    }

    setCreatingMissingUsers(true)
    try {
      const response = await fetch(apiUrl('/api/company-co/create-users-bulk'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          email_ids: validEmails,
        }),
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        toast.error(data.message || 'Failed to create missing users')
        return
      }

      userRoleChecksRef.current = {}

      const createdCount = Array.isArray(data.createdUsers) ? data.createdUsers.length : 0
      const skippedCount = Array.isArray(data.skippedEmails) ? data.skippedEmails.length : 0
      if (createdCount > 0) {
        toast.success(`Created ${createdCount} user(s) successfully`)
      }
      if (skippedCount > 0) {
        toast.error(`${skippedCount} email ID(s) were skipped because users already exist`)
      }

      handleSetActiveSelectionInfoCancel()
      setMissingUsersDialogOpen(false)
      fetchForms()
    } catch (error) {
      console.error('Error creating missing users:', error)
      toast.error('Error creating missing users')
    } finally {
      setCreatingMissingUsers(false)
    }
  }

  const handleNonUserRoleCancel = () => {
    setNonUserRoleDialogOpen(false)
    setNonUserRoleCount(0)
    setNonUserRoleEmails([])
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
    if (setDueDateMode) {
      setSetDueDateMode(false)
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
    if (setDueDateMode) setSetDueDateMode(false)
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
      toast.error('Select RACMs of same Financial Year')
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
      toast.error('Select RACMs of same Financial Year')
      return
    }

    if (!replicateTargetFY || replicateTargetFY.trim() === '') {
      toast.error('Please select a Financial Year')
      return
    }

    setReplicating(true)
    try {
      const response = await fetch(apiUrl('/api/control-forms/replicate'), {
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

  const handleSelectForm = async (formId) => {
    const newSelected = new Set(selectedForms)
    if (newSelected.has(formId)) {
      newSelected.delete(formId)
      setSelectedForms(newSelected)
      return
    }

    if (!setActiveMode) {
      newSelected.add(formId)
      setSelectedForms(newSelected)
      return
    }

    const form = forms.find((item) => item.form_id === formId)
    if (!form) return
    const email = normalizeEmail(form.control_owner)
    const dueDate = form?.due_date
    const reminderFrequency = form?.reminder_frequency
    const hasDueDate = Boolean(dueDate)
    const hasReminderFrequency = reminderFrequency !== null && reminderFrequency !== undefined && String(reminderFrequency).trim() !== ''

    // For single RACM selection, show ALL applicable problems (in precedence order),
    // but still block selection if any problem exists.
    const problemLines = []
    if (!email) {
      problemLines.push('RACM assignment is pending (empty Process Owner).')
    }

    let userRoleCheck = null
    if (email) {
      userRoleCheck = await getUserRoleCheck(email)
      if (userRoleCheck.exists && normalizeRole(userRoleCheck.role) !== 'user') {
        problemLines.push('Process Owner role is not "user".')
      } else if (!userRoleCheck.exists) {
        problemLines.push('Process Owner user does not exist. Please create the user first.')
      }
    }

    if (!hasDueDate || !hasReminderFrequency) {
      problemLines.push('Due date / reminder frequency is missing.')
    }

    if (problemLines.length > 0) {
      showSetActiveSelectionInfoDialog({
        emptyOwnerCount: email ? 0 : 1,
        nonUserRoleForms:
          userRoleCheck?.exists && normalizeRole(userRoleCheck.role) !== 'user'
            ? [{ formId, email, role: userRoleCheck.role }]
            : [],
        missingUserEmails: email && userRoleCheck && !userRoleCheck.exists ? [email] : [],
        reminderMissingCount: (!hasDueDate || !hasReminderFrequency) ? 1 : 0,
        eligibleFormIds: [],
        isSingle: true,
        singleProblemLines: problemLines,
      })
      return
    }

    setValidatingSetActiveSelection(true)
    try {
      const { selectedFormIds, nonUserRoleForms, missingEmails, validFormIds } = await classifyFormsForSetActive([form])
      if (nonUserRoleForms.length > 0) {
        showSetActiveSelectionInfoDialog({
          emptyOwnerCount: 0,
          reminderMissingCount: 0,
          nonUserRoleForms,
          missingUserEmails: [],
          eligibleFormIds: [],
          isSingle: true,
          singleProblemLines: ['Process Owner role is not "user".'],
        })
        return
      }

      if (missingEmails.length > 0) {
        showSetActiveSelectionInfoDialog({
          emptyOwnerCount: 0,
          reminderMissingCount: 0,
          nonUserRoleForms: [],
          missingUserEmails: missingEmails,
          eligibleFormIds: validFormIds,
          isSingle: true,
          singleProblemLines: ['Process Owner user does not exist. Please create the user first.'],
        })
        return
      }

      if (selectedFormIds.includes(formId)) {
        const hasSampleDoc = form?.sample_doc !== null && form?.sample_doc !== undefined && String(form.sample_doc).trim() !== ''
        if (!hasSampleDoc) {
          toast('Sample document is missing. RACM can still be set Active.')
        }
        newSelected.add(formId)
        setSelectedForms(newSelected)
      }
    } finally {
      setValidatingSetActiveSelection(false)
    }
  }

  const handleSelectAll = async () => {
    const targetForms = setActiveMode
      ? forms.filter((form) => !isBlockedForSetActiveSelection(form))
      : forms
    const areAllTargetFormsSelected = targetForms.length > 0 &&
      targetForms.every((form) => selectedForms.has(form.form_id))

    if (areAllTargetFormsSelected) {
      // Deselect all
      setSelectedForms(new Set())
      return
    }

    if (!setActiveMode) {
      const allFormIds = new Set(forms.map(form => form.form_id))
      setSelectedForms(allFormIds)
      return
    }

    setValidatingSetActiveSelection(true)
    try {
      const { selectedFormIds, nonUserRoleForms, emptyOwnerFormIds, missingEmails, reminderMissingFormIds, sampleDocMissingFormIds, validFormIds } = await classifyFormsForSetActive(forms)
      setSelectedForms(new Set(selectedFormIds))

      if ((sampleDocMissingFormIds?.length || 0) > 0) {
        toast(`${sampleDocMissingFormIds.length} RACM(s) missing sample document. They can still be set Active.`)
      }

      if (
        (emptyOwnerFormIds?.length || 0) > 0 ||
        (nonUserRoleForms?.length || 0) > 0 ||
        (missingEmails?.length || 0) > 0 ||
        (reminderMissingFormIds?.length || 0) > 0
      ) {
        showSetActiveSelectionInfoDialog({
          emptyOwnerCount: emptyOwnerFormIds?.length || 0,
          reminderMissingCount: reminderMissingFormIds?.length || 0,
          sampleDocMissingCount: sampleDocMissingFormIds?.length || 0,
          nonUserRoleForms: nonUserRoleForms || [],
          missingUserEmails: missingEmails || [],
          eligibleFormIds: validFormIds || [],
        })
      }
    } finally {
      setValidatingSetActiveSelection(false)
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
      let deletedS3ObjectCount = 0
      let deletedSampleDocRows = 0
      let deletedUserDocRows = 0

      // Delete each form sequentially
      for (const formId of formIds) {
        try {
          const response = await fetch(`${API_BASE_URL}/api/control-forms/${formId}`, {
            method: 'DELETE',
            credentials: 'include',
          })

          const data = await response.json()

          if (response.ok && data.success) {
            successCount++
            deletedS3ObjectCount += Number(data.deleted_documents?.s3_objects || 0)
            deletedSampleDocRows += Number(data.deleted_documents?.sample_doc_rows || 0)
            deletedUserDocRows += Number(data.deleted_documents?.user_uploaded_rows || 0)
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
        const documentCount = deletedS3ObjectCount + deletedSampleDocRows + deletedUserDocRows
        const documentMessage = documentCount > 0
          ? ` Removed ${deletedS3ObjectCount} S3 document(s), ${deletedSampleDocRows} sample document row(s), and ${deletedUserDocRows} user-uploaded document row(s).`
          : ''
        toast.success(`Successfully deleted ${successCount} RACM(s).${documentMessage}`)
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
  const isBlockedForSetActiveSelection = (form) => {
    if (!setActiveMode) return false

    const email = normalizeEmail(form.control_owner)
    if (!email) return true

    const dueDate = form?.due_date
    const reminderFrequency = form?.reminder_frequency
    const hasDueDate = Boolean(dueDate)
    const hasReminderFrequency = reminderFrequency !== null && reminderFrequency !== undefined && String(reminderFrequency).trim() !== ''
    if (!hasDueDate || !hasReminderFrequency) return true

    const cachedCheck = userRoleChecksRef.current[email]
    return !!(cachedCheck?.exists && normalizeRole(cachedCheck.role) !== 'user')
  }

  const emptyProcessOwnerCount = setActiveMode
    ? forms.filter((form) => !normalizeEmail(form.control_owner)).length
    : 0
  const selectableVisibleForms = (deleteMode || replicateMode || setDueDateMode)
    ? forms
    : forms.filter((form) => !isBlockedForSetActiveSelection(form))
  const allVisibleSelectableSelected = selectableVisibleForms.length > 0 &&
    selectableVisibleForms.every((form) => selectedForms.has(form.form_id))
  const someVisibleSelectableSelected = selectableVisibleForms.some((form) => selectedForms.has(form.form_id))

  // Handle Activity filter change (independent of Status filter)
  const handleActivityChange = (value) => {
    setFilterActive(value)
  }

  const conclusionOptions = [...new Set(
    (forms || []).map((form) => formatConclusion(form.control_design_conclusion))
  )].sort((a, b) => {
    if (a === 'None') return 1
    if (b === 'None') return -1
    return a.localeCompare(b)
  })

  const actionRequiredCount = (forms || []).filter((form) =>
    Boolean(form?.deficiency_action_status)
  ).length

  const showUnitColumn = coordinatorUnits.length > 1
  const showUnitFilter = coordinatorUnits.length > 1

  // Add click outside handler
  useEffect(() => {
    if (setActiveMode || setDueDateMode || deleteMode || replicateMode) {
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
    setDueDateMode,
    deleteMode,
    replicateMode,
    setActiveConfirmDialogOpen,
    replicateDialogOpen,
    deleteConfirmDialogOpen,
    setDueDateDialogOpen,
    missingUsersDialogOpen,
    nonUserRoleDialogOpen,
    setActiveSelectionInfoDialogOpen,
  ])

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
  return (
    <Box sx={{ maxWidth: '100%', mx: 'auto', px: 0, py: 4 }}>
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'flex-end',
          alignItems: 'center',
          flexWrap: 'wrap',
          mb: 2,
          gap: 1.25,
        }}
      >
        <Button
          onClick={() => navigate('/company_co/communication-matrix')}
          disabled={!companyIdentifier || deleteMode || setActiveMode || setDueDateMode || replicateMode}
          variant="outlined"
          color="secondary"
          size="small"
          sx={{
            ...toolbarBtnBase,
            '&:hover': { boxShadow: 'none' },
          }}
        >
          Communication
        </Button>

        <Button
          onClick={() => navigate('/company_co/create-form')}
          disabled={deleteMode || setActiveMode || setDueDateMode || replicateMode}
          variant="contained"
          color="secondary"
          size="small"
          sx={{
            ...toolbarBtnBase,
            '&:hover': { boxShadow: 'none' },
            '&:disabled': {
              bgcolor: alpha(theme.palette.action.disabledBackground, 0.5),
            },
          }}
        >
          Create RACM Manually
        </Button>

        <Button
          onClick={(e) => {
            e.stopPropagation()
            if (setActiveMode) {
              if (selectedForms.size > 0) {
                handleSetActiveClick()
              }
            } else {
              handleSetActiveModeToggle()
            }
          }}
          disabled={
            loading ||
            forms.length === 0 ||
            allFormsActive ||
            setDueDateMode ||
            deleteMode ||
            replicateMode ||
            bulkUpdating ||
            (setActiveMode && selectedForms.size === 0)
          }
          variant="contained"
          color="secondary"
          size="small"
          sx={{
            display: 'none',
            ...toolbarBtnBase,
            '&:hover': { boxShadow: 'none' },
          }}
        >
          {setActiveMode
            ? (selectedForms.size > 0 ? `Set Active (${selectedForms.size})` : 'Set Active')
            : 'Set Active'}
        </Button>

        <Button
          onClick={(e) => {
            e.stopPropagation()
            if (setDueDateMode) {
              if (selectedForms.size > 0) {
                openSetDueDateDialog()
              }
            } else {
              handleSetDueDateModeToggle()
            }
          }}
          disabled={
            loading ||
            forms.length === 0 ||
            setActiveMode ||
            deleteMode ||
            replicateMode ||
            setDueDateSubmitting ||
            (setDueDateMode && selectedForms.size === 0)
          }
          variant="contained"
          color="secondary"
          size="small"
          sx={{
            ...toolbarBtnBase,
            '&:hover': { boxShadow: 'none' },
          }}
        >
          {setDueDateMode
            ? (selectedForms.size > 0 ? `Set Due Date (${selectedForms.size})` : 'Set Due Date')
            : 'Set Due Date'}
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
            setDueDateMode ||
            deleteMode ||
            replicating ||
            (replicateMode && selectedForms.size === 0)
          }
          variant="contained"
          color="secondary"
          size="small"
          sx={{
            ...toolbarBtnBase,
            '&:hover': { boxShadow: 'none' },
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
              if (selectedForms.size > 0) {
                handleDeleteClick()
              }
            } else {
              handleDeleteModeToggle()
            }
          }}
          disabled={
            loading ||
            forms.length === 0 ||
            setActiveMode ||
            setDueDateMode ||
            replicateMode ||
            deleting ||
            (deleteMode && selectedForms.size === 0)
          }
          variant={deleteMode ? 'contained' : 'outlined'}
          color="error"
          size="small"
          sx={{
            ...toolbarBtnBase,
            ...(deleteMode
              ? { '&:hover': { boxShadow: 'none' } }
              : {
                  bgcolor: alpha(theme.palette.error.main, theme.palette.mode === 'dark' ? 0.16 : 0.1),
                  borderColor: alpha(theme.palette.error.main, 0.45),
                  '&:hover': {
                    boxShadow: 'none',
                    bgcolor: alpha(theme.palette.error.main, theme.palette.mode === 'dark' ? 0.24 : 0.16),
                    borderColor: theme.palette.error.main,
                  },
                }),
          }}
        >
          {deleteMode
            ? (selectedForms.size > 0 ? `Delete (${selectedForms.size})` : 'Delete')
            : 'Delete'}
        </Button>
      </Box>

      {actionRequiredCount > 0 ? (
        <Box
          sx={{
            mb: 2,
            px: 2,
            py: 1.25,
            borderRadius: 2,
            backgroundColor: '#fef3c7',
            border: '1px solid #f59e0b',
          }}
          >
            <Typography
              variant="body2"
            sx={{
              color: '#92400e',
              fontWeight: 700,
            }}
            >
            Action Required - {actionRequiredCount} RACMs are found ineffective
          </Typography>
        </Box>
      ) : null}

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
              }}
            >
              RACM Management
            </Typography>
            <Typography sx={PAGE_SUBHEADER_TEXT_SX}>
              Analyze and monitor RACM for your company.
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
              {showUnitFilter && (
                <FormControl
                  variant="outlined"
                  disabled={deleteMode || setActiveMode || setDueDateMode || replicateMode}
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

              {/* Business Process Filter */}
              <FormControl 
                variant="outlined" 
                disabled={deleteMode || setActiveMode || setDueDateMode || replicateMode}
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
                disabled={deleteMode || setActiveMode || setDueDateMode || replicateMode}
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
                disabled={deleteMode || setActiveMode || setDueDateMode || replicateMode}
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
                disabled={deleteMode || setActiveMode || setDueDateMode || replicateMode}
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
              <FormControl
                variant="outlined"
                disabled={deleteMode || setActiveMode || setDueDateMode || replicateMode}
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
                <InputLabel id="conclusion-filter-label">Conclusion</InputLabel>
                <Select
                  labelId="conclusion-filter-label"
                  id="conclusion-filter"
                  value={filterConclusion}
                  label="Conclusion"
                  onChange={(e) => setFilterConclusion(e.target.value)}
                >
                  <MenuItem value="all">All</MenuItem>
                  {conclusionOptions.map((option) => (
                    <MenuItem key={option} value={option}>
                      {option}
                    </MenuItem>
                  ))}
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
                    {(deleteMode || setActiveMode || setDueDateMode || replicateMode) && (
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
                          checked={allVisibleSelectableSelected}
                          indeterminate={someVisibleSelectableSelected && !allVisibleSelectableSelected}
                          onChange={(e) => {
                            e.stopPropagation()
                            handleSelectAll()
                          }}
                          onClick={(e) => e.stopPropagation()}
                          disabled={setActiveMode && validatingSetActiveSelection}
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
                    {showUnitColumn && (
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
                          width: '180px',
                          minWidth: '160px',
                          maxWidth: '220px',
                        }}
                      >
                        Unit
                      </Box>
                    )}
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
                      Active Status
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
                        width: '160px',
                        minWidth: '140px',
                        maxWidth: '180px',
                      }}
                    >
                      Conclusion
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
                      Due Date
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
                          cursor: (deleteMode || setActiveMode || setDueDateMode || replicateMode) ? 'default' : 'pointer',
                          transition: 'background-color 0.2s',
                          backgroundColor: isSelected 
                            ? (deleteMode 
                                ? (theme.palette.mode === 'dark' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(239, 68, 68, 0.1)')
                                : (theme.palette.mode === 'dark' ? 'rgba(3, 105, 161, 0.2)' : 'rgba(3, 105, 161, 0.1)'))
                            : 'transparent',
                          '&:hover': {
                            backgroundColor: (deleteMode || setActiveMode || setDueDateMode || replicateMode)
                              ? (isSelected 
                                  ? (deleteMode 
                                      ? (theme.palette.mode === 'dark' ? 'rgba(239, 68, 68, 0.25)' : 'rgba(239, 68, 68, 0.15)')
                                      : (theme.palette.mode === 'dark' ? 'rgba(3, 105, 161, 0.25)' : 'rgba(3, 105, 161, 0.15)'))
                                  : TABLE_ROW_HOVER_BG)
                              : TABLE_ROW_HOVER_BG,
                          },
                        }}
                      >
                        {(deleteMode || setActiveMode || setDueDateMode || replicateMode) && (
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
                              disabled={setActiveMode && validatingSetActiveSelection}
                              size="small"
                            />
                          </Box>
                        )}
                        <Box
                          component="td"
                          sx={dataCellSx({
                            px: 2.5,
                            py: 2,
                            width: '200px',
                            minWidth: '180px',
                            maxWidth: '220px',
                            fontSize: '0.875rem',
                            color: theme.palette.text.primary,
                          })}
                        >
                          <Box component="span" sx={dataCellTextSx}>
                            {form.business_process || 'N/A'}
                          </Box>
                        </Box>
                        <Box
                          component="td"
                          sx={dataCellSx({
                            px: 2.5,
                            py: 2,
                            width: '220px',
                            minWidth: '200px',
                            maxWidth: '260px',
                            fontSize: '0.875rem',
                            color: theme.palette.text.primary,
                          })}
                        >
                          <Tooltip title={form.sub_process || 'N/A'} arrow slotProps={{ tooltip: { sx: tooltipSx } }}>
                            <Box component="span" sx={dataCellTextSx}>
                              {form.sub_process || 'N/A'}
                            </Box>
                          </Tooltip>
                        </Box>
                        <Box
                          component="td"
                          sx={dataCellSx({
                            px: 2.5,
                            py: 2,
                            width: '260px',
                            minWidth: '220px',
                            maxWidth: '320px',
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
                        {showUnitColumn && (
                          <Box
                            component="td"
                            sx={dataCellSx({
                              px: 2.5,
                              py: 2,
                              width: '180px',
                              minWidth: '160px',
                              maxWidth: '220px',
                              fontSize: '0.875rem',
                              color: theme.palette.text.primary,
                            })}
                          >
                            <Tooltip title={form.unit_name || form.unit_id || 'N/A'} arrow slotProps={{ tooltip: { sx: tooltipSx } }}>
                              <Box component="span" sx={dataCellTextSx}>
                                {form.unit_name || form.unit_id || 'N/A'}
                              </Box>
                            </Tooltip>
                          </Box>
                        )}
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
                              ...STATUS_BADGE_PILL_SX,
                              ...getActivityBadgeSolidColors(isActive),
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
                            width: '120px',
                            minWidth: '120px',
                            maxWidth: '120px',
                          }}
                        >
                          <Box
                            component="span"
                            sx={{
                              ...STATUS_BADGE_PILL_SX,
                              ...getApprovalStatusBadgeSolidColors(status),
                            }}
                          >
                            {status}
                          </Box>
                        </Box>
                        <Box
                          component="td"
                          sx={dataCellSx({
                            px: 3,
                            py: 2,
                            width: '160px',
                            minWidth: '140px',
                            maxWidth: '180px',
                            fontSize: '0.875rem',
                            color: theme.palette.text.primary,
                          })}
                        >
                          <Box component="span" sx={dataCellTextSx}>
                            {formatConclusion(form.control_design_conclusion)}
                          </Box>
                        </Box>
                        <Box
                          component="td"
                          sx={dataCellSx({
                            px: 3,
                            py: 2,
                            width: '140px',
                            minWidth: '140px',
                            maxWidth: '140px',
                            fontSize: '0.875rem',
                            color: theme.palette.text.primary,
                          })}
                        >
                          <Box component="span" sx={dataCellTextSx}>
                            {form.due_date
                              ? new Date(form.due_date).toLocaleDateString('en-GB')
                              : '—'}
                          </Box>
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

        {/* Set Active Confirmation Dialog */}
        <Dialog
          open={setDueDateDialogOpen}
          onClose={handleSetDueDateCancel}
          aria-labelledby="set-due-date-dialog-title"
          aria-describedby="set-due-date-dialog-description"
          PaperProps={{
            sx: {
              borderRadius: 2,
              minWidth: { xs: '90%', sm: '440px' },
              boxShadow: theme.palette.mode === 'dark'
                ? '0 8px 32px rgba(0, 0, 0, 0.4)'
                : '0 8px 32px rgba(0, 0, 0, 0.12)',
            },
          }}
        >
          <DialogTitle
            id="set-due-date-dialog-title"
            sx={{
              pb: 2.5,
              pt: 3,
              px: 3,
              fontWeight: 600,
              fontSize: '1.25rem',
              color: theme.palette.text.primary,
            }}
          >
            Set Due Date
          </DialogTitle>
          <DialogContent sx={{ px: 3, pt: 2, pb: 3 }}>
            <DialogContentText
              id="set-due-date-dialog-description"
              sx={{ color: theme.palette.text.secondary, mb: 2 }}
            >
              This will replace the Due Date and Reminder Frequency for the selected RACM(s).
            </DialogContentText>

            <Typography variant="body2" sx={{ mb: 2, color: 'text.secondary' }}>
              Total selected RACM(s): <strong>{selectedForms.size}</strong>
              {alreadyScheduledCount > 0 ? (
                <>
                  {' '}
                  — already having due date & reminder frequency: <strong>{alreadyScheduledCount}</strong>
                </>
              ) : null}
            </Typography>

            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                gap: 2,
              }}
            >
              <FormControl fullWidth>
                <TextField
                  label="Due Date"
                  type="date"
                  value={setDueDateValue}
                  onChange={(e) => setSetDueDateValue(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                  disabled={setDueDateSubmitting}
                />
              </FormControl>

              <FormControl fullWidth>
                <InputLabel id="set-due-reminder-frequency-label">Reminder Frequency</InputLabel>
                <Select
                  labelId="set-due-reminder-frequency-label"
                  value={setDueReminderFrequency}
                  label="Reminder Frequency"
                  onChange={(e) => setSetDueReminderFrequency(e.target.value)}
                  disabled={setDueDateSubmitting}
                >
                  <MenuItem value="Daily">Daily</MenuItem>
                  <MenuItem value="Weekly">Weekly</MenuItem>
                  <MenuItem value="Monthly">Monthly</MenuItem>
                </Select>
              </FormControl>
            </Box>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2.5 }}>
            <Button
              onClick={handleSetDueDateCancel}
              disabled={setDueDateSubmitting}
              variant="outlined"
              sx={{ textTransform: 'none', px: 2.5, py: 1, borderRadius: 1 }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSetDueDateSubmit}
              disabled={setDueDateSubmitting}
              variant="contained"
              color={theme.palette.mode === 'dark' ? 'primary' : 'secondary'}
              sx={{ textTransform: 'none', px: 3, py: 1, borderRadius: 1, fontWeight: 600 }}
            >
              {setDueDateSubmitting ? 'Saving...' : 'Save'}
            </Button>
          </DialogActions>
        </Dialog>

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
              {emptyProcessOwnerCount > 0 ? (
                <Typography
                  variant="body2"
                  sx={{
                    mt: 1,
                    color: theme.palette.text.secondary,
                    fontWeight: 500,
                  }}
                >
                  RACM(s) without Process Owner (cannot be selected): <strong>{emptyProcessOwnerCount}</strong>
                </Typography>
              ) : null}
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

        {/* Non-user Role Dialog */}
        <Dialog
          open={nonUserRoleDialogOpen}
          onClose={handleNonUserRoleCancel}
          aria-labelledby="non-user-role-dialog-title"
          aria-describedby="non-user-role-dialog-description"
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
            id="non-user-role-dialog-title"
            sx={{
              pb: 2.5,
              pt: 3,
              px: 3,
              fontWeight: 600,
              fontSize: '1.25rem',
              color: theme.palette.text.primary,
            }}
          >
            Process Owner Role Check
          </DialogTitle>
          <DialogContent sx={{ px: 3, pt: 3, pb: 3 }}>
            <DialogContentText
              id="non-user-role-dialog-description"
              sx={{
                color: theme.palette.text.secondary,
                fontSize: '0.9375rem',
                lineHeight: 1.5,
                m: 0,
                mb: 2,
              }}
            >
              Process Owner must be a valid normal user. These RACM(s) cannot be selected for Set Active.
            </DialogContentText>
            <Box sx={{ mt: 2 }}>
              <Typography
                variant="body2"
                sx={{
                  color: theme.palette.text.primary,
                  fontWeight: 500,
                }}
              >
                Total number of RACM(s) with non-user Process Owner role: <strong>{nonUserRoleCount}</strong>
              </Typography>
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
                Process Owner emails with non-user role ({nonUserRoleEmails.length}):
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
                {nonUserRoleEmails.map((email, index) => (
                  <Typography
                    key={index}
                    variant="body2"
                    sx={{
                      color: theme.palette.text.primary,
                      py: 0.5,
                      borderBottom: index < nonUserRoleEmails.length - 1 ? '1px solid' : 'none',
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
              onClick={handleNonUserRoleCancel}
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
          </DialogActions>
        </Dialog>

        {/* Set Active selection info dialog (blocked selections summary) */}
        <Dialog
          open={setActiveSelectionInfoDialogOpen}
          onClose={handleSetActiveSelectionInfoCancel}
          aria-labelledby="set-active-selection-info-title"
          aria-describedby="set-active-selection-info-description"
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
            id="set-active-selection-info-title"
            sx={{
              pb: 2.5,
              pt: 3,
              px: 3,
              fontWeight: 600,
              fontSize: '1.25rem',
              color: theme.palette.text.primary,
            }}
          >
            Set Active – Selection Notice
          </DialogTitle>
          <DialogContent sx={{ px: 3, pt: 3, pb: 3 }}>
            <DialogContentText
              id="set-active-selection-info-description"
              sx={{
                color: theme.palette.text.secondary,
                fontSize: '0.9375rem',
                lineHeight: 1.5,
                m: 0,
                mb: 2,
              }}
            >
              Some RACM(s) cannot be selected for Set Active.
            </DialogContentText>

            {isSingleSetActiveSelectionNotice && singleSelectionProblemLines.length > 0 ? (
              <Box sx={{ mt: 2 }}>
                {sortSetActiveSingleNoticeLines(singleSelectionProblemLines).map((line) => (
                  <Typography key={line} variant="body2" sx={{ color: theme.palette.text.primary, fontWeight: 500, mb: 0.75 }}>
                    {line}
                  </Typography>
                ))}
              </Box>
            ) : (
              <>
                {pendingAssignmentCount > 0 ? (
                  <Typography
                    variant="body2"
                    sx={{
                      color: theme.palette.text.primary,
                      fontWeight: 500,
                      mb: 1,
                    }}
                  >
                    RACM assignment is pending (empty Process Owner): <strong>{pendingAssignmentCount}</strong>
                  </Typography>
                ) : null}

                {nonUserRoleBlockedCount > 0 ? (
                  <Box sx={{ mb: 1 }}>
                    <Typography
                      variant="body2"
                      sx={{
                        color: theme.palette.text.primary,
                        fontWeight: 500,
                        mb: 1,
                      }}
                    >
                      Process Owner role is not "user": <strong>{nonUserRoleBlockedCount}</strong>
                    </Typography>

                    {nonUserRoleBlockedEmails.length > 0 ? (
                      <Box
                        sx={{
                          maxHeight: '220px',
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
                        {nonUserRoleBlockedEmails.map((email, index) => (
                          <Typography
                            key={email}
                            variant="body2"
                            sx={{
                              color: theme.palette.text.primary,
                              py: 0.5,
                              borderBottom: index < nonUserRoleBlockedEmails.length - 1 ? '1px solid' : 'none',
                              borderColor: 'divider',
                            }}
                          >
                            {email}
                          </Typography>
                        ))}
                      </Box>
                    ) : null}
                  </Box>
                ) : null}

                {missingReminderCount > 0 ? (
                  <Typography
                    variant="body2"
                    sx={{
                      color: theme.palette.text.primary,
                      fontWeight: 500,
                      mb: 1,
                    }}
                  >
                    Reminder columns missing (due date / reminder frequency): <strong>{missingReminderCount}</strong>
                  </Typography>
                ) : null}

                {missingUsersCount > 0 ? (
                  <Box sx={{ mb: 1 }}>
                    <Typography
                      variant="body2"
                      sx={{
                        color: theme.palette.text.primary,
                        fontWeight: 500,
                        mb: 1,
                      }}
                    >
                      Process Owner user does not exist: <strong>{missingUsersCount}</strong>
                    </Typography>
                    {missingUserEmailsForDialog.length > 0 ? (
                      <Box
                        sx={{
                          maxHeight: '220px',
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
                        {missingUserEmailsForDialog.map((email, index) => (
                          <Typography
                            key={email}
                            variant="body2"
                            sx={{
                              color: theme.palette.text.primary,
                              py: 0.5,
                              borderBottom: index < missingUserEmailsForDialog.length - 1 ? '1px solid' : 'none',
                              borderColor: 'divider',
                            }}
                          >
                            {email}
                          </Typography>
                        ))}
                      </Box>
                    ) : null}
                  </Box>
                ) : null}

              </>
            )}
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
            {missingUsersCount > 0 ? (
              <Button
                onClick={handleCreateMissingUsers}
                variant="contained"
                color="secondary"
                disabled={creatingMissingUsers}
                sx={{
                  textTransform: 'none',
                  px: 3,
                  py: 1,
                  minWidth: '140px',
                  fontWeight: 600,
                }}
              >
                {creatingMissingUsers ? 'Creating...' : 'Create User'}
              </Button>
            ) : null}

            {eligibleSetActiveFormIds.length > 0 && !isSingleSetActiveSelectionNotice ? (
              <Button
                onClick={async () => {
                  handleSetActiveSelectionInfoCancel()
                  await performSetActive(eligibleSetActiveFormIds)
                }}
                variant="contained"
                color="secondary"
                disabled={bulkUpdating}
                sx={{
                  textTransform: 'none',
                  px: 3,
                  py: 1,
                  minWidth: '200px',
                  fontWeight: 700,
                }}
              >
                {bulkUpdating ? 'Setting...' : `Set Other RACMs Active (${eligibleSetActiveFormIds.length})`}
              </Button>
            ) : null}

            <Button
              onClick={handleSetActiveSelectionInfoCancel}
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
              Some selected RACM(s) still have Process Owner assignment remaining. Please create the missing user accounts or complete the assignment before setting those RACM(s) active.
            </DialogContentText>
            <Box sx={{ mt: 2 }}>
              {missingRacmCount === 1 ? (
                <Typography
                  variant="body2"
                  sx={{
                    color: theme.palette.text.primary,
                    fontWeight: 500,
                    mb: 0.5,
                  }}
                >
                  The selected RACM does not have a valid Process Owner assignment.
                </Typography>
              ) : (
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
              )}
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
            {missingProcessOwners.length > 0 && (
              <Box sx={{ mt: 2, mb: 1 }}>
                <Typography
                  variant="body2"
                  sx={{
                    color: theme.palette.text.primary,
                    fontWeight: 500,
                    mb: 1.5,
                  }}
                >
                  Process Owner email ID(s) not found in users table ({missingProcessOwners.length}):
                </Typography>
                <Box
                  sx={{
                    maxHeight: '260px',
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
                      key={email}
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
            )}
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
              disabled={creatingMissingUsers || bulkUpdating}
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
            {missingProcessOwners.length > 0 && (
              <Button
                onClick={handleCreateMissingUsers}
                variant="contained"
                color="primary"
                disabled={creatingMissingUsers || bulkUpdating}
                sx={{
                  textTransform: 'none',
                  px: 3,
                  py: 1,
                  minWidth: '140px',
                  fontWeight: 600,
                }}
              >
                {creatingMissingUsers ? 'Creating...' : 'Create Users'}
              </Button>
            )}
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
                disabled={bulkUpdating || creatingMissingUsers}
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
            <Box
              sx={{
                mt: 2,
                p: 1.5,
                borderRadius: 1.5,
                border: '1px solid',
                borderColor: theme.palette.error.main,
                backgroundColor: alpha(theme.palette.error.main, theme.palette.mode === 'dark' ? 0.14 : 0.08),
              }}
            >
              <Typography
                variant="body2"
                sx={{
                  color: theme.palette.error.main,
                  fontWeight: 700,
                  lineHeight: 1.6,
                }}
              >
                Warning: All associated sample documents and user-uploaded documents will be permanently removed from database.
              </Typography>
            </Box>
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
