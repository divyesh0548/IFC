import React, { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTheme } from '@mui/material/styles'
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import ButtonBase from '@mui/material/ButtonBase';
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
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import LockOpenOutlinedIcon from '@mui/icons-material/LockOpenOutlined';
import HistoryRoundedIcon from '@mui/icons-material/HistoryRounded';
import ListAltRoundedIcon from '@mui/icons-material/ListAltRounded';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import { toast } from 'react-hot-toast';
import * as XLSX from 'xlsx';
import { FORM_DETAIL_MAX_WIDTH } from '../../uiConstants';
import { RACM_FIELD_LABELS, orderControlDetailKeys } from '../../racmFormDetailFields';
import { useSyncGlobalLoading } from '../../contexts/GlobalLoadingContext';
import { RacmAuditLogsDialog } from '../../components/racm/RacmAuditLogsDialog';

function ApproverFormDetail() {
  const theme = useTheme()
  const navigate = useNavigate()
  const { form_id } = useParams()
  const [formData, setFormData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [approving, setApproving] = useState(false)
  const [reasonByApprover, setReasonByApprover] = useState('')
  
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
  const [showScrollTop, setShowScrollTop] = useState(false)

  useSyncGlobalLoading(
    loading ||
    approving ||
    changeDecisionSubmitting ||
    auditLogLoading
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
    fetchFormData()
  }, [form_id])

  useEffect(() => {
    let cancelled = false
    setRejectionHistoryRows([])

    if (!form_id) return undefined

    ;(async () => {
      try {
        const response = await fetch(
          `http://localhost:3000/api/approver/control-form-history/${encodeURIComponent(form_id)}`,
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
      const response = await fetch(`http://localhost:3000/api/approver/control-forms/${form_id}`, {
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

  const handleApprove = async () => {
    if (!formData) return

    setApproving(true)
    try {
      const response = await fetch(`http://localhost:3000/api/approver/approve-form/${form_id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          status: 'Approved',
          reason_by_approver: reasonByApprover || '',
          control_design_procs: editableFields.control_design_procs,
          control_design_conclusion: editableFields.control_design_conclusion,
          design_deficiency_desc: editableFields.design_deficiency_desc
        }),
      })

      const data = await response.json()

      if (response.ok && data.success) {
        toastId.current = toast.success('Form approved successfully')
        setReasonByApprover('')
        // Clear editable fields
        setEditableFields({
          control_design_procs: '',
          control_design_conclusion: '',
          design_deficiency_desc: ''
        })
        // Update form data immediately to hide approval action card
        setFormData(data.data)
        setTimeout(() => {
          fetchFormData() // Refresh form data to ensure consistency
        }, 2000)
      } else {
        toast.error(data.message || 'Failed to approve form', { id: toastId.current })
      }
    } catch (error) {
      console.error('Error approving form:', error)
      toast.error('Error approving form', { id: toastId.current })
    } finally {
      setApproving(false)
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
        `http://localhost:3000/api/approver/change-approval-decision/${form_id}`,
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

  const handleReject = async () => {
    if (!formData) {
      return
    }

    setApproving(true)
    try {
      const response = await fetch(`http://localhost:3000/api/approver/approve-form/${form_id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          status: 'Rejected',
          reason_by_approver: reasonByApprover || '',
          control_design_procs: editableFields.control_design_procs,
          control_design_conclusion: editableFields.control_design_conclusion,
          design_deficiency_desc: editableFields.design_deficiency_desc
        }),
      })

      const data = await response.json()

      if (response.ok && data.success) {
        toast.success('Form rejected successfully', { id: toastId.current })
        setReasonByApprover('')
        // Clear editable fields
        setEditableFields({
          control_design_procs: '',
          control_design_conclusion: '',
          design_deficiency_desc: ''
        })
        // Update form data immediately to hide approval action card
        setFormData(data.data)
        setTimeout(() => {
          fetchFormData() // Refresh form data to ensure consistency
        }, 2000)
      } else {
        toast.error(data.message || 'Failed to reject form', { id: toastId.current })
      }
    } catch (error) {
      console.error('Error rejecting form:', error)
      toast.error('Error rejecting form', { id: toastId.current })
    } finally {
      setApproving(false)
    }
  }

  const hasRejectionHistory = rejectionHistoryRows.length > 0

  const handleOpenRejectionHistory = () => {
    setRejectionHistoryOpen(true)
  }

  const handleOpenAuditLogs = async () => {
    setAuditLogOpen(true)
    setAuditLogLoading(true)
    setAuditLogError(null)
    setAuditLogRows([])
    try {
      const response = await fetch(
        `http://localhost:3000/api/approver/racm-audit-logs/${encodeURIComponent(form_id)}`,
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
    if (!dateString) return 'N/A'
    const date = new Date(dateString)
    return date.toLocaleString('en-IN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      timeZone: 'Asia/Kolkata'
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
      const response = await fetch(`http://localhost:3000/api/control-forms/download-document?path=${encodeURIComponent(filePath)}`, {
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
        } catch (e) {
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
  const groupedApproverFields = ['control_design_procs', 'control_design_conclusion', 'design_deficiency_desc']

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

  const isActive = formData?.active && formData.active !== '' && formData.active !== '0'
  const isPending = !formData?.status || formData.status === '' || formData.status === 'sent for approval'
  const isApproved = formData?.status === 'Approved'
  const isRejected = formData?.status === 'Rejected'

  const APPROVAL_CHANGE_WINDOW_MS = 15 * 24 * 60 * 60 * 1000
  const showApprovalStatusLockUi = isApproved || isRejected
  let approvalChangeWithin15Days = false
  if (showApprovalStatusLockUi && formData?.approval_status_change_timestamp) {
    const changedAt = new Date(formData.approval_status_change_timestamp)
    if (!Number.isNaN(changedAt.getTime())) {
      approvalChangeWithin15Days = Date.now() - changedAt.getTime() <= APPROVAL_CHANGE_WINDOW_MS
    }
  }

  const approvalStatusLabelText = (() => {
    const status = formData?.status || ''
    if (status === 'sent for approval') return 'Pending'
    if (!status || status === '') return '-'
    return status.charAt(0).toUpperCase() + status.slice(1)
  })()

  const approvalStatusValueColor = isApproved ? '#10b981' : isRejected ? '#ef4444' : 'text.primary'

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
                  {/* RACM Status (active / inactive) */}
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
                      RACM Status
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
                      {isActive ? 'Active' : 'Inactive'}
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
                    {showApprovalStatusLockUi && approvalChangeWithin15Days ? (
                      <ButtonBase
                        focusRipple
                        onClick={() => {
                          setChangeDecisionReason('')
                          setChangeDecisionOpen(true)
                        }}
                        sx={{
                          display: 'block',
                          width: '100%',
                          borderRadius: 1.5,
                          textAlign: 'left',
                          transition: 'background-color 0.15s ease',
                          border: '1px solid transparent',
                          '&:hover': {
                            backgroundColor: 'action.hover',
                            borderColor: 'divider',
                          },
                        }}
                      >
                        <Box
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: 1,
                            minWidth: 0,
                            py: 0.5,
                            px: 0.75,
                          }}
                        >
                          <Typography
                            variant="body2"
                            sx={{
                              color: approvalStatusValueColor,
                              fontWeight: 500,
                              fontSize: '0.9375rem',
                              lineHeight: 1.5,
                              flex: 1,
                              minWidth: 0,
                              textAlign: 'left',
                            }}
                          >
                            {approvalStatusLabelText}
                          </Typography>
                          <Tooltip
                            title="Click to change decision within the 15-day window."
                            placement="top"
                            arrow
                          >
                            <Box
                              component="span"
                              role="img"
                              sx={{
                                display: 'inline-flex',
                                color: 'text.secondary',
                                flexShrink: 0,
                                pointerEvents: 'none',
                                '& .MuiSvgIcon-root': { fontSize: 22 },
                              }}
                              aria-label="Unlocked: click to change decision"
                            >
                              <LockOpenOutlinedIcon />
                            </Box>
                          </Tooltip>
                        </Box>
                      </ButtonBase>
                    ) : (
                      <Box
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 1,
                          minWidth: 0,
                        }}
                      >
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
                        {showApprovalStatusLockUi && (
                          <Tooltip
                            title="Approval status is locked — more than 15 days since the last decision."
                            placement="top"
                            arrow
                          >
                            <Box
                              component="span"
                              role="img"
                              sx={{
                                display: 'inline-flex',
                                color: 'text.secondary',
                                flexShrink: 0,
                                '& .MuiSvgIcon-root': { fontSize: 22 },
                              }}
                              aria-label="Locked: outside 15-day change window"
                            >
                              <LockOutlinedIcon />
                            </Box>
                          </Tooltip>
                        )}
                      </Box>
                    )}
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

                  {/* Company */}
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
                      Company
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
                      {(formData?.company_name && String(formData.company_name).trim()) || '-'}
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

                  {/* Reason by Approver (only when present) */}
                  {(() => {
                    const reason = formData?.reason_by_approver
                    const hasReason = typeof reason === 'string' && reason.trim() !== ''
                    if (!hasReason) return null

                    return (
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
                          Reason by Approver
                        </Typography>
                        <Typography
                          variant="body2"
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
                    .filter((key) => formData.hasOwnProperty(key) && !excludedFields.includes(key))
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
                    fieldOrder.filter(key => {
                      if (groupedApproverFields.includes(key)) return false
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
                </Box>
              </CardContent>
            </Card>

            {/* Design and Implementation section */}
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
                  Design and Implementation
                </Typography>
                <Box
                  sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 3,
                    mt: 2,
                  }}
                >
                  {groupedApproverFields.map((key) => {
                    const label = fieldLabels[key] || key.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())
                    const value = formData[key]
                    const isEmpty = value === null || value === undefined || value === '' || String(value).trim() === ''
                    const isTextArea = ['control_design_procs', 'design_deficiency_desc'].includes(key)
                    const isEditable = isPending
                    
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
                        {isEditable ? (
                          // Editable field for approver
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
                            // TextField for control_design_procs and design_deficiency_desc
                            <TextField
                              label={label}
                              variant="outlined"
                              value={editableFields[key] || ''}
                              onChange={(e) => handleFieldChange(key, e.target.value)}
                              fullWidth
                              multiline={isTextArea}
                              rows={isTextArea ? 4 : 1}
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
                          // Read-only display
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
                          </>
                        )}
                      </Box>
                    )
                  })}
                </Box>
              </CardContent>
            </Card>

            {/* Approval section – Doc Uploaded By User & Remarks By User */}
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
                    display: 'grid',
                    gridTemplateColumns: {
                      xs: '1fr',
                      md: 'repeat(2, 1fr)',
                    },
                    gap: 3,
                    mt: 2,
                  }}
                >
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
                    {formData.doc_uploaded_by_user ? (
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
                          {getFileName(String(formData.doc_uploaded_by_user))}
                        </Typography>
                        <IconButton
                          onClick={() => handleDownloadFile(formData.doc_uploaded_by_user)}
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
                    ) : (
                      <Typography
                        variant="body2"
                        component="dd"
                        sx={{
                          color: 'text.disabled',
                          wordBreak: 'break-word',
                          lineHeight: 1.6,
                          fontSize: theme.typography.customSizes.medium,
                        }}
                      >
                        -
                      </Typography>
                    )}
                  </Box>

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
                      {fieldLabels.remarks_by_user}
                    </Typography>
                    <Typography
                      variant="body2"
                      component="dd"
                      sx={{
                        color:
                          !formData.remarks_by_user || String(formData.remarks_by_user).trim() === ''
                            ? 'text.disabled'
                            : 'text.secondary',
                        wordBreak: 'break-word',
                        lineHeight: 1.6,
                        fontSize: theme.typography.customSizes.medium,
                      }}
                    >
                      {!formData.remarks_by_user || String(formData.remarks_by_user).trim() === ''
                        ? '-'
                        : String(formData.remarks_by_user)}
                    </Typography>
                  </Box>

                  {/* Reason by Approver and Actions (shown only when pending) */}
                  {isPending && !isApproved && !isRejected && (
                    <>
                      <Box
                        sx={{
                          gridColumn: {
                            xs: '1',
                            md: '1 / -1',
                          },
                          mt: 1,
                        }}
                      >
                        <TextField
                          label="Reason by Approver"
                          placeholder="Enter reason for approval or rejection (optional)"
                          fullWidth
                          multiline
                          rows={4}
                          value={reasonByApprover}
                          onChange={(e) => setReasonByApprover(e.target.value)}
                          variant="outlined"
                          sx={{
                            '& .MuiOutlinedInput-root': {
                              '&:hover fieldset': {
                                borderColor: 'primary.main',
                              },
                            },
                          }}
                        />
                      </Box>

                      <Box
                        sx={{
                          gridColumn: {
                            xs: '1',
                            md: '1 / -1',
                          },
                          display: 'flex',
                          gap: 2,
                          justifyContent: 'flex-end',
                          mt: 1,
                        }}
                      >
                        <Button
                          onClick={handleApprove}
                          disabled={approving}
                          variant="contained"
                          color="success"
                          sx={{
                            minWidth: '120px',
                            py: 1.2,
                            fontWeight: 700,
                            fontSize: '0.95rem',
                            textTransform: 'none',
                            color: theme.palette.getContrastText(theme.palette.success.main),
                            '&:hover': {
                              boxShadow: 'none',
                            },
                            '&:disabled': {
                              backgroundColor: 'action.disabledBackground',
                              color: 'text.disabled',
                            },
                          }}
                        >
                          {approving ? 'Processing...' : 'Approve'}
                        </Button>
                        <Button
                          onClick={handleReject}
                          disabled={approving}
                          variant="contained"
                          color="error"
                          sx={{
                            minWidth: '120px',
                            py: 1.2,
                            fontWeight: 700,
                            fontSize: '0.95rem',
                            textTransform: 'none',
                            color: theme.palette.getContrastText(theme.palette.error.main),
                            '&:hover': {
                              boxShadow: 'none',
                            },
                            '&:disabled': {
                              backgroundColor: 'action.disabledBackground',
                              color: 'text.disabled',
                            },
                          }}
                        >
                          {approving ? 'Processing...' : 'Reject'}
                        </Button>
                      </Box>
                    </>
                  )}
                </Box>
              </CardContent>
            </Card>
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
          <DialogContent sx={{ px: 3, pt: 0, pb: 2, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <TableContainer
              sx={{
                maxHeight: 'min(420px, 58vh)',
                overflow: 'auto',
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 1,
              }}
            >
              <Table size="small" stickyHeader sx={{ tableLayout: 'fixed', width: '100%' }}>
                <TableHead>
                  <TableRow>
                    <TableCell
                      sx={{
                        fontWeight: 600,
                        width: '62%',
                        borderBottom: '1px solid',
                        borderColor: 'divider',
                      }}
                    >
                      Reason by Approver
                    </TableCell>
                    <TableCell
                      sx={{
                        fontWeight: 600,
                        width: '38%',
                        borderBottom: '1px solid',
                        borderColor: 'divider',
                      }}
                    >
                      Document by User
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rejectionHistoryRows.map((row) => {
                    const docPath = row.doc_uploaded_by_user != null ? String(row.doc_uploaded_by_user).trim() : ''
                    const reason =
                      row.reason_by_approver != null && String(row.reason_by_approver).trim() !== ''
                        ? String(row.reason_by_approver)
                        : null
                    const fileName = docPath ? getFileName(docPath) : ''
                    return (
                      <TableRow key={row.id} hover>
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
                        <TableCell
                          sx={{
                            verticalAlign: 'top',
                            borderBottom: '1px solid',
                            borderColor: 'divider',
                            py: 1.5,
                          }}
                        >
                          {docPath ? (
                            <Tooltip title={fileName} placement="top" arrow enterDelay={400}>
                              <Button
                                size="small"
                                variant="outlined"
                                startIcon={<DownloadIcon fontSize="small" />}
                                onClick={() => handleDownloadFile(docPath)}
                                sx={{
                                  width: 168,
                                  minWidth: 168,
                                  maxWidth: 168,
                                  textTransform: 'none',
                                  fontWeight: 600,
                                  justifyContent: 'flex-start',
                                  px: 1,
                                  py: 0.5,
                                  '& .MuiButton-startIcon': {
                                    mr: 0.75,
                                    flexShrink: 0,
                                  },
                                  '& .MuiButton-label': {
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'flex-start',
                                    minWidth: 0,
                                    flex: 1,
                                    overflow: 'hidden',
                                  },
                                }}
                              >
                                <Box
                                  component="span"
                                  sx={{
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                    minWidth: 0,
                                    flex: 1,
                                    textAlign: 'left',
                                    fontSize: '0.8125rem',
                                  }}
                                >
                                  {fileName}
                                </Box>
                              </Button>
                            </Tooltip>
                          ) : (
                            <Typography variant="body2" color="text.disabled" sx={{ fontSize: '0.8125rem' }}>
                              —
                            </Typography>
                          )}
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
