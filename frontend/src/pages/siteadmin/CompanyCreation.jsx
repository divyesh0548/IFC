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
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import AddIcon from '@mui/icons-material/Add'
import DeleteIcon from '@mui/icons-material/Delete'
import { toast } from 'react-hot-toast'
import { useSyncGlobalLoading } from '../../contexts/GlobalLoadingContext'
import { apiUrl } from '../../config/api'

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
  })
  const [companyUnits, setCompanyUnits] = useState([{ unit_name: 'Main Unit', unit_address: '' }])
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  useSyncGlobalLoading(loading)

  const validateGST = (gst) => {
    if (!gst) return true
    if (gst.length !== 15) return false
    if (!/^\d{2}/.test(gst)) return false
    if (!/^\d{2}[A-Z0-9]{11}/.test(gst)) return false
    if (gst[13] !== 'Z' && gst[13] !== 'z') return false
    if (!/^\d$/.test(gst[14])) return false
    return /^\d{2}[A-Z0-9]{11}[Zz]\d$/.test(gst)
  }

  const handleGSTChange = (e) => {
    const gstValue = e.target.value.toUpperCase()
    setFormData((prev) => {
      const next = { ...prev, gst: gstValue }
      if (gstValue.length >= 12 && validateGST(gstValue)) {
        next.pan = gstValue.substring(2, 12)
      } else if (gstValue.length < 12) {
        next.pan = ''
      }
      return next
    })

    if (gstValue && !validateGST(gstValue)) {
      setErrors((prev) => ({
        ...prev,
        gst: 'Invalid GST number. Format: 2 digits + 11 alphanumeric + Z + 1 digit (15 characters total)',
      }))
    } else {
      setErrors((prev) => {
        const next = { ...prev }
        delete next.gst
        return next
      })
    }
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
    if (errors[name]) {
      setErrors((prev) => {
        const next = { ...prev }
        delete next[name]
        return next
      })
    }
  }

  const handleUnitChange = (index, field, value) => {
    setCompanyUnits((prev) => prev.map((unit, unitIndex) => (
      unitIndex === index ? { ...unit, [field]: value } : unit
    )))

    const errorKey = `company_units_${index}_${field}`
    if (errors[errorKey]) {
      setErrors((prev) => {
        const next = { ...prev }
        delete next[errorKey]
        return next
      })
    }
  }

  const handleAddUnit = () => {
    setCompanyUnits((prev) => [...prev, { unit_name: '', unit_address: '' }])
  }

  const handleRemoveUnit = (index) => {
    setCompanyUnits((prev) => prev.filter((_, unitIndex) => unitIndex !== index))
  }

  const validateForm = () => {
    const newErrors = {}

    if (!formData.company_name.trim()) newErrors.company_name = 'Company name is required'
    if (!formData.registered_email.trim()) {
      newErrors.registered_email = 'Registered email is required'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.registered_email)) {
      newErrors.registered_email = 'Invalid email format'
    }
    if (!formData.registered_address.trim()) newErrors.registered_address = 'Registered address is required'
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
    } else if (!/^\d+$/.test(formData.number_of_corporate_offices) || parseInt(formData.number_of_corporate_offices, 10) < 0) {
      newErrors.number_of_corporate_offices = 'Must be a positive number'
    }
    if (!formData.number_of_factory_units.trim()) {
      newErrors.number_of_factory_units = 'Number of Factory Unit/Warehouse/Other Facilities is required'
    } else if (!/^\d+$/.test(formData.number_of_factory_units) || parseInt(formData.number_of_factory_units, 10) < 0) {
      newErrors.number_of_factory_units = 'Must be a positive number'
    }
    if (companyUnits.length === 0) newErrors.company_units = 'At least one company unit is required'

    companyUnits.forEach((unit, index) => {
      if (!unit.unit_name.trim()) {
        newErrors[`company_units_${index}_unit_name`] = 'Unit is required'
      }
    })
    if (companyUnits.some((unit) => !unit.unit_name.trim())) {
      newErrors.company_units = 'At least one unit is required and unit name cannot be empty'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const createCompany = async () => {
    setLoading(true)
    setError('')

    try {
      const response = await fetch(apiUrl('/api/siteadmin/companies/create'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
          company_units: companyUnits.map((unit) => ({
            unit_name: unit.unit_name.trim(),
            unit_address: unit.unit_address.trim(),
          })),
        }),
      })

      const data = await response.json()

      if (response.ok && data.success) {
        toast.success('Company created successfully')
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

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!validateForm()) return
    await createCompany()
  }

  return (
    <Box sx={{ width: '100%', maxWidth: '100%', minWidth: 0, mx: 0, px: 0, py: { xs: 2, sm: 3 }, boxSizing: 'border-box' }}>
      <Card
        elevation={isDark ? 2 : 3}
        sx={{
          width: '100%',
          maxWidth: '100%',
          borderRadius: 2,
          border: 1,
          borderColor: 'divider',
          ...(isDark && { boxShadow: '0 4px 24px rgba(0, 0, 0, 0.35)' }),
        }}
      >
        <CardContent sx={{ p: { xs: 2, sm: 3 }, '&:last-child': { pb: { xs: 2, sm: 3 } } }}>
          <Typography variant="h4" component="h1" sx={{ fontWeight: 700, mb: 1, textAlign: 'left', color: 'text.primary', letterSpacing: '-0.02em' }}>
            Create Company
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'left', mb: 3 }}>
            Add a new company profile. Coordinator and approver assignments can be configured after the company is created.
          </Typography>

          <Box component="form" onSubmit={handleSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, width: '100%' }}>
            <Box sx={twoColRowSx}>
              <TextField id="company_name" name="company_name" label="Company Name" variant="filled" value={formData.company_name} onChange={handleChange} required disabled={loading} placeholder="Enter company name" error={!!errors.company_name} helperText={errors.company_name} fullWidth />
              <TextField id="registered_email" name="registered_email" label="Registered Email" type="email" variant="filled" value={formData.registered_email} onChange={handleChange} required disabled={loading} placeholder="Enter registered email" error={!!errors.registered_email} helperText={errors.registered_email} fullWidth />
            </Box>

            <Box sx={{ width: '100%', pt: 2.5, borderTop: 1, borderColor: 'divider' }}>
              <TextField id="registered_address" name="registered_address" label="Registered Address" variant="filled" value={formData.registered_address} onChange={handleChange} required disabled={loading} multiline minRows={3} placeholder="Enter registered address" error={!!errors.registered_address} helperText={errors.registered_address} fullWidth />
            </Box>

            <Box sx={{ width: '100%', pt: 2.5, borderTop: 1, borderColor: 'divider', display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1.5 }}>
                <Box>
                  <Typography sx={{ fontWeight: 700, color: 'text.primary' }}>Company Units</Typography>
                  <Typography variant="body2" color="text.secondary">Add one or more company units. Unit address is optional.</Typography>
                </Box>
                <Tooltip title="Add unit">
                  <span>
                    <IconButton color="primary" onClick={handleAddUnit} disabled={loading} aria-label="Add company unit">
                      <AddIcon />
                    </IconButton>
                  </span>
                </Tooltip>
              </Box>

              {companyUnits.map((unit, index) => (
                <Box
                  key={`company-unit-${index}`}
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', md: 'minmax(180px, 0.8fr) minmax(240px, 1.2fr) auto' },
                    gap: 1.5,
                    alignItems: 'flex-start',
                  }}
                >
                  <TextField
                    id={`company_unit_name_${index}`}
                    label="Unit"
                    variant="filled"
                    value={unit.unit_name}
                    onChange={(e) => handleUnitChange(index, 'unit_name', e.target.value)}
                    required
                    disabled={loading}
                    placeholder="Enter unit name"
                    error={!!errors[`company_units_${index}_unit_name`]}
                    helperText={errors[`company_units_${index}_unit_name`]}
                    fullWidth
                  />
                  <TextField
                    id={`company_unit_address_${index}`}
                    label="Unit Address"
                    variant="filled"
                    value={unit.unit_address}
                    onChange={(e) => handleUnitChange(index, 'unit_address', e.target.value)}
                    disabled={loading}
                    multiline
                    minRows={1}
                    placeholder="Enter unit address (optional)"
                    fullWidth
                  />
                  <Tooltip title={companyUnits.length === 1 ? 'At least one unit is required' : 'Remove unit'}>
                    <span>
                      <IconButton color="error" onClick={() => handleRemoveUnit(index)} disabled={loading || companyUnits.length === 1} aria-label={`Remove company unit ${index + 1}`} sx={{ mt: 1 }}>
                        <DeleteIcon />
                      </IconButton>
                    </span>
                  </Tooltip>
                </Box>
              ))}

              {errors.company_units && (
                <Typography variant="caption" color="error">
                  {errors.company_units}
                </Typography>
              )}
            </Box>

            <Box sx={twoColRowSx}>
              <TextField id="unique_identification_number" name="unique_identification_number" label="Unique Identification Number" type="number" variant="filled" value={formData.unique_identification_number} onChange={handleChange} required disabled={loading} placeholder="Enter unique identification number" error={!!errors.unique_identification_number} helperText={errors.unique_identification_number} fullWidth />
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
                helperText={errors.gst || (formData.gst && formData.gst.length === 15 && !errors.gst ? 'Valid GST format' : '')}
                FormHelperTextProps={formData.gst && formData.gst.length === 15 && !errors.gst ? { sx: { color: 'success.main' } } : undefined}
                fullWidth
                sx={{ '& input': { textTransform: 'uppercase' } }}
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
                  '& input': { textTransform: 'uppercase' },
                  '& .MuiInputBase-root.Mui-disabled': { bgcolor: 'action.hover' },
                }}
              />
              <TextField id="number_of_corporate_offices" name="number_of_corporate_offices" label="Number of Corporate Offices" type="number" variant="filled" value={formData.number_of_corporate_offices} onChange={handleChange} required disabled={loading} inputProps={{ min: 0 }} placeholder="Enter number of corporate offices" error={!!errors.number_of_corporate_offices} helperText={errors.number_of_corporate_offices} fullWidth />
            </Box>

            <Box sx={twoColRowSx}>
              <TextField id="number_of_factory_units" name="number_of_factory_units" label="Number of Factory Unit/Warehouse/Other Facilities" type="number" variant="filled" value={formData.number_of_factory_units} onChange={handleChange} required disabled={loading} inputProps={{ min: 0 }} placeholder="Enter number of factory units/warehouse/other facilities" error={!!errors.number_of_factory_units} helperText={errors.number_of_factory_units} fullWidth />
              <Box />
            </Box>

            {error && <Alert severity="error" sx={{ mt: 0.5 }}>{error}</Alert>}

            <Box sx={{ display: 'flex', justifyContent: 'flex-start', pt: 0.5 }}>
              <Button type="submit" size="medium" disabled={loading} variant="contained" color="primary" sx={{ py: 0.5, px: 2, minHeight: 36, fontSize: theme.typography.customSizes.medium, fontWeight: 600 }}>
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
