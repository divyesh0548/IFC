import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTheme } from '@mui/material/styles'
import Button from '@mui/material/Button'
import Box from '@mui/material/Box'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Alert from '@mui/material/Alert'

const twoColRowSx = {
  display: 'flex',
  flexDirection: { xs: 'column', sm: 'row' },
  gap: 2.5,
  width: '100%',
  '& > *': {
    flex: { xs: 'none', sm: '1 1 0' },
    minWidth: 0,
  },
}

function CompanyCreation() {
  const theme = useTheme()
  const isDark = theme.palette.mode === 'dark'
  const navigate = useNavigate()
  const [formData, setFormData] = useState({
    company_name: '',
    registered_email: '',
    registered_address: '',
    unique_identification_number: '',
    pan: '',
    gst: '',
    number_of_corporate_offices: '',
    number_of_factory_units: '',
    company_coordinator_email: ''
  })
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // GST Validation function
  const validateGST = (gst) => {
    if (!gst) return true // Allow empty for now
    
    // Check length
    if (gst.length !== 15) {
      return false
    }

    // Position 1-2: numeric
    if (!/^\d{2}/.test(gst)) {
      return false
    }

    // Position 3-13: alphanumeric (11 characters)
    if (!/^\d{2}[A-Z0-9]{11}/.test(gst)) {
      return false
    }

    // Position 14: "Z"
    if (gst[13] !== 'Z' && gst[13] !== 'z') {
      return false
    }

    // Position 15: digit
    if (!/^\d$/.test(gst[14])) {
      return false
    }

    // Full format validation
    if (!/^\d{2}[A-Z0-9]{11}[Zz]\d$/.test(gst)) {
      return false
    }

    return true
  }

  // Auto-fill PAN from GST
  const handleGSTChange = (e) => {
    const gstValue = e.target.value.toUpperCase()
    setFormData(prev => {
      const newData = { ...prev, gst: gstValue }
      
      // Auto-fill PAN from GST (positions 3-12 of GST = PAN)
      if (gstValue.length >= 12 && validateGST(gstValue)) {
        newData.pan = gstValue.substring(2, 12)
      } else if (gstValue.length < 12) {
        newData.pan = ''
      }
      
      return newData
    })

    // Validate GST
    if (gstValue && !validateGST(gstValue)) {
      setErrors(prev => ({
        ...prev,
        gst: 'Invalid GST number. Format: 2 digits + 11 alphanumeric + Z + 1 digit (15 characters total)'
      }))
    } else {
      setErrors(prev => {
        const newErrors = { ...prev }
        delete newErrors.gst
        return newErrors
      })
    }
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))

    // Clear error for this field
    if (errors[name]) {
      setErrors(prev => {
        const newErrors = { ...prev }
        delete newErrors[name]
        return newErrors
      })
    }
  }

  const validateForm = () => {
    const newErrors = {}

    if (!formData.company_name.trim()) {
      newErrors.company_name = 'Company name is required'
    }

    if (!formData.registered_email.trim()) {
      newErrors.registered_email = 'Registered email is required'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.registered_email)) {
      newErrors.registered_email = 'Invalid email format'
    }

    if (!formData.registered_address.trim()) {
      newErrors.registered_address = 'Registered address is required'
    }

    if (!formData.unique_identification_number.trim()) {
      newErrors.unique_identification_number = 'Unique Identification Number is required'
    } else if (!/^\d+$/.test(formData.unique_identification_number)) {
      newErrors.unique_identification_number = 'Must be a number'
    }

    if (!formData.gst.trim()) {
      newErrors.gst = 'GST number is required'
    } else if (!validateGST(formData.gst)) {
      newErrors.gst = 'Invalid GST number. Format: 2 digits + 11 alphanumeric + Z + 1 digit (15 characters total)'
    }

    if (!formData.number_of_corporate_offices.trim()) {
      newErrors.number_of_corporate_offices = 'Number of Corporate Offices is required'
    } else if (!/^\d+$/.test(formData.number_of_corporate_offices) || parseInt(formData.number_of_corporate_offices) < 0) {
      newErrors.number_of_corporate_offices = 'Must be a positive number'
    }

    if (!formData.number_of_factory_units.trim()) {
      newErrors.number_of_factory_units = 'Number of Factory Unit/Warehouse/Other Facilities is required'
    } else if (!/^\d+$/.test(formData.number_of_factory_units) || parseInt(formData.number_of_factory_units) < 0) {
      newErrors.number_of_factory_units = 'Must be a positive number'
    }

    // Validate company coordinator email if provided
    if (formData.company_coordinator_email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.company_coordinator_email)) {
      newErrors.company_coordinator_email = 'Invalid email format'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!validateForm()) {
      return
    }

    setLoading(true)

    try {
      const response = await fetch('http://localhost:3000/api/siteadmin/companies/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          company_name: formData.company_name,
          registered_email: formData.registered_email,
          registered_address: formData.registered_address,
          unique_identification_number: formData.unique_identification_number,
          gst: formData.gst,
          pan: formData.pan,
          number_of_corporate_offices: formData.number_of_corporate_offices,
          number_of_factory_units: formData.number_of_factory_units,
          company_coordinator_email: formData.company_coordinator_email || null
        })
      })

      const data = await response.json()

      if (response.ok && data.success) {
        alert(`Company created successfully! Company Identifier: ${data.company.company_identifier}`)
        navigate('/siteadmin/dashboard')
      } else {
        setError(data.message || 'Failed to create company')
      }
    } catch (err) {
      console.error('Company creation error:', err)
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Box
      sx={{
        width: '100%',
        maxWidth: '100%',
        minWidth: 0,
        mx: 0,
        px: 0,
        py: { xs: 2, sm: 3 },
        boxSizing: 'border-box',
      }}
    >
      <Card
        elevation={isDark ? 2 : 3}
        sx={{
          width: '100%',
          maxWidth: '100%',
          borderRadius: 2,
          border: 1,
          borderColor: 'divider',
          ...(isDark && {
            boxShadow: '0 4px 24px rgba(0, 0, 0, 0.35)',
          }),
        }}
      >
        <CardContent sx={{ p: { xs: 2, sm: 3 }, '&:last-child': { pb: { xs: 2, sm: 3 } } }}>
          <Typography
            variant="h4"
            component="h1"
            sx={{
              fontWeight: 700,
              mb: 1,
              textAlign: 'left',
              color: 'text.primary',
              letterSpacing: '-0.02em',
            }}
          >
            Create Company
          </Typography>
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ textAlign: 'left', mb: 3 }}
          >
            Add a new company profile. Fields marked with an asterisk are required.
          </Typography>

          <Box
            component="form"
            onSubmit={handleSubmit}
            sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, width: '100%' }}
          >
            <Box sx={twoColRowSx}>
              <TextField
                id="company_name"
                name="company_name"
                label="Company Name"
                variant="filled"
                value={formData.company_name}
                onChange={handleChange}
                required
                disabled={loading}
                placeholder="Enter company name"
                error={!!errors.company_name}
                helperText={errors.company_name}
                fullWidth
              />
              <TextField
                id="registered_email"
                name="registered_email"
                label="Registered Email"
                type="email"
                variant="filled"
                value={formData.registered_email}
                onChange={handleChange}
                required
                disabled={loading}
                placeholder="Enter registered email"
                error={!!errors.registered_email}
                helperText={errors.registered_email}
                fullWidth
              />
            </Box>

            <Box
              sx={{
                width: '100%',
                pt: 2.5,
                borderTop: 1,
                borderColor: 'divider',
              }}
            >
              <TextField
                id="registered_address"
                name="registered_address"
                label="Registered Address"
                variant="filled"
                value={formData.registered_address}
                onChange={handleChange}
                required
                disabled={loading}
                multiline
                minRows={3}
                placeholder="Enter registered address"
                error={!!errors.registered_address}
                helperText={errors.registered_address}
                fullWidth
              />
            </Box>

            <Box sx={twoColRowSx}>
              <TextField
                id="unique_identification_number"
                name="unique_identification_number"
                label="Unique Identification Number"
                type="number"
                variant="filled"
                value={formData.unique_identification_number}
                onChange={handleChange}
                required
                disabled={loading}
                placeholder="Enter unique identification number"
                error={!!errors.unique_identification_number}
                helperText={errors.unique_identification_number}
                fullWidth
              />
              <TextField
                id="gst"
                name="gst"
                label="GST"
                variant="filled"
                value={formData.gst}
                onChange={handleGSTChange}
                required
                disabled={loading}
                inputProps={{ maxLength: 15, style: { textTransform: 'uppercase' } }}
                placeholder="Enter GST number (15 characters)"
                error={!!errors.gst}
                helperText={
                  errors.gst ||
                  (formData.gst && formData.gst.length === 15 && !errors.gst
                    ? 'Valid GST format'
                    : '')
                }
                FormHelperTextProps={
                  formData.gst && formData.gst.length === 15 && !errors.gst
                    ? { sx: { color: 'success.main' } }
                    : undefined
                }
                fullWidth
                sx={{
                  '& input': {
                    textTransform: 'uppercase',
                  },
                }}
              />
            </Box>

            <Box sx={twoColRowSx}>
              <TextField
                id="pan"
                name="pan"
                label="PAN (Auto-filled from GST)"
                variant="filled"
                value={formData.pan}
                onChange={handleChange}
                disabled
                placeholder="Auto-filled from GST"
                fullWidth
                sx={{
                  '& input': {
                    textTransform: 'uppercase',
                  },
                  '& .MuiInputBase-root.Mui-disabled': {
                    bgcolor: 'action.hover',
                  },
                }}
              />
              <TextField
                id="company_coordinator_email"
                name="company_coordinator_email"
                label="Company Coordinator Email"
                type="email"
                variant="filled"
                value={formData.company_coordinator_email}
                onChange={handleChange}
                disabled={loading}
                placeholder="Enter company coordinator email (optional)"
                error={!!errors.company_coordinator_email}
                helperText={errors.company_coordinator_email}
                fullWidth
              />
            </Box>

            <Box sx={twoColRowSx}>
              <TextField
                id="number_of_corporate_offices"
                name="number_of_corporate_offices"
                label="Number of Corporate Offices"
                type="number"
                variant="filled"
                value={formData.number_of_corporate_offices}
                onChange={handleChange}
                required
                disabled={loading}
                inputProps={{ min: 0 }}
                placeholder="Enter number of corporate offices"
                error={!!errors.number_of_corporate_offices}
                helperText={errors.number_of_corporate_offices}
                fullWidth
              />
              <TextField
                id="number_of_factory_units"
                name="number_of_factory_units"
                label="Number of Factory Unit/Warehouse/Other Facilities"
                type="number"
                variant="filled"
                value={formData.number_of_factory_units}
                onChange={handleChange}
                required
                disabled={loading}
                inputProps={{ min: 0 }}
                placeholder="Enter number of factory units/warehouse/other facilities"
                error={!!errors.number_of_factory_units}
                helperText={errors.number_of_factory_units}
                fullWidth
              />
            </Box>

            {error && (
              <Alert severity="error" sx={{ mt: 0.5 }}>
                {error}
              </Alert>
            )}

            <Box sx={{ display: 'flex', justifyContent: 'flex-start', pt: 0.5 }}>
              <Button
                type="submit"
                size="medium"
                disabled={loading}
                variant="contained"
                color="primary"
                sx={{
                  py: 0.5,
                  px: 2,
                  minHeight: 36,
                  fontSize: theme.typography.customSizes.medium,
                  fontWeight: 600,
                }}
              >
                {loading ? 'Creating...' : 'Create Company'}
              </Button>
            </Box>
          </Box>
          </CardContent>
        </Card>
      </Box>
  )
}

export default CompanyCreation

