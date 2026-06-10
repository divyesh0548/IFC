import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { alpha, useTheme } from '@mui/material/styles'
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import CircularProgress from '@mui/material/CircularProgress'
import Alert from '@mui/material/Alert'
import FormControl from '@mui/material/FormControl'
import InputLabel from '@mui/material/InputLabel'
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import DialogContentText from '@mui/material/DialogContentText'
import TextField from '@mui/material/TextField'
import IconButton from '@mui/material/IconButton'
import Checkbox from '@mui/material/Checkbox'
import AddIcon from '@mui/icons-material/Add'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import { toast } from 'react-hot-toast'
import { apiUrl } from '../../config/api'
import { useSyncGlobalLoading } from '../../contexts/GlobalLoadingContext'
import {
  PAGE_SUBHEADER_TEXT_SX,
  TABLE_HEADER_BG,
  TABLE_ROW_HOVER_BG,
} from '../../uiConstants'

const addDialogDefaults = {
  open: false,
  mode: 'common',
  submitting: false,
  error: '',
}

function CommunicationMatrix() {
  const theme = useTheme()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [businessProcessFilter, setBusinessProcessFilter] = useState('all')
  const [companyIdentifier, setCompanyIdentifier] = useState('')
  const [mappedUnits, setMappedUnits] = useState([])
  const [businessProcesses, setBusinessProcesses] = useState([])
  const [entries, setEntries] = useState([])
  const [addDialog, setAddDialog] = useState(addDialogDefaults)
  const [selectedUnitIds, setSelectedUnitIds] = useState([])
  const [businessProcessForSpecific, setBusinessProcessForSpecific] = useState('')
  const [emailInputs, setEmailInputs] = useState([''])
  const [deleteMode, setDeleteMode] = useState(false)
  const [selectedEntryIds, setSelectedEntryIds] = useState(new Set())
  const [deleteConfirmDialogOpen, setDeleteConfirmDialogOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useSyncGlobalLoading(loading)
  useSyncGlobalLoading(addDialog.submitting)
  useSyncGlobalLoading(deleting)

  const fetchMatrix = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const search = businessProcessFilter === 'all'
        ? ''
        : `?business_process=${encodeURIComponent(businessProcessFilter)}`
      const response = await fetch(apiUrl(`/api/company-co/communication-matrix${search}`), {
        credentials: 'include',
      })
      const result = await response.json()
      if (!response.ok || !result?.success) {
        throw new Error(result?.message || 'Failed to fetch communication matrix')
      }

      const resolvedCompanyIdentifier = String(result.data?.company_identifier || '')
      const units = Array.isArray(result.data?.mappedUnits) ? result.data.mappedUnits : []
      const processes = Array.isArray(result.data?.businessProcesses) ? result.data.businessProcesses : []
      setCompanyIdentifier(resolvedCompanyIdentifier)
      setMappedUnits(units)
      setBusinessProcesses(processes)
      setEntries(Array.isArray(result.data?.entries) ? result.data.entries : [])
      setSelectedEntryIds(new Set())
      setDeleteMode(false)
    } catch (fetchError) {
      console.error('Fetch communication matrix error:', fetchError)
      setError(fetchError.message || 'Network error while fetching communication matrix')
      setMappedUnits([])
      setBusinessProcesses([])
      setEntries([])
    } finally {
      setLoading(false)
    }
  }, [businessProcessFilter])

  useEffect(() => {
    fetchMatrix()
  }, [fetchMatrix])

  const handleOpenAddDialog = () => {
    const defaultUnitId = String(mappedUnits[0]?.unit_id || '').trim()
    setSelectedUnitIds(defaultUnitId ? [defaultUnitId] : [])
    setBusinessProcessForSpecific(businessProcesses[0] || '')
    setEmailInputs([''])
    setAddDialog({ ...addDialogDefaults, open: true })
  }

  const handleCloseAddDialog = () => {
    if (addDialog.submitting) return
    setAddDialog(addDialogDefaults)
    setEmailInputs([''])
  }

  const normalizedEmails = useMemo(
    () =>
      [...new Set(emailInputs.map((value) => String(value || '').trim().toLowerCase()).filter(Boolean))],
    [emailInputs]
  )

  const handleSubmitAdd = async () => {
    if (selectedUnitIds.length === 0) {
      setAddDialog((prev) => ({ ...prev, error: 'Select at least one unit' }))
      return
    }
    if (normalizedEmails.length === 0) {
      setAddDialog((prev) => ({ ...prev, error: 'Provide at least one email ID' }))
      return
    }
    if (addDialog.mode === 'specific' && !businessProcessForSpecific) {
      setAddDialog((prev) => ({ ...prev, error: 'Select a Business Process' }))
      return
    }

    setAddDialog((prev) => ({ ...prev, submitting: true, error: '' }))
    try {
      const endpoint = addDialog.mode === 'common'
        ? '/api/company-co/communication-matrix/common'
        : '/api/company-co/communication-matrix/specific'
      const payload = {
        email_ids: normalizedEmails,
        unit_ids: selectedUnitIds,
      }
      if (addDialog.mode === 'specific') {
        payload.business_process = businessProcessForSpecific
      }

      const response = await fetch(apiUrl(endpoint), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      })
      const result = await response.json()
      if (!response.ok || !result?.success) {
        throw new Error(result?.message || 'Failed to add communication emails')
      }

      const insertedCount = Number(result.inserted || 0)
      const skippedCount = Number(result.skipped || 0)

      if (insertedCount > 0) {
        toast.success(`Added successfully. Inserted: ${insertedCount}`)
      }
      if (skippedCount > 0) {
        toast.error(`${skippedCount} email(s) already exists for selected unit and business process`)
      }
      handleCloseAddDialog()
      await fetchMatrix()
    } catch (submitError) {
      console.error('Add communication email error:', submitError)
      setAddDialog((prev) => ({
        ...prev,
        submitting: false,
        error: submitError.message || 'Network error while saving communication emails',
      }))
    }
  }

  const handleDeleteEntries = async (entryIds) => {
    const ids = Array.isArray(entryIds) ? entryIds : []
    if (ids.length === 0) {
      toast.error('Select at least one row to delete')
      return
    }

    setDeleting(true)
    try {
      const response = await fetch(apiUrl('/api/company-co/communication-matrix/delete'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ entry_ids: ids }),
      })
      const result = await response.json()
      if (!response.ok || !result?.success) {
        throw new Error(result?.message || 'Failed to delete communication entries')
      }
      toast.success(result.message || 'Communication entries deleted successfully')
      await fetchMatrix()
    } catch (deleteError) {
      console.error('Delete communication entries error:', deleteError)
      toast.error(deleteError.message || 'Network error while deleting communication entries')
    } finally {
      setDeleting(false)
    }
  }

  const handleDeleteModeToggle = () => {
    setDeleteMode(true)
    setSelectedEntryIds(new Set())
  }

  const handleDeleteClick = () => {
    if (selectedEntryIds.size === 0) {
      setDeleteMode(false)
      return
    }
    setDeleteConfirmDialogOpen(true)
  }

  const handleListContainerClick = (event) => {
    if (!deleteMode || deleteConfirmDialogOpen) return
    const target = event?.target
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
    setSelectedEntryIds(new Set())
  }

  const tableBorderColor = alpha(theme.palette.text.primary, theme.palette.mode === 'light' ? 0.16 : 0.2)
  const filterControlSx = { minWidth: { xs: '100%', sm: 240 } }
  const actionButtonSx = { textTransform: 'none', fontWeight: 700 }
  const bodyCellSx = {
    py: 1.55,
    px: 2.25,
    borderBottom: `1px solid ${tableBorderColor}`,
    verticalAlign: 'top',
  }
  const headCellSx = {
    ...bodyCellSx,
    py: 1.7,
    fontSize: '0.92rem',
    fontWeight: 800,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    color: 'text.secondary',
    backgroundColor: TABLE_HEADER_BG,
  }

  return (
    <Box sx={{ px: 0, py: 2 }}>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Paper
        elevation={0}
        sx={{ overflow: 'visible', backgroundColor: 'transparent', boxShadow: 'none', borderRadius: 0 }}
        onClick={handleListContainerClick}
      >
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: { xs: 'stretch', md: 'flex-start' },
            gap: 2,
            px: { xs: 0, sm: 0.5 },
            py: 2.25,
            flexDirection: { xs: 'column', md: 'row' },
            borderBottom: '1px solid',
            borderColor: 'divider',
            mb: 2,
          }}
        >
          <Box sx={{ minWidth: 0 }}>
            <Typography
              component="h1"
              sx={{
                fontSize: { xs: '1.45rem', sm: '1.7rem' },
                fontWeight: 850,
                color: 'text.primary',
                lineHeight: 1.15,
              }}
            >
              Communication CC List
            </Typography>
            <Typography sx={{ ...PAGE_SUBHEADER_TEXT_SX, mt: 0.75, maxWidth: 760 }}>
              Emails added for a business process are included in the CC list on all emails sent for that business process.
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 1.25, alignItems: 'center', flexWrap: 'wrap', justifyContent: { xs: 'flex-start', md: 'flex-end' } }}>
            <FormControl size="small" sx={filterControlSx}>
              <InputLabel id="business-process-filter-label">Business Process</InputLabel>
              <Select
                labelId="business-process-filter-label"
                value={businessProcessFilter}
                label="Business Process"
                onChange={(event) => setBusinessProcessFilter(event.target.value)}
                disabled={loading}
              >
                <MenuItem value="all">All Business Processes</MenuItem>
                {businessProcesses.map((process) => (
                  <MenuItem key={process} value={process}>
                    {process}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Button
              variant="contained"
              color="secondary"
              startIcon={<AddIcon />}
              onClick={handleOpenAddDialog}
              disabled={loading || deleting || mappedUnits.length === 0}
              sx={actionButtonSx}
            >
              Add
            </Button>
            <Button
              variant={deleteMode ? 'contained' : 'outlined'}
              color="error"
              startIcon={<DeleteOutlineIcon />}
              onClick={() => {
                if (deleteMode) {
                  handleDeleteClick()
                } else {
                  handleDeleteModeToggle()
                }
              }}
              disabled={loading || deleting || entries.length === 0 || (deleteMode && selectedEntryIds.size === 0)}
              sx={actionButtonSx}
            >
              {deleteMode
                ? (selectedEntryIds.size > 0 ? `Delete (${selectedEntryIds.size})` : 'Delete')
                : 'Delete'}
            </Button>
          </Box>
        </Box>

        {loading ? (
          <Box sx={{ py: 5, px: 0.5, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1.2 }}>
            <CircularProgress size={24} />
            <Typography color="text.secondary">Loading communication matrix...</Typography>
          </Box>
        ) : (
          <TableContainer
            sx={{
              border: `1px solid ${tableBorderColor}`,
              borderRadius: 1.5,
              overflow: 'hidden',
            }}
          >
            <Table
              sx={{
                minWidth: 720,
                borderCollapse: 'separate',
                borderSpacing: 0,
              }}
            >
              <TableHead>
                <TableRow>
                  {deleteMode ? (
                    <TableCell sx={{ ...headCellSx, width: 54, px: 2 }}>
                      <Checkbox
                        checked={entries.length > 0 && selectedEntryIds.size === entries.length}
                        indeterminate={selectedEntryIds.size > 0 && selectedEntryIds.size < entries.length}
                        onChange={(event) => {
                          if (event.target.checked) {
                            setSelectedEntryIds(new Set(entries.map((entry) => Number(entry.id))))
                          } else {
                            setSelectedEntryIds(new Set())
                          }
                        }}
                        disabled={deleting || entries.length === 0}
                      />
                    </TableCell>
                  ) : null}
                  <TableCell sx={headCellSx}>Business Process</TableCell>
                  <TableCell sx={headCellSx}>Email ID</TableCell>
                  <TableCell sx={headCellSx}>Unit</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {entries.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={deleteMode ? 4 : 3} sx={{ py: 4, px: 2.25, borderBottom: 0 }}>
                      <Typography color="text.secondary">No communication emails found.</Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  entries.map((entry, index) => (
                    <TableRow
                      key={`${entry.id}-${entry.email_id}-${entry.business_process}-${entry.unit_id}`}
                      hover
                      sx={{
                        '&:hover': {
                          backgroundColor: TABLE_ROW_HOVER_BG,
                        },
                        '&:last-of-type td': { borderBottom: 0 },
                        '& td': {
                          borderBottom: index === entries.length - 1 ? 0 : `1px solid ${tableBorderColor}`,
                        },
                      }}
                    >
                      {deleteMode ? (
                        <TableCell sx={{ ...bodyCellSx, px: 2 }}>
                          <Checkbox
                            checked={selectedEntryIds.has(Number(entry.id))}
                            onChange={(event) => {
                              const entryId = Number(entry.id)
                              setSelectedEntryIds((prev) => {
                                const next = new Set(prev)
                                if (event.target.checked) next.add(entryId)
                                else next.delete(entryId)
                                return next
                              })
                            }}
                            disabled={deleting}
                          />
                        </TableCell>
                      ) : null}
                      <TableCell sx={bodyCellSx}>{entry.business_process || '-'}</TableCell>
                      <TableCell sx={bodyCellSx}>{entry.email_id || '-'}</TableCell>
                      <TableCell sx={bodyCellSx}>{entry.unit_name || entry.unit_id || '-'}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      <Dialog open={addDialog.open} onClose={handleCloseAddDialog} fullWidth maxWidth="sm">
        <DialogTitle>Add Communication Email</DialogTitle>
        <DialogContent dividers sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2.5 }}>
          <FormControl fullWidth>
            <InputLabel id="add-mode-label">Option</InputLabel>
            <Select
              labelId="add-mode-label"
              value={addDialog.mode}
              label="Option"
              onChange={(event) =>
                setAddDialog((prev) => ({ ...prev, mode: event.target.value, error: '' }))
              }
              disabled={addDialog.submitting}
            >
              <MenuItem value="common">Add common CC email for all Business Process</MenuItem>
              <MenuItem value="specific">Business Process specific email</MenuItem>
            </Select>
          </FormControl>

          {addDialog.mode === 'specific' && (
            <FormControl fullWidth required>
              <InputLabel id="specific-business-process-label">Business Process</InputLabel>
              <Select
                labelId="specific-business-process-label"
                value={businessProcessForSpecific}
                label="Business Process"
                onChange={(event) => setBusinessProcessForSpecific(event.target.value)}
                disabled={addDialog.submitting}
              >
                {businessProcesses.map((process) => (
                  <MenuItem key={process} value={process}>
                    {process}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}

          <FormControl fullWidth required>
            <InputLabel id="unit-multi-select-label">Units</InputLabel>
            <Select
              labelId="unit-multi-select-label"
              multiple
              value={selectedUnitIds}
              label="Units"
              onChange={(event) => {
                const nextValue = Array.isArray(event.target.value) ? event.target.value : []
                if (nextValue.length === 0) return
                setSelectedUnitIds(nextValue)
                setAddDialog((prev) => ({ ...prev, error: '' }))
              }}
              renderValue={(selected) => selected
                .map((unitId) => mappedUnits.find((unit) => String(unit.unit_id) === String(unitId))?.unit_name || unitId)
                .join(', ')}
              disabled={addDialog.submitting || mappedUnits.length === 0}
            >
              {mappedUnits.map((unit) => (
                <MenuItem key={unit.unit_id} value={unit.unit_id}>
                  {unit.unit_name || unit.unit_id}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <Typography sx={{ fontWeight: 600 }}>Email IDs</Typography>
            {emailInputs.map((email, index) => (
              <Box key={`email-${index}`} sx={{ display: 'flex', gap: 1 }}>
                <TextField
                  fullWidth
                  type="email"
                  label={`Email ID ${index + 1}`}
                  value={email}
                  onChange={(event) => {
                    const next = [...emailInputs]
                    next[index] = event.target.value
                    setEmailInputs(next)
                    setAddDialog((prev) => ({ ...prev, error: '' }))
                  }}
                  disabled={addDialog.submitting}
                />
                <IconButton
                  color="error"
                  disabled={addDialog.submitting || emailInputs.length === 1}
                  onClick={() => {
                    if (emailInputs.length === 1) return
                    setEmailInputs((prev) => prev.filter((_, rowIndex) => rowIndex !== index))
                  }}
                >
                  <DeleteOutlineIcon />
                </IconButton>
              </Box>
            ))}
            <Button
              variant="text"
              startIcon={<AddIcon />}
              onClick={() => setEmailInputs((prev) => [...prev, ''])}
              disabled={addDialog.submitting}
              sx={{ textTransform: 'none', alignSelf: 'flex-start' }}
            >
              Add Email
            </Button>
          </Box>

          {addDialog.error && <Alert severity="error">{addDialog.error}</Alert>}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseAddDialog} disabled={addDialog.submitting}>Cancel</Button>
          <Button variant="contained" onClick={handleSubmitAdd} disabled={addDialog.submitting}>
            {addDialog.submitting ? 'Saving...' : 'Submit'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={deleteConfirmDialogOpen}
        onClose={() => !deleting && setDeleteConfirmDialogOpen(false)}
        fullWidth
        maxWidth="xs"
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
          <DialogContentText>
            Deleting selected communication entr{selectedEntryIds.size === 1 ? 'y' : 'ies'} cannot be undone.
          </DialogContentText>
          <Typography sx={{ mt: 1.5, fontWeight: 600 }}>
            Total selected: {selectedEntryIds.size}
          </Typography>
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
            onClick={() => setDeleteConfirmDialogOpen(false)}
            variant="outlined"
            disabled={deleting}
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
            disabled={deleting || selectedEntryIds.size === 0}
            onClick={async () => {
              setDeleteConfirmDialogOpen(false)
              await handleDeleteEntries(Array.from(selectedEntryIds))
              setDeleteMode(false)
              setSelectedEntryIds(new Set())
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
            {deleting ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

export default CommunicationMatrix
