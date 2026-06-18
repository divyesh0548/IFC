import React, { useMemo, useState } from 'react'
import { alpha, useTheme } from '@mui/material/styles'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import Paper from '@mui/material/Paper'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import AddRoundedIcon from '@mui/icons-material/AddRounded'
import AccountTreeRoundedIcon from '@mui/icons-material/AccountTreeRounded'
import { toast } from 'react-hot-toast'
import { apiUrl } from '../../config/api'
import { useSyncGlobalLoading } from '../../contexts/GlobalLoadingContext'
import { useBusinessProcesses } from '../../hooks/useBusinessProcesses'

function BusinessProcessManagement() {
  const theme = useTheme()
  const { businessProcesses, loading, refreshBusinessProcesses } = useBusinessProcesses()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState({
    business_process: '',
    business_process_code: '',
  })
  useSyncGlobalLoading(loading || saving)

  const sortedRows = useMemo(
    () => [...businessProcesses].sort((a, b) => a.business_process.localeCompare(b.business_process)),
    [businessProcesses]
  )

  const resetForm = () => {
    setFormData({
      business_process: '',
      business_process_code: '',
    })
  }

  const handleCloseDialog = () => {
    if (saving) return
    setDialogOpen(false)
    resetForm()
  }

  const handleSubmit = async () => {
    const businessProcess = String(formData.business_process || '').trim()
    const businessProcessCode = String(formData.business_process_code || '').trim()

    if (!businessProcess) {
      toast.error('Business Process is required')
      return
    }

    if (!businessProcessCode) {
      toast.error('Business Process code is required')
      return
    }

    setSaving(true)
    try {
      const response = await fetch(apiUrl('/api/siteadmin/business-processes'), {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          business_process: businessProcess,
          business_process_code: businessProcessCode,
        }),
      })
      const result = await response.json()

      if (response.ok && result?.success) {
        toast.success('Business Process created successfully')
        handleCloseDialog()
        await refreshBusinessProcesses()
      } else {
        toast.error(result?.message || 'Failed to create Business Process')
      }
    } catch (error) {
      console.error('Create siteadmin business process error:', error)
      toast.error('Failed to create Business Process')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Box sx={{ display: 'grid', gap: 3, px: 0, py: 1 }}>
      <Paper
        elevation={0}
        sx={{
          p: { xs: 2.5, md: 3 },
          borderRadius: 3,
          border: '1px solid',
          borderColor:
            theme.palette.mode === 'dark'
              ? alpha(theme.palette.common.white, 0.08)
              : alpha(theme.palette.primary.main, 0.12),
          background: theme.palette.gradients?.hero,
        }}
      >
        <Box
          sx={{
            display: 'flex',
            flexDirection: { xs: 'column', sm: 'row' },
            alignItems: { xs: 'flex-start', sm: 'center' },
            justifyContent: 'space-between',
            gap: 2,
          }}
        >
          <Box sx={{ display: 'grid', gap: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <AccountTreeRoundedIcon sx={{ color: theme.palette.primary.main }} />
              <Typography sx={{ fontSize: '0.82rem', fontWeight: 800, color: theme.palette.text.secondary }}>
                Siteadmin
              </Typography>
            </Box>
            <Typography sx={{ fontSize: { xs: '1.7rem', md: '2.1rem' }, fontWeight: 900, lineHeight: 1.1 }}>
              Business Process Management
            </Typography>
            <Typography sx={{ color: theme.palette.text.secondary, maxWidth: 760 }}>
              Maintain the central business-process master used by RACM creation, uploads, and dashboards.
            </Typography>
          </Box>

          <Button
            variant="contained"
            color="secondary"
            startIcon={<AddRoundedIcon />}
            onClick={() => setDialogOpen(true)}
            sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 999 }}
          >
            Add Business Process
          </Button>
        </Box>
      </Paper>

      <Paper
        elevation={0}
        sx={{
          borderRadius: 3,
          border: '1px solid',
          borderColor:
            theme.palette.mode === 'dark'
              ? alpha(theme.palette.common.white, 0.08)
              : alpha(theme.palette.divider, 1),
          overflow: 'hidden',
        }}
      >
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 800 }}>#</TableCell>
                <TableCell sx={{ fontWeight: 800 }}>Business Process</TableCell>
                <TableCell sx={{ fontWeight: 800 }}>Code</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={3} sx={{ py: 4, textAlign: 'center', color: 'text.secondary' }}>
                    Loading business processes...
                  </TableCell>
                </TableRow>
              ) : sortedRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} sx={{ py: 4, textAlign: 'center', color: 'text.secondary' }}>
                    No business process found.
                  </TableCell>
                </TableRow>
              ) : (
                sortedRows.map((row, index) => (
                  <TableRow key={row.id || `${row.business_process}-${row.business_process_code}`}>
                    <TableCell>{index + 1}</TableCell>
                    <TableCell>{row.business_process}</TableCell>
                    <TableCell>{row.business_process_code}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      <Dialog open={dialogOpen} onClose={handleCloseDialog} fullWidth maxWidth="sm">
        <DialogTitle>Add Business Process</DialogTitle>
        <DialogContent sx={{ display: 'grid', gap: 2, pt: '10px !important' }}>
          <TextField
            label="Business Process"
            value={formData.business_process}
            onChange={(event) => setFormData((prev) => ({ ...prev, business_process: event.target.value }))}
            disabled={saving}
            fullWidth
          />
          <TextField
            label="Business Process Code"
            value={formData.business_process_code}
            onChange={(event) => setFormData((prev) => ({ ...prev, business_process_code: event.target.value }))}
            disabled={saving}
            fullWidth
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={handleCloseDialog} disabled={saving}>Cancel</Button>
          <Button onClick={handleSubmit} variant="contained" color="secondary" disabled={saving}>
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

export default BusinessProcessManagement
