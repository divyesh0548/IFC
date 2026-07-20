import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTheme } from '@mui/material/styles'
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import Fab from '@mui/material/Fab';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import { DatePicker } from '@mui/x-date-pickers/DatePicker'
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
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
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import HistoryRoundedIcon from '@mui/icons-material/HistoryRounded';
import InsertDriveFileRoundedIcon from '@mui/icons-material/InsertDriveFileRounded';
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import CloseIcon from '@mui/icons-material/Close';
import { toast } from 'react-hot-toast'
import * as XLSX from 'xlsx'
import dayjs from 'dayjs'
import {
  FORM_DETAIL_ACTION_BAR_SX,
  FORM_DETAIL_CONTENT_STACK_SX,
  FORM_DETAIL_ROOT_SX,
  formatRacmApprovalStatusLabel,
} from '../../uiConstants'
import UnitUserSearchAutocomplete from '../../components/company_co/UnitUserSearchAutocomplete'
import CompanyUserSearchAutocomplete from '../../components/company_co/CompanyUserSearchAutocomplete'
import { fetchUnitUsers } from '../../components/company_co/unitUserSearch'
import { RACM_FIELD_LABELS, orderControlDetailKeys, APPROVAL_SECTION_FIELD_KEYS, getPopulatedApprovalSectionFields, hasPopulatedApprovalSectionFields, hasRacmFieldValue, hasValidProcessOwnerAssignment, isCoordinatorAssignedRacm, getRacmReassignmentBlockMessage, getRejectedResubmitEligibility, REJECTED_RESUBMIT_MESSAGE, DESIGN_IMPLEMENTATION_SECTION_TITLE, DOCUMENTS_APPROVAL_SECTION_TITLE, DOCUMENTS_APPROVAL_REMARKS_ROW_SX } from '../../racmFormDetailFields'
import { useSyncGlobalLoading } from '../../contexts/GlobalLoadingContext'
import { RacmTemplateSectionFields } from '../../components/racm/RacmTemplateSectionFields'
import { RacmAuditLogsDialog } from '../../components/racm/RacmAuditLogsDialog'
import ChangeRequestHistoryList from '../../components/racm/ChangeRequestHistoryList'
import ProcessOwnerDeclarationAction from '../../components/racm/ProcessOwnerDeclarationAction'
import ProcessOwnerDeclarationBadge from '../../components/racm/ProcessOwnerDeclarationBadge'
import { formatChangeRequestDisplayValue } from '../../lib/changeRequestHistory'
import { formatIndianDateTime } from '../../lib/dateTime'
import { apiUrl, API_BASE_URL } from '../../config/api'
import { formatDisplayName } from '../../utils/displayName'
import {
  getEffectiveSampleSizeForFrequency,
  getSampleSizeInputFeedback,
  validateSampleSizeForFrequency,
} from '../../utils/controlFrequencyValidation'
import { useControlFrequencyOptions } from '../../hooks/useControlFrequencyOptions'
import {
  DOCUMENT_UPLOAD_ACCEPT,
  DOCUMENT_UPLOAD_INVALID_SIZE_MESSAGE,
  DOCUMENT_UPLOAD_INVALID_TYPE_MESSAGE,
  validateDocumentUploadFiles,
} from '../../lib/documentUploadRestrictions'
import { formatRacmUserDocumentSubtitle, normalizeRacmUserDocuments, normalizeSampleDocuments } from '../../lib/racmUserDocuments'

function formatNameWithEmail(name, email) {
  const normalizedName = String(name || '').trim()
  const normalizedEmail = String(email || '').trim()

  if (normalizedName && normalizedEmail && normalizedName.toLowerCase() !== normalizedEmail.toLowerCase()) {
    return `${normalizedName} (${normalizedEmail})`
  }

  return normalizedName || normalizedEmail || '-'
}

function getDefaultDeficiencyResponseForm() {
  return {
    response_type: 'mitigation_plan',
    explaination: '',
    concerned_person: '',
    due_date: '',
  }
}

function buildDeficiencyResponseFormState(data, fallbackResponseType = 'mitigation_plan') {
  const currentDeficiencySubmission = data?.deficiency_response?.current_submission
  const currentSubmissionStatus = String(currentDeficiencySubmission?.status || '').trim().toLowerCase()

  if (currentSubmissionStatus !== 'submitted') {
    return {
      ...getDefaultDeficiencyResponseForm(),
      response_type: fallbackResponseType || 'mitigation_plan',
    }
  }

  return {
    response_type: currentDeficiencySubmission?.submission_type || data?.deficiency_response?.response_type || fallbackResponseType || 'mitigation_plan',
    explaination: currentDeficiencySubmission?.explaination || data?.deficiency_response?.explaination || '',
    concerned_person: currentDeficiencySubmission?.concerned_person || data?.deficiency_response?.concerned_person || '',
    due_date: currentDeficiencySubmission?.due_date
      ? String(currentDeficiencySubmission.due_date).slice(0, 10)
      : data?.deficiency_response?.due_date
        ? String(data.deficiency_response.due_date).slice(0, 10)
        : '',
  }
}

