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
import Checkbox from '@mui/material/Checkbox'
import FormControl from '@mui/material/FormControl'
import FormControlLabel from '@mui/material/FormControlLabel'
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
import BadgeRoundedIcon from '@mui/icons-material/BadgeRounded'
import ArrowOutwardRoundedIcon from '@mui/icons-material/ArrowOutwardRounded'
import AssignmentIndRoundedIcon from '@mui/icons-material/AssignmentIndRounded'
import { toast } from 'react-hot-toast'
import { useSyncGlobalLoading } from '../../contexts/GlobalLoadingContext'
import { apiUrl, API_BASE_URL } from '../../config/api'
import {
  STATUS_BADGE_PILL_SX,
  TABLE_HEADER_BG,
  TABLE_ROW_HOVER_BG,
} from '../../uiConstants'

const emptyData = {
  currentCoordinatorUnits: [],
  approvers: [],
  coordinators: [],
  unmappedRoleUsers: [],
  unmappedCoordinatorUnits: [],
  unmappedApproverUnits: [],
  assignmentCoordinators: [],
  assignmentApprovers: [],
  units: [],
}

const createDialogDefaults = {
  open: false,
  type: 'company_co',
  email: '',
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
  confirmExternalAssignment: false,
  submitting: false,
  error: '',
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
  const [assignmentDialog, setAssignmentDialog] = useState(assignmentDialogDefaults)

  useSyncGlobalLoading(loading)
  useSyncGlobalLoading(createDialog.submitting)
  useSyncGlobalLoading(unitDialog.submitting)
  useSyncGlobalLoading(assignmentDialog.submitting)

  const fetchUnitManagement = useCallback(async (cancelledRef = { current: false }) => {
      setLoading(true)
      setError('')

      try {
        const response = await fetch(apiUrl('/api/company-co/unit-management'), {
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
            unmappedRoleUsers: Array.isArray(result.data?.unmappedRoleUsers)
              ? result.data.unmappedRoleUsers
              : [],
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
    }

    document.addEventListener('mousedown', handleOutsideClick)
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick)
    }
  }, [assignMode, assignmentDialog.open])

  const mappedUnitIdSet = new Set(
    data.currentCoordinatorUnits
      .map((unit) => String(unit.unit_id || '').trim())
      .filter(Boolean)
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

  const handleOpenCreateDialog = () => {
    setCreateDialog({
      ...createDialogDefaults,
      open: true,
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

    const endpoint = createDialog.type === 'approver'
      ? apiUrl('/api/company-co/unit-management/approvers')
      : apiUrl('/api/company-co/unit-management/coordinators')

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
      const response = await fetch(apiUrl('/api/company-co/unit-management/units'), {
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

    const selectedUnitId = String(assignmentDialog.unit.unit_id || '').trim()
    const isExternalUnit = selectedUnitId !== '' && !mappedUnitIdSet.has(selectedUnitId)
    const isOwnCoordinatorUnit = assignmentDialog.role === 'company_co' && !isExternalUnit

    if (isOwnCoordinatorUnit) {
      setAssignmentDialog((prev) => ({
        ...prev,
        error: 'You cannot replace your own company coordinator assignment.',
      }))
      return
    }

    if (isExternalUnit && !assignmentDialog.confirmExternalAssignment) {
      setAssignmentDialog((prev) => ({
        ...prev,
        error: 'Confirm that you want to update assignment for a unit not currently mapped to you.',
      }))
      return
    }

    if (!assignmentDialog.email) {
      setAssignmentDialog((prev) => ({ ...prev, error: 'Select an email ID to assign' }))
      return
    }

    setAssignmentDialog((prev) => ({ ...prev, submitting: true, error: '' }))

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/company-co/unit-management/units/${encodeURIComponent(assignmentDialog.unit.unit_id)}/assignment`,
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
      setAssignmentDialog(assignmentDialogDefaults)
      setAssignMode(false)
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

  const assignmentOptions = getAssignmentOptions(assignmentDialog.role)
  const tableBorderColor = theme.palette.mode === 'light'
    ? alpha(theme.palette.text.primary, 0.16)
    : alpha('#0f172a', 0.72)
  const mappedUnitNames = data.currentCoordinatorUnits
    .map((unit) => String(unit.unit_name || unit.unit_id || '').trim())
    .filter(Boolean)
  const selectedAssignmentUnitId = String(assignmentDialog.unit?.unit_id || '').trim()
  const isAssignmentOutsideMappedUnits =
    selectedAssignmentUnitId !== '' && !mappedUnitIdSet.has(selectedAssignmentUnitId)
  const isOwnCoordinatorAssignment =
    assignmentDialog.role === 'company_co' && !isAssignmentOutsideMappedUnits
  const selectedAssignmentUnitName = String(
    assignmentDialog.unit?.unit_name || assignmentDialog.unit?.unit_id || 'this unit'
  ).trim()
  const shellCardSx = {
    borderRadius: 3,
    border: '1px solid',
    borderColor: theme.palette.mode === 'light'
      ? alpha(theme.palette.divider, 0.9)
      : alpha('#0f172a', 0.72),
    backgroundColor: alpha(theme.palette.background.paper, 0.96),
    boxShadow: theme.palette.mode === 'dark'
      ? '0 10px 24px rgba(0, 0, 0, 0.16)'
      : '0 10px 24px rgba(15, 23, 42, 0.05)',
  }
  const sectionHeaderSx = {
    px: { xs: 2, sm: 2.5 },
    py: 2,
    display: 'flex',
    alignItems: { xs: 'flex-start', sm: 'center' },
    justifyContent: 'space-between',
    gap: 1.5,
    flexDirection: { xs: 'column', sm: 'row' },
  }
  const commonTableCellSx = {
    py: 1.5,
    px: 2.25,
    borderBottom: `1px solid ${tableBorderColor}`,
    verticalAlign: 'top',
  }
  const commonHeadCellSx = {
    ...commonTableCellSx,
    fontSize: '0.76rem',
    fontWeight: 800,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    color: 'text.secondary',
    backgroundColor: TABLE_HEADER_BG,
  }
  const assignButtonLabel = assignMode ? 'Select Unit To Reassign' : 'Assign'

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, py: 2 }}>
      <Box
        sx={{
          ...shellCardSx,
          p: { xs: 2, sm: 2.5 },
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 2,
          flexWrap: 'wrap',
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
            Unit Management
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.2, justifyContent: { xs: 'flex-start', lg: 'flex-end' } }}>
          <Button
            variant="contained"
            startIcon={<AddRoundedIcon />}
            onClick={() => setUnitDialog({ ...unitDialogDefaults, open: true })}
            disabled={loading || assignMode}
            sx={{ textTransform: 'none', fontWeight: 700 }}
          >
            Create Unit
          </Button>
          <Button
            variant="outlined"
            startIcon={<AddRoundedIcon />}
            onClick={handleOpenCreateDialog}
            disabled={loading || assignMode}
            sx={{ textTransform: 'none', fontWeight: 700 }}
          >
            Add Coordinator or Approver
          </Button>
        </Box>
      </Box>

      {error && <Alert severity="error" sx={{ borderRadius: 2.5 }}>{error}</Alert>}

      {loading ? (
        <Paper
          elevation={0}
          sx={{
            ...shellCardSx,
            p: 4,
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
              gridTemplateColumns: { xs: '1fr', lg: 'repeat(2, minmax(0, 1fr))' },
              gap: 2,
            }}
          >
            <Paper
              ref={unitMasterRef}
              elevation={0}
              sx={{
                ...shellCardSx,
                overflow: 'hidden',
              }}
            >
              <Box sx={sectionHeaderSx}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2, minWidth: 0, flex: 1 }}>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography sx={{ fontWeight: 850, color: 'text.primary' }}>
                      Unit Master
                    </Typography>
                    <Typography sx={{ mt: 0.4, color: 'text.secondary', fontSize: '0.9rem', lineHeight: 1.6 }}>
                      Review coordinator and approver ownership for each unit.
                    </Typography>
                  </Box>
                </Box>
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', justifyContent: { xs: 'flex-start', sm: 'flex-end' } }}>
                  {assignMode ? (
                    <Box
                      sx={{
                        ...STATUS_BADGE_PILL_SX,
                        backgroundColor: alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.24 : 0.12),
                        color: theme.palette.primary.main,
                      }}
                    >
                      Click a unit name to update its mapping
                    </Box>
                  ) : null}
                  <Button
                    variant={assignMode ? 'contained' : 'outlined'}
                    startIcon={assignMode ? <ArrowOutwardRoundedIcon /> : <AssignmentIndRoundedIcon />}
                    onClick={() => {
                      setAssignMode((prev) => !prev)
                    }}
                    disabled={loading || data.units.length === 0}
                    sx={{ textTransform: 'none', fontWeight: 700 }}
                  >
                    {assignMode ? 'Exit Reassign Mode' : assignButtonLabel}
                  </Button>
                </Box>
              </Box>
              <TableContainer sx={{ borderTop: `1px solid ${tableBorderColor}` }}>
                <Table sx={{ minWidth: 720, tableLayout: 'fixed' }}>
                  <TableHead>
                    <TableRow>
                      <TableCell
                        sx={{
                          ...commonHeadCellSx,
                          width: '20%',
                          ...(assignMode && {
                            color: 'primary.main',
                            backgroundColor: alpha(theme.palette.primary.main, 0.08),
                          }),
                        }}
                      >
                        Unit Name
                      </TableCell>
                      <TableCell sx={{ ...commonHeadCellSx, width: '40%' }}>
                        Coordinator
                      </TableCell>
                      <TableCell sx={{ ...commonHeadCellSx, width: '40%' }}>
                        Approver
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {data.units.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={3} sx={{ py: 3, px: 2.25, borderBottom: 0 }}>
                          <Typography color="text.secondary">No units found.</Typography>
                        </TableCell>
                      </TableRow>
                    ) : (
                      data.units.map((unit, index) => (
                        <TableRow
                          key={unit.unit_id || unit.id}
                          hover
                          sx={{
                            '&:last-of-type td': { borderBottom: 0 },
                            '&:hover': {
                              backgroundColor: TABLE_ROW_HOVER_BG,
                            },
                            '& td': {
                              borderBottom: index === data.units.length - 1 ? 0 : `1px solid ${tableBorderColor}`,
                            },
                          }}
                        >
                          <TableCell
                            role={assignMode ? 'button' : undefined}
                            tabIndex={assignMode ? 0 : undefined}
                            onClick={() => handleOpenAssignmentDialog(unit, 'company_co')}
                            onKeyDown={(event) => {
                              if (!assignMode) return
                              if (event.key === 'Enter' || event.key === ' ') {
                                event.preventDefault()
                                handleOpenAssignmentDialog(unit, 'company_co')
                              }
                            }}
                            sx={{
                              ...commonTableCellSx,
                              py: assignMode ? 1.3 : 1.55,
                              fontWeight: assignMode ? 850 : 650,
                              color: assignMode ? 'primary.dark' : 'text.primary',
                              backgroundColor: assignMode
                                ? alpha(theme.palette.primary.main, theme.palette.mode === 'light' ? 0.11 : 0.18)
                                : 'transparent',
                              boxShadow: assignMode
                                ? `inset 4px 0 0 ${theme.palette.primary.main}`
                                : 'none',
                              cursor: assignMode ? 'pointer' : 'default',
                              transition: theme.transitions.create(
                                ['background-color', 'box-shadow', 'color'],
                                { duration: theme.transitions.duration.shorter }
                              ),
                              ...(assignMode && {
                                textDecoration: 'underline',
                                textUnderlineOffset: '4px',
                                '&:hover, &:focus-visible': {
                                  backgroundColor: alpha(theme.palette.primary.main, theme.palette.mode === 'light' ? 0.18 : 0.26),
                                  boxShadow: `inset 6px 0 0 ${theme.palette.primary.dark}`,
                                  outline: 'none',
                                },
                              }),
                            }}
                          >
                            {unit.unit_name || 'N/A'}
                          </TableCell>
                          <TableCell sx={commonTableCellSx}>
                            {unit.coordinator_display_name || unit.coordinator_email_id || 'N/A'}
                          </TableCell>
                          <TableCell sx={commonTableCellSx}>
                            {unit.approver_display_name || unit.approver_email_id || 'N/A'}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Paper elevation={0} sx={{ ...shellCardSx, p: 2.25 }}>
                <Typography sx={{ fontSize: '0.76rem', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'text.secondary' }}>
                  Units Under Your Scope
                </Typography>
                <Typography sx={{ mt: 1, fontSize: '0.98rem', fontWeight: 700, color: 'text.primary', lineHeight: 1.65 }}>
                  {mappedUnitNames.length > 0 ? mappedUnitNames.join(', ') : 'No units are currently mapped to your coordinator account.'}
                </Typography>
              </Paper>

              <Paper
                elevation={0}
                sx={{
                  ...shellCardSx,
                  overflow: 'hidden',
                }}
              >
                <Box sx={sectionHeaderSx}>
                  <Box>
                    <Typography sx={{ fontWeight: 850, color: 'text.primary' }}>
                      Unassigned Coordinators and Approvers
                    </Typography>
                    <Typography sx={{ mt: 0.45, color: 'text.secondary', lineHeight: 1.6, fontSize: '0.92rem' }}>
                      These users exist in the company but are not yet linked to a unit.
                    </Typography>
                  </Box>
                  <Box
                    sx={{
                      ...STATUS_BADGE_PILL_SX,
                      backgroundColor: alpha(theme.palette.warning.main, theme.palette.mode === 'dark' ? 0.2 : 0.1),
                      color: theme.palette.warning.main,
                    }}
                  >
                    {data.unmappedRoleUsers.length} pending
                  </Box>
                </Box>
                <TableContainer sx={{ borderTop: `1px solid ${tableBorderColor}` }}>
                  <Table sx={{ minWidth: 720, tableLayout: 'fixed' }}>
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ ...commonHeadCellSx, width: '40%' }}>
                          Name
                        </TableCell>
                        <TableCell sx={{ ...commonHeadCellSx, width: '40%' }}>
                          Email ID
                        </TableCell>
                        <TableCell sx={{ ...commonHeadCellSx, width: '20%' }}>
                          Role
                        </TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {data.unmappedRoleUsers.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={3} sx={{ py: 3, px: 2.25, borderBottom: 0 }}>
                            <Typography color="text.secondary">No unassigned coordinators or approvers found.</Typography>
                          </TableCell>
                        </TableRow>
                      ) : (
                        data.unmappedRoleUsers.map((user, index) => (
                          <TableRow
                            key={`${user.role}-${user.email_id}`}
                            sx={{
                              '&:last-of-type td': { borderBottom: 0 },
                              '&:hover': {
                                backgroundColor: TABLE_ROW_HOVER_BG,
                              },
                              '& td': {
                                borderBottom:
                                  index === data.unmappedRoleUsers.length - 1 ? 0 : `1px solid ${tableBorderColor}`,
                              },
                            }}
                          >
                            <TableCell sx={commonTableCellSx}>
                              {(() => {
                                const displayName = String(user.display_name || '').trim()
                                const emailId = String(user.email_id || '').trim().toLowerCase()
                                if (!displayName) return '-'
                                if (displayName.toLowerCase() === emailId) return '-'
                                return displayName
                              })()}
                            </TableCell>
                            <TableCell sx={commonTableCellSx}>
                              {user.email_id || 'N/A'}
                            </TableCell>
                            <TableCell sx={commonTableCellSx}>
                              {user.role === 'company_co' ? 'Company Coordinator' : 'Approver'}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Paper>
            </Box>
          </Box>
        </>
      )}

      <Dialog
        open={assignmentDialog.open}
        onClose={handleCloseAssignmentDialog}
        fullWidth
        maxWidth="md"
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
          Assign {assignmentDialog.role === 'approver' ? 'Approver' : 'Company Coordinator'}
        </DialogTitle>
        <DialogContent
          dividers
          sx={{
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
            px: 3,
            pt: 2.5,
            pb: 3,
          }}
        >
          <Typography color="text.secondary" sx={{ lineHeight: 1.5 }}>
            {assignmentDialog.unit?.unit_name || 'Selected unit'}
          </Typography>
          {isOwnCoordinatorAssignment ? (
            <Alert severity="error">
              You cannot replace your own company coordinator assignment for this unit.
            </Alert>
          ) : null}
          {isAssignmentOutsideMappedUnits ? (
            <Alert severity="warning">
              User won&apos;t be able to access {selectedAssignmentUnitName}&apos;s controls.
            </Alert>
          ) : null}
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
          <FormControl
            fullWidth
            required
            disabled={assignmentDialog.submitting || assignmentOptions.length === 0 || isOwnCoordinatorAssignment}
          >
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
          {isAssignmentOutsideMappedUnits ? (
            <FormControlLabel
              control={
                <Checkbox
                  checked={assignmentDialog.confirmExternalAssignment}
                  onChange={(event) =>
                    setAssignmentDialog((prev) => ({
                      ...prev,
                      confirmExternalAssignment: event.target.checked,
                      error: '',
                    }))
                  }
                  disabled={assignmentDialog.submitting}
                />
              }
              label="I understand that I am updating assignment for a unit that is not under me."
            />
          ) : null}
          {assignmentDialog.error && <Alert severity={assignmentOptions.length === 0 ? 'info' : 'error'}>{assignmentDialog.error}</Alert>}
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
            onClick={handleCloseAssignmentDialog}
            disabled={assignmentDialog.submitting}
            variant="outlined"
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
            onClick={handleUpdateAssignment}
            disabled={
              assignmentDialog.submitting ||
              isOwnCoordinatorAssignment ||
              assignmentOptions.length === 0 ||
              (isAssignmentOutsideMappedUnits && !assignmentDialog.confirmExternalAssignment)
            }
            sx={{
              textTransform: 'none',
              px: 3,
              py: 1,
              minWidth: '100px',
              fontWeight: 600,
            }}
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
        <DialogTitle>Create Coordinator / Approver</DialogTitle>
        <DialogContent dividers sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2.5 }}>
          <FormControl fullWidth required disabled={createDialog.submitting}>
            <InputLabel id="create-user-role-label">Role</InputLabel>
            <Select
              labelId="create-user-role-label"
              label="Role"
              value={createDialog.type}
              onChange={(event) =>
                setCreateDialog((prev) => ({ ...prev, type: event.target.value, error: '' }))
              }
            >
              <MenuItem value="company_co">Company Coordinator</MenuItem>
              <MenuItem value="approver">Approver</MenuItem>
            </Select>
          </FormControl>
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
          {createDialog.error && <Alert severity="error">{createDialog.error}</Alert>}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseCreateDialog} disabled={createDialog.submitting}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleCreateMappedUser}
            disabled={createDialog.submitting}
          >
            {createDialog.submitting ? 'Creating...' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

export default UnitManagement
