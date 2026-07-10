import React, { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { alpha, useTheme } from '@mui/material/styles'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import CircularProgress from '@mui/material/CircularProgress'
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
import AssignmentIndRoundedIcon from '@mui/icons-material/AssignmentIndRounded'
import EditRoundedIcon from '@mui/icons-material/EditRounded'
import ManageAccountsRoundedIcon from '@mui/icons-material/ManageAccountsRounded'
import { toast } from 'react-hot-toast'
import { apiUrl, API_BASE_URL } from '../../config/api'
import { TABLE_HEADER_BG, TABLE_ROW_HOVER_BG } from '../../uiConstants'
import AppDialog, { APP_DIALOG_PRIMARY_BUTTON_SX, getAppDialogCancelButtonSx } from '../../components/AppDialog'
import { useOrganizationEmailWarning } from '../../hooks/useOrganizationEmailWarning'
import { getMobileValidationError, normalizeMobileDigits } from '../../utils/mobileValidation'
import { useSyncGlobalLoading } from '../../contexts/GlobalLoadingContext'

const emptyData = {
  units: [],
  coordinators: [],
  approvers: [],
  approverAssignments: [],
}

const createUnitDialogState = () => ({
  open: false,
  mode: 'create',
  unitId: '',
  unitName: '',
  unitAddress: '',
  submitting: false,
  error: '',
})

const createRoleDialogState = () => ({
  open: false,
  type: 'company_co',
  email: '',
  emp_code: '',
  emp_name: '',
  department: '',
  designation: '',
  mobile: '',
  submitting: false,
  error: '',
})

const createAssignmentDialogState = () => ({
  open: false,
  unit: null,
  email: '',
  submitting: false,
  error: '',
})

function CompanyAdminUnitManagement() {
  const theme = useTheme()
  const navigate = useNavigate()
  const [data, setData] = useState(emptyData)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [unitDialog, setUnitDialog] = useState(createUnitDialogState)
  const [roleDialog, setRoleDialog] = useState(createRoleDialogState)
  const [assignmentDialog, setAssignmentDialog] = useState(createAssignmentDialogState)
  const { getEmailWarning, getEmailWarningHelperTextSx } = useOrganizationEmailWarning()

  useSyncGlobalLoading(loading)
  useSyncGlobalLoading(unitDialog.submitting)
  useSyncGlobalLoading(roleDialog.submitting)
  useSyncGlobalLoading(assignmentDialog.submitting)

  const fetchUnitManagement = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const response = await fetch(apiUrl('/api/company-admin/unit-management'), { credentials: 'include' })
      const result = await response.json()

      if (!response.ok || !result?.success) {
        throw new Error(result?.message || 'Failed to fetch unit management data')
      }

      const units = Array.isArray(result.data?.units) ? result.data.units : []
      const coordinators = Array.isArray(result.data?.coordinators) ? result.data.coordinators : []
      const approvers = Array.isArray(result.data?.approvers) ? result.data.approvers : []
      const approverAssignments = Array.isArray(result.data?.approverAssignments) ? result.data.approverAssignments : []
      const coordinatorUnitMap = new Map()

      coordinators.forEach((person) => {
        const unitIds = Array.isArray(person.unit_ids) ? person.unit_ids : []
        unitIds.forEach((item) => coordinatorUnitMap.set(String(item), person))
      })

      setData({
        units: units.map((unit) => ({
          ...unit,
          coordinator_email_id: coordinatorUnitMap.get(String(unit.unit_id))?.email_id || '',
          coordinator_display_name: coordinatorUnitMap.get(String(unit.unit_id))?.display_name || '',
        })),
        coordinators,
        approvers,
        approverAssignments,
      })
    } catch (fetchError) {
      console.error('Company admin unit management fetch error:', fetchError)
      setData(emptyData)
      setError(fetchError.message || 'Network error while fetching unit management data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchUnitManagement()
  }, [fetchUnitManagement])

  const tableBorderColor = theme.palette.mode === 'light'
    ? alpha(theme.palette.text.primary, 0.16)
    : alpha('#0f172a', 0.72)
  const commonCellSx = {
    py: 1.5,
    px: 2.25,
    borderBottom: `1px solid ${tableBorderColor}`,
    verticalAlign: 'top',
  }
  const headCellSx = {
    ...commonCellSx,
    fontSize: '0.76rem',
    fontWeight: 800,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    color: 'text.secondary',
    backgroundColor: TABLE_HEADER_BG,
  }

  const handleCreateOrUpdateUnit = async () => {
    const unitName = String(unitDialog.unitName || '').trim()
    const unitAddress = String(unitDialog.unitAddress || '').trim()
    if (!unitName) {
      setUnitDialog((prev) => ({ ...prev, error: 'Unit name is required' }))
      return
    }

    const isEditMode = unitDialog.mode === 'edit' && unitDialog.unitId
    setUnitDialog((prev) => ({ ...prev, submitting: true, error: '' }))
    try {
      const response = await fetch(
        apiUrl(
          isEditMode
            ? `/api/company-admin/unit-management/units/${encodeURIComponent(unitDialog.unitId)}`
            : '/api/company-admin/unit-management/units'
        ),
        {
          method: isEditMode ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ unit_name: unitName, unit_address: unitAddress || null }),
        }
      )
      const result = await response.json()
      if (!response.ok || !result?.success) {
        throw new Error(result?.message || (isEditMode ? 'Failed to update company unit' : 'Failed to create company unit'))
      }
      toast.success(result.message || (isEditMode ? 'Company unit updated successfully' : 'Company unit created successfully'))
      setUnitDialog(createUnitDialogState())
      await fetchUnitManagement()
    } catch (saveError) {
      setUnitDialog((prev) => ({
        ...prev,
        submitting: false,
        error: saveError.message || (isEditMode ? 'Failed to update unit' : 'Failed to create unit'),
      }))
    }
  }

  const handleCreateRoleUser = async () => {
    const email = String(roleDialog.email || '').trim()
    if (!email) {
      setRoleDialog((prev) => ({ ...prev, error: 'Email ID is required' }))
      return
    }
    const mobileError = roleDialog.mobile ? getMobileValidationError(roleDialog.mobile) : null
    if (mobileError) {
      setRoleDialog((prev) => ({ ...prev, error: mobileError }))
      return
    }

    const endpoint = roleDialog.type === 'approver'
      ? '/api/company-admin/unit-management/approvers'
      : '/api/company-admin/unit-management/coordinators'

    setRoleDialog((prev) => ({ ...prev, submitting: true, error: '' }))
    try {
      const response = await fetch(apiUrl(endpoint), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          email_id: email,
          emp_code: roleDialog.emp_code || null,
          emp_name: roleDialog.emp_name || null,
          department: roleDialog.department || null,
          designation: roleDialog.designation || null,
          mobile: normalizeMobileDigits(roleDialog.mobile) || null,
        }),
      })
      const result = await response.json()
      if (!response.ok || !result?.success) {
        throw new Error(result?.message || 'Failed to create user')
      }
      toast.success(result.message || 'User created successfully')
      setRoleDialog(createRoleDialogState())
      await fetchUnitManagement()
    } catch (createError) {
      setRoleDialog((prev) => ({ ...prev, submitting: false, error: createError.message || 'Failed to create user' }))
    }
  }

  const handleSaveCoordinatorAssignment = async () => {
    if (!assignmentDialog.unit?.unit_id || !assignmentDialog.email) {
      setAssignmentDialog((prev) => ({ ...prev, error: 'Coordinator email is required' }))
      return
    }

    setAssignmentDialog((prev) => ({ ...prev, submitting: true, error: '' }))
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/company-admin/unit-management/units/${encodeURIComponent(assignmentDialog.unit.unit_id)}/assignment`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            role: 'company_co',
            email_id: assignmentDialog.email,
          }),
        }
      )
      const result = await response.json()
      if (!response.ok || !result?.success) {
        throw new Error(result?.message || 'Failed to update coordinator assignment')
      }
      toast.success(result.message || 'Coordinator assignment updated successfully')
      setAssignmentDialog(createAssignmentDialogState())
      await fetchUnitManagement()
    } catch (assignmentError) {
      setAssignmentDialog((prev) => ({ ...prev, submitting: false, error: assignmentError.message || 'Failed to update coordinator assignment' }))
    }
  }

  const openEditUnitDialog = (unit) => {
    setUnitDialog({
      open: true,
      mode: 'edit',
      unitId: unit.unit_id || '',
      unitName: unit.unit_name || '',
      unitAddress: unit.unit_address || '',
      submitting: false,
      error: '',
    })
  }

  const openApproverManagement = (unit = null) => {
    const query = unit?.unit_id ? `?unit_id=${encodeURIComponent(unit.unit_id)}` : ''
    navigate(`/company_admin/approver-management${query}`)
  }

  const availableCoordinatorsForUnit = data.coordinators.filter((person) => {
    const emailId = String(person.email_id || '').trim().toLowerCase()
    const selectedEmail = String(assignmentDialog.email || '').trim().toLowerCase()
    const assignedUnitIds = Array.isArray(person.unit_ids) ? person.unit_ids.map((item) => String(item)) : []
    const isAssignedToCurrentUnit = assignmentDialog.unit?.unit_id
      ? assignedUnitIds.includes(String(assignmentDialog.unit.unit_id))
      : false

    return !isAssignedToCurrentUnit || emailId === selectedEmail
  })

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, py: 2 }}>
      <Box sx={{ pb: 2, borderBottom: '1px solid', borderColor: 'divider', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1.2 }}>
        <Box>
          <Typography component="h1" sx={{ fontSize: { xs: '1.45rem', sm: '1.7rem' }, fontWeight: 850, lineHeight: 1.15 }}>
            Unit Management
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.2, alignContent: 'end' }}>
          <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={() => setUnitDialog({ ...createUnitDialogState(), open: true })} sx={{ textTransform: 'none', fontWeight: 700 }}>
            Create Unit
          </Button>
          <Button variant="outlined" startIcon={<AddRoundedIcon />} onClick={() => setRoleDialog({ ...createRoleDialogState(), open: true })} sx={{ textTransform: 'none', fontWeight: 700 }}>
            Add Coordinator/Approver
          </Button>
          <Button variant="outlined" startIcon={<ManageAccountsRoundedIcon />} onClick={() => openApproverManagement()} sx={{ textTransform: 'none', fontWeight: 700 }}>
            Approver Management
          </Button>
        </Box>
      </Box>

      {error && <Alert severity="error">{error}</Alert>}

      {loading ? (
        <Paper elevation={0} sx={{ p: 4, borderRadius: 2, border: '1px solid', borderColor: 'divider', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1.25 }}>
          <CircularProgress size={22} />
          <Typography color="text.secondary">Loading unit management data...</Typography>
        </Paper>
      ) : (
        <Paper elevation={0} sx={{ borderRadius: 1, border: '1px solid', borderColor: 'divider', overflow: 'hidden' }}>
          {/* <Box sx={{ px: { xs: 2, sm: 2.5 }, py: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
            <Typography sx={{ fontWeight: 850 }}>Unit Master</Typography>
            <Typography sx={{ mt: 0.4, color: 'text.secondary', fontSize: '0.92rem', lineHeight: 1.6 }}>
              Review current unit ownership and update mappings where required.
            </Typography>
          </Box> */}
          <TableContainer>
            <Table sx={{ minWidth: 840, tableLayout: 'fixed' }}>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ ...headCellSx, width: '20%' }}>Unit Name</TableCell>
                  <TableCell sx={{ ...headCellSx, width: '30%' }}>Coordinator</TableCell>
                  <TableCell sx={{ ...headCellSx, width: '50%' }}>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {data.units.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} sx={{ py: 4, textAlign: 'center', borderBottom: 0 }}>
                      No units found for this company.
                    </TableCell>
                  </TableRow>
                ) : (
                  data.units.map((unit, index) => (
                    <TableRow key={unit.unit_id || unit.id} sx={{ '&:hover': { backgroundColor: TABLE_ROW_HOVER_BG }, '&:last-of-type td': { borderBottom: 0 }, '& td': { borderBottom: index === data.units.length - 1 ? 0 : `1px solid ${tableBorderColor}` } }}>
                      <TableCell sx={{ ...commonCellSx, width: '20%', fontWeight: 700 }}>{unit.unit_name || 'N/A'}</TableCell>
                      <TableCell sx={{ ...commonCellSx, width: '30%' }}>{unit.coordinator_display_name || unit.coordinator_email_id || 'Unassigned'}</TableCell>
                      <TableCell sx={{ ...commonCellSx, width: '50%' }}>
                        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                          <Button
                            size="small"
                            variant="outlined"
                            startIcon={<EditRoundedIcon />}
                            sx={{ textTransform: 'none' }}
                            onClick={() => openEditUnitDialog(unit)}
                          >
                            Edit
                          </Button>
                          <Button
                            size="small"
                            variant="outlined"
                            startIcon={<AssignmentIndRoundedIcon />}
                            sx={{ textTransform: 'none' }}
                            onClick={() => setAssignmentDialog({ open: true, unit, email: unit.coordinator_email_id || '', submitting: false, error: '' })}
                          >
                            Coordinator
                          </Button>
                          <Button
                            size="small"
                            variant="outlined"
                            startIcon={<ManageAccountsRoundedIcon />}
                            sx={{ textTransform: 'none' }}
                            onClick={() => openApproverManagement(unit)}
                          >
                            Approver
                          </Button>
                        </Box>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}

      <AppDialog
        open={unitDialog.open}
        onClose={() => !unitDialog.submitting && setUnitDialog(createUnitDialogState())}
        title={unitDialog.mode === 'edit' ? 'Edit Company Unit' : 'Create Company Unit'}
        titleId="company-admin-create-unit-dialog-title"
        fullWidth
        maxWidth="sm"
        actions={(
          <>
            <Button onClick={() => setUnitDialog(createUnitDialogState())} disabled={unitDialog.submitting} variant="outlined" sx={getAppDialogCancelButtonSx(theme)}>Cancel</Button>
            <Button variant="contained" onClick={handleCreateOrUpdateUnit} disabled={unitDialog.submitting} sx={APP_DIALOG_PRIMARY_BUTTON_SX}>
              {unitDialog.submitting ? (unitDialog.mode === 'edit' ? 'Saving...' : 'Creating...') : (unitDialog.mode === 'edit' ? 'Save' : 'Create')}
            </Button>
          </>
        )}
      >
        <TextField label="Unit Name" value={unitDialog.unitName} onChange={(event) => setUnitDialog((prev) => ({ ...prev, unitName: event.target.value, error: '' }))} required fullWidth />
        <TextField label="Unit Address" value={unitDialog.unitAddress} onChange={(event) => setUnitDialog((prev) => ({ ...prev, unitAddress: event.target.value, error: '' }))} fullWidth multiline minRows={2} />
        {unitDialog.error && <Alert severity="error">{unitDialog.error}</Alert>}
      </AppDialog>

      <AppDialog
        open={roleDialog.open}
        onClose={() => !roleDialog.submitting && setRoleDialog(createRoleDialogState())}
        title="Create Coordinator / Approver"
        titleId="company-admin-create-role-dialog-title"
        fullWidth
        maxWidth="sm"
        actions={(
          <>
            <Button onClick={() => setRoleDialog(createRoleDialogState())} disabled={roleDialog.submitting} variant="outlined" sx={getAppDialogCancelButtonSx(theme)}>Cancel</Button>
            <Button variant="contained" onClick={handleCreateRoleUser} disabled={roleDialog.submitting} sx={APP_DIALOG_PRIMARY_BUTTON_SX}>
              {roleDialog.submitting ? 'Creating...' : 'Create'}
            </Button>
          </>
        )}
      >
        <FormControl fullWidth required>
          <InputLabel id="company-admin-role-type">Role</InputLabel>
          <Select labelId="company-admin-role-type" label="Role" value={roleDialog.type} onChange={(event) => setRoleDialog((prev) => ({ ...prev, type: event.target.value, error: '' }))}>
            <MenuItem value="company_co">Company Coordinator</MenuItem>
            <MenuItem value="approver">Approver</MenuItem>
          </Select>
        </FormControl>
        <TextField
          label="Email ID"
          type="email"
          value={roleDialog.email}
          onChange={(event) => setRoleDialog((prev) => ({ ...prev, email: event.target.value, error: '' }))}
          fullWidth
          required
          helperText={roleDialog.error ? undefined : getEmailWarning(roleDialog.email)}
          FormHelperTextProps={{ sx: roleDialog.error ? undefined : getEmailWarningHelperTextSx(roleDialog.email) }}
        />
        <TextField label="Employee Code" value={roleDialog.emp_code} onChange={(event) => setRoleDialog((prev) => ({ ...prev, emp_code: event.target.value, error: '' }))} fullWidth />
        <TextField label="Employee Name" value={roleDialog.emp_name} onChange={(event) => setRoleDialog((prev) => ({ ...prev, emp_name: event.target.value, error: '' }))} fullWidth />
        <TextField label="Department" value={roleDialog.department} onChange={(event) => setRoleDialog((prev) => ({ ...prev, department: event.target.value, error: '' }))} fullWidth />
        <TextField label="Designation" value={roleDialog.designation} onChange={(event) => setRoleDialog((prev) => ({ ...prev, designation: event.target.value, error: '' }))} fullWidth />
        <TextField
          label="Mobile"
          value={roleDialog.mobile}
          onChange={(event) => setRoleDialog((prev) => ({ ...prev, mobile: event.target.value, error: '' }))}
          fullWidth
          error={!!roleDialog.mobile && !!getMobileValidationError(roleDialog.mobile)}
          helperText={(roleDialog.mobile && getMobileValidationError(roleDialog.mobile)) || 'Optional. Enter a valid 10-digit mobile number.'}
        />
        {roleDialog.error && <Alert severity="error">{roleDialog.error}</Alert>}
      </AppDialog>

      <AppDialog
        open={assignmentDialog.open}
        onClose={() => !assignmentDialog.submitting && setAssignmentDialog(createAssignmentDialogState())}
        title="Assign Coordinator"
        titleId="company-admin-assignment-dialog-title"
        fullWidth
        maxWidth="sm"
        actions={(
          <>
            <Button onClick={() => setAssignmentDialog(createAssignmentDialogState())} disabled={assignmentDialog.submitting} variant="outlined" sx={getAppDialogCancelButtonSx(theme)}>Cancel</Button>
            <Button variant="contained" onClick={handleSaveCoordinatorAssignment} disabled={assignmentDialog.submitting || !assignmentDialog.email} sx={APP_DIALOG_PRIMARY_BUTTON_SX}>
              {assignmentDialog.submitting ? 'Saving...' : 'Assign'}
            </Button>
          </>
        )}
      >
        <Typography color="text.secondary">{assignmentDialog.unit?.unit_name || 'Selected unit'}</Typography>
        <FormControl fullWidth required>
          <InputLabel id="company-admin-assignment-email">Coordinator</InputLabel>
          <Select labelId="company-admin-assignment-email" label="Coordinator" value={assignmentDialog.email} onChange={(event) => setAssignmentDialog((prev) => ({ ...prev, email: event.target.value, error: '' }))}>
            {availableCoordinatorsForUnit.map((person) => (
              <MenuItem key={person.email_id} value={person.email_id}>
                {person.display_name || person.email_id}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        {assignmentDialog.error && <Alert severity="error">{assignmentDialog.error}</Alert>}
        <Typography
          sx={{
            mt: 0.5,
            color: 'text.secondary',
            opacity: 0.82,
            fontSize: '0.86rem',
            lineHeight: 1.5,
          }}
        >
          (Coordinator will create process owners and upload RACMs for this unit)
        </Typography>
      </AppDialog>

    </Box>
  )
}

export default CompanyAdminUnitManagement
