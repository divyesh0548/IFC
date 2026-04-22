import React, { useCallback, useEffect, useRef, useState } from 'react'
import { alpha, useTheme } from '@mui/material/styles'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import CircularProgress from '@mui/material/CircularProgress'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import FormControl from '@mui/material/FormControl'
import InputLabel from '@mui/material/InputLabel'
import MenuItem from '@mui/material/MenuItem'
import Paper from '@mui/material/Paper'
import Select from '@mui/material/Select'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import AddRoundedIcon from '@mui/icons-material/AddRounded'
import ApartmentRoundedIcon from '@mui/icons-material/ApartmentRounded'
import BadgeRoundedIcon from '@mui/icons-material/BadgeRounded'
import FactCheckRoundedIcon from '@mui/icons-material/FactCheckRounded'
import GroupsRoundedIcon from '@mui/icons-material/GroupsRounded'
import { toast } from 'react-hot-toast'
import { useSyncGlobalLoading } from '../../contexts/GlobalLoadingContext'

const emptyData = {
  currentCoordinatorUnits: [],
  approvers: [],
  coordinators: [],
  unmappedCoordinatorUnits: [],
  unmappedApproverUnits: [],
  assignmentCoordinators: [],
  assignmentApprovers: [],
  units: [],
}

const createDialogDefaults = {
  open: false,
  type: 'coordinator',
  email: '',
  unitId: '',
  submitting: false,
  error: '',
}

const unitDialogDefaults = {
  open: false,
  unitName: '',
  unitAddress: '',
  submitting: false,
  error: '',
}

const assignmentDialogDefaults = {
  open: false,
  unit: null,
  role: 'company_co',
  email: '',
  submitting: false,
  error: '',
}

function SummaryPanel({ title, count, icon }) {
  const theme = useTheme()

  return (
    <Paper
      elevation={0}
      sx={{
        p: 2.5,
        borderRadius: 2,
        border: '1px solid',
        borderColor: 'divider',
        backgroundColor: alpha(theme.palette.background.paper, 0.92),
        minHeight: 118,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2, minWidth: 0 }}>
          <Box
            sx={{
              width: 40,
              height: 40,
              borderRadius: 2,
              display: 'grid',
              placeItems: 'center',
              color: theme.palette.primary.main,
              backgroundColor: alpha(theme.palette.primary.main, 0.1),
              flexShrink: 0,
            }}
          >
            {icon}
          </Box>
          <Typography sx={{ fontWeight: 800, color: 'text.primary' }}>
            {title}
          </Typography>
        </Box>
        <Typography sx={{ fontSize: '1.65rem', fontWeight: 900, color: 'text.primary' }}>
          {count}
        </Typography>
      </Box>
    </Paper>
  )
}