function FormDetail() {
  const theme = useTheme()
  const navigate = useNavigate()
  const { form_id } = useParams()
  const [formData, setFormData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [updating, setUpdating] = useState(false)
  const [isEditMode, setIsEditMode] = useState(false)
  const [editableFields, setEditableFields] = useState({})
  const [unitSampleSizeSettings, setUnitSampleSizeSettings] = useState([])
  const { controlFrequencyOptions } = useControlFrequencyOptions()
  const [saving, setSaving] = useState(false)
  const [uploadingSampling, setUploadingSampling] = useState(false)
  const [samplingExists, setSamplingExists] = useState(false)
  const [sampleDocsDialogOpen, setSampleDocsDialogOpen] = useState(false)
  const [userDocsDialogOpen, setUserDocsDialogOpen] = useState(false)
  const [deletingSampleDocId, setDeletingSampleDocId] = useState(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [setActiveConfirmDialogOpen, setSetActiveConfirmDialogOpen] = useState(false)
  const [setInactiveConfirmDialogOpen, setSetInactiveConfirmDialogOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [moreActionsDialogOpen, setMoreActionsDialogOpen] = useState(false)
  const [selfAssignConfirmDialogOpen, setSelfAssignConfirmDialogOpen] = useState(false)
  const [selfAssigning, setSelfAssigning] = useState(false)
  const [validProcessOwnerAssigned, setValidProcessOwnerAssigned] = useState(false)
  const [remarksByUser, setRemarksByUser] = useState('')
  const [remarksDraftDirty, setRemarksDraftDirty] = useState(false)
  const [selectedSubmissionFiles, setSelectedSubmissionFiles] = useState([])
  const [uploadingSubmissionDocuments, setUploadingSubmissionDocuments] = useState(false)
  const [submittingForApproval, setSubmittingForApproval] = useState(false)
  const [replicateDialogOpen, setReplicateDialogOpen] = useState(false)
  const [replicateTargetFY, setReplicateTargetFY] = useState('')
  const [replicating, setReplicating] = useState(false)
  const [replicateSuccessDialogOpen, setReplicateSuccessDialogOpen] = useState(false)
  const [newReplicatedFormId, setNewReplicatedFormId] = useState('')
  const [scheduleFields, setScheduleFields] = useState({
    due_date: '',
    reminder_frequency: '',
    custom_days: ''
  })
  const [savingSchedule, setSavingSchedule] = useState(false)
  const fileInputRef = useRef(null)
  const [assignmentDialogOpen, setAssignmentDialogOpen] = useState(false)
  const [selectedUser, setSelectedUser] = useState(null)
  const [approverAssignmentDialogOpen, setApproverAssignmentDialogOpen] = useState(false)
  const [selectedApprover, setSelectedApprover] = useState(null)
  const [assigningApprover, setAssigningApprover] = useState(false)
  const [processOwnerName, setProcessOwnerName] = useState('-')
  const [performerDisplayName, setPerformerDisplayName] = useState('-')
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
  const [deficiencyResponseForm, setDeficiencyResponseForm] = useState({
    response_type: 'mitigation_plan',
    explaination: '',
    concerned_person: '',
    due_date: '',
  })
  const [deficiencyResponseFiles, setDeficiencyResponseFiles] = useState([])
  const [deficiencyResponseSubmitting, setDeficiencyResponseSubmitting] = useState(false)
  const [expandedDeficiencyVersions, setExpandedDeficiencyVersions] = useState({})
  const [editableDynamicValues, setEditableDynamicValues] = useState({})
  useSyncGlobalLoading(
    loading ||
    updating ||
    saving ||
    uploadingSampling ||
    Boolean(deletingSampleDocId) ||
    deleting ||
    replicating ||
    savingSchedule ||
    activeChangeRequestLoading ||
    reviewSaving ||
    changeRequestHistoryLoading ||
    auditLogLoading ||
    deficiencyResponseSubmitting ||
    selfAssigning ||
    uploadingSubmissionDocuments ||
    submittingForApproval
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
    setRemarksDraftDirty(false)
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
        console.log('formData', data.data)
        if (!remarksDraftDirty) {
          setRemarksByUser(data.data?.remarks_by_user || '')
        }
        // Check if sampling document exists
        const samplingCheck = await checkSamplingExists()
        setSamplingExists(samplingCheck)
        setDeficiencyResponseForm(buildDeficiencyResponseFormState(data.data))
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

  const normalizeRole = (value) => String(value || '').trim().toLowerCase()

  useEffect(() => {
    if (!formData || isCoordinatorAssignedRacm(formData)) {
      setValidProcessOwnerAssigned(false)
      return
    }

    if (formData.has_valid_process_owner_assignment !== undefined && formData.has_valid_process_owner_assignment !== null) {
      setValidProcessOwnerAssigned(hasValidProcessOwnerAssignment(formData))
      return
    }

    const email = String(formData.control_owner || '').trim()
    if (!email) {
      setValidProcessOwnerAssigned(false)
      return
    }

    let cancelled = false
    ;(async () => {
      const racmUnitId = formData?.unit_id ? String(formData.unit_id).trim() : ''
      const ownerCheck = await checkUserRole(email, racmUnitId)
      if (cancelled) return
      const isValid =
        ownerCheck.exists
        && normalizeRole(ownerCheck.role) === 'user'
        && ownerCheck.in_unit !== false
      setValidProcessOwnerAssigned(isValid)
    })()

    return () => {
      cancelled = true
    }
  }, [
    formData?.form_id,
    formData?.control_owner,
    formData?.assigned_to_coordinator,
    formData?.has_valid_process_owner_assignment,
    formData?.unit_id,
  ])

  const handleToggleActive = async () => {
    if (!formData) return

    // Determine new active status
    const isCurrentlyActive = Boolean(formData?.active)
    const newActiveStatus = isCurrentlyActive ? '0' : '1'

    if (newActiveStatus === '1') {
      await validateAndToggleActive(newActiveStatus)
      return
    }

    setSetInactiveConfirmDialogOpen(true)
  }

  const validateAndToggleActive = async (newActiveStatus) => {
    const isCoordinatorAssignedRacm = Boolean(formData?.assigned_to_coordinator)

    // Only validate when setting to active
    if (newActiveStatus === '1') {
      const dueDate = formData.due_date?.trim?.() ?? (formData.due_date ? String(formData.due_date).slice(0, 10) : '')
      const reminderFrequency = formData.reminder_frequency?.trim?.() ?? String(formData.reminder_frequency || '').trim()

      if (isCoordinatorAssignedRacm) {
        if (!dueDate || !reminderFrequency) {
          toast.error('Configure Reminder settings')
          return
        }
      } else {
        const processOwnerEmailValue = formData.control_owner?.trim()

        if (!processOwnerEmailValue || processOwnerEmailValue === '') {
          toast.error('RACM Assignment is remaining')
          return
        }

        if (processOwnerEmailValue) {
          const racmUnitId = formData?.unit_id ? String(formData.unit_id).trim() : ''
          const ownerCheck = await checkUserRole(processOwnerEmailValue, racmUnitId)

          if (!ownerCheck.exists) {
            toast.error('Process Owner user does not exist. Please create the user via User Management first.')
            return
          }

          if (normalizeRole(ownerCheck.role) !== 'user') {
            toast.error('Process Owner must be a normal user')
            return
          }

          if (racmUnitId && ownerCheck.in_unit === false) {
            toast.error('Process Owner is not assigned to this RACM\'s unit')
            return
          }

          if (!ownerCheck.has_valid_mobile) {
            toast.error(ownerCheck.mobile_error || 'Process Owner does not have a valid mobile number')
            return
          }
        }

        if (!dueDate || dueDate === '' || !reminderFrequency || reminderFrequency === '') {
          toast.error('Configure Reminder settings')
          return
        }
      }
    }

    if (newActiveStatus === '1' && !hasSampleDocs()) {
      toast('Sample document is missing. Proceeding to set Active.')
    }

    setSetActiveConfirmDialogOpen(true)
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
        initialFields[key] = formData[key] ?? ''
      }
    })
    setEditableDynamicValues(formData.dynamic_values || {})
    setEditableFields(initialFields)
    setIsEditMode(true)
  }

  const handleCancelEdit = () => {
    setIsEditMode(false)
    // Reset editable fields to original form data (exclude approver-only fields)
    const initialFields = {}
    fieldOrder.forEach(key => {
      if (key === 'sample_required') return
      if (!excludedFields.includes(key) && key !== 'doc_uploaded_by_user' && !approverOnlyFields.includes(key)) {
        initialFields[key] = formData[key] ?? ''
      }
    })
    setEditableDynamicValues(formData.dynamic_values || {})
    setEditableFields(initialFields)
  }

  const handleDynamicFieldChange = (fieldKey, value) => {
    setEditableDynamicValues((prev) => ({
      ...prev,
      [fieldKey]: value,
    }))
  }

  const handleFieldChange = (field, value) => {
    setEditableFields((prev) => {
      const next = {
        ...prev,
        [field]: value,
      }

      if (field === 'control_frequency' && value) {
        const meta = getEffectiveSampleSizeForFrequency(unitSampleSizeSettings, value)
        if (meta.sampleSize != null) {
          next.sample_size = String(meta.sampleSize)
        }
      }

      return next
    })
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

  const handleOpenAssignmentDialog = () => {
    if (Boolean(formData?.assigned_to_coordinator)) {
      toast.error('This RACM is coordinator-assigned and cannot be assigned to a process owner')
      return
    }

    const reassignmentBlockMessage = getRacmReassignmentBlockMessage(formData)
    if (reassignmentBlockMessage) {
      toast.error(reassignmentBlockMessage)
      return
    }

    setSelectedUser(null)
    setAssignmentDialogOpen(true)
  }

  const handleCloseAssignmentDialog = () => {
    if (updating) return
    setAssignmentDialogOpen(false)
    setSelectedUser(null)
  }

  const handleUpdateAssignment = async () => {
    const reassignmentBlockMessage = getRacmReassignmentBlockMessage(formData)
    if (reassignmentBlockMessage) {
      toast.error(reassignmentBlockMessage)
      return
    }

    if (!form_id || !selectedUser?.email_id) return

    // Already-active RACMs are being re-assigned (owner swap). Do not re-send
    // the active flag so the RACM is never toggled inactive mid-operation.
    const alreadyActive = Boolean(formData?.active)
    const hasDueDate = Boolean((formData?.due_date || '').toString().trim())
    const hasReminderFrequency =
      formData?.reminder_frequency !== null &&
      formData?.reminder_frequency !== undefined &&
      String(formData.reminder_frequency).trim() !== ''
    const hasReminderSettings = hasDueDate && hasReminderFrequency
    const hasSampleDoc = hasSampleDocs()
    const canAutoActivate = !alreadyActive && hasReminderSettings

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
        if (!alreadyActive && !canAutoActivate) {
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

  useEffect(() => {
    const email = (formData?.control_owner || '').trim()
    if (!email) {
      setProcessOwnerName('-')
      return
    }
    const apiName = (formData?.control_owner_name || '').trim()
    setProcessOwnerName(apiName || email || '-')
  }, [formData?.control_owner, formData?.control_owner_name])

  useEffect(() => {
    const email = (formData?.control_performer || '').trim()
    const unitId = (formData?.unit_id || '').trim()
    if (!email) {
      setPerformerDisplayName('-')
      return
    }

    let cancelled = false
    fetchUnitUsers({ unitId, q: email, limit: 10 }).then((users) => {
      if (cancelled) return
      const lowerEmail = email.toLowerCase()
      const match = users.find(
        (user) => (user.email_id || '').trim().toLowerCase() === lowerEmail
      )
      setPerformerDisplayName(
        formatDisplayName(match?.emp_name?.trim() || email, '-')
      )
    })

    return () => {
      cancelled = true
    }
  }, [formData?.control_performer, formData?.unit_id])

  useEffect(() => {
    let cancelled = false
    const unitId = String(formData?.unit_id || '').trim()

    if (!unitId) {
      setUnitSampleSizeSettings([])
      return undefined
    }

    const fetchUnitSampleSizeSettings = async () => {
      try {
        const response = await fetch(
          apiUrl(`/api/company-co/unit-sample-size-config?unit_id=${encodeURIComponent(unitId)}`),
          { credentials: 'include' }
        )
        const data = await response.json()
        if (cancelled) return
        if (response.ok && data.success) {
          setUnitSampleSizeSettings(Array.isArray(data.data?.settings) ? data.data.settings : [])
        } else {
          setUnitSampleSizeSettings([])
        }
      } catch (error) {
        console.error('Error fetching unit sample size settings:', error)
        if (!cancelled) {
          setUnitSampleSizeSettings([])
        }
      }
    }

    fetchUnitSampleSizeSettings()

    return () => {
      cancelled = true
    }
  }, [formData?.unit_id])

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
      if (key === 'sample_required') return
      if (!excludedFields.includes(key) && key !== 'doc_uploaded_by_user' && !approverOnlyFields.includes(key)) {
        const originalValue = formData[key] ?? ''
        const newValue = editableFields[key] ?? ''

        if (String(originalValue).trim() !== String(newValue).trim()) {
          const payloadValue = newValue === '' ? null : newValue

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

    const originalDynamicValues = formData.dynamic_values || {}
    const mergedDynamicValues = { ...originalDynamicValues, ...editableDynamicValues }
    const hasDynamicChanges = Object.keys(mergedDynamicValues).some((key) => {
      return String(originalDynamicValues[key] ?? '').trim() !== String(mergedDynamicValues[key] ?? '').trim()
    })

    if (modifiedFields.length === 0 && !hasDynamicChanges) {
      toast.error('No changes to save')
      return
    }

    const frequency = String(editableFields.control_frequency || formData?.control_frequency || '').trim()
    const sampleSizeValue = String(editableFields.sample_size ?? formData?.sample_size ?? '').trim()
    if (frequency) {
      if (!sampleSizeValue) {
        toast.error('Please enter sample size')
        return
      }
      const sampleValidation = validateSampleSizeForFrequency(
        unitSampleSizeSettings,
        frequency,
        sampleSizeValue
      )
      if (!sampleValidation.ok) {
        toast.error(sampleValidation.message)
        return
      }
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
          ...(hasDynamicChanges ? { dynamic_values: mergedDynamicValues } : {}),
          modifiedFields: modifiedFields,
          modifiedChanges: modifiedChanges,
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
        fetchChangeRequestHistory()
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

  const formatStatus = (status) => {
    const value = String(status || '').trim()
    if (!value || value.toLowerCase() === 'null') return '-'
    return formatRacmApprovalStatusLabel(value)
  }

  const formatDeficiencyStatus = (status) => {
    const value = String(status || '').trim()
    if (!value) return '-'
    return value
      .split('_')
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ')
  }

  const toggleDeficiencySubmissionExpansion = (submissionId) => {
    setExpandedDeficiencyVersions((prev) => ({
      ...prev,
      [submissionId]: !prev[submissionId],
    }))
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
    const { validFiles, invalidTypeFiles, invalidSizeFiles } = validateDocumentUploadFiles(files)

    if (invalidTypeFiles.length > 0) {
      toast.error(DOCUMENT_UPLOAD_INVALID_TYPE_MESSAGE)
    }

    if (invalidSizeFiles.length > 0) {
      toast.error(DOCUMENT_UPLOAD_INVALID_SIZE_MESSAGE)
    }

    if (validFiles.length > 0) {
      setDeficiencyResponseFiles((currentFiles) => [...currentFiles, ...validFiles])
    }

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
      toast.error('Explanation is required')
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
      if (dayjs(dueDate).isValid() && dayjs(dueDate).isBefore(dayjs(), 'day')) {
        toast.error('Due date must be today or a future date')
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
        uploadFormData.append('response_type', responseType)
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
          toast.error(uploadData.message || 'Failed to upload Mitigation/Compensatory Plans documents')
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
        toast.success('Mitigation/Compensatory Plans submitted successfully')
        setFormData((currentFormData) => ({
          ...(currentFormData || {}),
          ...(data.data || {}),
          deficiency_action_status: false,
          deficiency_response_status: 'submitted_for_review',
        }))
        setDeficiencyResponseFiles([])
        setDeficiencyResponseForm(buildDeficiencyResponseFormState(data.data, responseType))
      } else {
        toast.error(data.message || 'Failed to submit Mitigation/Compensatory Plans')
      }
    } catch (error) {
      console.error('Error submitting deficiency response:', error)
      toast.error('Error submitting Mitigation/Compensatory Plans')
    } finally {
      setDeficiencyResponseSubmitting(false)
    }
  }

  const getSampleDocs = () => {
    return normalizeSampleDocuments(formData?.sample_docs, formData?.sample_doc)
  }

  const getUserDocs = () => {
    return normalizeRacmUserDocuments(
      formData?.doc_uploaded_by_user_docs,
      formData?.doc_uploaded_by_user
    )
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

    const { validFiles, invalidTypeFiles, invalidSizeFiles } = validateDocumentUploadFiles(files)

    if (invalidTypeFiles.length > 0) {
      toast.error(DOCUMENT_UPLOAD_INVALID_TYPE_MESSAGE)
    }

    if (invalidSizeFiles.length > 0) {
      toast.error(DOCUMENT_UPLOAD_INVALID_SIZE_MESSAGE)
    }

    if (validFiles.length === 0) {
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
      return
    }

    await handleSamplingUpload(validFiles)
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
    if (Boolean(formData?.active)) {
      toast.error('Active RACM cannot be deleted. Please set the RACM Inactive first.')
      return
    }
    setDeleteDialogOpen(true)
  }

  const handleDeleteCancel = () => {
    setDeleteDialogOpen(false)
  }

  const handleDeleteConfirm = async () => {
    if (Boolean(formData?.active)) {
      toast.error('Active RACM cannot be deleted. Please set the RACM Inactive first.')
      setDeleteDialogOpen(false)
      return
    }

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
          navigate('/company_co/racm-management')
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

  const handleSetActiveConfirm = async () => {
    setSetActiveConfirmDialogOpen(false)
    await performToggleActive('1')
  }

  const handleSetActiveCancel = () => {
    if (updating) return
    setSetActiveConfirmDialogOpen(false)
  }

  const handleSetInactiveConfirm = async () => {
    setSetInactiveConfirmDialogOpen(false)
    await performToggleActive('0')
  }

  const handleSetInactiveCancel = () => {
    if (updating) return
    setSetInactiveConfirmDialogOpen(false)
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
    handleDeleteClick()
  }

  const handleChooseReplicateFromMore = () => {
    setMoreActionsDialogOpen(false)
    setReplicateTargetFY('')
    setReplicateDialogOpen(true)
  }

  const handleChooseSelfAssignFromMore = () => {
    if (isCoordinatorAssigned) {
      toast.error('This RACM is already coordinator-assigned')
      return
    }
    if (validProcessOwnerAssigned) {
      toast.error('This RACM is already assigned to a process owner')
      return
    }
    if (!hasReminderSettings) {
      toast.error('Configure due date and reminder frequency before self-assignment')
      return
    }
    if (isSentForApproval || isApprovedRacm) {
      toast.error('This RACM cannot be self-assigned in its current approval status')
      return
    }

    setMoreActionsDialogOpen(false)
    setSelfAssignConfirmDialogOpen(true)
  }

  const handleChooseApproverAssignmentFromMore = () => {
    const reassignmentBlockMessage = getRacmReassignmentBlockMessage(formData)
    if (reassignmentBlockMessage) {
      toast.error(reassignmentBlockMessage)
      return
    }
    setMoreActionsDialogOpen(false)
    setSelectedApprover(null)
    setApproverAssignmentDialogOpen(true)
  }

  const handleCloseApproverAssignmentDialog = () => {
    if (assigningApprover) return
    setApproverAssignmentDialogOpen(false)
    setSelectedApprover(null)
  }

  const handleAssignApprover = async () => {
    if (!form_id || !selectedApprover?.email_id) return

    const reassignmentBlockMessage = getRacmReassignmentBlockMessage(formData)
    if (reassignmentBlockMessage) {
      toast.error(reassignmentBlockMessage)
      return
    }

    setAssigningApprover(true)
    try {
      const response = await fetch(`${API_BASE_URL}/api/company-co/racm-approver-assignments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          approver_email_id: selectedApprover.email_id,
          form_ids: [form_id],
          confirm_replace_existing: true,
        }),
      })

      const data = await response.json()
      if (response.ok && data.success) {
        toast.success('Approver assignment saved successfully')
        handleCloseApproverAssignmentDialog()
        fetchFormData()
      } else {
        toast.error(data.message || 'Failed to assign approver')
      }
    } catch (error) {
      console.error('Error assigning approver:', error)
      toast.error('Failed to assign approver')
    } finally {
      setAssigningApprover(false)
    }
  }

  const handleSelfAssignCancel = () => {
    if (selfAssigning) return
    setSelfAssignConfirmDialogOpen(false)
  }

  const handleSelfAssignConfirm = async () => {
    if (!form_id) return

    setSelfAssigning(true)
    try {
      const response = await fetch(`${API_BASE_URL}/api/control-forms/${form_id}/self-assign`, {
        method: 'POST',
        credentials: 'include',
      })
      const data = await response.json()

      if (response.ok && data.success) {
        toast.success(data.message || 'RACM self-assigned successfully')
        setSelfAssignConfirmDialogOpen(false)
        await fetchFormData()
      } else {
        toast.error(data.message || 'Failed to self-assign RACM')
      }
    } catch (error) {
      console.error('Error self-assigning RACM:', error)
      toast.error('Error self-assigning RACM')
    } finally {
      setSelfAssigning(false)
    }
  }

  const handleSubmissionFileSelect = (e) => {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return

    const { validFiles, invalidTypeFiles, invalidSizeFiles } = validateDocumentUploadFiles(files)

    if (invalidTypeFiles.length > 0) {
      toast.error(DOCUMENT_UPLOAD_INVALID_TYPE_MESSAGE)
    }

    if (invalidSizeFiles.length > 0) {
      toast.error(DOCUMENT_UPLOAD_INVALID_SIZE_MESSAGE)
    }

    if (validFiles.length === 0) {
      e.target.value = ''
      return
    }

    setSelectedSubmissionFiles((currentFiles) => {
      const existingKeys = new Set(
        currentFiles.map((file) => `${file.name}-${file.size}-${file.lastModified}`)
      )
      const nextFiles = [...currentFiles]
      validFiles.forEach((file) => {
        const key = `${file.name}-${file.size}-${file.lastModified}`
        if (!existingKeys.has(key)) {
          nextFiles.push(file)
          existingKeys.add(key)
        }
      })
      return nextFiles
    })

    e.target.value = ''
  }

  const handleRemoveSubmissionFile = (indexToRemove) => {
    setSelectedSubmissionFiles((currentFiles) =>
      currentFiles.filter((_, index) => index !== indexToRemove)
    )
  }

  const handleUploadSubmissionDocuments = async () => {
    if (selectedSubmissionFiles.length === 0) {
      toast.error('Please select at least one document to upload')
      return
    }

    setUploadingSubmissionDocuments(true)
    try {
      const formDataUpload = new FormData()
      selectedSubmissionFiles.forEach((file) => {
        formDataUpload.append('documents', file)
      })

      const uploadResponse = await fetch(`${API_BASE_URL}/api/control-forms/${form_id}/upload-document`, {
        method: 'POST',
        credentials: 'include',
        body: formDataUpload,
      })
      const uploadData = await uploadResponse.json()

      if (uploadResponse.ok && uploadData.success) {
        toast.success(uploadData.message || 'Documents uploaded successfully')
        setSelectedSubmissionFiles([])
        await fetchFormData()
      } else {
        toast.error(uploadData.message || 'Failed to upload documents')
      }
    } catch (error) {
      console.error('Error uploading submission documents:', error)
      toast.error('Failed to upload documents')
    } finally {
      setUploadingSubmissionDocuments(false)
    }
  }

  const handleSendForApproval = async () => {
    if (!Boolean(formData?.active)) {
      toast.error('Inactive RACMs cannot be sent for approval')
      return
    }

    const existingUploadedDocs = getUserDocs()
    if (existingUploadedDocs.length === 0) {
      toast.error('Please upload at least one document before sending for approval')
      return
    }

    const hasApproverInfo = Boolean(
      String(formData?.approver_name || '').trim() ||
      String(formData?.approver_display_name || '').trim() ||
      String(formData?.approver_email_id || '').trim()
    )
    if (!hasApproverInfo) {
      toast.error('Approval is not configured for this RACM')
      return
    }

    if (formData?.status === 'Rejected') {
      const resubmitEligibility = getRejectedResubmitEligibility({
        formData,
        remarksByUser,
        uploadedDocs: existingUploadedDocs,
        pendingUploadCount: selectedSubmissionFiles.length,
      })
      if (!resubmitEligibility.ok) {
        if (resubmitEligibility.hasPendingUploads) {
          toast.error('Please upload your new documents before resubmitting for approval')
        } else {
          toast.error(REJECTED_RESUBMIT_MESSAGE)
        }
        return
      }
    }

    setSubmittingForApproval(true)
    try {
      const response = await fetch(`${API_BASE_URL}/api/control-forms/${form_id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          remarks_by_user: remarksByUser,
          status: 'sent for approval',
        }),
      })

      const data = await response.json()

      if (response.ok && data.success) {
        toast.success(data.message || 'RACM sent for approval successfully')
        setRemarksDraftDirty(false)
        await fetchFormData()
      } else {
        toast.error(data.message || 'Failed to send for approval')
      }
    } catch (error) {
      console.error('Error sending for approval:', error)
      toast.error('Error sending for approval')
    } finally {
      setSubmittingForApproval(false)
    }
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
    'control_design_conclusion',
    'design_deficiency_desc',
    'doc_uploaded_by_user'
  ]
  const controlFrequencyDropdownOptions = useMemo(() => {
    const options = controlFrequencyOptions.map((row) => row.value)
    const current = String(editableFields.control_frequency || formData?.control_frequency || '').trim()
    if (current && !options.includes(current)) {
      return [current, ...options]
    }
    return options
  }, [controlFrequencyOptions, editableFields.control_frequency, formData?.control_frequency])

  const editModeSampleSizeFeedback = useMemo(
    () => getSampleSizeInputFeedback(
      unitSampleSizeSettings,
      editableFields.control_frequency || formData?.control_frequency,
      editableFields.sample_size ?? formData?.sample_size ?? ''
    ),
    [
      unitSampleSizeSettings,
      editableFields.control_frequency,
      editableFields.sample_size,
      formData?.control_frequency,
      formData?.sample_size,
    ]
  )

  const editModeSampleSizeInvalid = Boolean(editModeSampleSizeFeedback.warning)

  const editableDropdownOptions = {
    risk_heat: ['High', 'Low', 'Medium'],
    control_type_fo: ['Financial', 'Operational'],
    control_type_ma: ['Manual', 'Automated'],
    nature_of_control: ['Preventive', 'Detective'],
    key_control: ['Yes', 'No'],
    control_relies_on_ipe: ['Yes', 'No'],
    control_frequency: controlFrequencyDropdownOptions,
    whether_fraud_risks_exist: ['Yes', 'No', 'Other'],
  }

  // Fields to exclude from display
  const excludedFields = ['id', 'form_id', 'company_identifier', 'created_at', 'active', 'approved_rejected', 'reason_by_approver']

  // Fields that only approvers can edit (coordinator cannot edit these)
  // Must match backend `approverOnlyFields` guard.
  const approverOnlyFields = ['control_design_procs', 'control_design_conclusion', 'design_deficiency_desc']
  
  // Grouped fields that should be displayed together (only if at least one has a value)
  const groupedApproverFields = APPROVAL_SECTION_FIELD_KEYS
  
  const hasGroupedFieldValue = hasPopulatedApprovalSectionFields(formData)
  const deficiencyResponse = formData?.deficiency_response || null
  const deficiencyCurrentSubmission = deficiencyResponse?.current_submission || null
  const deficiencySubmissions = Array.isArray(deficiencyResponse?.submissions)
    ? deficiencyResponse.submissions
    : []
  const deficiencyHistorySubmissions = deficiencySubmissions.filter((submission) => {
    const isCurrentSubmission = Number(submission?.id) === Number(deficiencyCurrentSubmission?.id)
    if (!isCurrentSubmission) return true
    const normalizedStatus = String(submission?.status || '').trim().toLowerCase()
    return normalizedStatus === 'approved' || normalizedStatus === 'rejected'
  })
  const deficiencyAttachments = Array.isArray(deficiencyCurrentSubmission?.attachments)
    ? deficiencyCurrentSubmission.attachments
    : []
  const processOwnerDeclaration = formData?.process_owner_declaration || null
  const hasProcessOwnerDeclaration = Boolean(processOwnerDeclaration?.no_furthure_submission)
  const deficiencyResponseStatus = String(formData?.deficiency_response_status || '').trim()
  const needsDeficiencyResponse = Boolean(formData?.deficiency_action_status) && !hasProcessOwnerDeclaration
  const showDeficiencyActionNotice = needsDeficiencyResponse
  const canSubmitDeficiencyResponse = needsDeficiencyResponse && deficiencyResponseStatus !== 'submitted_for_review' && !hasProcessOwnerDeclaration
  const showActiveDeficiencyResponseSection = Boolean(
    deficiencyResponse && String(deficiencyResponse.status || '').trim().toLowerCase() === 'submitted'
  )

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
  const isCoordinatorAssigned = isCoordinatorAssignedRacm(formData)
  const reassignmentBlockMessage = getRacmReassignmentBlockMessage(formData)
  const isAssignmentDisabled = isEditMode || updating || isCoordinatorAssigned || Boolean(reassignmentBlockMessage)
  const racmStatus = String(formData?.status || '').trim().toLowerCase()
  const isSentForApproval = racmStatus === 'sent for approval'
  const isApprovedRacm = racmStatus === 'approved'
  const isRejectedRacm = racmStatus === 'rejected'
  const isApprovedNotEffective = isApprovedRacm && String(formData?.control_design_conclusion || '').trim().toLowerCase() === 'not effective'
  const hasReminderSettings = Boolean(String(formData?.due_date || '').trim()) && Boolean(String(formData?.reminder_frequency || '').trim())
  const showSelfAssignButton = !isCoordinatorAssigned && !validProcessOwnerAssigned
  const canCoordinatorSubmit = isCoordinatorAssigned && isActive && !isSentForApproval && !isApprovedRacm && !hasProcessOwnerDeclaration
  const canDeclareNoFurtherSubmission = !hasProcessOwnerDeclaration && ((isCoordinatorAssigned && isRejectedRacm) || isApprovedNotEffective)
  const showRemarksByUser = canCoordinatorSubmit || (formData?.remarks_by_user || '').trim() !== ''
  const showReasonByApprover = hasRacmFieldValue(formData?.reason_by_approver)
  const assignmentDisplayValue = isCoordinatorAssigned
    ? 'Coordinator (Self)'
    : ((processOwnerName && processOwnerName !== '-')
      ? processOwnerName
      : ((formData?.control_owner || '').trim() || '-'))
  const hasActiveSuggestedChanges = String(activeChangeRequest?.status || '').trim() === 'Review Pending'
  const changeRequestsDataReady = !changeRequestHistoryLoading && !activeChangeRequestLoading
  const showSuggestedChangesButton = !isEditMode && hasActiveSuggestedChanges && changeRequestsDataReady
  const showChangeRequestHistoryButton = changeRequestsDataReady && changeRequestHistoryCount > 0
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
    <Box sx={FORM_DETAIL_ROOT_SX}>
      <Box sx={FORM_DETAIL_CONTENT_STACK_SX}>
        {showChangeRequestHistoryButton || showSuggestedChangesButton || isEditMode || canDeclareNoFurtherSubmission || hasProcessOwnerDeclaration ? (
          <Box sx={FORM_DETAIL_ACTION_BAR_SX}>
            {showChangeRequestHistoryButton ? (
              <Button
                onClick={handleOpenChangeRequestHistoryDialog}
                disabled={changeRequestHistoryLoading}
                variant="outlined"
                sx={{
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
            {showSuggestedChangesButton ? (
              <Button
                onClick={handleOpenSuggestedChangesDialog}
                disabled={activeChangeRequestLoading}
                variant="contained"
                color="warning"
                sx={{
                  py: 1,
                  fontWeight: 600,
                  textTransform: 'none',
                  fontSize: '0.9375rem',
                  borderRadius: 2,
                }}
              >
                Suggested Changes
              </Button>
            ) : null}
            {isEditMode ? (
              <>
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
                  disabled={saving || editModeSampleSizeInvalid}
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
              </>
            ) : null}
            <ProcessOwnerDeclarationAction
              canDeclare={canDeclareNoFurtherSubmission}
              formId={form_id}
              onDeclared={({ processOwnerDeclaration, deficiencyActionStatus }) => {
                setFormData((current) => current ? ({
                  ...current,
                  process_owner_declaration: processOwnerDeclaration,
                  deficiency_action_status: deficiencyActionStatus === undefined ? false : Boolean(deficiencyActionStatus),
                }) : current)
              }}
              buttonSx={{
                py: 1,
                fontWeight: 600,
                textTransform: 'none',
                fontSize: '0.9375rem',
                borderRadius: 2,
              }}
            />
            <ProcessOwnerDeclarationBadge
              declaration={processOwnerDeclaration}
              formattedTimestamp={formatIndianDateTime(processOwnerDeclaration?.timestamp, '-')}
              containerSx={{ width: 'auto' }}
            />
          </Box>
        ) : null}
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
                  {/* Control Status */}
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
                      Control Status
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
                      <DatePicker
                        label="Due Date"
                        value={scheduleFields.due_date ? dayjs(scheduleFields.due_date) : null}
                        onChange={(newValue) => {
                          handleScheduleFieldChange(
                            'due_date',
                            newValue && newValue.isValid() ? newValue.format('YYYY-MM-DD') : ''
                          )
                        }}
                        minDate={dayjs(getTomorrowDateString())}
                        disabled={savingSchedule || isEditMode || isActive}
                        slotProps={{
                          textField: {
                            fullWidth: true,
                            size: 'small',
                            sx: {
                              '& .MuiInputBase-root': {
                                minHeight: 38,
                              },
                            },
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
                        if (!isAssignmentDisabled) {
                          handleOpenAssignmentDialog()
                        }
                      }}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if ((e.key === 'Enter' || e.key === ' ') && !isAssignmentDisabled) {
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
                        cursor: isAssignmentDisabled ? 'not-allowed' : 'pointer',
                        opacity: isAssignmentDisabled ? 0.65 : 1,
                        transition: 'all 0.2s ease',
                        minHeight: '100%',
                        '&:hover': isAssignmentDisabled ? {} : {
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
                        title={assignmentDisplayValue}
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
                          {assignmentDisplayValue}
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
                      accept={DOCUMENT_UPLOAD_ACCEPT}
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
                <RacmTemplateSectionFields
                  blendIntoParent
                  sectionKey="process_and_risk"
                  fieldDefinitions={formData.field_definitions}
                  values={isEditMode ? editableDynamicValues : (formData.dynamic_values || {})}
                  isEditMode={isEditMode}
                  onChange={handleDynamicFieldChange}
                  disabled={saving}
                />
              </Box>
            </CardContent>
          </Card>

          <RacmTemplateSectionFields
            sectionKey="assertions"
            title="Assertions"
            fieldDefinitions={formData.field_definitions}
            values={isEditMode ? editableDynamicValues : (formData.dynamic_values || {})}
            isEditMode={isEditMode}
            onChange={handleDynamicFieldChange}
            disabled={saving}
          />

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
                      ].includes(key)
                    ) {
                      return false
                    }
                    // Doc & remarks are handled in Approval section
                    if (['doc_uploaded_by_user', 'remarks_by_user'].includes(key)) {
                      return false
                    }
                    if (isEditMode && key === 'sample_required') {
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
                                  const selectedPerformerUser = selectedEmail
                                    ? { email_id: selectedEmail, emp_name: '' }
                                    : null
                                  return (
                                    <UnitUserSearchAutocomplete
                                      unitId={formData?.unit_id}
                                      value={selectedPerformerUser}
                                      onChange={(newValue) => {
                                        handleFieldChange(
                                          'control_performer',
                                          newValue?.email_id?.trim() || ''
                                        )
                                      }}
                                      prefetch={isEditMode}
                                      inDialog={false}
                                      label={label}
                                      placeholder="Search by name or email…"
                                      disabled={saving}
                                      textFieldProps={{ variant: 'outlined' }}
                                    />
                                  )
                                })()
                              : key === 'sample_size' ? (
                              (() => {
                                const frequency = editableFields.control_frequency || formData?.control_frequency
                                const frequencyMeta = getEffectiveSampleSizeForFrequency(
                                  unitSampleSizeSettings,
                                  frequency
                                )
                                const sampleSizeFeedback = getSampleSizeInputFeedback(
                                  unitSampleSizeSettings,
                                  frequency,
                                  editableFields.sample_size || ''
                                )
                                return (
                                  <TextField
                                    label={label}
                                    variant="outlined"
                                    type="number"
                                    value={editableFields.sample_size || ''}
                                    onChange={(e) => handleFieldChange('sample_size', e.target.value)}
                                    fullWidth
                                    disabled={saving}
                                    error={Boolean(sampleSizeFeedback.warning)}
                                    inputProps={{
                                      min: frequencyMeta.minimum ?? 1,
                                      max: frequencyMeta.maximum ?? undefined,
                                      step: 1,
                                    }}
                                    helperText={sampleSizeFeedback.warning || sampleSizeFeedback.limits || undefined}
                                    FormHelperTextProps={
                                      sampleSizeFeedback.warning
                                        ? { sx: { color: 'warning.main' } }
                                        : undefined
                                    }
                                  />
                                )
                              })()
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
                                  {performerDisplayName && performerDisplayName !== '-'
                                    ? `Name: ${performerDisplayName}`
                                    : 'Name: -'}
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
                <RacmTemplateSectionFields
                  blendIntoParent
                  sectionKey="control_details"
                  fieldDefinitions={formData.field_definitions}
                  values={isEditMode ? editableDynamicValues : (formData.dynamic_values || {})}
                  isEditMode={isEditMode}
                  onChange={handleDynamicFieldChange}
                  disabled={saving}
                />
              </Box>
            </CardContent>
          </Card>

          <RacmTemplateSectionFields
            sectionKey="others"
            title="Others"
            fieldDefinitions={formData.field_definitions}
            values={isEditMode ? editableDynamicValues : (formData.dynamic_values || {})}
            isEditMode={isEditMode}
            onChange={handleDynamicFieldChange}
            disabled={saving}
          />

          {hasGroupedFieldValue ? (
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
                  {DESIGN_IMPLEMENTATION_SECTION_TITLE}
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, mt: 2 }}>
                  {getPopulatedApprovalSectionFields(formData).map((key) => {
                    const label = fieldLabels[key] || key.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())
                    const value = formData[key]
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
                            color: 'text.secondary',
                            wordBreak: 'break-word',
                            lineHeight: 1.6,
                            fontSize: theme.typography.customSizes.medium,
                            whiteSpace: isTextArea ? 'pre-wrap' : 'normal',
                          }}
                        >
                          {String(value)}
                        </Typography>
                      </Box>
                    )
                  })}
                </Box>
              </CardContent>
            </Card>
          ) : null}

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
                {DOCUMENTS_APPROVAL_SECTION_TITLE}
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
                        sx={{
                          color: 'text.primary',
                          fontWeight: 600,
                          lineHeight: 1.5,
                          fontSize: theme.typography.customSizes.medium,
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
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    {userDocCount > 0 ? (
                      <Box
                        component="button"
                        type="button"
                        onClick={handleOpenUserDocsDialog}
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
                          sx={{
                            color: 'text.primary',
                            fontWeight: 600,
                            lineHeight: 1.5,
                            fontSize: theme.typography.customSizes.medium,
                          }}
                        >
                          Uploaded Documents ({userDocCount})
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
                    ) : null}
                    {canCoordinatorSubmit ? selectedSubmissionFiles.map((file, index) => (
                      <Box
                        key={`${file.name}-${file.size}-${file.lastModified}`}
                        sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
                      >
                        <AttachFileIcon fontSize="small" sx={{ color: 'primary.main', flexShrink: 0 }} />
                        <Typography
                          variant="body2"
                          sx={{
                            color: 'text.primary',
                            flex: 1,
                            wordBreak: 'break-word',
                            lineHeight: 1.6,
                            fontSize: theme.typography.customSizes.medium,
                            fontWeight: 500,
                          }}
                        >
                          {file.name}
                        </Typography>
                        <Tooltip title="Remove selected document">
                          <IconButton
                            size="small"
                            onClick={() => handleRemoveSubmissionFile(index)}
                            sx={{ color: 'error.main' }}
                          >
                            <CloseIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    )) : null}
                    {userDocCount === 0 && (!canCoordinatorSubmit || selectedSubmissionFiles.length === 0) && (
                      <Typography
                        variant="body2"
                        sx={{
                          color: 'text.disabled',
                          lineHeight: 1.6,
                          fontSize: theme.typography.customSizes.medium,
                        }}
                      >
                        No document selected
                      </Typography>
                    )}
                    {canCoordinatorSubmit && selectedSubmissionFiles.length > 0 && (
                      <Typography
                        variant="caption"
                        sx={{
                          color: 'text.secondary',
                          fontSize: theme.typography.customSizes.small,
                        }}
                      >
                        Upload selected documents first, then send the RACM for approval.
                      </Typography>
                    )}
                    {canCoordinatorSubmit && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, flexWrap: 'wrap', mt: 0.5 }}>
                        <label>
                          <input
                            type="file"
                            multiple
                            accept={DOCUMENT_UPLOAD_ACCEPT}
                            style={{ display: 'none' }}
                            onChange={handleSubmissionFileSelect}
                            disabled={uploadingSubmissionDocuments}
                          />
                          <IconButton
                            component="span"
                            disabled={uploadingSubmissionDocuments}
                            sx={{
                              border: '1px solid',
                              borderColor: 'divider',
                              color:
                                theme.palette.mode === 'dark'
                                  ? theme.palette.primary.light
                                  : theme.palette.primary.main,
                              '&:hover': {
                                backgroundColor: 'action.hover',
                              },
                              '&.Mui-disabled': {
                                color: 'action.disabled',
                                borderColor: 'action.disabledBackground',
                              },
                            }}
                          >
                            <AttachFileIcon />
                          </IconButton>
                        </label>
                        <Button
                          onClick={handleUploadSubmissionDocuments}
                          disabled={uploadingSubmissionDocuments || selectedSubmissionFiles.length === 0}
                          variant="outlined"
                          size="small"
                          sx={{ textTransform: 'none' }}
                        >
                          {uploadingSubmissionDocuments ? 'Uploading...' : 'Upload Documents'}
                        </Button>
                      </Box>
                    )}
                  </Box>
                </Box>
              </Box>

              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, mt: 4, pt: 1 }}>
                {(showRemarksByUser || showReasonByApprover) ? (
                <Box sx={DOCUMENTS_APPROVAL_REMARKS_ROW_SX}>
                  {showRemarksByUser ? (
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
                    {canCoordinatorSubmit ? (
                      <TextField
                        label={fieldLabels.remarks_by_user}
                        variant="outlined"
                        value={remarksByUser}
                        onChange={(e) => {
                          setRemarksByUser(e.target.value)
                          setRemarksDraftDirty(true)
                        }}
                        fullWidth
                        multiline
                        rows={4}
                      />
                    ) : (
                      <>
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
                          {fieldLabels.remarks_by_user}
                        </Typography>
                        <Typography
                          variant="body2"
                          component="dd"
                          sx={{
                            color: 'text.secondary',
                            wordBreak: 'break-word',
                            lineHeight: 1.6,
                            fontSize: theme.typography.customSizes.medium,
                            whiteSpace: 'pre-wrap',
                          }}
                        >
                          {formData.remarks_by_user}
                        </Typography>
                      </>
                    )}
                  </Box>
                  ) : null}
                  {showReasonByApprover ? (
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
                      {fieldLabels.reason_by_approver}
                    </Typography>
                    <Typography
                      variant="body2"
                      component="dd"
                      sx={{
                        color: 'text.secondary',
                        wordBreak: 'break-word',
                        lineHeight: 1.6,
                        fontSize: theme.typography.customSizes.medium,
                        whiteSpace: 'pre-wrap',
                      }}
                    >
                      {String(formData.reason_by_approver)}
                    </Typography>
                  </Box>
                  ) : null}
                </Box>
                ) : null}

                {canCoordinatorSubmit ? (
                  <Box sx={{ display: 'flex', justifyContent: 'flex-start' }}>
                    <Button
                      onClick={handleSendForApproval}
                      disabled={submittingForApproval || uploadingSubmissionDocuments}
                      variant="contained"
                      color="secondary"
                      sx={{
                        py: 1.75,
                        px: 4,
                        minWidth: 260,
                        maxWidth: 400,
                        width: 'auto',
                        fontWeight: 600,
                        textTransform: 'none',
                        fontSize: '0.9375rem',
                        borderRadius: 2,
                      }}
                    >
                      {submittingForApproval
                        ? (isRejectedRacm ? 'Resubmitting...' : 'Sending...')
                        : (isRejectedRacm ? 'Resubmit for Approval' : 'Send for Approval')}
                    </Button>
                  </Box>
                ) : null}
              </Box>
            </CardContent>
          </Card>

          {deficiencyHistorySubmissions.length > 0 ? (
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
                  Mitigation/Compensatory Plans History
                </Typography>

                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                  {deficiencyHistorySubmissions.map((submission) => {
                    const isExpanded = Boolean(expandedDeficiencyVersions[submission.id])
                    const submissionAttachments = Array.isArray(submission.attachments) ? submission.attachments : []
                    const submissionTypeLabel = String(submission.submission_type || '').trim() === 'compensatory_racm'
                      ? 'Compensatory RACM'
                      : 'Mitigation Plan'
                    const normalizedSubmissionStatus = String(submission.status || '').trim().toLowerCase()
                    const tileTimestampLabel = normalizedSubmissionStatus === 'approved'
                      ? 'Approved on'
                      : normalizedSubmissionStatus === 'rejected'
                        ? 'Rejected on'
                        : 'Updated on'
                    const tileTimestampValue = submission.reviewed_at || submission.submitted_at

                    return (
                      <Box
                        key={submission.id}
                        sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, overflow: 'hidden' }}
                      >
                        <Box
                          sx={{
                            px: 2,
                            py: 1.5,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: 2,
                            backgroundColor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(15,23,42,0.02)',
                          }}
                        >
                          <Box sx={{ minWidth: 0 }}>
                            <Typography variant="body2" sx={{ fontWeight: 700, color: 'text.primary' }}>
                              Version {submission.version_no} • {submissionTypeLabel}
                            </Typography>
                            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                              Status: {formatDeficiencyStatus(submission.status)}
                              {tileTimestampValue ? ` • ${tileTimestampLabel} ${formatIndianDateTime(tileTimestampValue)}` : ''}
                            </Typography>
                          </Box>
                          <Button
                            size="small"
                            onClick={() => toggleDeficiencySubmissionExpansion(submission.id)}
                            endIcon={isExpanded ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
                            sx={{ textTransform: 'none', flexShrink: 0 }}
                          >
                            {isExpanded ? 'Hide details' : 'View details'}
                          </Button>
                        </Box>

                        {isExpanded ? (
                          <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                            <Box sx={{ p: 1.75, borderRadius: 1.5, border: '1px solid', borderColor: 'divider' }}>
                              <Typography variant="caption" sx={{ display: 'block', fontWeight: 700, mb: 1, color: 'text.secondary' }}>
                                Explanation
                              </Typography>
                              <Typography variant="body2" sx={{ color: 'text.primary', whiteSpace: 'pre-wrap' }}>
                                {String(submission.explaination || '').trim() || '-'}
                              </Typography>
                            </Box>
                            {(String(submission.concerned_person || '').trim() || submission.due_date) ? (
                              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' }, gap: 1.5 }}>
                                <Box sx={{ p: 1.75, borderRadius: 1.5, border: '1px solid', borderColor: 'divider' }}>
                                  <Typography variant="caption" sx={{ display: 'block', fontWeight: 700, mb: 1, color: 'text.secondary' }}>
                                    Concerned Person
                                  </Typography>
                                  <Typography variant="body2" sx={{ color: 'text.primary' }}>
                                    {String(submission.concerned_person || '').trim() || '-'}
                                  </Typography>
                                </Box>
                                <Box sx={{ p: 1.75, borderRadius: 1.5, border: '1px solid', borderColor: 'divider' }}>
                                  <Typography variant="caption" sx={{ display: 'block', fontWeight: 700, mb: 1, color: 'text.secondary' }}>
                                    Due Date
                                  </Typography>
                                  <Typography variant="body2" sx={{ color: 'text.primary' }}>
                                    {submission.due_date ? formatDateOnly(submission.due_date) : '-'}
                                  </Typography>
                                </Box>
                              </Box>
                            ) : null}
                            {submissionAttachments.length > 0 ? (
                              <Box sx={{ p: 1.75, borderRadius: 1.5, border: '1px solid', borderColor: 'divider' }}>
                                <Typography variant="caption" sx={{ display: 'block', fontWeight: 700, mb: 1, color: 'text.secondary' }}>
                                  Documents
                                </Typography>
                                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                                  {submissionAttachments.map((attachment) => (
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
                            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' }, gap: 1.5 }}>
                              <Box sx={{ p: 1.75, borderRadius: 1.5, border: '1px solid', borderColor: 'divider' }}>
                                <Typography variant="caption" sx={{ display: 'block', fontWeight: 700, mb: 1, color: 'text.secondary' }}>
                                  Submitted By
                                </Typography>
                                <Typography variant="body2" sx={{ color: 'text.primary', overflowWrap: 'anywhere' }}>
                                  {String(submission.submitted_by_email || '').trim() || '-'}
                                </Typography>
                              </Box>
                              <Box sx={{ p: 1.75, borderRadius: 1.5, border: '1px solid', borderColor: 'divider' }}>
                                <Typography variant="caption" sx={{ display: 'block', fontWeight: 700, mb: 1, color: 'text.secondary' }}>
                                  Submitted On
                                </Typography>
                                <Typography variant="body2" sx={{ color: 'text.primary' }}>
                                  {submission.submitted_at ? formatIndianDateTime(submission.submitted_at) : '-'}
                                </Typography>
                              </Box>
                            </Box>
                            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' }, gap: 1.5 }}>
                              <Box sx={{ p: 1.75, borderRadius: 1.5, border: '1px solid', borderColor: 'divider' }}>
                                <Typography variant="caption" sx={{ display: 'block', fontWeight: 700, mb: 1, color: 'text.secondary' }}>
                                  Reviewed By
                                </Typography>
                                <Typography variant="body2" sx={{ color: 'text.primary', overflowWrap: 'anywhere' }}>
                                  {String(submission.reviewed_by_email || '').trim() || '-'}
                                </Typography>
                              </Box>
                              <Box sx={{ p: 1.75, borderRadius: 1.5, border: '1px solid', borderColor: 'divider' }}>
                                <Typography variant="caption" sx={{ display: 'block', fontWeight: 700, mb: 1, color: 'text.secondary' }}>
                                  Reviewed On
                                </Typography>
                                <Typography variant="body2" sx={{ color: 'text.primary' }}>
                                  {submission.reviewed_at ? formatIndianDateTime(submission.reviewed_at) : '-'}
                                </Typography>
                              </Box>
                            </Box>
                            <Box sx={{ p: 1.75, borderRadius: 1.5, border: '1px solid', borderColor: 'divider' }}>
                              <Typography variant="caption" sx={{ display: 'block', fontWeight: 700, mb: 1, color: 'text.secondary' }}>
                                Review Decision
                              </Typography>
                              <Typography variant="body2" sx={{ color: 'text.primary' }}>
                                {formatDeficiencyStatus(submission.review_decision)}
                              </Typography>
                            </Box>
                            {String(submission.review_comment || '').trim() ? (
                              <Box sx={{ p: 1.75, borderRadius: 1.5, border: '1px solid', borderColor: 'divider' }}>
                                <Typography variant="caption" sx={{ display: 'block', fontWeight: 700, mb: 1, color: 'text.secondary' }}>
                                  Review Comment
                                </Typography>
                                <Typography variant="body2" sx={{ color: 'text.primary', whiteSpace: 'pre-wrap' }}>
                                  {String(submission.review_comment)}
                                </Typography>
                              </Box>
                            ) : null}
                          </Box>
                        ) : null}
                      </Box>
                    )
                  })}
                </Box>
              </CardContent>
            </Card>
          ) : null}

          {(needsDeficiencyResponse || showActiveDeficiencyResponseSection) ? (
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
                  Mitigation/Compensatory Plans
                </Typography>

                {showDeficiencyActionNotice ? (
                  <Box
                    sx={{
                      mb: 3,
                      p: 2,
                      borderRadius: 2,
                      backgroundColor: theme.palette.mode === 'dark'
                        ? 'rgba(255, 255, 255, 0.04)'
                        : 'rgba(15, 23, 42, 0.04)',
                      color: 'text.primary',
                    }}
                  >
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>
                      Action required: Approver marked this RACM as Not Effective.
                    </Typography>
                  </Box>
                ) : null}

                {showActiveDeficiencyResponseSection && deficiencyResponse ? (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, mb: canSubmitDeficiencyResponse ? 4 : 0 }}>
                    <Box sx={{ p: 2, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
                      <Typography variant="caption" sx={{ display: 'block', fontWeight: 700, mb: 1, color: 'text.secondary' }}>Response Type</Typography>
                      <Typography variant="body2" sx={{ color: 'text.primary' }}>
                        {String(deficiencyResponse.response_type || '').trim() === 'compensatory_racm' ? 'Compensatory RACM' : 'Mitigation Plan'}
                      </Typography>
                    </Box>
                    <Box sx={{ p: 2, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
                      <Typography variant="caption" sx={{ display: 'block', fontWeight: 700, mb: 1, color: 'text.secondary' }}>Explanation</Typography>
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
                    <TextField label="Explanation" value={deficiencyResponseForm.explaination} onChange={(e) => handleDeficiencyResponseFieldChange('explaination', e.target.value)} fullWidth multiline rows={4} />
                    {deficiencyResponseForm.response_type === 'mitigation_plan' ? (
                      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 2 }}>
                        <TextField label="Concerned Person (email or name)" value={deficiencyResponseForm.concerned_person} onChange={(e) => handleDeficiencyResponseFieldChange('concerned_person', e.target.value)} fullWidth />
                        <DatePicker
                          label="Due Date"
                          value={deficiencyResponseForm.due_date ? dayjs(deficiencyResponseForm.due_date) : null}
                          onChange={(newValue) => {
                            handleDeficiencyResponseFieldChange(
                              'due_date',
                              newValue && newValue.isValid() ? newValue.format('YYYY-MM-DD') : ''
                            )
                          }}
                          minDate={dayjs().startOf('day')}
                          disablePast
                          slotProps={{
                            textField: {
                              fullWidth: true,
                            },
                          }}
                        />
                      </Box>
                    ) : (
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
                        <Button component="label" variant="outlined" startIcon={<CloudUploadIcon />} sx={{ alignSelf: 'flex-start', textTransform: 'none' }}>
                          Upload Documents
                          <input hidden type="file" multiple accept={DOCUMENT_UPLOAD_ACCEPT} onChange={handleDeficiencyResponseFileSelect} />
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
                      {formatRacmUserDocumentSubtitle(doc, formatDateTime)}
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
                        {formatRacmUserDocumentSubtitle(doc, formatDateTime)}
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
                <Typography variant="body2" component="span" sx={popupLabelSx}>Current Process Owner Email:</Typography>
                <Typography variant="body2" component="span">{popupValue(formData.control_owner)}</Typography>
              </Box>
              <Box sx={{ ...popupRowSx, mb: 2 }}>
                <Typography variant="body2" component="span" sx={popupLabelSx}>Current Process Owner Name:</Typography>
                <Typography variant="body2" component="span">
                  {popupValue((formData?.control_owner_name || '').trim() || (formData?.control_owner || '').trim())}
                </Typography>
              </Box>

              {Boolean((formData?.control_owner || '').trim()) && (
                <Alert severity="warning" sx={{ mb: 2 }}>
                  The current process owner will be replaced and will no longer be able to access this RACM. The new process owner will be notified by email.
                </Alert>
              )}

              <UnitUserSearchAutocomplete
                unitId={formData?.unit_id}
                value={selectedUser}
                onChange={(newValue) => {
                  setSelectedUser(newValue)
                }}
                excludeEmails={[formData?.control_owner]}
                prefetch={assignmentDialogOpen}
                helperText={
                  selectedUser?.email_id ||
                  `Users from ${(formData?.unit_name || formData?.unit_id || 'this unit').toString().trim() || 'this unit'} only`
                }
              />
              {!isActive && (
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
              )}
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
              disabled={updating}
            >
              {updating ? 'Updating...' : 'Update Assignment'}
            </Button>
          )}
        </DialogActions>
      </Dialog>

      <Dialog
        open={approverAssignmentDialogOpen}
        onClose={handleCloseApproverAssignmentDialog}
        aria-labelledby="racm-approver-assignment-dialog-title"
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
          id="racm-approver-assignment-dialog-title"
          sx={{
            pb: 2.5,
            pt: 3,
            px: 3,
            fontWeight: 700,
            fontSize: '1.25rem',
            color: theme.palette.text.primary,
          }}
        >
          Approver Assignment
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
                <Typography variant="body2" component="span" sx={popupLabelSx}>Current Approver Email:</Typography>
                <Typography variant="body2" component="span">{popupValue(formData.approver_email_id)}</Typography>
              </Box>
              <Box sx={{ ...popupRowSx, mb: 2 }}>
                <Typography variant="body2" component="span" sx={popupLabelSx}>Current Approver Name:</Typography>
                <Typography variant="body2" component="span">
                  {(formData?.approver_display_name || formData?.approver_name || '').trim() || '-'}
                </Typography>
              </Box>

              {Boolean((formData?.racm_specific_approver_email_id || '').trim()) && (
                <Alert severity="warning" sx={{ mb: 2 }}>
                  This RACM already has a RACM-specific approver. Saving will replace the existing RACM-specific approver.
                </Alert>
              )}

              <CompanyUserSearchAutocomplete
                role="approver"
                label="Search Approver"
                value={selectedApprover}
                onChange={setSelectedApprover}
                prefetch={approverAssignmentDialogOpen}
                helperText="All approvers in this company are available"
              />
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={handleCloseApproverAssignmentDialog} disabled={assigningApprover}>
            Cancel
          </Button>
          {selectedApprover?.email_id && (
            <Button
              variant="contained"
              color="secondary"
              onClick={handleAssignApprover}
              disabled={assigningApprover}
            >
              {assigningApprover ? 'Assigning...' : 'Assign Approver'}
            </Button>
          )}
        </DialogActions>
      </Dialog>

      <Dialog
        open={suggestedChangesDialogOpen}
        onClose={handleCloseSuggestedChangesDialog}
        maxWidth="md"
        fullWidth
        sx={{
          zIndex: (dialogTheme) => dialogTheme.zIndex.modal + 20,
        }}
        PaperProps={{
          sx: {
            mt: { xs: 8, sm: 10 },
          },
        }}
      >
        <DialogTitle sx={{ fontWeight: 700 }}>
          Suggested Changes
        </DialogTitle>
        <DialogContent dividers>
          {(String(activeChangeRequest?.requested_by_display || '').trim()
            || String(activeChangeRequest?.requested_by_email || '').trim()
            || activeChangeRequest?.requested_at) ? (
            <Box sx={{ mb: 2, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                Requested by: {formatNameWithEmail(activeChangeRequest?.requested_by_display, activeChangeRequest?.requested_by_email)}
              </Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                Requested on: {activeChangeRequest?.requested_at ? formatDateTime(activeChangeRequest.requested_at) : '-'}
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
                          {formatChangeRequestDisplayValue(item.field_db_name, item.old_value_text)}
                        </Typography>
                      </Box>
                      <Box>
                        <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary' }}>
                          Suggested Value
                        </Typography>
                        <Typography variant="body2" sx={{ color: 'text.primary', whiteSpace: 'pre-wrap', mt: 0.5 }}>
                          {formatChangeRequestDisplayValue(item.field_db_name, item.new_value_text)}
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
          <ChangeRequestHistoryList
            requests={changeRequestHistory}
            formatDateTime={formatDateTime}
            formatNameWithEmail={formatNameWithEmail}
          />
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
            sx={{ color: theme.palette.text.secondary, fontSize: '0.9375rem', lineHeight: 1.5, m: 0, my: 2 }}
          >
            Choose an action for this RACM.
          </DialogContentText>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {showSelfAssignButton ? (
              <Box sx={{ p: 2, borderRadius: 1.5, border: '1px solid', borderColor: 'divider' }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.75 }}>
                  Self Assign
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Assign this RACM to yourself for document upload and submission. Process owner assignment will be disabled after self-assignment. Due date and reminder frequency must already be configured.
                </Typography>
              </Box>
            ) : null}
            <Box sx={{ p: 2, borderRadius: 1.5, border: '1px solid', borderColor: 'divider' }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.75 }}>
                Delete
              </Typography>
              <Typography variant="body2" color="text.secondary">
                This RACM will be removed permanently, including all sample documents, user-uploaded documents, Mitigation/Compensatory Plans attachments, and related database rows.
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
            <Box sx={{ p: 2, borderRadius: 1.5, border: '1px solid', borderColor: 'divider' }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.75 }}>
                Approver Assignment
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Assign a RACM-specific approver for this control. This overrides any unit-level or process-level approver for this RACM only.
              </Typography>
            </Box>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3, pt: 2.5, gap: 1.5, borderTop: '1px solid', borderColor: 'divider', flexWrap: 'wrap' }}>
          <Button onClick={handleMoreActionsClose} variant="outlined">
            Cancel
          </Button>
          {showSelfAssignButton ? (
            <Button onClick={handleChooseSelfAssignFromMore} variant="contained" color="primary">
              Self Assign
            </Button>
          ) : null}
          <Button onClick={handleChooseApproverAssignmentFromMore} variant="outlined" color="primary">
            Approver Assignment
          </Button>
          <Button onClick={handleChooseDeleteFromMore} variant="outlined" color="error">
            Delete
          </Button>
          <Button onClick={handleChooseReplicateFromMore} variant="contained" color="secondary">
            Replicate
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={selfAssignConfirmDialogOpen}
        onClose={handleSelfAssignCancel}
        aria-labelledby="self-assign-dialog-title"
        aria-describedby="self-assign-dialog-description"
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
        <DialogTitle id="self-assign-dialog-title" sx={{ py: 2, px: 2.5, fontWeight: 600, fontSize: '1.25rem' }}>
          Self Assign RACM
        </DialogTitle>
        <DialogContent sx={{ px: 3, pt: 1, pb: 3 }}>
          <DialogContentText id="self-assign-dialog-description" sx={{ color: 'text.secondary', fontSize: '0.9375rem', lineHeight: 1.5, mt: 2 }}>
            Assign this RACM to yourself for document upload and submission. Process owner assignment will be disabled after self-assignment. 
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3, gap: 1.5, borderTop: '1px solid', borderColor: 'divider' }}>
          <Button onClick={handleSelfAssignCancel} disabled={selfAssigning} variant="outlined">
            Cancel
          </Button>
          <Button onClick={handleSelfAssignConfirm} disabled={selfAssigning} variant="contained" color="primary">
            {selfAssigning ? 'Assigning...' : 'Self Assign'}
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
            sx={{ color: theme.palette.text.secondary, fontSize: '0.9375rem', lineHeight: 1.5, my:2 }}
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
            py:2,
            px:2.5,
            fontWeight: 600,
            fontSize: '1.25rem',
            color: theme.palette.text.primary,
          }}
        >
          Control Activation
        </DialogTitle>
        <DialogContent sx={{ px: 3, pt: 3, pb: 3 }}>
          <DialogContentText
            id="set-active-dialog-description"
            sx={{
              color: theme.palette.text.secondary,
              fontSize: '0.9375rem',
              lineHeight: 1.5,
              mt:2.5,
            }}
          >
            Are you sure you want to set this RACM Active?
          </DialogContentText>
        </DialogContent>
        <DialogActions
          sx={{
            px: 3,
            pb: 3,
            gap: 1.5,
            borderTop: '1px solid',
            borderColor: 'divider',
          }}
        >
          <Button onClick={handleSetActiveCancel} disabled={updating} variant="outlined" sx={{ textTransform: 'none', px: 3, py: 1 }}>
            Cancel
          </Button>
          <Button onClick={handleSetActiveConfirm} disabled={updating} variant="contained" color="secondary" sx={{ textTransform: 'none', px: 3, py: 1, fontWeight: 600 }}>
            {updating ? 'Setting...' : 'Set Active'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={setInactiveConfirmDialogOpen}
        onClose={handleSetInactiveCancel}
        aria-labelledby="set-inactive-dialog-title"
        aria-describedby="set-inactive-dialog-description"
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
          id="set-inactive-dialog-title"
          sx={{
            py:2,
            px:2.5,
            fontWeight: 600,
            fontSize: '1.25rem',
            color: theme.palette.text.primary,
          }}
        >
          Control Deactivation
        </DialogTitle>
        <DialogContent sx={{ px: 3, pt: 3, pb: 3 }}>
          <DialogContentText
            id="set-inactive-dialog-description"
            sx={{
              color: theme.palette.text.secondary,
              fontSize: '0.9375rem',
              lineHeight: 1.5,
              mt:2.5,
            }}
          >
            Are you sure you want to set this RACM Inactive? Inactive RACMs are hidden from approvers and cannot be reviewed.
          </DialogContentText>
        </DialogContent>
        <DialogActions
          sx={{
            px: 3,
            pb: 3,
            gap: 1.5,
            borderTop: '1px solid',
            borderColor: 'divider',
          }}
        >
          <Button onClick={handleSetInactiveCancel} disabled={updating} variant="outlined" sx={{ textTransform: 'none', px: 3, py: 1 }}>
            Cancel
          </Button>
          <Button onClick={handleSetInactiveConfirm} disabled={updating} variant="contained" color="warning" sx={{ textTransform: 'none', px: 3, py: 1, fontWeight: 600 }}>
            {updating ? 'Setting...' : 'Set Inactive'}
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
              mt: 2,
            }}
          >
            Are you sure you want to delete this RACM? This action cannot be undone. The form, all sample documents, all user-uploaded documents, Mitigation/Compensatory Plans attachments, and their database rows will be removed permanently.
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
