import React, { useCallback, useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useTheme } from '@mui/material/styles'
import Button from '@mui/material/Button'
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import CircularProgress from '@mui/material/CircularProgress'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Alert from '@mui/material/Alert'
import AddIcon from '@mui/icons-material/Add'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import { toast } from 'react-hot-toast'

function CreateUser() {
  const theme = useTheme()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const [showCreateForm, setShowCreateForm] = useState(false)
  const [users, setUsers] = useState([])
  const [usersLoading, setUsersLoading] = useState(true)
  const [usersError, setUsersError] = useState('')

  const [email, setEmail] = useState('')
  const [empCode, setEmpCode] = useState('')
  const [empName, setEmpName] = useState('')
  const [designation, setDesignation] = useState('')
  const [department, setDepartment] = useState('')
  const [mobile, setMobile] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const validateEmail = (emailValue) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(emailValue)
  }

  const validateMobile = (mobileValue) => {
    const mobileRegex = /^[0-9]{10}$/
    return mobileRegex.test(mobileValue)
  }

  const resetForm = () => {
    setEmail('')
    setEmpCode('')
    setEmpName('')
    setDesignation('')
    setDepartment('')
    setMobile('')
    setError('')
  }

  const fetchUsers = useCallback(async () => {
    setUsersLoading(true)
    setUsersError('')
    try {
      const response = await fetch('http://localhost:3000/api/company-co/users', {
        method: 'GET',
        credentials: 'include',
      })

      const data = await response.json()

      if (response.ok && data.success) {
        setUsers(Array.isArray(data.users) ? data.users : [])
      } else {
        const message = data.message || 'Failed to fetch users'
        setUsersError(message)
      }
    } catch (err) {
      console.error('Fetch users error:', err)
      setUsersError('Network error while fetching users')
    } finally {
      setUsersLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchUsers()
  }, [fetchUsers])

  useEffect(() => {
    const emailParam = searchParams.get('email')
    if (emailParam) {
      setEmail(decodeURIComponent(emailParam))
      setShowCreateForm(true)
    }
  }, [searchParams])

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
          mobile: mobile.trim() || null,
        }),
      })

      const data = await response.json()

      if (response.ok && data.success) {
        toast.success('User created successfully')
        resetForm()
        setShowCreateForm(false)
        fetchUsers()
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

  if (showCreateForm) {
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
        <Box sx={{ width: '100%', maxWidth: '700px' }}>
          <Paper
            elevation={2}
            sx={{
              p: 4,
              backgroundColor: theme.palette.background.paper,
              borderRadius: 2,
            }}
          >
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
              <Typography
                variant="h4"
                component="h1"
                sx={{
                  fontWeight: 700,
                  color: theme.palette.secondary.main,
                }}
              >
                Create New User
              </Typography>
              <Button
                onClick={() => {
                  setShowCreateForm(false)
                  resetForm()
                  navigate('/company_co/user-management', { replace: true })
                }}
                variant="outlined"
                startIcon={<ArrowBackIcon />}
                sx={{ textTransform: 'none' }}
              >
                Back to List
              </Button>
            </Box>

            <form onSubmit={handleSubmit}>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, mb: 3 }}>
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

                <TextField
                  id="emp_code"
                  name="emp_code"
                  label="Employee Code"
                  type="text"
                  variant="filled"
                  value={empCode}
                  onChange={(e) => setEmpCode(e.target.value)}
                  disabled={loading}
                  fullWidth
                />

                <TextField
                  id="emp_name"
                  name="emp_name"
                  label="Employee Name"
                  type="text"
                  variant="filled"
                  value={empName}
                  onChange={(e) => setEmpName(e.target.value)}
                  disabled={loading}
                  fullWidth
                />

                <TextField
                  id="designation"
                  name="designation"
                  label="Designation"
                  type="text"
                  variant="filled"
                  value={designation}
                  onChange={(e) => setDesignation(e.target.value)}
                  disabled={loading}
                  fullWidth
                />

                <TextField
                  id="department"
                  name="department"
                  label="Department"
                  type="text"
                  variant="filled"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  disabled={loading}
                  fullWidth
                />

                <TextField
                  id="mobile"
                  name="mobile"
                  label="Mobile Number"
                  type="tel"
                  variant="filled"
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value)}
                  disabled={loading}
                  error={!!mobile && !validateMobile(mobile)}
                  helperText={mobile && !validateMobile(mobile) ? 'Mobile number must be 10 digits' : ''}
                  fullWidth
                  inputProps={{
                    maxLength: 10,
                  }}
                />
              </Box>

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
                }}
              >
                {loading ? 'Creating User...' : 'Create User'}
              </Button>
            </form>
          </Paper>
        </Box>
      </Box>
    )
  }

  return (
    <Box sx={{ px: { xs: 1, sm: 2 }, py: 2 }}>
      <Paper sx={{ p: 3, borderRadius: 2 }}>
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            mb: 2,
            gap: 2,
            flexWrap: 'wrap',
          }}
        >
          <Typography variant="h5" sx={{ fontWeight: 700 }}>
            User Management
          </Typography>
          <Button
            variant="contained"
            color="secondary"
            startIcon={<AddIcon />}
            onClick={() => setShowCreateForm(true)}
            sx={{ textTransform: 'none', fontWeight: 600 }}
          >
            Create User
          </Button>
        </Box>

        {usersError && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {usersError}
          </Alert>
        )}

        <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid', borderColor: 'divider' }}>
          <Table size="medium" sx={{ minWidth: 950 }}>
            <TableHead>
              <TableRow>
                <TableCell sx={{ py: 2, px: 3, fontSize: '1rem', fontWeight: 700 }}>Employee Name</TableCell>
                <TableCell sx={{ py: 2, px: 3, fontSize: '1rem', fontWeight: 700 }}>Email ID</TableCell>
                <TableCell sx={{ py: 2, px: 3, fontSize: '1rem', fontWeight: 700 }}>Department</TableCell>
                <TableCell sx={{ py: 2, px: 3, fontSize: '1rem', fontWeight: 700 }}>Designation</TableCell>
                <TableCell sx={{ py: 2, px: 3, fontSize: '1rem', fontWeight: 700 }}>Mobile</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {usersLoading ? (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ py: 5 }}>
                    <CircularProgress size={26} />
                  </TableCell>
                </TableRow>
              ) : users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ py: 5 }}>
                    No users found for your company.
                  </TableCell>
                </TableRow>
              ) : (
                users.map((user, idx) => (
                  <TableRow key={`${user.email_id}-${idx}`}>
                    <TableCell sx={{ py: 1.8, px: 3, fontSize: '0.9rem' }}>
                      {user.emp_name ? `${user.emp_name}${user.role === 'company_co' ? ' (cc)' : ''}` : '-'}
                    </TableCell>
                    <TableCell sx={{ py: 1.8, px: 3, fontSize: '0.9rem' }}>{user.email_id || '-'}</TableCell>
                    <TableCell sx={{ py: 1.8, px: 3, fontSize: '0.9rem' }}>{user.department || '-'}</TableCell>
                    <TableCell sx={{ py: 1.8, px: 3, fontSize: '0.9rem' }}>{user.designation || '-'}</TableCell>
                    <TableCell sx={{ py: 1.8, px: 3, fontSize: '0.9rem' }}>{user.mobile || '-'}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </Box>
  )
}

export default CreateUser
