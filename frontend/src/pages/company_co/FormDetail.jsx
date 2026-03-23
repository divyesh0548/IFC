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
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import Autocomplete from '@mui/material/Autocomplete';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import DeleteIcon from '@mui/icons-material/Delete';
import { toast } from 'react-hot-toast'
import { FORM_DETAIL_MAX_WIDTH } from '../../uiConstants'

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
  const [uploadingSampling, setUploadingSampling] = useState(false)
  const [samplingExists, setSamplingExists] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
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
  const [selectedUser, setSelectedUser] = useState(null)
  const [userSearchText, setUserSearchText] = useState('')
  const [processOwnerName, setProcessOwnerName] = useState('-')
  const [sampleMissingDialogOpen, setSampleMissingDialogOpen] = useState(false)

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
        // Check if sampling document exists
        const samplingCheck = await checkSamplingExists()
        setSamplingExists(samplingCheck)
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

    // If setting to active and sample document is missing, show confirmation dialog first
    if (
      newActiveStatus === '1' &&
      (!formData.sample_doc || formData.sample_doc.trim() === '')
    ) {
      setSampleMissingDialogOpen(true)
      return
    }

    await validateAndToggleActive(newActiveStatus)
  }

  const validateAndToggleActive = async (newActiveStatus) => {
    // Only validate when setting to active
    if (newActiveStatus === '1') {
      // Check if required fields are empty
      const dueDate = formData.due_date?.trim()
      const reminderFrequency = formData.reminder_frequency?.trim()
      const processOwnerEmailValue = formData.process_owner?.trim()

      // 1) If process owner is missing, show assignment message regardless of other fields
      if (!processOwnerEmailValue || processOwnerEmailValue === '') {
        toast.error('RACM Assignment is remaining')
        return
      }

      // 2) If process owner is present but reminder settings are missing, show reminder message
      if (!dueDate || dueDate === '' || !reminderFrequency || reminderFrequency === '') {
        toast.error('Configure Reminder settings')
        return
      }

      // Check if process owner exists
      if (processOwnerEmailValue) {
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
    navigate(`/company_co/user-management?email=${encodeURIComponent(processOwnerEmail)}`)
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

  const formatDateForInput = (dateValue) => {
    if (!dateValue) return ''
    const date = new Date(dateValue)
    if (Number.isNaN(date.getTime())) return ''
    return date.toISOString().split('T')[0]
  }

  const getTomorrowDateString = () => {
    const now = new Date()
    const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
    return tomorrow.toISOString().split('T')[0]
  }

  const parseReminderFrequency = (value) => {
    const frequency = String(value || '').trim()
    const customMatch = frequency.match(/^Every\s+(\d+)\s+Days$/i)

    if (customMatch) {
      return {
        reminder_frequency: 'Other',
        custom_days: customMatch[1]
      }
    }

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
    const dueDateValue = scheduleFields.due_date ? scheduleFields.due_date.trim() : ''
    const frequencySelection = scheduleFields.reminder_frequency
    const customDays = scheduleFields.custom_days ? scheduleFields.custom_days.trim() : ''
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

    let reminderFrequencyValue = frequencySelection
    if (frequencySelection === 'Other') {
      const parsedDays = parseInt(customDays, 10)
      if (!customDays || Number.isNaN(parsedDays) || parsedDays <= 0) {
        toast.error('Please enter valid custom reminder days')
        return
      }
      reminderFrequencyValue = `Every ${parsedDays} Days`
    }

    setSavingSchedule(true)
    try {
      const response = await fetch(`http://localhost:3000/api/control-forms/${form_id}`, {
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
      const response = await fetch('http://localhost:3000/api/company-co/users', {
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

  const assignableUsers = companyUsers.filter((user) => {
    const formCompany = (formData?.company_identifier || '').trim()
    const userCompany = (user.company_identifier || '').trim()
    const isSameCompany = !userCompany || userCompany === formCompany
    return isSameCompany && user.role === 'user'
  })

  const handleOpenAssignmentDialog = async () => {
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
    if (!form_id || !selectedUser?.email_id) return

    setUpdating(true)
    try {
      const response = await fetch(`http://localhost:3000/api/control-forms/${form_id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          process_owner: selectedUser.email_id,
          modifiedFields: ['process_owner'],
        }),
      })

      const data = await response.json()
      if (response.ok && data.success) {
        toast.success('Sucessfully Updated RACM Assignment')
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

  // Ensure company users are loaded when we have a process owner (for name lookup)
  useEffect(() => {
    if (formData?.process_owner && companyUsers.length === 0) {
      fetchCompanyUsers()
    }
  }, [formData?.process_owner]) // eslint-disable-line react-hooks/exhaustive-deps

  // Derive process owner display name from company users using email_id
  useEffect(() => {
    const email = (formData?.process_owner || '').trim().toLowerCase()
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
  }, [formData?.process_owner, companyUsers])

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
    fieldOrder.forEach(key => {
      if (!excludedFields.includes(key) && key !== 'doc_uploaded_by_user' && !approverOnlyFields.includes(key)) {
        const originalValue = formData[key] || ''
        const newValue = editableFields[key] || ''
        // Compare values (convert to string for comparison)
        if (String(originalValue).trim() !== String(newValue).trim()) {
          modifiedFields.push(key)
        }
      }
    })

    setSaving(true)
    try {
      const response = await fetch(`http://localhost:3000/api/control-forms/${form_id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          ...editableFields,
          modifiedFields: modifiedFields // Send modified fields list
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

  const checkSamplingExists = async () => {
    try {
      const response = await fetch(`http://localhost:3000/api/control-forms/${form_id}/check-sampling-exists`, {
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

  const handleSamplingUploadClick = async () => {
    // Quick check: if sample_doc is already set in formData, show message immediately
    if (formData?.sample_doc && formData.sample_doc.trim() !== '') {
      toast.error('Sample document already uploaded for this form.')
      // Reload formData after 1.5 seconds
      setTimeout(() => {
        fetchFormData()
      }, 1500)
      return
    }

    // Check if sampling document already exists
    const exists = await checkSamplingExists()
    if (exists) {
      setSamplingExists(exists)
      toast.error('Sample document already uploaded for this form.')
      // Reload formData after 1.5 seconds
      setTimeout(() => {
        fetchFormData()
      }, 1500)
      return
    }

    // If no existing document, proceed with file selection
    fileInputRef.current?.click()
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

    // Upload file directly
    setSamplingFile(file)
    await handleSamplingUpload(file)
  }

  const handleSamplingUpload = async (file) => {
    if (!file) {
      toast.error('Please select a file')
      return
    }

    setUploadingSampling(true)
    try {
      const uploadFormData = new FormData()
      uploadFormData.append('excelFile', file)

      const response = await fetch(`http://localhost:3000/api/control-forms/${form_id}/upload-sampling-excel`, {
        method: 'POST',
        credentials: 'include',
        body: uploadFormData,
      })

      const data = await response.json()

      if (response.ok && data.success) {
        toast.success('Sample document uploaded successfully')
        setSamplingFile(null)
        if (fileInputRef.current) {
          fileInputRef.current.value = ''
        }
        // Update local state immediately to disable the button without waiting for refetch
        setFormData(prev => ({
          ...prev,
          sample_doc: data.data?.sample_doc || prev?.sample_doc || 'uploaded'
        }))
        setSamplingExists(true)
        // Refresh form data to ensure everything is in sync
        fetchFormData()
      } else {
        toast.error(data.message || 'Failed to upload sampling Excel file')
        setSamplingFile(null)
        if (fileInputRef.current) {
          fileInputRef.current.value = ''
        }
      }
    } catch (error) {
      console.error('Error uploading sampling Excel file:', error)
      toast.error('Error uploading sampling Excel file')
      setSamplingFile(null)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    } finally {
      setUploadingSampling(false)
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
      const response = await fetch(`http://localhost:3000/api/control-forms/${form_id}`, {
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
    control_type_fo: 'Type of control (Operational/Financial)',
    control_type_ma: 'Type of control (Manual/ Automated)',
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
    active: 'Active',
    approved_rejected: 'Approved/Rejected',
    reason_by_approver: 'Reason by Approver',
  }

  // Display order for updated RACM schema
  const fieldOrder = [
    'control_number',
    'account_balance_disclosure',
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
    'doc_uploaded_by_user'
  ]

  // Fields to exclude from display
  const excludedFields = ['id', 'form_id', 'company_identifier', 'created_at', 'active', 'approved_rejected', 'reason_by_approver']

  // Fields that only approvers can edit (coordinator cannot edit these)
  const approverOnlyFields = ['control_design_conclusion', 'design_deficiency_desc']
  
  // Grouped fields that should be displayed together (only if at least one has a value)
  const groupedApproverFields = ['control_design_procs', 'control_design_conclusion', 'design_deficiency_desc']
  
  // Check if at least one grouped field has a value
  const hasGroupedFieldValue = formData ? groupedApproverFields.some(key => {
    const value = formData[key]
    return value !== null && value !== undefined && value !== '' && String(value).trim() !== ''
  }) : false

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

  const isActive = formData?.active && formData.active !== '' && formData.active !== '0'

  return (
    <Box
      sx={{
        width: '100%',
        maxWidth: FORM_DETAIL_MAX_WIDTH,
        mx: 'auto',
        px: { xs: 2, sm: 3, md: 4 },
        py: 3,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 4, position: 'relative' }}>
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
          RACM
        </Typography>
        {/* When in edit mode: Cancel & Save Changes at top-right (replacing Delete position) */}
        {isEditMode && (
          <Box
            sx={{
              position: 'absolute',
              right: 0,
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
              pt: 4,
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

                {/* Reminder Settings + RACM Assignment (50/50, aligned) */}
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' },
                    gap: 3,
                    alignItems: 'flex-start',
                  }}
                >
                  {/* Reminder Settings */}
                  {!isEditMode && (
                    <Box
                      sx={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 1.5,
                      }}
                    >
                      <Typography
                        variant="caption"
                        component="label"
                        sx={{
                          display: 'block',
                          fontWeight: 600,
                          mb: 1.5,
                          color: 'text.secondary',
                          fontSize: '0.75rem',
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px',
                        }}
                      >
                        Reminder Settings
                      </Typography>

                      <Box
                        sx={{
                          display: 'grid',
                          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' },
                          gap: 1.5,
                          alignItems: 'center',
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
                        />

                        <FormControl fullWidth size="small">
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
                            <MenuItem value="Other">Other</MenuItem>
                          </Select>
                        </FormControl>
                      </Box>

                      {scheduleFields.reminder_frequency === 'Other' && (
                        <TextField
                          type="number"
                          label="Custom Days"
                          value={scheduleFields.custom_days}
                          onChange={(e) => handleScheduleFieldChange('custom_days', e.target.value)}
                          fullWidth
                          size="small"
                          inputProps={{ min: 1 }}
                          sx={{ mb: 1.5 }}
                        />
                      )}

                      {(
                        scheduleFields.due_date !== formatDateForInput(formData?.due_date) ||
                        scheduleFields.reminder_frequency !== parseReminderFrequency(formData.reminder_frequency).reminder_frequency ||
                        (scheduleFields.reminder_frequency === 'Other' &&
                          scheduleFields.custom_days !== parseReminderFrequency(formData.reminder_frequency).custom_days)
                      ) && (
                        <Button
                          onClick={handleSaveSchedule}
                          disabled={savingSchedule}
                          fullWidth
                          variant="outlined"
                          size="small"
                          sx={{
                            textTransform: 'none',
                            fontWeight: 600,
                            borderRadius: 2,
                          }}
                        >
                          {savingSchedule ? 'Saving...' : 'Save Reminder Settings'}
                        </Button>
                      )}
                    </Box>
                  )}

                  {/* RACM Assignment */}
                  <Box
                    sx={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 1.5,
                    }}
                  >
                    <Typography
                      variant="caption"
                      component="label"
                      sx={{
                        display: 'block',
                        fontWeight: 600,
                        mb: 1.5,
                        color: 'text.secondary',
                        fontSize: '0.75rem',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                      }}
                    >
                      RACM Assignment
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <Button
                        onClick={handleOpenAssignmentDialog}
                        fullWidth
                        variant="outlined"
                        size="medium"
                        sx={{
                          textTransform: 'none',
                          fontWeight: 600,
                          borderRadius: 1,
                          padding:0.8
                        }}
                      >
                        RACM Assignment
                      </Button>
                    </Box>
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
                    disabled={isEditMode}
                    variant="contained"
                    color="secondary"
                    sx={{
                      width: '100%',
                      py: 1.5,
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
                      ...(isEditMode && {
                        opacity: 0.5,
                        cursor: 'not-allowed',
                        transform: 'none',
                      }),
                      transition: 'all 0.2s ease-in-out',
                    }}
                  >
                    Modify
                  </Button>

                  {/* Upload Sampling Excel */}
                  <Box sx={{ width: '100%' }}>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                      onChange={handleSamplingFileChange}
                      style={{ display: 'none' }}
                      disabled={(formData?.sample_doc && formData.sample_doc.trim() !== '') || samplingExists || uploadingSampling}
                    />
                    <Button
                      onClick={handleSamplingUploadClick}
                      disabled={(formData?.sample_doc && formData.sample_doc.trim() !== '') || samplingExists || uploadingSampling || isEditMode}
                      fullWidth
                      variant="outlined"
                      startIcon={(formData?.sample_doc && formData.sample_doc.trim() !== '') || samplingExists ? <CheckCircleIcon /> : <CloudUploadIcon />}
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
                      {uploadingSampling ? 'Uploading...' : ((formData?.sample_doc && formData.sample_doc.trim() !== '') || samplingExists ? 'Sample Document Uploaded' : 'Upload Sample Document')}
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

                  {/* Delete - same row as other actions */}
                  <Button
                    onClick={handleDeleteClick}
                    variant="outlined"
                    color="error"
                    startIcon={<DeleteIcon />}
                    disabled={isEditMode}
                    sx={{
                      width: '100%',
                      py: 1.5,
                      fontWeight: 600,
                      textTransform: 'none',
                      fontSize: '0.9375rem',
                      borderRadius: 2,
                      borderWidth: 1.5,
                      '&:hover': {
                        borderWidth: 1.5,
                        backgroundColor: theme.palette.mode === 'dark'
                          ? 'rgba(211, 47, 47, 0.1)'
                          : 'rgba(211, 47, 47, 0.05)',
                      },
                      ...(isEditMode && {
                        opacity: 0.5,
                        cursor: 'not-allowed',
                      }),
                    }}
                  >
                    Delete
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
                {['control_number', 'account_balance_disclosure', 'sub_process', 'risk_description', 'risk_heat'].map((key) => {
                  if (!formData.hasOwnProperty(key) || excludedFields.includes(key)) return null

                  const label = fieldLabels[key] || key.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())
                  const value = formData[key]
                  const isEmpty = value === null || value === undefined || value === ''
                  const isEditable = isEditMode && key !== 'doc_uploaded_by_user' && !approverOnlyFields.includes(key)
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
                  const isEmpty = value === null || value === undefined || value === ''
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
                        <TextField
                          label={label}
                          variant="outlined"
                          value={editableFields[key] || ''}
                          onChange={(e) => handleFieldChange(key, e.target.value)}
                          fullWidth
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
                {fieldOrder
                  .filter((key) => {
                    if (groupedApproverFields.includes(key)) return false
                    // already shown in Process and risk / Assertions
                    if (
                      [
                        'control_number',
                        'account_balance_disclosure',
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
                  })
                  .map((key) => {
                    const label = fieldLabels[key] || key.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())
                    const value = formData[key]
                    const isEmpty = value === null || value === undefined || value === ''
                    const isEditable = isEditMode && key !== 'doc_uploaded_by_user' && !approverOnlyFields.includes(key)
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
                        ) : (
                          <Box>
                            {key === 'process_owner' ? (
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
                            )}
                          </Box>
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

          {/* Approval section – doc/remarks/reason */}
          {(formData.doc_uploaded_by_user || formData.remarks_by_user || formData.reason_by_approver) && (
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
                  {/* Doc Uploaded By User */}
                  {formData.doc_uploaded_by_user && (
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
                        {String(formData.doc_uploaded_by_user)}
                      </Typography>
                    </Box>
                  )}

                  {/* Remarks By User if present on payload */}
                  {typeof formData.remarks_by_user !== 'undefined' && (
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
                        Remarks By User
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
                  )}

                  {/* Reason by Approver - show only when non-empty */}
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

      {/* RACM Assignment Dialog */}
      <Dialog
        open={assignmentDialogOpen}
        onClose={handleCloseAssignmentDialog}
        aria-labelledby="racm-assignment-dialog-title"
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
              <Typography variant="body2">
                <strong>Standard Control Description:</strong>{' '}
                {formData.standard_control_description || 'N/A'}
              </Typography>
              <Typography variant="body2">
                <strong>Business Process:</strong> {formData.business_process || 'N/A'}
              </Typography>
              <Typography variant="body2">
                <strong>Financial Year:</strong> {formData.financial_year || 'N/A'}
              </Typography>
              <Typography variant="body2">
                <strong>Current Process Owner Email:</strong>{' '}
                {formData.process_owner || '-'}
              </Typography>
              <Typography variant="body2" sx={{ mb: 2 }}>
                <strong>Current Process Owner Name:</strong>{' '}
                {formData.process_owner_name || '-'}
              </Typography>

              <Autocomplete
                options={assignableUsers}
                loading={usersLoading}
                value={selectedUser}
                inputValue={userSearchText}
                onInputChange={(_, newInputValue) => setUserSearchText(newInputValue)}
                onChange={(_, newValue) => setSelectedUser(newValue)}
                getOptionLabel={(option) => option?.emp_name || option?.email_id || ''}
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
                      <Typography variant="body2">{option.emp_name || '-'}</Typography>
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

      {/* Sample Missing Confirmation Dialog */}
      <Dialog
        open={sampleMissingDialogOpen}
        onClose={() => setSampleMissingDialogOpen(false)}
        aria-labelledby="sample-missing-dialog-title"
        aria-describedby="sample-missing-dialog-description"
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
          id="sample-missing-dialog-title"
          sx={{
            pb: 2.5,
            pt: 3,
            px: 3,
            fontWeight: 600,
            fontSize: '1.25rem',
            color: theme.palette.text.primary,
          }}
        >
          Sample Document Missing
        </DialogTitle>
        <DialogContent sx={{ px: 3, pt: 3, pb: 3 }}>
          <DialogContentText
            id="sample-missing-dialog-description"
            sx={{
              color: theme.palette.text.secondary,
              fontSize: '0.9375rem',
              lineHeight: 1.5,
              m: 0,
              mb: 2,
            }}
          >
            Sample document is missing for this RACM. Are you sure you want to set this RACM to Active?
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
            onClick={() => setSampleMissingDialogOpen(false)}
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
            onClick={async () => {
              setSampleMissingDialogOpen(false)
              await validateAndToggleActive('1')
            }}
            variant="contained"
            color="secondary"
            autoFocus
            sx={{
              textTransform: 'none',
              px: 3,
              py: 1,
              minWidth: '120px',
              fontWeight: 600,
            }}
          >
            Yes, Set Active
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
            Are you sure you want to delete this RACM? This action cannot be undone and will permanently delete the form and all associated data.
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
              boxShadow: theme.palette.mode === 'dark'
                ? '0 4px 12px rgba(211, 47, 47, 0.3)'
                : '0 4px 12px rgba(211, 47, 47, 0.2)',
              '&:hover': {
                boxShadow: theme.palette.mode === 'dark'
                  ? '0 6px 16px rgba(211, 47, 47, 0.4)'
                  : '0 6px 16px rgba(211, 47, 47, 0.3)',
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
    </Box>
  )
}

export default FormDetail

