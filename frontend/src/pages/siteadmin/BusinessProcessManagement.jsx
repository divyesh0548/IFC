import React, { useMemo, useState } from 'react'
import { useTheme } from '@mui/material/styles'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import CircularProgress from '@mui/material/CircularProgress'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import AddRoundedIcon from '@mui/icons-material/AddRounded'
import { toast } from 'react-hot-toast'
import ManagementPageHeader from '../../components/ManagementPageHeader'
import { apiUrl } from '../../config/api'
import { useSyncGlobalLoading } from '../../contexts/GlobalLoadingContext'
import { useBusinessProcesses } from '../../hooks/useBusinessProcesses'
import { getManagementTableBorderColor } from '../../uiConstants'

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

  const borderColor = getManagementTableBorderColor(theme)

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
    <>
      <ManagementPageHeader
        title="Business Process Management"
        subtitle="Maintain the central business-process master used by RACM creation, uploads, and dashboards."
        actions={
          <Button
            variant="contained"
            color="secondary"
            startIcon={<AddRoundedIcon />}
            onClick={() => setDialogOpen(true)}
            sx={{ textTransform: 'none', fontWeight: 700 }}
          >
            Add Business Process
          </Button>
        }
      >
        <Box
          sx={{
            border: `1px solid ${borderColor}`,
            borderRadius: 1.5,
            overflow: 'hidden',
            backgroundColor: theme.palette.mode === 'dark'
              ? 'rgba(15, 23, 42, 0.96)'
              : 'rgba(255, 255, 255, 0.92)',
          }}
        >
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 5 }}>
              <CircularProgress size={26} />
            </Box>
          ) : sortedRows.length === 0 ? (
            <Typography sx={{ py: 5, px: 2.25, textAlign: 'center', color: 'text.secondary' }}>
              No business process found.
            </Typography>
          ) : (
            sortedRows.map((row, index) => (
              <Box
                key={row.id || `${row.business_process}-${row.business_process_code}`}
                sx={{
                  display: 'flex',
                  alignItems: 'baseline',
                  justifyContent: 'space-between',
                  gap: 2,
                  flexWrap: 'wrap',
                  px: 2.25,
                  py: 1.65,
                  borderBottom: index === sortedRows.length - 1 ? 0 : `1px solid ${borderColor}`,
                  '&:hover': { backgroundColor: 'action.hover' },
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1.5, minWidth: 0 }}>
                  <Typography sx={{ color: 'text.secondary', fontWeight: 600, fontSize: '0.85rem', width: 28, flexShrink: 0 }}>
                    {index + 1}.
                  </Typography>
                  <Typography sx={{ fontWeight: 700, color: 'text.primary', lineHeight: 1.4 }}>
                    {row.business_process}
                  </Typography>
                </Box>
                <Typography
                  sx={{
                    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono, monospace',
                    fontSize: '0.9rem',
                    fontWeight: 700,
                    color: 'text.secondary',
                  }}
                >
                  {row.business_process_code}
                </Typography>
              </Box>
            ))
          )}
        </Box>
      </ManagementPageHeader>

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
    </>
  )
}

export default BusinessProcessManagement
