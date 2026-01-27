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

  // Financial year options
  const financialYearOptions = [
    '2024-25',
    '2025-26'
  ]

  // Cycle options
  const cycleOptions = [
    '1st',
    '2nd',
    '3rd'
  ]

  // Form state - all fields that coordinators can create
  const [formData, setFormData] = useState({
    business_process: '',
    financial_year: '',
    cycle: '',
    description_of_control: '',
    process: '',
    sub_process: '',
    risk_description: '',
    whether_fraud_risks_exist: '',
    control_objective: '',
    control_to_address: '',
    mrc_or_not: '',
    gap_description_resolution: '',
    source_data_report_logic_report_parameters: '',
    relevant_data_elements_of_ipe: '',
    type_of_control: '',
    nature_of_control: '',
    type_of_risk_mitigation_method: '',
    process_owner: '',
    reviewer_process_supervisor: '',
    control_frequency: '',
    basis_of_sampling: '',
    docs_to_review_for_dms_audit: '',
    type_of_risk_associated: '',
    financial_reporting: ''
  })

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

    if (!formData.cycle) {
      toast.error('Please select a cycle')
      return
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
        toast.success('Control form created successfully')
        navigate('/company_co/dashboard')
      } else {
        toast.error(data.message || 'Failed to create control form')
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
    'description_of_control',
    'risk_description',
    'control_objective',
    'control_to_address',
    'gap_description_resolution',
    'source_data_report_logic_report_parameters',
    'relevant_data_elements_of_ipe',
    'docs_to_review_for_dms_audit'
  ]

  // Field labels
  const fieldLabels = {
    business_process: 'Business Process',
    financial_year: 'Financial Year',
    cycle: 'Cycle',
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
    financial_reporting: 'Financial Reporting'
  }

  // Field order
  const fieldOrder = [
    'business_process',
    'financial_year',
    'cycle',
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
    'financial_reporting'
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
                color: theme.palette.secondary.main,
                flex: 1,
              }}
            >
              Create Control Form
            </Typography>
          </Box>

          <form onSubmit={handleSubmit}>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: {
                  xs: '1fr',
                  md: 'repeat(2, 1fr)',
                },
                gap: 3,
                mb: 3,
              }}
            >
              {fieldOrder.map((field) => {
                const label = fieldLabels[field] || field.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())
                const value = formData[field] || ''
                const isMultiline = multilineFields.includes(field)
                const isSelect = field === 'business_process' || field === 'financial_year' || field === 'cycle'

                if (isSelect) {
                  let options = []
                  if (field === 'business_process') {
                    options = businessProcessOptions
                  } else if (field === 'financial_year') {
                    options = financialYearOptions
                  } else if (field === 'cycle') {
                    options = cycleOptions
                  }

                  return (
                    <FormControl 
                      key={field}
                      fullWidth 
                      required
                      sx={{
                        gridColumn: {
                          xs: '1',
                          md: field === 'business_process' ? '1 / -1' : undefined
                        }
                      }}
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
                      gridColumn: isMultiline ? {
                        xs: '1',
                        md: '1 / -1'
                      } : undefined,
                    }}
                  />
                )
              })}
            </Box>

            {/* Submit and Cancel Buttons */}
            <Box sx={{ display: 'flex', gap: 2, mt: 4 }}>
              <Button
                type="button"
                onClick={() => navigate('/company_co/dashboard')}
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
                disabled={loading || !formData.business_process || !formData.financial_year || !formData.cycle}
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
                {loading ? 'Creating...' : 'Create Control Form'}
              </Button>
            </Box>
          </form>
        </Paper>
      </Box>
    </Box>
  )
}

export default CreateControlForm

