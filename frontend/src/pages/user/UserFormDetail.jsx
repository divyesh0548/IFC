import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTheme } from '@mui/material/styles'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'
import Box from '@mui/material/Box'
import TextField from '@mui/material/TextField'
import { DatePicker } from '@mui/x-date-pickers/DatePicker'
import Button from '@mui/material/Button'
import Checkbox from '@mui/material/Checkbox'
import MenuItem from '@mui/material/MenuItem'
import Divider from '@mui/material/Divider'
import Fab from '@mui/material/Fab'
import IconButton from '@mui/material/IconButton'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Tooltip from '@mui/material/Tooltip'
import AttachFileIcon from '@mui/icons-material/AttachFile'
import CloseIcon from '@mui/icons-material/Close'
import DownloadIcon from '@mui/icons-material/Download'
import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown'
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp'
import InsertDriveFileRoundedIcon from '@mui/icons-material/InsertDriveFileRounded'
import AddIcon from '@mui/icons-material/Add'
import EditNoteIcon from '@mui/icons-material/EditNote'
import { toast } from 'react-hot-toast'
import * as XLSX from 'xlsx'
import dayjs from 'dayjs'
import { FORM_DETAIL_MAX_WIDTH } from '../../uiConstants'
import {
  DOCUMENT_UPLOAD_ACCEPT,
  DOCUMENT_UPLOAD_INVALID_SIZE_MESSAGE,
  DOCUMENT_UPLOAD_INVALID_TYPE_MESSAGE,
  validateDocumentUploadFiles,
} from '../../lib/documentUploadRestrictions'
import { formatRacmUserDocumentSubtitle, normalizeRacmUserDocuments } from '../../lib/racmUserDocuments'
import ChangeRequestHistoryList from '../../components/racm/ChangeRequestHistoryList'
import { RACM_FIELD_LABELS, orderControlDetailKeys } from '../../racmFormDetailFields'
import { useSyncGlobalLoading } from '../../contexts/GlobalLoadingContext'
import { formatIndianDateTime } from '../../lib/dateTime'
import { apiUrl, API_BASE_URL } from '../../config/api'
import { formatDisplayName } from '../../utils/displayName'

const REQUEST_CHANGE_FIELD_KEYS = [
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
  'control_type_fo',
  'control_type_ma',
  'nature_of_control',
  'completeness',
  'existence_occurrence',
  'rights_and_obligation',
  'valuation_and_allocation',
  'presentation_and_disclosure',
  'due_date',
]

const REQUEST_CHANGE_BOOLEAN_FIELDS = new Set([
  'completeness',
  'existence_occurrence',
  'rights_and_obligation',
  'valuation_and_allocation',
  'presentation_and_disclosure',
])

function formatNameWithEmail(name, email) {
  const normalizedName = String(name || '').trim()
  const normalizedEmail = String(email || '').trim()

  if (normalizedName && normalizedEmail && normalizedName.toLowerCase() !== normalizedEmail.toLowerCase()) {
    return `${normalizedName} (${normalizedEmail})`
  }

  return normalizedName || normalizedEmail || '-'
}

const REQUEST_CHANGE_DROPDOWN_OPTIONS = {
  risk_heat: ['High', 'Low', 'Medium'],
  control_type_fo: ['Financial', 'Operational'],
  control_type_ma: ['Manual', 'Automated'],
  nature_of_control: ['Preventive', 'Detective'],
  key_control: ['Yes', 'No'],
  control_relies_on_ipe: ['Yes', 'No'],
  whether_fraud_risks_exist: ['Yes', 'No'],
}

const REQUEST_CHANGE_FIELD_SET = new Set(REQUEST_CHANGE_FIELD_KEYS)

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

function normalizeRequestChangeValue(fieldKey, value) {
  if (REQUEST_CHANGE_BOOLEAN_FIELDS.has(fieldKey)) {
    return value === true || value === 'true' || value === '1' || value === 1
  }

  if (fieldKey === 'due_date') {
    if (!value) return ''
    const raw = String(value).trim()
    return raw.length >= 10 ? raw.slice(0, 10) : raw
  }

  return value == null ? '' : String(value)
}

function isRequestChangeFieldEditable(fieldKey) {
  return REQUEST_CHANGE_FIELD_SET.has(fieldKey)
}

