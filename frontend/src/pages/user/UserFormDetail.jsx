import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTheme } from '@mui/material/styles'
import Navbar from '../../components/Siteadmin_navbar'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'
import Box from '@mui/material/Box'
import TextField from '@mui/material/TextField'
import Button from '@mui/material/Button'
import Alert from '@mui/material/Alert'
import IconButton from '@mui/material/IconButton'
import AttachFileIcon from '@mui/icons-material/AttachFile'
import CloseIcon from '@mui/icons-material/Close'

function UserFormDetail() {
  const theme = useTheme()
  const { form_id } = useParams()
  const navigate = useNavigate()
  const [formData, setFormData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [message, setMessage] = useState({ type: '', text: '' })
  const [saving, setSaving] = useState(false)
  const [selectedFile, setSelectedFile] = useState(null)
  const [fileName, setFileName] = useState('')
  const [remarksByUser, setRemarksByUser] = useState('')

  // Editable fields state
  const [editableFields, setEditableFields] = useState({
    checks_performed: '',
    effective_or_not_effective: '',
    done: '',
    findings: ''
  })

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
        // Initialize editable fields
        setEditableFields({
          checks_performed: data.data.checks_performed || '',
          effective_or_not_effective: data.data.effective_or_not_effective || '',
          done: data.data.done || '',
          findings: data.data.findings || ''
        })
        // Initialize remarks by user
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

  const handleLogout = async () => {
    try {
      const response = await fetch('http://localhost:3000/api/auth/user/logout', {
        method: 'POST',
        credentials: 'include',
      })

      const data = await response.json()

      if (response.ok && data.success) {
        navigate('/user/login')
      } else {
        navigate('/user/login')
      }
    } catch (error) {
      console.error('Logout error:', error)
      navigate('/user/login')
    }
  }

  const handleFieldChange = (field, value) => {
    setEditableFields(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const handleFileSelect = (e) => {
    const file = e.target.files[0]
    if (!file) return

    // Store the file for later upload
    setSelectedFile(file)
    setFileName(file.name)
    setMessage({ type: 'info', text: `File "${file.name}" selected. It will be uploaded when you send for approval.` })
    setTimeout(() => setMessage({ type: '', text: '' }), 3000)
    
    // Reset file input to allow selecting the same file again
    e.target.value = ''
  }

  const handleRemoveFile = () => {
    setSelectedFile(null)
    setFileName('')
  }

  const handleSendForApproval = async () => {
    setSaving(true)
    setMessage({ type: '', text: '' })

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
          setMessage({ type: 'error', text: uploadData.message || 'Failed to upload document' })
          setTimeout(() => setMessage({ type: '', text: '' }), 3000)
          setSaving(false)
          return
        }
      }

      // Then update the editable fields and status
      const response = await fetch(`http://localhost:3000/api/control-forms/${form_id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          checks_performed: editableFields.checks_performed,
          effective_or_not_effective: editableFields.effective_or_not_effective,
          done: editableFields.done,
          findings: editableFields.findings,
          doc_uploaded_by_user: documentPath,
          remarks_by_user: remarksByUser,
          status: 'sent for approval'
        })
      })

      const data = await response.json()

      if (response.ok && data.success) {
        setMessage({ type: 'success', text: 'Form sent for approval successfully' })
        // Clear selected file
        setSelectedFile(null)
        setFileName('')
        // Refresh form data
        fetchFormData()
        setTimeout(() => setMessage({ type: '', text: '' }), 3000)
      } else {
        setMessage({ type: 'error', text: data.message || 'Failed to send for approval' })
        setTimeout(() => setMessage({ type: '', text: '' }), 3000)
      }
    } catch (error) {
      console.error('Error sending for approval:', error)
      setMessage({ type: 'error', text: 'Error sending for approval' })
      setTimeout(() => setMessage({ type: '', text: '' }), 3000)
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
    status: 'Status',
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
  const excludedFields = ['id', 'form_id', 'company_identifier', 'created_at', 'active', 'status', 'reason_by_approver']

  // Editable fields list
  const editableFieldKeys = ['checks_performed', 'effective_or_not_effective', 'done', 'findings']

  // Check if form is sent for approval
  const isSentForApproval = formData?.status === 'sent for approval'
  const isEditable = !isSentForApproval

  if (loading) {
    return (
      <div className="min-h-screen bg-primary">
        <Navbar onLogout={handleLogout} header="Control Form" />
        <div className="flex items-center justify-center min-h-[calc(100vh-4rem)]">
          <p className="text-secondary text-lg">Loading form data...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-primary">
        <Navbar onLogout={handleLogout} header="Control Form" />
        <div className="flex items-center justify-center min-h-[calc(100vh-4rem)]">
          <div className="bg-white rounded-xl shadow-lg p-8 max-w-md">
            <p className="text-red-600 text-lg text-center">{error}</p>
          </div>
        </div>
      </div>
    )
  }

  if (!formData) {
    return (
      <div className="min-h-screen bg-primary">
        <Navbar onLogout={handleLogout} header="Control Form" />
        <div className="flex items-center justify-center min-h-[calc(100vh-4rem)]">
          <div className="bg-white rounded-xl shadow-lg p-8 max-w-md">
            <p className="text-secondary text-lg text-center">Form not found</p>
          </div>
        </div>
      </div>
    )
  }

  const isActive = formData?.active && formData.active !== '' && formData.active !== '0'

  // Sort fields according to fieldOrder
  const sortedFields = fieldOrder.filter(key => 
    formData.hasOwnProperty(key) && !excludedFields.includes(key)
  )

  return (
    <div className="min-h-screen bg-primary">
      <Navbar onLogout={handleLogout} header="Control Form" />

      <div className="w-full max-w-[1500px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {message.text && (
          <Alert severity={message.type === 'success' ? 'success' : 'error'} sx={{ mb: 3 }}>
            {message.text}
          </Alert>
        )}

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
        <div className="flex flex-col lg:flex-row">
          {/* Left Sidebar - 25% */}
          <div className="w-full lg:w-1/4 pr-6">
            <div className="sticky top-4">
              <Card>
                <CardContent sx={{ p: 3 }}>
                  <div className="space-y-6">
                    {/* Form Status (Read-only for users) */}
                    <div>
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
                    </div>

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

                    {/* Status */}
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

                    {/* Send for Approval Button */}
                    {isEditable && (
                      <Box sx={{ pt: 3, borderTop: '1px solid', borderColor: 'divider' }}>
                        <Button
                          onClick={handleSendForApproval}
                          disabled={saving}
                          variant="contained"
                          color="secondary"
                          fullWidth
                          sx={{
                            py: 1.5,
                            fontWeight: 600,
                            textTransform: 'none',
                          }}
                        >
                          {saving ? 'Sending...' : 'Send for Approval'}
                        </Button>
                      </Box>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Vertical Divider */}
          <div className="hidden lg:block w-px bg-gray-300"></div>

          {/* Right Side - 75% */}
          <div className="w-full lg:w-3/4 pl-6">
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

                    // Special handling for doc_uploaded_by_user
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
                            gridColumn: { xs: '1', md: '1' },
                          }}
                        >
                          <Typography
                            variant="caption"
                            component="label"
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
                                  mb: 1
                                }}
                              >
                                {currentFileName}
                              </Typography>
                            )}
                            {selectedFile && (
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                <Typography
                                  variant="body2"
                                  sx={{
                                    color: 'text.secondary',
                                    flex: 1,
                                    wordBreak: 'break-word'
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
                                  mb: 1
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
                                    borderColor: 'divider'
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

                    // Special handling for remarks_by_user (editable field)
                    if (key === 'remarks_by_user') {
                      return (
                        <Box
                          key={key}
                          sx={{
                            pb: 3,
                            borderBottom: '1px solid',
                            borderColor: 'divider',
                            gridColumn: { xs: '1', md: '2' },
                          }}
                        >
                          <TextField
                            label={label}
                            variant="filled"
                            value={remarksByUser}
                            onChange={(e) => setRemarksByUser(e.target.value)}
                            fullWidth
                            multiline
                            rows={4}
                            disabled={!isEditable}
                            placeholder="Enter your remarks..."
                          />
                        </Box>
                      )
                    }

                    // Editable fields
                    if (isEditableField && isEditable) {
                      return (
                        <Box
                          key={key}
                          sx={{
                            pb: 3,
                            borderBottom: '1px solid',
                            borderColor: 'divider',
                            gridColumn: { xs: '1', md: key === 'findings' ? '1 / -1' : '1' },
                          }}
                        >
                          <TextField
                            label={label}
                            variant="filled"
                            value={editableFields[key]}
                            onChange={(e) => handleFieldChange(key, e.target.value)}
                            fullWidth
                            multiline={key === 'findings'}
                            rows={key === 'findings' ? 4 : 1}
                            disabled={!isEditable}
                          />
                        </Box>
                      )
                    }

                    // Read-only fields
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
          </div>
        </div>
      </div>
    </div>
  )
}

export default UserFormDetail
