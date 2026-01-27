import React, { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useTheme } from '@mui/material/styles'
import Button from '@mui/material/Button'
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import { toast } from 'react-hot-toast'

function CreateUser() {
  const theme = useTheme()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [email, setEmail] = useState('')
  
  // Auto-fill email from URL params if present
  useEffect(() => {
    const emailParam = searchParams.get('email')
    if (emailParam) {
      setEmail(decodeURIComponent(emailParam))
    }
  }, [searchParams])
  const [empCode, setEmpCode] = useState('')
  const [empName, setEmpName] = useState('')
  const [designation, setDesignation] = useState('')
  const [department, setDepartment] = useState('')
  const [mobile, setMobile] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  }

  const validateMobile = (mobile) => {
    // Basic mobile validation - 10 digits
    const mobileRegex = /^[0-9]{10}$/
    return mobileRegex.test(mobile)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    // Validate email
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

    // Validate mobile if provided
    if (mobile.trim() && !validateMobile(mobile.trim())) {
      const errorMsg = 'Mobile number must be 10 digits'
      setError(errorMsg)
      toast.error(errorMsg)
      return
    }

    setLoading(true)

    try {
      const response = await fetch('http://localhost:3000/api/company-co/create-user', {
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
          mobile: mobile.trim() || null
        })
      })

      const data = await response.json()

      if (response.ok && data.success) {
        const successMsg = `User created successfully!'}`
        toast.success(successMsg)
        setEmail('')
        setEmpCode('')
        setEmpName('')
        setDesignation('')
        setDepartment('')
        setMobile('')
        setError('')
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
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 'calc(100vh - 4rem)',
        px: 2,
        py: 4,
      }}
    >
      <Box sx={{ width: '100%', maxWidth: '600px' }}>
        <Paper
          elevation={3}
          sx={{
            p: 4,
            backgroundColor: theme.palette.background.paper,
            borderRadius: 2,
          }}
        >
          <Typography
            variant="h4"
            component="h1"
            sx={{
              fontWeight: 700,
              color: theme.palette.secondary.main,
              mb: 4,
              textAlign: 'center',
            }}
          >
            Create New User
          </Typography>

          <form onSubmit={handleSubmit}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, mb: 3 }}>
              {/* Email Input */}
              <TextField
                id="email"
                name="email"
                label="Email ID"
                type="email"
                variant="filled"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
                placeholder="user@example.com"
                error={!!error}
                helperText={error || ''}
                fullWidth
              />

              {/* Employee Code */}
              <TextField
                id="emp_code"
                name="emp_code"
                label="Employee Code"
                type="text"
                variant="filled"
                value={empCode}
                onChange={(e) => setEmpCode(e.target.value)}
                disabled={loading}
                placeholder="Enter employee code"
                fullWidth
              />

              {/* Employee Name */}
              <TextField
                id="emp_name"
                name="emp_name"
                label="Employee Name"
                type="text"
                variant="filled"
                value={empName}
                onChange={(e) => setEmpName(e.target.value)}
                disabled={loading}
                placeholder="Enter employee name"
                fullWidth
              />

              {/* Designation */}
              <TextField
                id="designation"
                name="designation"
                label="Designation"
                type="text"
                variant="filled"
                value={designation}
                onChange={(e) => setDesignation(e.target.value)}
                disabled={loading}
                placeholder="Enter designation"
                fullWidth
              />

              {/* Department */}
              <TextField
                id="department"
                name="department"
                label="Department"
                type="text"
                variant="filled"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                disabled={loading}
                placeholder="Enter department"
                fullWidth
              />

              {/* Mobile */}
              <TextField
                id="mobile"
                name="mobile"
                label="Mobile Number"
                type="tel"
                variant="filled"
                value={mobile}
                onChange={(e) => setMobile(e.target.value)}
                disabled={loading}
                placeholder="Enter 10-digit mobile number"
                error={!!mobile && !validateMobile(mobile)}
                helperText={mobile && !validateMobile(mobile) ? 'Mobile number must be 10 digits' : ''}
                fullWidth
                inputProps={{
                  maxLength: 10,
                }}
              />
            </Box>

            {/* Submit Button */}
            <Button
              type="submit"
              disabled={loading}
              variant="contained"
              color="secondary"
              fullWidth
              sx={{
                py: 1.5,
                fontSize: theme.typography.customSizes.medium,
                fontWeight: 600,
                textTransform: 'none',
                mb: 2,
              }}
            >
              {loading ? 'Creating User...' : 'Create User'}
            </Button>

            {/* Back Button */}
            <Button
              type="button"
              onClick={() => navigate('/company_co/dashboard')}
              variant="outlined"
              fullWidth
              sx={{
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
              Back to Dashboard
            </Button>
          </form>
        </Paper>
      </Box>
    </Box>
  )
}

export default CreateUser

