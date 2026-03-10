import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTheme } from '@mui/material/styles'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'
import Box from '@mui/material/Box'
import TextField from '@mui/material/TextField'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import AttachFileIcon from '@mui/icons-material/AttachFile'
import CloseIcon from '@mui/icons-material/Close'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import DownloadIcon from '@mui/icons-material/Download'
import { toast } from 'react-hot-toast'

function UserFormDetail() {
  const theme = useTheme()
  const navigate = useNavigate()
  const { form_id } = useParams()
  const [formData, setFormData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)
  const [selectedFile, setSelectedFile] = useState(null)
  const [fileName, setFileName] = useState('')
  const [remarksByUser, setRemarksByUser] = useState('')

  // Removed editableFields state - users can only edit remarks_by_user

  useEffect(() => {
    fetchFormData()
  }, [form_id])

  const fetchFormData = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`http://localhost:3000/api/control-forms/${form_id}`, {
        method: 'GET',
        credentials: 'include',
      })

      const data = await response.json()

      if (response.ok && data.success) {
        setFormData(data.data)
        // Initialize remarks by user (only editable field for users)
        setRemarksByUser(data.data.remarks_by_user || '')
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
    const file = e.target.files[0]
    if (!file) return

    // Store the file for later upload
    setSelectedFile(file)
    setFileName(file.name)

    // Reset file input to allow selecting the same file again
    e.target.value = ''
  }

  const handleRemoveFile = () => {
    setSelectedFile(null)
    setFileName('')
  }

  const handleSendForApproval = async () => {
    // Validation: Check if document is uploaded (either existing or newly selected)
    const hasExistingDocument = formData?.doc_uploaded_by_user && formData.doc_uploaded_by_user !== ''
    const hasNewDocument = selectedFile !== null

    if (!hasExistingDocument && !hasNewDocument) {
      toast.error('Please upload a document before sending for approval')
      return
    }

    setSaving(true)

    try {
      // First, upload document if one is selected
      let documentPath = formData?.doc_uploaded_by_user || null

      if (selectedFile) {
        const formDataUpload = new FormData()
        formDataUpload.append('document', selectedFile)

        const uploadResponse = await fetch(`http://localhost:3000/api/control-forms/${form_id}/upload-document`, {
          method: 'POST',
          credentials: 'include',
          body: formDataUpload
        })

        const uploadData = await uploadResponse.json()

        if (uploadResponse.ok && uploadData.success) {
          documentPath = uploadData.data.doc_uploaded_by_user
        } else {
          const errorMessage = uploadData.message || 'Failed to upload document'
          toast.error(errorMessage)
          setSaving(false)
          return
        }
      }

      // Then update only remarks, document, and status (users cannot edit other fields)
      const response = await fetch(`http://localhost:3000/api/control-forms/${form_id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          doc_uploaded_by_user: documentPath,
          remarks_by_user: remarksByUser,
          status: 'sent for approval'
        })
      })

      const data = await response.json()

      if (response.ok && data.success) {
        const successMessage = formData?.status === 'Rejected' 
          ? 'Form resubmitted for approval successfully' 
          : 'Form sent for approval successfully'
        toast.success(successMessage)
        // Clear selected file
        setSelectedFile(null)
        setFileName('')
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
    const parts = filePath.split(/[/\\]/)
    return parts[parts.length - 1]
  }

  const handleDownloadSampleDocument = async (filePath) => {
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
        toast.success('Sample document downloaded successfully')
      } else {
        // Error response: try to parse JSON error message
        let errorMessage = 'Failed to download sample document'
        try {
          const errorData = await response.json()
          errorMessage = errorData.message || errorData.error || errorMessage
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
        toast.error(errorMessage)
      }
    } catch (error) {
      console.error('Error downloading sample document:', error)
      toast.error(`Error downloading sample document: ${error.message}`)
    }
  }

  const sampleRequiredNotice = '(If not available, upload documents from the preceding or succeeding dates.)'

  // Define field labels mapping for updated RACM schema
  const fieldLabels = {
    control_number: 'Control Number',
    account_balance_disclosure: 'Account Balance / Disclosure',
    risk_heat: 'Risk Heat',
    standard_control_description: 'Standard Control Description',
    sub_process: 'Sub Process',
    risk_description: 'Risk Description',
    whether_fraud_risks_exist: 'Whether Fraud Risks Exist',
    control_objective: 'Control Objective',
    process_walkthrough: 'Process Activity and Walkthrough Details',
    control_relies_on_ipe: 'Does the Control Rely on IPE?',
    audit_evidence_accuracy: 'Audit Evidence of Accuracy and Completeness',
    ipe_reference: 'IPE Reference',
    key_control: 'Key Control',
    application_name: 'Application Name',
    control_performer: 'Control Performer',
    control_owner: 'Control Owner',
    control_design_procs: 'Procedures to Evaluate Design and Implementation',
    control_type_fo: 'Type of Control O_F',
    control_type_ma: 'Type of Control M_A',
    nature_of_control: 'Nature of Control',
    process_owner: 'Process Owner',
    control_frequency: 'Control Frequency',
    sample_size: 'Sample Size',
    sample_required: 'Sample Required',
    completeness: 'Completeness',
    existence_occurrence: 'Existence & Occurrence',
    rights_and_obligation: 'Rights and Obligations',
    valuation_and_allocation: 'Valuation & Allocation',
    presentation_and_disclosure: 'Presentation and Disclosure',
    control_design_conclusion: 'Conclusion on Design of Control',
    design_deficiency_desc: 'Description of Deficiency in Control Design',
    doc_uploaded_by_user: 'Doc Uploaded by User',
    remarks_by_user: 'Remarks by User',
    active: 'Active',
    status: 'Status',
    reason_by_approver: 'Reason by Approver',
  }

  const fieldOrder = [
    'control_number',
    'account_balance_disclosure',
    'risk_heat',
    'standard_control_description',
    'sub_process',
    'risk_description',
    'whether_fraud_risks_exist',
    'control_objective',
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
    'process_owner',
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

  // Editable fields list - users can only edit remarks_by_user
  const editableFieldKeys = ['remarks_by_user']

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
  
  // Grouped fields that should be displayed together (only if at least one has a value)
  const groupedApproverFields = ['control_design_procs', 'control_design_conclusion', 'design_deficiency_desc']
  
  // Check if at least one grouped field has a value
  const hasGroupedFieldValue = formData ? groupedApproverFields.some(key => {
    const value = formData[key]
    return value !== null && value !== undefined && value !== '' && String(value).trim() !== ''
  }) : false

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
    if (!formData.hasOwnProperty(key) || excludedFields.includes(key)) {
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

  return (
    <Box
        sx={{
          width: '100%',
          maxWidth: '1500px',
          mx: 'auto',
          px: { xs: 2, sm: 3, md: 4 },
          py: 3,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 4 }}>
          <IconButton
            onClick={() => navigate('/user/dashboard')}
            sx={{
              mr: 2,
              color: theme.palette.text.primary,
              '&:hover': {
                backgroundColor: theme.palette.mode === 'dark' 
                  ? 'rgba(255, 255, 255, 0.08)' 
                  : 'rgba(0, 0, 0, 0.04)',
              },
            }}
            aria-label="back to dashboard"
          >
            <ArrowBackIcon />
          </IconButton>
          <Typography
            variant="h4"
            component="h1"
            sx={{
              fontWeight: 700,
              flex: 1,
              color: 'text.primary'
            }}
          >
            RACM
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', lg: 'row' }, gap: 3 }}>
          {/* Left Sidebar - 25% */}
          <Box sx={{ width: { xs: '100%', lg: '25%' } }}>
            <Box
              sx={{
                position: 'sticky',
                top: { xs: 64, lg: 80 }, // Account for AppBar height (64px) + some padding
                zIndex: 1,
                alignSelf: 'flex-start',
                maxHeight: { xs: 'calc(100vh - 64px)', lg: 'calc(100vh - 80px)' },
              }}
            >
              <Card 
                sx={{ 
                  height: 'fit-content',
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
                }}
              >
                <CardContent sx={{ 
                  p: 3.5, 
                  display: 'flex', 
                  flexDirection: 'column', 
                  gap: 0,
                }}>
                  {/* Status */}
                  <Box sx={{ pb: 1.5, mb: 2.5, borderBottom: '1px solid', borderColor: 'divider' }}>
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
                      }}
                    >
                      {formData?.status && formData.status !== '' ? formData.status : 'Pending'}
                    </Typography>
                  </Box>

                  {/* Business Process */}
                  <Box sx={{ pb: 1.5, mb: 2.5, borderBottom: '1px solid', borderColor: 'divider' }}>
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

                  {/* Creation Time */}
                  <Box sx={{ pb: 1.5, mb: 2.5, borderBottom: '1px solid', borderColor: 'divider' }}>
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
                        fontSize: '0.875rem',
                        lineHeight: 1.5,
                      }}
                    >
                      {formatDateTime(formData?.created_at)}
                    </Typography>
                  </Box>

                  {/* Reason by Approver - show only when non-empty */}
                  {(() => {
                    const reason = formData?.reason_by_approver
                    const hasReason = typeof reason === 'string' && reason.trim() !== ''
                    if (!hasReason) return null

                    return (
                      <Box sx={{ pb: 1.5, mb: 2.5, borderBottom: '1px solid', borderColor: 'divider' }}>
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

                  {/* Sample Document */}
                  <Box sx={{ pb: 1.5, mb: 2.5, borderBottom: '1px solid', borderColor: 'divider' }}>
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
                    {formData?.sampling_doc && formData.sampling_doc.trim() !== '' ? (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography
                          variant="body2"
                          sx={{
                            color: 'text.primary',
                            fontWeight: 500,
                            fontSize: '0.875rem',
                            flex: 1,
                            wordBreak: 'break-word',
                          }}
                        >
                          {getFileName(formData.sampling_doc)}
                        </Typography>
                        <IconButton
                          onClick={() => handleDownloadSampleDocument(formData.sampling_doc)}
                          size="small"
                          sx={{
                            color: 'primary.main',
                            '&:hover': {
                              backgroundColor: 'action.hover',
                            },
                          }}
                        >
                          <DownloadIcon fontSize="small" />
                        </IconButton>
                      </Box>
                    ) : (
                      <Typography
                        variant="body2"
                        sx={{
                          color: 'text.disabled',
                          fontWeight: 500,
                          fontSize: '0.875rem',
                        }}
                      >
                        No sample uploaded
                      </Typography>
                    )}
                  </Box>

                  {/* Send for Approval / Resubmit Button */}
                  {isEditable && (
                    <Box sx={{ mt: 1, pt: 2, pb: 2 }}>
                      {(() => {
                        // Check if document exists (either existing or newly selected)
                        const hasExistingDocument = formData?.doc_uploaded_by_user && formData.doc_uploaded_by_user !== ''
                        const hasNewDocument = selectedFile !== null
                        const hasDocument = hasExistingDocument || hasNewDocument

                        // Check if remarks are provided
                        const hasRemarks = !!(remarksByUser && remarksByUser.trim() !== '')

                        // Detect changes:
                        // 1) New document selected
                        const hasDocumentChange = hasNewDocument
                        // 2) Remarks text changed compared to original value from backend
                        const originalRemarks = (formData?.remarks_by_user || '').trim()
                        const currentRemarks = (remarksByUser || '').trim()
                        const hasRemarksChange = originalRemarks !== currentRemarks

                        // Button is enabled only when:
                        // - Document and remarks are both present (business rule)
                        // - AND user has either uploaded a new document or changed remarks
                        const hasAnyChange = hasDocumentChange || hasRemarksChange
                        const isButtonDisabled = saving || !hasDocument || !hasRemarks || !hasAnyChange
                        
                        return (
                          <Button
                            onClick={handleSendForApproval}
                            disabled={isButtonDisabled}
                            variant="contained"
                            color="secondary"
                            fullWidth
                            sx={{
                              py: 1.75,
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
                              : (isRejected ? 'Resubmit for Approval' : 'Send for Approval')
                            }
                          </Button>
                        )
                      })()}
                    </Box>
                  )}
                </CardContent>
              </Card>
            </Box>
          </Box>

          {/* Vertical Divider */}
          <Box
            sx={{
              display: { xs: 'none', lg: 'block' },
              width: '1px',
              backgroundColor: 'divider',
              alignSelf: 'stretch',
            }}
          />

          {/* Right Side - 75% */}
          <Box sx={{ width: { xs: '100%', lg: '75%' }, flex: 1 }}>
            <Card>
              <CardContent sx={{ p: 4 }}>
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: {
                      xs: '1fr',
                      md: 'repeat(2, 1fr)',
                    },
                    gap: 3,
                  }}
                >
                  {sortedFields.map((key) => {
                    const label = fieldLabels[key] || key.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())
                    const value = formData[key]
                    const isEmpty = value === null || value === undefined || value === ''
                    const isEditableField = editableFieldKeys.includes(key)

                    // Editable fields - only remarks_by_user is editable by users
                    if (isEditableField && isEditable) {
                      // Only remarks_by_user is editable
                      const fieldValue = remarksByUser
                      const handleChange = (e) => setRemarksByUser(e.target.value)

                      return (
                        <Box
                          key={key}
                          sx={{
                            pb: 3,
                            borderBottom: '1px solid',
                            borderColor: 'divider',
                            gridColumn: {
                              xs: '1',
                              md: '1 / -1'
                            },
                          }}
                        >
                          <TextField
                            label={label}
                            variant="outlined"
                            value={fieldValue}
                            onChange={handleChange}
                            fullWidth
                            multiline={key === 'remarks_by_user'}
                            rows={key === 'remarks_by_user' ? 4 : 1}
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
                        </Box>
                      )
                    }

                    // Special handling for doc_uploaded_by_user (but in normal grid layout)
                    if (key === 'doc_uploaded_by_user') {
                      // Extract filename from path
                      const getFileName = (path) => {
                        if (!path) return null
                        // Handle both Windows and Unix paths
                        const parts = path.split(/[/\\]/)
                        return parts[parts.length - 1]
                      }

                      const currentFileName = formData.doc_uploaded_by_user ? getFileName(formData.doc_uploaded_by_user) : null

                      return (
                        <Box
                          key={key}
                          sx={{
                            pb: 3,
                            borderBottom: '1px solid',
                            borderColor: 'divider',
                            '&:last-child': {
                              borderBottom: 'none',
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
                              mb: 1,
                              color: 'text.primary',
                              fontSize: theme.typography.customSizes.small,
                            }}
                          >
                            {label}
                          </Typography>
                          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                            {currentFileName && !selectedFile && (
                              <Typography
                                variant="body2"
                                sx={{
                                  color: 'text.secondary',
                                  wordBreak: 'break-word',
                                  lineHeight: 1.6,
                                  fontSize: theme.typography.customSizes.medium,
                                }}
                              >
                                {currentFileName}
                              </Typography>
                            )}
                            {selectedFile && (
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
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
                                  {fileName}
                                </Typography>
                                <IconButton
                                  size="small"
                                  onClick={handleRemoveFile}
                                  disabled={!isEditable}
                                  sx={{ color: 'error.main' }}
                                >
                                  <CloseIcon fontSize="small" />
                                </IconButton>
                              </Box>
                            )}
                            {!currentFileName && !selectedFile && (
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
                            {isEditable && (
                              <label>
                                <input
                                  type="file"
                                  style={{ display: 'none' }}
                                  onChange={handleFileSelect}
                                  disabled={!isEditable}
                                />
                                <IconButton
                                  component="span"
                                  disabled={!isEditable}
                                  color="secondary"
                                  sx={{
                                    border: '1px solid',
                                    borderColor: 'divider',
                                    mt: 0.5
                                  }}
                                >
                                  <AttachFileIcon />
                                </IconButton>
                              </label>
                            )}
                          </Box>
                        </Box>
                      )
                    }

                    // Read-only fields (including editable fields when form is not editable)
                    // Always use formData values for read-only display (saved database values)
                    const displayValue = value
                    const isEmptyDisplay = displayValue === null || displayValue === undefined || displayValue === ''

                    return (
                      <Box
                        key={key}
                        sx={{
                          pb: 3,
                          borderBottom: '1px solid',
                          borderColor: 'divider',
                          '&:last-child': {
                            borderBottom: 'none',
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
                            mb: 1,
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
                            color: isEmptyDisplay ? 'text.disabled' : 'text.secondary',
                            wordBreak: 'break-word',
                            lineHeight: 1.6,
                            fontSize: theme.typography.customSizes.medium,
                          }}
                        >
                          {isEmptyDisplay ? '-' : String(displayValue)}
                        </Typography>
                        {key === 'sample_required' && (
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
                        )}
                      </Box>
                    )
                  })}
                  
                  {/* Grouped Approver Fields - Display only if at least one has a value */}
                  {hasGroupedFieldValue && (
                    <Box
                      sx={{
                        gridColumn: { xs: '1', md: '1 / -1' },
                        pb: 3,
                        borderTop: '2px solid',
                        borderBottom: '1px solid',
                        borderColor: 'divider',
                        pt: 3,
                        mt: 2,
                      }}
                    >
                      <Typography
                        variant="h6"
                        component="h3"
                        sx={{
                          fontWeight: 700,
                          mb: 3,
                          color: 'text.primary',
                          fontSize: '1.125rem',
                        }}
                      >
                        Control Design & Evaluation
                      </Typography>
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
                                pb: 2,
                                borderBottom: '1px solid',
                                borderColor: 'divider',
                                '&:last-child': {
                                  borderBottom: 'none',
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
                                  mb: 1,
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
                  )}
                </Box>
              </CardContent>
            </Card>
          </Box>
        </Box>
      </Box>
  )
}

export default UserFormDetail
