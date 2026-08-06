import React, { useMemo, useState } from 'react'
import { useTheme } from '@mui/material/styles'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import CircularProgress from '@mui/material/CircularProgress'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import AddRoundedIcon from '@mui/icons-material/AddRounded'
import { toast } from 'react-hot-toast'
import ManagementPageHeader from '../../components/ManagementPageHeader'
import { apiUrl } from '../../config/api'
import { useBusinessProcesses } from '../../hooks/useBusinessProcesses'
import {
  getManagementTableBorderColor,
  getManagementTableContainerSx,
  TABLE_HEADER_BG,
  TABLE_ROW_HOVER_BG,
} from '../../uiConstants'

function BusinessProcessManagement() {
  const theme = useTheme()
  const { businessProcesses, loading, refreshBusinessProcesses } = useBusinessProcesses()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState({
    business_process: '',
    business_process_code: '',
  })

  const tableBorderColor = getManagementTableBorderColor(theme)
  const bodyCellSx = {
    py: 1.55,
    px: 2.25,
    borderBottom: `1px solid ${tableBorderColor}`,
    verticalAlign: 'middle',
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

  const sortedRows = useMemo(
    () => [...businessProcesses].sort((a, b) => {
      if (Boolean(a.is_default) !== Boolean(b.is_default)) {
        return a.is_default ? -1 : 1
      }
      return String(a.business_process || '').localeCompare(String(b.business_process || ''))
    }),
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
      const response = await fetch(apiUrl('/api/company-admin/business-processes'), {
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
        toast.success('Company specific business process created successfully')
        handleCloseDialog()
        await refreshBusinessProcesses()
      } else {
        toast.error(result?.message || 'Failed to create Business Process')
      }
    } catch (error) {
      console.error('Create company admin business process error:', error)
      toast.error('Failed to create Business Process')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <ManagementPageHeader
        title="Business Process Management"
        subtitle="Add company-specific business process names with codes."
        actions={
          <Button
            variant="contained"
            color="secondary"
            startIcon={<AddRoundedIcon />}
            onClick={() => setDialogOpen(true)}
            sx={{ textTransform: 'none', fontWeight: 700 }}
          >
            Add Company Process
          </Button>
        }
      >
        <TableContainer component={Box} sx={getManagementTableContainerSx(theme)}>
          <Table size="medium" sx={{ minWidth: 720, borderCollapse: 'separate', borderSpacing: 0 }}>
            <TableHead>
              <TableRow>
                <TableCell sx={{ ...headCellSx, width: 72 }}>#</TableCell>
                <TableCell sx={headCellSx}>Business Process</TableCell>
                <TableCell sx={{ ...headCellSx, width: 180 }}>Code</TableCell>
                <TableCell sx={{ ...headCellSx, width: 190 }}>Scope</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={4} align="center" sx={{ py: 5, borderBottom: 0 }}>
                    <CircularProgress size={26} />
                  </TableCell>
                </TableRow>
              ) : sortedRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} align="center" sx={{ py: 5, borderBottom: 0 }}>
                    No business process found.
                  </TableCell>
                </TableRow>
              ) : (
                sortedRows.map((row, index) => (
                  <TableRow
                    key={row.id || `${row.business_process}-${row.business_process_code}`}
                    sx={{
                      '&:hover': { backgroundColor: TABLE_ROW_HOVER_BG },
                      '&:last-of-type td': { borderBottom: 0 },
                      '& td': {
                        borderBottom:
                          index === sortedRows.length - 1 ? 0 : `1px solid ${tableBorderColor}`,
                      },
                    }}
                  >
                    <TableCell sx={{ ...bodyCellSx, fontWeight: 700, color: 'text.secondary' }}>
                      {index + 1}
                    </TableCell>
                    <TableCell sx={bodyCellSx}>
                      <Typography sx={{ fontWeight: 700 }}>{row.business_process}</Typography>
                    </TableCell>
                    <TableCell sx={bodyCellSx}>
                      <Typography
                        sx={{
                          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono, monospace',
                          fontSize: '0.92rem',
                          fontWeight: 700,
                        }}
                      >
                        {row.business_process_code}
                      </Typography>
                    </TableCell>
                    <TableCell sx={bodyCellSx}>
                      <Chip
                        size="small"
                        label={row.is_default ? 'Common' : 'Company Specific'}
                        color={row.is_default ? 'primary' : 'secondary'}
                        variant={row.is_default ? 'outlined' : 'filled'}
                        sx={{ fontWeight: 700 }}
                      />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </ManagementPageHeader>

      <Dialog open={dialogOpen} onClose={handleCloseDialog} fullWidth maxWidth="sm">
        <DialogTitle>Add Company Specific Business Process</DialogTitle>
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
