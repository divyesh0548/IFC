import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { alpha, useTheme } from '@mui/material/styles'
import Button from '@mui/material/Button'
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import CircularProgress from '@mui/material/CircularProgress'
import FormControl from '@mui/material/FormControl'
import InputLabel from '@mui/material/InputLabel'
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import ListItemText from '@mui/material/ListItemText'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Alert from '@mui/material/Alert'
import AddIcon from '@mui/icons-material/Add'
import DeleteIcon from '@mui/icons-material/Delete'
import UploadFileRoundedIcon from '@mui/icons-material/UploadFileRounded'
import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import Checkbox from '@mui/material/Checkbox'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogContentText from '@mui/material/DialogContentText'
import DialogActions from '@mui/material/DialogActions'
import Divider from '@mui/material/Divider'
import Chip from '@mui/material/Chip'
import Grid from '@mui/material/Grid'
import Stack from '@mui/material/Stack'
import InputAdornment from '@mui/material/InputAdornment'
import { toast } from 'react-hot-toast'
import MailOutlineRoundedIcon from '@mui/icons-material/MailOutlineRounded'
import BadgeRoundedIcon from '@mui/icons-material/BadgeRounded'
import PersonRoundedIcon from '@mui/icons-material/PersonRounded'
import WorkOutlineRoundedIcon from '@mui/icons-material/WorkOutlineRounded'
import ApartmentRoundedIcon from '@mui/icons-material/ApartmentRounded'
import LocalPhoneOutlinedIcon from '@mui/icons-material/LocalPhoneOutlined'
import * as XLSX from 'xlsx'
import { useSyncGlobalLoading } from '../../contexts/GlobalLoadingContext'
import { useAuth } from '../../contexts/AuthContext'
import { apiUrl } from '../../config/api'
import { useOrganizationEmailWarning } from '../../hooks/useOrganizationEmailWarning'
import { DASHBOARD_PAGE_OUTER_SX, DASHBOARD_PAPER_SX, TABLE_HEADER_BG, TABLE_ROW_HOVER_BG } from '../../uiConstants'
import { getMobileValidationError, normalizeMobileDigits } from '../../utils/mobileValidation'
import AppDialog, { getAppDialogCancelButtonSx } from '../../components/AppDialog'
import ApproverAssignmentsPanel from '../../components/approver/ApproverAssignmentsPanel'

const bulkUploadDialogDefaults = {
  open: false,
  unitIds: [],
  fileName: '',
  nonOrgCount: 0,
  confirmNonOrg: false,
  submitting: false,
  error: '',
}

const bulkUploadRequiredHeaders = ['Name', 'Email ID', 'Department', 'Designation', 'Mobile']
const BULK_UPLOAD_BLOCKED_TOAST = 'Upload excel again with corrections, See Logs !'

function validateBulkUploadRows(rows, validateEmailFn) {
  const errors = []
  const emailToRowNumbers = new Map()

  rows.forEach((row, index) => {
    const rowNumber = index + 2
    const emailId = String(row?.email_id || '').trim()
    const normalizedEmail = emailId.toLowerCase()
    const mobileDigits = normalizeMobileDigits(row?.mobile)

    if (!emailId) {
      errors.push({ rowNumber, field: 'Email ID', message: 'Email ID is required' })
    } else if (!validateEmailFn(emailId)) {
      errors.push({ rowNumber, field: 'Email ID', message: 'Invalid email format', email_id: emailId })
    }

    if (!mobileDigits) {
      errors.push({ rowNumber, field: 'Mobile', message: 'Mobile number is required', email_id: emailId || undefined })
    } else {
      const mobileError = getMobileValidationError(mobileDigits)
      if (mobileError) {
        errors.push({ rowNumber, field: 'Mobile', message: mobileError, email_id: emailId || undefined })
      }
    }

    if (emailId && validateEmailFn(emailId)) {
      const rowNumbers = emailToRowNumbers.get(normalizedEmail) || []
      rowNumbers.push(rowNumber)
      emailToRowNumbers.set(normalizedEmail, rowNumbers)
    }
  })

  emailToRowNumbers.forEach((rowNumbers, email) => {
    if (rowNumbers.length > 1) {
      errors.push({
        rowNumber: rowNumbers.join(', '),
        field: 'Email ID',
        message: `Duplicate email in Excel (rows ${rowNumbers.join(', ')})`,
        email_id: email,
      })
    }
  })

  return errors
}

function buildBulkValidationLogEntries(validationErrors) {
  return validationErrors.map((error) => ({
    message: `Row ${error.rowNumber} - ${error.field}: ${error.message}${error.email_id ? ` (${error.email_id})` : ''}`,
  }))
}

