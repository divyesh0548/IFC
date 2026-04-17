import React, { useCallback, useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { alpha, useTheme } from '@mui/material/styles'
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
import DeleteIcon from '@mui/icons-material/Delete'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import Checkbox from '@mui/material/Checkbox'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogContentText from '@mui/material/DialogContentText'
import DialogActions from '@mui/material/DialogActions'
import Divider from '@mui/material/Divider'
import Chip from '@mui/material/Chip'
import Grid from '@mui/material/Grid'
import Stack from '@mui/material/Stack'
import InputAdornment from '@mui/material/InputAdornment'
import { toast } from 'react-hot-toast'
import MailOutlineRoundedIcon from '@mui/icons-material/MailOutlineRounded'
import BadgeRoundedIcon from '@mui/icons-material/BadgeRounded'
import PersonRoundedIcon from '@mui/icons-material/PersonRounded'
import WorkOutlineRoundedIcon from '@mui/icons-material/WorkOutlineRounded'
import ApartmentRoundedIcon from '@mui/icons-material/ApartmentRounded'
import LocalPhoneOutlinedIcon from '@mui/icons-material/LocalPhoneOutlined'
import { useSyncGlobalLoading } from '../../contexts/GlobalLoadingContext'

function UserManagement() {
  const theme = useTheme()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const [showCreateForm, setShowCreateForm] = useState(false)
  const [users, setUsers] = useState([])
  const [usersLoading, setUsersLoading] = useState(true)
  const [usersError, setUsersError] = useState('')

  const [deleteMode, setDeleteMode] = useState(false)
  const [selectedUserEmails, setSelectedUserEmails] = useState(new Set())
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deletingUsers, setDeletingUsers] = useState(false)

  const [email, setEmail] = useState('')
  const [empCode, setEmpCode] = useState('')
  const [empName, setEmpName] = useState('')
  const [designation, setDesignation] = useState('')
  const [department, setDepartment] = useState('')
  const [mobile, setMobile] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useSyncGlobalLoading(usersLoading)
  useSyncGlobalLoading(loading)
  useSyncGlobalLoading(deletingUsers)

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

  // Reset selection when delete mode is turned off (matches RacmManagementDashboard behavior)
  useEffect(() => {
    if (!deleteMode) {
      setSelectedUserEmails(new Set())
    }
  }, [deleteMode])

  const toggleSelectUser = (emailId) => {
    setSelectedUserEmails((prev) => {
      const next = new Set(prev)
      if (next.has(emailId)) next.delete(emailId)
      else next.add(emailId)
      return next
    })
  }

  const handleDeleteModeToggle = () => {
    setDeleteMode(true)
  }

  const handleDeleteClick = () => {
    if (selectedUserEmails.size === 0) {
      setDeleteMode(false)
      return
    }
    setDeleteDialogOpen(true)
  }

  const handleListContainerClick = (e) => {
    if (!deleteMode) return
    if (deleteDialogOpen) return

    const target = e?.target
    if (!target) return

    const isCheckbox =
      target.type === 'checkbox' ||
      target.closest?.('input[type="checkbox"]') ||
      target.closest?.('.MuiCheckbox-root')

    const isDialog = target.closest?.('.MuiDialog-root')

    const clickedButton = target.closest?.('button')
    const isDeleteButton = Boolean(clickedButton && clickedButton.textContent?.includes('Delete'))

    if (isCheckbox || isDialog || isDeleteButton) return

    setDeleteMode(false)
  }

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
                  ? '0 20px 48px rgba(0, 0, 0, 0.28)'
                  : '0 18px 42px rgba(18, 52, 88, 0.1)',
            }}
          >
            <Box sx={{ p: { xs: 3, sm: 4, md: 4.5 } }}>
              <Stack spacing={3}>
                <Box
                  sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: { xs: 'stretch', sm: 'flex-start' },
                    gap: 2,
                    flexDirection: { xs: 'column', sm: 'row' },
                  }}
                >
                  <Box>
                    <Chip
                      label="Company Coordinator"
                      size="small"
                      sx={{
                        mb: 1.75,
                        fontWeight: 700,
                        color: theme.palette.primary.main,
                        backgroundColor: alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.18 : 0.1),
                        border: '1px solid',
                        borderColor: alpha(theme.palette.primary.main, 0.2),
                      }}
                    />
                    <Typography variant="h4" component="h1" sx={{ mb: 1 }}>
                      Create user
                    </Typography>
                    <Typography variant="body2" sx={{ color: theme.palette.text.secondary, maxWidth: 620, lineHeight: 1.8 }}>
                      Add the employee&apos;s primary details below. Email is required. The remaining fields are optional, but they make ownership and tracking clearer across RACMs.
                    </Typography>
                  </Box>
                  <Button
                    onClick={() => {
                      setShowCreateForm(false)
                      resetForm()
                      navigate('/company_co/user-management', { replace: true })
                    }}
                    variant="outlined"
                    startIcon={<ArrowBackIcon />}
                    sx={{ textTransform: 'none', alignSelf: { xs: 'flex-start', sm: 'center' } }}
                  >
                    Back to List
                  </Button>
                </Box>

                <Divider />

                <form onSubmit={handleSubmit}>
                  <Grid container spacing={2.25}>
                    <Grid item xs={12}>
                      <Typography sx={{ fontWeight: 700, mb: 1.5 }}>User details</Typography>
                    </Grid>

                    <Grid item xs={12}>
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
                        helperText={error || 'Use the user’s primary company email address.'}
                        fullWidth
                        InputProps={{
                          startAdornment: (
                            <InputAdornment position="start">
                              <MailOutlineRoundedIcon fontSize="small" sx={{ color: theme.palette.text.secondary }} />
                            </InputAdornment>
                          ),
                        }}
                      />
                    </Grid>

                    <Grid item xs={12}>
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
                    </Grid>

                    <Grid item xs={12}>
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
                    </Grid>

                    <Grid item xs={12}>
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
                    </Grid>

                    <Grid item xs={12}>
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
                    </Grid>

                    <Grid item xs={12}>
                      <TextField
                        id="mobile"
                        name="mobile"
                        label="Mobile Number"
                        type="tel"
                        variant="outlined"
                        value={mobile}
                        onChange={(e) => setMobile(e.target.value)}
                        disabled={loading}
                        error={!!mobile && !validateMobile(mobile)}
                        helperText={mobile && !validateMobile(mobile) ? 'Mobile number must be 10 digits' : 'Optional. Enter digits only.'}
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
                    </Grid>
                  </Grid>

                  <Box
                    sx={{
                      display: 'flex',
                      justifyContent: 'flex-end',
                      alignItems: { xs: 'stretch', sm: 'center' },
                      gap: 2,
                      flexDirection: { xs: 'column', sm: 'row' },
                      mt: 3,
                      pt: 3,
                      borderTop: '1px solid',
                      borderColor: 'divider',
                    }}
                  >
                    <Box sx={{ display: 'flex', gap: 1.5, width: { xs: '100%', sm: 'auto' } }}>
                      <Button
                        type="button"
                        variant="outlined"
                        disabled={loading}
                        onClick={resetForm}
                        sx={{ textTransform: 'none', minWidth: 120, width: { xs: '50%', sm: 'auto' } }}
                      >
                        Clear
                      </Button>
                      <Button
                        type="submit"
                        disabled={loading}
                        variant="contained"
                        color="secondary"
                        sx={{
                          py: 1.4,
                          px: 3,
                          minWidth: 170,
                          width: { xs: '50%', sm: 'auto' },
                          fontSize: theme.typography.customSizes.medium,
                          fontWeight: 600,
                          textTransform: 'none',
                        }}
                      >
                        {loading ? 'Creating User...' : 'Create User'}
                      </Button>
                    </Box>
                  </Box>
                </form>
              </Stack>
            </Box>
          </Paper>
        </Box>
      </Box>
    )
  }
  return (
    <Box sx={{ px: 0, py: 2 }}>
      <Paper sx={{ p: 3, borderRadius: 2 }} onClick={handleListContainerClick}>
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
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
            <Button
              variant="contained"
              color="secondary"
              startIcon={<AddIcon />}
              onClick={() => navigate('/company_co/create-user')}
              sx={{ textTransform: 'none', fontWeight: 600 }}
            >
              Create User
            </Button>
            <Button
              variant={deleteMode ? 'contained' : 'outlined'}
              color="error"
              startIcon={<DeleteIcon />}
              onClick={() => {
                if (deleteMode) {
                  if (selectedUserEmails.size > 0) {
                    handleDeleteClick()
                  }
                } else {
                  handleDeleteModeToggle()
                }
              }}
              disabled={usersLoading || users.length === 0 || deletingUsers || (deleteMode && selectedUserEmails.size === 0)}
              sx={{ textTransform: 'none', fontWeight: 600 }}
            >
              {deleteMode
                ? (selectedUserEmails.size > 0 ? `Delete (${selectedUserEmails.size})` : 'Delete')
                : 'Delete'}
            </Button>
          </Box>
        </Box>

        {usersError && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {usersError}
          </Alert>
        )}

        <TableContainer
          component={Paper}
          elevation={0}
          sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1 }}
        >
          <Table
            size="medium"
            sx={{
              minWidth: 950,
              borderCollapse: 'collapse',
              '& .MuiTableCell-root': {
                borderBottom: `1px solid ${theme.palette.divider}`,
              },
            }}
          >
            <TableHead>
              <TableRow
                sx={{
                  '& .MuiTableCell-root': {
                    backgroundColor: theme.palette.action.hover,
                  },
                }}
              >
                {deleteMode ? <TableCell sx={{ py: 2, px: 3, width: 54 }} /> : null}
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
                  <TableCell colSpan={deleteMode ? 6 : 5} align="center" sx={{ py: 5 }}>
                    <CircularProgress size={26} />
                  </TableCell>
                </TableRow>
              ) : users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={deleteMode ? 6 : 5} align="center" sx={{ py: 5 }}>
                    No users found for your company.
                  </TableCell>
                </TableRow>
              ) : (
                users.map((user, idx) => (
                  <TableRow key={`${user.email_id}-${idx}`}>
                    {deleteMode ? (
                      <TableCell sx={{ py: 1.8, px: 3, width: 54 }}>
                        <Checkbox
                          checked={selectedUserEmails.has(user.email_id)}
                          disabled={user.role !== 'user'}
                          onChange={() => toggleSelectUser(user.email_id)}
                          inputProps={{ 'aria-label': `select ${user.email_id}` }}
                        />
                      </TableCell>
                    ) : null}
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

      <Dialog
        open={deleteDialogOpen}
        onClose={() => !deletingUsers && setDeleteDialogOpen(false)}
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
          Confirm Delete
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
            Deleting selected user(s) will remove them from the company and all assigned RACMs will go inactive. This action cannot be undone.
          </DialogContentText>
          {selectedUserEmails.size > 0 ? (
            <Box sx={{ mt: 2 }}>
              <Typography
                variant="body2"
                sx={{
                  color: theme.palette.text.primary,
                  fontWeight: 500,
                }}
              >
                Total number of user(s) selected: <strong>{selectedUserEmails.size}</strong>
              </Typography>
            </Box>
          ) : null}
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
            onClick={() => setDeleteDialogOpen(false)}
            variant="outlined"
            disabled={deletingUsers}
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
            variant="contained"
            color="error"
            disabled={selectedUserEmails.size === 0 || deletingUsers}
            autoFocus
            onClick={async () => {
              setDeletingUsers(true)
              try {
                const emailIds = Array.from(selectedUserEmails)
                const response = await fetch('http://localhost:3000/api/company-co/delete-users', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                  credentials: 'include',
                  body: JSON.stringify({ email_ids: emailIds }),
                })

                const data = await response.json()
                if (response.ok && data.success) {
                  toast.success(data.message || 'User(s) deleted successfully')
                  setSelectedUserEmails(new Set())
                  setDeleteDialogOpen(false)
                  setDeleteMode(false)
                  fetchUsers()
                } else {
                  toast.error(data.message || 'Failed to delete user(s)')
                }
              } catch (error) {
                console.error('Delete users error:', error)
                toast.error('Network error while deleting users')
              } finally {
                setDeletingUsers(false)
              }
            }}
            sx={{
              textTransform: 'none',
              px: 3,
              py: 1,
              minWidth: '100px',
              fontWeight: 600,
              backgroundColor: '#ef4444',
              '&:hover': {
                backgroundColor: '#dc2626',
              },
            }}
          >
            {deletingUsers ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

export default UserManagement 
