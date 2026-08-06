import React, { useEffect, useState } from 'react'
import { useTheme } from '@mui/material/styles'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import TextField from '@mui/material/TextField'
import Button from '@mui/material/Button'
import Alert from '@mui/material/Alert'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import CircularProgress from '@mui/material/CircularProgress'
import Chip from '@mui/material/Chip'
import PersonAddAltRoundedIcon from '@mui/icons-material/PersonAddAltRounded'
import { toast } from 'react-hot-toast'
import ManagementPageHeader from '../../components/ManagementPageHeader'
import { apiUrl } from '../../config/api'
import { useSyncGlobalLoading } from '../../contexts/GlobalLoadingContext'
import {
  getManagementTableBorderColor,
  getManagementTableContainerSx,
  TABLE_HEADER_BG,
  TABLE_ROW_HOVER_BG,
} from '../../uiConstants'
import { getMobileValidationError, normalizeMobileDigits } from '../../utils/mobileValidation'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function AuditorManagement() {
  const theme = useTheme()
  const [auditors, setAuditors] = useState([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState({
    emp_name: '',
    email_id: '',
    mobile: '',
  })
  const [formErrors, setFormErrors] = useState({})

  useSyncGlobalLoading(loading || creating)

  const tableBorderColor = getManagementTableBorderColor(theme)
  const bodyCellSx = {
    py: 1.55,
    px: 2.25,
    borderBottom: `1px solid ${tableBorderColor}`,
    verticalAlign: 'top',
  }
  const headCellSx = {
    ...bodyCellSx,
    py: 1.7,
    fontSize: '0.84rem',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    color: 'text.secondary',
    backgroundColor: TABLE_HEADER_BG,
  }

  const fetchAuditors = async () => {
    setLoading(true)
    setError('')
    try {
      const response = await fetch(apiUrl('/api/siteadmin/auditors'), {
        method: 'GET',
        credentials: 'include',
      })
      const data = await response.json()

      if (response.ok && data.success) {
        setAuditors(Array.isArray(data.data) ? data.data : [])
      } else {
        setError(data.message || 'Failed to fetch auditors')
      }
    } catch (err) {
      console.error('Fetch auditors error:', err)
      setError('Network error while fetching auditors')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAuditors()
  }, [])

  const resetForm = () => {
    setForm({ emp_name: '', email_id: '', mobile: '' })
    setFormErrors({})
  }

  const handleOpenDialog = () => {
    resetForm()
    setDialogOpen(true)
  }

  const handleCloseDialog = () => {
    if (creating) return
    setDialogOpen(false)
    resetForm()
  }

  const validateForm = () => {
    const nextErrors = {}
    const empName = String(form.emp_name || '').trim()
    const emailId = String(form.email_id || '').trim().toLowerCase()
    const mobile = normalizeMobileDigits(form.mobile)

    if (!empName) {
      nextErrors.emp_name = 'Name is required'
    }

    if (!emailId) {
      nextErrors.email_id = 'Email ID is required'
    } else if (!EMAIL_REGEX.test(emailId)) {
      nextErrors.email_id = 'Invalid email format'
    }

    if (!mobile) {
      nextErrors.mobile = 'Mobile number is required'
    } else {
      const mobileValidationError = getMobileValidationError(mobile)
      if (mobileValidationError) {
        nextErrors.mobile = mobileValidationError
      }
    }

    setFormErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  const handleCreate = async () => {
    if (!validateForm()) return

    setCreating(true)
    try {
      const response = await fetch(apiUrl('/api/siteadmin/auditors'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          emp_name: form.emp_name.trim(),
          email_id: form.email_id.trim().toLowerCase(),
          mobile: normalizeMobileDigits(form.mobile),
        }),
      })
      const data = await response.json()

      if (response.ok && data.success) {
        toast.success('Auditor created successfully')
        setDialogOpen(false)
        resetForm()
        fetchAuditors()
      } else {
        toast.error(data.message || 'Failed to create auditor')
      }
    } catch (err) {
      console.error('Create auditor error:', err)
      toast.error('Network error while creating auditor')
    } finally {
      setCreating(false)
    }
  }

  const formatDate = (value) => {
    if (!value) return '-'
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return '-'
    return date.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
  }

  return (
    <>
      <ManagementPageHeader
        title="Auditor Management"
        subtitle="Create auditor accounts and review all existing auditor users."
        actions={
          <Button
            variant="contained"
            color="secondary"
            startIcon={<PersonAddAltRoundedIcon />}
            onClick={handleOpenDialog}
            disabled={creating}
            sx={{ textTransform: 'none', fontWeight: 700 }}
          >
            Create Auditor
          </Button>
        }
      >
        {error ? (
          <Alert severity="error" sx={{ borderRadius: 0, mb: 2 }}>
            {error}
          </Alert>
        ) : null}

        <TableContainer component={Box} sx={getManagementTableContainerSx(theme)}>
          <Table size="medium" sx={{ minWidth: 900, borderCollapse: 'separate', borderSpacing: 0 }}>
            <TableHead>
              <TableRow>
                <TableCell sx={headCellSx}>Name</TableCell>
                <TableCell sx={headCellSx}>Email ID</TableCell>
                <TableCell sx={headCellSx}>Phone Number</TableCell>
                <TableCell sx={headCellSx}>Created At</TableCell>
                <TableCell sx={headCellSx}>Temporary Login</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ py: 5, borderBottom: 0 }}>
                    <CircularProgress size={26} />
                  </TableCell>
                </TableRow>
              ) : auditors.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ py: 5, borderBottom: 0 }}>
                    No auditors found.
                  </TableCell>
                </TableRow>
              ) : (
                auditors.map((auditor, index) => (
                  <TableRow
                    key={auditor.id}
                    sx={{
                      '&:hover': { backgroundColor: TABLE_ROW_HOVER_BG },
                      '&:last-of-type td': { borderBottom: 0 },
                      '& td': {
                        borderBottom:
                          index === auditors.length - 1 ? 0 : `1px solid ${tableBorderColor}`,
                      },
                    }}
                  >
                    <TableCell sx={bodyCellSx}>{auditor.emp_name || '-'}</TableCell>
                    <TableCell sx={bodyCellSx}>{auditor.email_id || '-'}</TableCell>
                    <TableCell sx={bodyCellSx}>{auditor.mobile || '-'}</TableCell>
                    <TableCell sx={bodyCellSx}>{formatDate(auditor.created_at)}</TableCell>
                    <TableCell sx={bodyCellSx}>
                      <Chip
                        size="small"
                        label={auditor.temp_login ? 'Yes' : 'No'}
                        color={auditor.temp_login ? 'warning' : 'success'}
                        variant="outlined"
                      />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </ManagementPageHeader>

      <Dialog
        open={dialogOpen}
        onClose={handleCloseDialog}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: 2 } }}
      >
        <DialogTitle sx={{ fontWeight: 800 }}>Create Auditor</DialogTitle>
        <DialogContent dividers sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
          <TextField
            label="Name"
            value={form.emp_name}
            onChange={(event) => setForm((current) => ({ ...current, emp_name: event.target.value }))}
            required
            disabled={creating}
            error={Boolean(formErrors.emp_name)}
            helperText={formErrors.emp_name}
            fullWidth
          />
          <TextField
            label="Email ID"
            type="email"
            value={form.email_id}
            onChange={(event) => setForm((current) => ({ ...current, email_id: event.target.value }))}
            required
            disabled={creating}
            error={Boolean(formErrors.email_id)}
            helperText={formErrors.email_id || 'This email will be used for auditor login.'}
            fullWidth
          />
          <TextField
            label="Phone Number"
            type="tel"
            value={form.mobile}
            onChange={(event) => setForm((current) => ({ ...current, mobile: event.target.value }))}
            required
            disabled={creating}
            inputProps={{ maxLength: 10 }}
            error={Boolean(formErrors.mobile)}
            helperText={formErrors.mobile}
            fullWidth
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={handleCloseDialog} disabled={creating} sx={{ textTransform: 'none' }}>
            Cancel
          </Button>
          <Button
            onClick={handleCreate}
            variant="contained"
            color="secondary"
            disabled={creating}
            sx={{ textTransform: 'none', fontWeight: 700 }}
          >
            {creating ? 'Creating...' : 'Create Auditor'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}

export default AuditorManagement
