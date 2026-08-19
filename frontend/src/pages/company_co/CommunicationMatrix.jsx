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
import ListItemText from '@mui/material/ListItemText'
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
import InputAdornment from '@mui/material/InputAdornment'
import SearchIcon from '@mui/icons-material/Search'
import AddIcon from '@mui/icons-material/Add'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import EditNoteRoundedIcon from '@mui/icons-material/EditNoteRounded'
import { toast } from 'react-hot-toast'
import { apiUrl } from '../../config/api'
import { useSyncGlobalLoading } from '../../contexts/GlobalLoadingContext'
import {
  DASHBOARD_PAGE_OUTER_SX,
  FILTER_DROPDOWN_MIN_WIDTH_LG,
  PAGE_SUBHEADER_TEXT_SX,
  TABLE_HEADER_BG,
  TABLE_ROW_HOVER_BG,
} from '../../uiConstants'

const ALL_PROCESSES_KEYWORD = 'All_Processes'
const ALL_PROCESSES_LABEL = 'All Business Process'

const addDialogDefaults = {
  open: false,
  mode: 'common',
  submitting: false,
  error: '',
}

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase()
}

function formatBusinessProcessDisplay(value) {
  const normalized = String(value || '').trim()
  if (normalized === ALL_PROCESSES_KEYWORD) return ALL_PROCESSES_LABEL
  return normalized || '-'
}

function isAllProcessesEntry(value) {
  return String(value || '').trim() === ALL_PROCESSES_KEYWORD
}

function mapDisplayEntries(rawEntries) {
  return (rawEntries || [])
    .map((entry) => {
      const entryId = Number(entry.id)
      return {
        key: `entry-${entryId}`,
        email_id: entry.email_id,
        unit_id: entry.unit_id,
        unit_name: entry.unit_name,
        business_process: entry.business_process,
        business_process_display: formatBusinessProcessDisplay(entry.business_process),
        entryIds: entryId ? [entryId] : [],
        isAllBusinessProcesses: isAllProcessesEntry(entry.business_process),
      }
    })
    .sort((left, right) => {
      const processCompare = String(left.business_process_display || '').localeCompare(String(right.business_process_display || ''))
      if (processCompare !== 0) return processCompare
      const emailCompare = String(left.email_id || '').localeCompare(String(right.email_id || ''))
      if (emailCompare !== 0) return emailCompare
      return String(left.unit_name || left.unit_id || '').localeCompare(String(right.unit_name || right.unit_id || ''))
    })
}