function UnitManagement() {
  const theme = useTheme()
  const unitMasterRef = useRef(null)
  const [data, setData] = useState(emptyData)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [createDialog, setCreateDialog] = useState(createDialogDefaults)
  const [unitDialog, setUnitDialog] = useState(unitDialogDefaults)
  const [assignMode, setAssignMode] = useState(false)
  const [assignmentPerformed, setAssignmentPerformed] = useState(false)
  const [assignmentDialog, setAssignmentDialog] = useState(assignmentDialogDefaults)

  useSyncGlobalLoading(loading)
  useSyncGlobalLoading(createDialog.submitting)
  useSyncGlobalLoading(unitDialog.submitting)
  useSyncGlobalLoading(assignmentDialog.submitting)

  const fetchUnitManagement = useCallback(async (cancelledRef = { current: false }) => {
      setLoading(true)
      setError('')

      try {
        const response = await fetch('http://localhost:3000/api/company-co/unit-management', {
          credentials: 'include',
        })
        const result = await response.json()

        if (!response.ok || !result?.success) {
          throw new Error(result?.message || 'Failed to fetch unit management data')
        }

        if (!cancelledRef.current) {
          setData({
            currentCoordinatorUnits: Array.isArray(result.data?.currentCoordinatorUnits)
              ? result.data.currentCoordinatorUnits
              : [],
            approvers: Array.isArray(result.data?.approvers) ? result.data.approvers : [],
            coordinators: Array.isArray(result.data?.coordinators) ? result.data.coordinators : [],
            unmappedCoordinatorUnits: Array.isArray(result.data?.unmappedCoordinatorUnits)
              ? result.data.unmappedCoordinatorUnits
              : [],
            unmappedApproverUnits: Array.isArray(result.data?.unmappedApproverUnits)
              ? result.data.unmappedApproverUnits
              : [],
            assignmentCoordinators: Array.isArray(result.data?.assignmentCoordinators)
              ? result.data.assignmentCoordinators
              : [],
            assignmentApprovers: Array.isArray(result.data?.assignmentApprovers)
              ? result.data.assignmentApprovers
              : [],
            units: Array.isArray(result.data?.units) ? result.data.units : [],
          })
        }
      } catch (fetchError) {
        console.error('Unit management fetch error:', fetchError)
        if (!cancelledRef.current) {
          setData(emptyData)
          setError(fetchError.message || 'Network error while fetching unit management data')
        }
      } finally {
        if (!cancelledRef.current) {
          setLoading(false)
        }
      }
  }, [])

  useEffect(() => {
    const cancelledRef = { current: false }

    fetchUnitManagement(cancelledRef)

    return () => {
      cancelledRef.current = true
    }
  }, [fetchUnitManagement])

  useEffect(() => {
    if (!assignMode) return undefined
    if (assignmentDialog.open) return undefined

    const handleOutsideClick = (event) => {
      if (unitMasterRef.current?.contains(event.target)) return
      setAssignMode(false)
      setAssignmentPerformed(false)
    }

    document.addEventListener('mousedown', handleOutsideClick)
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick)
    }
  }, [assignMode, assignmentDialog.open])

  const getAvailableUnits = (type) => (
    type === 'approver' ? data.unmappedApproverUnits : data.unmappedCoordinatorUnits
  )

  const getAssignmentOptions = (role, unit = assignmentDialog.unit) => {
    const currentEmail = role === 'approver'
      ? unit?.approver_email_id
      : unit?.coordinator_email_id
    const options = role === 'approver'
      ? data.assignmentApprovers
      : data.assignmentCoordinators

    return options.filter(
      (person) =>
        String(person.email_id || '').trim().toLowerCase() !==
        String(currentEmail || '').trim().toLowerCase()
    )
  }

  const handleOpenCreateDialog = (type) => {
    const availableUnits = getAvailableUnits(type)
    setCreateDialog({
      ...createDialogDefaults,
      open: true,
      type,
      unitId: availableUnits[0]?.unit_id || '',
    })
  }

  const handleCloseCreateDialog = () => {
    if (createDialog.submitting) return
    setCreateDialog(createDialogDefaults)
  }

  const handleCreateMappedUser = async () => {
    const email = createDialog.email.trim()

    if (!email) {
      setCreateDialog((prev) => ({ ...prev, error: 'Email ID is required' }))
      return
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setCreateDialog((prev) => ({ ...prev, error: 'Enter a valid email ID' }))
      return
    }

    if (!createDialog.unitId) {
      setCreateDialog((prev) => ({ ...prev, error: 'Select a unit to map' }))
      return
    }

    const endpoint = createDialog.type === 'approver'
      ? 'http://localhost:3000/api/company-co/unit-management/approvers'
      : 'http://localhost:3000/api/company-co/unit-management/coordinators'

    setCreateDialog((prev) => ({ ...prev, submitting: true, error: '' }))

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          email_id: email,
          unit_id: createDialog.unitId,
        }),
      })
      const result = await response.json()

      if (!response.ok || !result?.success) {
        throw new Error(result?.message || 'Failed to create user')
      }

      toast.success(result.message || 'User created successfully')
      setCreateDialog(createDialogDefaults)
      await fetchUnitManagement()
    } catch (createError) {
      console.error('Create mapped user error:', createError)
      setCreateDialog((prev) => ({
        ...prev,
        submitting: false,
        error: createError.message || 'Network error while creating user',
      }))
    }
  }

  const handleCloseUnitDialog = () => {
    if (unitDialog.submitting) return
    setUnitDialog(unitDialogDefaults)
  }

  const handleCreateUnit = async () => {
    const unitName = unitDialog.unitName.trim()
    const unitAddress = unitDialog.unitAddress.trim()

    if (!unitName) {
      setUnitDialog((prev) => ({ ...prev, error: 'Unit name is required' }))
      return
    }

    const duplicateUnit = data.units.some(
      (unit) => String(unit.unit_name || '').trim().toLowerCase() === unitName.toLowerCase()
    )
    if (duplicateUnit) {
      setUnitDialog((prev) => ({ ...prev, error: 'A unit with this name already exists' }))
      return
    }

    setUnitDialog((prev) => ({ ...prev, submitting: true, error: '' }))

    try {
      const response = await fetch('http://localhost:3000/api/company-co/unit-management/units', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          unit_name: unitName,
          unit_address: unitAddress || null,
        }),
      })
      const result = await response.json()

      if (!response.ok || !result?.success) {
        throw new Error(result?.message || 'Failed to create company unit')
      }

      toast.success(result.message || 'Company unit created successfully')
      setUnitDialog(unitDialogDefaults)
      await fetchUnitManagement()
    } catch (createError) {
      console.error('Create company unit error:', createError)
      setUnitDialog((prev) => ({
        ...prev,
        submitting: false,
        error: createError.message || 'Network error while creating company unit',
      }))
    }
  }

  const handleOpenAssignmentDialog = (unit, role = 'company_co') => {
    if (!assignMode) return

    const options = getAssignmentOptions(role, unit)
    setAssignmentDialog({
      ...assignmentDialogDefaults,
      open: true,
      unit,
      role,
      email: options[0]?.email_id || '',
      error: options.length === 0 ? 'No alternate email IDs are available for this assignment.' : '',
    })
  }

  const handleCloseAssignmentDialog = () => {
    if (assignmentDialog.submitting) return
    setAssignmentDialog(assignmentDialogDefaults)
  }

  const handleAssignmentRoleChange = (role) => {
    const options = getAssignmentOptions(role)
    setAssignmentDialog((prev) => ({
      ...prev,
      role,
      email: options[0]?.email_id || '',
      error: options.length === 0 ? 'No alternate email IDs are available for this assignment.' : '',
    }))
  }

  const handleUpdateAssignment = async () => {
    if (!assignmentDialog.unit?.unit_id) {
      setAssignmentDialog((prev) => ({ ...prev, error: 'Unit is required' }))
      return
    }

    if (!assignmentDialog.email) {
      setAssignmentDialog((prev) => ({ ...prev, error: 'Select an email ID to assign' }))
      return
    }

    setAssignmentDialog((prev) => ({ ...prev, submitting: true, error: '' }))

    try {
      const response = await fetch(
        `http://localhost:3000/api/company-co/unit-management/units/${encodeURIComponent(assignmentDialog.unit.unit_id)}/assignment`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({
            role: assignmentDialog.role,
            email_id: assignmentDialog.email,
          }),
        }
      )
      const result = await response.json()

      if (!response.ok || !result?.success) {
        throw new Error(result?.message || 'Failed to update assignment')
      }

      toast.success(result.message || 'Assignment updated successfully')
      setAssignmentPerformed(true)
      setAssignmentDialog(assignmentDialogDefaults)
      await fetchUnitManagement()
    } catch (assignmentError) {
      console.error('Update unit assignment error:', assignmentError)
      setAssignmentDialog((prev) => ({
        ...prev,
        submitting: false,
        error: assignmentError.message || 'Network error while updating assignment',
      }))
    }
  }

  const createDialogTitle = createDialog.type === 'approver'
    ? 'Create Approver'
    : 'Create Company Coordinator'
  const createDialogUnits = getAvailableUnits(createDialog.type)
  const assignmentOptions = getAssignmentOptions(assignmentDialog.role)

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, py: 1 }}>
      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', md: 'row' },
          justifyContent: 'space-between',
          alignItems: { xs: 'stretch', md: 'flex-start' },
          gap: 2,
        }}
      >
        <Box>
          <Typography
            component="h1"
            sx={{
              fontSize: { xs: '1.7rem', sm: '2rem' },
              fontWeight: 900,
              color: 'text.primary',
              lineHeight: 1.15,
            }}
          >
            Unit Management
          </Typography>
          <Typography sx={{ mt: 0.8, color: 'text.secondary', lineHeight: 1.6 }}>
            View coordinator and approver mappings across company units.
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.2 }}>
          <Button
            variant="contained"
            startIcon={<AddRoundedIcon />}
            onClick={() => setUnitDialog({ ...unitDialogDefaults, open: true })}
            disabled={loading || assignMode}
          >
            Company Unit
          </Button>
          <Button
            variant="outlined"
            startIcon={<AddRoundedIcon />}
            onClick={() => handleOpenCreateDialog('coordinator')}
            disabled={loading || assignMode || data.unmappedCoordinatorUnits.length === 0}
          >
            Company Coordinator
          </Button>
          <Button
            variant="outlined"
            startIcon={<AddRoundedIcon />}
            onClick={() => handleOpenCreateDialog('approver')}
            disabled={loading || assignMode || data.unmappedApproverUnits.length === 0}
          >
            Approver
          </Button>
        </Box>
      </Box>

      {error && <Alert severity="error">{error}</Alert>}

      {loading ? (
        <Paper
          elevation={0}
          sx={{
            p: 4,
            borderRadius: 2,
            border: '1px solid',
            borderColor: 'divider',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 1.5,
          }}
        >
          <CircularProgress size={22} />
          <Typography color="text.secondary">Loading unit management data...</Typography>
        </Paper>
      ) : (
        <>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', md: 'repeat(3, minmax(0, 1fr))' },
              gap: 2,
            }}
          >
            <SummaryPanel
              title="Current Units"
              count={data.currentCoordinatorUnits.length}
              icon={<ApartmentRoundedIcon />}
            />

            <SummaryPanel
              title="Approvers"
              count={data.approvers.length}
              icon={<FactCheckRoundedIcon />}
            />

            <SummaryPanel
              title="Coordinators"
              count={data.coordinators.length}
              icon={<GroupsRoundedIcon />}
            />
          </Box>

          <Paper
            ref={unitMasterRef}
            elevation={0}
            sx={{
              borderRadius: 2,
              border: '1px solid',
              borderColor: 'divider',
              overflow: 'hidden',
              backgroundColor: alpha(theme.palette.background.paper, 0.96),
            }}
          >
            <Box
              sx={{
                p: 2.5,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 1.5,
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2, minWidth: 0 }}>
                <BadgeRoundedIcon sx={{ color: 'primary.main' }} />
                <Typography sx={{ fontWeight: 850, color: 'text.primary' }}>
                  Unit Master
                </Typography>
              </Box>
              <Button
                variant={assignMode ? 'contained' : 'outlined'}
                onClick={() => {
                  setAssignmentPerformed(false)
                  setAssignMode(true)
                }}
                disabled={loading || data.units.length === 0 || assignMode}
              >
                {assignMode && assignmentPerformed ? 'Done' : 'Assign'}
              </Button>
            </Box>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 800 }}>Unit Name</TableCell>
                    <TableCell sx={{ fontWeight: 800 }}>Coordinator</TableCell>
                    <TableCell sx={{ fontWeight: 800 }}>Approver</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {data.units.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3}>
                        <Typography color="text.secondary">No units found.</Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    data.units.map((unit) => (
                      <TableRow key={unit.unit_id || unit.id} hover>
                        <TableCell
                          onClick={() => handleOpenAssignmentDialog(unit, 'company_co')}
                          sx={{
                            cursor: assignMode ? 'pointer' : 'default',
                            ...(assignMode && {
                              '&:hover': { backgroundColor: alpha(theme.palette.primary.main, 0.08) },
                            }),
                          }}
                        >
                          {unit.unit_name || 'N/A'}
                        </TableCell>
                        <TableCell>
                          {unit.coordinator_display_name || unit.coordinator_email_id || 'N/A'}
                        </TableCell>
                        <TableCell>
                          {unit.approver_display_name || unit.approver_email_id || 'N/A'}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </>
      )}

      <Dialog
        open={assignmentDialog.open}
        onClose={handleCloseAssignmentDialog}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>
          Assign {assignmentDialog.role === 'approver' ? 'Approver' : 'Company Coordinator'}
        </DialogTitle>
        <DialogContent dividers sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2.5 }}>
          <Typography color="text.secondary">
            {assignmentDialog.unit?.unit_name || 'Selected unit'}
          </Typography>
          <FormControl fullWidth required disabled={assignmentDialog.submitting}>
            <InputLabel id="assignment-role-label">Assignment Type</InputLabel>
            <Select
              labelId="assignment-role-label"
              label="Assignment Type"
              value={assignmentDialog.role}
              onChange={(event) => handleAssignmentRoleChange(event.target.value)}
            >
              <MenuItem value="company_co">Company Coordinator</MenuItem>
              <MenuItem value="approver">Approver</MenuItem>
            </Select>
          </FormControl>
          <FormControl fullWidth required disabled={assignmentDialog.submitting || assignmentOptions.length === 0}>
            <InputLabel id="assignment-email-label">Email ID</InputLabel>
            <Select
              labelId="assignment-email-label"
              label="Email ID"
              value={assignmentDialog.email}
              onChange={(event) =>
                setAssignmentDialog((prev) => ({ ...prev, email: event.target.value, error: '' }))
              }
            >
              {assignmentOptions.map((person) => (
                <MenuItem key={person.email_id} value={person.email_id}>
                  <Box sx={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                    <Typography sx={{ fontSize: '0.95rem', fontWeight: 600, color: 'text.primary' }}>
                      {person.display_name || person.email_id}
                    </Typography>
                    <Typography sx={{ fontSize: '0.76rem', color: 'text.secondary' }}>
                      {person.email_id}
                    </Typography>
                  </Box>
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          {assignmentDialog.error && <Alert severity={assignmentOptions.length === 0 ? 'info' : 'error'}>{assignmentDialog.error}</Alert>}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseAssignmentDialog} disabled={assignmentDialog.submitting}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleUpdateAssignment}
            disabled={assignmentDialog.submitting || assignmentOptions.length === 0}
          >
            {assignmentDialog.submitting ? 'Assigning...' : 'Assign'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={unitDialog.open}
        onClose={handleCloseUnitDialog}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Create Company Unit</DialogTitle>
        <DialogContent dividers sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2.5 }}>
          <TextField
            label="Unit Name"
            value={unitDialog.unitName}
            onChange={(event) =>
              setUnitDialog((prev) => ({ ...prev, unitName: event.target.value, error: '' }))
            }
            disabled={unitDialog.submitting}
            fullWidth
            required
          />
          <TextField
            label="Unit Address"
            value={unitDialog.unitAddress}
            onChange={(event) =>
              setUnitDialog((prev) => ({ ...prev, unitAddress: event.target.value, error: '' }))
            }
            disabled={unitDialog.submitting}
            fullWidth
            multiline
            minRows={2}
          />
          {unitDialog.error && <Alert severity="error">{unitDialog.error}</Alert>}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseUnitDialog} disabled={unitDialog.submitting}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleCreateUnit}
            disabled={unitDialog.submitting}
          >
            {unitDialog.submitting ? 'Creating...' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={createDialog.open}
        onClose={handleCloseCreateDialog}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>{createDialogTitle}</DialogTitle>
        <DialogContent dividers sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2.5 }}>
          {createDialogUnits.length === 0 ? (
            <Alert severity="info">
              All units already have a {createDialog.type === 'approver' ? 'mapped approver' : 'mapped coordinator'}.
            </Alert>
          ) : (
            <>
              <TextField
                label="Email ID"
                type="email"
                value={createDialog.email}
                onChange={(event) =>
                  setCreateDialog((prev) => ({ ...prev, email: event.target.value, error: '' }))
                }
                disabled={createDialog.submitting}
                fullWidth
                required
              />
              <FormControl fullWidth required disabled={createDialog.submitting}>
                <InputLabel id="unit-mapping-select-label">Unit</InputLabel>
                <Select
                  labelId="unit-mapping-select-label"
                  label="Unit"
                  value={createDialog.unitId}
                  onChange={(event) =>
                    setCreateDialog((prev) => ({ ...prev, unitId: event.target.value, error: '' }))
                  }
                >
                  {createDialogUnits.map((unit) => (
                    <MenuItem key={unit.unit_id || unit.id} value={unit.unit_id}>
                      {unit.unit_name || unit.unit_id}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </>
          )}
          {createDialog.error && <Alert severity="error">{createDialog.error}</Alert>}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseCreateDialog} disabled={createDialog.submitting}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleCreateMappedUser}
            disabled={createDialog.submitting || createDialogUnits.length === 0}
          >
            {createDialog.submitting ? 'Creating...' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

export default UnitManagement
