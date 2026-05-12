import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTheme } from '@mui/material/styles'
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Fab from '@mui/material/Fab';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import Autocomplete from '@mui/material/Autocomplete';
import Checkbox from '@mui/material/Checkbox';
import Radio from '@mui/material/Radio';
import RadioGroup from '@mui/material/RadioGroup';
import FormControlLabel from '@mui/material/FormControlLabel';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Divider from '@mui/material/Divider';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import HistoryRoundedIcon from '@mui/icons-material/HistoryRounded';
import InsertDriveFileRoundedIcon from '@mui/icons-material/InsertDriveFileRounded';
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded';
import { toast } from 'react-hot-toast'
import * as XLSX from 'xlsx'
import { FORM_DETAIL_MAX_WIDTH } from '../../uiConstants'
import { RACM_FIELD_LABELS, orderControlDetailKeys } from '../../racmFormDetailFields'
import { useSyncGlobalLoading } from '../../contexts/GlobalLoadingContext'
import { RacmAuditLogsDialog } from '../../components/racm/RacmAuditLogsDialog'
import { formatIndianDateTime } from '../../lib/dateTime'
import { apiUrl, API_BASE_URL } from '../../config/api'

const ASSIGNABLE_USER_INITIAL_LIMIT = 5
const ASSIGNABLE_USER_SEARCH_LIMIT = 50

function mergeAssignableUserIntoOptions(options, selectedEmail) {
  const email = (selectedEmail || '').trim()
  if (!email) return options
  const lower = email.toLowerCase()
  if (options.some((u) => (u.email_id || '').trim().toLowerCase() === lower)) {
    return options
  }
  return [...options, { email_id: email, emp_name: '' }]
}

