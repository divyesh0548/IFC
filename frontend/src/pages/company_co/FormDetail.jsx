import React, { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTheme } from '@mui/material/styles'
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import { toast } from 'react-hot-toast';
import * as XLSX from 'xlsx';

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
  const [samplingFile, setSamplingFile] = useState(null)
  const [samplingHeaders, setSamplingHeaders] = useState([])
  const [selectedHeaders, setSelectedHeaders] = useState([])
  const [samplingDialogOpen, setSamplingDialogOpen] = useState(false)
  const [uploadingSampling, setUploadingSampling] = useState(false)
  const fileInputRef = useRef(null)

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


  const checkUserExists = async (email) => {
    if (!email || !email.trim()) return false

    try {
      const response = await fetch(`http://localhost:3000/api/company-co/check-user/${encodeURIComponent(email.trim())}`, {
        method: 'GET',
        credentials: 'include',
      })

      const data = await response.json()
      return data.success && data.exists
    } catch (error) {
      console.error('Error checking user:', error)
      return false
    }
  }

  const handleToggleActive = async () => {
    if (!formData) return

    // Determine new active status
    const isCurrentlyActive = formData.active && formData.active !== '' && formData.active !== '0'
    const newActiveStatus = isCurrentlyActive ? '0' : '1'

    // Only check process owner when setting to active
    if (newActiveStatus === '1') {
      const processOwnerEmailValue = formData.process_owner?.trim()

      if (processOwnerEmailValue) {
        // Check if process owner exists
        const userExists = await checkUserExists(processOwnerEmailValue)

        if (!userExists) {
          // Show confirmation dialog
          setProcessOwnerEmail(processOwnerEmailValue)
          setCreateUserConfirmDialogOpen(true)
          return
        }
      }
    }

    // Proceed with setting active/inactive
    await performToggleActive(newActiveStatus)
  }

  const performToggleActive = async (newActiveStatus) => {
    setUpdating(true)
    try {
      const response = await fetch(`http://localhost:3000/api/control-forms/${form_id}`, {
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
        // Update local state
        setFormData({
          ...formData,
          active: newActiveStatus
        })
        const statusMessage = newActiveStatus === '1'
          ? 'Form set to Active successfully'
          : 'Form set to Inactive successfully'
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

  const handleCreateUserConfirm = () => {
    setCreateUserConfirmDialogOpen(false)
    navigate(`/company_co/create-user?email=${encodeURIComponent(processOwnerEmail)}`)
  }

  const handleCreateUserCancel = () => {
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
        initialFields[key] = formData[key] || ''
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
        initialFields[key] = formData[key] || ''
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

  const handleSaveChanges = async () => {
    // Check status again before saving
    const status = formData?.status
    const canEdit = !status || status === '' || status === null || status === 'Rejected'

    if (!canEdit) {
      toast.error('Form cannot be modified.')
      setIsEditMode(false)
      return
    }

    setSaving(true)
    try {
      const response = await fetch(`http://localhost:3000/api/control-forms/${form_id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(editableFields),
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

  const formatStatus = (status) => {
    if (!status || status === '' || status === null) {
      return 'To be sent by user'
    }

    if (status === 'Approved') {
      return 'Approved'
    }

    if (status === 'Rejected') {
      return 'Rejected'
    }

    if (status === 'sent for approval') {
      return 'Pending for Approval'
    }

    // For any other status, capitalize first letter
    return status.charAt(0).toUpperCase() + status.slice(1)
  }

  const handleSamplingFileChange = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    const validTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      'application/vnd.ms-excel', // .xls
    ]

    if (!validTypes.includes(file.type)) {
      toast.error('Invalid file type. Please upload an Excel file (.xlsx, .xls)')
      return
    }

    // Validate file size (10MB limit)
    if (file.size > 10 * 1024 * 1024) {
      toast.error('File size exceeds 10MB limit.')
      return
    }

    try {
      // Read file as array buffer
      const arrayBuffer = await file.arrayBuffer()
      const workbook = XLSX.read(arrayBuffer, { type: 'array' })

      // Get first sheet
      const firstSheetName = workbook.SheetNames[0]
      const worksheet = workbook.Sheets[firstSheetName]

      // Convert to JSON to get headers from first row
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 })

      if (jsonData.length === 0) {
        toast.error('Excel file is empty')
        return
      }

      // Get headers from first row
      const headers = jsonData[0].filter(header => header !== null && header !== undefined && String(header).trim() !== '')

      if (headers.length === 0) {
        toast.error('No headers found in Excel file')
        return
      }

      setSamplingFile(file)
      setSamplingHeaders(headers)
      setSelectedHeaders([])
      setSamplingDialogOpen(true)
    } catch (error) {
      console.error('Error parsing Excel file:', error)
      toast.error('Error parsing Excel file. Please ensure it is a valid Excel file.')
    }
  }

  const handleHeaderToggle = (header) => {
    setSelectedHeaders(prev => {
      if (prev.includes(header)) {
        // Remove if already selected
        return prev.filter(h => h !== header)
      } else {
        // Add if less than 2 selected
        if (prev.length < 2) {
          return [...prev, header]
        } else {
          toast.error('You can only select 2 headers')
          return prev
        }
      }
    })
  }

  const handleSamplingUpload = async () => {
    if (!samplingFile) {
      toast.error('Please select a file')
      return
    }

    if (selectedHeaders.length !== 2) {
      toast.error('Please select exactly 2 headers')
      return
    }

    setUploadingSampling(true)
    try {
      const formData = new FormData()
      formData.append('excelFile', samplingFile)
      formData.append('form_id', form_id)
      formData.append('primary_columns', selectedHeaders.join(','))

      const response = await fetch(`http://localhost:3000/api/control-forms/${form_id}/upload-sampling-excel`, {
        method: 'POST',
        credentials: 'include',
        body: formData,
      })

      const data = await response.json()

      if (response.ok && data.success) {
        toast.success('Sampling Excel file uploaded successfully')
        setSamplingDialogOpen(false)
        setSamplingFile(null)
        setSamplingHeaders([])
        setSelectedHeaders([])
        if (fileInputRef.current) {
          fileInputRef.current.value = ''
        }
        // Refresh form data to update sampling_doc field and disable the button
        fetchFormData()
      } else {
        toast.error(data.message || 'Failed to upload sampling Excel file')
      }
    } catch (error) {
      console.error('Error uploading sampling Excel file:', error)
      toast.error('Error uploading sampling Excel file')
    } finally {
      setUploadingSampling(false)
    }
  }

  const handleCloseSamplingDialog = () => {
    setSamplingDialogOpen(false)
    setSamplingFile(null)
    setSamplingHeaders([])
    setSelectedHeaders([])
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
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
    remarks: 'Remarks',
    findings: 'Findings',
    doc_uploaded_by_user: 'Doc Uploaded by User',
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
    'remarks',
    'findings',
    'doc_uploaded_by_user'
  ]

  // Fields to exclude from display
  const excludedFields = ['id', 'form_id', 'company_identifier', 'created_at', 'active', 'approved_rejected', 'reason_by_approver']

  // Fields that only approvers can edit (coordinator cannot edit these)
  const approverOnlyFields = ['effective_or_not_effective', 'remarks', 'checks_performed', 'findings']

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
          onClick={() => navigate('/company_co/dashboard')}
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
          Control Form
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
                {/* Form Status */}
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

                {/* Financial Year and Cycle */}
                <Box sx={{ pb: 1.5, mb: 2.5, borderBottom: '1px solid', borderColor: 'divider' }}>
                  <Box sx={{ display: 'flex', gap: 2.5, alignItems: 'flex-start' }}>
                    <Box sx={{ flex: 1 }}>
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
                        }}
                      >
                        {formData?.financial_year || '-'}
                      </Typography>
                    </Box>
                    <Box sx={{ flex: 1 }}>
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
                        Cycle
                      </Typography>
                      <Typography
                        variant="body2"
                        sx={{
                          color: 'text.primary',
                          fontWeight: 500,
                          fontSize: '0.9375rem',
                        }}
                      >
                        {formData?.cycle || '-'}
                      </Typography>
                    </Box>
                  </Box>
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

                {/* Approved/Rejected */}
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
                    Approval Status
                  </Typography>
                  <Typography
                    variant="body2"
                    sx={{
                      color: 'text.primary',
                      fontWeight: 500,
                      fontSize: '0.9375rem', lineHeight: 1.5,
                    }}
                  >
                    {formatStatus(formData?.status)}
                  </Typography>
                </Box>

                {/* Reason by Approver */}
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
                    {formData?.reason_by_approver || 'None'}
                  </Typography>
                </Box>

                {/* Modify Button */}
                {!isEditMode && (
                  <Box sx={{ mt: 1, pt: 2, pb: 2, }}>
                    <Button
                      onClick={handleModifyClick}
                      fullWidth
                      variant="contained"
                      color="secondary"
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
                        transition: 'all 0.2s ease-in-out',
                      }}
                    >
                      Modify
                    </Button>
                  </Box>
                )}

                {/* Upload Sampling Excel Button */}
                {!isEditMode && (
                  <Box sx={{ mt: 2 }}>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                      onChange={handleSamplingFileChange}
                      style={{ display: 'none' }}
                      disabled={formData?.sampling_doc && formData.sampling_doc.trim() !== ''}
                    />
                    <Button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={formData?.sampling_doc && formData.sampling_doc.trim() !== ''}
                      fullWidth
                      variant="outlined"
                      startIcon={formData?.sampling_doc && formData.sampling_doc.trim() !== '' ? <CheckCircleIcon /> : <CloudUploadIcon />}
                      sx={{
                        py: 1.75,
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
                          transform: 'translateY(-1px)',
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
                          transform: 'none',
                        },
                        transition: 'all 0.2s ease-in-out',
                      }}
                    >
                      {formData?.sampling_doc && formData.sampling_doc.trim() !== '' ? 'Sample Document Uploaded' : 'Upload Sampling Excel'}
                    </Button>
                  </Box>
                )}

                {/* Save/Cancel Buttons when in edit mode */}
                {isEditMode && (
                  <Box sx={{ mt: 1, pt: 3, pb: 2, borderTop: '2px solid', borderColor: 'divider', display: 'flex', gap: 2 }}>
                    <Button
                      onClick={handleCancelEdit}
                      disabled={saving}
                      fullWidth
                      variant="outlined"
                      sx={{
                        py: 1.75,
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
                        transition: 'all 0.2s ease-in-out',
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleSaveChanges}
                      disabled={saving}
                      fullWidth
                      variant="contained"
                      color="secondary"
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
                        transition: 'all 0.2s ease-in-out',
                      }}
                    >
                      {saving ? 'Saving...' : 'Save Changes'}
                    </Button>
                  </Box>
                )}

                {/* Toggle Button at Bottom */}
                <Box sx={{ mt: 2, pt: 3, borderTop: '2px solid', borderColor: 'divider' }}>
                  <Button
                    onClick={handleToggleActive}
                    disabled={updating || isEditMode}
                    fullWidth
                    variant="contained"
                    sx={{
                      py: 1.75,
                      fontWeight: 600,
                      textTransform: 'none',
                      fontSize: '0.9375rem',
                      borderRadius: 2,
                      ...(isActive ? {
                        backgroundColor: '#10b981',
                        color: '#ffffff',
                        boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)',
                        '&:hover': {
                          backgroundColor: '#059669',
                          boxShadow: '0 6px 16px rgba(16, 185, 129, 0.4)',
                          transform: 'translateY(-1px)',
                        },
                      } : {
                        backgroundColor: '#ef4444',
                        color: '#ffffff',
                        boxShadow: '0 4px 12px rgba(239, 68, 68, 0.3)',
                        '&:hover': {
                          backgroundColor: '#dc2626',
                          boxShadow: '0 6px 16px rgba(239, 68, 68, 0.4)',
                          transform: 'translateY(-1px)',
                        },
                      }),
                      ...(updating && {
                        opacity: 0.6,
                        cursor: 'not-allowed',
                        transform: 'none',
                      }),
                      ...(isEditMode && {
                        opacity: 0.5,
                        cursor: 'not-allowed',
                        transform: 'none',
                      }),
                      transition: 'all 0.2s ease-in-out',
                    }}
                  >
                    {updating ? 'Updating...' : (isActive ? 'Set Inactive' : 'Set Active')}
                  </Button>
                </Box>
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
                    // Coordinator cannot edit approver-only fields or doc_uploaded_by_user
                    const isEditable = isEditMode && key !== 'doc_uploaded_by_user' && !approverOnlyFields.includes(key)
                    const isTextArea = ['description_of_control', 'risk_description', 'control_objective', 'control_to_address', 'gap_description_resolution', 'source_data_report_logic_report_parameters', 'relevant_data_elements_of_ipe', 'docs_to_review_for_dms_audit', 'checks_performed', 'findings', 'remarks'].includes(key)

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
                        {!isEditable && (
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
                        )}
                        {isEditable ? (
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
            User with email <strong>{processOwnerEmail}</strong> does not exist in the system. Please create a user account to proceed with setting the form to active.
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
            sx={{
              textTransform: 'none',
              px: 3,
              py: 1,
              minWidth: '100px',
              fontWeight: 600,
              boxShadow: theme.palette.mode === 'dark'
                ? '0 4px 12px rgba(3, 105, 161, 0.3)'
                : '0 4px 12px rgba(3, 105, 161, 0.2)',
              '&:hover': {
                boxShadow: theme.palette.mode === 'dark'
                  ? '0 6px 16px rgba(3, 105, 161, 0.4)'
                  : '0 6px 16px rgba(3, 105, 161, 0.3)',
              },
            }}
          >
            Create User
          </Button>
        </DialogActions>
      </Dialog>

      {/* Sampling Excel Upload Dialog */}
      <Dialog
        open={samplingDialogOpen}
        onClose={handleCloseSamplingDialog}
        aria-labelledby="sampling-dialog-title"
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 2,
            minWidth: { xs: '90%', sm: '500px' },
            boxShadow: theme.palette.mode === 'dark'
              ? '0 8px 32px rgba(0, 0, 0, 0.4)'
              : '0 8px 32px rgba(0, 0, 0, 0.12)',
          },
        }}
      >
        <DialogTitle
          id="sampling-dialog-title"
          sx={{
            pb: 2.5,
            pt: 3,
            px: 3,
            fontWeight: 600,
            fontSize: '1.25rem',
            color: theme.palette.text.primary,
          }}
        >
          Select Primary Columns
        </DialogTitle>
        <DialogContent sx={{ px: 3, pt: 3, pb: 3 }}>
          <DialogContentText
            sx={{
              color: theme.palette.text.secondary,
              fontSize: '0.9375rem',
              lineHeight: 1.5,
              m: 0,
              mb: 3,
            }}
          >
            Please select exactly 2 columns from the Excel file headers to use as primary columns.
          </DialogContentText>
          {samplingFile && (
            <Typography variant="body2" sx={{ mb: 2, color: 'text.secondary' }}>
              File: {samplingFile.name}
            </Typography>
          )}
          <Box sx={{ maxHeight: '400px', overflowY: 'auto', mb: 2 }}>
            {samplingHeaders.length > 0 ? (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {samplingHeaders.map((header, index) => (
                  <FormControlLabel
                    key={index}
                    control={
                      <Checkbox
                        checked={selectedHeaders.includes(header)}
                        onChange={() => handleHeaderToggle(header)}
                        disabled={selectedHeaders.length >= 2 && !selectedHeaders.includes(header)}
                      />
                    }
                    label={String(header)}
                    sx={{
                      '& .MuiFormControlLabel-label': {
                        fontSize: '0.9375rem',
                      },
                    }}
                  />
                ))}
              </Box>
            ) : (
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                No headers found in the Excel file.
              </Typography>
            )}
          </Box>
          {selectedHeaders.length > 0 && (
            <Box sx={{ mt: 2, p: 2, bgcolor: 'action.selected', borderRadius: 1 }}>
              <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
                Selected Columns ({selectedHeaders.length}/2):
              </Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                {selectedHeaders.join(', ')}
              </Typography>
            </Box>
          )}
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
            onClick={handleCloseSamplingDialog}
            variant="outlined"
            disabled={uploadingSampling}
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
            onClick={handleSamplingUpload}
            variant="contained"
            color="secondary"
            disabled={uploadingSampling || selectedHeaders.length !== 2}
            autoFocus
            sx={{
              textTransform: 'none',
              px: 3,
              py: 1,
              minWidth: '100px',
              fontWeight: 600,
              boxShadow: theme.palette.mode === 'dark'
                ? '0 4px 12px rgba(3, 105, 161, 0.3)'
                : '0 4px 12px rgba(3, 105, 161, 0.2)',
              '&:hover': {
                boxShadow: theme.palette.mode === 'dark'
                  ? '0 6px 16px rgba(3, 105, 161, 0.4)'
                  : '0 6px 16px rgba(3, 105, 161, 0.3)',
              },
              '&:disabled': {
                opacity: 0.5,
              },
            }}
          >
            {uploadingSampling ? 'Uploading...' : 'Upload'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

export default FormDetail

