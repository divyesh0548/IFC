import React, { useState, useEffect } from 'react'
import { useTheme } from '@mui/material/styles'
import { useNavigate } from 'react-router-dom'
import Button from '@mui/material/Button'
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import TextField from '@mui/material/TextField'
import MenuItem from '@mui/material/MenuItem'
import FormControl from '@mui/material/FormControl'
import InputLabel from '@mui/material/InputLabel'
import Select from '@mui/material/Select'
import IconButton from '@mui/material/IconButton'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import { toast } from 'react-hot-toast'

function CreateControlForm() {
  const theme = useTheme()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [companyIdentifier, setCompanyIdentifier] = useState('')

  // Business process options
  const businessProcessOptions = [
    'Purchase to Pay',
    'Order to Cash',
    'Hire to Retire',
    'Capital Expenditure',
    'Treasury',
    'Financial Statement Closure Process',
    'Information Technology General Controls',
    'Entity Level Controls'
  ]

  // Financial year options - dynamically based on current year
  // Example: if current year is 2026 → [ '2025-26', '2026-27', '2027-28' ]
  const currentYear = new Date().getFullYear()
  const baseFYStart = currentYear - 1
  const financialYearOptions = Array.from({ length: 3 }, (_, i) => {
    const startYear = baseFYStart + i
    const endYearShort = String((startYear + 1) % 100).padStart(2, '0')
    return `${startYear}-${endYearShort}`
  })

  // Form state - all fields that coordinators can create
  const [formData, setFormData] = useState({
    business_process: '',
    financial_year: '',
    control_number: '',
    account_balance_disclosure: '',
    risk_heat: '',
    standard_control_description: '',
    sub_process: '',
    risk_description: '',
    whether_fraud_risks_exist: '',
    control_objective: '',
    process_walkthrough: '',
    control_relies_on_ipe: '',
    audit_evidence_accuracy: '',
    ipe_reference: '',
    key_control: '',
    application_name: '',
    control_performer: '',
    control_owner: '',
    control_design_procs: '',
    control_type_fo: '',
    control_type_ma: '',
    nature_of_control: '',
    process_owner: '',
    control_frequency: '',
    sample_size: '',
    completeness: '',
    existence_occurrence: '',
    rights_and_obligation: '',
    valuation_and_allocation: '',
    presentation_and_disclosure: ''
  })

  const dropdownOptions = {
  risk_heat: ['High', 'Low', 'Medium', 'Other'],
  control_type_fo: ['Financial', 'Operational', 'Other'],
  control_type_ma: ['Manual', 'Automated', 'Other'],
  nature_of_control: ['Preventive', 'Detective'],
  key_control: ['Yes', 'No', 'Other'],
    control_frequency: [
      'Yearly',
      'Quarterly',
      'Half Yearly',
      'Monthly',
      'Weekly',
      'Fortnightly',
      'As and When Needed',
      'Recurring and Periodic',
      'Recurring and Daily',
      'Daily',
    ],
    whether_fraud_risks_exist: ['Yes', 'No', 'Other']
  }

  const [dropdownSelections, setDropdownSelections] = useState({})
  const [otherValues, setOtherValues] = useState({})

  useEffect(() => {
    // Fetch user's company_identifier
    const fetchUserInfo = async () => {
      try {
        const response = await fetch('http://localhost:3000/api/auth/verify', {
          method: 'GET',
          credentials: 'include',
        })

        const data = await response.json()

        if (response.ok && data.success && data.user.company_identifier) {
          setCompanyIdentifier(data.user.company_identifier)
        }
      } catch (error) {
        console.error('Error fetching user info:', error)
      }
    }

    fetchUserInfo()
  }, [])

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleDropdownChange = (field, value) => {
    setDropdownSelections((prev) => ({
      ...prev,
      [field]: value
    }))

    if (value === 'Other') {
      setFormData((prev) => ({
        ...prev,
        [field]: otherValues[field] || ''
      }))
      return
    }

    setFormData((prev) => ({
      ...prev,
      [field]: value
    }))
  }

  const handleOtherValueChange = (field, value) => {
    setOtherValues((prev) => ({
      ...prev,
      [field]: value
    }))

    if (dropdownSelections[field] === 'Other') {
      setFormData((prev) => ({
        ...prev,
        [field]: value
      }))
    }
  }

  const validateEmail = (email) => {
    if (!email || email.trim() === '') {
      return false
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email.trim())
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!formData.business_process) {
      toast.error('Please select a business process')
      return
    }

    if (!formData.financial_year) {
      toast.error('Please select a financial year')
      return
    }

    // Validate Process Owner email if provided
    if (formData.process_owner && formData.process_owner.trim() !== '') {
      if (!validateEmail(formData.process_owner)) {
        toast.error('Please enter a valid email address for Process Owner')
        return
      }
    }

    setLoading(true)

    try {
      const response = await fetch('http://localhost:3000/api/control-forms', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          ...formData,
          company_identifier: companyIdentifier
        })
      })

      const data = await response.json()

      if (response.ok && data.success) {
        toast.success('RACM created successfully')
        navigate('/company_co/dashboard')
      } else {
        toast.error(data.message || 'Failed to create RACM')
      }
    } catch (err) {
      console.error('Create form error:', err)
      toast.error('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  // Fields that need multiline (text areas)
  const multilineFields = [
    'standard_control_description',
    'risk_description',
    'control_objective',
    'process_walkthrough',
    'audit_evidence_accuracy',
    'ipe_reference',
    'control_design_procs'
  ]

  // Field labels
  const fieldLabels = {
  business_process: 'Business Process',
  financial_year: 'Financial Year',
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
  completeness: 'Completeness',
  existence_occurrence: 'Existence & Occurrence',
  rights_and_obligation: 'Rights and Obligations',
  valuation_and_allocation: 'Valuation & Allocation',
  presentation_and_disclosure: 'Presentation and Disclosure'
  }

  // Field order – base order used inside sections
  const fieldOrder = [
    'business_process',
    'financial_year',
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
    'standard_control_description',
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
  ]

  return (
    <Box 
      sx={{ 
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center', 
        justifyContent: 'center', 
        minHeight: 'calc(100vh - 4rem)', 
        px: 2, 
        py: 4 
      }}
    >
      <Box sx={{ width: '100%', maxWidth: '1200px' }}>
        <Paper 
          elevation={3}
          sx={{
            p: 4,
            backgroundColor: theme.palette.background.paper,
            borderRadius: 2,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
            <IconButton
              onClick={() => navigate('/company_co/upload-excel')}
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
                color: theme.palette.secondary.main,
                flex: 1,
              }}
            >
              Create RACM
            </Typography>
          </Box>

          <form onSubmit={handleSubmit}>
            {/* Top section: Business Process & Financial Year */}
            <Box
              sx={{
                mb: 4,
                display: 'grid',
                gridTemplateColumns: {
                  xs: '1fr',
                  md: 'repeat(2, 1fr)',
                },
                gap: 3,
              }}
            >
              {['business_process', 'financial_year'].map((field) => {
                const label = fieldLabels[field]
                const value = formData[field] || ''
                const options = field === 'business_process' ? businessProcessOptions : financialYearOptions

                return (
                  <FormControl
                    key={field}
                    fullWidth
                    required
                  >
                    <InputLabel id={`${field}-label`}>{label}</InputLabel>
                    <Select
                      labelId={`${field}-label`}
                      id={field}
                      name={field}
                      value={value}
                      label={label}
                      onChange={handleChange}
                      variant="outlined"
                      disabled={loading}
                    >
                      {options.map((option) => (
                        <MenuItem key={option} value={option}>
                          {option}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                )
              })}
            </Box>

            {/* Process and risk section */}
            <Box
              sx={{
                mb: 4,
                borderTop: '2px solid',
                borderColor: 'divider',
                pt: 3,
              }}
            >
              <Typography
                variant="h6"
                component="h2"
                sx={{
                  fontWeight: 700,
                  mb: 3,
                  color: 'text.primary',
                  fontSize: '1.125rem',
                }}
              >
                Process and risk
              </Typography>
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
                {['control_number', 'account_balance_disclosure', 'sub_process', 'risk_heat', 'risk_description'].map((field) => {
                  const label = fieldLabels[field]
                  const value = formData[field] || ''
                  const isMultiline = multilineFields.includes(field)
                  const isConfiguredDropdown = Object.prototype.hasOwnProperty.call(dropdownOptions, field)

                  if (isConfiguredDropdown) {
                    const options = dropdownOptions[field]
                    const selectedValue = dropdownSelections[field] || (options.includes(value) ? value : '')
                    const isOtherSelected = selectedValue === 'Other'

                    return (
                      <Box key={field}>
                        <FormControl fullWidth disabled={loading}>
                          <InputLabel id={`${field}-label`}>{label}</InputLabel>
                          <Select
                            labelId={`${field}-label`}
                            id={field}
                            name={field}
                            value={selectedValue}
                            label={label}
                            onChange={(e) => handleDropdownChange(field, e.target.value)}
                            variant="outlined"
                          >
                            {options.map((option) => (
                              <MenuItem key={option} value={option}>
                                {option}
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                        {isOtherSelected && (
                          <TextField
                            sx={{ mt: 1.5 }}
                            fullWidth
                            label={`${label} (Other)`}
                            value={otherValues[field] || value || ''}
                            onChange={(e) => handleOtherValueChange(field, e.target.value)}
                            disabled={loading}
                          />
                        )}
                      </Box>
                    )
                  }

                  return (
                    <TextField
                      key={field}
                      name={field}
                      label={label}
                      value={value}
                      onChange={handleChange}
                      fullWidth
                      multiline={isMultiline}
                      rows={isMultiline ? 4 : 1}
                      variant="outlined"
                      disabled={loading}
                      sx={{
                        gridColumn: isMultiline
                          ? {
                              xs: '1',
                              md: '1 / -1',
                            }
                          : undefined,
                      }}
                    />
                  )
                })}
              </Box>
            </Box>

            {/* Assertions section */}
            <Box
              sx={{
                mb: 4,
                borderTop: '2px solid',
                borderColor: 'divider',
                pt: 3,
              }}
            >
              <Typography
                variant="h6"
                component="h2"
                sx={{
                  fontWeight: 700,
                  mb: 3,
                  color: 'text.primary',
                  fontSize: '1.125rem',
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
                }}
              >
                {['completeness', 'existence_occurrence', 'valuation_and_allocation', 'rights_and_obligation', 'presentation_and_disclosure'].map((field) => {
                  const label = fieldLabels[field]
                  const value = formData[field] || ''

                  return (
                    <TextField
                      key={field}
                      name={field}
                      label={label}
                      value={value}
                      onChange={handleChange}
                      fullWidth
                      variant="outlined"
                      disabled={loading}
                    />
                  )
                })}
              </Box>
            </Box>

            {/* Remaining fields section – Control */}
            <Box
              sx={{
                borderTop: '2px solid',
                borderColor: 'divider',
                pt: 3,
                mb: 3,
              }}
            >
              <Typography
                variant="h6"
                component="h2"
                sx={{
                  fontWeight: 700,
                  mb: 3,
                  color: 'text.primary',
                  fontSize: '1.125rem',
                }}
              >
                Control
              </Typography>
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
                  .filter((field) =>
                    !['business_process',
                      'financial_year',
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
                      'sample_size', // Exclude sample_size as it's computed automatically
                    ].includes(field)
                  )
                  .map((field) => {
                    const label = fieldLabels[field] || field.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())
                    const value = formData[field] || ''
                    const isMultiline = multilineFields.includes(field)
                    const isConfiguredDropdown = Object.prototype.hasOwnProperty.call(dropdownOptions, field)

                    if (isConfiguredDropdown) {
                      const options = dropdownOptions[field]
                      const selectedValue = dropdownSelections[field] || (options.includes(value) ? value : '')
                      const isOtherSelected = selectedValue === 'Other'

                      return (
                        <Box key={field}>
                          <FormControl fullWidth disabled={loading}>
                            <InputLabel id={`${field}-label`}>{label}</InputLabel>
                            <Select
                              labelId={`${field}-label`}
                              id={field}
                              name={field}
                              value={selectedValue}
                              label={label}
                              onChange={(e) => handleDropdownChange(field, e.target.value)}
                              variant="outlined"
                            >
                              {options.map((option) => (
                                <MenuItem key={option} value={option}>
                                  {option}
                                </MenuItem>
                              ))}
                            </Select>
                          </FormControl>
                          {isOtherSelected && (
                            <TextField
                              sx={{ mt: 1.5 }}
                              fullWidth
                              label={`${label} (Other)`}
                              value={otherValues[field] || value || ''}
                              onChange={(e) => handleOtherValueChange(field, e.target.value)}
                              disabled={loading}
                            />
                          )}
                        </Box>
                      )
                    }

                    return (
                      <TextField
                        key={field}
                        name={field}
                        label={label}
                        value={value}
                        onChange={handleChange}
                        fullWidth
                        multiline={isMultiline}
                        rows={isMultiline ? 4 : 1}
                        variant="outlined"
                        disabled={loading}
                        sx={{
                          gridColumn: isMultiline
                            ? {
                                xs: '1',
                                md: '1 / -1',
                              }
                            : undefined,
                        }}
                      />
                    )
                  })}
              </Box>
            </Box>

            {/* Submit and Cancel Buttons */}
            <Box sx={{ display: 'flex', gap: 2, mt: 4 }}>
              <Button
                type="button"
                onClick={() => navigate('/company_co/upload-excel')}
                variant="outlined"
                sx={{
                  flex: 1,
                  py: 1.5,
                  fontSize: theme.typography.customSizes.medium,
                  fontWeight: 600,
                  textTransform: 'none',
                  borderColor: theme.palette.mode === 'dark' 
                    ? 'rgba(255, 255, 255, 0.23)' 
                    : '#6b7280',
                  color: theme.palette.text.primary,
                  '&:hover': {
                    borderColor: theme.palette.mode === 'dark' 
                      ? 'rgba(255, 255, 255, 0.3)' 
                      : '#4b5563',
                    backgroundColor: theme.palette.mode === 'dark' 
                      ? 'rgba(255, 255, 255, 0.08)' 
                      : 'rgba(107, 114, 128, 0.08)',
                  },
                }}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={loading || !formData.business_process || !formData.financial_year}
                variant="contained"
                color="secondary"
                sx={{
                  flex: 1,
                  py: 1.5,
                  fontSize: theme.typography.customSizes.medium,
                  fontWeight: 600,
                  textTransform: 'none',
                }}
              >
                {loading ? 'Creating...' : 'Create RACM'}
              </Button>
            </Box>
          </form>
        </Paper>
      </Box>
    </Box>
  )
}

export default CreateControlForm

