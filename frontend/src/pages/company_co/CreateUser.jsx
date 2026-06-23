import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { alpha, useTheme } from '@mui/material/styles'
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import TextField from '@mui/material/TextField'
import MenuItem from '@mui/material/MenuItem'
import Stack from '@mui/material/Stack'
import Button from '@mui/material/Button'
import InputAdornment from '@mui/material/InputAdornment'
import Checkbox from '@mui/material/Checkbox'
import ListItemText from '@mui/material/ListItemText'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import MailOutlineRoundedIcon from '@mui/icons-material/MailOutlineRounded'
import BadgeRoundedIcon from '@mui/icons-material/BadgeRounded'
import PersonRoundedIcon from '@mui/icons-material/PersonRounded'
import WorkOutlineRoundedIcon from '@mui/icons-material/WorkOutlineRounded'
import ApartmentRoundedIcon from '@mui/icons-material/ApartmentRounded'
import LocalPhoneOutlinedIcon from '@mui/icons-material/LocalPhoneOutlined'
import { toast } from 'react-hot-toast'
import { useSyncGlobalLoading } from '../../contexts/GlobalLoadingContext'
import { apiUrl } from '../../config/api'
import { useOrganizationEmailWarning } from '../../hooks/useOrganizationEmailWarning'
import { getMobileValidationError, normalizeMobileDigits } from '../../utils/mobileValidation'

