import React, { useEffect, useState } from 'react'
import { alpha, useTheme } from '@mui/material/styles'
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import TextField from '@mui/material/TextField'
import Button from '@mui/material/Button'
import Alert from '@mui/material/Alert'
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
import { apiUrl } from '../../config/api'
import { useSyncGlobalLoading } from '../../contexts/GlobalLoadingContext'

function AuditorManagement() {
  const theme = useTheme()
  const [auditors, setAuditors] = useState([])
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')

  useSyncGlobalLoading(loading || creating)

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

  const handleCreate = async (event) => {
    event.preventDefault()
    const emailId = email.trim().toLowerCase()

    if (!emailId) {
      toast.error('Email ID is required')
      return
    }

    setCreating(true)
    try {
      const response = await fetch(apiUrl('/api/siteadmin/auditors'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email_id: emailId }),
      })
      const data = await response.json()

      if (response.ok && data.success) {
        toast.success('Auditor created successfully')
        setEmail('')
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
    <Box sx={{ py: 2 }}>
      <Paper
        sx={{
          p: 3,
          borderRadius: 2,
          border: '1px solid',
          borderColor: 'divider',
          backgroundColor: theme.palette.background.paper,
        }}
      >
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: { xs: 'stretch', md: 'flex-end' },
            gap: 2,
            flexDirection: { xs: 'column', md: 'row' },
            mb: 3,
          }}
        >
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 800 }}>
              Auditor Management
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
              Create auditor accounts and review all existing auditor users.
            </Typography>
          </Box>

          <Box
            component="form"
            onSubmit={handleCreate}
            sx={{
              display: 'flex',
              gap: 1.5,
              alignItems: 'center',
              flexDirection: { xs: 'column', sm: 'row' },
              width: { xs: '100%', md: 'auto' },
            }}
          >
            <TextField
              label="Auditor Email ID"
              type="email"
              size="small"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={creating}
              sx={{ minWidth: { xs: '100%', sm: 280 } }}
            />
            <Button
              type="submit"
              variant="contained"
              color="secondary"
              startIcon={<PersonAddAltRoundedIcon />}
              disabled={creating}
              sx={{ textTransform: 'none', fontWeight: 700, width: { xs: '100%', sm: 'auto' } }}
            >
              {creating ? 'Creating...' : 'Create Auditor'}
            </Button>
          </Box>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <TableContainer
          component={Paper}
          elevation={0}
          sx={{
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 1,
            overflow: 'auto',
          }}
        >
          <Table sx={{ minWidth: 720 }}>
            <TableHead>
              <TableRow
                sx={{
                  '& .MuiTableCell-root': {
                    backgroundColor: alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.16 : 0.07),
                    fontWeight: 800,
                  },
                }}
              >
                <TableCell>Email ID</TableCell>
                <TableCell>Created At</TableCell>
                <TableCell>Login Email</TableCell>
                <TableCell>Temporary Login</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={4} align="center" sx={{ py: 5 }}>
                    <CircularProgress size={26} />
                  </TableCell>
                </TableRow>
              ) : auditors.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} align="center" sx={{ py: 5 }}>
                    No auditors found.
                  </TableCell>
                </TableRow>
              ) : (
                auditors.map((auditor) => (
                  <TableRow key={auditor.id} hover>
                    <TableCell>{auditor.email_id || '-'}</TableCell>
                    <TableCell>{formatDate(auditor.created_at)}</TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={auditor.login_email_sent ? 'Sent' : 'Pending'}
                        color={auditor.login_email_sent ? 'success' : 'warning'}
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={Number(auditor.temp_login) === 1 ? 'Yes' : 'No'}
                        color={Number(auditor.temp_login) === 1 ? 'warning' : 'success'}
                        variant="outlined"
                      />
                    </TableCell>
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

export default AuditorManagement
