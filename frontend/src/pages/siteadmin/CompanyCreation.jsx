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
import { getMobileValidationError, normalizeMobileDigits } from '../../utils/mobileValidation'

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
  const [companyAdminEmails, setCompanyAdminEmails] = useState([{ email_id: '', mobile: '' }])
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

  const handleCompanyAdminFieldChange = (index, field, value) => {
    setCompanyAdminEmails((prev) => prev.map((item, itemIndex) => (
      itemIndex === index ? { ...item, [field]: value } : item
    )))

    const errorKey = `company_admin_${field}_${index}`
    if (errors[errorKey]) {
      setErrors((prev) => {
        const next = { ...prev }
        delete next[errorKey]
        return next
      })
    }
  }

  const handleAddCompanyAdminEmail = () => {
    setCompanyAdminEmails((prev) => [...prev, { email_id: '', mobile: '' }])
  }

  const handleRemoveCompanyAdminEmail = (index) => {
    setCompanyAdminEmails((prev) => prev.filter((_, itemIndex) => itemIndex !== index))
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
    if (companyAdminEmails.length === 0) {
      newErrors.company_admin_emails = 'At least one company admin email is required'
    }

    const normalizedEmails = companyAdminEmails.map((item) => String(item.email_id || '').trim().toLowerCase())
    companyAdminEmails.forEach((item, index) => {
      const emailValue = String(item.email_id || '').trim()
      if (!emailValue) {
        newErrors[`company_admin_email_${index}`] = 'Company admin email is required'
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailValue)) {
        newErrors[`company_admin_email_${index}`] = 'Invalid email format'
      }

      const mobileValue = String(item.mobile || '').trim()
      if (!mobileValue) {
        newErrors[`company_admin_mobile_${index}`] = 'Mobile number is required'
      } else {
        const mobileError = getMobileValidationError(mobileValue)
        if (mobileError) {
          newErrors[`company_admin_mobile_${index}`] = mobileError
        }
      }
    })

    const duplicateEmails = normalizedEmails.filter((email, index) => email && normalizedEmails.indexOf(email) !== index)
    if (duplicateEmails.length > 0) {
      newErrors.company_admin_emails = 'Company admin emails must be unique'
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
          company_admins: companyAdminEmails.map((item) => ({
            email_id: String(item.email_id || '').trim(),
            mobile: normalizeMobileDigits(item.mobile) || null,
          })),
        }),
      })

      const data = await response.json()

      if (response.ok && data.success) {
        toast.success('Company created successfully')
        navigate('/siteadmin/dashboard')
      } else {
        setError(data.message || 'Failed to register company')
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
            Register Company
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'left', mb: 3 }}>
            Fill in the details below to register a new company; Company Admin will manage company units and assignments.
          </Typography>

          <Box component="form" onSubmit={handleSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, width: '100%' }}>
            <Box sx={twoColRowSx}>
              <TextField id="company_name" name="company_name" label="Company Name" variant="filled" value={formData.company_name} onChange={handleChange} required disabled={loading} placeholder="Enter company name" error={!!errors.company_name} helperText={errors.company_name} fullWidth />
              <TextField id="registered_email" name="registered_email" label="Registered Email" type="email" variant="filled" value={formData.registered_email} onChange={handleChange} required disabled={loading} placeholder="Enter registered email" error={!!errors.registered_email} helperText={errors.registered_email} fullWidth />
            </Box>

            <Box sx={{ width: '100%', pt: 2.5, borderTop: 1, borderColor: 'divider' }}>
              <TextField id="registered_address" name="registered_address" label="Registered Address" variant="filled" value={formData.registered_address} onChange={handleChange} required disabled={loading} multiline minRows={3} placeholder="Enter registered address" error={!!errors.registered_address} helperText={errors.registered_address} fullWidth />
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

            <Box sx={{ width: '100%', pt: 2.5, borderTop: 1, borderColor: 'divider', display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1.5 }}>
                <Box>
                  <Typography sx={{ fontWeight: 700, color: 'text.primary' }}>Company Admin <span style={{ fontSize: '0.80rem', color: 'text.secondary', fontWeight: 400 }}>(At least one is required)</span></Typography>
                </Box>
                <Tooltip title="Add company admin">
                  <span>
                    <IconButton color="primary" onClick={handleAddCompanyAdminEmail} disabled={loading} aria-label="Add company admin email">
                      <AddIcon />
                    </IconButton>
                  </span>
                </Tooltip>
              </Box>

              {companyAdminEmails.map((item, index) => (
                <Box
                  key={`company-admin-email-${index}`}
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1fr) minmax(0, 1fr) auto' },
                    gap: 1.5,
                    alignItems: 'flex-start',
                  }}
                >
                  <TextField
                    id={`company_admin_email_${index}`}
                    label={`Company Admin Email ${index + 1}`}
                    variant="filled"
                    type="email"
                    value={item.email_id}
                    onChange={(e) => handleCompanyAdminFieldChange(index, 'email_id', e.target.value)}
                    required
                    disabled={loading}
                    placeholder="Enter company admin email"
                    error={!!errors[`company_admin_email_${index}`]}
                    helperText={errors[`company_admin_email_${index}`] || 'This email will be used for company admin login.'}
                    fullWidth
                  />
                  <TextField
                    id={`company_admin_mobile_${index}`}
                    label={`Company Admin Mobile ${index + 1}`}
                    variant="filled"
                    type="tel"
                    value={item.mobile || ''}
                    onChange={(e) => handleCompanyAdminFieldChange(index, 'mobile', e.target.value)}
                    required
                    disabled={loading}
                    inputProps={{ maxLength: 10 }}
                    placeholder="Enter 10-digit mobile number"
                    error={!!errors[`company_admin_mobile_${index}`]}
                    helperText={errors[`company_admin_mobile_${index}`]}
                    fullWidth
                  />
                  <Tooltip title={companyAdminEmails.length === 1 ? 'At least one company admin email is required' : 'Remove company admin email'}>
                    <span>
                      <IconButton color="error" onClick={() => handleRemoveCompanyAdminEmail(index)} disabled={loading || companyAdminEmails.length === 1} aria-label={`Remove company admin email ${index + 1}`} sx={{ mt: 1 }}>
                        <DeleteIcon />
                      </IconButton>
                    </span>
                  </Tooltip>
                </Box>
              ))}

              {errors.company_admin_emails && (
                <Typography variant="caption" color="error">
                  {errors.company_admin_emails}
                </Typography>
              )}
            </Box>

            {error && <Alert severity="error" sx={{ mt: 0.5 }}>{error}</Alert>}

            <Box sx={{ display: 'flex', justifyContent: 'flex-start', pt: 0.5 }}>
              <Button type="submit" size="medium" disabled={loading} variant="contained" color="primary" sx={{ py: 0.5, px: 2, minHeight: 36, fontSize: theme.typography.customSizes.medium, fontWeight: 600 }}>
                {loading ? 'Creating...' : 'Register'}
              </Button>
            </Box>
          </Box>
        </CardContent>
      </Card>
    </Box>
  )
}

export default CompanyCreation
