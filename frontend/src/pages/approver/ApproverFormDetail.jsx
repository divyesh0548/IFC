import React, { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { useTheme } from '@mui/material/styles'
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Alert from '@mui/material/Alert';
import IconButton from '@mui/material/IconButton';
import DownloadIcon from '@mui/icons-material/Download';
import { toast } from 'react-hot-toast';
import { useRef } from 'react';

function ApproverFormDetail() {
  const theme = useTheme()
  const { form_id } = useParams()
  const [formData, setFormData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [approving, setApproving] = useState(false)
  const [reasonByApprover, setReasonByApprover] = useState('')
  
  // Editable fields for approver (only editable when status is pending)
  const [editableFields, setEditableFields] = useState({
    checks_performed: '',
    effective_or_not_effective: '',
    done: '',
    findings: ''
  })

  const toastId = useRef(null)

  useEffect(() => {
    fetchFormData()
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
          checks_performed: data.data.checks_performed || '',
          effective_or_not_effective: data.data.effective_or_not_effective || '',
          done: data.data.done || '',
          findings: data.data.findings || ''
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
          checks_performed: editableFields.checks_performed,
          effective_or_not_effective: editableFields.effective_or_not_effective,
          done: editableFields.done,
          findings: editableFields.findings
        }),
      })

      const data = await response.json()

      if (response.ok && data.success) {
        toastId.current = toast.success('Form approved successfully')
        setReasonByApprover('')
        // Clear editable fields
        setEditableFields({
          checks_performed: '',
          effective_or_not_effective: '',
          done: '',
          findings: ''
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
          checks_performed: editableFields.checks_performed,
          effective_or_not_effective: editableFields.effective_or_not_effective,
          done: editableFields.done,
          findings: editableFields.findings
        }),
      })

      const data = await response.json()

      if (response.ok && data.success) {
        toast.success('Form rejected successfully', { id: toastId.current })
        setReasonByApprover('')
        // Clear editable fields
        setEditableFields({
          checks_performed: '',
          effective_or_not_effective: '',
          done: '',
          findings: ''
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

  // Define field labels mapping
  const fieldLabels = {
    description_of_control: 'Description of Control',
    process: 'Process',
    sub_process: 'Sub Process',
    risk_description: 'Risk Description',
    whether_fraud_risks_exist: 'Whether Fraud Risks Exist',
    control_objective: 'Control Objective',
    control_to_address: 'Control to Address',
    mrc_or_not: 'MRC or Not',
    gap_description_resolution: 'Gap Description & Resolution',
    source_data_report_logic_report_parameters: 'Source Data/Report Logic/Report Parameters',
    relevant_data_elements_of_ipe: 'Relevant Data Elements of IPE',
    type_of_control: 'Type of Control',
    nature_of_control: 'Nature of Control',
    type_of_risk_mitigation_method: 'Type of Risk Mitigation Method',
    process_owner: 'Process Owner',
    reviewer_process_supervisor: 'Reviewer/Process Supervisor',
    control_frequency: 'Control Frequency',
    basis_of_sampling: 'Basis of Sampling',
    docs_to_review_for_dms_audit: 'Docs to Review for DMS Audit',
    type_of_risk_associated: 'Type of Risk Associated',
    financial_reporting: 'Financial Reporting',
    checks_performed: 'Checks Performed',
    effective_or_not_effective: 'Effective or Not Effective',
    done: 'Done',
    findings: 'Findings',
    doc_uploaded_by_user: 'Doc Uploaded by User',
    remarks_by_user: 'Remarks by User',
    active: 'Active',
    approved_rejected: 'Approved/Rejected',
    reason_by_approver: 'Reason by Approver',
  }

  // Define field order - gap_description_resolution comes after mrc_or_not
  const fieldOrder = [
    'description_of_control',
    'process',
    'sub_process',
    'risk_description',
    'whether_fraud_risks_exist',
    'control_objective',
    'control_to_address',
    'mrc_or_not',
    'gap_description_resolution',
    'source_data_report_logic_report_parameters',
    'relevant_data_elements_of_ipe',
    'type_of_control',
    'nature_of_control',
    'type_of_risk_mitigation_method',
    'process_owner',
    'reviewer_process_supervisor',
    'control_frequency',
    'basis_of_sampling',
    'docs_to_review_for_dms_audit',
    'type_of_risk_associated',
    'financial_reporting',
    'checks_performed',
    'effective_or_not_effective',
    'done',
    'findings',
    'doc_uploaded_by_user',
    'remarks_by_user'
  ]

  // Fields to exclude from display
  const excludedFields = ['id', 'form_id', 'company_identifier', 'created_at', 'active', 'approved_rejected', 'reason_by_approver']

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
        <Typography 
          variant="h4" 
          component="h1" 
          sx={{ 
            fontWeight: 700, 
            textAlign: 'center', 
            mb: 4,
            color: 'text.primary'
          }}
        >
          Control Form
        </Typography>
        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', lg: 'row' }, gap: 3 }}>
          {/* Left Sidebar - 25% */}
          <Box sx={{ width: { xs: '100%', lg: '25%' } }}>
            <Box
              sx={{
                position: 'sticky',
                top: { xs: 64, lg: 80 }, // Account for AppBar height (64px) + some padding
                zIndex: 1,
                maxHeight: { xs: 'calc(100vh - 64px)', lg: 'calc(100vh - 80px)' },
                overflowY: 'auto',
              }}
            >
              <Card>
                <CardContent sx={{ p: 3 }}>
                  <div className="space-y-6">
                    {/* Form Status (Read-only for approver) */}
                    <Box sx={{ pt: 2, borderColor: 'divider' }}>
                      <Typography
                        variant="body2"
                        component="label"
                        sx={{
                          display: 'block',
                          fontWeight: 700,
                          mb: 1,
                          color: 'text.primary'
                        }}
                      >
                        Form Status
                      </Typography>
                      <Typography 
                        variant="body2" 
                        sx={{ 
                          color: isActive ? '#10b981' : '#ef4444',
                          fontWeight: 600
                        }}
                      >
                        {isActive ? 'Active' : 'Inactive'}
                      </Typography>
                    </Box>

                    {/* Creation Time */}
                    <Box sx={{ pt: 3, borderTop: '1px solid', borderColor: 'divider' }}>
                      <Typography
                        variant="body2"
                        component="label"
                        sx={{
                          display: 'block',
                          fontWeight: 700,
                          mb: 1,
                          color: 'text.primary'
                        }}
                      >
                        Created At
                      </Typography>
                      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                        {formatDateTime(formData?.created_at)}
                      </Typography>
                    </Box>

                    {/* Approved/Rejected */}
                    <Box sx={{ pt: 3, borderTop: '1px solid', borderColor: 'divider' }}>
                      <Typography
                        variant="body2"
                        component="label"
                        sx={{
                          display: 'block',
                          fontWeight: 700,
                          mb: 1,
                          color: 'text.primary'
                        }}
                      >
                        Status
                      </Typography>
                      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                        {formData?.status || '-'}
                      </Typography>
                    </Box>

                    {/* Reason by Approver */}
                    <Box sx={{ pt: 3, borderTop: '1px solid', borderColor: 'divider' }}>
                      <Typography
                        variant="body2"
                        component="label"
                        sx={{
                          display: 'block',
                          fontWeight: 700,
                          mb: 1,
                          color: 'text.primary'
                        }}
                      >
                        Reason by Approver
                      </Typography>
                      <Typography 
                        variant="body2" 
                        sx={{ 
                          color: 'text.secondary',
                          wordBreak: 'break-word'
                        }}
                      >
                        {formData?.reason_by_approver || '-'}
                      </Typography>
                    </Box>
                  </div>
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
                  {fieldOrder
                    .filter(key => formData.hasOwnProperty(key) && !excludedFields.includes(key))
                    .map((key) => {
                      const label = fieldLabels[key] || key.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())
                      const value = formData[key]
                      const isEmpty = value === null || value === undefined || value === ''
                      const isFileField = key === 'doc_uploaded_by_user'
                      
                      // Check if this is an editable field for approver (only when pending)
                      const editableFieldKeys = ['checks_performed', 'effective_or_not_effective', 'done', 'findings']
                      const isEditableField = editableFieldKeys.includes(key)
                      const isEditable = isPending && isEditableField

                      return (
                        <Box
                          key={key}
                          sx={{
                            pb: 3,
                            borderBottom: '1px solid',
                            borderColor: 'divider',
                            gridColumn: isEditable ? {
                              xs: '1',
                              md: '1 / -1'
                            } : undefined,
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
                          {isEditable ? (
                            // Editable TextField for approver (only when pending)
                            <TextField
                              label={label}
                              variant="outlined"
                              value={editableFields[key]}
                              onChange={(e) => handleFieldChange(key, e.target.value)}
                              fullWidth
                              multiline={key === 'findings'}
                              rows={key === 'findings' ? 4 : 1}
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

            {/* Approval Action Card - Only show if pending, hide if approved or rejected */}
            {isPending && !isApproved && !isRejected && (
              <Card sx={{ mt: 4 }}>
                <CardContent sx={{ p: 4 }}>
                  <Typography
                    variant="h6"
                    component="h2"
                    sx={{
                      fontWeight: 700,
                      mb: 3,
                      color: 'text.primary',
                      borderBottom: '2px solid',
                      borderColor: 'divider',
                      pb: 2
                    }}
                  >
                    Approval Action
                  </Typography>
                  
                  <Box sx={{ mb: 3 }}>
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

                  <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
                    <Button
                      onClick={handleApprove}
                      disabled={approving}
                      variant="contained"
                      sx={{
                        minWidth: '120px',
                        py: 1.5,
                        fontWeight: 600,
                        textTransform: 'none',
                        backgroundColor: '#10b981',
                        color: '#ffffff',
                        '&:hover': {
                          backgroundColor: '#059669',
                        },
                        '&:disabled': {
                          backgroundColor: '#9ca3af',
                        },
                      }}
                    >
                      {approving ? 'Processing...' : '✓ Approve'}
                    </Button>
                    <Button
                      onClick={handleReject}
                      disabled={approving}
                      variant="contained"
                      sx={{
                        minWidth: '120px',
                        py: 1.5,
                        fontWeight: 600,
                        textTransform: 'none',
                        backgroundColor: '#ef4444',
                        color: '#ffffff',
                        '&:hover': {
                          backgroundColor: '#dc2626',
                        },
                        '&:disabled': {
                          backgroundColor: '#9ca3af',
                        },
                      }}
                    >
                      {approving ? 'Processing...' : '✗ Reject'}
                    </Button>
                  </Box>
                </CardContent>
              </Card>
            )}
          </Box>
        </Box>
      </Box>
  )
}

export default ApproverFormDetail

