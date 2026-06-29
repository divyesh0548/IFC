import React, { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTheme } from '@mui/material/styles'
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import IconButton from '@mui/material/IconButton';
import Fab from '@mui/material/Fab';
import Tooltip from '@mui/material/Tooltip';
import DownloadIcon from '@mui/icons-material/Download';
import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import HistoryRoundedIcon from '@mui/icons-material/HistoryRounded';
import ListAltRoundedIcon from '@mui/icons-material/ListAltRounded';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import { toast } from 'react-hot-toast';
import * as XLSX from 'xlsx';
import {
  FORM_DETAIL_CONTENT_STACK_SX,
  FORM_DETAIL_ROOT_SX,
} from '../../uiConstants';
import { RACM_FIELD_LABELS, orderControlDetailKeys, APPROVAL_SECTION_FIELD_KEYS, getPopulatedApprovalSectionFields } from '../../racmFormDetailFields';
import { useSyncGlobalLoading } from '../../contexts/GlobalLoadingContext';
import { RacmAuditLogsDialog } from '../../components/racm/RacmAuditLogsDialog';
import { RacmTemplateSectionFields } from '../../components/racm/RacmTemplateSectionFields';
import { apiUrl } from '../../config/api';
import { formatIndianDateTime } from '../../lib/dateTime';
import { formatRacmUserDocumentSubtitle, normalizeSampleDocuments } from '../../lib/racmUserDocuments';

