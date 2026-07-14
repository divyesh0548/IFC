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
import Alert from '@mui/material/Alert'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogContentText from '@mui/material/DialogContentText'
import DialogActions from '@mui/material/DialogActions'
import TextField from '@mui/material/TextField'
import TablePagination from '@mui/material/TablePagination'
import { DatePicker } from '@mui/x-date-pickers/DatePicker'
import { toast } from 'react-hot-toast'
import dayjs from 'dayjs'
import { useSyncGlobalLoading } from '../../contexts/GlobalLoadingContext'
import { apiUrl, API_BASE_URL } from '../../config/api'
import { useBusinessProcesses } from '../../hooks/useBusinessProcesses'
import { 
  DASHBOARD_PAGE_OUTER_SX,
  DASHBOARD_PAPER_SX,
  DASHBOARD_TABLE_WRAP_SX,
  PAGE_SUBHEADER_TEXT_SX,
  TABLE_HEADER_BG,
  TABLE_ROW_HOVER_BG,
  CONCLUSION_BADGE_TABLE_PILL_SX,
  CONCLUSION_TABLE_CELL_SX,
  getApprovalStatusBadgeSolidColors,
  getApprovalStatusBadgePillSx,
  getConclusionBadgeSolidColors,
  formatRacmApprovalStatusLabel,
  toRacmApprovalStatusQueryParam,
  isMuiAlertCloseActionClick,
} from '../../uiConstants'
import { isCoordinatorAssignedRacm, isRacmAssigned } from '../../racmFormDetailFields'

/** Display order for Set Active selection notice (single-RACM list); missing-user line last. */
const DEFAULT_ROWS_PER_PAGE = 10
const ROWS_PER_PAGE_OPTIONS = [10, 25, 50]