function UserFormDetail() {
  const theme = useTheme()
  const navigate = useNavigate()
  const { form_id } = useParams()
  const [formData, setFormData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)
  const [uploadingUserDocuments, setUploadingUserDocuments] = useState(false)
  const [requestChangeSaving, setRequestChangeSaving] = useState(false)
  const [selectedFiles, setSelectedFiles] = useState([])
  const [remarksByUser, setRemarksByUser] = useState('')
  const [isRequestChangeMode, setIsRequestChangeMode] = useState(false)
  const [requestChangeValues, setRequestChangeValues] = useState({})
  const [requestReason, setRequestReason] = useState('')
  const [activeChangeRequest, setActiveChangeRequest] = useState(null)
  const [changeRequestDialogOpen, setChangeRequestDialogOpen] = useState(false)
  const [activeChangeRequestLoading, setActiveChangeRequestLoading] = useState(false)
  const [changeRequestHistory, setChangeRequestHistory] = useState([])
  const [changeRequestHistoryCount, setChangeRequestHistoryCount] = useState(0)
  const [changeRequestHistoryLoading, setChangeRequestHistoryLoading] = useState(false)
  const [changeRequestHistoryDialogOpen, setChangeRequestHistoryDialogOpen] = useState(false)
  const [expandedDeficiencyVersions, setExpandedDeficiencyVersions] = useState({})
  const [showScrollTop, setShowScrollTop] = useState(false)
  const [sampleDocsDialogOpen, setSampleDocsDialogOpen] = useState(false)
  const [userDocsDialogOpen, setUserDocsDialogOpen] = useState(false)
  const [removedUploadedDocPaths, setRemovedUploadedDocPaths] = useState([])
  const [deficiencyResponseForm, setDeficiencyResponseForm] = useState({
    response_type: 'mitigation_plan',
    explaination: '',
    concerned_person: '',
    due_date: '',
  })
  const [deficiencyResponseFiles, setDeficiencyResponseFiles] = useState([])
  const [deficiencyResponseSubmitting, setDeficiencyResponseSubmitting] = useState(false)

  useSyncGlobalLoading(loading || saving || uploadingUserDocuments || requestChangeSaving || changeRequestHistoryLoading || deficiencyResponseSubmitting)

  // Removed editableFields state - users can only edit remarks_by_user

  useEffect(() => {
    const onScroll = () => {
      setShowScrollTop(window.scrollY > 300)
    }

    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    const checkAuthAndFetch = async () => {
      // First check authentication
      try {
        const authResponse = await fetch(apiUrl('/api/auth/verify'), {
          method: 'GET',
          credentials: 'include',
        })

        const authData = await authResponse.json()

        if (!authResponse.ok || !authData.success) {
          // Not authenticated - redirect to login with redirect param
          const redirectUrl = encodeURIComponent(`/user/form/${form_id}`)
          navigate(`/login?redirect=${redirectUrl}`, { replace: true })
          return
        }

        // Authenticated - now fetch form data
        await fetchFormData()
      } catch (error) {
        console.error('Auth check error:', error)
        const redirectUrl = encodeURIComponent(`/user/form/${form_id}`)
        navigate(`/login?redirect=${redirectUrl}`, { replace: true })
      }
    }

    checkAuthAndFetch()
  }, [form_id, navigate])

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
        // Initialize remarks by user (only editable field for users)
        setRemarksByUser(data.data.remarks_by_user || '')
        const nextRequestValues = {}
        REQUEST_CHANGE_FIELD_KEYS.forEach((fieldKey) => {
          nextRequestValues[fieldKey] = normalizeRequestChangeValue(fieldKey, data.data[fieldKey])
        })
        setRequestChangeValues(nextRequestValues)
        setIsRequestChangeMode(false)
        setRequestReason('')
        setRemovedUploadedDocPaths([])
        setDeficiencyResponseForm(buildDeficiencyResponseFormState(data.data))
        setDeficiencyResponseFiles([])
      } else if (response.status === 403) {
        // User is authenticated but not authorized (different email)
        toast.error('You are not authorized to access this form')
        navigate('/user/dashboard', { replace: true })
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
        return data.data
      }

      setActiveChangeRequest(null)
      return null
    } catch (error) {
      console.error('Error fetching active change request:', error)
      setActiveChangeRequest(null)
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

  useEffect(() => {
    if (!formData?.pending_changes) {
      setActiveChangeRequest(null)
      return
    }
    fetchActiveChangeRequest()
  }, [formData?.pending_changes, form_id])

  useEffect(() => {
    fetchChangeRequestHistory()
  }, [form_id])

  // Removed handleFieldChange - users can only edit remarks_by_user

  const handleFileSelect = (e) => {
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

    setSelectedFiles((currentFiles) => {
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

    // Reset file input to allow selecting the same file again
    e.target.value = ''
  }

  const handleRemoveFile = (indexToRemove) => {
    setSelectedFiles((currentFiles) =>
      currentFiles.filter((_, index) => index !== indexToRemove)
    )
  }

  const getUserUploadedDocs = () => {
    return normalizeRacmUserDocuments(
      formData?.doc_uploaded_by_user_docs,
      formData?.doc_uploaded_by_user
    )
  }

  const handleOpenUserDocsDialog = () => {
    setUserDocsDialogOpen(true)
  }

  const handleCloseUserDocsDialog = () => {
    setUserDocsDialogOpen(false)
  }

  const handleRemoveExistingUploadedDoc = (docPath) => {
    if (!isRejected || !docPath) return

    setRemovedUploadedDocPaths((currentPaths) => (
      currentPaths.includes(docPath)
        ? currentPaths
        : [...currentPaths, docPath]
    ))
  }

  const handleDownloadUserDocument = async (filePath) => {
    if (!filePath) return

    try {
      const fileName = getFileName(filePath)
      const response = await fetch(`${API_BASE_URL}/api/control-forms/download-document?path=${encodeURIComponent(filePath)}`, {
        method: 'GET',
        credentials: 'include',
      })

      const status = response.status
      const contentType = response.headers.get('content-type') || ''

      if (status === 200 && contentType.includes('application/octet-stream')) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = fileName
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
        toast.success('Document downloaded successfully')
      } else {
        let errorMessage = 'Failed to download document'
        try {
          const errorData = await response.json()
          errorMessage = errorData.message || errorData.error || errorMessage
        } catch {
          if (status === 400) {
            errorMessage = 'Bad request: File path is required'
          } else if (status === 403) {
            errorMessage = 'Access denied: Invalid file path'
          } else if (status === 404) {
            errorMessage = 'File not found'
          } else if (status === 401) {
            errorMessage = 'Authentication required'
          } else if (status >= 500) {
            errorMessage = 'Server error occurred'
          } else {
            errorMessage = `Download failed with status ${status}`
          }
        }
        toast.error(errorMessage)
      }
    } catch (error) {
      console.error('Error downloading user document:', error)
      toast.error(`Error downloading document: ${error.message}`)
    }
  }

  const handleUploadUserDocuments = async () => {
    if (selectedFiles.length === 0) {
      toast.error('Please select at least one document to upload')
      return
    }

    setUploadingUserDocuments(true)
    try {
      const formDataUpload = new FormData()
      selectedFiles.forEach((file) => {
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
        setSelectedFiles([])
        await fetchFormData()
      } else {
        toast.error(uploadData.message || 'Failed to upload documents')
      }
    } catch (error) {
      console.error('Error uploading user documents:', error)
      toast.error('Failed to upload documents')
    } finally {
      setUploadingUserDocuments(false)
    }
  }

  const handleSendForApproval = async () => {
    if (Boolean(formData?.pending_changes)) {
      toast.error('This RACM has a pending change request and cannot be sent for approval until it is resolved.')
      return
    }

    const existingUploadedDocs = getUserUploadedDocs().filter(
      (doc) => !removedUploadedDocPaths.includes(doc.doc_uploaded_by_user)
    )
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

    setSaving(true)

    try {
      const uploadedDocumentPaths = [...new Set(
        existingUploadedDocs
          .map((doc) => doc.doc_uploaded_by_user)
          .filter(Boolean)
      )]
      const documentPath = uploadedDocumentPaths[uploadedDocumentPaths.length - 1] || null
      const shouldReplaceUploadedDocuments = removedUploadedDocPaths.length > 0
      const response = await fetch(`${API_BASE_URL}/api/control-forms/${form_id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          remarks_by_user: remarksByUser,
          status: 'sent for approval',
          ...(shouldReplaceUploadedDocuments ? {
            doc_uploaded_by_user: documentPath,
            doc_uploaded_by_user_docs: uploadedDocumentPaths,
            replace_user_documents: true,
          } : {}),
        })
      })

      const data = await response.json()

      if (response.ok && data.success) {
        const successMessage = formData?.status === 'Rejected' 
          ? 'RACM resubmitted for approval successfully' 
          : 'RACM sent for approval successfully'
        toast.success(successMessage)
        setSelectedFiles([])
        setRemovedUploadedDocPaths([])
        // Update local state immediately with new status
        if (data.data) {
          setFormData({
            ...formData,
            ...data.data,
            status: data.data.status || 'sent for approval'
          })
        } else {
          // If data.data is not available, update status locally
          setFormData({
            ...formData,
            status: 'sent for approval',
            remarks_by_user: remarksByUser
          })
        }
        // Refresh form data to ensure consistency
        fetchFormData()
      } else {
        const errorMessage = data.message || 'Failed to send for approval'
        toast.error(errorMessage)
      }
    } catch (error) {
      console.error('Error sending for approval:', error)
      const errorMessage = 'Error sending for approval'
      toast.error(errorMessage)
    } finally {
      setSaving(false)
    }
  }

  const getRequestChangeValue = (fieldKey) => {
    if (Object.prototype.hasOwnProperty.call(requestChangeValues, fieldKey)) {
      return requestChangeValues[fieldKey]
    }
    return normalizeRequestChangeValue(fieldKey, formData?.[fieldKey])
  }

  const hasRequestChangeFieldChanged = (fieldKey) => {
    const originalValue = normalizeRequestChangeValue(fieldKey, formData?.[fieldKey])
    const currentValue = getRequestChangeValue(fieldKey)
    return originalValue !== currentValue
  }

  const handleStartRequestChange = () => {
    const nextRequestValues = {}
    REQUEST_CHANGE_FIELD_KEYS.forEach((fieldKey) => {
      nextRequestValues[fieldKey] = normalizeRequestChangeValue(fieldKey, formData?.[fieldKey])
    })
    setRequestChangeValues(nextRequestValues)
    setRequestReason('')
    setIsRequestChangeMode(true)
  }

  const handleCancelRequestChange = () => {
    const nextRequestValues = {}
    REQUEST_CHANGE_FIELD_KEYS.forEach((fieldKey) => {
      nextRequestValues[fieldKey] = normalizeRequestChangeValue(fieldKey, formData?.[fieldKey])
    })
    setRequestChangeValues(nextRequestValues)
    setIsRequestChangeMode(false)
    setRequestReason('')
  }

  const handleRequestChangeFieldUpdate = (fieldKey, nextValue) => {
    setRequestChangeValues((currentValues) => ({
      ...currentValues,
      [fieldKey]: nextValue,
    }))
  }

  const handleSubmitRequestChange = async () => {
    const changes = REQUEST_CHANGE_FIELD_KEYS
      .map((fieldKey, index) => {
        const originalValue = normalizeRequestChangeValue(fieldKey, formData?.[fieldKey])
        const updatedValue = getRequestChangeValue(fieldKey)
        if (originalValue === updatedValue) return null
        return {
          field_db_name: fieldKey,
          field_label: fieldLabels[fieldKey] || fieldKey,
          new_value_text:
            REQUEST_CHANGE_BOOLEAN_FIELDS.has(fieldKey)
              ? String(Boolean(updatedValue))
              : String(updatedValue ?? ''),
          display_order: index,
        }
      })
      .filter(Boolean)

    if (changes.length === 0) {
      toast.error('Change at least one field before submitting the request')
      return
    }

    setRequestChangeSaving(true)
    try {
      const response = await fetch(`${API_BASE_URL}/api/control-forms/${form_id}/request-change`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          changes,
          request_reason: String(requestReason || '').trim(),
        }),
      })

      const data = await response.json()
      if (response.ok && data.success) {
        toast.success('Change request submitted successfully')
        setIsRequestChangeMode(false)
        setRequestReason('')
        setFormData((currentFormData) => ({
          ...(currentFormData || {}),
          pending_changes: true,
        }))
        await fetchFormData()
      } else {
        toast.error(data.message || 'Failed to submit change request')
      }
    } catch (error) {
      console.error('Error submitting change request:', error)
      toast.error('Error submitting change request')
    } finally {
      setRequestChangeSaving(false)
    }
  }

  const handleOpenPendingRequestDialog = async () => {
    if (!activeChangeRequest) {
      const request = await fetchActiveChangeRequest()
      if (!request) {
        toast.error('No pending request found')
        return
      }
    }
    setChangeRequestDialogOpen(true)
  }

  const handleClosePendingRequestDialog = () => {
    setChangeRequestDialogOpen(false)
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

  const toggleDeficiencySubmissionExpansion = (submissionId) => {
    setExpandedDeficiencyVersions((prev) => ({
      ...prev,
      [submissionId]: !prev[submissionId],
    }))
  }

  const formatDateTime = (dateString) => {
    return formatIndianDateTime(dateString, 'N/A')
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
        setDeficiencyResponseForm(buildDeficiencyResponseFormState(data.data, responseType))
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

  const handleOpenSampleDocsDialog = () => {
    setSampleDocsDialogOpen(true)
  }

  const handleCloseSampleDocsDialog = () => {
    setSampleDocsDialogOpen(false)
  }

  const handleDownloadSampleDocument = async (filePath) => {
    if (!filePath) return
    
    try {
      const fileName = getFileName(filePath)
      const response = await fetch(`${API_BASE_URL}/api/control-forms/download-document?path=${encodeURIComponent(filePath)}`, {
        method: 'GET',
        credentials: 'include',
      })

      // Check status code explicitly
      const status = response.status
      const contentType = response.headers.get('content-type') || ''

      // Success: status 200 and content-type is octet-stream (file download)
      if (status === 200 && contentType.includes('application/octet-stream')) {
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
      } else {
        // Error response: try to parse JSON error message
        let errorMessage = 'Failed to download sample document'
        try {
          const errorData = await response.json()
          errorMessage = errorData.message || errorData.error || errorMessage
        } catch {
          // If response is not JSON, use status-based message
          if (status === 400) {
            errorMessage = 'Bad request: File path is required'
          } else if (status === 403) {
            errorMessage = 'Access denied: Invalid file path'
          } else if (status === 404) {
            errorMessage = 'File not found'
          } else if (status === 401) {
            errorMessage = 'Authentication required'
          } else if (status >= 500) {
            errorMessage = 'Server error occurred'
          } else {
            errorMessage = `Download failed with status ${status}`
          }
        }
        toast.error(errorMessage)
      }
    } catch (error) {
      console.error('Error downloading sample document:', error)
      toast.error(`Error downloading sample document: ${error.message}`)
    }
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
    'control_owner',
    'control_design_procs',
    'control_type_fo',
    'control_type_ma',
    'nature_of_control',
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
    'doc_uploaded_by_user',
    'remarks_by_user'
  ]

  // Fields to exclude from display
  const excludedFields = ['id', 'form_id', 'company_identifier', 'created_at', 'active', 'status', 'reason_by_approver', 'reminder_frequency']

  // Check if form is sent for approval, approved, or rejected
  const isSentForApproval = formData?.status === 'sent for approval'
  const isApproved = formData?.status === 'Approved'
  const isRejected = formData?.status === 'Rejected'
  const hasPendingChanges = Boolean(formData?.pending_changes)
  // Form is editable if status is not 'sent for approval' or 'Approved'
  // If status is 'Rejected', user can edit and resubmit
  const isEditable = !isSentForApproval && !isApproved
  const canRequestChange = isEditable && !hasPendingChanges
  const hasAnyRequestChange = REQUEST_CHANGE_FIELD_KEYS.some((fieldKey) => hasRequestChangeFieldChanged(fieldKey))

  // Fields to hide when status is empty/null or 'sent for approval'
  // Only show them when status is 'Approved' or 'Rejected'
  // Note: remarks_by_user is always displayed (removed from this list)
  const conditionalHiddenFields = ['control_design_conclusion', 'design_deficiency_desc']

  // Check if status should hide conditional fields
  const shouldHideConditionalFields = !formData?.status || formData.status === '' || formData.status === 'sent for approval'
  
  // Design & Implementation fields should render only when they have a value.
  const groupedApproverFields = ['control_design_procs', 'control_design_conclusion', 'design_deficiency_desc']

  const hasGroupedFieldValue = formData
    ? groupedApproverFields.some((key) => {
        const value = formData[key]
        return value !== null && value !== undefined && value !== '' && String(value).trim() !== ''
      })
    : false

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

  // Sort fields according to fieldOrder and filter out conditional hidden fields and grouped fields
  const sortedFields = fieldOrder.filter(key => {
    // First check if field exists and is not in excludedFields
    if (!Object.prototype.hasOwnProperty.call(formData, key) || excludedFields.includes(key)) {
      return false
    }
    // Exclude grouped fields from regular display (they'll be shown as a group)
    if (groupedApproverFields.includes(key)) {
      return false
    }
    // Then check if field should be hidden based on status
    if (shouldHideConditionalFields && conditionalHiddenFields.includes(key)) {
      return false
    }
    return true
  })
  const sampleDocs = getSampleDocs()
  const sampleDocCount = sampleDocs.length
  const uploadedUserDocs = getUserUploadedDocs()
  const visibleUploadedUserDocs = uploadedUserDocs.filter(
    (doc) => !removedUploadedDocPaths.includes(doc.doc_uploaded_by_user)
  )
  const uploadedUserDocCount = visibleUploadedUserDocs.length
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
  const deficiencyResponseStatus = String(formData?.deficiency_response_status || '').trim()
  const needsDeficiencyResponse = Boolean(formData?.deficiency_action_status)
  const showDeficiencyActionNotice = needsDeficiencyResponse
  const canSubmitDeficiencyResponse = needsDeficiencyResponse && deficiencyResponseStatus !== 'submitted_for_review'
  const showActiveDeficiencyResponseSection = Boolean(
    deficiencyResponse && String(deficiencyResponse.status || '').trim().toLowerCase() === 'submitted'
  )

  const renderRequestChangeInput = (fieldKey, label) => {
    const value = getRequestChangeValue(fieldKey)
    const isChanged = hasRequestChangeFieldChanged(fieldKey)
    const textFieldSx = {
      '& .MuiOutlinedInput-root': {
        backgroundColor: 'transparent',
      },
    }

    if (REQUEST_CHANGE_BOOLEAN_FIELDS.has(fieldKey)) {
      return (
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Checkbox
              checked={Boolean(value)}
              onChange={(e) => handleRequestChangeFieldUpdate(fieldKey, e.target.checked)}
              sx={{ p: 0.5 }}
            />
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              {value ? 'Selected' : 'Not selected'}
            </Typography>
          </Box>
          {isChanged ? (
            <Box
              sx={{
                mt: 1,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 0.75,
                px: 1,
                py: 0.5,
                borderRadius: 999,
                backgroundColor: 'warning.light',
                color: 'warning.contrastText',
              }}
            >
              <EditNoteIcon sx={{ fontSize: 16 }} />
              <Typography variant="caption" sx={{ color: 'inherit', fontWeight: 700 }}>
                Included for change
              </Typography>
            </Box>
          ) : null}
        </Box>
      )
    }

    const dropdownOptions = REQUEST_CHANGE_DROPDOWN_OPTIONS[fieldKey]
    if (Array.isArray(dropdownOptions) && dropdownOptions.length > 0) {
      return (
        <Box>
          <TextField
            select
            fullWidth
            variant="outlined"
            value={String(value || '')}
            onChange={(e) => handleRequestChangeFieldUpdate(fieldKey, e.target.value)}
            sx={textFieldSx}
          >
            {dropdownOptions.map((option) => (
              <MenuItem key={option} value={option}>
                {option}
              </MenuItem>
            ))}
          </TextField>
          {isChanged ? (
            <Box
              sx={{
                mt: 1,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 0.75,
                px: 1,
                py: 0.5,
                borderRadius: 999,
                backgroundColor: 'warning.light',
                color: 'warning.contrastText',
              }}
            >
              <EditNoteIcon sx={{ fontSize: 16 }} />
              <Typography variant="caption" sx={{ color: 'inherit', fontWeight: 700 }}>
                Included for change
              </Typography>
            </Box>
          ) : null}
        </Box>
      )
    }

    return (
      <Box>
        <TextField
          variant="outlined"
          value={value}
          onChange={(e) => handleRequestChangeFieldUpdate(fieldKey, e.target.value)}
          fullWidth
          multiline={fieldKey !== 'due_date'}
          rows={fieldKey !== 'due_date' ? 4 : undefined}
          type={fieldKey === 'due_date' ? 'date' : 'text'}
          placeholder={fieldKey === 'due_date' ? undefined : label}
          sx={textFieldSx}
        />
        {isChanged ? (
          <Box
            sx={{
              mt: 1,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 0.75,
              px: 1,
              py: 0.5,
              borderRadius: 999,
              backgroundColor: 'warning.light',
              color: 'warning.contrastText',
            }}
          >
            <EditNoteIcon sx={{ fontSize: 16 }} />
            <Typography variant="caption" sx={{ color: 'inherit', fontWeight: 700 }}>
              Included for change
            </Typography>
          </Box>
        ) : null}
      </Box>
    )
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
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'flex-end',
              alignItems: 'center',
              gap: 1.5,
              flexWrap: 'wrap',
            }}
          >
            {changeRequestHistoryCount > 0 ? (
              <Button
                variant="outlined"
                onClick={handleOpenChangeRequestHistoryDialog}
                disabled={changeRequestHistoryLoading}
                sx={{ textTransform: 'none', fontWeight: 600, whiteSpace: 'nowrap' }}
              >
                Change Requests ({changeRequestHistoryCount})
              </Button>
            ) : null}
            {isRequestChangeMode ? (
              <>
                <Typography
                  variant="body2"
                  sx={{
                    color: 'text.secondary',
                    mr: { xs: 0, md: 1 },
                    flexBasis: { xs: '100%', md: 'auto' },
                  }}
                >
                  Change only the fields you want to request for correction.
                </Typography>
                <Button
                  variant="outlined"
                  onClick={handleCancelRequestChange}
                  disabled={requestChangeSaving}
                  sx={{ textTransform: 'none', fontWeight: 600 }}
                >
                  Cancel
                </Button>
                <Button
                  variant="contained"
                  color="warning"
                  onClick={handleSubmitRequestChange}
                  disabled={requestChangeSaving || !hasAnyRequestChange}
                  sx={{ textTransform: 'none', fontWeight: 600 }}
                >
                  {requestChangeSaving ? 'Submitting...' : 'Submit Change Request'}
                </Button>
              </>
            ) : (
              <>
                {hasPendingChanges ? (
                  <Button
                    variant="contained"
                    color="warning"
                    onClick={handleOpenPendingRequestDialog}
                    disabled={activeChangeRequestLoading}
                    sx={{ textTransform: 'none', fontWeight: 600, whiteSpace: 'nowrap' }}
                  >
                    Pending Request
                  </Button>
                ) : (
                  <Button
                    variant="contained"
                    startIcon={<AddIcon />}
                    onClick={handleStartRequestChange}
                    disabled={!canRequestChange}
                    sx={{ textTransform: 'none', fontWeight: 600, whiteSpace: 'nowrap' }}
                  >
                    Request Change
                  </Button>
                )}
              </>
            )}
          </Box>
          {isRequestChangeMode ? (
            <TextField
              label="Reason for Change"
              value={requestReason}
              onChange={(e) => setRequestReason(e.target.value)}
              fullWidth
              multiline
              rows={3}
              sx={{ mt: -1 }}
            />
          ) : null}
          {/* Top summary card (4-col grid on md+, same box style as approver summary) */}
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
              <CardContent
                sx={{
                  px: 3.5,
                  pt: 3,
                  pb: 4,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 0,
                }}
              >
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

                  {/* Unit */}
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
                      Unit
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
                      {formData?.unit_name || formData?.unit_id || '-'}
                    </Typography>
                  </Box>

                  {/* Status */}
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
                      Status
                    </Typography>
                    <Typography
                      variant="body2"
                      sx={{
                        color:
                          formData?.status === 'Approved'
                            ? '#10b981'
                            : formData?.status === 'Rejected'
                              ? '#ef4444'
                              : 'text.primary',
                        fontWeight: 500,
                        fontSize: '0.9375rem',
                        lineHeight: 1.5,
                      }}
                    >
                      {formData?.status && formData.status !== '' ? formData.status : 'Pending'}
                    </Typography>
                  </Box>

                  {/* Control Number */}
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
                      Control Number
                    </Typography>
                    {isRequestChangeMode && isRequestChangeFieldEditable('control_number') ? (
                      renderRequestChangeInput('control_number', fieldLabels.control_number)
                    ) : (
                      <Typography
                        variant="body2"
                        sx={{
                          color: 'text.primary',
                          fontWeight: 500,
                          fontSize: '0.9375rem',
                          lineHeight: 1.5,
                        }}
                      >
                        {(formData?.control_number || '').toString().trim() || '-'}
                      </Typography>
                    )}
                  </Box>

                  {/* Created At */}
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
                      Due Date
                    </Typography>
                    {isRequestChangeMode && isRequestChangeFieldEditable('due_date') ? (
                      renderRequestChangeInput('due_date', 'Due Date')
                    ) : (
                      <Typography
                        variant="body2"
                        sx={{
                          color: 'text.primary',
                          fontWeight: 500,
                          fontSize: '0.9375rem',
                          lineHeight: 1.5,
                        }}
                      >
                        {formatDateOnly(formData?.due_date)}
                      </Typography>
                    )}
                  </Box>

                  {/* Approver */}
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
                      Approver
                    </Typography>
                    <Typography
                      variant="body2"
                      sx={{
                        color: 'text.primary',
                        fontWeight: 500,
                        fontSize: '0.9375rem',
                        lineHeight: 1.5,
                        overflowWrap: 'anywhere',
                      }}
                    >
                      {formatDisplayName(
                        formData?.approver_name ||
                          formData?.approver_display_name ||
                          formData?.approver_email_id,
                        ''
                      ) || '-'}
                    </Typography>
                  </Box>

                </Box>
              </CardContent>
            </Card>
          </Box>

          {/* Main content – matches coordinator card styling */}
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
                  {['area', 'sub_process', 'risk_description', 'risk_heat']
                    .filter((key) => sortedFields.includes(key))
                    .map((key) => {
                      const label = fieldLabels[key] || key.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())
                      const value = formData[key]
                      const isEmpty = value === null || value === undefined || value === ''

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
                          {isRequestChangeMode && isRequestChangeFieldEditable(key) ? (
                            renderRequestChangeInput(key, label)
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
                  {['completeness', 'existence_occurrence', 'valuation_and_allocation', 'rights_and_obligation', 'presentation_and_disclosure']
                    .filter((key) => sortedFields.includes(key))
                    .map((key) => {
                      const label = fieldLabels[key]
                      const value = formData[key]
                      const isTruthy = value === true || value === 'true' || value === '1' || value === 1

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
                          {isRequestChangeMode && isRequestChangeFieldEditable(key) ? (
                            renderRequestChangeInput(key, label)
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
                    sortedFields.filter((key) =>
                      ![
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
                        // handled in Submission section
                        'doc_uploaded_by_user',
                        'remarks_by_user',
                      ].includes(key)
                    ),
                    fieldOrder
                  )
                    .map((key) => {
                    const label = fieldLabels[key] || key.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())
                    const value = formData[key]
                    // Read-only fields (including editable fields when form is not editable)
                    // Always use formData values for read-only display (saved database values)
                    const displayValue = value
                    const isEmptyDisplay = displayValue === null || displayValue === undefined || displayValue === ''

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
                        {isRequestChangeMode && isRequestChangeFieldEditable(key) ? (
                          renderRequestChangeInput(key, label)
                        ) : key === 'sample_required' ? (
                          renderSampleRequiredDownload()
                        ) : (
                          <Typography
                            variant="body2"
                            component="dd"
                            sx={{
                              color: isEmptyDisplay ? 'text.disabled' : 'text.secondary',
                              wordBreak: 'break-word',
                              lineHeight: 1.6,
                              fontSize: theme.typography.customSizes.medium,
                            }}
                          >
                            {isEmptyDisplay ? '-' : String(displayValue)}
                          </Typography>
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
                  Submission
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
                      {uploadedUserDocCount > 0 ? (
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
                            Uploaded Documents ({uploadedUserDocCount})
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
                      {selectedFiles.map((file, index) => (
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
                              onClick={() => handleRemoveFile(index)}
                              disabled={!isEditable}
                              sx={{ color: 'error.main' }}
                            >
                              <CloseIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Box>
                      ))}
                      {uploadedUserDocCount === 0 && selectedFiles.length === 0 && (
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
                      {selectedFiles.length > 0 && (
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
                      {isEditable && (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, flexWrap: 'wrap', mt: 0.5 }}>
                          <label>
                            <input
                              type="file"
                              multiple
                              accept={DOCUMENT_UPLOAD_ACCEPT}
                              style={{ display: 'none' }}
                              onChange={handleFileSelect}
                              disabled={!isEditable || uploadingUserDocuments}
                            />
                            <IconButton
                              component="span"
                              disabled={!isEditable || uploadingUserDocuments}
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
                            onClick={handleUploadUserDocuments}
                            disabled={!isEditable || uploadingUserDocuments || selectedFiles.length === 0}
                            variant="outlined"
                            size="small"
                            sx={{ textTransform: 'none' }}
                          >
                            {uploadingUserDocuments ? 'Uploading...' : 'Upload Documents'}
                          </Button>
                        </Box>
                      )}
                    </Box>
                  </Box>
                </Box>

                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, mt: 4, pt: 1 }}>
                  {hasGroupedFieldValue ? (
                    <Box>
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                        {groupedApproverFields
                          .filter((key) => {
                            const value = formData[key]
                            return value !== null && value !== undefined && value !== '' && String(value).trim() !== ''
                          })
                          .map((key) => {
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
                              {isRequestChangeMode && isRequestChangeFieldEditable(key) ? (
                                renderRequestChangeInput(key, label)
                              ) : (
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
                              )}
                            </Box>
                          )
                        })}
                      </Box>
                    </Box>
                  ) : null}
            
                  {String(formData?.reason_by_approver || '').trim() !== '' ? (
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

                  {/* Remarks By User */}
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
                    {isEditable ? (
                      <TextField
                        label={fieldLabels.remarks_by_user}
                        variant="outlined"
                        value={remarksByUser}
                        onChange={(e) => setRemarksByUser(e.target.value)}
                        fullWidth
                        multiline
                        rows={4}
                        disabled={!isEditable}
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
                            color: (formData?.remarks_by_user || '').trim() === '' ? 'text.disabled' : 'text.secondary',
                            wordBreak: 'break-word',
                            lineHeight: 1.6,
                            fontSize: theme.typography.customSizes.medium,
                            whiteSpace: 'pre-wrap',
                          }}
                        >
                          {(formData?.remarks_by_user || '').trim() === '' ? '-' : formData.remarks_by_user}
                        </Typography>
                      </>
                    )}
                  </Box>

                  {isEditable &&
                    (() => {
                      return (
                        <Box sx={{ display: 'flex', justifyContent: 'flex-start' }}>
                          <Button
                            onClick={handleSendForApproval}
                            disabled={saving || uploadingUserDocuments || hasPendingChanges}
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
                            {saving ? (isRejected ? 'Resubmitting...' : 'Sending...') : (isRejected ? 'Resubmit for Approval' : 'Send for Approval')}
                          </Button>
                        </Box>
                      )
                    })()}
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
                    Deficiency Response History
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
                                  Explaination
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
                                        <Button
                                          size="small"
                                          startIcon={<DownloadRoundedIcon />}
                                          onClick={() => handleDownloadUserDocument(attachment.file_url)}
                                          sx={{ textTransform: 'none' }}
                                        >
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
                    Deficiency Response
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
                        <Typography variant="caption" sx={{ display: 'block', fontWeight: 700, mb: 1, color: 'text.secondary' }}>
                          Response Type
                        </Typography>
                        <Typography variant="body2" sx={{ color: 'text.primary' }}>
                          {String(deficiencyResponse.response_type || '').trim() === 'compensatory_racm' ? 'Compensatory RACM' : 'Mitigation Plan'}
                        </Typography>
                      </Box>
                      <Box sx={{ p: 2, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
                        <Typography variant="caption" sx={{ display: 'block', fontWeight: 700, mb: 1, color: 'text.secondary' }}>
                          Explaination
                        </Typography>
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
                            <Typography variant="caption" sx={{ display: 'block', fontWeight: 700, mb: 1, color: 'text.secondary' }}>
                              Concerned Person
                            </Typography>
                            <Typography variant="body2" sx={{ color: 'text.primary' }}>
                              {String(deficiencyCurrentSubmission?.concerned_person || deficiencyResponse.concerned_person || '').trim() || '-'}
                            </Typography>
                          </Box>
                          <Box sx={{ p: 2, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
                            <Typography variant="caption" sx={{ display: 'block', fontWeight: 700, mb: 1, color: 'text.secondary' }}>
                              Due Date
                            </Typography>
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
                          <Typography variant="caption" sx={{ display: 'block', fontWeight: 700, mb: 1.5, color: 'text.secondary' }}>
                            Documents
                          </Typography>
                          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                            {deficiencyAttachments.map((attachment) => (
                              <Box
                                key={attachment.id}
                                sx={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  gap: 2,
                                }}
                              >
                                <Typography variant="body2" sx={{ color: 'text.primary', overflowWrap: 'anywhere' }}>
                                  {attachment.original_name || getFileName(attachment.file_url)}
                                </Typography>
                                <Button
                                  size="small"
                                  startIcon={<DownloadRoundedIcon />}
                                  onClick={() => handleDownloadUserDocument(attachment.file_url)}
                                  sx={{ textTransform: 'none' }}
                                >
                                  Download
                                </Button>
                              </Box>
                            ))}
                          </Box>
                        </Box>
                      ) : null}
                      {String(deficiencyResponse.review_comment || '').trim() ? (
                        <Box sx={{ p: 2, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
                          <Typography variant="caption" sx={{ display: 'block', fontWeight: 700, mb: 1, color: 'text.secondary' }}>
                            Approver Comment
                          </Typography>
                          <Typography variant="body2" sx={{ color: 'text.primary', whiteSpace: 'pre-wrap' }}>
                            {String(deficiencyResponse.review_comment)}
                          </Typography>
                        </Box>
                      ) : null}
                    </Box>
                  ) : null}

                  {canSubmitDeficiencyResponse ? (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
                      <TextField
                        select
                        label="Response Type"
                        value={deficiencyResponseForm.response_type}
                        onChange={(e) => handleDeficiencyResponseFieldChange('response_type', e.target.value)}
                        fullWidth
                      >
                        <MenuItem value="mitigation_plan">Mitigation Plan</MenuItem>
                        <MenuItem value="compensatory_racm">Compensatory RACM</MenuItem>
                      </TextField>
                      <TextField
                        label="Explaination"
                        value={deficiencyResponseForm.explaination}
                        onChange={(e) => handleDeficiencyResponseFieldChange('explaination', e.target.value)}
                        fullWidth
                        multiline
                        rows={4}
                      />
                      {deficiencyResponseForm.response_type === 'mitigation_plan' ? (
                        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 2 }}>
                          <TextField
                            label="Concerned Person (email or name)"
                            value={deficiencyResponseForm.concerned_person}
                            onChange={(e) => handleDeficiencyResponseFieldChange('concerned_person', e.target.value)}
                            fullWidth
                          />
                          <DatePicker
                            label="Due Date"
                            value={deficiencyResponseForm.due_date ? dayjs(deficiencyResponseForm.due_date) : null}
                            onChange={(newValue) => {
                              handleDeficiencyResponseFieldChange(
                                'due_date',
                                newValue && newValue.isValid() ? newValue.format('YYYY-MM-DD') : ''
                              )
                            }}
                            slotProps={{
                              textField: {
                                fullWidth: true,
                              },
                            }}
                          />
                        </Box>
                      ) : (
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
                          <Button
                            component="label"
                            variant="outlined"
                            startIcon={<AttachFileIcon />}
                            sx={{ alignSelf: 'flex-start', textTransform: 'none' }}
                          >
                            Upload Documents
                            <input hidden type="file" multiple accept={DOCUMENT_UPLOAD_ACCEPT} onChange={handleDeficiencyResponseFileSelect} />
                          </Button>
                          {deficiencyResponseFiles.map((file, index) => (
                            <Box key={`${file.name}-${file.size}-${file.lastModified}`} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <AttachFileIcon fontSize="small" sx={{ color: 'primary.main', flexShrink: 0 }} />
                              <Typography variant="body2" sx={{ color: 'text.primary', flex: 1, overflowWrap: 'anywhere' }}>
                                {file.name}
                              </Typography>
                              <Tooltip title="Remove">
                                <IconButton size="small" onClick={() => handleRemoveDeficiencyResponseFile(index)}>
                                  <CloseIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            </Box>
                          ))}
                        </Box>
                      )}
                      <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <Button
                          onClick={handleSubmitDeficiencyResponse}
                          variant="contained"
                          disabled={deficiencyResponseSubmitting}
                          sx={{ textTransform: 'none', fontWeight: 700 }}
                        >
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
          Uploaded Documents ({uploadedUserDocCount})
        </DialogTitle>
        <DialogContent dividers sx={{ px: 3, pt: 2.5, pb: 3 }}>
          {visibleUploadedUserDocs.length > 0 ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
              {visibleUploadedUserDocs.map((doc, index) => (
                <Box
                  key={doc.id || `${doc.doc_uploaded_by_user}-${index}`}
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
                      {getFileName(doc.doc_uploaded_by_user)}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {formatRacmUserDocumentSubtitle(doc, formatDateTime)}
                    </Typography>
                  </Box>
                  <Tooltip title="Download">
                    <span>
                      <IconButton
                        size="small"
                        onClick={() => handleDownloadUserDocument(doc.doc_uploaded_by_user)}
                        aria-label={`Download ${getFileName(doc.doc_uploaded_by_user)}`}
                      >
                        <DownloadIcon fontSize="small" />
                      </IconButton>
                    </span>
                  </Tooltip>
                  {isRejected && (
                    <Button
                      size="small"
                      color="error"
                      onClick={() => handleRemoveExistingUploadedDoc(doc.doc_uploaded_by_user)}
                      sx={{ textTransform: 'none', minWidth: 'auto' }}
                    >
                      Remove
                    </Button>
                  )}
                </Box>
              ))}
            </Box>
          ) : (
            <Typography variant="body2" color="text.secondary">
              No uploaded documents available.
            </Typography>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={handleCloseUserDocsDialog}>
            Close
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={changeRequestDialogOpen}
        onClose={handleClosePendingRequestDialog}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 700 }}>
          Pending Request
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
          {activeChangeRequest?.items?.length > 0 ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {activeChangeRequest.items.map((item) => (
                <Box
                  key={item.id}
                  sx={{
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: 2,
                    p: 2,
                  }}
                >
                  <Typography sx={{ fontWeight: 700, color: 'text.primary', mb: 0.75 }}>
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
                </Box>
              ))}
            </Box>
          ) : (
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              No pending change items found.
            </Typography>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={handleClosePendingRequestDialog}>Close</Button>
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
                        aria-label={`Download ${getFileName(doc.sample_doc)}`}
                      >
                        <DownloadIcon fontSize="small" />
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
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={handleCloseSampleDocsDialog}>
            Close
          </Button>
        </DialogActions>
      </Dialog>

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

export default UserFormDetail