function formatNameFromEmail(email) {
  const raw = String(email || '').trim().toLowerCase()
  if (!raw) return ''
  const localPart = raw.split('@')[0] || ''
  const parts = localPart
    .split('.')
    .map((part) => part.trim())
    .filter(Boolean)
  if (parts.length === 0) return ''
  return parts
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function FormDetail() {
  const theme = useTheme()
  const navigate = useNavigate()
  const { form_id } = useParams()
  const [formData, setFormData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [updating, setUpdating] = useState(false)
  const [createUserConfirmDialogOpen, setCreateUserConfirmDialogOpen] = useState(false)
  const [processOwnerEmail, setProcessOwnerEmail] = useState('')
  const [isEditMode, setIsEditMode] = useState(false)
  const [editableFields, setEditableFields] = useState({})
  const [saving, setSaving] = useState(false)
  const [uploadingSampling, setUploadingSampling] = useState(false)
  const [samplingExists, setSamplingExists] = useState(false)
  const [sampleDocsDialogOpen, setSampleDocsDialogOpen] = useState(false)
  const [userDocsDialogOpen, setUserDocsDialogOpen] = useState(false)
  const [deletingSampleDocId, setDeletingSampleDocId] = useState(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [moreActionsDialogOpen, setMoreActionsDialogOpen] = useState(false)
  const [replicateDialogOpen, setReplicateDialogOpen] = useState(false)
  const [replicateTargetFY, setReplicateTargetFY] = useState('')
  const [replicating, setReplicating] = useState(false)
  const [replicateSuccessDialogOpen, setReplicateSuccessDialogOpen] = useState(false)
  const [newReplicatedFormId, setNewReplicatedFormId] = useState('')
  const [creatingUser, setCreatingUser] = useState(false)
  const [scheduleFields, setScheduleFields] = useState({
    due_date: '',
    reminder_frequency: '',
    custom_days: ''
  })
  const [savingSchedule, setSavingSchedule] = useState(false)
  const fileInputRef = useRef(null)
  const [assignmentDialogOpen, setAssignmentDialogOpen] = useState(false)
  const [companyUsers, setCompanyUsers] = useState([])
  const [usersLoading, setUsersLoading] = useState(false)
  const [performerUserOptions, setPerformerUserOptions] = useState([])
  const [performerUsersLoading, setPerformerUsersLoading] = useState(false)
  const performerSearchDebounceRef = useRef(null)
  const [selectedUser, setSelectedUser] = useState(null)
  const [userSearchText, setUserSearchText] = useState('')
  const [processOwnerName, setProcessOwnerName] = useState('-')
  const [showScrollTop, setShowScrollTop] = useState(false)
  const [auditLogOpen, setAuditLogOpen] = useState(false)
  const [auditLogLoading, setAuditLogLoading] = useState(false)
  const [auditLogError, setAuditLogError] = useState(null)
  const [auditLogRows, setAuditLogRows] = useState([])
  const [activeChangeRequest, setActiveChangeRequest] = useState(null)
  const [activeChangeRequestLoading, setActiveChangeRequestLoading] = useState(false)
  const [suggestedChangesDialogOpen, setSuggestedChangesDialogOpen] = useState(false)
  const [reviewDecisions, setReviewDecisions] = useState({})
  const [reviewSaving, setReviewSaving] = useState(false)
  const [changeRequestHistory, setChangeRequestHistory] = useState([])
  const [changeRequestHistoryCount, setChangeRequestHistoryCount] = useState(0)
  const [changeRequestHistoryLoading, setChangeRequestHistoryLoading] = useState(false)
  const [changeRequestHistoryDialogOpen, setChangeRequestHistoryDialogOpen] = useState(false)
  const [expandedHistoryRequestIds, setExpandedHistoryRequestIds] = useState({})
  const [deficiencyResponseForm, setDeficiencyResponseForm] = useState({
    response_type: 'mitigation_plan',
    explaination: '',
    concerned_person: '',
    due_date: '',
  })
  const [deficiencyResponseFiles, setDeficiencyResponseFiles] = useState([])
  const [deficiencyResponseSubmitting, setDeficiencyResponseSubmitting] = useState(false)
  const assertionFields = ['completeness', 'existence_occurrence', 'valuation_and_allocation', 'rights_and_obligation', 'presentation_and_disclosure']

  useSyncGlobalLoading(
    loading ||
    updating ||
    saving ||
    uploadingSampling ||
    Boolean(deletingSampleDocId) ||
    deleting ||
    replicating ||
    creatingUser ||
    savingSchedule ||
    usersLoading ||
    activeChangeRequestLoading ||
    reviewSaving ||
    changeRequestHistoryLoading ||
    deficiencyResponseSubmitting
  )

  useEffect(() => {
    const onScroll = () => {
      setShowScrollTop(window.scrollY > 300)
    }

    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    fetchFormData()
  }, [form_id])

  useEffect(() => {
    if (!formData?.pending_changes) {
      setActiveChangeRequest(null)
      setReviewDecisions({})
      return
    }

    fetchActiveChangeRequest()
  }, [formData?.pending_changes, form_id])

  useEffect(() => {
    fetchChangeRequestHistory()
  }, [form_id])

  const fetchFormData = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`${API_BASE_URL}/api/control-forms/${form_id}`, {
        method: 'GET',
        credentials: 'include',
      })

      const data = await response.json()

      if (response.ok && data.success) {
        setFormData(data.data)
        // Check if sampling document exists
        const samplingCheck = await checkSamplingExists()
        setSamplingExists(samplingCheck)
        const currentDeficiencySubmission = data.data?.deficiency_response?.current_submission
        setDeficiencyResponseForm({
          response_type: currentDeficiencySubmission?.submission_type || data.data?.deficiency_response?.response_type || 'mitigation_plan',
          explaination: currentDeficiencySubmission?.explaination || data.data?.deficiency_response?.explaination || '',
          concerned_person: currentDeficiencySubmission?.concerned_person || data.data?.deficiency_response?.concerned_person || '',
          due_date: currentDeficiencySubmission?.due_date
            ? String(currentDeficiencySubmission.due_date).slice(0, 10)
            : data.data?.deficiency_response?.due_date
              ? String(data.data.deficiency_response.due_date).slice(0, 10)
              : '',
        })
        setDeficiencyResponseFiles([])
      } else {
        setError(data.message || 'Failed to fetch form data')
      }
    } catch (error) {
      console.error('Error fetching form data:', error)
      setError('Error fetching form data')
    } finally {
      setLoading(false)
    }
  }

  const fetchActiveChangeRequest = async () => {
    if (!form_id) return null
    setActiveChangeRequestLoading(true)
    try {
      const response = await fetch(`${API_BASE_URL}/api/control-forms/${form_id}/change-request/active`, {
        method: 'GET',
        credentials: 'include',
      })
      const data = await response.json()

      if (response.ok && data.success) {
        setActiveChangeRequest(data.data)
        const nextDecisions = {}
        const items = Array.isArray(data.data?.items) ? data.data.items : []
        items.forEach((item) => {
          nextDecisions[item.id] = {
            status: '',
            rejection_reason: '',
          }
        })
        setReviewDecisions(nextDecisions)
        return data.data
      }

      setActiveChangeRequest(null)
      setReviewDecisions({})
      return null
    } catch (error) {
      console.error('Error fetching active change request:', error)
      setActiveChangeRequest(null)
      setReviewDecisions({})
      return null
    } finally {
      setActiveChangeRequestLoading(false)
    }
  }

  const fetchChangeRequestHistory = async () => {
    if (!form_id) return []
    setChangeRequestHistoryLoading(true)
    try {
      const response = await fetch(`${API_BASE_URL}/api/control-forms/${form_id}/change-request/history`, {
        method: 'GET',
        credentials: 'include',
      })
      const data = await response.json()

      if (response.ok && data.success) {
        const requests = Array.isArray(data.data?.requests) ? data.data.requests : []
        setChangeRequestHistory(requests)
        setChangeRequestHistoryCount(Number(data.data?.count || requests.length || 0))
        return requests
      }

      setChangeRequestHistory([])
      setChangeRequestHistoryCount(0)
      return []
    } catch (error) {
      console.error('Error fetching change request history:', error)
      setChangeRequestHistory([])
      setChangeRequestHistoryCount(0)
      return []
    } finally {
      setChangeRequestHistoryLoading(false)
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
      return { exists: !!data.exists, role: data.role ?? null, unit_id: data.unit_id ?? null }
    } catch (error) {
      console.error('Error checking user role:', error)
      return { exists: false, role: null }
    }
  }

  const normalizeRole = (value) => String(value || '').trim().toLowerCase()

  const handleToggleActive = async () => {
    if (!formData) return

    // Determine new active status
    const isCurrentlyActive = Boolean(formData?.active)
    const newActiveStatus = isCurrentlyActive ? '0' : '1'

    await validateAndToggleActive(newActiveStatus)
  }

  const validateAndToggleActive = async (newActiveStatus) => {
    // Only validate when setting to active
    if (newActiveStatus === '1') {
      // Check if required fields are empty
      const dueDate = formData.due_date?.trim()
      const reminderFrequency = formData.reminder_frequency?.trim()
      const processOwnerEmailValue = formData.control_owner?.trim()

      // 1) If process owner is missing, show assignment message regardless of other fields
      if (!processOwnerEmailValue || processOwnerEmailValue === '') {
        toast.error('RACM Assignment is remaining')
        return
      }

      // 2/3) Validate process owner existence and role before reminder fields,
      // matching RACM Management gating precedence for Set Active.
      if (processOwnerEmailValue) {
        const ownerCheck = await checkUserRole(processOwnerEmailValue)

        // Case 3: email not found -> prompt to create user
        if (!ownerCheck.exists) {
          setProcessOwnerEmail(processOwnerEmailValue)
          setCreateUserConfirmDialogOpen(true)
          return
        }

        // Case 2: email exists but role is not 'user' -> block activation
        if (normalizeRole(ownerCheck.role) !== 'user') {
          toast.error('Process Owner must be a normal user')
          return
        }

        const racmUnitId = formData?.unit_id ? String(formData.unit_id).trim() : ''
        const ownerUnitId = ownerCheck.unit_id ? String(ownerCheck.unit_id).trim() : ''
        if (racmUnitId && ownerUnitId && racmUnitId !== ownerUnitId) {
          toast.error('User belongs to other unit of the company, Please assign RACM to other user')
          return
        }
      }

      // 4) If process owner is valid but reminder settings are missing, block activation
      if (!dueDate || dueDate === '' || !reminderFrequency || reminderFrequency === '') {
        toast.error('Configure Reminder settings')
        return
      }
    }

    if (newActiveStatus === '1' && !hasSampleDocs()) {
      toast('Sample document is missing. Proceeding to set Active.')
    }

    // Proceed with setting active/inactive
    await performToggleActive(newActiveStatus)
  }

  const performToggleActive = async (newActiveStatus) => {
    setUpdating(true)
    try {
      const response = await fetch(`${API_BASE_URL}/api/control-forms/${form_id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          active: newActiveStatus
        }),
      })

      const data = await response.json()

      if (response.ok && data.success) {
        const normalizedActive = newActiveStatus === '1'
        // Update local state
        setFormData({
          ...formData,
          active: normalizedActive
        })
        const statusMessage = newActiveStatus === '1'
          ? 'RACM set to Active successfully'
          : 'RACM set to Inactive successfully'
        toast.success(statusMessage)
      } else {
        console.error('Error updating form:', data.message)
        toast.error('Failed to update form status: ' + (data.message || 'Unknown error'))
      }
    } catch (error) {
      console.error('Error updating form:', error)
      toast.error('Error updating form status')
    } finally {
      setUpdating(false)
    }
  }

  const handleCreateUserConfirm = async () => {
    const email = (processOwnerEmail || '').trim()
    const unitId = formData?.unit_id ? String(formData.unit_id).trim() : ''
    if (!email) {
      toast.error('Process owner email is missing')
      return
    }

    if (!unitId) {
      toast.error('RACM unit is missing. Cannot create user for assignment.')
      return
    }

    setCreatingUser(true)
    try {
      const response = await fetch(apiUrl('/api/company-co/create-user'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          email_id: email,
          unit_id: unitId,
        }),
      })

      const data = await response.json()
      if (response.ok && data.success) {
        toast.success('User created successfully')
        setCreateUserConfirmDialogOpen(false)
        setProcessOwnerEmail('')
        await validateAndToggleActive('1')
      } else {
        toast.error(data.message || 'Failed to create user')
      }
    } catch (error) {
      console.error('Error creating user:', error)
      toast.error('Failed to create user')
    } finally {
      setCreatingUser(false)
    }
  }

  const handleCreateUserCancel = () => {
    if (creatingUser) return
    setCreateUserConfirmDialogOpen(false)
    setProcessOwnerEmail('')
  }

  const handleModifyClick = () => {
    // Check if status allows editing (must be empty/null or 'Rejected')
    const status = formData?.status
    const canEdit = !status || status === '' || status === null || status === 'Rejected'

    if (!canEdit) {
      toast.error('Form cannot be modified.')
      return
    }

    // Initialize editable fields with current form data (exclude approver-only fields)
    const initialFields = {}
    fieldOrder.forEach(key => {
      if (!excludedFields.includes(key) && key !== 'doc_uploaded_by_user' && !approverOnlyFields.includes(key)) {
        if (assertionFields.includes(key)) {
          initialFields[key] = formData[key] === true || formData[key] === 'true' || formData[key] === '1' || formData[key] === 1
        } else {
          initialFields[key] = formData[key] ?? ''
        }
      }
    })
    setEditableFields(initialFields)
    setIsEditMode(true)
  }

  const handleCancelEdit = () => {
    setIsEditMode(false)
    // Reset editable fields to original form data (exclude approver-only fields)
    const initialFields = {}
    fieldOrder.forEach(key => {
      if (!excludedFields.includes(key) && key !== 'doc_uploaded_by_user' && !approverOnlyFields.includes(key)) {
        if (assertionFields.includes(key)) {
          initialFields[key] = formData[key] === true || formData[key] === 'true' || formData[key] === '1' || formData[key] === 1
        } else {
          initialFields[key] = formData[key] ?? ''
        }
      }
    })
    setEditableFields(initialFields)
  }

  const handleFieldChange = (field, value) => {
    setEditableFields(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const formatDateForInput = (dateValue) => {
    if (!dateValue) return ''
    // Keep plain date strings as-is; convert zoned timestamps to IST calendar date.
    if (typeof dateValue === 'string') {
      const trimmed = dateValue.trim()
      if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
        return trimmed
      }
    }
    const date = new Date(dateValue)
    if (Number.isNaN(date.getTime())) return ''
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(date)
    const get = (type) => parts.find((p) => p.type === type)?.value || ''
    const y = get('year')
    const mm = get('month')
    const dd = get('day')
    return `${y}-${mm}-${dd}`
  }

  const getTomorrowDateString = () => {
    const now = new Date()
    const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
    const y = tomorrow.getFullYear()
    const mm = String(tomorrow.getMonth() + 1).padStart(2, '0')
    const dd = String(tomorrow.getDate()).padStart(2, '0')
    return `${y}-${mm}-${dd}`
  }

  const parseReminderFrequency = (value) => {
    const frequency = String(value || '').trim()

    if (['Daily', 'Weekly', 'Monthly'].includes(frequency)) {
      return {
        reminder_frequency: frequency,
        custom_days: ''
      }
    }

    return {
      reminder_frequency: '',
      custom_days: ''
    }
  }

  const handleScheduleFieldChange = (field, value) => {
    setScheduleFields((prev) => ({
      ...prev,
      [field]: value
    }))
  }

  const handleSaveSchedule = async () => {
    if (Boolean(formData?.active)) {
      toast.error('Reminder settings cannot be changed once RACM is Active')
      return
    }

    const dueDateValue = scheduleFields.due_date ? scheduleFields.due_date.trim() : ''
    const frequencySelection = scheduleFields.reminder_frequency
    const tomorrow = getTomorrowDateString()

    if (!dueDateValue) {
      toast.error('Please select a due date')
      return
    }

    if (dueDateValue < tomorrow) {
      toast.error('Due date must be a future date')
      return
    }

    if (!frequencySelection) {
      toast.error('Please select reminder frequency')
      return
    }

    const reminderFrequencyValue = frequencySelection

    setSavingSchedule(true)
    try {
      const response = await fetch(`${API_BASE_URL}/api/control-forms/${form_id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          due_date: dueDateValue,
          reminder_frequency: reminderFrequencyValue,
          modifiedFields: ['due_date', 'reminder_frequency'],
        }),
      })

      const data = await response.json()
      if (response.ok && data.success) {
        setFormData((prev) => ({
          ...prev,
          due_date: dueDateValue,
          reminder_frequency: reminderFrequencyValue,
        }))
        toast.success('Reminder settings updated successfully')
      } else {
        toast.error(data.message || 'Failed to update reminder settings')
      }
    } catch (err) {
      console.error('Error updating reminder settings:', err)
      toast.error('Error updating reminder settings')
    } finally {
      setSavingSchedule(false)
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

  const fetchPerformerAssignableUsers = useCallback(async ({ q = '', limit = ASSIGNABLE_USER_INITIAL_LIMIT } = {}) => {
    setPerformerUsersLoading(true)
    try {
      const params = new URLSearchParams({
        role: 'user',
        limit: String(limit),
      })
      const trimmedQ = String(q || '').trim()
      if (trimmedQ) {
        params.set('q', trimmedQ)
      }
      const response = await fetch(
        `${API_BASE_URL}/api/company-co/users?${params.toString()}`,
        {
          method: 'GET',
          credentials: 'include',
        }
      )
      const data = await response.json()
      if (response.ok && data.success) {
        setPerformerUserOptions(Array.isArray(data.users) ? data.users : [])
      } else {
        setPerformerUserOptions([])
      }
    } catch (error) {
      console.error('Error fetching users for control performer:', error)
      setPerformerUserOptions([])
    } finally {
      setPerformerUsersLoading(false)
    }
  }, [])

  const assignableUsers = companyUsers.filter((user) => {
    const formCompany = (formData?.company_identifier || '').trim()
    const userCompany = (user.company_identifier || '').trim()
    const formUnitId = (formData?.unit_id || '').trim()
    const userUnitId = (user.unit_id || '').trim()
    const isSameCompany = !userCompany || userCompany === formCompany
    const isSameUnit = formUnitId && userUnitId && userUnitId === formUnitId
    return isSameCompany && isSameUnit && user.role === 'user'
  })

  const handleOpenAssignmentDialog = async () => {
    if (Boolean(formData?.active)) {
      toast.error('RACM assignment cannot be changed once RACM is Active')
      return
    }

    setSelectedUser(null)
    setUserSearchText('')
    setAssignmentDialogOpen(true)

    if (companyUsers.length === 0) {
      await fetchCompanyUsers()
    }
  }

  const handleCloseAssignmentDialog = () => {
    if (updating) return
    setAssignmentDialogOpen(false)
    setSelectedUser(null)
    setUserSearchText('')
  }

  const handleUpdateAssignment = async () => {
    if (Boolean(formData?.active)) {
      toast.error('RACM assignment cannot be changed once RACM is Active')
      return
    }

    if (!form_id || !selectedUser?.email_id) return

    const hasDueDate = Boolean((formData?.due_date || '').toString().trim())
    const hasReminderFrequency =
      formData?.reminder_frequency !== null &&
      formData?.reminder_frequency !== undefined &&
      String(formData.reminder_frequency).trim() !== ''
    const hasReminderSettings = hasDueDate && hasReminderFrequency
    const hasSampleDoc = hasSampleDocs()
    const canAutoActivate = hasReminderSettings

    setUpdating(true)
    try {
      const response = await fetch(`${API_BASE_URL}/api/control-forms/${form_id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          control_owner: selectedUser.email_id,
          ...(canAutoActivate ? { active: '1' } : {}),
          modifiedFields: ['control_owner'],
        }),
      })

      const data = await response.json()
      if (response.ok && data.success) {
        toast.success('Sucessfully Updated RACM Assignment')
        if (canAutoActivate && !hasSampleDoc) {
          toast('Sample document is missing. RACM was set Active.')
        }
        if (!canAutoActivate) {
          const missing = []
          if (!hasReminderSettings) missing.push('Reminder settings')
          toast.error(`RACM assigned, but could not set Active. Missing: ${missing.join(', ')}`)
        }
        handleCloseAssignmentDialog()
        fetchFormData()
      } else {
        toast.error(data.message || 'Failed to update RACM assignment')
      }
    } catch (error) {
      console.error('Error updating assignment:', error)
      toast.error('Failed to update RACM assignment')
    } finally {
      setUpdating(false)
    }
  }

  // Ensure company users are loaded for control_owner / control_performer name lookup
  useEffect(() => {
    const needNames =
      (formData?.control_owner && String(formData.control_owner).trim() !== '') ||
      (formData?.control_performer && String(formData.control_performer).trim() !== '')
    if (needNames && companyUsers.length === 0) {
      fetchCompanyUsers()
    }
  }, [formData?.control_owner, formData?.control_performer]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!isEditMode) return
    fetchPerformerAssignableUsers({ q: '', limit: ASSIGNABLE_USER_INITIAL_LIMIT })
  }, [isEditMode, fetchPerformerAssignableUsers])

  useEffect(() => {
    return () => {
      if (performerSearchDebounceRef.current) {
        clearTimeout(performerSearchDebounceRef.current)
      }
    }
  }, [])

  // Derive process owner display name from company users using email_id
  useEffect(() => {
    const email = (formData?.control_owner || '').trim().toLowerCase()
    if (!email) {
      setProcessOwnerName('-')
      return
    }
    const match = companyUsers.find(
      (user) => (user.email_id || '').trim().toLowerCase() === email
    )
    if (match && match.emp_name) {
      setProcessOwnerName(match.emp_name)
    } else {
      setProcessOwnerName('-')
    }
  }, [formData?.control_owner, companyUsers])

  const handleSaveChanges = async () => {
    // Check status again before saving
    const status = formData?.status
    const canEdit = !status || status === '' || status === null || status === 'Rejected'

    if (!canEdit) {
      toast.error('Form cannot be modified.')
      setIsEditMode(false)
      return
    }

    // Track modified fields by comparing original formData with editableFields
    const modifiedFields = []
    const modifiedChanges = []
    const changedFieldsPayload = {}
    fieldOrder.forEach(key => {
      if (!excludedFields.includes(key) && key !== 'doc_uploaded_by_user' && !approverOnlyFields.includes(key)) {
        const originalValue = assertionFields.includes(key)
          ? (formData[key] === true || formData[key] === 'true' || formData[key] === '1' || formData[key] === 1)
          : (formData[key] ?? '')
        const newValue = assertionFields.includes(key)
          ? (editableFields[key] === true || editableFields[key] === 'true' || editableFields[key] === '1' || editableFields[key] === 1)
          : (editableFields[key] ?? '')

        // Compare values (convert to string for comparison)
        if (String(originalValue).trim() !== String(newValue).trim()) {
          const payloadValue = assertionFields.includes(key)
            ? !!newValue
            : (newValue === '' ? null : newValue)

          changedFieldsPayload[key] = payloadValue
          modifiedFields.push(key)
          modifiedChanges.push({
            column_name: key,
            old_value: originalValue === '' ? null : originalValue,
            new_value: payloadValue
          })
        }
      }
    })

    if (modifiedFields.length === 0) {
      toast.error('No changes to save')
      return
    }

    setSaving(true)
    try {
      const response = await fetch(`${API_BASE_URL}/api/control-forms/${form_id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          ...changedFieldsPayload,
          modifiedFields: modifiedFields, // Backward-compatible metadata
          modifiedChanges: modifiedChanges // [{ column_name, old_value, new_value }, ...]
        }),
      })

      const data = await response.json()

      if (response.ok && data.success) {
        toast.success('Form updated successfully')
        setIsEditMode(false)
        // Refresh form data
        fetchFormData()
      } else {
        toast.error(data.message || 'Failed to update form')
      }
    } catch (error) {
      console.error('Error updating form:', error)
      toast.error('Error updating form')
    } finally {
      setSaving(false)
    }
  }

  const formatDateTime = (dateString) => formatIndianDateTime(dateString, 'N/A')

  const handleOpenAuditLogs = async () => {
    setAuditLogOpen(true)
    setAuditLogLoading(true)
    setAuditLogError(null)
    setAuditLogRows([])
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/company-co/racm-audit-logs/${encodeURIComponent(form_id)}`,
        { method: 'GET', credentials: 'include' }
      )
      const data = await response.json()
      if (!response.ok || !data.success) {
        setAuditLogError(data.message || 'Failed to load audit logs')
        return
      }
      setAuditLogRows(Array.isArray(data.data) ? data.data : [])
    } catch (e) {
      console.error('Audit logs fetch error:', e)
      setAuditLogError('Failed to load audit logs')
    } finally {
      setAuditLogLoading(false)
    }
  }

  const handleOpenSuggestedChangesDialog = async () => {
    if (!activeChangeRequest) {
      const request = await fetchActiveChangeRequest()
      if (!request) {
        toast.error('No active suggested changes found')
        return
      }
    }
    setSuggestedChangesDialogOpen(true)
  }

  const handleCloseSuggestedChangesDialog = () => {
    if (reviewSaving) return
    setSuggestedChangesDialogOpen(false)
  }

  const handleReviewDecisionChange = (itemId, field, value) => {
    setReviewDecisions((prev) => ({
      ...prev,
      [itemId]: {
        ...(prev[itemId] || {}),
        [field]: value,
      },
    }))
  }

  const handleSubmitSuggestedChangesReview = async () => {
    const items = Array.isArray(activeChangeRequest?.items) ? activeChangeRequest.items : []
    if (!activeChangeRequest?.request_id || items.length === 0) {
      toast.error('No active suggested changes found')
      return
    }

    const payloadItems = []
    for (const item of items) {
      const decision = reviewDecisions[item.id] || {}
      const status = String(decision.status || '').trim()
      if (status !== 'Approved' && status !== 'Rejected') {
        toast.error('Approve or reject every field before submitting')
        return
      }

      payloadItems.push({
        id: item.id,
        status,
        rejection_reason:
          status === 'Rejected'
            ? String(decision.rejection_reason || '').trim()
            : '',
      })
    }

    setReviewSaving(true)
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/control-forms/${form_id}/change-request/${encodeURIComponent(activeChangeRequest.request_id)}/review`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({
            items: payloadItems,
          }),
        }
      )
      const data = await response.json()

      if (response.ok && data.success) {
        toast.success('Suggested changes reviewed successfully')
        setSuggestedChangesDialogOpen(false)
        setActiveChangeRequest(null)
        setReviewDecisions({})
        fetchFormData()
      } else {
        toast.error(data.message || 'Failed to review suggested changes')
      }
    } catch (error) {
      console.error('Error reviewing suggested changes:', error)
      toast.error('Failed to review suggested changes')
    } finally {
      setReviewSaving(false)
    }
  }

  const handleOpenChangeRequestHistoryDialog = async () => {
    if (changeRequestHistory.length === 0) {
      await fetchChangeRequestHistory()
    }
    setChangeRequestHistoryDialogOpen(true)
  }

  const handleCloseChangeRequestHistoryDialog = () => {
    setChangeRequestHistoryDialogOpen(false)
  }

  const handleToggleHistoryRequest = (requestId) => {
    setExpandedHistoryRequestIds((prev) => ({
      ...prev,
      [requestId]: !prev[requestId],
    }))
  }

  const formatStatus = (status) => {
    if (!status || status === '' || status === null) {
      return '-'
    }

    if (status === 'Approved') {
      return 'Approved'
    }

    if (status === 'Rejected') {
      return 'Rejected'
    }

    return status.charAt(0).toUpperCase() + status.slice(1)
  }

  const formatDateOnly = (dateString) => {
    if (!dateString) return '-'
    const date = new Date(dateString)
    if (Number.isNaN(date.getTime())) return '-'
    return date.toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: 'Asia/Kolkata',
    })
  }

  const getFileName = (filePath) => {
    if (!filePath) return ''
    const parts = String(filePath).split(/[/\\]/)
    return parts[parts.length - 1] || String(filePath)
  }

  const handleDeficiencyResponseFieldChange = (field, value) => {
    setDeficiencyResponseForm((current) => ({
      ...current,
      [field]: value,
    }))
  }

  const handleDeficiencyResponseFileSelect = (e) => {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return
    setDeficiencyResponseFiles((currentFiles) => [...currentFiles, ...files])
    e.target.value = ''
  }

  const handleRemoveDeficiencyResponseFile = (indexToRemove) => {
    setDeficiencyResponseFiles((currentFiles) =>
      currentFiles.filter((_, index) => index !== indexToRemove)
    )
  }

  const handleSubmitDeficiencyResponse = async () => {
    const responseType = String(deficiencyResponseForm.response_type || '').trim()
    const explaination = String(deficiencyResponseForm.explaination || '').trim()
    const concernedPerson = String(deficiencyResponseForm.concerned_person || '').trim()
    const dueDate = String(deficiencyResponseForm.due_date || '').trim()

    if (!explaination) {
      toast.error('Explaination is required')
      return
    }

    if (responseType === 'mitigation_plan') {
      if (!concernedPerson) {
        toast.error('Concerned Person is required for mitigation plan')
        return
      }
      if (!dueDate) {
        toast.error('Due date is required for mitigation plan')
        return
      }
    }

    if (responseType === 'compensatory_racm' && deficiencyResponseFiles.length === 0) {
      toast.error('Please upload at least one document for compensatory RACM')
      return
    }

    setDeficiencyResponseSubmitting(true)
    try {
      let attachments = []

      if (deficiencyResponseFiles.length > 0) {
        const uploadFormData = new FormData()
        deficiencyResponseFiles.forEach((file) => {
          uploadFormData.append('documents', file)
        })

        const uploadResponse = await fetch(`${API_BASE_URL}/api/control-forms/${form_id}/deficiency-response/upload-attachments`, {
          method: 'POST',
          credentials: 'include',
          body: uploadFormData,
        })
        const uploadData = await uploadResponse.json()
        if (!uploadResponse.ok || !uploadData.success) {
          toast.error(uploadData.message || 'Failed to upload deficiency response documents')
          return
        }
        attachments = Array.isArray(uploadData.data?.attachments) ? uploadData.data.attachments : []
      }

      const response = await fetch(`${API_BASE_URL}/api/control-forms/${form_id}/deficiency-response`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          response_type: responseType,
          explaination,
          concerned_person: responseType === 'mitigation_plan' ? concernedPerson : '',
          due_date: responseType === 'mitigation_plan' ? dueDate : '',
          attachments,
        }),
      })

      const data = await response.json()
      if (response.ok && data.success) {
        toast.success('Deficiency response submitted successfully')
        setFormData((currentFormData) => ({
          ...(currentFormData || {}),
          ...(data.data || {}),
          deficiency_action_status: false,
          deficiency_response_status: 'submitted_for_review',
        }))
        setDeficiencyResponseFiles([])
        const currentDeficiencySubmission = data.data?.deficiency_response?.current_submission
        setDeficiencyResponseForm({
          response_type: currentDeficiencySubmission?.submission_type || data.data?.deficiency_response?.response_type || responseType,
          explaination: currentDeficiencySubmission?.explaination || data.data?.deficiency_response?.explaination || explaination,
          concerned_person: currentDeficiencySubmission?.concerned_person || data.data?.deficiency_response?.concerned_person || '',
          due_date: currentDeficiencySubmission?.due_date
            ? String(currentDeficiencySubmission.due_date).slice(0, 10)
            : '',
        })
      } else {
        toast.error(data.message || 'Failed to submit deficiency response')
      }
    } catch (error) {
      console.error('Error submitting deficiency response:', error)
      toast.error('Error submitting deficiency response')
    } finally {
      setDeficiencyResponseSubmitting(false)
    }
  }

  const getSampleDocs = () => {
    const docs = Array.isArray(formData?.sample_docs)
      ? formData.sample_docs
      : []
    const normalizedDocs = docs
      .map((doc, index) => ({
        id: doc.id || `sample-doc-${index}`,
        sample_doc: doc.sample_doc,
        created_at: doc.created_at,
      }))
      .filter((doc) => String(doc.sample_doc || '').trim() !== '')

    if (normalizedDocs.length > 0) return normalizedDocs

    const legacyDoc = String(formData?.sample_doc || '').trim()
    return legacyDoc
      ? [{ id: 'sample-doc-current', sample_doc: legacyDoc, created_at: null }]
      : []
  }

  const getUserDocs = () => {
    const docs = Array.isArray(formData?.doc_uploaded_by_user_docs)
      ? formData.doc_uploaded_by_user_docs
      : []
    const normalizedDocs = docs
      .map((doc, index) => ({
        id: doc.id || `user-doc-${index}`,
        doc_uploaded_by_user: doc.doc_uploaded_by_user,
        created_at: doc.created_at,
      }))
      .filter((doc) => String(doc.doc_uploaded_by_user || '').trim() !== '')

    if (normalizedDocs.length > 0) return normalizedDocs

    const legacyDoc = String(formData?.doc_uploaded_by_user || '').trim()
    return legacyDoc
      ? [{ id: 'user-doc-current', doc_uploaded_by_user: legacyDoc, created_at: null }]
      : []
  }

  const hasSampleDocs = () => getSampleDocs().length > 0

  const checkSamplingExists = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/control-forms/${form_id}/check-sampling-exists`, {
        method: 'GET',
        credentials: 'include',
      })

      const data = await response.json()

      if (response.ok && data.success) {
        return data.exists
      }
      return false
    } catch (error) {
      console.error('Error checking sampling document:', error)
      return false
    }
  }

  const handleOpenSampleDocsDialog = () => {
    setSampleDocsDialogOpen(true)
  }

  const handleCloseSampleDocsDialog = () => {
    if (uploadingSampling || deletingSampleDocId) return
    setSampleDocsDialogOpen(false)
  }

  const handleOpenUserDocsDialog = () => {
    setUserDocsDialogOpen(true)
  }

  const handleCloseUserDocsDialog = () => {
    setUserDocsDialogOpen(false)
  }

  const handleSamplingUploadClick = () => {
    fileInputRef.current?.click()
  }

  const handleSamplingFileChange = async (e) => {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return

    // Validate file type
    const validTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      'application/vnd.ms-excel', // .xls
    ]

    const hasInvalidType = files.some((file) => {
      const fileName = String(file.name || '').toLowerCase()
      return !validTypes.includes(file.type) && !fileName.endsWith('.xlsx') && !fileName.endsWith('.xls')
    })
    if (hasInvalidType) {
      toast.error('Invalid file type. Please upload only Excel files (.xlsx, .xls)')
      return
    }

    // Validate file size (10MB limit)
    const hasOversizedFile = files.some((file) => file.size > 10 * 1024 * 1024)
    if (hasOversizedFile) {
      toast.error('Each file must be 10MB or smaller.')
      return
    }

    await handleSamplingUpload(files)
  }

  const handleSamplingUpload = async (files) => {
    const selectedFiles = Array.isArray(files) ? files : [files].filter(Boolean)
    if (selectedFiles.length === 0) {
      toast.error('Please select at least one file')
      return
    }

    setUploadingSampling(true)
    try {
      const uploadFormData = new FormData()
      selectedFiles.forEach((file) => {
        uploadFormData.append('excelFiles', file)
      })

      const response = await fetch(`${API_BASE_URL}/api/control-forms/${form_id}/upload-sampling-excel`, {
        method: 'POST',
        credentials: 'include',
        body: uploadFormData,
      })

      const data = await response.json()

      if (response.ok && data.success) {
        const uploadedDocs = Array.isArray(data.data?.sample_docs) ? data.data.sample_docs : []
        toast.success(`${uploadedDocs.length || selectedFiles.length} sample document(s) uploaded successfully`)
        if (fileInputRef.current) {
          fileInputRef.current.value = ''
        }
        setFormData(prev => ({
          ...prev,
          sample_doc: data.data?.sample_doc || prev?.sample_doc || uploadedDocs[0]?.sample_doc || 'uploaded',
          sample_docs: [
            ...(Array.isArray(prev?.sample_docs) ? prev.sample_docs : []),
            ...uploadedDocs,
          ],
        }))
        setSamplingExists(true)
        fetchFormData()
      } else {
        toast.error(data.message || 'Failed to upload sampling Excel file')
        if (fileInputRef.current) {
          fileInputRef.current.value = ''
        }
      }
    } catch (error) {
      console.error('Error uploading sampling Excel file:', error)
      toast.error('Error uploading sampling Excel file')
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    } finally {
      setUploadingSampling(false)
    }
  }

  const handleDownloadSampleDocument = async (filePath) => {
    if (!filePath) return

    try {
      const fileName = getFileName(filePath)
      const response = await fetch(`${API_BASE_URL}/api/control-forms/download-document?path=${encodeURIComponent(filePath)}`, {
        method: 'GET',
        credentials: 'include',
      })

      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = fileName
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
        toast.success('Sample document downloaded successfully')
        return
      }

      let errorMessage = 'Failed to download sample document'
      try {
        const errorData = await response.json()
        errorMessage = errorData.message || errorData.error || errorMessage
      } catch (e) {
        errorMessage = `Download failed with status ${response.status}`
      }
      toast.error(errorMessage)
    } catch (error) {
      console.error('Error downloading sample document:', error)
      toast.error(`Error downloading sample document: ${error.message}`)
    }
  }

  const handleDownloadUserDocument = async (filePath) => {
    if (!filePath) return

    try {
      const fileName = getFileName(filePath)
      const response = await fetch(`${API_BASE_URL}/api/control-forms/download-document?path=${encodeURIComponent(filePath)}`, {
        method: 'GET',
        credentials: 'include',
      })

      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = fileName
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
        return
      }

      let errorMessage = 'Failed to download user document'
      try {
        const errorData = await response.json()
        errorMessage = errorData.message || errorData.error || errorMessage
      } catch (e) {
        errorMessage = `Download failed with status ${response.status}`
      }
      toast.error(errorMessage)
    } catch (error) {
      console.error('Error downloading user document:', error)
      toast.error(`Error downloading user document: ${error.message}`)
    }
  }

  const handleDeleteSampleDocument = async (doc) => {
    const docId = doc?.id
    const fileName = getFileName(doc?.sample_doc)
    if (!docId || String(docId).startsWith('sample-doc-')) {
      toast.error('Sample document row id is missing')
      return
    }

    const confirmed = window.confirm(`Delete sample document "${fileName}" permanently?`)
    if (!confirmed) return

    setDeletingSampleDocId(docId)
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/control-forms/${form_id}/sample-docs/${encodeURIComponent(docId)}`,
        {
          method: 'DELETE',
          credentials: 'include',
        }
      )
      const data = await response.json()

      if (response.ok && data.success) {
        toast.success('Sample document deleted successfully')
        setFormData((prev) => {
          const previousDocs = Array.isArray(prev?.sample_docs) ? prev.sample_docs : []
          const remainingDocs = previousDocs.filter((item) => String(item.id) !== String(docId))
          return {
            ...prev,
            sample_docs: remainingDocs,
            sample_doc: remainingDocs[remainingDocs.length - 1]?.sample_doc || null,
          }
        })
        const remainingCount = sampleDocs.filter((item) => String(item.id) !== String(docId)).length
        setSamplingExists(remainingCount > 0)
        fetchFormData()
      } else {
        toast.error(data.message || 'Failed to delete sample document')
      }
    } catch (error) {
      console.error('Error deleting sample document:', error)
      toast.error('Error deleting sample document')
    } finally {
      setDeletingSampleDocId(null)
    }
  }

  const handleDeleteClick = () => {
    setDeleteDialogOpen(true)
  }

  const handleDeleteCancel = () => {
    setDeleteDialogOpen(false)
  }

  const handleDeleteConfirm = async () => {
    setDeleting(true)
    try {
      const response = await fetch(`${API_BASE_URL}/api/control-forms/${form_id}`, {
        method: 'DELETE',
        credentials: 'include',
      })

      const data = await response.json()

      if (response.ok && data.success) {
        toast.success('RACM deleted successfully')
        setDeleteDialogOpen(false)
        // Redirect to dashboard after a short delay
        setTimeout(() => {
          navigate('/company_co/dashboard')
        }, 500)
      } else {
        toast.error(data.message || 'Failed to delete RACM')
        setDeleting(false)
      }
    } catch (error) {
      console.error('Error deleting RACM:', error)
      toast.error('Error deleting RACM')
      setDeleting(false)
    }
  }

  // Given a Financial Year like "2025-26" or "2025-2026" or "2025",
  // return the next two FYs in "YYYY-YY" format.
  const parseNextTwoFYs = (fy) => {
    const input = (fy ?? '').toString().trim()
    if (!input) return []

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

  const handleMoreActionsClick = () => {
    setMoreActionsDialogOpen(true)
  }

  const handleMoreActionsClose = () => {
    setMoreActionsDialogOpen(false)
  }

  const handleChooseDeleteFromMore = () => {
    setMoreActionsDialogOpen(false)
    setDeleteDialogOpen(true)
  }

  const handleChooseReplicateFromMore = () => {
    setMoreActionsDialogOpen(false)
    setReplicateTargetFY('')
    setReplicateDialogOpen(true)
  }

  const handleReplicateConfirm = async () => {
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
          form_ids: [form_id],
          financial_year: replicateTargetFY.trim(),
        }),
      })

      const data = await response.json()
      if (response.ok && data.success) {
        const replicatedFormId = data?.data?.form_ids?.[0] || ''
        setReplicateDialogOpen(false)
        setReplicateTargetFY('')
        if (replicatedFormId) {
          setNewReplicatedFormId(replicatedFormId)
          setReplicateSuccessDialogOpen(true)
        } else {
          toast.success('RACM replicated successfully')
          fetchFormData()
        }
      } else {
        toast.error(data.message || 'Failed to replicate RACM')
      }
    } catch (error) {
      console.error('Error replicating RACM:', error)
      toast.error('Error replicating RACM')
    } finally {
      setReplicating(false)
    }
  }

  const handleGoToReplicatedRacm = () => {
    if (newReplicatedFormId) {
      navigate(`/company_co/form/${newReplicatedFormId}`)
    }
    setReplicateSuccessDialogOpen(false)
  }

  const sampleRequiredNotice = '(If not available, upload documents from the preceding or succeeding dates.)'

  const getSampleRequiredRows = (value) => {
    return String(value || '')
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean)
  }

  const handleDownloadSampleRequired = () => {
    const sampleRequiredValue = formData?.sample_required
    const rows = getSampleRequiredRows(sampleRequiredValue)

    if (rows.length === 0) {
      toast.error('No sample required data available')
      return
    }

    const worksheetRows = [
      ['Sample Required'],
      ...rows.map((row) => [row]),
    ]

    const worksheet = XLSX.utils.aoa_to_sheet(worksheetRows)
    worksheet['!cols'] = [{ wch: 36 }]

    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Sample Required')

    const safeFormId = String(form_id || 'racm').replace(/[^\w-]/g, '_')
    XLSX.writeFile(workbook, `sample_required_${safeFormId}.xlsx`)
  }

  const renderSampleRequiredDownload = () => {
    const hasSampleRequired = getSampleRequiredRows(formData?.sample_required).length > 0

    return (
      <Box>
        <Button
          variant="outlined"
          startIcon={<DownloadRoundedIcon />}
          onClick={handleDownloadSampleRequired}
          disabled={!hasSampleRequired}
          sx={{
            textTransform: 'none',
            fontWeight: 600,
            alignSelf: 'flex-start',
          }}
        >
          {hasSampleRequired ? 'Download Sample Required' : 'No Sample Required File'}
        </Button>
        <Typography
          variant="caption"
          component="p"
          sx={{
            color: 'text.secondary',
            fontStyle: 'italic',
            mt: 0.75,
            fontSize: '0.75rem',
            opacity: 0.8,
          }}
        >
          {sampleRequiredNotice}
        </Typography>
      </Box>
    )
  }

  // Define field labels mapping for updated RACM schema
  const fieldLabels = {
    ...RACM_FIELD_LABELS,
  }

  // Display order for updated RACM schema
  const fieldOrder = [
    'control_number',
    'area',
    'sub_process',
    'risk_description',
    'risk_heat',
    'standard_control_description',
    'control_objective',
    'whether_fraud_risks_exist',
    'process_walkthrough',
    'control_relies_on_ipe',
    'audit_evidence_accuracy',
    'ipe_reference',
    'key_control',
    'application_name',
    'control_performer',
    'control_design_procs',
    'control_type_fo',
    'control_type_ma',
    'nature_of_control',
    'control_owner',
    'control_frequency',
    'sample_size',
    'sample_required',
    'completeness',
    'existence_occurrence',
    'rights_and_obligation',
    'valuation_and_allocation',
    'presentation_and_disclosure',
    'control_design_conclusion',
    'design_deficiency_desc',
    'doc_uploaded_by_user'
  ]
  const editableDropdownOptions = {
    risk_heat: ['High', 'Low', 'Medium'],
    control_type_fo: ['Financial', 'Operational'],
    control_type_ma: ['Manual', 'Automated'],
    nature_of_control: ['Preventive', 'Detective'],
    key_control: ['Yes', 'No'],
    control_relies_on_ipe: ['Yes', 'No'],
    control_frequency: [
      'Yearly',
      'Quarterly',
      'Half Yearly',
      'Monthly',
      'Weekly',
      'Fortnightly',
      'As and When Needed',
      'Recurring and Periodic',
      'Recurring and Daily',
      'Daily',
    ],
    whether_fraud_risks_exist: ['Yes', 'No', 'Other'],
  }

  // Fields to exclude from display
  const excludedFields = ['id', 'form_id', 'company_identifier', 'created_at', 'active', 'approved_rejected', 'reason_by_approver']

  // Fields that only approvers can edit (coordinator cannot edit these)
  // Must match backend `approverOnlyFields` guard.
  const approverOnlyFields = ['control_design_procs', 'control_design_conclusion', 'design_deficiency_desc']
  
  // Grouped fields that should be displayed together (only if at least one has a value)
  const groupedApproverFields = ['control_design_procs', 'control_design_conclusion', 'design_deficiency_desc']
  
  // Check if at least one grouped field has a value
  const hasGroupedFieldValue = formData ? groupedApproverFields.some(key => {
    const value = formData[key]
    return value !== null && value !== undefined && value !== '' && String(value).trim() !== ''
  }) : false
  const deficiencyResponse = formData?.deficiency_response || null
  const deficiencyCurrentSubmission = deficiencyResponse?.current_submission || null
  const deficiencyAttachments = Array.isArray(deficiencyCurrentSubmission?.attachments)
    ? deficiencyCurrentSubmission.attachments
    : []
  const deficiencyResponseStatus = String(formData?.deficiency_response_status || '').trim()
  const needsDeficiencyResponse = Boolean(formData?.deficiency_action_status)
  const showDeficiencyActionNotice = needsDeficiencyResponse
  const canSubmitDeficiencyResponse = needsDeficiencyResponse && deficiencyResponseStatus !== 'submitted_for_review'

  // Initialize editable fields when formData is loaded and not in edit mode
  useEffect(() => {
    if (formData && !isEditMode) {
      const initialFields = {}
      fieldOrder.forEach(key => {
        if (!excludedFields.includes(key) && key !== 'doc_uploaded_by_user' && !approverOnlyFields.includes(key)) {
          initialFields[key] = formData[key] || ''
        }
      })
      setEditableFields(initialFields)
    }
  }, [formData, isEditMode])

  useEffect(() => {
    if (formData) {
      const parsedReminder = parseReminderFrequency(formData.reminder_frequency)
      setScheduleFields({
        due_date: formatDateForInput(formData.due_date),
        reminder_frequency: parsedReminder.reminder_frequency,
        custom_days: parsedReminder.custom_days
      })
    }
  }, [formData])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-4rem)]">
        <p className="text-secondary text-lg">Loading form data...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-4rem)]">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md">
          <p className="text-red-600 text-lg text-center">{error}</p>
        </div>
      </div>
    )
  }

  if (!formData) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-4rem)]">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md">
          <p className="text-secondary text-lg text-center">Form not found</p>
        </div>
      </div>
    )
  }

  const isActive = Boolean(formData?.active)
  const hasActiveSuggestedChanges = String(activeChangeRequest?.status || '').trim() === 'Review Pending'
  const areAllSuggestedChangesDecided =
    Array.isArray(activeChangeRequest?.items) &&
    activeChangeRequest.items.length > 0 &&
    activeChangeRequest.items.every((item) => {
      const status = String(reviewDecisions[item.id]?.status || '').trim()
      return status === 'Approved' || status === 'Rejected'
    })
  const sampleDocs = getSampleDocs()
  const sampleDocCount = sampleDocs.length
  const userDocs = getUserDocs()
  const userDocCount = userDocs.length
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

  return (
    <Box
      sx={{
        width: '100%',
        maxWidth: FORM_DETAIL_MAX_WIDTH,
        mx: 'auto',
        px: 0,
        py: 0,
      }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
        {changeRequestHistoryCount > 0 ? (
          <Button
            onClick={handleOpenChangeRequestHistoryDialog}
            disabled={changeRequestHistoryLoading}
            variant="outlined"
            sx={{
              mr: 1.5,
              py: 1,
              fontWeight: 600,
              textTransform: 'none',
              fontSize: '0.9375rem',
              borderRadius: 2,
            }}
          >
            Change Requests ({changeRequestHistoryCount})
          </Button>
        ) : null}
        {!isEditMode && hasActiveSuggestedChanges && (
          <Button
            onClick={handleOpenSuggestedChangesDialog}
            disabled={activeChangeRequestLoading}
            variant="contained"
            color="warning"
            sx={{
              mr: 1.5,
              py: 1,
              fontWeight: 600,
              textTransform: 'none',
              fontSize: '0.9375rem',
              borderRadius: 2,
            }}
          >
            Suggested Changes
          </Button>
        )}
        {/* When in edit mode: Cancel & Save Changes at top-right */}
        {isEditMode && (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1.5,
            }}
          >
            <Button
              onClick={handleCancelEdit}
              disabled={saving}
              variant="outlined"
              sx={{
                py: 1,
                fontWeight: 600,
                textTransform: 'none',
                fontSize: '0.9375rem',
                borderRadius: 2,
                borderWidth: 1.5,
                borderColor: theme.palette.mode === 'dark'
                  ? 'rgba(255, 255, 255, 0.23)'
                  : 'rgba(0, 0, 0, 0.23)',
                '&:hover': {
                  borderWidth: 1.5,
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
              onClick={handleSaveChanges}
              disabled={saving}
              variant="contained"
              color="secondary"
              sx={{
                py: 1,
                fontWeight: 600,
                textTransform: 'none',
                fontSize: '0.9375rem',
                borderRadius: 2,
              }}
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </Box>
        )}
      </Box>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {/* Top Sidebar (now full width) */}
        <Box sx={{ width: '100%' }}>
          <Card 
            sx={{ 
              borderRadius: 3,
              boxShadow: theme.palette.mode === 'dark'
                ? '0 4px 20px rgba(0, 0, 0, 0.3)'
                : '0 2px 12px rgba(0, 0, 0, 0.08)',
              border: '1px solid',
              borderColor: theme.palette.mode === 'dark' 
                ? 'rgba(255, 255, 255, 0.12)' 
                : 'rgba(0, 0, 0, 0.08)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            <CardContent sx={{ 
              px: 3.5,
              pt: 3,
              pb: 4,
              display: 'flex', 
              flexDirection: 'column', 
              gap: 0,
            }}>
              <Box
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 3,
                }}
              >
                <Box
                  sx={{
                    display: 'flex',
                    flexDirection: { xs: 'column', sm: 'row' },
                    alignItems: { xs: 'stretch', sm: 'center' },
                    justifyContent: 'space-between',
                    gap: 1.5,
                    mb: 0,
                    pb: 2,
                    borderBottom: '1px solid',
                    borderColor: 'divider',
                  }}
                >
                  <Button
                    variant="contained"
                    color="primary"
                    size="medium"
                    startIcon={<HistoryRoundedIcon sx={{ fontSize: '1.2rem !important' }} />}
                    onClick={handleOpenAuditLogs}
                    disableElevation
                    sx={{
                      alignSelf: { xs: 'flex-start', sm: 'center' },
                      textTransform: 'none',
                      fontWeight: 700,
                      letterSpacing: '0.02em',
                      borderRadius: 2,
                      px: 1.5,
                      py: 0.875,
                      minHeight: 40,
                      boxShadow: 'none',
                      '&:hover': {
                        boxShadow: 'none',
                      },
                    }}
                  >
                    Audit logs
                  </Button>
                  <Box
                    sx={{
                      textAlign: { xs: 'left', sm: 'right' },
                      minWidth: 0,
                    }}
                  >
                    <Typography
                      variant="caption"
                      sx={{
                        display: 'block',
                        color: 'text.secondary',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                      }}
                    >
                      Created At
                    </Typography>
                    <Typography
                      variant="body2"
                      sx={{
                        color: 'text.primary',
                        fontWeight: 600,
                        lineHeight: 1.5,
                      }}
                    >
                      {formatDateTime(formData?.created_at)}
                    </Typography>
                  </Box>
                </Box>
                {/* Top metrics in equal-width grid */}
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: {
                      xs: '1fr',
                      sm: 'repeat(2, 1fr)',
                      md: 'repeat(4, 1fr)',
                    },
                    gap: 2,
                  }}
                >
                  {/* Form Status */}
                  <Box
                    sx={{
                      p: 2,
                      borderRadius: 2,
                      border: '1px solid',
                      borderColor: 'divider',
                    }}
                  >
                    <Typography
                      variant="caption"
                      component="label"
                      sx={{
                        display: 'block',
                        fontWeight: 600,
                        mb: 1,
                        color: 'text.secondary',
                        fontSize: '0.75rem',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                      }}
                    >
                      Form Status
                    </Typography>
                    <Typography
                      variant="body2"
                      sx={{
                        color: isActive ? '#10b981' : '#ef4444',
                        fontWeight: 500,
                        fontSize: '0.9375rem',
                      }}
                    >
                      {isActive ? 'Active' : 'Inactive'}
                    </Typography>
                  </Box>

                  {/* Business Process */}
                  <Box
                    sx={{
                      p: 2,
                      borderRadius: 2,
                      border: '1px solid',
                      borderColor: 'divider',
                    }}
                  >
                    <Typography
                      variant="caption"
                      component="label"
                      sx={{
                        display: 'block',
                        fontWeight: 600,
                        mb: 1,
                        color: 'text.secondary',
                        fontSize: '0.75rem',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                      }}
                    >
                      Business Process
                    </Typography>
                    <Typography
                      variant="body2"
                      sx={{
                        color: 'text.primary',
                        fontWeight: 500,
                        fontSize: '0.9375rem',
                        lineHeight: 1.5,
                      }}
                    >
                      {formData?.business_process || '-'}
                    </Typography>
                  </Box>

                  {/* Financial Year */}
                  <Box
                    sx={{
                      p: 2,
                      borderRadius: 2,
                      border: '1px solid',
                      borderColor: 'divider',
                    }}
                  >
                    <Typography
                      variant="caption"
                      component="label"
                      sx={{
                        display: 'block',
                        fontWeight: 600,
                        mb: 1,
                        color: 'text.secondary',
                        fontSize: '0.75rem',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                      }}
                    >
                      Financial Year
                    </Typography>
                    <Typography
                      variant="body2"
                      sx={{
                        color: 'text.primary',
                        fontWeight: 500,
                        fontSize: '0.9375rem',
                        lineHeight: 1.5,
                      }}
                    >
                      {formData?.financial_year || '-'}
                    </Typography>
                  </Box>

                  {/* Approval Status */}
                  <Box
                    sx={{
                      p: 2,
                      borderRadius: 2,
                      border: '1px solid',
                      borderColor: 'divider',
                    }}
                  >
                    <Typography
                      variant="caption"
                      component="label"
                      sx={{
                        display: 'block',
                        fontWeight: 600,
                        mb: 1,
                        color: 'text.secondary',
                        fontSize: '0.75rem',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                      }}
                    >
                      Approval Status
                    </Typography>
                    <Typography
                      variant="body2"
                      sx={{
                        color: (() => {
                          const status = formData?.status
                          if (status === 'Approved') return '#10b981'
                          if (status === 'Rejected') return '#ef4444'
                          return 'text.primary'
                        })(),
                        fontWeight: 500,
                        fontSize: '0.9375rem',
                        lineHeight: 1.5,
                      }}
                    >
                      {formatStatus(formData?.status)}
                    </Typography>
                  </Box>
                </Box>

                {/* Reminder + Assignment + Unit Name + Control Number (25% each on desktop) */}
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' },
                    gap: 2,
                    alignItems: 'stretch',
                  }}
                >
                  {/* Reminder Settings */}
                  <Box
                    sx={{
                      p: 2,
                      borderRadius: 2,
                      border: '1px solid',
                      borderColor: 'divider',
                      display: 'grid',
                      gridTemplateColumns: { xs: '1fr', md: '1.1fr 1fr auto' },
                      gap: 1,
                      alignItems: 'center',
                      ...(isEditMode && {
                        opacity: 0.6,
                        pointerEvents: 'none',
                      }),
                    }}
                  >
                      <TextField
                        type="date"
                        label="Due Date"
                        value={scheduleFields.due_date}
                        onChange={(e) => handleScheduleFieldChange('due_date', e.target.value)}
                        fullWidth
                        size="small"
                        InputLabelProps={{ shrink: true }}
                        inputProps={{ min: getTomorrowDateString() }}
                        disabled={savingSchedule || isEditMode || isActive}
                        sx={{
                          '& .MuiInputBase-root': {
                            minHeight: 38,
                          },
                        }}
                      />

                      <FormControl
                        fullWidth
                        size="small"
                        disabled={savingSchedule || isEditMode || isActive}
                        sx={{
                          '& .MuiInputBase-root': {
                            minHeight: 38,
                          },
                        }}
                      >
                        <InputLabel id="reminder-frequency-label">Reminder Frequency</InputLabel>
                        <Select
                          labelId="reminder-frequency-label"
                          value={scheduleFields.reminder_frequency}
                          label="Reminder Frequency"
                          onChange={(e) => handleScheduleFieldChange('reminder_frequency', e.target.value)}
                        >
                          <MenuItem value="Daily">Daily</MenuItem>
                          <MenuItem value="Weekly">Weekly</MenuItem>
                          <MenuItem value="Monthly">Monthly</MenuItem>
                        </Select>
                      </FormControl>

                      {(
                        scheduleFields.due_date !== formatDateForInput(formData?.due_date) ||
                        scheduleFields.reminder_frequency !== parseReminderFrequency(formData.reminder_frequency).reminder_frequency
                      ) && (
                        <Button
                          onClick={handleSaveSchedule}
                          disabled={savingSchedule || isEditMode || isActive}
                          variant="outlined"
                          size="small"
                          sx={{
                            textTransform: 'none',
                            fontWeight: 600,
                            borderRadius: 2,
                            minHeight: 38,
                            px: 1.5,
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {savingSchedule ? 'Saving...' : 'Save'}
                        </Button>
                      )}
                  </Box>

                  {/* RACM Assignment */}
                  <Box
                    sx={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 1.5,
                      height: '100%',
                      minWidth: 0,
                    }}
                  >
                    <Box
                      onClick={() => {
                        if (!isEditMode && !updating && !isActive) {
                          handleOpenAssignmentDialog()
                        }
                      }}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if ((e.key === 'Enter' || e.key === ' ') && !isEditMode && !updating && !isActive) {
                          e.preventDefault()
                          handleOpenAssignmentDialog()
                        }
                      }}
                      sx={{
                        width: '100%',
                        border: '1px solid',
                        borderColor: 'divider',
                        borderRadius: 2,
                        p: 2,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'flex-start',
                        justifyContent: 'center',
                        gap: 1,
                        cursor: isEditMode || updating || isActive ? 'not-allowed' : 'pointer',
                        opacity: isEditMode || updating || isActive ? 0.65 : 1,
                        transition: 'all 0.2s ease',
                        minHeight: '100%',
                        '&:hover': isEditMode || updating || isActive ? {} : {
                          backgroundColor: theme.palette.mode === 'dark'
                            ? 'rgba(255, 255, 255, 0.03)'
                            : 'rgba(0, 0, 0, 0.02)',
                        },
                      }}
                    >
                      <Typography
                        variant="caption"
                        sx={{
                          color: 'text.secondary',
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px',
                        }}
                      >
                        RACM Assignment
                      </Typography>
                      <Tooltip
                        title={
                          (processOwnerName && processOwnerName !== '-')
                            ? processOwnerName
                            : ((formData?.control_owner || '').trim() || '-')
                        }
                        arrow
                      >
                        <Typography
                          variant="body2"
                          sx={{
                            color: 'text.primary',
                            fontWeight: 500,
                            width: '100%',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            lineHeight: 1.6,
                          }}
                        >
                          {(processOwnerName && processOwnerName !== '-')
                            ? processOwnerName
                            : ((formData?.control_owner || '').trim() || '-')}
                        </Typography>
                      </Tooltip>
                    </Box>
                  </Box>

                  {/* Unit Name */}
                  <Box
                    sx={{
                      p: 2,
                      borderRadius: 2,
                      border: '1px solid',
                      borderColor: 'divider',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'center',
                      gap: 1,
                    }}
                  >
                    <Typography
                      variant="caption"
                      sx={{
                        color: 'text.secondary',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                      }}
                    >
                      Unit Name
                    </Typography>
                    <Typography
                      variant="body2"
                      sx={{
                        color: 'text.primary',
                        fontWeight: 500,
                        lineHeight: 1.6,
                      }}
                    >
                      {(formData?.unit_name || formData?.unit_id || '').toString().trim() || '-'}
                    </Typography>
                  </Box>

                  {/* Control Number */}
                  <Box
                    sx={{
                      p: 2,
                      borderRadius: 2,
                      border: '1px solid',
                      borderColor: 'divider',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'center',
                      gap: 1,
                    }}
                  >
                    <Typography
                      variant="caption"
                      sx={{
                        color: 'text.secondary',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                      }}
                    >
                      Control Number
                    </Typography>
                    <Typography
                      variant="body2"
                      sx={{
                        color: 'text.primary',
                        fontWeight: 500,
                        lineHeight: 1.6,
                      }}
                    >
                      {(formData?.control_number || '').toString().trim() || '-'}
                    </Typography>
                  </Box>

                </Box>

                {/* Bottom action buttons (4 in one row: RACM Assignment area has its own button; here: Modify, Upload, Set Active, Delete) */}
                <Box
                  sx={{
                    mt: 2,
                    pt: 3,
                    borderTop: '2px solid',
                    borderColor: 'divider',
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', sm: 'repeat(4, 1fr)' },
                    gap: 2,
                  }}
                >
                  {/* Modify */}
                  <Button
                    onClick={handleModifyClick}
                    disabled={isEditMode || isActive}
                    variant="contained"
                    color="secondary"
                    sx={{
                      width: '100%',
                      py: 1.5,
                      fontWeight: 600,
                      textTransform: 'none',
                      fontSize: '0.9375rem',
                      borderRadius: 2,
                      ...(isEditMode || isActive ? {
                        opacity: 0.5,
                        cursor: 'not-allowed',
                      } : {}),
                    }}
                  >
                    Modify
                  </Button>

                  {/* Upload Sampling Excel */}
                  <Box sx={{ width: '100%' }}>
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                      onChange={handleSamplingFileChange}
                      style={{ display: 'none' }}
                      disabled={uploadingSampling}
                    />
                    <Button
                      onClick={handleOpenSampleDocsDialog}
                      disabled={uploadingSampling}
                      fullWidth
                      variant="outlined"
                      startIcon={sampleDocCount > 0 || samplingExists ? <CheckCircleIcon /> : <CloudUploadIcon />}
                      sx={{
                        py: 1.5,
                        fontWeight: 600,
                        textTransform: 'none',
                        fontSize: '0.9375rem',
                        borderRadius: 2,
                        borderWidth: 1.5,
                        borderColor: theme.palette.mode === 'dark'
                          ? 'rgba(255, 255, 255, 0.23)'
                          : 'rgba(0, 0, 0, 0.23)',
                        '&:hover': {
                          borderWidth: 1.5,
                          borderColor: theme.palette.mode === 'dark'
                            ? 'rgba(255, 255, 255, 0.3)'
                            : 'rgba(0, 0, 0, 0.3)',
                          backgroundColor: theme.palette.mode === 'dark'
                            ? 'rgba(255, 255, 255, 0.05)'
                            : 'rgba(0, 0, 0, 0.04)',
                        },
                        '&:disabled': {
                          borderColor: theme.palette.mode === 'dark'
                            ? 'rgba(255, 255, 255, 0.12)'
                            : 'rgba(0, 0, 0, 0.12)',
                          color: theme.palette.mode === 'dark'
                            ? 'rgba(255, 255, 255, 0.5)'
                            : 'rgba(0, 0, 0, 0.5)',
                          backgroundColor: theme.palette.mode === 'dark'
                            ? 'rgba(255, 255, 255, 0.03)'
                            : 'rgba(0, 0, 0, 0.02)',
                          cursor: 'not-allowed',
                        },
                      }}
                    >
                      {uploadingSampling ? 'Uploading...' : `Sample Documents (${sampleDocCount})`}
                    </Button>
                  </Box>

                  {/* Toggle Active */}
                  <Button
                    onClick={handleToggleActive}
                    disabled={updating || isEditMode}
                    variant="contained"
                    sx={{
                      width: '100%',
                      py: 1.5,
                      fontWeight: 600,
                      textTransform: 'none',
                      fontSize: '0.9375rem',
                      borderRadius: 2,
                      ...(isActive ? {
                        backgroundColor: '#10b981',
                        '&:hover': {
                          backgroundColor: '#059669',
                        },
                      } : {
                        backgroundColor: '#ef4444',
                        '&:hover': {
                          backgroundColor: '#dc2626',
                        },
                      }),
                      ...(updating && {
                        opacity: 0.6,
                        cursor: 'not-allowed',
                      }),
                      ...(isEditMode && {
                        opacity: 0.5,
                        cursor: 'not-allowed',
                      }),
                    }}
                  >
                    {updating ? 'Updating...' : (isActive ? 'Set Inactive' : 'Set Active')}
                  </Button>

                  {/* More actions */}
                  <Button
                    onClick={handleMoreActionsClick}
                    variant="outlined"
                    disabled={isEditMode}
                    sx={{
                      width: '100%',
                      py: 1.5,
                      fontWeight: 600,
                      textTransform: 'none',
                      fontSize: '0.9375rem',
                      borderRadius: 2,
                      ...(isEditMode && {
                        opacity: 0.5,
                        cursor: 'not-allowed',
                      }),
                    }}
                  >
                    More
                  </Button>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Box>

        {/* Main Content (below sidebar, full width) */}
        <Box sx={{ width: '100%', flex: 1, display: 'flex', flexDirection: 'column', gap: 3 }}>
          {/* Process and risk section */}
          <Card
            sx={{
              borderRadius: 3,
              boxShadow: theme.palette.mode === 'dark'
                ? '0 4px 20px rgba(0, 0, 0, 0.3)'
                : '0 2px 12px rgba(0, 0, 0, 0.08)',
              border: '1px solid',
              borderColor: theme.palette.mode === 'dark' 
                ? 'rgba(255, 255, 255, 0.12)' 
                : 'rgba(0, 0, 0, 0.08)',
              overflow: 'hidden',
            }}
          >
            <CardContent sx={{ p: 4 }}>
              <Typography
                variant="h6"
                component="h3"
                sx={{
                  fontWeight: 700,
                  mb: 3,
                  color: 'text.primary',
                  fontSize: '1.25rem',
                  pb: 2,
                  borderBottom: '2px solid',
                  borderColor: 'divider',
                }}
              >
                Process and Risk
              </Typography>
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: {
                    xs: '1fr',
                    md: 'repeat(2, 1fr)',
                  },
                  gap: 3,
                  mt: 2,
                }}
              >
                {['area', 'sub_process', 'risk_description', 'risk_heat'].map((key) => {
                  if (!formData.hasOwnProperty(key) || excludedFields.includes(key)) return null

                  const label = fieldLabels[key] || key.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())
                  const value = formData[key]
                  const isEmpty = value === null || value === undefined || value === ''
                  const isEditable =
                    isEditMode &&
                    key !== 'doc_uploaded_by_user' &&
                    key !== 'control_owner' &&
                    key !== 'sample_size' &&
                    !approverOnlyFields.includes(key)
                  const isTextArea = ['risk_description'].includes(key)

                  return (
                    <Box
                      key={key}
                      sx={{
                        p: 2.5,
                        borderRadius: 2,
                        backgroundColor: theme.palette.mode === 'dark'
                          ? 'rgba(255, 255, 255, 0.03)'
                          : 'rgba(0, 0, 0, 0.02)',
                        border: '1px solid',
                        borderColor: theme.palette.mode === 'dark'
                          ? 'rgba(255, 255, 255, 0.08)'
                          : 'rgba(0, 0, 0, 0.06)',
                        gridColumn: isEditable && isTextArea
                          ? {
                              xs: '1',
                              md: '1 / -1',
                            }
                          : undefined,
                        transition: 'all 0.2s ease-in-out',
                        '&:hover': {
                          backgroundColor: theme.palette.mode === 'dark'
                            ? 'rgba(255, 255, 255, 0.05)'
                            : 'rgba(0, 0, 0, 0.04)',
                        },
                      }}
                    >
                      <Typography
                        variant="caption"
                        component="dt"
                        sx={{
                          display: 'block',
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px',
                          mb: 1.5,
                          color: 'text.primary',
                          fontSize: theme.typography.customSizes.small,
                        }}
                      >
                        {label}
                      </Typography>
                      {isEditable ? (
                        editableDropdownOptions[key] ? (
                          <FormControl fullWidth disabled={saving}>
                            <InputLabel id={`${key}-edit-label`}>{label}</InputLabel>
                            <Select
                              labelId={`${key}-edit-label`}
                              value={editableFields[key] || ''}
                              label={label}
                              onChange={(e) => handleFieldChange(key, e.target.value)}
                            >
                              {editableDropdownOptions[key].map((option) => (
                                <MenuItem key={option} value={option}>
                                  {option}
                                </MenuItem>
                              ))}
                            </Select>
                          </FormControl>
                        ) : (
                          <TextField
                            label={label}
                            variant="outlined"
                            value={editableFields[key] || ''}
                            onChange={(e) => handleFieldChange(key, e.target.value)}
                            fullWidth
                            multiline={isTextArea}
                            rows={isTextArea ? 4 : 1}
                            disabled={saving}
                            sx={{
                              '& .MuiOutlinedInput-root': {
                                backgroundColor: 'transparent',
                                '&:hover': {
                                  backgroundColor: 'transparent',
                                },
                                '&.Mui-focused': {
                                  backgroundColor: 'transparent',
                                },
                              },
                            }}
                          />
                        )
                      ) : (
                        <Typography
                          variant="body2"
                          component="dd"
                          sx={{
                            color: isEmpty ? 'text.disabled' : 'text.secondary',
                            wordBreak: 'break-word',
                            lineHeight: 1.6,
                            fontSize: theme.typography.customSizes.medium,
                          }}
                        >
                          {isEmpty ? '-' : String(value)}
                        </Typography>
                      )}
                    </Box>
                  )
                })}
              </Box>
            </CardContent>
          </Card>

          {/* Assertions section */}
          <Card
            sx={{
              borderRadius: 3,
              boxShadow: theme.palette.mode === 'dark'
                ? '0 4px 20px rgba(0, 0, 0, 0.3)'
                : '0 2px 12px rgba(0, 0, 0, 0.08)',
              border: '1px solid',
              borderColor: theme.palette.mode === 'dark' 
                ? 'rgba(255, 255, 255, 0.12)' 
                : 'rgba(0, 0, 0, 0.08)',
              overflow: 'hidden',
            }}
          >
            <CardContent sx={{ p: 4 }}>
              <Typography
                variant="h6"
                component="h3"
                sx={{
                  fontWeight: 700,
                  mb: 3,
                  color: 'text.primary',
                  fontSize: '1.25rem',
                  pb: 2,
                  borderBottom: '2px solid',
                  borderColor: 'divider',
                }}
              >
                Assertions
              </Typography>
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: {
                    xs: '1fr',
                    md: 'repeat(2, 1fr)',
                  },
                  gap: 3,
                  mt: 2,
                }}
              >
                {['completeness', 'existence_occurrence', 'valuation_and_allocation', 'rights_and_obligation', 'presentation_and_disclosure'].map((key) => {
                  if (!formData.hasOwnProperty(key) || excludedFields.includes(key)) return null

                  const label = fieldLabels[key]
                  const value = formData[key]
                  const isTruthy = value === true || value === 'true' || value === '1' || value === 1
                  const editableChecked = editableFields[key] === true || editableFields[key] === 'true' || editableFields[key] === '1' || editableFields[key] === 1
                  const isEditable = isEditMode && !approverOnlyFields.includes(key)

                  return (
                    <Box
                      key={key}
                      sx={{
                        p: 2.5,
                        borderRadius: 2,
                        backgroundColor: theme.palette.mode === 'dark'
                          ? 'rgba(255, 255, 255, 0.03)'
                          : 'rgba(0, 0, 0, 0.02)',
                        border: '1px solid',
                        borderColor: theme.palette.mode === 'dark'
                          ? 'rgba(255, 255, 255, 0.08)'
                          : 'rgba(0, 0, 0, 0.06)',
                        transition: 'all 0.2s ease-in-out',
                        '&:hover': {
                          backgroundColor: theme.palette.mode === 'dark'
                            ? 'rgba(255, 255, 255, 0.05)'
                            : 'rgba(0, 0, 0, 0.04)',
                        },
                      }}
                    >
                      <Typography
                        variant="caption"
                        component="dt"
                        sx={{
                          display: 'block',
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px',
                          mb: 1.5,
                          color: 'text.primary',
                          fontSize: theme.typography.customSizes.small,
                        }}
                      >
                        {label}
                      </Typography>
                      {isEditable ? (
                        <Box
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'flex-start',
                          }}
                        >
                          <Checkbox
                            checked={editableChecked}
                            onChange={(e) => handleFieldChange(key, !!e.target.checked)}
                            disabled={saving}
                            inputProps={{ 'aria-label': label }}
                          />
                        </Box>
                      ) : (
                        <Box
                          component="dd"
                          sx={{
                            m: 0,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 1,
                            minHeight: 24,
                          }}
                        >
                          {isTruthy ? (
                            <>
                              <CheckCircleIcon sx={{ fontSize: 18, color: '#10b981', flexShrink: 0 }} />
                              <Typography
                                variant="body2"
                                sx={{
                                  color: 'text.secondary',
                                  lineHeight: 1.6,
                                  fontSize: theme.typography.customSizes.medium,
                                }}
                              >
                                Selected
                              </Typography>
                            </>
                          ) : (
                            <Typography
                              variant="body2"
                              sx={{
                                color: 'text.disabled',
                                lineHeight: 1.6,
                                fontSize: theme.typography.customSizes.medium,
                              }}
                            >
                              Not selected
                            </Typography>
                          )}
                        </Box>
                      )}
                    </Box>
                  )
                })}
              </Box>
            </CardContent>
          </Card>

          {/* Control Details section */}
          <Card
            sx={{
              borderRadius: 3,
              boxShadow: theme.palette.mode === 'dark'
                ? '0 4px 20px rgba(0, 0, 0, 0.3)'
                : '0 2px 12px rgba(0, 0, 0, 0.08)',
              border: '1px solid',
              borderColor: theme.palette.mode === 'dark' 
                ? 'rgba(255, 255, 255, 0.12)' 
                : 'rgba(0, 0, 0, 0.08)',
              overflow: 'hidden',
            }}
          >
            <CardContent sx={{ p: 4 }}>
              <Typography
                variant="h6"
                component="h3"
                sx={{
                  fontWeight: 700,
                  mb: 3,
                  color: 'text.primary',
                  fontSize: '1.25rem',
                  pb: 2,
                  borderBottom: '2px solid',
                  borderColor: 'divider',
                }}
              >
                Control Details
              </Typography>
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: {
                    xs: '1fr',
                    md: 'repeat(2, 1fr)',
                  },
                  gap: 3,
                  mt: 2,
                }}
              >
                {orderControlDetailKeys(
                  fieldOrder.filter((key) => {
                    if (groupedApproverFields.includes(key)) return false
                    // already shown in Process and risk / Assertions
                    if (
                      [
                        'control_number',
                        'area',
                        'sub_process',
                        'risk_description',
                        'risk_heat',
                        'completeness',
                        'existence_occurrence',
                        'valuation_and_allocation',
                        'rights_and_obligation',
                        'presentation_and_disclosure',
                      ].includes(key)
                    ) {
                      return false
                    }
                    // Doc & remarks are handled in Approval section
                    if (['doc_uploaded_by_user', 'remarks_by_user'].includes(key)) {
                      return false
                    }
                    return formData.hasOwnProperty(key) && !excludedFields.includes(key)
                  }),
                  fieldOrder
                )
                  .map((key) => {
                    const label = fieldLabels[key] || key.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())
                    const value = formData[key]
                    const isEmpty = value === null || value === undefined || value === ''
                    const isEditable =
                      isEditMode &&
                      key !== 'doc_uploaded_by_user' &&
                      key !== 'control_owner' &&
                      key !== 'sample_size' &&
                      !approverOnlyFields.includes(key)
                    const isTextArea = [
                      'standard_control_description',
                      'control_objective',
                      'process_walkthrough',
                      'audit_evidence_accuracy',
                      'ipe_reference',
                      'control_design_procs',
                      'design_deficiency_desc'
                    ].includes(key)

                    return (
                      <Box
                        key={key}
                        sx={{
                          p: 2.5,
                          borderRadius: 2,
                          backgroundColor: theme.palette.mode === 'dark'
                            ? 'rgba(255, 255, 255, 0.03)'
                            : 'rgba(0, 0, 0, 0.02)',
                          border: '1px solid',
                          borderColor: theme.palette.mode === 'dark'
                            ? 'rgba(255, 255, 255, 0.08)'
                            : 'rgba(0, 0, 0, 0.06)',
                          gridColumn: isEditable && isTextArea
                            ? {
                                xs: '1',
                                md: '1 / -1',
                              }
                            : undefined,
                          transition: 'all 0.2s ease-in-out',
                          '&:hover': {
                            backgroundColor: theme.palette.mode === 'dark'
                              ? 'rgba(255, 255, 255, 0.05)'
                              : 'rgba(0, 0, 0, 0.04)',
                          },
                        }}
                      >
                        {!isEditable && (
                          <Typography
                            variant="caption"
                            component="dt"
                            sx={{
                              display: 'block',
                              fontWeight: 700,
                              textTransform: 'uppercase',
                              letterSpacing: '0.5px',
                              mb: 1.5,
                              color: 'text.primary',
                              fontSize: theme.typography.customSizes.small,
                            }}
                          >
                            {label}
                          </Typography>
                        )}
                        {isEditable ? (
                          <Box>
                            {key === 'control_performer'
                              ? (() => {
                                  const selectedEmail = (editableFields.control_performer || '').trim()
                                  const optionsForField = mergeAssignableUserIntoOptions(
                                    performerUserOptions,
                                    selectedEmail
                                  )
                                  const selectedUser = selectedEmail
                                    ? optionsForField.find(
                                        (u) =>
                                          (u.email_id || '').trim().toLowerCase() ===
                                          selectedEmail.toLowerCase()
                                      ) ?? { email_id: selectedEmail, emp_name: '' }
                                    : null
                                  return (
                                    <Autocomplete
                                      id="control_performer_edit"
                                      options={optionsForField}
                                      loading={performerUsersLoading}
                                      value={selectedUser}
                                      onChange={(_, newValue) => {
                                        handleFieldChange(
                                          'control_performer',
                                          newValue?.email_id?.trim() || ''
                                        )
                                      }}
                                      onInputChange={(_, newInputValue, reason) => {
                                        if (reason === 'reset') return
                                        if (reason === 'clear') {
                                          fetchPerformerAssignableUsers({
                                            q: '',
                                            limit: ASSIGNABLE_USER_INITIAL_LIMIT,
                                          })
                                          return
                                        }
                                        if (performerSearchDebounceRef.current) {
                                          clearTimeout(performerSearchDebounceRef.current)
                                        }
                                        performerSearchDebounceRef.current = setTimeout(() => {
                                          const q = newInputValue.trim()
                                          fetchPerformerAssignableUsers({
                                            q,
                                            limit: q
                                              ? ASSIGNABLE_USER_SEARCH_LIMIT
                                              : ASSIGNABLE_USER_INITIAL_LIMIT,
                                          })
                                        }, 300)
                                      }}
                                      onOpen={() => {
                                        if (performerUserOptions.length === 0) {
                                          fetchPerformerAssignableUsers({
                                            q: '',
                                            limit: ASSIGNABLE_USER_INITIAL_LIMIT,
                                          })
                                        }
                                      }}
                                      getOptionLabel={(option) =>
                                        option?.emp_name?.trim() || option?.email_id || ''
                                      }
                                      isOptionEqualToValue={(option, value) =>
                                        (option?.email_id || '').trim().toLowerCase() ===
                                        (value?.email_id || '').trim().toLowerCase()
                                      }
                                      filterOptions={(options) => options}
                                      freeSolo={false}
                                      clearOnEscape
                                      disableClearable={false}
                                      renderOption={(props, option) => (
                                        <Box component="li" {...props}>
                                          <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                                            <Typography variant="body2">
                                              {option.emp_name || '-'}
                                            </Typography>
                                            <Typography variant="caption" color="text.secondary">
                                              {option.email_id || '-'}
                                            </Typography>
                                          </Box>
                                        </Box>
                                      )}
                                      renderInput={(params) => (
                                        <TextField
                                          {...params}
                                          label={label}
                                          placeholder="Search by name or email…"
                                          variant="outlined"
                                          disabled={saving}
                                        />
                                      )}
                                      disabled={saving}
                                    />
                                  )
                                })()
                              : key === 'sample_required' ? (
                              renderSampleRequiredDownload()
                            ) : editableDropdownOptions[key] ? (
                              <FormControl fullWidth disabled={saving}>
                                <InputLabel id={`${key}-edit-label`}>{label}</InputLabel>
                                <Select
                                  labelId={`${key}-edit-label`}
                                  value={editableFields[key] || ''}
                                  label={label}
                                  onChange={(e) => handleFieldChange(key, e.target.value)}
                                >
                                  {editableDropdownOptions[key].map((option) => (
                                    <MenuItem key={option} value={option}>
                                      {option}
                                    </MenuItem>
                                  ))}
                                </Select>
                              </FormControl>
                            ) : (
                              <TextField
                                label={label}
                                variant="outlined"
                                value={editableFields[key] || ''}
                                onChange={(e) => handleFieldChange(key, e.target.value)}
                                fullWidth
                                multiline={isTextArea}
                                rows={isTextArea ? 4 : 1}
                                disabled={saving}
                                sx={{
                                  '& .MuiOutlinedInput-root': {
                                    backgroundColor: 'transparent',
                                    '&:hover': {
                                      backgroundColor: 'transparent',
                                    },
                                    '&.Mui-focused': {
                                      backgroundColor: 'transparent',
                                    },
                                  },
                                }}
                              />
                            )}
                          </Box>
                        ) : (
                          <Box>
                            {key === 'control_owner' ? (
                              <Box>
                                <Typography
                                  variant="body2"
                                  component="dd"
                                  sx={{
                                    color: isEmpty ? 'text.disabled' : 'text.secondary',
                                    wordBreak: 'break-word',
                                    lineHeight: 1.6,
                                    fontSize: theme.typography.customSizes.medium,
                                  }}
                                >
                                  {isEmpty ? '-' : String(value)}
                                </Typography>
                                <Typography
                                  variant="caption"
                                  component="p"
                                  sx={{
                                    color: 'text.secondary',
                                    mt: 0.25,
                                    fontSize: '0.8rem',
                                  }}
                                >
                                  {processOwnerName && processOwnerName !== '-'
                                    ? `Name: ${processOwnerName}`
                                    : 'Name: -'}
                                </Typography>
                              </Box>
                            ) : key === 'control_performer' ? (
                              <Box>
                                <Typography
                                  variant="body2"
                                  component="dd"
                                  sx={{
                                    color: isEmpty ? 'text.disabled' : 'text.secondary',
                                    wordBreak: 'break-word',
                                    lineHeight: 1.6,
                                    fontSize: theme.typography.customSizes.medium,
                                  }}
                                >
                                  {isEmpty ? '-' : String(value)}
                                </Typography>
                                <Typography
                                  variant="caption"
                                  component="p"
                                  sx={{
                                    color: 'text.secondary',
                                    mt: 0.25,
                                    fontSize: '0.8rem',
                                  }}
                                >
                                  {(() => {
                                    const m = companyUsers.find(
                                      (u) =>
                                        (u.email_id || '').trim().toLowerCase() ===
                                        String(value || '').trim().toLowerCase()
                                    )
                                    return m?.emp_name ? `Name: ${m.emp_name}` : 'Name: -'
                                  })()}
                                </Typography>
                              </Box>
                            ) : key === 'sample_required' ? (
                              renderSampleRequiredDownload()
                            ) : (
                              <Box>
                                <Typography
                                  variant="body2"
                                  component="dd"
                                  sx={{
                                    color: isEmpty ? 'text.disabled' : 'text.secondary',
                                    wordBreak: 'break-word',
                                    lineHeight: 1.6,
                                    fontSize: theme.typography.customSizes.medium,
                                  }}
                                >
                                  {isEmpty ? '-' : String(value)}
                                </Typography>
                              </Box>
                            )}
                          </Box>
                        )}
                      </Box>
                    )
                  })}
              </Box>
            </CardContent>
          </Card>

          <Card
            sx={{
              borderRadius: 3,
              boxShadow: theme.palette.mode === 'dark'
                ? '0 4px 20px rgba(0, 0, 0, 0.3)'
                : '0 2px 12px rgba(0, 0, 0, 0.08)',
              border: '1px solid',
              borderColor: theme.palette.mode === 'dark'
                ? 'rgba(255, 255, 255, 0.12)'
                : 'rgba(0, 0, 0, 0.08)',
              overflow: 'hidden',
            }}
          >
            <CardContent sx={{ p: 4 }}>
              <Typography
                variant="h6"
                component="h3"
                sx={{
                  fontWeight: 700,
                  mb: 3,
                  color: 'text.primary',
                  fontSize: '1.25rem',
                  pb: 2,
                  borderBottom: '2px solid',
                  borderColor: 'divider',
                }}
              >
                Documents
              </Typography>
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' },
                  gap: 3,
                  mt: 2,
                }}
              >
                <Box
                  sx={{
                    p: 2.5,
                    borderRadius: 2,
                    backgroundColor: theme.palette.mode === 'dark'
                      ? 'rgba(255, 255, 255, 0.03)'
                      : 'rgba(0, 0, 0, 0.02)',
                    border: '1px solid',
                    borderColor: theme.palette.mode === 'dark'
                      ? 'rgba(255, 255, 255, 0.08)'
                      : 'rgba(0, 0, 0, 0.06)',
                    width: '100%',
                  }}
                >
                  <Typography
                    variant="caption"
                    component="dt"
                    sx={{
                      display: 'block',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      mb: 1.5,
                      color: 'text.primary',
                      fontSize: theme.typography.customSizes.small,
                    }}
                  >
                    Sample Documents
                  </Typography>
                  {sampleDocCount > 0 ? (
                    <Box
                      component="button"
                      type="button"
                      onClick={handleOpenSampleDocsDialog}
                      sx={{
                        p: 1.5,
                        borderRadius: 2,
                        border: '1px solid',
                        borderColor: 'divider',
                        width: '100%',
                        textAlign: 'left',
                        backgroundColor: 'transparent',
                        cursor: 'pointer',
                        font: 'inherit',
                        transition: 'all 0.2s ease-in-out',
                        '&:hover': {
                          borderColor: 'primary.main',
                          backgroundColor: 'action.hover',
                        },
                        '&:focus-visible': {
                          outline: `2px solid ${theme.palette.primary.main}`,
                          outlineOffset: 2,
                        },
                      }}
                    >
                      <Typography
                        variant="body2"
                        component="dd"
                        sx={{
                          color: 'text.primary',
                          lineHeight: 1.6,
                          fontSize: theme.typography.customSizes.medium,
                          fontWeight: 600,
                        }}
                      >
                        Sample Documents ({sampleDocCount})
                      </Typography>
                      <Typography
                        variant="caption"
                        sx={{
                          color: 'text.secondary',
                          fontSize: theme.typography.customSizes.small,
                        }}
                      >
                        Click to view and download
                      </Typography>
                    </Box>
                  ) : (
                    <Typography
                      variant="body2"
                      component="dd"
                      sx={{
                        color: 'text.disabled',
                        lineHeight: 1.6,
                        fontSize: theme.typography.customSizes.medium,
                      }}
                    >
                      No sample uploaded
                    </Typography>
                  )}
                </Box>

                {userDocCount > 0 ? (
                  <Box
                    component="button"
                    type="button"
                    onClick={handleOpenUserDocsDialog}
                    sx={{
                      p: 2.5,
                      borderRadius: 2,
                      backgroundColor: theme.palette.mode === 'dark'
                        ? 'rgba(255, 255, 255, 0.03)'
                        : 'rgba(0, 0, 0, 0.02)',
                      border: '1px solid',
                      borderColor: theme.palette.mode === 'dark'
                        ? 'rgba(255, 255, 255, 0.08)'
                        : 'rgba(0, 0, 0, 0.06)',
                      width: '100%',
                      minWidth: 0,
                      textAlign: 'left',
                      cursor: 'pointer',
                      font: 'inherit',
                      transition: 'all 0.2s ease-in-out',
                      '&:hover': {
                        backgroundColor: theme.palette.mode === 'dark'
                          ? 'rgba(255, 255, 255, 0.05)'
                          : 'rgba(0, 0, 0, 0.04)',
                      },
                      '&:focus-visible': {
                        outline: `2px solid ${theme.palette.primary.main}`,
                        outlineOffset: 2,
                      },
                    }}
                  >
                    <Typography
                      variant="caption"
                      component="dt"
                      sx={{
                        display: 'block',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                        mb: 1.5,
                        color: 'text.primary',
                        fontSize: theme.typography.customSizes.small,
                      }}
                    >
                      {fieldLabels.doc_uploaded_by_user}
                    </Typography>
                    <Typography
                      variant="body2"
                      component="dd"
                      sx={{
                        color: 'text.primary',
                        lineHeight: 1.6,
                        fontSize: theme.typography.customSizes.medium,
                        fontWeight: 600,
                      }}
                    >
                      User Uploaded Documents ({userDocCount})
                    </Typography>
                  </Box>
                ) : (
                  <Box
                    sx={{
                      p: 2.5,
                      borderRadius: 2,
                      backgroundColor: theme.palette.mode === 'dark'
                        ? 'rgba(255, 255, 255, 0.03)'
                        : 'rgba(0, 0, 0, 0.02)',
                      border: '1px solid',
                      borderColor: theme.palette.mode === 'dark'
                        ? 'rgba(255, 255, 255, 0.08)'
                        : 'rgba(0, 0, 0, 0.06)',
                    }}
                  >
                    <Typography
                      variant="caption"
                      component="dt"
                      sx={{
                        display: 'block',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                        mb: 1.5,
                        color: 'text.primary',
                        fontSize: theme.typography.customSizes.small,
                      }}
                    >
                      {fieldLabels.doc_uploaded_by_user}
                    </Typography>
                    <Typography variant="body2" component="dd" sx={{ color: 'text.disabled' }}>
                      No user document uploaded
                    </Typography>
                  </Box>
                )}
              </Box>
            </CardContent>
          </Card>

          {(hasGroupedFieldValue || String(formData?.remarks_by_user || '').trim() !== '' || formData.reason_by_approver) && (
            <Card
              sx={{
                borderRadius: 3,
                boxShadow: theme.palette.mode === 'dark'
                  ? '0 4px 20px rgba(0, 0, 0, 0.3)'
                  : '0 2px 12px rgba(0, 0, 0, 0.08)',
                border: '1px solid',
                borderColor: theme.palette.mode === 'dark' 
                  ? 'rgba(255, 255, 255, 0.12)' 
                  : 'rgba(0, 0, 0, 0.08)',
                overflow: 'hidden',
              }}
            >
              <CardContent sx={{ p: 4 }}>
                <Typography
                  variant="h6"
                  component="h3"
                  sx={{
                    fontWeight: 700,
                    mb: 3,
                    color: 'text.primary',
                    fontSize: '1.25rem',
                    pb: 2,
                    borderBottom: '2px solid',
                    borderColor: 'divider',
                  }}
                >
                  Approval
                </Typography>
                <Box
                  sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 3,
                    mt: 2,
                  }}
                >
                  {hasGroupedFieldValue ? (
                    <Box>
                      <Box
                        sx={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 3,
                        }}
                      >
                        {groupedApproverFields.map((key) => {
                          const label = fieldLabels[key] || key.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())
                          const value = formData[key]
                          const isEmpty = value === null || value === undefined || value === '' || String(value).trim() === ''
                          const isTextArea = ['control_design_procs', 'design_deficiency_desc'].includes(key)

                          return (
                            <Box
                              key={key}
                              sx={{
                                p: 2.5,
                                borderRadius: 2,
                                backgroundColor: theme.palette.mode === 'dark'
                                  ? 'rgba(255, 255, 255, 0.03)'
                                  : 'rgba(0, 0, 0, 0.02)',
                                border: '1px solid',
                                borderColor: theme.palette.mode === 'dark'
                                  ? 'rgba(255, 255, 255, 0.08)'
                                  : 'rgba(0, 0, 0, 0.06)',
                              }}
                            >
                              <Typography
                                variant="caption"
                                component="dt"
                                sx={{
                                  display: 'block',
                                  fontWeight: 700,
                                  textTransform: 'uppercase',
                                  letterSpacing: '0.5px',
                                  mb: 1.5,
                                  color: 'text.primary',
                                  fontSize: theme.typography.customSizes.small,
                                }}
                              >
                                {label}
                              </Typography>
                              <Typography
                                variant="body2"
                                component="dd"
                                sx={{
                                  color: isEmpty ? 'text.disabled' : 'text.secondary',
                                  wordBreak: 'break-word',
                                  lineHeight: 1.6,
                                  fontSize: theme.typography.customSizes.medium,
                                  whiteSpace: isTextArea ? 'pre-wrap' : 'normal',
                                }}
                              >
                                {isEmpty ? '-' : String(value)}
                              </Typography>
                            </Box>
                          )
                        })}
                      </Box>
                    </Box>
                  ) : null}

                  {String(formData?.remarks_by_user || '').trim() !== '' && (
                    <Box
                      sx={{
                        p: 2.5,
                        borderRadius: 2,
                        backgroundColor: theme.palette.mode === 'dark'
                          ? 'rgba(255, 255, 255, 0.03)'
                          : 'rgba(0, 0, 0, 0.02)',
                        border: '1px solid',
                        borderColor: theme.palette.mode === 'dark'
                          ? 'rgba(255, 255, 255, 0.08)'
                          : 'rgba(0, 0, 0, 0.06)',
                      }}
                    >
                      <Typography
                        variant="caption"
                        component="dt"
                        sx={{
                          display: 'block',
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px',
                          mb: 1.5,
                          color: 'text.primary',
                          fontSize: theme.typography.customSizes.small,
                        }}
                      >
                        Remarks By User
                      </Typography>
                      <Typography
                        variant="body2"
                        component="dd"
                        sx={{
                          color: 'text.secondary',
                          wordBreak: 'break-word',
                          lineHeight: 1.6,
                          fontSize: theme.typography.customSizes.medium,
                        }}
                      >
                        {String(formData.remarks_by_user)}
                      </Typography>
                    </Box>
                  )}

                  {(() => {
                    const reason = formData?.reason_by_approver
                    const hasReason = typeof reason === 'string' && reason.trim() !== ''
                    if (!hasReason) return null

                    return (
                      <Box
                        sx={{
                          p: 2.5,
                          borderRadius: 2,
                          backgroundColor: theme.palette.mode === 'dark'
                            ? 'rgba(255, 255, 255, 0.03)'
                            : 'rgba(0, 0, 0, 0.02)',
                          border: '1px solid',
                          borderColor: theme.palette.mode === 'dark'
                            ? 'rgba(255, 255, 255, 0.08)'
                            : 'rgba(0, 0, 0, 0.06)',
                        }}
                      >
                          <Typography
                            variant="caption"
                            component="dt"
                            sx={{
                              display: 'block',
                              fontWeight: 700,
                              textTransform: 'uppercase',
                              letterSpacing: '0.5px',
                              mb: 1.5,
                              color: 'text.primary',
                              fontSize: theme.typography.customSizes.small,
                            }}
                          >
                            Reason by Approver
                          </Typography>
                          <Typography
                            variant="body2"
                            component="dd"
                            sx={{
                              color: 'text.primary',
                              fontWeight: 500,
                              fontSize: '0.875rem',
                              lineHeight: 1.6,
                              wordBreak: 'break-word',
                            }}
                          >
                            {reason}
                          </Typography>
                        </Box>
                    )
                  })()}
                </Box>
              </CardContent>
            </Card>
          )}

          {(needsDeficiencyResponse || deficiencyResponse) ? (
            <Card
              sx={{
                borderRadius: 3,
                boxShadow: theme.palette.mode === 'dark'
                  ? '0 4px 20px rgba(0, 0, 0, 0.3)'
                  : '0 2px 12px rgba(0, 0, 0, 0.08)',
                border: '1px solid',
                borderColor: theme.palette.mode === 'dark'
                  ? 'rgba(255, 255, 255, 0.12)'
                  : 'rgba(0, 0, 0, 0.08)',
                overflow: 'hidden',
              }}
            >
              <CardContent sx={{ p: 4 }}>
                <Typography
                  variant="h6"
                  component="h3"
                  sx={{
                    fontWeight: 700,
                    mb: 3,
                    color: 'text.primary',
                    fontSize: '1.25rem',
                    pb: 2,
                    borderBottom: '2px solid',
                    borderColor: 'divider',
                  }}
                >
                  Deficiency Response
                </Typography>

                {showDeficiencyActionNotice ? (
                  <Box sx={{ mb: 3, p: 2, borderRadius: 2, border: '1px solid', borderColor: 'warning.main', backgroundColor: 'warning.light', color: 'warning.contrastText' }}>
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>
                      Action required: approver marked this RACM as Not Effective.
                    </Typography>
                  </Box>
                ) : null}

                {deficiencyResponse ? (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, mb: canSubmitDeficiencyResponse ? 4 : 0 }}>
                    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' }, gap: 2 }}>
                      <Box sx={{ p: 2, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
                        <Typography variant="caption" sx={{ display: 'block', fontWeight: 700, mb: 1, color: 'text.secondary' }}>Response Type</Typography>
                        <Typography variant="body2" sx={{ color: 'text.primary' }}>
                          {String(deficiencyResponse.response_type || '').trim() === 'compensatory_racm' ? 'Compensatory RACM' : 'Mitigation Plan'}
                        </Typography>
                      </Box>
                      <Box sx={{ p: 2, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
                        <Typography variant="caption" sx={{ display: 'block', fontWeight: 700, mb: 1, color: 'text.secondary' }}>Status</Typography>
                        <Typography variant="body2" sx={{ color: 'text.primary' }}>
                          {String(deficiencyResponse.status || '').trim() || '-'}
                        </Typography>
                      </Box>
                    </Box>
                    <Box sx={{ p: 2, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
                      <Typography variant="caption" sx={{ display: 'block', fontWeight: 700, mb: 1, color: 'text.secondary' }}>Explaination</Typography>
                      <Typography variant="body2" sx={{ color: 'text.primary', whiteSpace: 'pre-wrap' }}>
                        {String(deficiencyCurrentSubmission?.explaination || deficiencyResponse.explaination || '').trim() || '-'}
                      </Typography>
                    </Box>
                    {(
                      String(deficiencyCurrentSubmission?.concerned_person || deficiencyResponse.concerned_person || '').trim()
                      || deficiencyCurrentSubmission?.due_date
                      || deficiencyResponse.due_date
                    ) ? (
                      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' }, gap: 2 }}>
                        <Box sx={{ p: 2, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
                          <Typography variant="caption" sx={{ display: 'block', fontWeight: 700, mb: 1, color: 'text.secondary' }}>Concerned Person</Typography>
                          <Typography variant="body2" sx={{ color: 'text.primary' }}>
                            {String(deficiencyCurrentSubmission?.concerned_person || deficiencyResponse.concerned_person || '').trim() || '-'}
                          </Typography>
                        </Box>
                        <Box sx={{ p: 2, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
                          <Typography variant="caption" sx={{ display: 'block', fontWeight: 700, mb: 1, color: 'text.secondary' }}>Due Date</Typography>
                          <Typography variant="body2" sx={{ color: 'text.primary' }}>
                            {(deficiencyCurrentSubmission?.due_date || deficiencyResponse.due_date)
                              ? formatDateOnly(deficiencyCurrentSubmission?.due_date || deficiencyResponse.due_date)
                              : '-'}
                          </Typography>
                        </Box>
                      </Box>
                    ) : null}
                    {deficiencyAttachments.length > 0 ? (
                      <Box sx={{ p: 2, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
                        <Typography variant="caption" sx={{ display: 'block', fontWeight: 700, mb: 1.5, color: 'text.secondary' }}>Documents</Typography>
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                          {deficiencyAttachments.map((attachment) => (
                            <Box key={attachment.id} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
                              <Typography variant="body2" sx={{ color: 'text.primary', overflowWrap: 'anywhere' }}>
                                {attachment.original_name || getFileName(attachment.file_url)}
                              </Typography>
                              <Button size="small" startIcon={<DownloadRoundedIcon />} onClick={() => handleDownloadUserDocument(attachment.file_url)} sx={{ textTransform: 'none' }}>
                                Download
                              </Button>
                            </Box>
                          ))}
                        </Box>
                      </Box>
                    ) : null}
                    {String(deficiencyResponse.review_comment || '').trim() ? (
                      <Box sx={{ p: 2, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
                        <Typography variant="caption" sx={{ display: 'block', fontWeight: 700, mb: 1, color: 'text.secondary' }}>Approver Comment</Typography>
                        <Typography variant="body2" sx={{ color: 'text.primary', whiteSpace: 'pre-wrap' }}>
                          {String(deficiencyResponse.review_comment)}
                        </Typography>
                      </Box>
                    ) : null}
                  </Box>
                ) : null}

                {canSubmitDeficiencyResponse ? (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
                    <TextField select label="Response Type" value={deficiencyResponseForm.response_type} onChange={(e) => handleDeficiencyResponseFieldChange('response_type', e.target.value)} fullWidth>
                      <MenuItem value="mitigation_plan">Mitigation Plan</MenuItem>
                      <MenuItem value="compensatory_racm">Compensatory RACM</MenuItem>
                    </TextField>
                    <TextField label="Explaination" value={deficiencyResponseForm.explaination} onChange={(e) => handleDeficiencyResponseFieldChange('explaination', e.target.value)} fullWidth multiline rows={4} />
                    {deficiencyResponseForm.response_type === 'mitigation_plan' ? (
                      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 2 }}>
                        <TextField label="Concerned Person (email or name)" value={deficiencyResponseForm.concerned_person} onChange={(e) => handleDeficiencyResponseFieldChange('concerned_person', e.target.value)} fullWidth />
                        <TextField type="date" label="Due Date" value={deficiencyResponseForm.due_date} onChange={(e) => handleDeficiencyResponseFieldChange('due_date', e.target.value)} InputLabelProps={{ shrink: true }} fullWidth />
                      </Box>
                    ) : (
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
                        <Button component="label" variant="outlined" startIcon={<CloudUploadIcon />} sx={{ alignSelf: 'flex-start', textTransform: 'none' }}>
                          Upload Documents
                          <input hidden type="file" multiple onChange={handleDeficiencyResponseFileSelect} />
                        </Button>
                        {deficiencyResponseFiles.map((file, index) => (
                          <Box key={`${file.name}-${file.size}-${file.lastModified}`} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <InsertDriveFileRoundedIcon fontSize="small" sx={{ color: 'primary.main', flexShrink: 0 }} />
                            <Typography variant="body2" sx={{ color: 'text.primary', flex: 1, overflowWrap: 'anywhere' }}>
                              {file.name}
                            </Typography>
                            <Tooltip title="Remove">
                              <IconButton size="small" onClick={() => handleRemoveDeficiencyResponseFile(index)}>
                                <DeleteRoundedIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </Box>
                        ))}
                      </Box>
                    )}
                    <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                      <Button onClick={handleSubmitDeficiencyResponse} variant="contained" disabled={deficiencyResponseSubmitting} sx={{ textTransform: 'none', fontWeight: 700 }}>
                        {deficiencyResponseSubmitting ? 'Submitting...' : (deficiencyResponse ? 'Resubmit Response' : 'Submit Response')}
                      </Button>
                    </Box>
                  </Box>
                ) : null}
              </CardContent>
            </Card>
          ) : null}
        </Box>
      </Box>

      {/* Create User Confirmation Dialog */}
      <Dialog
        open={createUserConfirmDialogOpen}
        onClose={handleCreateUserCancel}
        aria-labelledby="create-user-confirm-dialog-title"
        aria-describedby="create-user-confirm-dialog-description"
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
          id="create-user-confirm-dialog-title"
          sx={{
            pb: 2.5,
            pt: 3,
            px: 3,
            fontWeight: 600,
            fontSize: '1.25rem',
            color: theme.palette.text.primary,
          }}
        >
          User Not Found
        </DialogTitle>
        <DialogContent sx={{ px: 3, pt: 3, pb: 3 }}>
          <DialogContentText
            id="create-user-confirm-dialog-description"
            sx={{
              color: theme.palette.text.secondary,
              fontSize: '0.9375rem',
              lineHeight: 1.5,
              m: 0,
              mb: 2,
            }}
          >
          User with email <strong>{processOwnerEmail}</strong> does not exist as a user in your company (with role set to &quot;user&quot;). Please create a user account to proceed with setting the RACM to Active.
          </DialogContentText>
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
            onClick={handleCreateUserCancel}
            variant="outlined"
            disabled={creatingUser}
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
            onClick={handleCreateUserConfirm}
            variant="contained"
            color="secondary"
            autoFocus
            disabled={creatingUser}
            sx={{
              textTransform: 'none',
              px: 3,
              py: 1,
              minWidth: '100px',
              fontWeight: 600,
              '&:hover': {
                backgroundColor: theme.palette.mode === 'dark'
                  ? '#0284c7'
                  : '#0369a1',
              },
            }}
          >
            {creatingUser ? 'Creating...' : 'Create User + Set RACM Active'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Sample Documents Dialog */}
      <Dialog
        open={sampleDocsDialogOpen}
        onClose={handleCloseSampleDocsDialog}
        aria-labelledby="sample-documents-dialog-title"
        PaperProps={{
          sx: {
            borderRadius: 2,
            minWidth: { xs: '94%', sm: '640px' },
            maxWidth: '720px',
            boxShadow: theme.palette.mode === 'dark'
              ? '0 8px 32px rgba(0, 0, 0, 0.4)'
              : '0 8px 32px rgba(0, 0, 0, 0.12)',
          },
        }}
      >
        <DialogTitle
          id="sample-documents-dialog-title"
          sx={{
            pb: 2.5,
            pt: 3,
            px: 3,
            fontWeight: 700,
            fontSize: '1.25rem',
            color: theme.palette.text.primary,
          }}
        >
          Sample Documents ({sampleDocCount})
        </DialogTitle>
        <DialogContent dividers sx={{ px: 3, pt: 2.5, pb: 3 }}>
          {sampleDocs.length > 0 ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
              {sampleDocs.map((doc, index) => (
                <Box
                  key={doc.id || `${doc.sample_doc}-${index}`}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.5,
                    p: 1.5,
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: 1,
                  }}
                >
                  <InsertDriveFileRoundedIcon color="action" />
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography
                      variant="body2"
                      sx={{
                        fontWeight: 600,
                        color: 'text.primary',
                        overflowWrap: 'anywhere',
                      }}
                    >
                      {getFileName(doc.sample_doc)}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {doc.created_at ? formatDateTime(doc.created_at) : 'Uploaded document'}
                    </Typography>
                  </Box>
                  <Tooltip title="Download">
                    <span>
                      <IconButton
                        size="small"
                        onClick={() => handleDownloadSampleDocument(doc.sample_doc)}
                        disabled={uploadingSampling || Boolean(deletingSampleDocId)}
                        aria-label={`Download ${getFileName(doc.sample_doc)}`}
                      >
                        <DownloadRoundedIcon fontSize="small" />
                      </IconButton>
                    </span>
                  </Tooltip>
                  <Tooltip title="Delete">
                    <span>
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => handleDeleteSampleDocument(doc)}
                        disabled={uploadingSampling || Boolean(deletingSampleDocId)}
                        aria-label={`Delete ${getFileName(doc.sample_doc)}`}
                      >
                        <DeleteRoundedIcon fontSize="small" />
                      </IconButton>
                    </span>
                  </Tooltip>
                </Box>
              ))}
            </Box>
          ) : (
            <Typography variant="body2" color="text.secondary">
              No sample documents uploaded.
            </Typography>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
          <Button onClick={handleCloseSampleDocsDialog} disabled={uploadingSampling || Boolean(deletingSampleDocId)}>
            Close
          </Button>
          <Button
            variant="contained"
            color="secondary"
            startIcon={<CloudUploadIcon />}
            onClick={handleSamplingUploadClick}
            disabled={uploadingSampling || Boolean(deletingSampleDocId) || isEditMode}
          >
            {uploadingSampling ? 'Uploading...' : 'Upload Documents'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* User Uploaded Documents Dialog */}
      <Dialog
        open={userDocsDialogOpen}
        onClose={handleCloseUserDocsDialog}
        aria-labelledby="user-documents-dialog-title"
        PaperProps={{
          sx: {
            borderRadius: 2,
            minWidth: { xs: '94%', sm: '640px' },
            maxWidth: '720px',
            boxShadow: theme.palette.mode === 'dark'
              ? '0 8px 32px rgba(0, 0, 0, 0.4)'
              : '0 8px 32px rgba(0, 0, 0, 0.12)',
          },
        }}
      >
        <DialogTitle
          id="user-documents-dialog-title"
          sx={{
            pb: 2.5,
            pt: 3,
            px: 3,
            fontWeight: 700,
            fontSize: '1.25rem',
            color: theme.palette.text.primary,
          }}
        >
          User Uploaded Documents ({userDocCount})
        </DialogTitle>
        <DialogContent dividers sx={{ px: 3, pt: 2.5, pb: 3 }}>
          {userDocs.length > 0 ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
              {userDocs.map((doc, index) => {
                const docPath = doc.doc_uploaded_by_user
                return (
                  <Box
                    key={doc.id || `${docPath}-${index}`}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1.5,
                      p: 1.5,
                      border: '1px solid',
                      borderColor: 'divider',
                      borderRadius: 1,
                    }}
                  >
                    <InsertDriveFileRoundedIcon color="action" />
                    <Box sx={{ minWidth: 0, flex: 1 }}>
                      <Typography
                        variant="body2"
                        sx={{
                          fontWeight: 600,
                          color: 'text.primary',
                          overflowWrap: 'anywhere',
                        }}
                      >
                        {getFileName(docPath)}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {doc.created_at ? formatDateTime(doc.created_at) : 'Uploaded document'}
                      </Typography>
                    </Box>
                    <Tooltip title="Download">
                      <span>
                        <IconButton
                          size="small"
                          onClick={() => handleDownloadUserDocument(docPath)}
                          aria-label={`Download ${getFileName(docPath)}`}
                        >
                          <DownloadRoundedIcon fontSize="small" />
                        </IconButton>
                      </span>
                    </Tooltip>
                  </Box>
                )
              })}
            </Box>
          ) : (
            <Typography variant="body2" color="text.secondary">
              No user uploaded documents available.
            </Typography>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={handleCloseUserDocsDialog}>
            Close
          </Button>
        </DialogActions>
      </Dialog>

      {/* RACM Assignment Dialog */}
      <Dialog
        open={assignmentDialogOpen}
        onClose={handleCloseAssignmentDialog}
        aria-labelledby="racm-assignment-dialog-title"
        PaperProps={{
          sx: {
            borderRadius: 2,
            minWidth: { xs: '96%', sm: '760px', md: '860px' },
            maxWidth: '960px',
            boxShadow: theme.palette.mode === 'dark'
              ? '0 8px 32px rgba(0, 0, 0, 0.4)'
              : '0 8px 32px rgba(0, 0, 0, 0.12)',
          },
        }}
      >
        <DialogTitle
          id="racm-assignment-dialog-title"
          sx={{
            pb: 2.5,
            pt: 3,
            px: 3,
            fontWeight: 700,
            fontSize: '1.25rem',
            color: theme.palette.text.primary,
          }}
        >
          RACM Assignment
        </DialogTitle>
        <DialogContent dividers sx={{ px: 3, pt: 2.5, pb: 3 }}>
          {formData && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              <Box sx={popupRowSx}>
                <Typography variant="body2" component="span" sx={popupLabelSx}>Business Process:</Typography>
                <Typography variant="body2" component="span">{popupValue(formData.business_process)}</Typography>
              </Box>
              <Box sx={popupRowSx}>
                <Typography variant="body2" component="span" sx={popupLabelSx}>Financial Year:</Typography>
                <Typography variant="body2" component="span">{popupValue(formData.financial_year)}</Typography>
              </Box>
              <Box sx={popupRowSx}>
                <Typography variant="body2" component="span" sx={popupLabelSx}>Current Control Owner Email:</Typography>
                <Typography variant="body2" component="span">{popupValue(formData.control_owner)}</Typography>
              </Box>
              <Box sx={{ ...popupRowSx, mb: 2 }}>
                <Typography variant="body2" component="span" sx={popupLabelSx}>Current Control Owner Name:</Typography>
                <Typography variant="body2" component="span">
                  {popupValue(formData.control_owner_name || formatNameFromEmail(formData.control_owner))}
                </Typography>
              </Box>

              <Autocomplete
                options={assignableUsers}
                loading={usersLoading}
                value={selectedUser}
                inputValue={userSearchText}
                onInputChange={(_, newInputValue) => {
                  if (!isActive) setUserSearchText(newInputValue)
                }}
                onChange={(_, newValue) => {
                  if (!isActive) setSelectedUser(newValue)
                }}
                disabled={isActive}
                getOptionLabel={(option) =>
                  option?.emp_name?.trim() || formatNameFromEmail(option?.email_id) || option?.email_id || ''
                }
                isOptionEqualToValue={(option, value) => option.email_id === value.email_id}
                filterOptions={(options, state) => {
                  const input = state.inputValue.trim().toLowerCase()
                  if (!input) return options
                  return options.filter((user) =>
                    (user.emp_name || '').toLowerCase().includes(input)
                  )
                }}
                renderOption={(props, option) => (
                  <Box component="li" {...props}>
                    <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                      <Typography variant="body2">
                        {option?.emp_name?.trim() || formatNameFromEmail(option?.email_id) || '-'}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {option.email_id || '-'}
                      </Typography>
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
              <Typography
                variant="caption"
                sx={{
                  display: 'block',
                  mt: 0.5,
                  color: 'text.secondary',
                  lineHeight: 1.6,
                }}
              >
                RACM will be set to Active automatically after assignment if all conditions are fulfilled.
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={handleCloseAssignmentDialog} disabled={updating}>
            Cancel
          </Button>
          {selectedUser?.email_id && (
            <Button
              variant="contained"
              color="secondary"
              onClick={handleUpdateAssignment}
              disabled={updating || isActive}
            >
              {updating ? 'Updating...' : 'Update Assignment'}
            </Button>
          )}
        </DialogActions>
      </Dialog>

      <Dialog
        open={suggestedChangesDialogOpen}
        onClose={handleCloseSuggestedChangesDialog}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 700 }}>
          Suggested Changes
        </DialogTitle>
        <DialogContent dividers>
          {String(activeChangeRequest?.requested_by_display || '').trim() ? (
            <Box sx={{ mb: 2 }}>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                Requested by: {activeChangeRequest.requested_by_display}
              </Typography>
            </Box>
          ) : null}
          {String(activeChangeRequest?.request_reason || '').trim() ? (
            <Box sx={{ mb: 2.5 }}>
              <Typography sx={{ fontWeight: 700, color: 'text.primary', mb: 0.75 }}>
                Reason for Change
              </Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary', whiteSpace: 'pre-wrap' }}>
                {activeChangeRequest.request_reason}
              </Typography>
              <Divider sx={{ mt: 2.5 }} />
            </Box>
          ) : null}
          {Array.isArray(activeChangeRequest?.items) && activeChangeRequest.items.length > 0 ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {activeChangeRequest.items.map((item) => {
                const decision = reviewDecisions[item.id] || { status: '', rejection_reason: '' }
                return (
                  <Box
                    key={item.id}
                    sx={{
                      border: '1px solid',
                      borderColor: 'divider',
                      borderRadius: 2,
                      p: 2,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 1.5,
                    }}
                    >
                      <Typography sx={{ fontWeight: 700, color: 'text.primary' }}>
                        {item.field_label || item.field_db_name}
                      </Typography>
                    <Box
                      sx={{
                        display: 'grid',
                        gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
                        gap: 2,
                      }}
                    >
                      <Box>
                        <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary' }}>
                          Current Value
                        </Typography>
                        <Typography variant="body2" sx={{ color: 'text.primary', whiteSpace: 'pre-wrap', mt: 0.5 }}>
                          {String(item.old_value_text || '').trim() || '-'}
                        </Typography>
                      </Box>
                      <Box>
                        <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary' }}>
                          Suggested Value
                        </Typography>
                        <Typography variant="body2" sx={{ color: 'text.primary', whiteSpace: 'pre-wrap', mt: 0.5 }}>
                          {String(item.new_value_text || '').trim() || '-'}
                        </Typography>
                      </Box>
                    </Box>
                    <RadioGroup
                      row
                      value={decision.status || ''}
                      onChange={(e) => handleReviewDecisionChange(item.id, 'status', e.target.value)}
                    >
                      <FormControlLabel value="Approved" control={<Radio />} label="Approve" />
                      <FormControlLabel value="Rejected" control={<Radio />} label="Reject" />
                    </RadioGroup>
                    {decision.status === 'Rejected' ? (
                      <TextField
                        label="Rejection Reason"
                        value={decision.rejection_reason || ''}
                        onChange={(e) => handleReviewDecisionChange(item.id, 'rejection_reason', e.target.value)}
                        fullWidth
                        multiline
                        rows={3}
                      />
                    ) : null}
                  </Box>
                )
              })}
            </Box>
          ) : (
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              No active suggested changes found.
            </Typography>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={handleCloseSuggestedChangesDialog} disabled={reviewSaving}>
            Close
          </Button>
          <Button
            onClick={handleSubmitSuggestedChangesReview}
            variant="contained"
            color="warning"
            disabled={reviewSaving || !activeChangeRequest?.request_id || !areAllSuggestedChangesDecided}
          >
            {reviewSaving ? 'Submitting...' : 'Submit'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={changeRequestHistoryDialogOpen}
        onClose={handleCloseChangeRequestHistoryDialog}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 700 }}>
          Change Requests
        </DialogTitle>
        <DialogContent dividers>
          {changeRequestHistory.length > 0 ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {changeRequestHistory.map((request) => {
                const isExpanded = Boolean(expandedHistoryRequestIds[request.request_id])
                return (
                  <Box
                    key={request.request_id}
                    sx={{
                      border: '1px solid',
                      borderColor: 'divider',
                      borderRadius: 2,
                      overflow: 'hidden',
                    }}
                  >
                    <Button
                      fullWidth
                      onClick={() => handleToggleHistoryRequest(request.request_id)}
                      sx={{
                        justifyContent: 'space-between',
                        textTransform: 'none',
                        px: 2,
                        py: 1.5,
                        color: 'text.primary',
                        fontWeight: 700,
                      }}
                    >
                      <Box sx={{ textAlign: 'left' }}>
                        <Typography sx={{ fontWeight: 700 }}>
                          {request.request_id}
                        </Typography>
                        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                          {String(request.status || '').trim() || '-'}
                        </Typography>
                        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                          Requested on: {request.requested_at ? formatDateTime(request.requested_at) : '-'}
                        </Typography>
                        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                          Requested by: {String(request.requested_by_display || request.requested_by_email || '').trim() || '-'}
                        </Typography>
                      </Box>
                      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                        {isExpanded ? 'Hide' : 'View'}
                      </Typography>
                    </Button>
                    {isExpanded ? (
                      <Box sx={{ px: 2, pb: 2 }}>
                        {String(request.request_reason || '').trim() ? (
                          <Box sx={{ mb: 2 }}>
                            <Typography sx={{ fontWeight: 700, color: 'text.primary', mb: 0.75 }}>
                              Reason for Change
                            </Typography>
                            <Typography variant="body2" sx={{ color: 'text.secondary', whiteSpace: 'pre-wrap' }}>
                              {request.request_reason}
                            </Typography>
                          </Box>
                        ) : null}
                        <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
                          Requested by: {String(request.requested_by_display || request.requested_by_email || '').trim() || '-'}
                        </Typography>
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                          {(Array.isArray(request.items) ? request.items : []).map((item) => (
                            <Box
                              key={item.id}
                              sx={{
                                border: '1px solid',
                                borderColor: 'divider',
                                borderRadius: 2,
                                p: 2,
                              }}
                            >
                              <Typography sx={{ fontWeight: 700, color: 'text.primary', mb: 1 }}>
                                {item.field_label || item.field_db_name}
                              </Typography>
                              <Box
                                sx={{
                                  display: 'grid',
                                  gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
                                  gap: 2,
                                  mb: 1.5,
                                }}
                              >
                                <Box>
                                  <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary' }}>
                                    Old Value
                                  </Typography>
                                  <Typography variant="body2" sx={{ color: 'text.primary', whiteSpace: 'pre-wrap', mt: 0.5 }}>
                                    {String(item.old_value_text || '').trim() || '-'}
                                  </Typography>
                                </Box>
                                <Box>
                                  <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary' }}>
                                    New Value
                                  </Typography>
                                  <Typography variant="body2" sx={{ color: 'text.primary', whiteSpace: 'pre-wrap', mt: 0.5 }}>
                                    {String(item.new_value_text || '').trim() || '-'}
                                  </Typography>
                                </Box>
                              </Box>
                              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                                Status: {String(item.status || '').trim() || '-'}
                              </Typography>
                              {String(item.rejection_reason || '').trim() ? (
                                <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.75, whiteSpace: 'pre-wrap' }}>
                                  Reason: {item.rejection_reason}
                                </Typography>
                              ) : null}
                            </Box>
                          ))}
                        </Box>
                      </Box>
                    ) : null}
                  </Box>
                )
              })}
            </Box>
          ) : (
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              No change request history found.
            </Typography>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={handleCloseChangeRequestHistoryDialog}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* More Actions Dialog */}
      <Dialog
        open={moreActionsDialogOpen}
        onClose={handleMoreActionsClose}
        aria-labelledby="more-actions-dialog-title"
        aria-describedby="more-actions-dialog-description"
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
          id="more-actions-dialog-title"
          sx={{ pb: 2, pt: 3, px: 3, fontWeight: 600, fontSize: '1.25rem', color: theme.palette.text.primary }}
        >
          More Actions
        </DialogTitle>
        <DialogContent sx={{ px: 3, pt: 1, pb: 3 }}>
          <DialogContentText
            id="more-actions-dialog-description"
            sx={{ color: theme.palette.text.secondary, fontSize: '0.9375rem', lineHeight: 1.5, m: 0, mb: 2 }}
          >
            Choose an action for this RACM.
          </DialogContentText>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Box sx={{ p: 2, borderRadius: 1.5, border: '1px solid', borderColor: 'divider' }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.75 }}>
                Delete
              </Typography>
              <Typography variant="body2" color="text.secondary">
                This RACM will be removed permanently, including all sample documents and user-uploaded documents from storage and the database.
              </Typography>
            </Box>
            <Box sx={{ p: 2, borderRadius: 1.5, border: '1px solid', borderColor: 'divider' }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.75 }}>
                Replicate
              </Typography>
              <Typography variant="body2" color="text.secondary">
                A duplicate RACM with the same structure and details will be generated.
              </Typography>
            </Box>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3, pt: 2.5, gap: 1.5, borderTop: '1px solid', borderColor: 'divider' }}>
          <Button onClick={handleMoreActionsClose} variant="outlined">
            Cancel
          </Button>
          <Button onClick={handleChooseDeleteFromMore} variant="outlined" color="error">
            Delete
          </Button>
          <Button onClick={handleChooseReplicateFromMore} variant="contained" color="secondary">
            Replicate
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
          sx={{ pb: 2.5, pt: 3, px: 3, fontWeight: 600, fontSize: '1.25rem', color: theme.palette.text.primary }}
        >
          Replicate RACM
        </DialogTitle>
        <DialogContent sx={{ px: 3, pt: 3, pb: 3 }}>
          <DialogContentText
            id="replicate-dialog-description"
            sx={{ color: theme.palette.text.secondary, fontSize: '0.9375rem', lineHeight: 1.5, m: 0, mb: 2 }}
          >
            Select the target Financial Year for the replicated RACM.
          </DialogContentText>

          <FormControl fullWidth variant="outlined" disabled={replicating}>
            <InputLabel id="replicate-fy-label">Financial Year</InputLabel>
            <Select
              labelId="replicate-fy-label"
              id="replicate-fy"
              value={replicateTargetFY}
              label="Financial Year"
              onChange={(e) => setReplicateTargetFY(e.target.value)}
            >
              <MenuItem value="">Select</MenuItem>
              {parseNextTwoFYs(formData?.financial_year).map((opt) => (
                <MenuItem key={opt} value={opt}>{opt}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3, pt: 2.5, gap: 1.5, borderTop: '1px solid', borderColor: 'divider' }}>
          <Button
            onClick={() => {
              if (!replicating) {
                setReplicateDialogOpen(false)
                setReplicateTargetFY('')
              }
            }}
            variant="outlined"
            disabled={replicating}
          >
            Cancel
          </Button>
          <Button onClick={handleReplicateConfirm} variant="contained" color="secondary" disabled={replicating || !replicateTargetFY}>
            {replicating ? 'Replicating...' : 'Replicate'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Replicate Success Redirect Dialog */}
      <Dialog
        open={replicateSuccessDialogOpen}
        onClose={() => setReplicateSuccessDialogOpen(false)}
        aria-labelledby="replicate-success-dialog-title"
        aria-describedby="replicate-success-dialog-description"
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
          id="replicate-success-dialog-title"
          sx={{
            pb: 2.5,
            pt: 3,
            px: 3,
            fontWeight: 600,
            fontSize: '1.25rem',
            color: theme.palette.text.primary,
          }}
        >
          Open the replicated RACM now?
        </DialogTitle>
        <DialogContent sx={{ px: 3, pt: 3, pb: 3 }}>
          <DialogContentText
            id="replicate-success-dialog-description"
            sx={{
              color: theme.palette.text.secondary,
              fontSize: '0.9375rem',
              lineHeight: 1.5,
              m: 0,
              mb: 2,
            }}
          >
            Replication finished. You can continue here or jump straight to the new RACM detail view.
          </DialogContentText>
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
            onClick={() => setReplicateSuccessDialogOpen(false)}
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
            No
          </Button>
          <Button
            onClick={handleGoToReplicatedRacm}
            variant="contained"
            color="secondary"
            autoFocus
            sx={{
              textTransform: 'none',
              px: 3,
              py: 1,
              minWidth: '100px',
              fontWeight: 600,
            }}
          >
            Yes
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
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
          Delete RACM
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
            Are you sure you want to delete this RACM? This action cannot be undone. The form, all sample documents, all user-uploaded documents, and their database rows will be removed permanently.
          </DialogContentText>
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
              '&:hover': {
                backgroundColor: '#c62828',
              },
              '&:disabled': {
                opacity: 0.6,
              },
            }}
          >
            {deleting ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>

      <RacmAuditLogsDialog
        open={auditLogOpen}
        onClose={() => setAuditLogOpen(false)}
        loading={auditLogLoading}
        error={auditLogError}
        rows={auditLogRows}
      />

      {showScrollTop && (
        <Fab
          aria-label="scroll to top"
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          sx={{
            position: 'fixed',
            right: { xs: 16, sm: 24 },
            bottom: { xs: 16, sm: 24 },
            zIndex: (t) => t.zIndex.modal + 1,
            backgroundColor: (t) => (t.palette.mode === 'dark' ? '#0b1220' : '#ffffff'),
            color: (t) => (t.palette.mode === 'dark' ? '#ffffff' : '#111827'),
            border: (t) =>
              `1px solid ${t.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.28)' : 'rgba(17, 24, 39, 0.35)'}`,
            boxShadow: (t) =>
              t.palette.mode === 'dark'
                ? '0 8px 24px rgba(0, 0, 0, 0.45)'
                : '0 8px 24px rgba(0, 0, 0, 0.12)',
            '&:hover': {
              backgroundColor: (t) => (t.palette.mode === 'dark' ? '#111827' : '#f9fafb'),
            },
          }}
        >
          <KeyboardArrowUpIcon />
        </Fab>
      )}
    </Box>
  )
}

export default FormDetail