function UserManagement() {
  const theme = useTheme()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const bulkFileInputRef = useRef(null)
  const bulkUploadAbortControllerRef = useRef(null)
  const isCancellingBulkUploadRef = useRef(false)

  const [showCreateForm, setShowCreateForm] = useState(false)
  const [users, setUsers] = useState([])
  const [usersLoading, setUsersLoading] = useState(true)
  const [usersError, setUsersError] = useState('')
  const [unitFilter, setUnitFilter] = useState('all')
  const [roleFilter, setRoleFilter] = useState('all')

  const [deleteMode, setDeleteMode] = useState(false)
  const [selectedUserEmails, setSelectedUserEmails] = useState(new Set())
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deletingUsers, setDeletingUsers] = useState(false)
  const [mappedUnits, setMappedUnits] = useState([])
  const [bulkUploadDialog, setBulkUploadDialog] = useState(bulkUploadDialogDefaults)
  const [bulkUploadRows, setBulkUploadRows] = useState([])
  const [bulkUploadLogs, setBulkUploadLogs] = useState([])
  const [bulkLogsDialogOpen, setBulkLogsDialogOpen] = useState(false)
  const [showBulkLogsButton, setShowBulkLogsButton] = useState(false)
  const [bulkWarningDialogOpen, setBulkWarningDialogOpen] = useState(false)
  const [approverDetailsDialog, setApproverDetailsDialog] = useState({
    open: false,
    loading: false,
    error: '',
    approver: null,
    assignments: [],
  })
  const [userUnitsDialog, setUserUnitsDialog] = useState({
    open: false,
    user: null,
    linkedUnitIds: [],
    selectedUnitIdsToAdd: [],
    linking: false,
    error: '',
  })

  const [email, setEmail] = useState('')
  const [empCode, setEmpCode] = useState('')
  const [empName, setEmpName] = useState('')
  const [designation, setDesignation] = useState('')
  const [department, setDepartment] = useState('')
  const [mobile, setMobile] = useState('')
  const [selectedCreateUnitIds, setSelectedCreateUnitIds] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const { email: authEmail, role: authRole } = useAuth()
  const loggedCoordinatorEmail = authRole === 'company_co' ? (authEmail || '') : ''
  const { getEmailWarning, getEmailWarningHelperTextSx, countNonOrganizationEmails } = useOrganizationEmailWarning()
  const showUnitControls = mappedUnits.length > 1

  useSyncGlobalLoading(usersLoading)
  useSyncGlobalLoading(loading)
  useSyncGlobalLoading(deletingUsers)
  useSyncGlobalLoading(bulkUploadDialog.submitting)
  useSyncGlobalLoading(userUnitsDialog.linking)

  const validateEmail = (emailValue) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(emailValue)
  }

  const resetForm = () => {
    setEmail('')
    setEmpCode('')
    setEmpName('')
    setDesignation('')
    setDepartment('')
    setMobile('')
    setSelectedCreateUnitIds(mappedUnits[0]?.unit_id ? [mappedUnits[0].unit_id] : [])
    setError('')
  }

  const splitUnitValue = (value) => {
    if (Array.isArray(value)) {
      return value.map((item) => String(item || '').trim()).filter(Boolean)
    }

    return String(value || '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
  }

  const getUserUnitIds = (user) => splitUnitValue(user.unit_id)
  const getUserUnitNames = (user) => splitUnitValue(user.unit_name)
  const formatRoleLabel = (role) => {
    const normalizedRole = String(role || '').trim()
    if (!normalizedRole) return '-'
    if (normalizedRole === 'company_co') return 'Company Coordinator'

    return normalizedRole
      .split('_')
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
      .join(' ')
  }
  const unitOptions = useMemo(() => {
    return mappedUnits
      .map((unit) => ({
        unitId: String(unit?.unit_id || '').trim(),
        unitName: String(unit?.unit_name || unit?.unit_id || '').trim(),
      }))
      .filter((unit) => unit.unitId)
      .sort((a, b) => String(a.unitName).localeCompare(String(b.unitName)))
  }, [mappedUnits])

  const getUnitNamesFromIds = useCallback((unitIds) => {
    const normalizedUnitIds = Array.isArray(unitIds) ? unitIds : []
    return normalizedUnitIds
      .map((unitId) => unitOptions.find((unit) => unit.unitId === unitId))
      .filter(Boolean)
      .map((unit) => unit.unitName)
  }, [unitOptions])

  const roleOptions = useMemo(() => {
    return Array.from(
      new Set(
        users
          .map((user) => String(user.role || '').trim())
          .filter(Boolean)
      )
    ).sort((a, b) => a.localeCompare(b))
  }, [users])

  const filteredUsers = useMemo(() => {
    return users.filter((user) => {
      const unitIds = getUserUnitIds(user)
      const matchesUnit =
        unitFilter === 'all'
          ? true
          : String(user.role || '').trim() === 'approver'
            ? true
          : unitFilter === '__unassigned__'
            ? unitIds.length === 0
            : unitIds.includes(unitFilter)
      const matchesRole =
        roleFilter === 'all' ? true : String(user.role || '').trim() === roleFilter

      return matchesUnit && matchesRole
    })
  }, [users, unitFilter, roleFilter])

  const sortedFilteredUsers = useMemo(() => {
    const normalizedCoordinatorEmail = String(loggedCoordinatorEmail || '').trim().toLowerCase()
    return [...filteredUsers].sort((left, right) => {
      const leftIsLoggedCoordinator =
        String(left.role || '').trim() === 'company_co'
        && String(left.email_id || '').trim().toLowerCase() === normalizedCoordinatorEmail
      const rightIsLoggedCoordinator =
        String(right.role || '').trim() === 'company_co'
        && String(right.email_id || '').trim().toLowerCase() === normalizedCoordinatorEmail

      if (leftIsLoggedCoordinator && !rightIsLoggedCoordinator) return -1
      if (!leftIsLoggedCoordinator && rightIsLoggedCoordinator) return 1
      return 0
    })
  }, [filteredUsers, loggedCoordinatorEmail])

  const isLoggedCoordinatorUser = useCallback((user) => {
    return (
      String(user?.role || '').trim() === 'company_co'
      && String(user?.email_id || '').trim().toLowerCase() === String(loggedCoordinatorEmail || '').trim().toLowerCase()
    )
  }, [loggedCoordinatorEmail])

  const fetchUsers = useCallback(async () => {
    setUsersLoading(true)
    setUsersError('')
    try {
      const response = await fetch(apiUrl('/api/company-co/users'), {
        method: 'GET',
        credentials: 'include',
      })

      const data = await response.json()

      if (response.ok && data.success) {
        setUsers(Array.isArray(data.users) ? data.users : [])
      } else {
        const message = data.message || 'Failed to fetch users'
        setUsersError(message)
      }
    } catch (err) {
      console.error('Fetch users error:', err)
      setUsersError('Network error while fetching users')
    } finally {
      setUsersLoading(false)
    }
  }, [])

  const fetchMappedUnits = useCallback(async () => {
    try {
      const response = await fetch(apiUrl('/api/company-co/assigned-units'), {
        credentials: 'include',
      })
      const result = await response.json()
      if (!response.ok || !result?.success) {
        setMappedUnits([])
        return
      }

      const currentUnits = Array.isArray(result.units) ? result.units : []
      setMappedUnits(currentUnits)
    } catch (fetchError) {
      console.error('Fetch mapped units error:', fetchError)
      setMappedUnits([])
    }
  }, [])

  useEffect(() => {
    fetchUsers()
    fetchMappedUnits()
  }, [fetchUsers, fetchMappedUnits])

  useEffect(() => {
    if (!bulkUploadDialog.submitting) return undefined

    const warningMessage = 'User insertion process is running. Do you want to leave this page?'

    const handleBeforeUnload = (event) => {
      event.preventDefault()
      event.returnValue = ''
      return ''
    }

    const handleDocumentClick = (event) => {
      const anchor = event.target?.closest?.('a[href]')
      if (!anchor) return
      const href = anchor.getAttribute('href') || ''
      if (!href || href.startsWith('#')) return
      if (anchor.target === '_blank' || anchor.hasAttribute('download')) return
      if (anchor.origin !== window.location.origin) return

      const targetUrl = new URL(anchor.href, window.location.origin)
      const currentUrl = new URL(window.location.href)
      const sameRoute =
        targetUrl.pathname === currentUrl.pathname &&
        targetUrl.search === currentUrl.search &&
        targetUrl.hash === currentUrl.hash

      if (sameRoute) return

      event.preventDefault()
      const shouldLeave = window.confirm(warningMessage)
      if (!shouldLeave) return

      isCancellingBulkUploadRef.current = true
      bulkUploadAbortControllerRef.current?.abort()
      toast.error('User insertion stopped due to navigation')
      navigate(`${targetUrl.pathname}${targetUrl.search}${targetUrl.hash}`)
    }

    const handlePopState = () => {
      const shouldLeave = window.confirm(warningMessage)
      if (!shouldLeave) {
        window.history.go(1)
        return
      }
      isCancellingBulkUploadRef.current = true
      bulkUploadAbortControllerRef.current?.abort()
      toast.error('User insertion stopped due to navigation')
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    window.addEventListener('popstate', handlePopState)
    document.addEventListener('click', handleDocumentClick, true)

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      window.removeEventListener('popstate', handlePopState)
      document.removeEventListener('click', handleDocumentClick, true)
    }
  }, [bulkUploadDialog.submitting, navigate, location.pathname, location.search, location.hash])

  useEffect(() => {
    setSelectedUserEmails(new Set())
  }, [unitFilter, roleFilter])

  useEffect(() => {
    if (!showUnitControls && unitFilter !== 'all') {
      setUnitFilter('all')
    }
  }, [showUnitControls, unitFilter])

  useEffect(() => {
    if (selectedCreateUnitIds.length > 0) return
    if (mappedUnits[0]?.unit_id) {
      setSelectedCreateUnitIds([mappedUnits[0].unit_id])
    }
  }, [mappedUnits, selectedCreateUnitIds.length])

  useEffect(() => {
    if (location.pathname !== '/company-co/user-management') {
      setBulkUploadLogs([])
      setBulkLogsDialogOpen(false)
      setShowBulkLogsButton(false)
    }
  }, [location.pathname])

  // Reset selection when delete mode is turned off (matches RacmManagementDashboard behavior)
  useEffect(() => {
    if (!deleteMode) {
      setSelectedUserEmails(new Set())
    }
  }, [deleteMode])

  const toggleSelectUser = (emailId) => {
    setSelectedUserEmails((prev) => {
      const next = new Set(prev)
      if (next.has(emailId)) next.delete(emailId)
      else next.add(emailId)
      return next
    })
  }

  const handleDeleteModeToggle = () => {
    setDeleteMode(true)
  }

  const handleOpenApproverDetails = useCallback(async (user) => {
    if (!user || String(user.role || '').trim() !== 'approver' || !user.email_id) {
      return
    }

    setApproverDetailsDialog({
      open: true,
      loading: true,
      error: '',
      approver: user,
      assignments: [],
    })

    try {
      const response = await fetch(apiUrl(`/api/company-co/approvers/${encodeURIComponent(user.email_id)}/assignments`), {
        credentials: 'include',
      })
      const result = await response.json()

      if (!response.ok || !result?.success) {
        throw new Error(result?.message || 'Failed to fetch approver assignments')
      }

      setApproverDetailsDialog({
        open: true,
        loading: false,
        error: '',
        approver: result.data?.approver || user,
        assignments: Array.isArray(result.data?.assignments) ? result.data.assignments : [],
      })
    } catch (fetchError) {
      console.error('Fetch approver assignments error:', fetchError)
      setApproverDetailsDialog((prev) => ({
        ...prev,
        loading: false,
        error: fetchError.message || 'Failed to fetch approver assignments',
      }))
    }
  }, [])

  const currentApproverAssignments = useMemo(() => {
    return Array.isArray(approverDetailsDialog.assignments) ? approverDetailsDialog.assignments : []
  }, [approverDetailsDialog.assignments])

  const availableUnitsToLink = useMemo(() => {
    const linkedSet = new Set(userUnitsDialog.linkedUnitIds)
    return unitOptions.filter((unit) => !linkedSet.has(unit.unitId))
  }, [unitOptions, userUnitsDialog.linkedUnitIds])

  const handleOpenUserUnits = (user) => {
    if (!user || String(user.role || '').trim() !== 'user' || deleteMode) {
      return
    }

    setUserUnitsDialog({
      open: true,
      user,
      linkedUnitIds: getUserUnitIds(user),
      selectedUnitIdsToAdd: [],
      linking: false,
      error: '',
    })
  }

  const handleLinkUserUnits = async () => {
    if (!userUnitsDialog.user?.email_id) {
      return
    }

    if (userUnitsDialog.selectedUnitIdsToAdd.length === 0) {
      setUserUnitsDialog((prev) => ({ ...prev, error: 'Select at least one unit to link' }))
      return
    }

    setUserUnitsDialog((prev) => ({ ...prev, linking: true, error: '' }))
    try {
      const response = await fetch(apiUrl('/api/company-co/users/link-units'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          email_id: userUnitsDialog.user.email_id,
          unit_ids: userUnitsDialog.selectedUnitIdsToAdd,
        }),
      })
      const result = await response.json()

      if (!response.ok || !result?.success) {
        throw new Error(result?.message || 'Failed to link unit(s)')
      }

      const addedCount = Array.isArray(result.data?.added_unit_ids) ? result.data.added_unit_ids.length : 0
      if (addedCount > 0) {
        toast.success(result.message || `Linked ${addedCount} unit(s) successfully`)
      } else {
        toast.success(result.message || 'Selected unit(s) are already linked')
      }

      setUserUnitsDialog({
        open: false,
        user: null,
        linkedUnitIds: [],
        selectedUnitIdsToAdd: [],
        linking: false,
        error: '',
      })
      await fetchUsers()
    } catch (linkError) {
      console.error('Link user units error:', linkError)
      setUserUnitsDialog((prev) => ({
        ...prev,
        linking: false,
        error: linkError.message || 'Failed to link unit(s)',
      }))
    }
  }

  const handleDeleteClick = () => {
    if (selectedUserEmails.size === 0) {
      setDeleteMode(false)
      return
    }
    setDeleteDialogOpen(true)
  }

  useEffect(() => {
    if (!deleteMode || deleteDialogOpen) return undefined

    const handleDocumentClick = (event) => {
      const target = event?.target
      if (!target) return

      const isCheckbox =
        target.type === 'checkbox' ||
        target.closest?.('input[type="checkbox"]') ||
        target.closest?.('.MuiCheckbox-root')

      const isDialog = target.closest?.('.MuiDialog-root')
      const clickedButton = target.closest?.('button')
      const isDeleteButton = Boolean(
        clickedButton &&
          (clickedButton.textContent?.includes('Delete') ||
            clickedButton.getAttribute('aria-label')?.toLowerCase().includes('delete'))
      )

      if (isCheckbox || isDialog || isDeleteButton) return

      setDeleteMode(false)
    }

    document.addEventListener('click', handleDocumentClick, true)
    return () => {
      document.removeEventListener('click', handleDocumentClick, true)
    }
  }, [deleteDialogOpen, deleteMode])

  useEffect(() => {
    const emailParam = searchParams.get('email')
    if (emailParam) {
      setEmail(decodeURIComponent(emailParam))
      setShowCreateForm(true)
    }
  }, [searchParams])

  const submitCreateUser = async (confirmExistingUserUnits = false) => {
    const response = await fetch(apiUrl('/api/company-co/create-user'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({
        email_id: email.trim(),
        emp_code: empCode.trim() || null,
        emp_name: empName.trim() || null,
        designation: designation.trim() || null,
        department: department.trim() || null,
        mobile: normalizeMobileDigits(mobile) || null,
        unit_ids: selectedCreateUnitIds,
        confirm_existing_user_units: confirmExistingUserUnits,
      }),
    })

    const data = await response.json()

    if (!response.ok && data?.code === 'CONFIRM_EXISTING_USER_UNITS' && data?.requiresConfirmation) {
      const unitNames = getUnitNamesFromIds(selectedCreateUnitIds)
      const unitLabel = unitNames.length > 0 ? unitNames.join(', ') : 'the selected unit(s)'
      const shouldContinue = window.confirm(`User already exists in another unit. Are you sure you want to create user in ${unitLabel}?`)
      if (!shouldContinue) {
        return { cancelled: true }
      }

      return submitCreateUser(true)
    }

    return { response, data }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (!email.trim()) {
      const errorMsg = 'Email ID is required'
      setError(errorMsg)
      toast.error(errorMsg)
      return
    }

    if (!validateEmail(email)) {
      const errorMsg = 'Please enter a valid email address'
      setError(errorMsg)
      toast.error(errorMsg)
      return
    }

    if (selectedCreateUnitIds.length === 0) {
      const errorMsg = 'At least one unit is required'
      setError(errorMsg)
      toast.error(errorMsg)
      return
    }

    if (!mobile.trim()) {
      const errorMsg = 'Mobile number is required'
      setError(errorMsg)
      toast.error(errorMsg)
      return
    }

    const mobileValidationError = getMobileValidationError(mobile.trim())
    if (mobileValidationError) {
      setError(mobileValidationError)
      toast.error(mobileValidationError)
      return
    }

    setLoading(true)

    try {
      const result = await submitCreateUser()
      if (result?.cancelled) {
        return
      }

      const { response, data } = result

      if (response.ok && data.success) {
        toast.success(data.message || 'User created successfully')
        resetForm()
        setShowCreateForm(false)
        fetchUsers()
        navigate('/company-co/user-management', { replace: true })
      } else {
        const errorMsg = data.message || 'Failed to create user'
        setError(errorMsg)
        toast.error(errorMsg)
      }
    } catch (err) {
      console.error('Create user error:', err)
      const errorMsg = 'Network error. Please try again.'
      setError(errorMsg)
      toast.error(errorMsg)
    } finally {
      setLoading(false)
    }
  }

  const reportBulkValidationFailure = (validationErrors) => {
    const logs = buildBulkValidationLogEntries(validationErrors)
    setBulkUploadLogs(logs)
    setShowBulkLogsButton(true)
    toast.error(BULK_UPLOAD_BLOCKED_TOAST)
    console.error('Bulk user upload validation failed:', validationErrors)
  }

  const handleOpenBulkUploadDialog = () => {
    setBulkUploadRows([])
    setBulkUploadDialog({
      ...bulkUploadDialogDefaults,
      open: true,
      unitIds: mappedUnits[0]?.unit_id ? [mappedUnits[0].unit_id] : [],
    })
  }

  const handleCloseBulkUploadDialog = () => {
    if (bulkUploadDialog.submitting) return
    if (bulkFileInputRef.current) {
      bulkFileInputRef.current.value = ''
    }
    setBulkUploadRows([])
    setBulkUploadDialog(bulkUploadDialogDefaults)
  }

  const handleBulkFileChange = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      const arrayBuffer = await file.arrayBuffer()
      const workbook = XLSX.read(arrayBuffer, { type: 'array' })
      const firstSheetName = workbook.SheetNames[0]
      if (!firstSheetName) {
        throw new Error('Excel file does not contain any sheet')
      }

      const worksheet = workbook.Sheets[firstSheetName]
      const rows = XLSX.utils.sheet_to_json(worksheet, {
        header: 1,
        defval: '',
        blankrows: false,
      })

      const headerRow = Array.isArray(rows[0]) ? rows[0] : []
      const normalizedHeaders = new Set(
        headerRow
          .map((value) => String(value || '').trim().toLowerCase())
          .filter(Boolean)
      )

      const missingHeaders = bulkUploadRequiredHeaders.filter(
        (header) => !normalizedHeaders.has(header.trim().toLowerCase())
      )

      if (missingHeaders.length > 0) {
        setBulkUploadRows([])
        setBulkUploadDialog((prev) => ({
          ...prev,
          fileName: file.name,
          error: `Missing required column(s): ${missingHeaders.join(', ')}`,
        }))
        return
      }

      const jsonRows = XLSX.utils.sheet_to_json(worksheet, { defval: '' })
        .filter((row) =>
          bulkUploadRequiredHeaders.some((header) => String(row[header] || '').trim() !== '')
        )

      const parsedRows = jsonRows.map((row) => {
        const mobileDigits = normalizeMobileDigits(row['Mobile'])
        return {
          emp_name: String(row['Name'] || '').trim(),
          email_id: String(row['Email ID'] || '').trim(),
          department: String(row['Department'] || '').trim(),
          designation: String(row['Designation'] || '').trim(),
          mobile: mobileDigits,
        }
      })

      if (parsedRows.length === 0) {
        setBulkUploadRows([])
        setBulkUploadDialog((prev) => ({
          ...prev,
          fileName: file.name,
          error: 'Excel file does not contain any user rows',
        }))
        return
      }

      const validationErrors = validateBulkUploadRows(parsedRows, validateEmail)
      if (validationErrors.length > 0) {
        setBulkUploadRows([])
        setBulkUploadDialog((prev) => ({
          ...prev,
          fileName: file.name,
          error: BULK_UPLOAD_BLOCKED_TOAST,
        }))
        reportBulkValidationFailure(validationErrors)
        return
      }

      setBulkUploadRows(parsedRows)
      setBulkUploadDialog((prev) => ({
        ...prev,
        fileName: file.name,
        nonOrgCount: countNonOrganizationEmails(parsedRows.map((row) => row.email_id)),
        confirmNonOrg: false,
        error: '',
      }))
    } catch (parseError) {
      console.error('Bulk user excel parse error:', parseError)
      setBulkUploadRows([])
      setBulkUploadDialog((prev) => ({
        ...prev,
        fileName: file.name || '',
        error: parseError.message || 'Failed to read excel file',
      }))
    }
  }

  const handleDownloadBulkTemplate = () => {
    const worksheet = XLSX.utils.aoa_to_sheet([bulkUploadRequiredHeaders])
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Bulk Users Template')
    XLSX.writeFile(workbook, 'bulk_user_upload_template.xlsx')
    toast.success('Bulk upload template downloaded')
  }

  const executeBulkUploadUsers = async () => {
    if (bulkUploadDialog.unitIds.length === 0) {
      setBulkUploadDialog((prev) => ({ ...prev, error: 'Select at least one unit to map users' }))
      return
    }

    if (bulkUploadRows.length === 0) {
      setBulkUploadDialog((prev) => ({ ...prev, error: 'Upload a valid excel file first' }))
      return
    }

    const validationErrors = validateBulkUploadRows(bulkUploadRows, validateEmail)
    if (validationErrors.length > 0) {
      setBulkUploadDialog((prev) => ({ ...prev, error: BULK_UPLOAD_BLOCKED_TOAST }))
      reportBulkValidationFailure(validationErrors)
      return
    }

    setBulkUploadDialog((prev) => ({ ...prev, submitting: true, error: '' }))
    const abortController = new AbortController()
    bulkUploadAbortControllerRef.current = abortController

    try {
      const response = await fetch(apiUrl('/api/company-co/create-users-bulk'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        signal: abortController.signal,
        body: JSON.stringify({
          unit_ids: bulkUploadDialog.unitIds,
          users: bulkUploadRows,
        }),
      })
      const result = await response.json()

      if (!response.ok && result?.code === 'BULK_UPLOAD_VALIDATION_FAILED') {
        const backendValidationErrors = Array.isArray(result.validationErrors) ? result.validationErrors : []
        setBulkUploadDialog((prev) => ({
          ...prev,
          submitting: false,
          error: BULK_UPLOAD_BLOCKED_TOAST,
        }))
        reportBulkValidationFailure(
          backendValidationErrors.map((error) => ({
            rowNumber: error.rowNumber,
            field: error.field || 'Validation',
            message: error.reason || error.message || 'Invalid row',
            email_id: error.email_id,
          }))
        )
        return
      }

      if (!response.ok || !result?.success) {
        throw new Error(result?.message || 'Failed to upload users in bulk')
      }

      const createdCount = Array.isArray(result.createdUsers) ? result.createdUsers.length : 0
      const membershipAddedCount = Array.isArray(result.createdUsers)
        ? result.createdUsers.filter((user) => user.membershipAdded).length
        : 0
      const newUsersCount = createdCount - membershipAddedCount
      const skippedRows = Array.isArray(result.skippedRows) ? result.skippedRows : []
      const duplicateCount = skippedRows.filter((row) => row?.reason === 'User already exists').length
      const alreadyMappedCount = skippedRows.filter((row) => row?.reason === 'User already exists in selected unit(s)').length
      const skippedCount = duplicateCount + alreadyMappedCount

      const duplicateEmails = skippedRows
        .filter((row) => row?.reason === 'User already exists' && row?.email_id)
        .map((row) => String(row.email_id).trim())

      const alreadyMappedEmails = skippedRows
        .filter((row) => row?.reason === 'User already exists in selected unit(s)' && row?.email_id)
        .map((row) => String(row.email_id).trim())

      const membershipAddedEmails = Array.isArray(result.createdUsers)
        ? result.createdUsers
          .filter((user) => user.membershipAdded && user.email_id)
          .map((user) => String(user.email_id).trim())
        : []

      const logs = [
        newUsersCount > 0 ? { message: `Users created successfully: ${newUsersCount}` } : null,
        membershipAddedCount > 0
          ? {
              message: `Unit membership updated for existing user(s): ${membershipAddedCount}`,
              items: membershipAddedEmails,
            }
          : null,
        duplicateCount > 0
          ? {
              message: `Rows skipped (user already exists): ${duplicateCount}`,
              items: duplicateEmails,
            }
          : null,
        alreadyMappedCount > 0
          ? {
              message: `Rows skipped (user already mapped to selected units): ${alreadyMappedCount}`,
              items: alreadyMappedEmails,
            }
          : null,
      ].filter(Boolean)
      setBulkUploadLogs(logs)
      setShowBulkLogsButton(true)

      if (skippedCount > 0) {
        toast.error(`User(s) already exists, Skipped ${skippedCount}`)
      }
      if (newUsersCount > 0) {
        toast.success(`${newUsersCount} user(s) created successfully`)
      } else if (membershipAddedCount > 0 && skippedCount === 0) {
        toast.success(`Unit membership updated for ${membershipAddedCount} existing user(s)`)
      }

      handleCloseBulkUploadDialog()
      await fetchUsers()
    } catch (uploadError) {
      console.error('Bulk user upload error:', uploadError)
      if (uploadError.name === 'AbortError') {
        setBulkUploadLogs([{ message: 'User insertion process was cancelled' }])
        if (!isCancellingBulkUploadRef.current) {
          toast.error('User insertion process was cancelled')
        }
        setBulkUploadDialog((prev) => ({
          ...prev,
          submitting: false,
        }))
        return
      }
      setBulkUploadDialog((prev) => ({
        ...prev,
        submitting: false,
        error: uploadError.message || 'Network error while uploading users',
      }))
      setBulkUploadLogs([{ message: `Bulk upload failed: ${uploadError.message || 'Network error while uploading users'}` }])
    } finally {
      bulkUploadAbortControllerRef.current = null
      isCancellingBulkUploadRef.current = false
    }
  }

  const handleBulkUploadUsers = async () => {
    if (bulkUploadDialog.nonOrgCount > 0 && !bulkUploadDialog.confirmNonOrg) {
      setBulkWarningDialogOpen(true)
      return
    }
    await executeBulkUploadUsers()
  }

  const handleExportUsers = () => {
    if (filteredUsers.length === 0) {
      toast.error('No users available for export with current filters')
      return
    }

    const exportRows = filteredUsers.map((user) => ({
      'Employee Name': user.emp_name
        ? `${user.emp_name}${user.role === 'company_co' ? ' (Company Coordinator)' : ''}`
        : '',
      'Email ID': user.email_id || '-',
      Role: formatRoleLabel(user.role),
      Unit: user.unit_name || user.unit_id || '-',
      Department: user.department || '-',
      Designation: user.designation || '-',
      Mobile: user.mobile || '-',
    }))

    const worksheet = XLSX.utils.json_to_sheet(exportRows, {
      header: ['Employee Name', 'Email ID', 'Role', 'Unit', 'Department', 'Designation', 'Mobile'],
    })
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Users')

    const dateSuffix = new Date().toISOString().slice(0, 10)
    XLSX.writeFile(workbook, `users_export_${dateSuffix}.xlsx`)
    toast.success('Users exported successfully')
  }

  if (showCreateForm) {
    return (
      <Box
        sx={{
          minHeight: 'calc(100vh - 4rem)',
          px: 0,
          py: { xs: 1, md: 2 },
        }}
      >
        <Box sx={{ width: '100%', maxWidth: '880px', mx: 'auto' }}>
          <Paper
            sx={{
              overflow: 'hidden',
              borderRadius: 4,
              border: '1px solid',
              borderColor: alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.2 : 0.12),
              backgroundColor: theme.palette.background.paper,
              boxShadow:
                theme.palette.mode === 'dark'
                  ? '0 20px 48px rgba(0, 0, 0, 0.28)'
                  : '0 18px 42px rgba(18, 52, 88, 0.1)',
            }}
          >
            <Box sx={{ p: { xs: 3, sm: 4, md: 4.5 } }}>
              <Stack spacing={3}>
                <Box
                  sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: { xs: 'stretch', sm: 'flex-start' },
                    gap: 2,
                    flexDirection: { xs: 'column', sm: 'row' },
                  }}
                >
                  <Box>
                    <Chip
                      label="Company Coordinator"
                      size="small"
                      sx={{
                        mb: 1.75,
                        fontWeight: 700,
                        color: theme.palette.primary.main,
                        backgroundColor: alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.18 : 0.1),
                        border: '1px solid',
                        borderColor: alpha(theme.palette.primary.main, 0.2),
                      }}
                    />
                    <Typography variant="h4" component="h1" sx={{ mb: 1 }}>
                      Create user
                    </Typography>
                    <Typography variant="body2" sx={{ color: theme.palette.text.secondary, maxWidth: 620, lineHeight: 1.8 }}>
                      Add the employee&apos;s primary details below. Email is required. The remaining fields are optional, but they make ownership and tracking clearer across RACMs.
                    </Typography>
                  </Box>
                  <Button
                    onClick={() => {
                      setShowCreateForm(false)
                      resetForm()
                      navigate('/company-co/user-management', { replace: true })
                    }}
                    variant="outlined"
                    startIcon={<ArrowBackIcon />}
                    sx={{ textTransform: 'none', alignSelf: { xs: 'flex-start', sm: 'center' } }}
                  >
                    Back to List
                  </Button>
                </Box>

                <Divider />

                <form onSubmit={handleSubmit}>
                  <Grid container spacing={2.25}>
                    <Grid item xs={12}>
                      <Typography sx={{ fontWeight: 700, mb: 1.5 }}>User details</Typography>
                    </Grid>

                    <Grid item xs={12}>
                      <TextField
                        id="create-user-units"
                        name="create-user-units"
                        label={showUnitControls ? 'Units' : 'Unit'}
                        select={showUnitControls}
                        variant="outlined"
                        value={showUnitControls ? selectedCreateUnitIds : (mappedUnits[0]?.unit_name || mappedUnits[0]?.unit_id || '')}
                        onChange={(e) => setSelectedCreateUnitIds(typeof e.target.value === 'string' ? e.target.value.split(',') : e.target.value)}
                        required
                        disabled={loading || mappedUnits.length === 0 || !showUnitControls}
                        helperText={
                          mappedUnits.length === 0
                            ? 'No units are mapped with your coordinator account.'
                            : showUnitControls
                              ? 'Only units mapped with your coordinator account are available. You can select multiple units.'
                              : 'This user will be created for the selected unit.'
                        }
                        fullWidth
                        SelectProps={showUnitControls ? {
                          multiple: true,
                          renderValue: (selected) => {
                            const selectedIds = Array.isArray(selected) ? selected : []
                            return getUnitNamesFromIds(selectedIds).join(', ')
                          },
                        } : undefined}
                        InputProps={{
                          startAdornment: (
                            <InputAdornment position="start">
                              <ApartmentRoundedIcon fontSize="small" sx={{ color: theme.palette.text.secondary }} />
                            </InputAdornment>
                          ),
                          readOnly: !showUnitControls,
                        }}
                      >
                        {showUnitControls
                          ? unitOptions.map((unit) => (
                            <MenuItem key={unit.unitId} value={unit.unitId}>
                              <Checkbox checked={selectedCreateUnitIds.includes(unit.unitId)} size="small" />
                              <ListItemText primary={unit.unitName} />
                            </MenuItem>
                          ))
                          : undefined}
                      </TextField>
                    </Grid>

                    <Grid item xs={12}>
                      <TextField
                        id="email"
                        name="email"
                        label="Email ID"
                        type="email"
                        variant="outlined"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        disabled={loading}
                        placeholder="user@example.com"
                        error={!!error}
                        helperText={error || getEmailWarning(email) || 'Use the user’s primary company email address.'}
                        FormHelperTextProps={{ sx: error ? undefined : getEmailWarningHelperTextSx(email) }}
                        fullWidth
                        InputProps={{
                          startAdornment: (
                            <InputAdornment position="start">
                              <MailOutlineRoundedIcon fontSize="small" sx={{ color: theme.palette.text.secondary }} />
                            </InputAdornment>
                          ),
                        }}
                      />
                    </Grid>

                    <Grid item xs={12}>
                      <TextField
                        id="emp_code"
                        name="emp_code"
                        label="Employee Code"
                        type="text"
                        variant="outlined"
                        value={empCode}
                        onChange={(e) => setEmpCode(e.target.value)}
                        disabled={loading}
                        fullWidth
                        InputProps={{
                          startAdornment: (
                            <InputAdornment position="start">
                              <BadgeRoundedIcon fontSize="small" sx={{ color: theme.palette.text.secondary }} />
                            </InputAdornment>
                          ),
                        }}
                      />
                    </Grid>

                    <Grid item xs={12}>
                      <TextField
                        id="emp_name"
                        name="emp_name"
                        label="Employee Name"
                        type="text"
                        variant="outlined"
                        value={empName}
                        onChange={(e) => setEmpName(e.target.value)}
                        disabled={loading}
                        fullWidth
                        InputProps={{
                          startAdornment: (
                            <InputAdornment position="start">
                              <PersonRoundedIcon fontSize="small" sx={{ color: theme.palette.text.secondary }} />
                            </InputAdornment>
                          ),
                        }}
                      />
                    </Grid>

                    <Grid item xs={12}>
                      <TextField
                        id="designation"
                        name="designation"
                        label="Designation"
                        type="text"
                        variant="outlined"
                        value={designation}
                        onChange={(e) => setDesignation(e.target.value)}
                        disabled={loading}
                        fullWidth
                        InputProps={{
                          startAdornment: (
                            <InputAdornment position="start">
                              <WorkOutlineRoundedIcon fontSize="small" sx={{ color: theme.palette.text.secondary }} />
                            </InputAdornment>
                          ),
                        }}
                      />
                    </Grid>

                    <Grid item xs={12}>
                      <TextField
                        id="department"
                        name="department"
                        label="Department"
                        type="text"
                        variant="outlined"
                        value={department}
                        onChange={(e) => setDepartment(e.target.value)}
                        disabled={loading}
                        fullWidth
                        InputProps={{
                          startAdornment: (
                            <InputAdornment position="start">
                              <ApartmentRoundedIcon fontSize="small" sx={{ color: theme.palette.text.secondary }} />
                            </InputAdornment>
                          ),
                        }}
                      />
                    </Grid>

                    <Grid item xs={12}>
                      <TextField
                        id="mobile"
                        name="mobile"
                        label="Mobile Number"
                        type="tel"
                        variant="outlined"
                        value={mobile}
                        onChange={(e) => setMobile(e.target.value)}
                        disabled={loading}
                        required
                        error={!mobile.trim() || !!getMobileValidationError(mobile)}
                        helperText={
                          (!mobile.trim() && 'Mobile number is required') ||
                          getMobileValidationError(mobile) ||
                          'Enter a valid 10-digit mobile number.'
                        }
                        fullWidth
                        inputProps={{
                          maxLength: 10,
                        }}
                        InputProps={{
                          startAdornment: (
                            <InputAdornment position="start">
                              <LocalPhoneOutlinedIcon fontSize="small" sx={{ color: theme.palette.text.secondary }} />
                            </InputAdornment>
                          ),
                        }}
                      />
                    </Grid>
                  </Grid>

                  <Box
                    sx={{
                      display: 'flex',
                      justifyContent: 'flex-end',
                      alignItems: { xs: 'stretch', sm: 'center' },
                      gap: 2,
                      flexDirection: { xs: 'column', sm: 'row' },
                      mt: 3,
                      pt: 3,
                      borderTop: '1px solid',
                      borderColor: 'divider',
                    }}
                  >
                    <Box sx={{ display: 'flex', gap: 1.5, width: { xs: '100%', sm: 'auto' } }}>
                      <Button
                        type="button"
                        variant="outlined"
                        disabled={loading}
                        onClick={resetForm}
                        sx={{ textTransform: 'none', minWidth: 120, width: { xs: '50%', sm: 'auto' } }}
                      >
                        Clear
                      </Button>
                      <Button
                        type="submit"
                        disabled={loading}
                        variant="contained"
                        color="secondary"
                        sx={{
                          py: 1.4,
                          px: 3,
                          minWidth: 170,
                          width: { xs: '50%', sm: 'auto' },
                          fontSize: theme.typography.customSizes.medium,
                          fontWeight: 600,
                          textTransform: 'none',
                        }}
                      >
                        {loading ? 'Creating User...' : 'Create User'}
                      </Button>
                    </Box>
                  </Box>
                </form>
              </Stack>
            </Box>
          </Paper>
        </Box>
      </Box>
    )
  }
  const tableBorderColor = alpha(theme.palette.text.primary, theme.palette.mode === 'light' ? 0.16 : 0.2)
  const filterControlSx = { minWidth: { xs: '100%', sm: 240 } }
  const actionButtonSx = { textTransform: 'none', fontWeight: 700 }
  const bodyCellSx = {
    py: 1.55,
    px: 2.25,
    borderBottom: `1px solid ${tableBorderColor}`,
    verticalAlign: 'top',
  }
  const headCellSx = {
    ...bodyCellSx,
    py: 1.7,
    fontSize: '0.84rem',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    color: 'text.secondary',
    backgroundColor: TABLE_HEADER_BG,
  }

  return (
    <Box sx={DASHBOARD_PAGE_OUTER_SX}>
      <Paper
        elevation={0}
        sx={{
          ...DASHBOARD_PAPER_SX,
          overflow: 'visible',
          backgroundColor: 'transparent',
          boxShadow: 'none',
          borderRadius: 0,
        }}
      >
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: 2,
            flexWrap: 'wrap',
            alignItems: { xs: 'stretch', md: 'flex-start' },
            px: { xs: 0, sm: 0.5 },
            py: 2.25,
            flexDirection: { xs: 'column', md: 'row' },
            borderBottom: '1px solid',
            borderColor: 'divider',
            mb: 2,
          }}
        >
          <Typography
            component="h1"
            sx={{
              fontSize: { xs: '1.45rem', sm: '1.7rem' },
              fontWeight: 850,
              color: 'text.primary',
              lineHeight: 1.15,
            }}
          >
            User Management
          </Typography>
          <Box sx={{ display: 'flex', gap: 1.25, flexWrap: 'wrap', alignItems: 'center', justifyContent: { xs: 'flex-start', md: 'flex-end' } }}>
            {showUnitControls ? (
              <FormControl size="small" sx={filterControlSx}>
                <InputLabel id="unit-filter-label">Unit</InputLabel>
                <Select
                  labelId="unit-filter-label"
                  id="unit-filter"
                  value={unitFilter}
                  label="Unit"
                  onChange={(e) => setUnitFilter(e.target.value)}
                  disabled={usersLoading || unitOptions.length === 0}
                >
                  <MenuItem value="all">All Units</MenuItem>
                  {unitOptions.map((unit) => (
                    <MenuItem key={unit.unitId} value={unit.unitId}>
                      {unit.unitName}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            ) : null}
            <FormControl size="small" sx={filterControlSx}>
              <InputLabel id="role-filter-label">Role</InputLabel>
              <Select
                labelId="role-filter-label"
                id="role-filter"
                value={roleFilter}
                label="Role"
                onChange={(e) => setRoleFilter(e.target.value)}
                disabled={usersLoading || roleOptions.length === 0}
              >
                <MenuItem value="all">All Roles</MenuItem>
                {roleOptions.map((role) => (
                  <MenuItem key={role} value={role}>
                    {formatRoleLabel(role)}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Button
              variant="outlined"
              startIcon={<UploadFileRoundedIcon />}
              onClick={handleOpenBulkUploadDialog}
              disabled={usersLoading || mappedUnits.length === 0 || deletingUsers}
              sx={actionButtonSx}
            >
              Bulk Upload
            </Button>
            <Button
              variant="outlined"
              startIcon={<DownloadRoundedIcon />}
              onClick={handleExportUsers}
              disabled={usersLoading || filteredUsers.length === 0}
              sx={actionButtonSx}
            >
              Export
            </Button>
            <Button
              variant={deleteMode ? 'contained' : 'outlined'}
              color="error"
              onClick={() => {
                if (deleteMode) {
                  if (selectedUserEmails.size > 0) {
                    handleDeleteClick()
                  }
                } else {
                  handleDeleteModeToggle()
                }
              }}
              disabled={usersLoading || filteredUsers.length === 0 || deletingUsers || (deleteMode && selectedUserEmails.size === 0)}
              aria-label={
                deleteMode && selectedUserEmails.size > 0
                  ? `Delete ${selectedUserEmails.size} selected users`
                  : 'Delete users'
              }
              sx={{ ...actionButtonSx, minWidth: 0, px: 1.25 }}
            >
              <DeleteIcon />
            </Button>
            <Button
              variant="contained"
              color="secondary"
              onClick={() => navigate('/company-co/create-user')}
              aria-label="Create user"
              sx={{ ...actionButtonSx, minWidth: 0, px: 1.25 }}
            >
              <AddIcon />
            </Button>
            {showBulkLogsButton && (
              <Button
                variant="contained"
                color="info"
                onClick={() => setBulkLogsDialogOpen(true)}
                sx={actionButtonSx}
              >
                Logs !
              </Button>
            )}
          </Box>
        </Box>

        {usersError && (
          <Alert severity="error" sx={{ borderRadius: 0, m: 0 }}>
            {usersError}
          </Alert>
        )}

        <TableContainer
          component={Box}
          sx={{
            border: `1px solid ${tableBorderColor}`,
            borderRadius: 1.5,
            overflow: 'hidden',
            backgroundColor:
              theme.palette.mode === 'dark'
                ? alpha(theme.palette.background.paper, 0.96)
                : alpha(theme.palette.background.paper, 0.92),
            boxShadow:
              theme.palette.mode === 'dark'
                ? '0 10px 24px rgba(0, 0, 0, 0.16)'
                : '0 10px 24px rgba(15, 23, 42, 0.05)',
          }}
        >
          <Table
            size="medium"
            sx={{
              minWidth: 950,
              borderCollapse: 'separate',
              borderSpacing: 0,
            }}
          >
            <TableHead>
              <TableRow>
                {deleteMode ? <TableCell sx={{ ...headCellSx, width: 54, px: 2 }} /> : null}
                <TableCell sx={headCellSx}>Name</TableCell>
                <TableCell sx={headCellSx}>Email ID</TableCell>
                <TableCell sx={{ ...headCellSx, width: showUnitControls ? 180 : 210 }}>Role</TableCell>
                {showUnitControls ? <TableCell sx={headCellSx}>Unit</TableCell> : null}
                <TableCell sx={headCellSx}>Department</TableCell>
                <TableCell sx={headCellSx}>Designation</TableCell>
                <TableCell sx={headCellSx}>Mobile</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {usersLoading ? (
                <TableRow>
                  <TableCell colSpan={deleteMode ? (showUnitControls ? 8 : 7) : (showUnitControls ? 7 : 6)} align="center" sx={{ py: 5, borderBottom: 0 }}>
                    <CircularProgress size={26} />
                  </TableCell>
                </TableRow>
              ) : users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={deleteMode ? (showUnitControls ? 8 : 7) : (showUnitControls ? 7 : 6)} align="center" sx={{ py: 5, borderBottom: 0 }}>
                    No users found for your company.
                  </TableCell>
                </TableRow>
              ) : filteredUsers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={deleteMode ? (showUnitControls ? 8 : 7) : (showUnitControls ? 7 : 6)} align="center" sx={{ py: 5, borderBottom: 0 }}>
                    No users found for the selected filters.
                  </TableCell>
                </TableRow>
              ) : (
                sortedFilteredUsers.map((user, idx) => {
                  const isCoordinatorRow = isLoggedCoordinatorUser(user)
                  const rowTextSx = isCoordinatorRow ? { fontWeight: 800 } : undefined

                  return (
                  <TableRow
                    key={`${user.email_id}-${idx}`}
                    hover
                    sx={{
                      '&:hover': {
                        backgroundColor: TABLE_ROW_HOVER_BG,
                      },
                      '&:last-of-type td': { borderBottom: 0 },
                      '& td': {
                        borderBottom:
                          idx === sortedFilteredUsers.length - 1 ? 0 : `1px solid ${tableBorderColor}`,
                        ...(isCoordinatorRow ? { fontWeight: 800 } : {}),
                      },
                    }}
                  >
                    {deleteMode ? (
                      <TableCell sx={{ ...bodyCellSx, px: 2, width: 54 }}>
                        <Checkbox
                          checked={selectedUserEmails.has(user.email_id)}
                          disabled={user.role !== 'user'}
                          onChange={() => toggleSelectUser(user.email_id)}
                          inputProps={{ 'aria-label': `select ${user.email_id}` }}
                        />
                      </TableCell>
                    ) : null}
                    <TableCell sx={bodyCellSx}>
                      <Typography component="span" sx={rowTextSx}>
                        {user.emp_name ? `${user.emp_name}${user.role === 'company_co' ? ' (Company Coordinator)' : ''}` : ''}
                      </Typography>
                    </TableCell>
                    <TableCell sx={bodyCellSx}>
                      <Typography component="span" sx={rowTextSx}>{user.email_id || '-'}</Typography>
                    </TableCell>
                    <TableCell sx={{ ...bodyCellSx, whiteSpace: 'nowrap' }}>
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.35 }}>
                        <Typography component="span" sx={{ fontSize: '0.89rem', lineHeight: 1.2, ...rowTextSx }}>
                          {formatRoleLabel(user.role)}
                        </Typography>
                        {user.role === 'approver' ? (
                          <Typography
                            component="button"
                            type="button"
                            onClick={() => handleOpenApproverDetails(user)}
                            sx={{
                              p: 0,
                              m: 0,
                              border: 0,
                              background: 'transparent',
                              textAlign: 'left',
                              cursor: 'pointer',
                              color: theme.palette.primary.main,
                              fontSize: '0.7rem',
                              lineHeight: 1.2,
                              whiteSpace: 'nowrap',
                            }}
                          >
                            (Click to see details)
                          </Typography>
                        ) : null}
                      </Box>
                    </TableCell>
                    {showUnitControls ? (
                      <TableCell sx={bodyCellSx}>
                        {user.role === 'user' ? (
                          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.35 }}>
                            <Typography component="span" sx={{ fontSize: '0.89rem', lineHeight: 1.2, ...rowTextSx }}>
                              {user.unit_name || user.unit_id || '-'}
                            </Typography>
                            {!deleteMode ? (
                              <Typography
                                component="button"
                                type="button"
                                onClick={() => handleOpenUserUnits(user)}
                                sx={{
                                  p: 0,
                                  m: 0,
                                  border: 0,
                                  background: 'transparent',
                                  textAlign: 'left',
                                  cursor: 'pointer',
                                  color: theme.palette.primary.main,
                                  fontSize: '0.7rem',
                                  lineHeight: 1.2,
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                (Click to see details)
                              </Typography>
                            ) : null}
                          </Box>
                        ) : (
                          <Typography component="span" sx={rowTextSx}>{user.unit_name || user.unit_id || '-'}</Typography>
                        )}
                      </TableCell>
                    ) : null}
                    <TableCell sx={bodyCellSx}>
                      <Typography component="span" sx={rowTextSx}>{user.department || '-'}</Typography>
                    </TableCell>
                    <TableCell sx={bodyCellSx}>
                      <Typography component="span" sx={rowTextSx}>{user.designation || '-'}</Typography>
                    </TableCell>
                    <TableCell sx={bodyCellSx}>
                      <Typography component="span" sx={rowTextSx}>{user.mobile || '-'}</Typography>
                    </TableCell>
                  </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      <Dialog
        open={bulkUploadDialog.open}
        onClose={handleCloseBulkUploadDialog}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Bulk User Upload</DialogTitle>
        <DialogContent dividers sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2.5 }}>
          {mappedUnits.length === 0 ? (
            <Alert severity="info">
              No mapped units found for this coordinator.
            </Alert>
          ) : (
            <>
              <FormControl fullWidth required disabled={bulkUploadDialog.submitting}>
                <InputLabel id="bulk-upload-unit-label">{showUnitControls ? 'Units' : 'Unit'}</InputLabel>
                <Select
                  labelId="bulk-upload-unit-label"
                  label={showUnitControls ? 'Units' : 'Unit'}
                  multiple={showUnitControls}
                  value={showUnitControls ? bulkUploadDialog.unitIds : (bulkUploadDialog.unitIds[0] || '')}
                  onChange={(event) =>
                    setBulkUploadDialog((prev) => ({
                      ...prev,
                      unitIds: typeof event.target.value === 'string' ? event.target.value.split(',') : event.target.value,
                      error: '',
                    }))
                  }
                  renderValue={
                    showUnitControls
                      ? (selected) => getUnitNamesFromIds(Array.isArray(selected) ? selected : []).join(', ')
                      : undefined
                  }
                >
                  {mappedUnits.map((unit) => (
                    <MenuItem key={unit.unit_id || unit.id} value={unit.unit_id}>
                      {showUnitControls ? <Checkbox checked={bulkUploadDialog.unitIds.includes(unit.unit_id)} size="small" /> : null}
                      <ListItemText primary={unit.unit_name || unit.unit_id} />
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <Button
                variant="outlined"
                component="label"
                startIcon={<UploadFileRoundedIcon />}
                disabled={bulkUploadDialog.submitting}
              >
                Upload Excel
                <input
                  ref={bulkFileInputRef}
                  type="file"
                  hidden
                  accept=".xlsx,.xls"
                  onChange={handleBulkFileChange}
                />
              </Button>
              <Button
                variant="outlined"
                startIcon={<DownloadRoundedIcon />}
                onClick={handleDownloadBulkTemplate}
                disabled={bulkUploadDialog.submitting}
              >
                Download Template
              </Button>

              {bulkUploadDialog.fileName && (
                <Typography sx={{ fontSize: '0.9rem', color: 'text.secondary' }}>
                  Selected file: {bulkUploadDialog.fileName}
                </Typography>
              )}

              <Alert severity="info">
                Excel header row must include: Name, Email ID, Department, Designation, Mobile. Email ID and Mobile are required and must be valid for every row. Duplicate emails within the file are not allowed. Existing users in other units are added to the selected unit(s) automatically. Rows with an email that already exists in the selected unit(s) will be skipped.
              </Alert>

              {bulkUploadRows.length > 0 && (
                <Typography sx={{ fontSize: '0.9rem', color: 'text.secondary' }}>
                  Parsed rows: {bulkUploadRows.length}
                </Typography>
              )}
            </>
          )}
          {bulkUploadDialog.error && <Alert severity="error">{bulkUploadDialog.error}</Alert>}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseBulkUploadDialog} disabled={bulkUploadDialog.submitting}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleBulkUploadUsers}
            disabled={
              bulkUploadDialog.submitting ||
              mappedUnits.length === 0 ||
              bulkUploadRows.length === 0
            }
          >
            {bulkUploadDialog.submitting ? 'Uploading...' : 'Upload'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={bulkWarningDialogOpen}
        onClose={() => !bulkUploadDialog.submitting && setBulkWarningDialogOpen(false)}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>Non-organization Email IDs</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {bulkUploadDialog.nonOrgCount} non-organization email ids are found, if possible use company email for data security.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBulkWarningDialogOpen(false)} disabled={bulkUploadDialog.submitting}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={async () => {
              setBulkWarningDialogOpen(false)
              setBulkUploadDialog((prev) => ({ ...prev, confirmNonOrg: true }))
              await executeBulkUploadUsers()
            }}
            disabled={bulkUploadDialog.submitting}
          >
            Continue
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={bulkLogsDialogOpen}
        onClose={() => setBulkLogsDialogOpen(false)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Bulk Upload Logs</DialogTitle>
        <DialogContent dividers sx={{ display: 'flex', flexDirection: 'column', gap: 1.2, pt: 2.5 }}>
          {bulkUploadLogs.length === 0 ? (
            <Typography color="text.secondary">No logs available.</Typography>
          ) : (
            bulkUploadLogs.map((entry, index) => (
              <Box key={`${entry.message}-${index}`} sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                <Typography sx={{ fontSize: '0.95rem' }}>
                  {index + 1}. {entry.message}
                </Typography>
                {Array.isArray(entry.items) && entry.items.length > 0 ? (
                  <Typography sx={{ fontSize: '0.87rem', color: 'text.secondary', pl: 2.1 }}>
                    Email ID(s): {entry.items.join(', ')}
                  </Typography>
                ) : null}
              </Box>
            ))
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBulkLogsDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      <AppDialog
        open={approverDetailsDialog.open}
        onClose={() => setApproverDetailsDialog((prev) => ({ ...prev, open: false }))}
        title={approverDetailsDialog.approver ? (
          <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1.1, flexWrap: 'wrap', py: 1.5 }}>
            <Typography component="span" sx={{ fontSize: '1.1rem', fontWeight: 700, lineHeight: 1.25 }}>
              Approver Assignments
            </Typography>
            <Typography component="span" sx={{ color: 'text.secondary', fontSize: '0.92rem', fontWeight: 400, lineHeight: 1.25 }}>
              ({approverDetailsDialog.approver.email_id})
            </Typography>
          </Box>
        ) : 'Assign Approver'}
        titleId="company-co-approver-details-dialog-title"
        fullWidth
        maxWidth="md"
        showTitleDivider
        titleSx={{ py: 1.75 }}
        contentSx={{ py: 2.2 }}
        actions={(
          <Button onClick={() => setApproverDetailsDialog((prev) => ({ ...prev, open: false }))} variant="outlined" sx={getAppDialogCancelButtonSx(theme)}>
            Close
          </Button>
        )}
      >
        {approverDetailsDialog.loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 1.5 }}>
            <CircularProgress size={26} />
          </Box>
        ) : approverDetailsDialog.error ? (
          <Alert severity="error">{approverDetailsDialog.error}</Alert>
        ) : (
          <Box sx={{ mt: 1.5, py: 1.5 }}>
            <ApproverAssignmentsPanel
              key={approverDetailsDialog.approver?.email_id || 'none'}
              assignments={currentApproverAssignments}
            />
          </Box>
        )}
      </AppDialog>

      <AppDialog
        open={userUnitsDialog.open}
        onClose={() => {
          if (userUnitsDialog.linking) return
          setUserUnitsDialog({
            open: false,
            user: null,
            linkedUnitIds: [],
            selectedUnitIdsToAdd: [],
            linking: false,
            error: '',
          })
        }}
        title={userUnitsDialog.user ? (
          <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1.1, flexWrap: 'wrap', py: 1.5 }}>
            <Typography component="span" sx={{ fontSize: '1.1rem', fontWeight: 700, lineHeight: 1.25 }}>
              Linked Units
            </Typography>
            <Typography component="span" sx={{ color: 'text.secondary', fontSize: '0.92rem', fontWeight: 400, lineHeight: 1.25 }}>
              ({userUnitsDialog.user.email_id})
            </Typography>
          </Box>
        ) : 'Linked Units'}
        titleId="company-co-user-units-dialog-title"
        fullWidth
        maxWidth="md"
        showTitleDivider
        titleSx={{ py: 1.75 }}
        contentSx={{ py: 2.2, display: 'flex', flexDirection: 'column', gap: 2 }}
        actions={(
          <Button
            onClick={() => {
              if (userUnitsDialog.linking) return
              setUserUnitsDialog({
                open: false,
                user: null,
                linkedUnitIds: [],
                selectedUnitIdsToAdd: [],
                linking: false,
                error: '',
              })
            }}
            variant="outlined"
            disabled={userUnitsDialog.linking}
            sx={getAppDialogCancelButtonSx(theme)}
          >
            Close
          </Button>
        )}
      >
        <Box sx={{ mt: 1.5, py: 1.5 }}>
          <Typography sx={{ fontWeight: 700, mb: 1 }}>Current linked units</Typography>
          {userUnitsDialog.linkedUnitIds.length === 0 ? (
            <Typography color="text.secondary">No units linked.</Typography>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {userUnitsDialog.linkedUnitIds.map((unitId) => (
                <Box
                  key={unitId}
                  sx={{
                    px: 1.5,
                    py: 1.1,
                    borderRadius: 1.5,
                    border: '1px solid',
                    borderColor: 'divider',
                    backgroundColor: alpha(theme.palette.background.default, 0.35),
                  }}
                >
                  <Typography sx={{ fontWeight: 700 }}>
                    {unitOptions.find((unit) => unit.unitId === unitId)?.unitName || unitId}
                  </Typography>
                </Box>
              ))}
            </Box>
          )}
        </Box>

        <Box>
          <Typography sx={{ fontWeight: 700, mb: 1 }}>Link another unit</Typography>
          {availableUnitsToLink.length === 0 ? (
            <Typography color="text.secondary">
              This user is already linked to all units available under your coordinator assignment.
            </Typography>
          ) : (
            <>
              <FormControl fullWidth>
                <InputLabel id="link-user-units-label">Units</InputLabel>
                <Select
                  labelId="link-user-units-label"
                  multiple
                  value={userUnitsDialog.selectedUnitIdsToAdd}
                  label="Units"
                  disabled={userUnitsDialog.linking}
                  onChange={(event) => {
                    const nextValue = typeof event.target.value === 'string'
                      ? event.target.value.split(',')
                      : event.target.value
                    setUserUnitsDialog((prev) => ({
                      ...prev,
                      selectedUnitIdsToAdd: nextValue,
                      error: '',
                    }))
                  }}
                  renderValue={(selected) => getUnitNamesFromIds(Array.isArray(selected) ? selected : []).join(', ')}
                >
                  {availableUnitsToLink.map((unit) => (
                    <MenuItem key={unit.unitId} value={unit.unitId}>
                      <Checkbox checked={userUnitsDialog.selectedUnitIdsToAdd.includes(unit.unitId)} size="small" />
                      <ListItemText primary={unit.unitName} />
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
                <Button
                  variant="contained"
                  color="secondary"
                  disabled={userUnitsDialog.linking || userUnitsDialog.selectedUnitIdsToAdd.length === 0}
                  onClick={handleLinkUserUnits}
                  sx={{ textTransform: 'none', fontWeight: 700 }}
                >
                  {userUnitsDialog.linking ? 'Linking...' : 'Link Unit(s)'}
                </Button>
              </Box>
            </>
          )}
        </Box>

        {userUnitsDialog.error ? <Alert severity="error">{userUnitsDialog.error}</Alert> : null}
      </AppDialog>

      <Dialog
        open={deleteDialogOpen}
        onClose={() => !deletingUsers && setDeleteDialogOpen(false)}
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
            pb: 2,
            pt: 2.5,
            px: 3,
            fontWeight: 600,
            fontSize: '1.25rem',
            color: theme.palette.text.primary,
          }}
        >
          Confirm Delete
        </DialogTitle>
        <DialogContent sx={{ px: 3, pt: 2.25, pb: 2.25 }}>
          <DialogContentText
            id="delete-dialog-description"
            sx={{
              color: theme.palette.text.secondary,
              fontSize: '0.9375rem',
              lineHeight: 1.5,
              m: 0,
              mb: 1.5,
              mt: 1.5,
            }}
          >
            Deleting selected user(s) will remove them from the company and all assigned RACMs will go inactive. This action cannot be undone.
          </DialogContentText>
          {selectedUserEmails.size > 0 ? (
            <Box sx={{ mt: 1.5 }}>
              <Typography
                variant="body2"
                sx={{
                  color: theme.palette.text.primary,
                  fontWeight: 500,
                }}
              >
                Total number of user(s) selected: <strong>{selectedUserEmails.size}</strong>
              </Typography>
            </Box>
          ) : null}
        </DialogContent>
        <DialogActions
          sx={{
            px: 3,
            py: 2.25,
            gap: 1.5,
            borderTop: '1px solid',
            borderColor: 'divider',
          }}
        >
          <Button
            onClick={() => setDeleteDialogOpen(false)}
            variant="outlined"
            disabled={deletingUsers}
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
            variant="contained"
            color="error"
            disabled={selectedUserEmails.size === 0 || deletingUsers}
            autoFocus
            onClick={async () => {
              setDeletingUsers(true)
              try {
                const emailIds = Array.from(selectedUserEmails)
                const response = await fetch(apiUrl('/api/company-co/delete-users'), {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                  credentials: 'include',
                  body: JSON.stringify({ email_ids: emailIds }),
                })

                const data = await response.json()
                if (response.ok && data.success) {
                  toast.success(data.message || 'User(s) deleted successfully')
                  setSelectedUserEmails(new Set())
                  setDeleteDialogOpen(false)
                  setDeleteMode(false)
                  fetchUsers()
                } else {
                  toast.error(data.message || 'Failed to delete user(s)')
                }
              } catch (error) {
                console.error('Delete users error:', error)
                toast.error('Network error while deleting users')
              } finally {
                setDeletingUsers(false)
              }
            }}
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
            {deletingUsers ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

export default UserManagement 