function CommunicationMatrix() {
  const theme = useTheme()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [businessProcessFilter, setBusinessProcessFilter] = useState('all')
  const [unitFilter, setUnitFilter] = useState('all')
  const [emailSearch, setEmailSearch] = useState('')
  const [mappedUnits, setMappedUnits] = useState([])
  const [businessProcesses, setBusinessProcesses] = useState([])
  const [entries, setEntries] = useState([])
  const [addDialog, setAddDialog] = useState(addDialogDefaults)
  const [selectedUnitIds, setSelectedUnitIds] = useState([])
  const [selectedBusinessProcesses, setSelectedBusinessProcesses] = useState([])
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
      const response = await fetch(apiUrl('/api/company-co/communication-matrix'), {
        credentials: 'include',
      })
      const result = await response.json()
      if (!response.ok || !result?.success) {
        throw new Error(result?.message || 'Failed to fetch communication matrix')
      }

      const units = Array.isArray(result.data?.mappedUnits) ? result.data.mappedUnits : []
      const processes = Array.isArray(result.data?.businessProcesses) ? result.data.businessProcesses : []
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
  }, [])

  useEffect(() => {
    fetchMatrix()
  }, [fetchMatrix])

  const displayEntries = useMemo(() => {
    let rows = mapDisplayEntries(entries)

    if (unitFilter !== 'all') {
      rows = rows.filter((row) => String(row.unit_id || '').trim() === unitFilter)
    }

    if (businessProcessFilter !== 'all') {
      rows = rows.filter((row) => (
        row.isAllBusinessProcesses || String(row.business_process || '').trim() === businessProcessFilter
      ))
    }

    const searchTerm = emailSearch.trim().toLowerCase()
    if (searchTerm) {
      rows = rows.filter((row) => normalizeEmail(row.email_id).includes(searchTerm))
    }

    return rows
  }, [entries, unitFilter, businessProcessFilter, emailSearch])

  const allVisibleEntryIds = useMemo(
    () => [...new Set(displayEntries.flatMap((row) => row.entryIds))],
    [displayEntries]
  )

  const handleOpenAddDialog = () => {
    const defaultUnitId = String(mappedUnits[0]?.unit_id || '').trim()
    setSelectedUnitIds(defaultUnitId ? [defaultUnitId] : [])
    setSelectedBusinessProcesses(businessProcesses[0] ? [businessProcesses[0]] : [])
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
      [...new Set(emailInputs.map((value) => normalizeEmail(value)).filter(Boolean))],
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
    if (addDialog.mode === 'specific' && selectedBusinessProcesses.length === 0) {
      setAddDialog((prev) => ({ ...prev, error: 'Select at least one Business Process' }))
      return
    }

    setAddDialog((prev) => ({ ...prev, submitting: true, error: '' }))
    try {
      let totalInserted = 0
      let totalSkipped = 0

      if (addDialog.mode === 'common') {
        const response = await fetch(apiUrl('/api/company-co/communication-matrix/common'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            email_ids: normalizedEmails,
            unit_ids: selectedUnitIds,
          }),
        })
        const result = await response.json()
        if (!response.ok || !result?.success) {
          throw new Error(result?.message || 'Failed to add communication emails')
        }
        totalInserted += Number(result.inserted || 0)
        totalSkipped += Number(result.skipped || 0)
      } else {
        for (const businessProcess of selectedBusinessProcesses) {
          const response = await fetch(apiUrl('/api/company-co/communication-matrix/specific'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              email_ids: normalizedEmails,
              unit_ids: selectedUnitIds,
              business_process: businessProcess,
            }),
          })
          const result = await response.json()
          if (!response.ok || !result?.success) {
            throw new Error(result?.message || 'Failed to add communication emails')
          }
          totalInserted += Number(result.inserted || 0)
          totalSkipped += Number(result.skipped || 0)
        }
      }

      if (totalInserted > 0) {
        toast.success(`Added successfully. Inserted: ${totalInserted}`)
      }
      if (totalSkipped > 0) {
        toast.error(`${totalSkipped} email(s) already exist for the selected unit${addDialog.mode === 'specific' ? ' and business process' : ''}`)
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

  const toggleDisplayRowSelection = (row, checked) => {
    setSelectedEntryIds((prev) => {
      const next = new Set(prev)
      row.entryIds.forEach((entryId) => {
        if (checked) next.add(entryId)
        else next.delete(entryId)
      })
      return next
    })
  }

  const isDisplayRowSelected = (row) => row.entryIds.every((entryId) => selectedEntryIds.has(entryId))

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
  const filterControlSx = { minWidth: FILTER_DROPDOWN_MIN_WIDTH_LG, maxWidth: FILTER_DROPDOWN_MIN_WIDTH_LG, flex: '0 0 auto' }
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
    <Box sx={DASHBOARD_PAGE_OUTER_SX}>
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
              Emails added for a business process are included in the CC list of all emails sent for that business process.
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 1.25, alignItems: 'center', flexWrap: 'wrap', justifyContent: { xs: 'flex-start', md: 'flex-end' } }}>
            <Button
              variant="outlined"
              startIcon={<EditNoteRoundedIcon />}
              onClick={() => navigate('/company-co/email-customization')}
              sx={actionButtonSx}
            >
              Customize Email
            </Button>
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
              disabled={loading || deleting || displayEntries.length === 0 || (deleteMode && selectedEntryIds.size === 0)}
              sx={actionButtonSx}
            >
              {deleteMode
                ? (selectedEntryIds.size > 0 ? `Delete (${selectedEntryIds.size})` : 'Delete')
                : 'Delete'}
            </Button>
          </Box>
        </Box>

        <Box
          sx={{
            display: 'flex',
            flexWrap: 'nowrap',
            overflowX: 'auto',
            overflowY: 'visible',
            alignItems: 'flex-start',
            gap: 2,
            mb: 2,
            pt: 0.5,
            pb: 0.5,
          }}
        >
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

          <FormControl size="small" sx={filterControlSx}>
            <InputLabel id="unit-filter-label">Unit</InputLabel>
            <Select
              labelId="unit-filter-label"
              value={unitFilter}
              label="Unit"
              onChange={(event) => setUnitFilter(event.target.value)}
              disabled={loading}
            >
              <MenuItem value="all">All Units</MenuItem>
              {mappedUnits.map((unit) => (
                <MenuItem key={unit.unit_id} value={unit.unit_id}>
                  {unit.unit_name || unit.unit_id}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <TextField
            size="small"
            label="Search Email"
            value={emailSearch}
            onChange={(event) => setEmailSearch(event.target.value)}
            disabled={loading}
            sx={{ minWidth: FILTER_DROPDOWN_MIN_WIDTH_LG, maxWidth: FILTER_DROPDOWN_MIN_WIDTH_LG, flex: '0 0 auto' }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
            }}
          />
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
                        checked={allVisibleEntryIds.length > 0 && allVisibleEntryIds.every((entryId) => selectedEntryIds.has(entryId))}
                        indeterminate={
                          allVisibleEntryIds.some((entryId) => selectedEntryIds.has(entryId))
                          && !allVisibleEntryIds.every((entryId) => selectedEntryIds.has(entryId))
                        }
                        onChange={(event) => {
                          if (event.target.checked) {
                            setSelectedEntryIds(new Set(allVisibleEntryIds))
                          } else {
                            setSelectedEntryIds(new Set())
                          }
                        }}
                        disabled={deleting || allVisibleEntryIds.length === 0}
                      />
                    </TableCell>
                  ) : null}
                  <TableCell sx={headCellSx}>Business Process</TableCell>
                  <TableCell sx={headCellSx}>Email ID</TableCell>
                  <TableCell sx={headCellSx}>Unit</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {displayEntries.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={deleteMode ? 4 : 3} sx={{ py: 4, px: 2.25, borderBottom: 0 }}>
                      <Typography color="text.secondary">No communication emails found.</Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  displayEntries.map((row, index) => (
                    <TableRow
                      key={row.key}
                      hover
                      sx={{
                        '&:hover': {
                          backgroundColor: TABLE_ROW_HOVER_BG,
                        },
                        '&:last-of-type td': { borderBottom: 0 },
                        '& td': {
                          borderBottom: index === displayEntries.length - 1 ? 0 : `1px solid ${tableBorderColor}`,
                        },
                      }}
                    >
                      {deleteMode ? (
                        <TableCell sx={{ ...bodyCellSx, px: 2 }}>
                          <Checkbox
                            checked={isDisplayRowSelected(row)}
                            onChange={(event) => toggleDisplayRowSelection(row, event.target.checked)}
                            disabled={deleting}
                          />
                        </TableCell>
                      ) : null}
                      <TableCell sx={bodyCellSx}>{row.business_process_display}</TableCell>
                      <TableCell sx={bodyCellSx}>{row.email_id || '-'}</TableCell>
                      <TableCell sx={bodyCellSx}>{row.unit_name || row.unit_id || '-'}</TableCell>
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
              <InputLabel id="specific-business-process-label">Business Processes</InputLabel>
              <Select
                labelId="specific-business-process-label"
                multiple
                value={selectedBusinessProcesses}
                label="Business Processes"
                onChange={(event) => {
                  const nextValue = typeof event.target.value === 'string'
                    ? event.target.value.split(',')
                    : event.target.value
                  if (nextValue.length === 0) return
                  setSelectedBusinessProcesses(nextValue)
                  setAddDialog((prev) => ({ ...prev, error: '' }))
                }}
                renderValue={(selected) => selected.join(', ')}
                disabled={addDialog.submitting}
              >
                {businessProcesses.map((process) => (
                  <MenuItem key={process} value={process}>
                    <Checkbox checked={selectedBusinessProcesses.includes(process)} size="small" />
                    <ListItemText primary={process} />
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
                const nextValue = typeof event.target.value === 'string'
                  ? event.target.value.split(',')
                  : event.target.value
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
                  <Checkbox checked={selectedUnitIds.includes(unit.unit_id)} size="small" />
                  <ListItemText primary={unit.unit_name || unit.unit_id} />
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
            px: 2.5,
            py: 2.5,
            fontWeight: 600,
            fontSize: '1.25rem',
            color: theme.palette.text.primary,
          }}
        >
          Confirm Delete
        </DialogTitle>
        <DialogContent sx={{ px: 3, mt: 1.5 }}>
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