const SET_ACTIVE_SINGLE_NOTICE_LINE_ORDER = [
  'RACM assignment is pending (empty Process Owner).',
  'Process Owner role is not "user".',
  'Process Owner is not assigned to this RACM\'s unit.',
  'Process Owner does not have a valid mobile number.',
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

function getTomorrowDateString() {
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const y = tomorrow.getFullYear()
  const mm = String(tomorrow.getMonth() + 1).padStart(2, '0')
  const dd = String(tomorrow.getDate()).padStart(2, '0')
  return `${y}-${mm}-${dd}`
}

function RacmManagementDashboard() {
  const theme = useTheme()
  const navigate = useNavigate()
  const [companyIdentifier, setCompanyIdentifier] = useState(null)
  const [forms, setForms] = useState([])
  const [page, setPage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(DEFAULT_ROWS_PER_PAGE)
  const [totalCount, setTotalCount] = useState(0)
  const [actionRequiredCount, setActionRequiredCount] = useState(0)
  const [actionRequiredForms, setActionRequiredForms] = useState([])
  const [actionRequiredFormsLoading, setActionRequiredFormsLoading] = useState(false)
  const [pendingChangeRequestCount, setPendingChangeRequestCount] = useState(0)
  const [pendingChangeRequestForms, setPendingChangeRequestForms] = useState([])
  const [pendingChangeRequestFormsLoading, setPendingChangeRequestFormsLoading] = useState(false)
  const [filterActive, setFilterActive] = useState('all') // 'all', 'active', 'inactive'
  const [filterStatus, setFilterStatus] = useState('all') // 'all', 'Approved', 'Rejected', 'Pending'
  const [filterBusinessProcess, setFilterBusinessProcess] = useState('all') // 'all' or specific business process
  const [filterFinancialYear, setFilterFinancialYear] = useState('all') // 'all' or specific financial year
  const [filterUnit, setFilterUnit] = useState('all') // 'all' or specific assigned unit
  const [filterConclusion, setFilterConclusion] = useState('all')
  const [controlNumberInput, setControlNumberInput] = useState('')
  const [controlNumberFilter, setControlNumberFilter] = useState('')
  const [conclusionOptions, setConclusionOptions] = useState([])
  const [coordinatorUnits, setCoordinatorUnits] = useState([])
  const [financialYearOptions, setFinancialYearOptions] = useState([])
  const [loading, setLoading] = useState(true)
  const [cellWordWrap, setCellWordWrap] = useState(false)
  const [bulkUpdating, setBulkUpdating] = useState(false)
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
  const [notInUnitBlockedCount, setNotInUnitBlockedCount] = useState(0)
  const [notInUnitBlockedEmails, setNotInUnitBlockedEmails] = useState([])
  const [invalidMobileBlockedCount, setInvalidMobileBlockedCount] = useState(0)
  const [invalidMobileBlockedEmails, setInvalidMobileBlockedEmails] = useState([])
  const [eligibleSetActiveFormIds, setEligibleSetActiveFormIds] = useState([])
  const [isSingleSetActiveSelectionNotice, setIsSingleSetActiveSelectionNotice] = useState(false)
  const [singleSelectionProblemLines, setSingleSelectionProblemLines] = useState([])
  const [validatingSetActiveSelection, setValidatingSetActiveSelection] = useState(false)
  const [setActiveClassifying, setSetActiveClassifying] = useState(false)
  const [actionRequiredAlertDismissed, setActionRequiredAlertDismissed] = useState(false)
  const [actionRequiredDialogOpen, setActionRequiredDialogOpen] = useState(false)
  const [pendingChangeRequestAlertDismissed, setPendingChangeRequestAlertDismissed] = useState(false)
  const [pendingChangeRequestDialogOpen, setPendingChangeRequestDialogOpen] = useState(false)
  const userRoleChecksRef = useRef({})
  const { businessProcessOptions } = useBusinessProcesses()

  useSyncGlobalLoading(loading)
  useSyncGlobalLoading(bulkUpdating)
  useSyncGlobalLoading(setDueDateSubmitting)
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
    if (companyIdentifier) {
      fetchForms()
    }
  }, [companyIdentifier, filterActive, filterStatus, filterBusinessProcess, filterFinancialYear, filterUnit, filterConclusion, controlNumberFilter, page, rowsPerPage])

  useEffect(() => {
    if (!pendingChangeRequestDialogOpen || !companyIdentifier) {
      return
    }
    fetchPendingChangeRequestForms()
  }, [pendingChangeRequestDialogOpen, companyIdentifier])

  useEffect(() => {
    if (!actionRequiredDialogOpen || !companyIdentifier) {
      return
    }
    fetchActionRequiredForms()
  }, [actionRequiredDialogOpen, companyIdentifier])

  useEffect(() => {
    const fetchCoordinatorUnits = async () => {
      if (!companyIdentifier) return

      try {
        const response = await fetch(apiUrl('/api/company-co/assigned-units'), {
          method: 'GET',
          credentials: 'include',
        })
        const data = await response.json()

        if (response.ok && data.success) {
          const assignedUnits = Array.isArray(data.units)
            ? data.units
            : Array.isArray(data.data?.currentCoordinatorUnits)
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

  const formatStatus = (status) => formatRacmApprovalStatusLabel(status)

  const formatConclusion = (value) => {
    const normalized = String(value || '').trim()
    if (!normalized) return 'None'
    return normalized.charAt(0).toUpperCase() + normalized.slice(1)
  }

  const buildFormsListUrl = ({ includePagination = true, extraParams = {} } = {}) => {
    const params = new URLSearchParams({
      company_identifier: companyIdentifier,
    })

    if (includePagination) {
      params.set('page', String(page + 1))
      params.set('page_size', String(rowsPerPage))
    }

    if (filterActive === 'active') {
      params.set('active', 'true')
    } else if (filterActive === 'inactive') {
      params.set('active', 'false')
    }

    if (filterStatus !== 'all') {
      const statusParam = toRacmApprovalStatusQueryParam(filterStatus)
      if (statusParam) params.set('status', statusParam)
    }

    if (filterBusinessProcess !== 'all') {
      params.set('business_process', filterBusinessProcess)
    }

    if (filterFinancialYear !== 'all') {
      params.set('financial_year', filterFinancialYear)
    }

    if (filterUnit !== 'all') {
      params.set('unit_id', filterUnit)
    }

    if (filterConclusion !== 'all') {
      params.set('conclusion', filterConclusion)
    }

    if (controlNumberFilter) {
      params.set('control_number', controlNumberFilter)
    }

    Object.entries(extraParams).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params.set(key, String(value))
      }
    })

    return `${API_BASE_URL}/api/control-forms?${params.toString()}`
  }

  const handleControlNumberSearchSubmit = (event) => {
    event.preventDefault()
    setControlNumberFilter(controlNumberInput.trim())
    setPage(0)
  }

  const handleControlNumberSearchClear = () => {
    setControlNumberInput('')
    setControlNumberFilter('')
    setPage(0)
  }

  const fetchPendingChangeRequestForms = async () => {
    if (!companyIdentifier) return

    setPendingChangeRequestFormsLoading(true)
    try {
      const params = new URLSearchParams({
        company_identifier: companyIdentifier,
        pending_changes: 'true',
        page: '1',
        page_size: '500',
      })
      const url = `${API_BASE_URL}/api/control-forms?${params.toString()}`
      const response = await fetch(url, {
        method: 'GET',
        credentials: 'include',
      })
      const data = await response.json()

      if (response.ok && data.success) {
        setPendingChangeRequestForms(Array.isArray(data.data) ? data.data : [])
      } else {
        setPendingChangeRequestForms([])
      }
    } catch (error) {
      console.error('Error fetching pending change request RACMs:', error)
      setPendingChangeRequestForms([])
    } finally {
      setPendingChangeRequestFormsLoading(false)
    }
  }

  const fetchActionRequiredForms = async () => {
    if (!companyIdentifier) return

    setActionRequiredFormsLoading(true)
    try {
      const params = new URLSearchParams({
        company_identifier: companyIdentifier,
        deficiency_action_status: 'true',
        page: '1',
        page_size: '500',
      })
      const url = `${API_BASE_URL}/api/control-forms?${params.toString()}`
      const response = await fetch(url, {
        method: 'GET',
        credentials: 'include',
      })
      const data = await response.json()

      if (response.ok && data.success) {
        setActionRequiredForms(Array.isArray(data.data) ? data.data : [])
      } else {
        setActionRequiredForms([])
      }
    } catch (error) {
      console.error('Error fetching ineffective RACMs:', error)
      setActionRequiredForms([])
    } finally {
      setActionRequiredFormsLoading(false)
    }
  }

  const fetchForms = async () => {
    if (!companyIdentifier) return
    
    setLoading(true)
    try {
      const url = buildFormsListUrl()
      const response = await fetch(url, {
        method: 'GET',
        credentials: 'include',
      })

      const data = await response.json()

      if (response.ok && data.success) {
        const nextForms = Array.isArray(data.data) ? data.data : []
        const nextTotal = Number(data.count || 0)
        const lastValidPage = Math.max(0, Math.ceil(nextTotal / rowsPerPage) - 1)

        if (nextTotal > 0 && nextForms.length === 0 && page > lastValidPage) {
          setPage(lastValidPage)
          return
        }

        setForms(nextForms)
        setTotalCount(nextTotal)
        setActionRequiredCount(Number(data.summary?.action_required_count || 0))
        setPendingChangeRequestCount(Number(data.summary?.pending_change_request_count || 0))
        setConclusionOptions(
          Array.isArray(data.summary?.conclusion_options) ? data.summary.conclusion_options : []
        )

        const latestYears = extractUniqueFinancialYears(nextForms)
        if (latestYears.length > 0) {
          const mergedYears = [...new Set([...(financialYearOptions || []), ...latestYears])]
          if (mergedYears.length !== financialYearOptions.length) {
            setFinancialYearOptions(mergedYears)
            localStorage.setItem(getFinancialYearStorageKey(companyIdentifier), JSON.stringify(mergedYears))
          }
        }
      } else {
        console.error('Error fetching forms:', data.message)
        setForms([])
        setTotalCount(0)
        setActionRequiredCount(0)
        setPendingChangeRequestCount(0)
      }
    } catch (error) {
      console.error('Error fetching forms:', error)
      setForms([])
      setTotalCount(0)
      setActionRequiredCount(0)
      setPendingChangeRequestCount(0)
    } finally {
      setLoading(false)
    }
  }

  const handleFormClick = (formId, e) => {
    // Prevent navigation when in delete mode, set active mode, or when clicking checkbox
    if (deleteMode || setActiveMode || replicateMode || setDueDateMode || (e && e.target.type === 'checkbox')) {
      return
    }
    window.open(`/company_co/form/${encodeURIComponent(formId)}`, '_blank', 'noopener,noreferrer')
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
    if (due < getTomorrowDateString()) {
      toast.error('Due date must be tomorrow or a future date')
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
    if (setActiveConfirmDialogOpen || replicateDialogOpen || deleteConfirmDialogOpen || setDueDateDialogOpen || nonUserRoleDialogOpen) {
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


  const checkUserRole = async (email, unitId = '') => {
    if (!email || !email.trim()) {
      return {
        exists: false,
        role: null,
        unit_id: null,
        in_unit: null,
        has_valid_mobile: false,
        mobile_error: 'Mobile number is required',
      }
    }

    try {
      const params = new URLSearchParams()
      const normalizedUnitId = String(unitId || '').trim()
      if (normalizedUnitId) {
        params.set('unit_id', normalizedUnitId)
      }
      const queryString = params.toString()
      const response = await fetch(
        `${API_BASE_URL}/api/company-co/check-user-role/${encodeURIComponent(email.trim())}${queryString ? `?${queryString}` : ''}`,
        {
          method: 'GET',
          credentials: 'include',
        }
      )

      const data = await response.json()
      if (!response.ok || !data.success) {
        return {
          exists: false,
          role: null,
          unit_id: null,
          in_unit: normalizedUnitId ? false : null,
          has_valid_mobile: false,
          mobile_error: null,
        }
      }
      return {
        exists: !!data.exists,
        role: data.role ?? null,
        unit_id: data.unit_id ?? null,
        in_unit: data.in_unit ?? null,
        has_valid_mobile: !!data.has_valid_mobile,
        mobile_error: data.mobile_error ?? null,
      }
    } catch (error) {
      console.error('Error checking user role:', error)
      return {
        exists: false,
        role: null,
        unit_id: null,
        in_unit: null,
        has_valid_mobile: false,
        mobile_error: null,
      }
    }
  }

  const normalizeEmail = (email) => (email || '').trim().toLowerCase()
  const normalizeRole = (role) => (role || '').toString().trim().toLowerCase()
  const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(email))

  const getUserRoleCheckCacheKey = (email, unitId = '') => {
    const normalizedEmail = normalizeEmail(email)
    const normalizedUnitId = String(unitId || '').trim()
    return normalizedUnitId ? `${normalizedEmail}::${normalizedUnitId}` : normalizedEmail
  }

  const getUserRoleCheck = async (email, unitId = '') => {
    const normalizedEmail = normalizeEmail(email)
    if (!normalizedEmail) {
      return {
        exists: false,
        role: null,
        unit_id: null,
        in_unit: null,
        has_valid_mobile: false,
        mobile_error: 'Mobile number is required',
      }
    }

    const cacheKey = getUserRoleCheckCacheKey(normalizedEmail, unitId)
    if (userRoleChecksRef.current[cacheKey]) {
      return userRoleChecksRef.current[cacheKey]
    }

    const result = await checkUserRole(normalizedEmail, unitId)
    userRoleChecksRef.current[cacheKey] = result
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

    const notInUnitFormIds = []
    const notInUnitEmails = []
    const invalidMobileFormIds = []
    const invalidMobileEmails = []

    for (const form of formsToCheck) {
      if (isCoordinatorAssignedRacm(form)) {
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
        continue
      }

      const email = normalizeEmail(form.control_owner)
      const unitId = form?.unit_id ? String(form.unit_id).trim() : ''

      if (!email) {
        emptyOwnerFormIds.push(form.form_id)
        continue
      }

      const userRoleCheck = await getUserRoleCheck(email, unitId)

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

      if (unitId && userRoleCheck.in_unit === false) {
        notInUnitFormIds.push(form.form_id)
        notInUnitEmails.push(email)
        continue
      }

      if (!userRoleCheck.has_valid_mobile) {
        invalidMobileFormIds.push(form.form_id)
        invalidMobileEmails.push(email)
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
      notInUnitFormIds,
      notInUnitEmails: [...new Set(notInUnitEmails)],
      invalidMobileFormIds,
      invalidMobileEmails: [...new Set(invalidMobileEmails)],
    }
  }

  const showSetActiveSelectionInfoDialog = ({
    emptyOwnerCount = 0,
    nonUserRoleForms = [],
    missingUserEmails = [],
    notInUnitEmails = [],
    invalidMobileEmails = [],
    reminderMissingCount = 0,
    sampleDocMissingCount = 0,
    eligibleFormIds = [],
    isSingle = false,
    singleProblemLines = [],
  }) => {
    const uniqueNonUserEmails = [...new Set((nonUserRoleForms || []).map((item) => item.email).filter(Boolean))]
    const uniqueMissingUserEmails = [...new Set((missingUserEmails || []).filter(Boolean))]
    const uniqueNotInUnitEmails = [...new Set((notInUnitEmails || []).filter(Boolean))]
    const uniqueInvalidMobileEmails = [...new Set((invalidMobileEmails || []).filter(Boolean))]

    setPendingAssignmentCount(emptyOwnerCount)
    setNonUserRoleBlockedCount((nonUserRoleForms || []).length)
    setNonUserRoleBlockedEmails(uniqueNonUserEmails)
    setMissingUsersCount(uniqueMissingUserEmails.length)
    setMissingUserEmailsForDialog(uniqueMissingUserEmails)
    setNotInUnitBlockedCount(uniqueNotInUnitEmails.length)
    setNotInUnitBlockedEmails(uniqueNotInUnitEmails)
    setInvalidMobileBlockedCount(uniqueInvalidMobileEmails.length)
    setInvalidMobileBlockedEmails(uniqueInvalidMobileEmails)
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
      notInUnitEmails,
      invalidMobileEmails,
    } = classification

    const hasAnyIssues =
      (emptyOwnerFormIds?.length || 0) > 0 ||
      (reminderMissingFormIds?.length || 0) > 0 ||
      (nonUserRoleForms?.length || 0) > 0 ||
      (missingFormIds?.length || 0) > 0 ||
      (notInUnitEmails?.length || 0) > 0 ||
      (invalidMobileEmails?.length || 0) > 0

    if (hasAnyIssues) {
      showSetActiveSelectionInfoDialog({
        emptyOwnerCount: emptyOwnerFormIds?.length || 0,
        reminderMissingCount: reminderMissingFormIds?.length || 0,
        sampleDocMissingCount: sampleDocMissingFormIds?.length || 0,
        nonUserRoleForms: nonUserRoleForms || [],
        missingUserEmails: missingEmails || [],
        notInUnitEmails: notInUnitEmails || [],
        invalidMobileEmails: invalidMobileEmails || [],
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
      setNonUserRoleCount(0)
      setNonUserRoleEmails([])
      await fetchForms()
    } catch (error) {
      console.error('Error setting forms to active:', error)
      toast.error('Error setting forms to active')
    } finally {
      setBulkUpdating(false)
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

  const isRacmActive = (form) => Boolean(form?.active)

  const handleSelectForm = async (formId) => {
    const newSelected = new Set(selectedForms)
    if (newSelected.has(formId)) {
      newSelected.delete(formId)
      setSelectedForms(newSelected)
      return
    }

    if (!setActiveMode) {
      if (deleteMode) {
        const form = forms.find((item) => item.form_id === formId)
        if (form && isRacmActive(form)) {
          toast.error('Active RACM cannot be deleted. Please set the RACM Inactive first.')
          return
        }
      }
      newSelected.add(formId)
      setSelectedForms(newSelected)
      return
    }

    const form = forms.find((item) => item.form_id === formId)
    if (!form) return
    const dueDate = form?.due_date
    const reminderFrequency = form?.reminder_frequency
    const hasDueDate = Boolean(dueDate)
    const hasReminderFrequency = reminderFrequency !== null && reminderFrequency !== undefined && String(reminderFrequency).trim() !== ''

    if (isCoordinatorAssignedRacm(form)) {
      if (!hasDueDate || !hasReminderFrequency) {
        showSetActiveSelectionInfoDialog({
          emptyOwnerCount: 0,
          reminderMissingCount: 1,
          eligibleFormIds: [],
          isSingle: true,
          singleProblemLines: ['Due date / reminder frequency is missing.'],
        })
        return
      }

      newSelected.add(formId)
      setSelectedForms(newSelected)
      return
    }

    const email = normalizeEmail(form.control_owner)
    const unitId = form?.unit_id ? String(form.unit_id).trim() : ''

    // For single RACM selection, show ALL applicable problems (in precedence order),
    // but still block selection if any problem exists.
    const problemLines = []
    if (!email) {
      problemLines.push('RACM assignment is pending (empty Process Owner).')
    }

    let userRoleCheck = null
    if (email) {
      userRoleCheck = await getUserRoleCheck(email, unitId)
      if (userRoleCheck.exists && normalizeRole(userRoleCheck.role) !== 'user') {
        problemLines.push('Process Owner role is not "user".')
      } else if (!userRoleCheck.exists) {
        problemLines.push('Process Owner user does not exist. Please create the user first.')
      } else if (unitId && userRoleCheck.in_unit === false) {
        problemLines.push('Process Owner is not assigned to this RACM\'s unit.')
      } else if (!userRoleCheck.has_valid_mobile) {
        problemLines.push('Process Owner does not have a valid mobile number.')
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
        notInUnitEmails: email && userRoleCheck?.exists && unitId && userRoleCheck.in_unit === false ? [email] : [],
        invalidMobileEmails: email && userRoleCheck?.exists && !userRoleCheck.has_valid_mobile ? [email] : [],
        reminderMissingCount: (!hasDueDate || !hasReminderFrequency) ? 1 : 0,
        eligibleFormIds: [],
        isSingle: true,
        singleProblemLines: sortSetActiveSingleNoticeLines(problemLines),
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
      if (deleteMode) {
        const deletableForms = forms.filter((form) => !isRacmActive(form))
        const skippedActiveCount = forms.length - deletableForms.length
        setSelectedForms(new Set(deletableForms.map((form) => form.form_id)))
        if (skippedActiveCount > 0) {
          toast(
            skippedActiveCount === 1
              ? '1 active RACM was skipped. Set it Inactive before deleting.'
              : `${skippedActiveCount} active RACM(s) were skipped. Set them Inactive before deleting.`
          )
        }
        return
      }

      const allFormIds = new Set(forms.map((form) => form.form_id))
      setSelectedForms(allFormIds)
      return
    }

    setValidatingSetActiveSelection(true)
    try {
      const {
        selectedFormIds,
        nonUserRoleForms,
        emptyOwnerFormIds,
        missingEmails,
        reminderMissingFormIds,
        sampleDocMissingFormIds,
        validFormIds,
        notInUnitEmails,
        invalidMobileEmails,
      } = await classifyFormsForSetActive(forms)
      setSelectedForms(new Set(selectedFormIds))

      if ((sampleDocMissingFormIds?.length || 0) > 0) {
        toast(`${sampleDocMissingFormIds.length} RACM(s) missing sample document. They can still be set Active.`)
      }

      if (
        (emptyOwnerFormIds?.length || 0) > 0 ||
        (nonUserRoleForms?.length || 0) > 0 ||
        (missingEmails?.length || 0) > 0 ||
        (notInUnitEmails?.length || 0) > 0 ||
        (invalidMobileEmails?.length || 0) > 0 ||
        (reminderMissingFormIds?.length || 0) > 0
      ) {
        showSetActiveSelectionInfoDialog({
          emptyOwnerCount: emptyOwnerFormIds?.length || 0,
          reminderMissingCount: reminderMissingFormIds?.length || 0,
          sampleDocMissingCount: sampleDocMissingFormIds?.length || 0,
          nonUserRoleForms: nonUserRoleForms || [],
          missingUserEmails: missingEmails || [],
          notInUnitEmails: notInUnitEmails || [],
          invalidMobileEmails: invalidMobileEmails || [],
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

    const activeSelectedCount = forms.filter(
      (form) => selectedForms.has(form.form_id) && isRacmActive(form)
    ).length

    if (activeSelectedCount > 0) {
      toast.error(
        activeSelectedCount === 1
          ? 'Active RACM cannot be deleted. Please set the RACM Inactive first.'
          : `${activeSelectedCount} active RACM(s) cannot be deleted. Please set them Inactive first.`
      )
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
      const selectedRecords = forms.filter((form) => selectedForms.has(form.form_id))
      const activeSelected = selectedRecords.filter((form) => isRacmActive(form))
      if (activeSelected.length > 0) {
        toast.error(
          activeSelected.length === 1
            ? 'Active RACM cannot be deleted. Please set the RACM Inactive first.'
            : `${activeSelected.length} active RACM(s) cannot be deleted. Please set them Inactive first.`
        )
        return
      }

      const formIds = selectedRecords.map((form) => form.form_id)
      let successCount = 0
      let failCount = 0
      let activeBlockedCount = 0
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
            if (String(data.message || '').includes('Active RACM cannot be deleted')) {
              activeBlockedCount++
            }
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
        if (activeBlockedCount > 0) {
          toast.error(
            activeBlockedCount === 1
              ? 'Active RACM cannot be deleted. Please set the RACM Inactive first.'
              : `${activeBlockedCount} active RACM(s) cannot be deleted. Please set them Inactive first.`
          )
        } else {
          toast.error(`Failed to delete ${failCount} RACM(s)`)
        }
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

    const dueDate = form?.due_date
    const reminderFrequency = form?.reminder_frequency
    const hasDueDate = Boolean(dueDate)
    const hasReminderFrequency = reminderFrequency !== null && reminderFrequency !== undefined && String(reminderFrequency).trim() !== ''

    if (isCoordinatorAssignedRacm(form)) {
      return !hasDueDate || !hasReminderFrequency
    }

    const email = normalizeEmail(form.control_owner)
    if (!email) return true

    const unitId = form?.unit_id ? String(form.unit_id).trim() : ''
    if (!hasDueDate || !hasReminderFrequency) return true

    const cachedCheck = userRoleChecksRef.current[getUserRoleCheckCacheKey(email, unitId)]
    if (!cachedCheck) return false
    if (!cachedCheck.exists) return true
    if (normalizeRole(cachedCheck.role) !== 'user') return true
    if (unitId && cachedCheck.in_unit === false) return true
    if (!cachedCheck.has_valid_mobile) return true
    return false
  }

  const emptyProcessOwnerCount = setActiveMode
    ? forms.filter((form) => !isRacmAssigned(form)).length
    : 0
  const selectableVisibleForms = deleteMode
    ? forms.filter((form) => !isRacmActive(form))
    : (replicateMode || setDueDateMode)
      ? forms
      : setActiveMode
        ? forms.filter((form) => !isBlockedForSetActiveSelection(form))
        : forms
  const allVisibleSelectableSelected = selectableVisibleForms.length > 0 &&
    selectableVisibleForms.every((form) => selectedForms.has(form.form_id))
  const someVisibleSelectableSelected = selectableVisibleForms.some((form) => selectedForms.has(form.form_id))

  // Handle Activity filter change (independent of Status filter)
  const handleActivityChange = (value) => {
    setFilterActive(value)
    setPage(0)
  }

  useEffect(() => {
    if (actionRequiredCount > 0) {
      setActionRequiredAlertDismissed(false)
    }
  }, [actionRequiredCount])

  useEffect(() => {
    if (pendingChangeRequestCount > 0) {
      setPendingChangeRequestAlertDismissed(false)
    }
  }, [pendingChangeRequestCount])

  const showUnitColumn = coordinatorUnits.length > 1
  const mgmtSelectionMode = deleteMode || setActiveMode || setDueDateMode || replicateMode
  const MGMT_TABLE_COL_PX = {
    checkbox: 44,
    controlNumber: 100,
    businessProcess: 130,
    subProcess: 140,
    description: 190,
    financialYear: 85,
    unit: 110,
    activity: 85,
    approval: 85,
    conclusion: 140,
    dueDate: 95,
  }
  const mgmtTableColWidthsOrdered = [
    ...(mgmtSelectionMode ? [MGMT_TABLE_COL_PX.checkbox] : []),
    MGMT_TABLE_COL_PX.controlNumber,
    MGMT_TABLE_COL_PX.businessProcess,
    MGMT_TABLE_COL_PX.subProcess,
    MGMT_TABLE_COL_PX.description,
    MGMT_TABLE_COL_PX.financialYear,
    ...(showUnitColumn ? [MGMT_TABLE_COL_PX.unit] : []),
    MGMT_TABLE_COL_PX.activity,
    MGMT_TABLE_COL_PX.approval,
    MGMT_TABLE_COL_PX.conclusion,
    MGMT_TABLE_COL_PX.dueDate,
  ]
  const mgmtTableTotalWidthPx = mgmtTableColWidthsOrdered.reduce((a, b) => a + b, 0)
  const pctColSx = (px) => {
    const pct = (100 * px) / mgmtTableTotalWidthPx
    const s = `${pct}%`
    return {
      width: s,
      minWidth: s,
      maxWidth: s,
      boxSizing: 'border-box',
    }
  }
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
    <Box sx={DASHBOARD_PAGE_OUTER_SX}>
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
          onClick={() => navigate('/company_co/ifc-report')}
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
          Reports
        </Button>

        <Button
          onClick={() => navigate('/company_co/racm-user-documents')}
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
          View Documents
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
            totalCount === 0 ||
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
            totalCount === 0 ||
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
            totalCount === 0 ||
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
            totalCount === 0 ||
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

      <Paper
        elevation={3}
        sx={{
          ...DASHBOARD_PAPER_SX,
          p: 3,
          backgroundColor: theme.palette.background.paper,
          borderRadius: 2,
        }}
      >
        {!loading && actionRequiredCount > 0 && !actionRequiredAlertDismissed ? (
          <Alert
            severity="warning"
            onClose={(event) => {
              event?.stopPropagation?.()
              setActionRequiredAlertDismissed(true)
            }}
            onClick={(event) => {
              if (isMuiAlertCloseActionClick(event)) return
              setActionRequiredDialogOpen(true)
            }}
            sx={{
              mb: 3,
              alignItems: 'center',
              cursor: 'pointer',
              '& .MuiAlert-message': {
                width: '100%',
              },
            }}
          >
            <Typography sx={{ fontWeight: 700 }}>
              {actionRequiredCount} RACMs are found ineffective
            </Typography>
            {/* <Typography variant="body2">
              Click to view the RACM list.
            </Typography> */}
          </Alert>
        ) : null}

        {!loading && pendingChangeRequestCount > 0 && !pendingChangeRequestAlertDismissed ? (
          <Alert
            severity="warning"
            onClose={(event) => {
              event?.stopPropagation?.()
              setPendingChangeRequestAlertDismissed(true)
            }}
            onClick={(event) => {
              if (isMuiAlertCloseActionClick(event)) return
              setPendingChangeRequestDialogOpen(true)
            }}
            sx={{
              mb: 3,
              alignItems: 'center',
              cursor: 'pointer',
              '& .MuiAlert-message': {
                width: '100%',
              },
            }}
          >
            <Typography sx={{ fontWeight: 700 }}>
              {pendingChangeRequestCount} RACMs have pending change request
            </Typography>
            {/* <Typography variant="body2">
              Click to view the RACM list.
            </Typography> */}
          </Alert>
        ) : null}

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
                    onChange={(e) => {
                      setFilterUnit(e.target.value)
                      setPage(0)
                    }}
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
                  onChange={(e) => {
                    setFilterBusinessProcess(e.target.value)
                    setPage(0)
                  }}
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
                  onChange={(e) => {
                    setFilterFinancialYear(e.target.value)
                    setPage(0)
                  }}
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
                  onChange={(e) => {
                    setFilterStatus(e.target.value)
                    setPage(0)
                  }}
                >
                  <MenuItem value="all">All</MenuItem>
                  <MenuItem value="Approved">Approved</MenuItem>
                  <MenuItem value="Rejected">Rejected</MenuItem>
                  <MenuItem value="Pending">Pending</MenuItem>
                  <MenuItem value="Sent for Approval">Sent for Approval</MenuItem>
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
                  onChange={(e) => {
                    setFilterConclusion(e.target.value)
                    setPage(0)
                  }}
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
          ) : (
            <Box>
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  mb: 1.5,
                  flexWrap: 'wrap',
                  gap: 1,
                }}
              >
                <Box
                  component="form"
                  onSubmit={handleControlNumberSearchSubmit}
                  sx={{
                    display: 'flex',
                    flexDirection: { xs: 'column', sm: 'row' },
                    gap: 1,
                    alignItems: { xs: 'stretch', sm: 'center' },
                  }}
                >
                  <TextField
                    label="Control Number"
                    value={controlNumberInput}
                    onChange={(e) => setControlNumberInput(e.target.value)}
                    disabled={deleteMode || setActiveMode || setDueDateMode || replicateMode}
                    size="small"
                    sx={{
                      minWidth: { xs: '100%', sm: 260 },
                      '& .MuiOutlinedInput-root': {
                        backgroundColor: 'transparent',
                      },
                    }}
                  />
                  <Button
                    type="submit"
                    variant="contained"
                    disabled={deleteMode || setActiveMode || setDueDateMode || replicateMode}
                  >
                    Search
                  </Button>
                  <Button
                    type="button"
                    variant="outlined"
                    onClick={handleControlNumberSearchClear}
                    disabled={(deleteMode || setActiveMode || setDueDateMode || replicateMode) || (!controlNumberInput && !controlNumberFilter)}
                  >
                    Clear
                  </Button>
                </Box>
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
              {totalCount === 0 ? (
                <Box sx={{ textAlign: 'center', py: 4 }}>
                  <Typography color="text.secondary">
                    {controlNumberFilter ? 'No forms match the control number search.' : 'No forms found.'}
                  </Typography>
                </Box>
              ) : (
                <>
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
                  {mgmtTableColWidthsOrdered.map((w, i) => (
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
                    {mgmtSelectionMode && (
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
                          ...pctColSx(MGMT_TABLE_COL_PX.checkbox),
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
                        ...pctColSx(MGMT_TABLE_COL_PX.controlNumber),
                      }}
                    >
                      Control Number
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
                        ...pctColSx(MGMT_TABLE_COL_PX.businessProcess),
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
                        ...pctColSx(MGMT_TABLE_COL_PX.subProcess),
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
                        ...pctColSx(MGMT_TABLE_COL_PX.description),
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
                        ...pctColSx(MGMT_TABLE_COL_PX.financialYear),
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
                          ...pctColSx(MGMT_TABLE_COL_PX.unit),
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
                        ...pctColSx(MGMT_TABLE_COL_PX.activity),
                      }}
                    >
                      Activity Status
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
                        ...pctColSx(MGMT_TABLE_COL_PX.approval),
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
                        ...pctColSx(MGMT_TABLE_COL_PX.conclusion),
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
                        ...pctColSx(MGMT_TABLE_COL_PX.dueDate),
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
                    const conclusionLabel = formatConclusion(form.control_design_conclusion)
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
                        {mgmtSelectionMode && (
                          <Box
                            component="td"
                            sx={{
                              px: 2,
                              py: 2,
                              textAlign: 'center',
                              ...pctColSx(MGMT_TABLE_COL_PX.checkbox),
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
                              disabled={
                                (setActiveMode && validatingSetActiveSelection) ||
                                (deleteMode && isRacmActive(form))
                              }
                              size="small"
                            />
                          </Box>
                        )}
                        <Box
                          component="td"
                          sx={dataCellSx({
                            px: 2.5,
                            py: 2,
                            fontSize: '0.875rem',
                            fontWeight: 600,
                            color: theme.palette.text.primary,
                            ...pctColSx(MGMT_TABLE_COL_PX.controlNumber),
                          })}
                        >
                          <Box component="span" sx={dataCellTextSx}>
                            {form.control_number || form.form_id || 'N/A'}
                          </Box>
                        </Box>
                        <Box
                          component="td"
                          sx={dataCellSx({
                            px: 2.5,
                            py: 2,
                            fontSize: '0.875rem',
                            color: theme.palette.text.primary,
                            ...pctColSx(MGMT_TABLE_COL_PX.businessProcess),
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
                            fontSize: '0.875rem',
                            color: theme.palette.text.primary,
                            ...pctColSx(MGMT_TABLE_COL_PX.subProcess),
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
                            fontSize: '0.875rem',
                            color: theme.palette.text.primary,
                            ...pctColSx(MGMT_TABLE_COL_PX.description),
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
                            fontSize: '0.875rem',
                            color: theme.palette.text.primary,
                            ...pctColSx(MGMT_TABLE_COL_PX.financialYear),
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
                              fontSize: '0.875rem',
                              color: theme.palette.text.primary,
                              ...pctColSx(MGMT_TABLE_COL_PX.unit),
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
                            ...pctColSx(MGMT_TABLE_COL_PX.activity),
                          }}
                        >
                          <Box component="span" sx={{ fontSize: '0.875rem', fontWeight: 600, color: theme.palette.text.primary }}>
                            {isActive ? 'Active' : 'Inactive'}
                          </Box>
                        </Box>
                        <Box
                          component="td"
                          sx={{
                            px: 3,
                            py: 2,
                            whiteSpace: 'nowrap',
                            ...pctColSx(MGMT_TABLE_COL_PX.approval),
                          }}
                        >
                          <Box
                            component="span"
                            sx={{
                              ...getApprovalStatusBadgePillSx(status),
                              ...getApprovalStatusBadgeSolidColors(status),
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
                            fontSize: '0.875rem',
                            color: theme.palette.text.primary,
                            ...pctColSx(MGMT_TABLE_COL_PX.conclusion),
                            ...CONCLUSION_TABLE_CELL_SX,
                          }}
                        >
                          <Tooltip title={conclusionLabel} arrow slotProps={{ tooltip: { sx: tooltipSx } }}>
                            <Box
                              component="span"
                              sx={{
                                ...CONCLUSION_BADGE_TABLE_PILL_SX,
                                ...getConclusionBadgeSolidColors(form.control_design_conclusion),
                              }}
                            >
                              {conclusionLabel}
                            </Box>
                          </Tooltip>
                        </Box>
                        <Box
                          component="td"
                          sx={dataCellSx({
                            px: 3,
                            py: 2,
                            fontSize: '0.875rem',
                            color: theme.palette.text.primary,
                            ...pctColSx(MGMT_TABLE_COL_PX.dueDate),
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
            <TablePagination
              component="div"
              count={totalCount}
              page={page}
              onPageChange={(_, newPage) => setPage(newPage)}
              rowsPerPage={rowsPerPage}
              onRowsPerPageChange={(event) => {
                setRowsPerPage(parseInt(event.target.value, 10))
                setPage(0)
              }}
              rowsPerPageOptions={ROWS_PER_PAGE_OPTIONS}
              sx={{
                borderTop: `1px solid ${theme.palette.divider}`,
                mt: 0.5,
                '& .MuiTablePagination-toolbar': {
                  px: { xs: 0.5, sm: 1 },
                },
              }}
            />
                </>
              )}
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
              sx={{ color: theme.palette.text.secondary, mt: 1.5,mb:1.5 }}
            >
              This will replace the Due Date and Reminder Frequency for the selected RACM(s).
            </DialogContentText>

            <Typography variant="body2" sx={{ mb: 2, color: 'text.secondary' }}>
              Total selected RACM(s) : <strong>{selectedForms.size}</strong>
              <br />
              {alreadyScheduledCount > 0 ? (
                <>
                  {' '}
                  RACMS(s) already having due date & reminder frequency : <strong>{alreadyScheduledCount}</strong>
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
                <DatePicker
                  label="Due Date"
                  value={setDueDateValue ? dayjs(setDueDateValue) : null}
                  onChange={(newValue) => {
                    setSetDueDateValue(newValue && newValue.isValid() ? newValue.format('YYYY-MM-DD') : '')
                  }}
                  minDate={dayjs(getTomorrowDateString())}
                  disabled={setDueDateSubmitting}
                  slotProps={{
                    textField: {
                      fullWidth: true,
                    },
                    popper: {
                      sx: { zIndex: (t) => t.zIndex.modal + 2 },
                    },
                  }}
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
                mt: 1.5,
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

                {notInUnitBlockedCount > 0 ? (
                  <Box sx={{ mb: 1 }}>
                    <Typography
                      variant="body2"
                      sx={{
                        color: theme.palette.text.primary,
                        fontWeight: 500,
                        mb: 1,
                      }}
                    >
                      Process Owner not assigned to RACM unit: <strong>{notInUnitBlockedCount}</strong>
                    </Typography>
                    {notInUnitBlockedEmails.length > 0 ? (
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
                        {notInUnitBlockedEmails.map((email, index) => (
                          <Typography
                            key={email}
                            variant="body2"
                            sx={{
                              color: theme.palette.text.primary,
                              py: 0.5,
                              borderBottom: index < notInUnitBlockedEmails.length - 1 ? '1px solid' : 'none',
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

                {invalidMobileBlockedCount > 0 ? (
                  <Box sx={{ mb: 1 }}>
                    <Typography
                      variant="body2"
                      sx={{
                        color: theme.palette.text.primary,
                        fontWeight: 500,
                        mb: 1,
                      }}
                    >
                      Process Owner missing valid mobile number: <strong>{invalidMobileBlockedCount}</strong>
                    </Typography>
                    {invalidMobileBlockedEmails.length > 0 ? (
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
                        {invalidMobileBlockedEmails.map((email, index) => (
                          <Typography
                            key={email}
                            variant="body2"
                            sx={{
                              color: theme.palette.text.primary,
                              py: 0.5,
                              borderBottom: index < invalidMobileBlockedEmails.length - 1 ? '1px solid' : 'none',
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

        <Dialog
          open={actionRequiredDialogOpen}
          onClose={() => setActionRequiredDialogOpen(false)}
          fullWidth
          maxWidth="md"
          PaperProps={{
            sx: {
              borderRadius: 2,
              minWidth: { xs: '90%', sm: '560px' },
              boxShadow: theme.palette.mode === 'dark'
                ? '0 8px 32px rgba(0, 0, 0, 0.4)'
                : '0 8px 32px rgba(0, 0, 0, 0.12)',
            },
          }}
        >
          <DialogTitle
            sx={{
              pb: 2.5,
              pt: 3,
              px: 3,
              fontWeight: 600,
              fontSize: '1.25rem',
              color: theme.palette.text.primary,
            }}
          >
            Ineffective RACMs
          </DialogTitle>
          <DialogContent dividers sx={{ px: 3, pt: 2.5, pb: 3 }}>
            <Typography variant="body2" sx={{ color: theme.palette.text.secondary, mb: 2 }}>
              Click any RACM below to open its details in a new page.
            </Typography>
            {actionRequiredFormsLoading ? (
              <Typography color="text.secondary">Loading ineffective RACMs...</Typography>
            ) : actionRequiredForms.length === 0 ? (
              <Typography color="text.secondary">No ineffective RACMs found.</Typography>
            ) : null}
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
              {actionRequiredForms.map((form) => (
                <Box
                  key={`action-required-dialog-${form.form_id}`}
                  role="button"
                  tabIndex={0}
                  onClick={() => window.open(`/company_co/form/${encodeURIComponent(form.form_id)}`, '_blank', 'noopener,noreferrer')}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      window.open(`/company_co/form/${encodeURIComponent(form.form_id)}`, '_blank', 'noopener,noreferrer')
                    }
                  }}
                  sx={{
                    p: 1.75,
                    borderRadius: 1.5,
                    border: `1px solid ${theme.palette.divider}`,
                    backgroundColor: theme.palette.background.paper,
                    cursor: 'pointer',
                    transition: 'background-color 0.2s, border-color 0.2s',
                    '&:hover, &:focus-visible': {
                      backgroundColor: TABLE_ROW_HOVER_BG,
                      borderColor: alpha(theme.palette.warning.main, 0.45),
                      outline: 'none',
                    },
                  }}
                >
                  <Typography sx={{ fontWeight: 700, color: theme.palette.text.primary }}>
                    {form.control_number || form.form_id}
                  </Typography>
                  <Typography variant="body2" sx={{ color: theme.palette.text.secondary, mt: 0.25 }}>
                    {[form.business_process, form.sub_process, form.financial_year].filter(Boolean).join(' | ') || form.form_id}
                  </Typography>
                </Box>
              ))}
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
              onClick={() => setActionRequiredDialogOpen(false)}
              variant="outlined"
              sx={{
                textTransform: 'none',
                px: 3,
                py: 1,
                minWidth: '100px',
                borderColor: theme.palette.mode === 'dark'
                  ? 'rgba(255, 255, 255, 0.23)'
                  : 'rgba(0, 0, 0, 0.23)',
              }}
            >
              Close
            </Button>
          </DialogActions>
        </Dialog>

        <Dialog
          open={pendingChangeRequestDialogOpen}
          onClose={() => setPendingChangeRequestDialogOpen(false)}
          fullWidth
          maxWidth="md"
          PaperProps={{
            sx: {
              borderRadius: 2,
              minWidth: { xs: '90%', sm: '560px' },
              boxShadow: theme.palette.mode === 'dark'
                ? '0 8px 32px rgba(0, 0, 0, 0.4)'
                : '0 8px 32px rgba(0, 0, 0, 0.12)',
            },
          }}
        >
          <DialogTitle
            sx={{
              pb: 2.5,
              pt: 3,
              px: 3,
              fontWeight: 600,
              fontSize: '1.25rem',
              color: theme.palette.text.primary,
            }}
          >
            Pending Change Requests
          </DialogTitle>
          <DialogContent dividers sx={{ px: 3, pt: 2.5, pb: 3 }}>
            <Typography variant="body2" sx={{ color: theme.palette.text.secondary, mb: 2 }}>
              Click any RACM below to open its details in a new page.
            </Typography>
            {pendingChangeRequestFormsLoading ? (
              <Typography color="text.secondary">Loading RACMs with pending change requests...</Typography>
            ) : pendingChangeRequestForms.length === 0 ? (
              <Typography color="text.secondary">No pending change requests found.</Typography>
            ) : null}
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
              {pendingChangeRequestForms.map((form) => (
                <Box
                  key={`pending-change-dialog-${form.form_id}`}
                  role="button"
                  tabIndex={0}
                  onClick={() => window.open(`/company_co/form/${encodeURIComponent(form.form_id)}`, '_blank', 'noopener,noreferrer')}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      window.open(`/company_co/form/${encodeURIComponent(form.form_id)}`, '_blank', 'noopener,noreferrer')
                    }
                  }}
                  sx={{
                    p: 1.75,
                    borderRadius: 1.5,
                    border: `1px solid ${theme.palette.divider}`,
                    backgroundColor: theme.palette.background.paper,
                    cursor: 'pointer',
                    transition: 'background-color 0.2s, border-color 0.2s',
                    '&:hover, &:focus-visible': {
                      backgroundColor: TABLE_ROW_HOVER_BG,
                      borderColor: alpha(theme.palette.warning.main, 0.45),
                      outline: 'none',
                    },
                  }}
                >
                  <Typography sx={{ fontWeight: 700, color: theme.palette.text.primary }}>
                    {form.control_number || form.form_id}
                  </Typography>
                  <Typography variant="body2" sx={{ color: theme.palette.text.secondary, mt: 0.25 }}>
                    {[form.business_process, form.sub_process, form.financial_year].filter(Boolean).join(' | ') || form.form_id}
                  </Typography>
                </Box>
              ))}
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
              onClick={() => setPendingChangeRequestDialogOpen(false)}
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
              }}
            >
              Close
            </Button>
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
                mt: 2,
                mb: 1.5,
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