function CreateUser() {
  const theme = useTheme()
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [empCode, setEmpCode] = useState('')
  const [empName, setEmpName] = useState('')
  const [designation, setDesignation] = useState('')
  const [department, setDepartment] = useState('')
  const [mobile, setMobile] = useState('')
  const [selectedUnitIds, setSelectedUnitIds] = useState([])
  const [unitOptions, setUnitOptions] = useState([])
  const [unitsLoading, setUnitsLoading] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const { getEmailWarning, getEmailWarningHelperTextSx } = useOrganizationEmailWarning()
  const hasMultipleUnits = unitOptions.length > 1
  const singleUnitLabel = unitOptions[0]?.unit_name || unitOptions[0]?.unit_id || ''
  const selectedUnitLabel = selectedUnitIds
    .map((unitId) => unitOptions.find((unit) => unit.unit_id === unitId))
    .filter(Boolean)
    .map((unit) => unit.unit_name || unit.unit_id)
    .join(', ')

  useSyncGlobalLoading(loading || unitsLoading)

  useEffect(() => {
    let active = true

    const fetchCoordinatorUnits = async () => {
      setUnitsLoading(true)
      try {
        const response = await fetch(apiUrl('/api/company-co/assigned-units'), {
          method: 'GET',
          credentials: 'include',
        })
        const data = await response.json()

        if (!active) return

        if (response.ok && data.success) {
          const units = Array.isArray(data.units) ? data.units : []
          setUnitOptions(units)
          setSelectedUnitIds((currentUnitIds) => (
            currentUnitIds.length > 0 ? currentUnitIds : (units[0]?.unit_id ? [units[0].unit_id] : [])
          ))
        } else {
          toast.error(data.message || 'Failed to load assigned units')
          setUnitOptions([])
        }
      } catch (err) {
        console.error('Fetch assigned units error:', err)
        if (active) {
          toast.error('Failed to load assigned units')
          setUnitOptions([])
        }
      } finally {
        if (active) {
          setUnitsLoading(false)
        }
      }
    }

    fetchCoordinatorUnits()

    return () => {
      active = false
    }
  }, [])

  const validateEmail = (emailValue) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(emailValue)
  }

  const resetForm = () => {
    setEmail('')
    setEmpCode('')
    setEmpName('')
    setDesignation('')
    setDepartment('')
    setMobile('')
    setSelectedUnitIds(unitOptions[0]?.unit_id ? [unitOptions[0].unit_id] : [])
    setError('')
  }

  const submitCreateUser = async (confirmExistingUserUnits = false) => {
    const response = await fetch(apiUrl('/api/company-co/create-user'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({
        email_id: email.trim(),
        emp_code: empCode.trim() || null,
        emp_name: empName.trim() || null,
        designation: designation.trim() || null,
        department: department.trim() || null,
        mobile: normalizeMobileDigits(mobile) || null,
        unit_ids: selectedUnitIds,
        confirm_existing_user_units: confirmExistingUserUnits,
      }),
    })

    const data = await response.json()

    if (!response.ok && data?.code === 'CONFIRM_EXISTING_USER_UNITS' && data?.requiresConfirmation) {
      const unitLabel = selectedUnitLabel || singleUnitLabel || 'the selected unit(s)'
      const shouldContinue = window.confirm(`User already exists in another unit. Are you sure you want to create user in ${unitLabel}?`)
      if (!shouldContinue) {
        return { cancelled: true }
      }

      return submitCreateUser(true)
    }

    return { response, data }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (!email.trim()) {
      const errorMsg = 'Email ID is required'
      setError(errorMsg)
      toast.error(errorMsg)
      return
    }

    if (!validateEmail(email)) {
      const errorMsg = 'Please enter a valid email address'
      setError(errorMsg)
      toast.error(errorMsg)
      return
    }

    if (selectedUnitIds.length === 0) {
      const errorMsg = 'At least one unit is required'
      setError(errorMsg)
      toast.error(errorMsg)
      return
    }

    if (!mobile.trim()) {
      const errorMsg = 'Mobile number is required'
      setError(errorMsg)
      toast.error(errorMsg)
      return
    }

    const mobileValidationError = getMobileValidationError(mobile.trim())
    if (mobileValidationError) {
      setError(mobileValidationError)
      toast.error(mobileValidationError)
      return
    }

    setLoading(true)

    try {
      const result = await submitCreateUser()
      if (result?.cancelled) {
        return
      }

      const { response, data } = result

      if (response.ok && data.success) {
        toast.success(data.message || 'User created successfully')
        resetForm()
        navigate('/company_co/user-management', { replace: true })
      } else {
        const errorMsg = data.message || 'Failed to create user'
        setError(errorMsg)
        toast.error(errorMsg)
      }
    } catch (err) {
      console.error('Create user error:', err)
      const errorMsg = 'Network error. Please try again.'
      setError(errorMsg)
      toast.error(errorMsg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Box
      sx={{
        minHeight: 'calc(100vh - 4rem)',
        px: 0,
        py: { xs: 1, md: 2 },
      }}
    >
      <Box sx={{ width: '100%', maxWidth: '880px', mx: 'auto' }}>
        <Paper
          sx={{
            overflow: 'hidden',
            borderRadius: 4,
            border: '1px solid',
            borderColor: alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.2 : 0.12),
            backgroundColor: theme.palette.background.paper,
            boxShadow:
              theme.palette.mode === 'dark'
                ? '0 12px 32px rgba(0,0,0,0.4)'
                : '0 10px 26px rgba(15,23,42,0.08)',
          }}
        >
          <Box sx={{ p: { xs: 2.5, sm: 3.5 } }}>
            <Stack spacing={2.5}>
              <Box
                sx={{
                  display: 'flex',
                  alignItems: { xs: 'flex-start', sm: 'center' },
                  justifyContent: 'space-between',
                  flexDirection: { xs: 'column', sm: 'row' },
                  gap: 1.5,
                }}
              >
                <Typography variant="h5" sx={{ fontWeight: 700 }}>
                  Create User
                </Typography>
                <Button
                  type="button"
                  onClick={() => navigate('/company_co/user-management', { replace: true })}
                  variant="outlined"
                  startIcon={<ArrowBackIcon />}
                  sx={{ textTransform: 'none', alignSelf: { xs: 'flex-start', sm: 'center' } }}
                >
                  Back to List
                </Button>
              </Box>

                <form onSubmit={handleSubmit}>
                  <Box
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: 'minmax(0, 1fr)',
                      gap: 2.25,
                    }}
                  >
                    <Typography sx={{ fontWeight: 700, mb: 0.25 }}>User details</Typography>

                    <TextField
                      id="unit_id"
                      name="unit_id"
                      label={hasMultipleUnits ? 'Units' : 'Unit'}
                      select={hasMultipleUnits}
                      variant="outlined"
                      value={hasMultipleUnits ? selectedUnitIds : singleUnitLabel}
                      onChange={(e) => setSelectedUnitIds(typeof e.target.value === 'string' ? e.target.value.split(',') : e.target.value)}
                      required
                      disabled={loading || unitsLoading || unitOptions.length === 0 || !hasMultipleUnits}
                      helperText={
                        unitsLoading
                          ? 'Loading assigned units...'
                          : unitOptions.length === 0
                            ? 'No units are mapped with your coordinator account.'
                            : hasMultipleUnits
                              ? 'Only units mapped with your coordinator account are available. You can select multiple units.'
                              : 'This user will be created for the selected unit.'
                      }
                      fullWidth
                      SelectProps={hasMultipleUnits ? {
                        multiple: true,
                        renderValue: (selected) => {
                          const selectedIds = Array.isArray(selected) ? selected : []
                          return selectedIds
                            .map((unitId) => {
                              const unit = unitOptions.find((option) => option.unit_id === unitId)
                              return unit?.unit_name || unitId
                            })
                            .filter(Boolean)
                            .join(', ')
                        },
                      } : undefined}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <ApartmentRoundedIcon fontSize="small" sx={{ color: theme.palette.text.secondary }} />
                          </InputAdornment>
                        ),
                        readOnly: !hasMultipleUnits,
                      }}
                    >
                      {hasMultipleUnits
                        ? unitOptions.map((unit) => (
                          <MenuItem key={unit.unit_id || unit.id} value={unit.unit_id}>
                            <Checkbox checked={selectedUnitIds.includes(unit.unit_id)} size="small" />
                            <ListItemText primary={unit.unit_name || unit.unit_id} />
                          </MenuItem>
                        ))
                        : undefined}
                    </TextField>

                    <TextField
                      id="email"
                      name="email"
                      label="Email ID"
                      type="email"
                      variant="outlined"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      disabled={loading}
                      placeholder="user@example.com"
                      error={!!error}
                      helperText={error || getEmailWarning(email) || 'Use the user’s primary company email address.'}
                      FormHelperTextProps={{ sx: error ? undefined : getEmailWarningHelperTextSx(email) }}
                      fullWidth
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <MailOutlineRoundedIcon fontSize="small" sx={{ color: theme.palette.text.secondary }} />
                          </InputAdornment>
                        ),
                      }}
                    />

                    <TextField
                      id="emp_code"
                      name="emp_code"
                      label="Employee Code"
                      type="text"
                      variant="outlined"
                      value={empCode}
                      onChange={(e) => setEmpCode(e.target.value)}
                      disabled={loading}
                      fullWidth
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <BadgeRoundedIcon fontSize="small" sx={{ color: theme.palette.text.secondary }} />
                          </InputAdornment>
                        ),
                      }}
                    />

                    <TextField
                      id="emp_name"
                      name="emp_name"
                      label="Employee Name"
                      type="text"
                      variant="outlined"
                      value={empName}
                      onChange={(e) => setEmpName(e.target.value)}
                      disabled={loading}
                      fullWidth
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <PersonRoundedIcon fontSize="small" sx={{ color: theme.palette.text.secondary }} />
                          </InputAdornment>
                        ),
                      }}
                    />

                    <TextField
                      id="designation"
                      name="designation"
                      label="Designation"
                      type="text"
                      variant="outlined"
                      value={designation}
                      onChange={(e) => setDesignation(e.target.value)}
                      disabled={loading}
                      fullWidth
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <WorkOutlineRoundedIcon fontSize="small" sx={{ color: theme.palette.text.secondary }} />
                          </InputAdornment>
                        ),
                      }}
                    />

                    <TextField
                      id="department"
                      name="department"
                      label="Department"
                      type="text"
                      variant="outlined"
                      value={department}
                      onChange={(e) => setDepartment(e.target.value)}
                      disabled={loading}
                      fullWidth
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <ApartmentRoundedIcon fontSize="small" sx={{ color: theme.palette.text.secondary }} />
                          </InputAdornment>
                        ),
                      }}
                    />

                    <TextField
                      id="mobile"
                      name="mobile"
                      label="Mobile Number"
                      type="tel"
                      variant="outlined"
                      value={mobile}
                      onChange={(e) => setMobile(e.target.value)}
                      disabled={loading}
                      required
                      error={!mobile.trim() || !!getMobileValidationError(mobile)}
                      helperText={
                        (!mobile.trim() && 'Mobile number is required') ||
                        getMobileValidationError(mobile) ||
                        'Enter a valid 10-digit mobile number.'
                      }
                      fullWidth
                      inputProps={{
                        maxLength: 10,
                      }}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <LocalPhoneOutlinedIcon fontSize="small" sx={{ color: theme.palette.text.secondary }} />
                          </InputAdornment>
                        ),
                      }}
                    />
                  </Box>

                  <Box
                  sx={{
                    display: 'flex',
                    justifyContent: 'flex-start',
                    alignItems: { xs: 'stretch', sm: 'center' },
                    gap: 2,
                    flexDirection: 'row',
                    mt: 3,
                    pt: 1,
                  }}
                >
                  <Button
                    type="submit"
                    disabled={loading || unitsLoading || unitOptions.length === 0}
                    variant="contained"
                    color="secondary"
                    sx={{
                      py: 1.4,
                      px: 3,
                      minWidth: 170,
                      width: { xs: '100%', sm: 'auto' },
                      fontSize: theme.typography.customSizes.medium,
                      fontWeight: 600,
                      textTransform: 'none',
                    }}
                  >
                    {loading ? 'Creating User...' : 'Create User'}
                  </Button>
                </Box>
              </form>
            </Stack>
          </Box>
        </Paper>
      </Box>
    </Box>
  )
}

export default CreateUser
