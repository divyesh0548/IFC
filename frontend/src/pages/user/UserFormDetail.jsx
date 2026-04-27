import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTheme } from '@mui/material/styles'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'
import Box from '@mui/material/Box'
import TextField from '@mui/material/TextField'
import Button from '@mui/material/Button'
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
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp'
import InsertDriveFileRoundedIcon from '@mui/icons-material/InsertDriveFileRounded'
import { toast } from 'react-hot-toast'
import * as XLSX from 'xlsx'
import { FORM_DETAIL_MAX_WIDTH } from '../../uiConstants'
import { RACM_FIELD_LABELS, orderControlDetailKeys } from '../../racmFormDetailFields'
import { useSyncGlobalLoading } from '../../contexts/GlobalLoadingContext'
import { apiUrl, API_BASE_URL } from '../../config/api'

function UserFormDetail() {
  const theme = useTheme()
  const navigate = useNavigate()
  const { form_id } = useParams()
  const [formData, setFormData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)
  const [selectedFiles, setSelectedFiles] = useState([])
  const [remarksByUser, setRemarksByUser] = useState('')
  const [showScrollTop, setShowScrollTop] = useState(false)
  const [sampleDocsDialogOpen, setSampleDocsDialogOpen] = useState(false)

  useSyncGlobalLoading(loading || saving)

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

  // Removed handleFieldChange - users can only edit remarks_by_user

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return

    setSelectedFiles((currentFiles) => {
      const existingKeys = new Set(
        currentFiles.map((file) => `${file.name}-${file.size}-${file.lastModified}`)
      )
      const nextFiles = [...currentFiles]
      files.forEach((file) => {
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

  const checkApproverActiveForSubmission = async () => {
    const response = await fetch(`${API_BASE_URL}/api/control-forms/${form_id}/approver-status`, {
      method: 'GET',
      credentials: 'include',
    })

    const data = await response.json()

    if (!response.ok || !data.success) {
      toast.error(data.message || 'Failed to check approver status')
      return false
    }

    if (data.data?.approver_active === false) {
      toast.error('Approver of this RACM is not active')
      return false
    }

    if (data.data) {
      setFormData((currentData) => ({
        ...currentData,
        approver_email_id: data.data.approver_email_id,
        approver_name: data.data.approver_name,
        approver_display_name: data.data.approver_display_name,
        approver_temp_login: data.data.approver_temp_login,
      }))
    }

    return true
  }

  const handleSendForApproval = async () => {
    // Validation: Check if document is uploaded (either existing or newly selected)
    const hasExistingDocument = formData?.doc_uploaded_by_user && formData.doc_uploaded_by_user !== ''
    const hasNewDocument = selectedFiles.length > 0

    if (!hasExistingDocument && !hasNewDocument) {
      toast.error('Please upload at least one document before sending for approval')
      return
    }

    setSaving(true)

    try {
      const approverActive = await checkApproverActiveForSubmission()
      if (!approverActive) {
        return
      }

      // First, upload document if one is selected
      let documentPath = formData?.doc_uploaded_by_user || null
      let uploadedDocumentPaths = []

      if (selectedFiles.length > 0) {
        const formDataUpload = new FormData()
        selectedFiles.forEach((file) => {
          formDataUpload.append('documents', file)
        })

        const uploadResponse = await fetch(`${API_BASE_URL}/api/control-forms/${form_id}/upload-document`, {
          method: 'POST',
          credentials: 'include',
          body: formDataUpload
        })

        const uploadData = await uploadResponse.json()

        if (uploadResponse.ok && uploadData.success) {
          documentPath = uploadData.data.doc_uploaded_by_user
          uploadedDocumentPaths = Array.isArray(uploadData.data.doc_uploaded_by_user_docs)
            ? uploadData.data.doc_uploaded_by_user_docs
                .map((doc) => doc.doc_uploaded_by_user)
                .filter(Boolean)
            : [documentPath].filter(Boolean)
        } else {
          const errorMessage = uploadData.message || 'Failed to upload documents'
          toast.error(errorMessage)
          setSaving(false)
          return
        }
      }

      // Then update only remarks, document, and status (users cannot edit other fields)
      const response = await fetch(`${API_BASE_URL}/api/control-forms/${form_id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          doc_uploaded_by_user: documentPath,
          doc_uploaded_by_user_docs: uploadedDocumentPaths,
          remarks_by_user: remarksByUser,
          status: 'sent for approval'
        })
      })

      const data = await response.json()

      if (response.ok && data.success) {
        const successMessage = formData?.status === 'Rejected' 
          ? 'RACM resubmitted for approval successfully' 
          : 'RACM sent for approval successfully'
        toast.success(successMessage)
        setSelectedFiles([])
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
            doc_uploaded_by_user: documentPath,
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
    const parts = String(filePath).split(/[/\\]/)
    return parts[parts.length - 1] || String(filePath)
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
  const excludedFields = ['id', 'form_id', 'company_identifier', 'created_at', 'active', 'status', 'reason_by_approver']

  // Check if form is sent for approval, approved, or rejected
  const isSentForApproval = formData?.status === 'sent for approval'
  const isApproved = formData?.status === 'Approved'
  const isRejected = formData?.status === 'Rejected'
  // Form is editable if status is not 'sent for approval' or 'Approved'
  // If status is 'Rejected', user can edit and resubmit
  const isEditable = !isSentForApproval && !isApproved

  // Fields to hide when status is empty/null or 'sent for approval'
  // Only show them when status is 'Approved' or 'Rejected'
  // Note: remarks_by_user is always displayed (removed from this list)
  const conditionalHiddenFields = ['control_design_conclusion', 'design_deficiency_desc']

  // Check if status should hide conditional fields
  const shouldHideConditionalFields = !formData?.status || formData.status === '' || formData.status === 'sent for approval'
  
  // Design & Implementation — same three fields as backend DESIGN_IMPLEMENTATION_GROUP_FIELDS (control_forms.js).
  // API omits all three when every value is empty; if any has a value, API returns all three (show "-" for blanks).
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
                        color: 'text.primary',
                        fontWeight: 500,
                        fontSize: '0.9375rem',
                        lineHeight: 1.5,
                      }}
                    >
                      {formData?.status && formData.status !== '' ? formData.status : 'Pending'}
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
                      Created At
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
                      {formatDateTime(formData?.created_at)}
                    </Typography>
                  </Box>

                  {/* Sample Document */}
                  <Box
                    component={sampleDocCount > 0 ? 'button' : 'div'}
                    type={sampleDocCount > 0 ? 'button' : undefined}
                    onClick={sampleDocCount > 0 ? handleOpenSampleDocsDialog : undefined}
                    sx={{
                      p: 2,
                      borderRadius: 2,
                      border: '1px solid',
                      borderColor: 'divider',
                      width: '100%',
                      textAlign: 'left',
                      backgroundColor: 'transparent',
                      cursor: sampleDocCount > 0 ? 'pointer' : 'default',
                      font: 'inherit',
                      transition: 'all 0.2s ease-in-out',
                      '&:hover': sampleDocCount > 0
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
                      Sample Document
                    </Typography>
                    {sampleDocCount > 0 ? (
                      <Box
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 1.5,
                        }}
                      >
                        <Typography
                          variant="body2"
                          sx={{
                            color: 'text.primary',
                            fontWeight: 600,
                            fontSize: '0.9375rem',
                            lineHeight: 1.5,
                          }}
                        >
                          Sample Documents ({sampleDocCount})
                        </Typography>
                      </Box>
                    ) : (
                      <Typography
                        variant="body2"
                        sx={{
                          color: 'text.disabled',
                          fontWeight: 500,
                          fontSize: '0.9375rem',
                          lineHeight: 1.5,
                        }}
                      >
                        No sample uploaded
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
                      {String(
                        formData?.approver_name ||
                          formData?.approver_display_name ||
                          formData?.approver_email_id ||
                          ''
                      ).trim() || '-'}
                    </Typography>
                  </Box>

                  {/* Reason by Approver (when present) */}
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
                            fontSize: '0.9375rem',
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
                        // handled in Approval section
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
                        {key === 'sample_required' ? (
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

            {/* Grouped Approver Fields - Display only if at least one has a value */}
            {hasGroupedFieldValue && (
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
                              whiteSpace: isTextArea ? 'pre-wrap' : 'normal',
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
            )}

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
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                      {(() => {
                        const uploadedDocs = Array.isArray(formData?.doc_uploaded_by_user_docs)
                          ? formData.doc_uploaded_by_user_docs
                          : []
                        const existingDocs = uploadedDocs.length > 0
                          ? uploadedDocs
                          : formData?.doc_uploaded_by_user
                            ? [{ doc_uploaded_by_user: formData.doc_uploaded_by_user }]
                            : []
                        const hasAnyDocument = existingDocs.length > 0 || selectedFiles.length > 0

                        return (
                          <>
                            {existingDocs.map((doc, index) => {
                              const docPath = doc.doc_uploaded_by_user
                              if (!docPath) return null

                              return (
                                <Box
                                  key={`${docPath}-${doc.id || index}`}
                                  sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
                                >
                                  <InsertDriveFileRoundedIcon
                                    fontSize="small"
                                    sx={{ color: 'text.secondary', flexShrink: 0 }}
                                  />
                                  <Typography
                                    variant="body2"
                                    sx={{
                                      color: 'text.secondary',
                                      flex: 1,
                                      wordBreak: 'break-word',
                                      lineHeight: 1.6,
                                      fontSize: theme.typography.customSizes.medium,
                                    }}
                                  >
                                    {getFileName(docPath)}
                                  </Typography>
                                </Box>
                              )
                            })}
                            {selectedFiles.map((file, index) => (
                              <Box
                                key={`${file.name}-${file.size}-${file.lastModified}`}
                                sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
                              >
                                <AttachFileIcon
                                  fontSize="small"
                                  sx={{ color: 'primary.main', flexShrink: 0 }}
                                />
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
                            {!hasAnyDocument && (
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
                                Document listed above will be uploaded for approval.
                              </Typography>
                            )}
                          </>
                        )
                      })()}

                      {isEditable && (
                        <label>
                          <input
                            type="file"
                            multiple
                            style={{ display: 'none' }}
                            onChange={handleFileSelect}
                            disabled={!isEditable}
                          />
                          <IconButton
                            component="span"
                            disabled={!isEditable}
                            sx={{
                              border: '1px solid',
                              borderColor: 'divider',
                              mt: 0.5,
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
                      )}
                    </Box>
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
                            color:
                              (formData?.remarks_by_user || '').trim() === ''
                                ? 'text.disabled'
                                : 'text.secondary',
                            wordBreak: 'break-word',
                            lineHeight: 1.6,
                            fontSize: theme.typography.customSizes.medium,
                            whiteSpace: 'pre-wrap',
                          }}
                        >
                          {(formData?.remarks_by_user || '').trim() === ''
                            ? '-'
                            : formData.remarks_by_user}
                        </Typography>
                      </>
                    )}
                  </Box>

                  {/* Send for Approval / Resubmit — visible only when document + changes exist, or while submitting */}
                  {isEditable &&
                    (() => {
                      const hasExistingDocument = formData?.doc_uploaded_by_user && formData.doc_uploaded_by_user !== ''
                      const hasNewDocument = selectedFiles.length > 0
                      const hasDocument = hasExistingDocument || hasNewDocument

                      const hasDocumentChange = hasNewDocument
                      const originalRemarks = (formData?.remarks_by_user || '').trim()
                      const currentRemarks = (remarksByUser || '').trim()
                      const hasRemarksChange = originalRemarks !== currentRemarks

                      const hasAnyChange = hasDocumentChange || hasRemarksChange
                      const showSubmit = saving || (hasDocument && hasAnyChange)
                      if (!showSubmit) return null

                      return (
                        <Box
                          sx={{
                            gridColumn: { xs: '1', md: '1 / -1' },
                            display: 'flex',
                            justifyContent: 'flex-start',
                          }}
                        >
                          <Button
                            onClick={handleSendForApproval}
                            disabled={saving}
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
                              boxShadow: theme.palette.mode === 'dark'
                                ? '0 4px 12px rgba(3, 105, 161, 0.3)'
                                : '0 2px 8px rgba(3, 105, 161, 0.2)',
                              '&:hover': {
                                boxShadow: theme.palette.mode === 'dark'
                                  ? '0 6px 16px rgba(3, 105, 161, 0.4)'
                                  : '0 4px 12px rgba(3, 105, 161, 0.3)',
                                transform: 'translateY(-1px)',
                              },
                              '&:disabled': {
                                opacity: 0.5,
                                transform: 'none',
                              },
                              transition: 'all 0.2s ease-in-out',
                            }}
                          >
                            {saving
                              ? (isRejected ? 'Resubmitting...' : 'Sending...')
                              : (isRejected ? 'Resubmit for Approval' : 'Send for Approval')}
                          </Button>
                        </Box>
                      )
                    })()}
                </Box>
              </CardContent>
            </Card>
          </Box>
      </Box>

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