function ApproverFormDetail() {
  const theme = useTheme()
  const navigate = useNavigate()
  const { form_id } = useParams()
  const [formData, setFormData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [approving, setApproving] = useState(false)
  const [reasonByApprover, setReasonByApprover] = useState('')
  const [approvalDecision, setApprovalDecision] = useState('')
  
  // Editable fields for approver (only editable when status is pending)
  const [editableFields, setEditableFields] = useState({
    control_design_procs: '',
    control_design_conclusion: '',
    design_deficiency_desc: ''
  })
  const [changeDecisionOpen, setChangeDecisionOpen] = useState(false)
  const [changeDecisionReason, setChangeDecisionReason] = useState('')
  const [changeDecisionSubmitting, setChangeDecisionSubmitting] = useState(false)
  const [auditLogOpen, setAuditLogOpen] = useState(false)
  const [auditLogLoading, setAuditLogLoading] = useState(false)
  const [auditLogError, setAuditLogError] = useState(null)
  const [auditLogRows, setAuditLogRows] = useState([])
  const [rejectionHistoryRows, setRejectionHistoryRows] = useState([])
  const [rejectionHistoryOpen, setRejectionHistoryOpen] = useState(false)
  const [sampleDocsDialogOpen, setSampleDocsDialogOpen] = useState(false)
  const [userDocsDialogOpen, setUserDocsDialogOpen] = useState(false)
  const [showScrollTop, setShowScrollTop] = useState(false)
  const [deficiencyReviewDecision, setDeficiencyReviewDecision] = useState('')
  const [deficiencyReviewComment, setDeficiencyReviewComment] = useState('')
  const [deficiencyReviewing, setDeficiencyReviewing] = useState(false)
  const [expandedDeficiencyVersions, setExpandedDeficiencyVersions] = useState({})

  useSyncGlobalLoading(
    loading ||
    approving ||
    changeDecisionSubmitting ||
    auditLogLoading ||
    deficiencyReviewing
  )

  const toastId = useRef(null)

  useEffect(() => {
    const onScroll = () => {
      setShowScrollTop(window.scrollY > 300)
    }

    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    let cancelled = false

    const checkAuthAndFetch = async () => {
      setLoading(true)
      setError(null)

      try {
        const authResponse = await fetch(apiUrl('/api/auth/verify'), {
          method: 'GET',
          credentials: 'include',
        })
        const authData = await authResponse.json()

        if (cancelled) return

        if (!authResponse.ok || !authData.success || authData.user?.role !== 'approver') {
          navigate('/login', { replace: true })
          return
        }

        const accessResponse = await fetch(
          apiUrl(`/api/approver/control-forms/${form_id}/access`),
          {
            method: 'GET',
            credentials: 'include',
          }
        )
        const accessData = await accessResponse.json()

        if (cancelled) return

        if (!accessResponse.ok || !accessData.success || accessData.data?.allowed !== true) {
          toast.error(accessData.message || 'You are not authorized to access this RACM')
          navigate('/approver/dashboard', { replace: true })
          return
        }

        await fetchFormData()
      } catch (authError) {
        console.error('Approver auth check error:', authError)
        if (!cancelled) {
          navigate('/login', { replace: true })
        }
      }
    }

    checkAuthAndFetch()

    return () => {
      cancelled = true
    }
  }, [form_id, navigate])

  useEffect(() => {
    let cancelled = false
    setRejectionHistoryRows([])

    if (!form_id) return undefined

    ;(async () => {
      try {
        const response = await fetch(
          apiUrl(`/api/approver/control-form-history/${encodeURIComponent(form_id)}`),
          { method: 'GET', credentials: 'include' }
        )
        const data = await response.json()
        if (cancelled) return
        if (response.ok && data.success && Array.isArray(data.data)) {
          setRejectionHistoryRows(data.data)
        } else {
          setRejectionHistoryRows([])
        }
      } catch (e) {
        console.error('Control form history fetch error:', e)
        if (!cancelled) setRejectionHistoryRows([])
      }
    })()

    return () => {
      cancelled = true
    }
  }, [form_id])

  const fetchFormData = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(apiUrl(`/api/approver/control-forms/${form_id}`), {
        method: 'GET',
        credentials: 'include',
      })

      const data = await response.json()

      if (response.ok && data.success) {
        setFormData(data.data)
        // Initialize editable fields
        setEditableFields({
          control_design_procs: data.data.control_design_procs || '',
          control_design_conclusion: data.data.control_design_conclusion || '',
          design_deficiency_desc: data.data.design_deficiency_desc || ''
        })
        setDeficiencyReviewDecision('')
        setDeficiencyReviewComment('')
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

  const handleFieldChange = (field, value) => {
    setEditableFields(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const handleApprovalDecisionChange = (value) => {
    setApprovalDecision(value)
    setReasonByApprover('')

    if (value === 'Rejected') {
      setEditableFields((prev) => ({
        ...prev,
        control_design_conclusion: '',
        design_deficiency_desc: '',
      }))
    }
  }

  const getApprovalFieldValidationMessage = (nextStatus) => {
    const designProcedures = String(editableFields.control_design_procs || '').trim()
    const designConclusion = String(editableFields.control_design_conclusion || '').trim()
    const deficiencyDescription = String(editableFields.design_deficiency_desc || '').trim()

    if (!nextStatus) {
      return 'Please select a decision.'
    }

    if (nextStatus === 'Approved') {
      if (!designProcedures || !designConclusion) {
        return 'Design and Implementation fields are required for approval of RACM.'
      }
    }

    if (designConclusion === 'Not Effective' && !deficiencyDescription) {
      return 'Description of Deficiency in Control Design is required when conclusion is Not Effective.'
    }

    return ''
  }

  const handleSubmitDecision = async () => {
    if (!formData) return

    const validationMessage = getApprovalFieldValidationMessage(approvalDecision)
    if (validationMessage) {
      toast.error(validationMessage)
      return
    }

    const isApproveAction = approvalDecision === 'Approved'
    const payload = {
      status: approvalDecision,
      reason_by_approver: reasonByApprover || '',
      control_design_procs: editableFields.control_design_procs,
      control_design_conclusion: isApproveAction ? editableFields.control_design_conclusion : '',
      design_deficiency_desc: isApproveAction ? editableFields.design_deficiency_desc : '',
    }

    setApproving(true)
    try {
      const response = await fetch(apiUrl(`/api/approver/approve-form/${form_id}`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(payload),
      })

      const data = await response.json()

      if (response.ok && data.success) {
        toastId.current = toast.success(isApproveAction ? 'Form approved successfully' : 'Form rejected successfully')
        setApprovalDecision('')
        setReasonByApprover('')
        setEditableFields({
          control_design_procs: '',
          control_design_conclusion: '',
          design_deficiency_desc: ''
        })
        setFormData(data.data)
        setTimeout(() => {
          fetchFormData()
        }, 2000)
      } else {
        toast.error(data.message || `Failed to ${isApproveAction ? 'approve' : 'reject'} form`, { id: toastId.current })
      }
    } catch (error) {
      console.error('Error submitting approval decision:', error)
      toast.error(`Error ${isApproveAction ? 'approving' : 'rejecting'} form`, { id: toastId.current })
    } finally {
      setApproving(false)
    }
  }

  const handleSubmitDeficiencyReview = async () => {
    if (!formData?.deficiency_response) return

    const selectedDecision = String(deficiencyReviewDecision || '').trim()

    if (!selectedDecision) {
      toast.error('Please select Effective, Accepted under deviation, or Reject')
      return
    }

    if (selectedDecision === 'Reject' && !String(deficiencyReviewComment || '').trim()) {
      toast.error('Reason is required when rejecting deficiency response')
      return
    }

    setDeficiencyReviewing(true)
    try {
      const response = await fetch(apiUrl(`/api/approver/deficiency-response/${form_id}/review`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          review_decision: selectedDecision,
          review_comment: deficiencyReviewComment,
        }),
      })

      const data = await response.json()
      if (response.ok && data.success) {
        toast.success(
          selectedDecision === 'Reject'
            ? 'Deficiency response rejected successfully'
            : 'Deficiency response approved successfully'
        )
        setFormData(data.data)
        setDeficiencyReviewDecision('')
        setDeficiencyReviewComment('')
      } else {
        toast.error(data.message || 'Failed to review deficiency response')
      }
    } catch (error) {
      console.error('Error reviewing deficiency response:', error)
      toast.error('Error reviewing deficiency response')
    } finally {
      setDeficiencyReviewing(false)
    }
  }

  const handleChangeApprovalDecision = async (newStatus) => {
    if (newStatus === 'Rejected') {
      const trimmed = changeDecisionReason.trim()
      if (!trimmed) {
        toast.error('Please enter a reason for rejection')
        return
      }
    }

    setChangeDecisionSubmitting(true)
    try {
      const response = await fetch(
        apiUrl(`/api/approver/change-approval-decision/${form_id}`),
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            status: newStatus,
            reason_by_approver:
              newStatus === 'Rejected'
                ? changeDecisionReason.trim()
                : changeDecisionReason.trim() || '',
          }),
        }
      )

      const data = await response.json()

      if (response.ok && data.success) {
        toast.success(
          newStatus === 'Approved'
            ? 'RACM approved successfully'
            : 'RACM rejected successfully'
        )
        setChangeDecisionOpen(false)
        setChangeDecisionReason('')
        setFormData(data.data)
        fetchFormData()
      } else {
        toast.error(data.message || 'Failed to change approval decision')
      }
    } catch (err) {
      console.error('Change approval decision error:', err)
      toast.error('Error changing approval decision')
    } finally {
      setChangeDecisionSubmitting(false)
    }
  }

  const hasRejectionHistory = rejectionHistoryRows.length > 0

  const handleOpenRejectionHistory = () => {
    setRejectionHistoryOpen(true)
  }

  const handleOpenSampleDocsDialog = () => {
    setSampleDocsDialogOpen(true)
  }

  const handleCloseSampleDocsDialog = () => {
    setSampleDocsDialogOpen(false)
  }

  const handleOpenUserDocsDialog = () => {
    setUserDocsDialogOpen(true)
  }

  const handleCloseUserDocsDialog = () => {
    setUserDocsDialogOpen(false)
  }

  const handleOpenAuditLogs = async () => {
    setAuditLogOpen(true)
    setAuditLogLoading(true)
    setAuditLogError(null)
    setAuditLogRows([])
    try {
      const response = await fetch(
        apiUrl(`/api/approver/racm-audit-logs/${encodeURIComponent(form_id)}`),
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

  const formatDateTime = (dateString) => {
    return formatIndianDateTime(dateString, 'N/A')
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
    const parts = filePath.split(/[/\\]/)
    return parts[parts.length - 1]
  }

  const handleDownloadFile = async (filePath) => {
    if (!filePath) return
    
    try {
      const fileName = getFileName(filePath)
      const response = await fetch(apiUrl(`/api/control-forms/download-document?path=${encodeURIComponent(filePath)}`), {
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
        toast.success('File downloaded successfully', { id: toastId.current })
      } else {
        // Error response: try to parse JSON error message
        let errorMessage = 'Failed to download file'
        try {
          const errorData = await response.json()
          errorMessage = errorData.message || errorData.error || errorMessage
          
          // Include debug info if available
          if (errorData.debug) {
            console.error('Download error debug info:', errorData.debug)
          }
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
        toast.error(errorMessage, { id: toastId.current })
      }
    } catch (error) {
      console.error('Error downloading file:', error)
      toast.error(`Error downloading file: ${error.message}`, { id: toastId.current })
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
    control_design_conclusion: 'Conclusion on Design of Control (Effective/ Not effective)',
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
    'doc_uploaded_by_user',
    'remarks_by_user'
  ]

  // Fields to exclude from display
  const excludedFields = [
    'id',
    'form_id',
    'company_identifier',
    'company_name',
    'control_owner_name',
    'created_at',
    'active',
    'approved_rejected',
    'reason_by_approver',
  ]
  
  // Grouped fields that should be displayed together and are editable by approver
  const groupedApproverFields = APPROVAL_SECTION_FIELD_KEYS

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

  const isPending = !formData?.status || formData.status === '' || formData.status === 'sent for approval'
  const isApproved = formData?.status === 'Approved'
  const isRejected = formData?.status === 'Rejected'
  const sampleDocs = normalizeSampleDocuments(formData?.sample_docs, formData?.sample_doc)
  const uploadedDocs = Array.isArray(formData?.doc_uploaded_by_user_docs)
    ? formData.doc_uploaded_by_user_docs.filter((doc) => String(doc.doc_uploaded_by_user || '').trim() !== '')
    : []
  const selectedDesignConclusion = isPending
    ? String(editableFields.control_design_conclusion || '').trim()
    : String(formData?.control_design_conclusion || '').trim()
  const showDesignDeficiencyField = selectedDesignConclusion === 'Not Effective' || (!isPending && String(formData?.design_deficiency_desc || '').trim() !== '')
  const showApproveFlowFields = isPending && approvalDecision === 'Approved'
  const showRejectFlowFields = isPending && approvalDecision === 'Rejected'
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
  const canReviewDeficiencyResponse = Boolean(
    deficiencyResponse
    && String(deficiencyResponse.status || '').trim() === 'submitted'
    && String(formData?.deficiency_response_status || '').trim().toLowerCase() === 'submitted_for_review'
  )
  const showActiveDeficiencyResponseSection = Boolean(
    deficiencyResponse && String(deficiencyResponse.status || '').trim().toLowerCase() === 'submitted'
  )

  const formatDeficiencyStatus = (value) => {
    const normalized = String(value || '').trim()
    if (!normalized) return '-'
    return normalized.charAt(0).toUpperCase() + normalized.slice(1)
  }

  const toggleDeficiencySubmissionExpansion = (submissionId) => {
    setExpandedDeficiencyVersions((current) => ({
      ...current,
      [submissionId]: !current[submissionId],
    }))
  }

  const approvalStatusLabelText = (() => {
    const status = formData?.status || ''
    if (!status || status === '') return '-'
    return status.charAt(0).toUpperCase() + status.slice(1)
  })()

  const approvalStatusValueColor = isApproved ? '#10b981' : isRejected ? '#ef4444' : 'text.primary'

  return (
    <Box sx={FORM_DETAIL_ROOT_SX}>
      <Box sx={FORM_DETAIL_CONTENT_STACK_SX}>
          {/* Top summary card (matches coordinator design) */}
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
                    display: 'flex',
                    flexDirection: { xs: 'column', sm: 'row' },
                    alignItems: { xs: 'stretch', sm: 'center' },
                    justifyContent: 'space-between',
                    gap: 1.5,
                    mb: 2,
                    pb: 2,
                    borderBottom: '1px solid',
                    borderColor: 'divider',
                  }}
                >
                  <Box
                    sx={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      alignItems: 'center',
                      gap: 1.5,
                      alignSelf: { xs: 'flex-start', sm: 'center' },
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
                    {hasRejectionHistory && (
                      <Button
                        variant="contained"
                        color="secondary"
                        size="medium"
                        startIcon={<ListAltRoundedIcon sx={{ fontSize: '1.2rem !important' }} />}
                        onClick={handleOpenRejectionHistory}
                        disableElevation
                        sx={{
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
                        RACM History
                      </Button>
                    )}
                  </Box>
                  <Typography
                    variant="caption"
                    sx={{
                      color: 'text.secondary',
                      fontSize: '0.75rem',
                      lineHeight: 1.4,
                      mt : 2,
                      textAlign: { xs: 'left', sm: 'right' },
                      alignSelf: { xs: 'flex-start', sm: 'center' },
                    }}
                  >
                    Created at {formatDateTime(formData?.created_at)}
                  </Typography>
                </Box>
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
                        color: approvalStatusValueColor,
                        fontWeight: 500,
                        fontSize: '0.9375rem',
                        lineHeight: 1.5,
                        flex: 1,
                        minWidth: 0,
                      }}
                    >
                      {approvalStatusLabelText}
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
                      {(formData?.financial_year && String(formData.financial_year).trim()) || '-'}
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
                  </Box>

                  {/* Unit Name */}
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
                      Unit Name
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
                      {(formData?.unit_name || formData?.unit_id || '').toString().trim() || '-'}
                    </Typography>
                  </Box>

                  {/* Process Owner */}
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
                      Process Owner
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
                      {formData?.control_owner_name || formData?.control_owner || '-'}
                    </Typography>
                  </Box>

                  {/* Due Date */}
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
                  </Box>

                  {/* Sent for Approval / Rejected On */}
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
                      {isRejected ? 'Rejected on' : 'Sent for Approval'}
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
                      {formatDateOnly(isRejected ? formData?.approval_status_change_timestamp : formData?.sent_for_approval_timestamp)}
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
                    .filter((key) => formData.hasOwnProperty(key) && !excludedFields.includes(key))
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
                      )
                    })}
                  <RacmTemplateSectionFields
                    blendIntoParent
                    sectionKey="process_and_risk"
                    fieldDefinitions={formData.field_definitions}
                    values={formData.dynamic_values || {}}
                  />
                </Box>
              </CardContent>
            </Card>

            <RacmTemplateSectionFields
              sectionKey="assertions"
              title="Assertions"
              fieldDefinitions={formData.field_definitions}
              values={formData.dynamic_values || {}}
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
                    fieldOrder.filter(key => {
                      if (groupedApproverFields.includes(key)) return false
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
                      // approval-related fields handled in Approval section
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
                      const isFileField = key === 'doc_uploaded_by_user'
                      
                      // Check if this is an editable field for approver (only when pending)
                      const editableFieldKeys = ['control_design_procs', 'control_design_conclusion', 'design_deficiency_desc']
                      const isEditableField = editableFieldKeys.includes(key)
                      const isEditable = isPending && isEditableField

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
                            gridColumn: isEditable
                              ? { xs: '1', md: '1 / -1' }
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
                            // Editable field for approver (only when pending)
                            key === 'control_design_conclusion' ? (
                              // Dropdown for control_design_conclusion
                              <FormControl fullWidth>
                                <InputLabel id={`${key}-label`}>{label}</InputLabel>
                                <Select
                                  labelId={`${key}-label`}
                                  value={editableFields[key] || ''}
                                  label={label}
                                  onChange={(e) => handleFieldChange(key, e.target.value)}
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
                                >
                                  <MenuItem value="Effective">Effective</MenuItem>
                                  <MenuItem value="Not Effective">Not Effective</MenuItem>
                                </Select>
                              </FormControl>
                            ) : (
                              // TextField for other editable fields
                              <TextField
                                label={label}
                                variant="outlined"
                                value={editableFields[key]}
                                onChange={(e) => handleFieldChange(key, e.target.value)}
                                fullWidth
                                multiline={['control_design_procs', 'design_deficiency_desc'].includes(key)}
                                rows={['control_design_procs', 'design_deficiency_desc'].includes(key) ? 4 : 1}
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
                          ) : isFileField && !isEmpty ? (
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Typography
                                variant="body2"
                                component="dd"
                                sx={{
                                  color: 'text.secondary',
                                  wordBreak: 'break-word',
                                  lineHeight: 1.6,
                                  fontSize: theme.typography.customSizes.medium,
                                  flex: 1,
                                }}
                              >
                                {getFileName(String(value))}
                              </Typography>
                              <IconButton
                                onClick={() => handleDownloadFile(value)}
                                size="small"
                                sx={{
                                  color: 'primary.main',
                                  '&:hover': {
                                    backgroundColor: 'action.hover',
                                  },
                                }}
                              >
                                <DownloadIcon />
                              </IconButton>
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
                      )
                    })}
                  <RacmTemplateSectionFields
                    blendIntoParent
                    sectionKey="control_details"
                    fieldDefinitions={formData.field_definitions}
                    values={formData.dynamic_values || {}}
                  />
                </Box>
              </CardContent>
            </Card>

            <RacmTemplateSectionFields
              sectionKey="others"
              title="Others"
              fieldDefinitions={formData.field_definitions}
              values={formData.dynamic_values || {}}
            />

            {/* Documents */}
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
                  Documents and Remarks
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
                  {/* Sample Documents */}
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
                      Sample Documents
                    </Typography>
                    <Box
                      component={sampleDocs.length > 0 ? 'button' : 'div'}
                      type={sampleDocs.length > 0 ? 'button' : undefined}
                      onClick={sampleDocs.length > 0 ? handleOpenSampleDocsDialog : undefined}
                      sx={{
                        p: 1.5,
                        borderRadius: 2,
                        border: '1px solid',
                        borderColor: 'divider',
                        width: '100%',
                        textAlign: 'left',
                        backgroundColor: 'transparent',
                        cursor: sampleDocs.length > 0 ? 'pointer' : 'default',
                        font: 'inherit',
                        transition: 'all 0.2s ease-in-out',
                        '&:hover': sampleDocs.length > 0
                          ? {
                              borderColor: 'primary.main',
                              backgroundColor: 'action.hover',
                            }
                          : undefined,
                        '&:focus-visible': {
                          outline: `2px solid ${theme.palette.primary.main}`,
                          outlineOffset: 2,
                        },
                      }}
                    >
                      <Typography
                        variant="body2"
                        sx={{
                          color: sampleDocs.length > 0 ? 'text.primary' : 'text.disabled',
                          fontWeight: 600,
                          lineHeight: 1.5,
                          fontSize: theme.typography.customSizes.medium,
                        }}
                      >
                        {sampleDocs.length} uploaded
                      </Typography>
                      <Typography
                        variant="caption"
                        sx={{
                          color: 'text.secondary',
                          fontSize: theme.typography.customSizes.small,
                        }}
                      >
                        {sampleDocs.length > 0 ? 'Click to view documents' : 'No sample documents'}
                      </Typography>
                    </Box>
                  </Box>

                  {/* Doc Uploaded By User */}
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
                      {fieldLabels.doc_uploaded_by_user}
                    </Typography>
                    <Box
                      component={uploadedDocs.length > 0 ? 'button' : 'div'}
                      type={uploadedDocs.length > 0 ? 'button' : undefined}
                      onClick={uploadedDocs.length > 0 ? handleOpenUserDocsDialog : undefined}
                      sx={{
                        p: 1.5,
                        borderRadius: 2,
                        border: '1px solid',
                        borderColor: 'divider',
                        width: '100%',
                        textAlign: 'left',
                        backgroundColor: 'transparent',
                        cursor: uploadedDocs.length > 0 ? 'pointer' : 'default',
                        font: 'inherit',
                        transition: 'all 0.2s ease-in-out',
                        '&:hover': uploadedDocs.length > 0
                          ? {
                              borderColor: 'primary.main',
                              backgroundColor: 'action.hover',
                            }
                          : undefined,
                        '&:focus-visible': {
                          outline: `2px solid ${theme.palette.primary.main}`,
                          outlineOffset: 2,
                        },
                      }}
                    >
                      <Typography
                        variant="body2"
                        sx={{
                          color: uploadedDocs.length > 0 ? 'text.primary' : 'text.disabled',
                          fontWeight: 600,
                          lineHeight: 1.5,
                          fontSize: theme.typography.customSizes.medium,
                        }}
                      >
                        {uploadedDocs.length} uploaded
                      </Typography>
                      <Typography
                        variant="caption"
                        sx={{
                          color: 'text.secondary',
                          fontSize: theme.typography.customSizes.small,
                        }}
                      >
                        {uploadedDocs.length > 0 ? 'Click to view documents' : 'No uploaded documents'}
                      </Typography>
                    </Box>
                  </Box>

                  {String(formData?.remarks_by_user || '').trim() !== '' ? (
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
                        Remarks by User
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
                        {String(formData.remarks_by_user)}
                      </Typography>
                    </Box>
                  ) : null}

                </Box>
              </CardContent>
            </Card>

            {/* Approval */}
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
                  Approval Details
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
                  {isPending && !isApproved && !isRejected && (
                    <>
                      <FormControl fullWidth sx={{ gridColumn: { xs: '1', md: '1 / -1' } }}>
                        <InputLabel id="approval-decision-label">Decision</InputLabel>
                        <Select
                          labelId="approval-decision-label"
                          value={approvalDecision}
                          label="Decision"
                          onChange={(e) => handleApprovalDecisionChange(e.target.value)}
                        >
                          <MenuItem value="Approved">Approve</MenuItem>
                          <MenuItem value="Rejected">Reject</MenuItem>
                        </Select>
                      </FormControl>

                      {showApproveFlowFields ? (
                        <>
                          {groupedApproverFields
                            .filter((key) => key !== 'design_deficiency_desc' || showDesignDeficiencyField)
                            .map((key) => {
                              const label = fieldLabels[key] || key.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())
                              const value = formData[key]
                              const isEmpty = value === null || value === undefined || value === '' || String(value).trim() === ''
                              const isTextArea = ['control_design_procs', 'design_deficiency_desc'].includes(key)
                              const isRequired = key === 'control_design_procs'
                                || key === 'control_design_conclusion'
                                || (key === 'design_deficiency_desc' && selectedDesignConclusion === 'Not Effective')

                              return (
                                <React.Fragment key={key}>
                                  {key === 'control_design_conclusion' ? (
                                    <FormControl fullWidth required={isRequired} sx={{ gridColumn: { xs: '1', md: '1 / -1' } }}>
                                      <InputLabel id={`${key}-label`}>{label}</InputLabel>
                                      <Select
                                        labelId={`${key}-label`}
                                        value={editableFields[key] || ''}
                                        label={label}
                                        onChange={(e) => handleFieldChange(key, e.target.value)}
                                      >
                                        <MenuItem value="Effective">Effective</MenuItem>
                                        <MenuItem value="Not Effective">Not Effective</MenuItem>
                                        <MenuItem value="Accepted under deviation">Accepted under deviation</MenuItem>
                                      </Select>
                                    </FormControl>
                                  ) : (
                                    <TextField
                                      label={label}
                                      variant="outlined"
                                      value={editableFields[key] || ''}
                                      onChange={(e) => handleFieldChange(key, e.target.value)}
                                      fullWidth
                                      required={isRequired}
                                      multiline={isTextArea}
                                      rows={isTextArea ? 4 : 1}
                                      sx={{ gridColumn: { xs: '1', md: '1 / -1' } }}
                                    />
                                  )}
                                  {!isPending ? (
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
                                  ) : null}
                                </React.Fragment>
                              )
                            })}
                        </>
                      ) : null}

                      {showRejectFlowFields ? (
                        <TextField
                          label={fieldLabels.control_design_procs}
                          variant="outlined"
                          value={editableFields.control_design_procs || ''}
                          onChange={(e) => handleFieldChange('control_design_procs', e.target.value)}
                          fullWidth
                          multiline
                          rows={4}
                          sx={{ gridColumn: { xs: '1', md: '1 / -1' } }}
                        />
                      ) : null}

                      {(showApproveFlowFields || showRejectFlowFields) ? (
                        <TextField
                          label="Reason by Approver"
                          placeholder={
                            approvalDecision === 'Rejected'
                              ? 'Enter reason for rejection'
                              : 'Enter reason for approval or rejection (optional)'
                          }
                          fullWidth
                          multiline
                          rows={4}
                          value={reasonByApprover}
                          onChange={(e) => setReasonByApprover(e.target.value)}
                          variant="outlined"
                          required={approvalDecision === 'Rejected'}
                          sx={{
                            gridColumn: { xs: '1', md: '1 / -1' },
                            '& .MuiOutlinedInput-root': {
                              backgroundColor: 'transparent',
                              borderRadius: 1.5,
                              '&:hover': {
                                backgroundColor: 'transparent',
                              },
                              '&.Mui-focused': {
                                backgroundColor: 'transparent',
                              },
                            },
                          }}
                        />
                      ) : null}

                      {(showApproveFlowFields || showRejectFlowFields) ? (
                      <Box
                        sx={{
                          display: 'flex',
                          gap: 2,
                          justifyContent: 'flex-end',
                          mt: 1,
                          gridColumn: { xs: '1', md: '1 / -1' },
                        }}
                      >
                        <Button
                          onClick={handleSubmitDecision}
                          disabled={approving}
                          variant="contained"
                          color={approvalDecision === 'Rejected' ? 'error' : 'success'}
                          sx={{
                            minWidth: '120px',
                            py: 1.2,
                            fontWeight: 700,
                            fontSize: '0.95rem',
                            textTransform: 'none',
                            color: theme.palette.getContrastText(
                              approvalDecision === 'Rejected'
                                ? theme.palette.error.main
                                : theme.palette.success.main
                            ),
                            '&:hover': {
                              boxShadow: 'none',
                            },
                            '&:disabled': {
                              backgroundColor: 'action.disabledBackground',
                              color: 'text.disabled',
                            },
                          }}
                        >
                          {approving
                            ? 'Processing...'
                            : approvalDecision === 'Rejected'
                              ? 'Reject'
                              : 'Approve'}
                        </Button>
                      </Box>
                      ) : null}
                    </>
                  )}

                  {!isPending ? (
                    <Box
                      sx={{
                        display: 'grid',
                        gridTemplateColumns: {
                          xs: '1fr',
                          md: 'repeat(2, 1fr)',
                        },
                        gap: 3,
                        gridColumn: { xs: '1', md: '1 / -1' },
                      }}
                    >
                        {getPopulatedApprovalSectionFields(formData).map((key) => {
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
                                  gridColumn: { xs: '1', md: '1 / -1' },
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
                            gridColumn: { xs: '1', md: '1 / -1' },
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
                                          onClick={() => handleDownloadFile(attachment.file_url)}
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

            {showActiveDeficiencyResponseSection ? (
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

                  {deficiencyResponse ? (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
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
                              <Box key={attachment.id} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
                                <Typography variant="body2" sx={{ color: 'text.primary', overflowWrap: 'anywhere' }}>
                                  {attachment.original_name || getFileName(attachment.file_url)}
                                </Typography>
                                <Button
                                  size="small"
                                  startIcon={<DownloadRoundedIcon />}
                                  onClick={() => handleDownloadFile(attachment.file_url)}
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
                            Review Comment
                          </Typography>
                          <Typography variant="body2" sx={{ color: 'text.primary', whiteSpace: 'pre-wrap' }}>
                            {String(deficiencyResponse.review_comment)}
                          </Typography>
                        </Box>
                      ) : null}

                      {canReviewDeficiencyResponse ? (
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, pt: 1 }}>
                          <TextField
                            select
                            label="Decision"
                            value={deficiencyReviewDecision}
                            onChange={(e) => setDeficiencyReviewDecision(e.target.value)}
                            fullWidth
                          >
                            <MenuItem value="">Select</MenuItem>
                            <MenuItem value="Effective">Approved - Effective</MenuItem>
                            <MenuItem value="Accepted under deviation">Approved - Accepted Under Deviation</MenuItem>
                            <MenuItem value="Reject">Rejected</MenuItem>
                          </TextField>

                          {deficiencyReviewDecision ? (
                            <TextField
                              label="Comment"
                              value={deficiencyReviewComment}
                              onChange={(e) => setDeficiencyReviewComment(e.target.value)}
                              fullWidth
                              multiline
                              rows={4}
                              required={deficiencyReviewDecision === 'Reject'}
                            />
                          ) : null}

                          {deficiencyReviewDecision ? (
                            <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                              <Button
                                onClick={handleSubmitDeficiencyReview}
                                variant="contained"
                                disabled={deficiencyReviewing}
                                sx={{ textTransform: 'none', fontWeight: 700 }}
                              >
                                {deficiencyReviewing
                                  ? 'Submitting...'
                                  : 'Submit'}
                              </Button>
                            </Box>
                          ) : null}
                        </Box>
                      ) : null}
                    </Box>
                  ) : (
                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                      No deficiency response submitted yet.
                    </Typography>
                  )}
                </CardContent>
              </Card>
            ) : null}
          </Box>
        </Box>

        <RacmAuditLogsDialog
          open={auditLogOpen}
          onClose={() => setAuditLogOpen(false)}
          loading={auditLogLoading}
          error={auditLogError}
          rows={auditLogRows}
        />

        <Dialog
          open={sampleDocsDialogOpen}
          onClose={handleCloseSampleDocsDialog}
          aria-labelledby="approver-sample-documents-dialog-title"
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
            id="approver-sample-documents-dialog-title"
            sx={{
              pb: 2.5,
              pt: 3,
              px: 3,
              fontWeight: 700,
              fontSize: '1.25rem',
              color: theme.palette.text.primary,
            }}
          >
            Sample Documents ({sampleDocs.length})
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
                    <DownloadIcon color="action" />
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
                          onClick={() => handleDownloadFile(doc.sample_doc)}
                          aria-label={`Download ${getFileName(doc.sample_doc)}`}
                        >
                          <DownloadRoundedIcon fontSize="small" />
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

        <Dialog
          open={userDocsDialogOpen}
          onClose={handleCloseUserDocsDialog}
          aria-labelledby="approver-user-documents-dialog-title"
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
            id="approver-user-documents-dialog-title"
            sx={{
              pb: 2.5,
              pt: 3,
              px: 3,
              fontWeight: 700,
              fontSize: '1.25rem',
              color: theme.palette.text.primary,
            }}
          >
            User Uploaded Documents ({uploadedDocs.length})
          </DialogTitle>
          <DialogContent dividers sx={{ px: 3, pt: 2.5, pb: 3 }}>
            {uploadedDocs.length > 0 ? (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
                {uploadedDocs.map((doc, index) => (
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
                    <DownloadIcon color="action" />
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
                          onClick={() => handleDownloadFile(doc.doc_uploaded_by_user)}
                          aria-label={`Download ${getFileName(doc.doc_uploaded_by_user)}`}
                        >
                          <DownloadRoundedIcon fontSize="small" />
                        </IconButton>
                      </span>
                    </Tooltip>
                  </Box>
                ))}
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

        <Dialog
          open={rejectionHistoryOpen}
          onClose={() => setRejectionHistoryOpen(false)}
          fullWidth
          maxWidth="md"
          aria-labelledby="rejection-history-dialog-title"
          PaperProps={{
            sx: {
              borderRadius: 2,
              maxHeight: '90vh',
            },
          }}
        >
          <DialogTitle
            id="rejection-history-dialog-title"
            sx={{
              pb: 1,
              pt: 2.5,
              px: 3,
              fontWeight: 600,
              fontSize: '1.1rem',
            }}
          >
            Rejection History
          </DialogTitle>
          <DialogContent sx={{ px: 3, mt: 2.5, pb: 2, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <TableContainer
              sx={{
                maxHeight: 'min(420px, 58vh)',
                overflow: 'auto',
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 1,
              }}
            >
              <Table size="small" stickyHeader sx={{ tableLayout: 'fixed', width: '100%'}}>
                <TableHead>
                  <TableRow>
                    <TableCell
                      sx={{
                        fontWeight: 600,
                        width: '34%',
                        borderBottom: '1px solid',
                        borderColor: 'divider',
                      }}
                    >
                      Rejected On
                    </TableCell>
                    <TableCell
                      sx={{
                        fontWeight: 600,
                        width: '66%',
                        borderBottom: '1px solid',
                        borderColor: 'divider',
                      }}
                    >
                      Reason by Approver
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rejectionHistoryRows.map((row) => {
                    const reason =
                      row.reason_by_approver != null && String(row.reason_by_approver).trim() !== ''
                        ? String(row.reason_by_approver)
                        : null
                    const rejectionTimestamp =
                      row.rejection_timestamp != null && String(row.rejection_timestamp).trim() !== ''
                        ? formatDateTime(row.rejection_timestamp)
                        : '—'
                    return (
                      <TableRow key={row.id} hover>
                        <TableCell
                          sx={{
                            verticalAlign: 'top',
                            borderBottom: '1px solid',
                            borderColor: 'divider',
                            fontSize: '0.8125rem',
                            lineHeight: 1.5,
                            color: 'text.primary',
                            py: 1.5,
                            whiteSpace: 'normal',
                            wordBreak: 'break-word',
                          }}
                        >
                          {rejectionTimestamp}
                        </TableCell>
                        <TableCell
                          sx={{
                            verticalAlign: 'top',
                            wordBreak: 'break-word',
                            maxWidth: 0,
                            borderBottom: '1px solid',
                            borderColor: 'divider',
                            fontSize: '0.8125rem',
                            lineHeight: 1.5,
                            color: 'text.primary',
                            py: 1.5,
                          }}
                        >
                          {reason ?? '—'}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </TableContainer>
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
              {rejectionHistoryRows.length} entr{rejectionHistoryRows.length === 1 ? 'y' : 'ies'} — oldest at top. Scroll the
              table for long lists.
            </Typography>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button
              onClick={() => setRejectionHistoryOpen(false)}
              variant="outlined"
              size="small"
              sx={{ textTransform: 'none' }}
            >
              Close
            </Button>
          </DialogActions>
        </Dialog>

        <Dialog
          open={changeDecisionOpen}
          onClose={() => {
            if (!changeDecisionSubmitting) setChangeDecisionOpen(false)
          }}
          fullWidth
          maxWidth="sm"
          aria-labelledby="change-approval-decision-title"
          aria-describedby="change-approval-decision-description"
          PaperProps={{
            sx: {
              borderRadius: 2,
              minWidth: { xs: '90%', sm: '460px' },
              boxShadow:
                theme.palette.mode === 'dark'
                  ? '0 8px 32px rgba(0, 0, 0, 0.4)'
                  : '0 8px 32px rgba(0, 0, 0, 0.12)',
            },
          }}
        >
          <DialogTitle
            id="change-approval-decision-title"
            sx={{
              pb: 2,
              pt: 3,
              px: 3,
              fontWeight: 600,
              fontSize: '1.25rem',
              color: theme.palette.text.primary,
            }}
          >
            Change approval decision
          </DialogTitle>
          <DialogContent sx={{ px: 3, pt: 1, pb: 3 }}>
            <DialogContentText
              id="change-approval-decision-description"
              sx={{
                color: theme.palette.text.secondary,
                fontSize: '0.9375rem',
                lineHeight: 1.5,
                m: 0,
                mb: 2,
              }}
            >
              User will be notified of this decision.
            </DialogContentText>
            <Box
              sx={{
                p: 2,
                mb: 2.5,
                borderRadius: 1.5,
                border: '1px solid',
                borderColor: 'divider',
                bgcolor:
                  theme.palette.mode === 'dark'
                    ? 'rgba(255, 255, 255, 0.03)'
                    : 'rgba(0, 0, 0, 0.02)',
              }}
            >
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.75, color: 'text.primary' }}>
                {isApproved ? 'Switch to rejected' : 'Switch to approved'}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6 }}>
                {isApproved
                  ? 'This RACM is currently approved. Rejecting requires a reason for the process owner.'
                  : 'This RACM is currently rejected. You may approve it; adding a comment for the process owner is optional.'}
              </Typography>
            </Box>
            <TextField
              label={
                isApproved
                  ? 'Reason (required to reject)'
                  : 'Reason (optional when approving)'
              }
              value={changeDecisionReason}
              onChange={(e) => setChangeDecisionReason(e.target.value)}
              fullWidth
              multiline
              minRows={3}
              required={isApproved}
              disabled={changeDecisionSubmitting}
              variant="outlined"
              placeholder={
                isApproved
                  ? 'Explain why you are rejecting this RACM'
                  : 'Optional comments for the process owner'
              }
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: 1.5,
                },
              }}
            />
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
              onClick={() => setChangeDecisionOpen(false)}
              disabled={changeDecisionSubmitting}
              variant="outlined"
              sx={{
                textTransform: 'none',
                px: 3,
                py: 1,
                minWidth: '100px',
                borderColor:
                  theme.palette.mode === 'dark'
                    ? 'rgba(255, 255, 255, 0.23)'
                    : 'rgba(0, 0, 0, 0.23)',
                color: theme.palette.text.primary,
                '&:hover': {
                  borderColor:
                    theme.palette.mode === 'dark'
                      ? 'rgba(255, 255, 255, 0.3)'
                      : 'rgba(0, 0, 0, 0.3)',
                  backgroundColor:
                    theme.palette.mode === 'dark'
                      ? 'rgba(255, 255, 255, 0.05)'
                      : 'rgba(0, 0, 0, 0.04)',
                },
              }}
            >
              Cancel
            </Button>
            {isApproved ? (
              <Button
                variant="contained"
                color="error"
                disabled={changeDecisionSubmitting}
                onClick={() => handleChangeApprovalDecision('Rejected')}
                sx={{
                  textTransform: 'none',
                  px: 3,
                  py: 1,
                  minWidth: '120px',
                  fontWeight: 600,
                }}
              >
                {changeDecisionSubmitting ? 'Saving…' : 'Reject RACM'}
              </Button>
            ) : (
              <Button
                variant="contained"
                color="secondary"
                disabled={changeDecisionSubmitting}
                onClick={() => handleChangeApprovalDecision('Approved')}
                sx={{
                  textTransform: 'none',
                  px: 3,
                  py: 1,
                  minWidth: '120px',
                  fontWeight: 600,
                }}
              >
                {changeDecisionSubmitting ? 'Saving…' : 'Approve RACM'}
              </Button>
            )}
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

export default ApproverFormDetail
