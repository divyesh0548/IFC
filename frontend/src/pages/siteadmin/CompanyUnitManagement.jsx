import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { alpha, useTheme } from '@mui/material/styles'
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import RefreshIcon from '@mui/icons-material/Refresh'
import AddRoundedIcon from '@mui/icons-material/AddRounded'
import AssignmentIndRoundedIcon from '@mui/icons-material/AssignmentIndRounded'
import ArrowOutwardRoundedIcon from '@mui/icons-material/ArrowOutwardRounded'
import { toast } from 'react-hot-toast'
import { MAIN_CONTENT_MAX_WIDTH } from '../../uiConstants'
import { useSyncGlobalLoading } from '../../contexts/GlobalLoadingContext'
import { apiUrl } from '../../config/api'
import {
  STATUS_BADGE_PILL_SX,
  TABLE_HEADER_BG,
  TABLE_ROW_HOVER_BG,
} from '../../uiConstants'

const emptyUnitData = {
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

const assignmentDialogDefaults = {
  open: false,
  unit: null,
  role: 'company_co',
  email: '',
  submitting: false,
  error: '',
}

function CompanyUnitManagement() {
  const theme = useTheme()
  const navigate = useNavigate()
  const unitMasterRef = useRef(null)
  const { company_identifier } = useParams()

  const [company, setCompany] = useState(null)
  const [unitData, setUnitData] = useState(emptyUnitData)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [assignMode, setAssignMode] = useState(false)
  const [createDialog, setCreateDialog] = useState(createDialogDefaults)
  const [assignmentDialog, setAssignmentDialog] = useState(assignmentDialogDefaults)

  useSyncGlobalLoading(loading)
  useSyncGlobalLoading(createDialog.submitting)
  useSyncGlobalLoading(assignmentDialog.submitting)

  const fetchCompany = useCallback(async () => {
    const response = await fetch(apiUrl(`/api/siteadmin/companies/${company_identifier}`), {
      method: 'GET',
      credentials: 'include',
    })
    const data = await response.json()
    if (!response.ok || !data.success) {
      throw new Error(data.message || 'Failed to fetch company data')
    }
    return data.data
  }, [company_identifier])

  const fetchUnitManagement = useCallback(async () => {
    const response = await fetch(apiUrl(`/api/siteadmin/companies/${company_identifier}/unit-management`), {
      credentials: 'include',
    })
    const result = await response.json()
    if (!response.ok || !result?.success) {
      throw new Error(result?.message || 'Failed to fetch unit management data')
    }

    return {
      currentCoordinatorUnits: Array.isArray(result.data?.currentCoordinatorUnits) ? result.data.currentCoordinatorUnits : [],
      approvers: Array.isArray(result.data?.approvers) ? result.data.approvers : [],
      coordinators: Array.isArray(result.data?.coordinators) ? result.data.coordinators : [],
      unmappedRoleUsers: Array.isArray(result.data?.unmappedRoleUsers) ? result.data.unmappedRoleUsers : [],
      unmappedCoordinatorUnits: Array.isArray(result.data?.unmappedCoordinatorUnits) ? result.data.unmappedCoordinatorUnits : [],
      unmappedApproverUnits: Array.isArray(result.data?.unmappedApproverUnits) ? result.data.unmappedApproverUnits : [],
      assignmentCoordinators: Array.isArray(result.data?.assignmentCoordinators) ? result.data.assignmentCoordinators : [],
      assignmentApprovers: Array.isArray(result.data?.assignmentApprovers) ? result.data.assignmentApprovers : [],
      units: Array.isArray(result.data?.units) ? result.data.units : [],
    }
  }, [company_identifier])

  const loadPage = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [companyData, unitManagementData] = await Promise.all([
        fetchCompany(),
        fetchUnitManagement(),
      ])
      setCompany(companyData)
      setUnitData(unitManagementData)
    } catch (loadError) {
      console.error('Error loading company unit management:', loadError)
      setError(loadError.message || 'Error fetching unit management data')
      setCompany(null)
      setUnitData(emptyUnitData)
    } finally {
      setLoading(false)
    }
  }, [fetchCompany, fetchUnitManagement])

  useEffect(() => {
    loadPage()
  }, [loadPage])

  useEffect(() => {
    if (!assignMode) return undefined
    if (assignmentDialog.open) return undefined

    const handleOutsideClick = (event) => {
      if (unitMasterRef.current?.contains(event.target)) return
      setAssignMode(false)
    }

    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [assignMode, assignmentDialog.open])

  const getAssignmentOptions = (role, unit = assignmentDialog.unit) => {
    const currentEmail = role === 'approver' ? unit?.approver_email_id : unit?.coordinator_email_id
    const options = role === 'approver' ? unitData.assignmentApprovers : unitData.assignmentCoordinators
    return options.filter(
      (person) => String(person.email_id || '').trim().toLowerCase() !== String(currentEmail || '').trim().toLowerCase()
    )
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
      ? apiUrl(`/api/siteadmin/companies/${company_identifier}/unit-management/approvers`)
      : apiUrl(`/api/siteadmin/companies/${company_identifier}/unit-management/coordinators`)

    setCreateDialog((prev) => ({ ...prev, submitting: true, error: '' }))

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email_id: email }),
      })
      const result = await response.json()
      if (!response.ok || !result?.success) {
        throw new Error(result?.message || 'Failed to create user')
      }
      toast.success(result.message || 'User created successfully')
      setCreateDialog(createDialogDefaults)
      await loadPage()
    } catch (createError) {
      console.error('Create siteadmin mapped user error:', createError)
      setCreateDialog((prev) => ({
        ...prev,
        submitting: false,
        error: createError.message || 'Network error while creating user',
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
        apiUrl(`/api/siteadmin/companies/${company_identifier}/unit-management/units/${encodeURIComponent(assignmentDialog.unit.unit_id)}/assignment`),
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
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
      await loadPage()
    } catch (assignmentError) {
      console.error('Update siteadmin unit assignment error:', assignmentError)
      setAssignmentDialog((prev) => ({
        ...prev,
        submitting: false,
        error: assignmentError.message || 'Network error while updating assignment',
      }))
    }
  }

  const assignmentOptions = getAssignmentOptions(assignmentDialog.role)
  const tableBorderColor = theme.palette.mode === 'light' ? alpha(theme.palette.text.primary, 0.16) : alpha('#0f172a', 0.72)
  const shellCardSx = {
    borderRadius: 3,
    border: '1px solid',
    borderColor: theme.palette.mode === 'light' ? alpha(theme.palette.divider, 0.9) : alpha('#0f172a', 0.72),
    backgroundColor: alpha(theme.palette.background.paper, 0.96),
    boxShadow: theme.palette.mode === 'dark' ? '0 10px 24px rgba(0, 0, 0, 0.16)' : '0 10px 24px rgba(15, 23, 42, 0.05)',
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
    py: 1.25,
    px: 2.25,
    borderBottom: `1px solid ${tableBorderColor}`,
    verticalAlign: 'middle',
    height: 56,
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
  const getTooltipTitle = (value) => {
    const text = String(value || '').trim()
    return text || 'N/A'
  }
  const renderTruncatedCell = (value, typographySx = {}) => (
    <Tooltip title={getTooltipTitle(value)} arrow placement="top">
      <Typography
        component="span"
        sx={{
          display: 'block',
          width: '100%',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          ...typographySx,
        }}
      >
        {getTooltipTitle(value)}
      </Typography>
    </Tooltip>
  )
  const companyName = useMemo(() => String(company?.company_name || '').trim(), [company])
  const assignedCoordinatorEmails = useMemo(
    () =>
      new Set(
        unitData.units
          .map((unit) => String(unit.coordinator_email_id || '').trim().toLowerCase())
          .filter(Boolean)
      ),
    [unitData.units]
  )
  const assignedApproverEmails = useMemo(
    () =>
      new Set(
        unitData.units
          .map((unit) => String(unit.approver_email_id || '').trim().toLowerCase())
          .filter(Boolean)
      ),
    [unitData.units]
  )
  const unassignedRoleUsers = useMemo(
    () =>
      unitData.unmappedRoleUsers.filter((user) => {
        const email = String(user.email_id || '').trim().toLowerCase()
        if (!email) return false
        if (user.role === 'company_co') return !assignedCoordinatorEmails.has(email)
        if (user.role === 'approver') return !assignedApproverEmails.has(email)
        return false
      }),
    [assignedApproverEmails, assignedCoordinatorEmails, unitData.unmappedRoleUsers]
  )

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <Box sx={{ width: '100%', maxWidth: MAIN_CONTENT_MAX_WIDTH, mx: 'auto', px: 0, py: { xs: 3, sm: 4 } }}>
        <Stack spacing={2.5}>
          {error ? (
            <Alert
              severity="error"
              action={
                <Button
                  onClick={() => navigate(`/siteadmin/company/${company_identifier}`)}
                  startIcon={<ArrowBackIcon />}
                  variant="outlined"
                >
                  Back
                </Button>
              }
              sx={{ alignItems: 'center' }}
            >
              {error}
            </Alert>
          ) : null}

          <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button
              variant="outlined"
              startIcon={<AddRoundedIcon />}
              onClick={() => setCreateDialog({ ...createDialogDefaults, open: true })}
              disabled={loading || assignMode}
              sx={{ textTransform: 'none', fontWeight: 700 }}
            >
              Create Coordinator/Approver
            </Button>
          </Box>

          <Box
            sx={{
              ...shellCardSx,
              p: { xs: 2.5, sm: 3 },
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: { xs: 'flex-start', lg: 'center' },
              flexDirection: { xs: 'column', lg: 'row' },
              gap: 2.5,
            }}
          >
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Typography variant="h5" sx={{ fontWeight: 800, letterSpacing: '-0.02em' }}>
                Unit Management
              </Typography>
              <Typography color="text.secondary" sx={{ mt: 0.5 }}>
                {companyName || 'Company'}
              </Typography>
            </Box>
            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" justifyContent="flex-end">
              <IconButton onClick={() => navigate(`/siteadmin/company/${company_identifier}`)} aria-label="back">
                <ArrowBackIcon />
              </IconButton>
              <IconButton onClick={loadPage} aria-label="refresh">
                <RefreshIcon />
              </IconButton>
            </Stack>
          </Box>

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
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
              {/* <Paper
                elevation={0}
                sx={{
                  ...shellCardSx,
                  p: 2.25,
                  background: theme.palette.mode === 'dark'
                    ? `linear-gradient(135deg, ${alpha(theme.palette.background.paper, 0.96)} 0%, ${alpha(theme.palette.primary.main, 0.16)} 100%)`
                    : `linear-gradient(135deg, ${alpha(theme.palette.background.paper, 0.98)} 0%, ${alpha(theme.palette.primary.main, 0.08)} 100%)`,
                }}
              >
                <Typography sx={{ fontSize: '0.98rem', fontWeight: 700, color: 'text.primary', lineHeight: 1.65 }}>
                  Quick Summary: {unitData.units.length} units, {unitData.assignmentCoordinators.length} coordinators, {unitData.assignmentApprovers.length} approvers, {unassignedRoleUsers.length} unassigned users
                </Typography>
              </Paper> */}

              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', xl: '1.6fr 1fr' }, gap: 2 }}>
                <Paper ref={unitMasterRef} elevation={0} sx={{ ...shellCardSx, overflow: 'hidden' }}>
                  <Box sx={sectionHeaderSx}>
                    <Typography sx={{ fontWeight: 850, color: 'text.primary' }}>Unit Master</Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', justifyContent: { xs: 'flex-start', sm: 'flex-end' } }}>
                      {assignMode ? (
                        <Box
                          sx={{
                            ...STATUS_BADGE_PILL_SX,
                            backgroundColor: alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.24 : 0.12),
                            color: theme.palette.primary.main,
                          }}
                        >
                          Click a unit name to update mapping
                        </Box>
                      ) : null}
                      <Button
                        variant={assignMode ? 'contained' : 'outlined'}
                        startIcon={assignMode ? <ArrowOutwardRoundedIcon /> : <AssignmentIndRoundedIcon />}
                        onClick={() => setAssignMode((prev) => !prev)}
                        disabled={loading || unitData.units.length === 0}
                        sx={{ textTransform: 'none', fontWeight: 700 }}
                      >
                        {assignMode ? 'Exit Reassign Mode' : 'Assign'}
                      </Button>
                    </Box>
                  </Box>
                  <TableContainer sx={{ borderTop: `1px solid ${tableBorderColor}` }}>
                    <Table sx={{ minWidth: 720, tableLayout: 'fixed' }}>
                      <TableHead>
                        <TableRow>
                          <TableCell sx={{ ...commonHeadCellSx, width: '22%', ...(assignMode ? { color: 'primary.main', backgroundColor: alpha(theme.palette.primary.main, 0.08) } : {}) }}>Unit Name</TableCell>
                          <TableCell sx={{ ...commonHeadCellSx, width: '39%' }}>Coordinator</TableCell>
                          <TableCell sx={{ ...commonHeadCellSx, width: '39%' }}>Approver</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {unitData.units.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={3} sx={{ py: 3, px: 2.25, borderBottom: 0 }}>
                              <Typography color="text.secondary">No units found.</Typography>
                            </TableCell>
                          </TableRow>
                        ) : (
                          unitData.units.map((unit, index) => (
                            <TableRow
                              key={unit.unit_id || unit.id}
                              sx={{
                                '&:last-of-type td': { borderBottom: 0 },
                                '&:hover': { backgroundColor: TABLE_ROW_HOVER_BG },
                                '& td': { borderBottom: index === unitData.units.length - 1 ? 0 : `1px solid ${tableBorderColor}` },
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
                                  py: assignMode ? 1 : 1.25,
                                  fontWeight: assignMode ? 850 : 650,
                                  color: assignMode ? 'primary.dark' : 'text.primary',
                                  backgroundColor: assignMode ? alpha(theme.palette.primary.main, theme.palette.mode === 'light' ? 0.11 : 0.18) : 'transparent',
                                  boxShadow: assignMode ? `inset 4px 0 0 ${theme.palette.primary.main}` : 'none',
                                  cursor: assignMode ? 'pointer' : 'default',
                                  transition: theme.transitions.create(['background-color', 'box-shadow', 'color'], { duration: theme.transitions.duration.shorter }),
                                  ...(assignMode ? {
                                    textDecoration: 'underline',
                                    textUnderlineOffset: '4px',
                                    '&:hover, &:focus-visible': {
                                      backgroundColor: alpha(theme.palette.primary.main, theme.palette.mode === 'light' ? 0.18 : 0.26),
                                      boxShadow: `inset 6px 0 0 ${theme.palette.primary.dark}`,
                                      outline: 'none',
                                    },
                                  } : {}),
                                }}
                              >
                                {renderTruncatedCell(unit.unit_name, {
                                  fontWeight: assignMode ? 850 : 650,
                                  color: assignMode ? 'primary.dark' : 'text.primary',
                                })}
                              </TableCell>
                              <TableCell sx={commonTableCellSx}>
                                {renderTruncatedCell(unit.coordinator_display_name || unit.coordinator_email_id || 'N/A')}
                              </TableCell>
                              <TableCell sx={commonTableCellSx}>
                                {renderTruncatedCell(unit.approver_display_name || unit.approver_email_id || 'N/A')}
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Paper>

                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <Paper elevation={0} sx={{ ...shellCardSx, overflow: 'hidden' }}>
                    <Box sx={sectionHeaderSx}>
                      <Typography sx={{ fontWeight: 850, color: 'text.primary' }}>Unassigned Users</Typography>
                      <Box
                        sx={{
                          ...STATUS_BADGE_PILL_SX,
                          backgroundColor: alpha(theme.palette.info.main, theme.palette.mode === 'dark' ? 0.2 : 0.1),
                          color: theme.palette.info.main,
                        }}
                      >
                        {unassignedRoleUsers.length} unassigned
                      </Box>
                    </Box>
                    <TableContainer sx={{ borderTop: `1px solid ${tableBorderColor}` }}>
                      <Table sx={{ minWidth: 640, tableLayout: 'fixed' }}>
                        <TableHead>
                          <TableRow>
                            <TableCell sx={{ ...commonHeadCellSx, width: '40%' }}>Name</TableCell>
                            <TableCell sx={{ ...commonHeadCellSx, width: '40%' }}>Email ID</TableCell>
                            <TableCell sx={{ ...commonHeadCellSx, width: '20%' }}>Role</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {unassignedRoleUsers.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={3} sx={{ py: 3, px: 2.25, borderBottom: 0 }}>
                                <Typography color="text.secondary">All coordinators and approvers are assigned to at least one unit.</Typography>
                              </TableCell>
                            </TableRow>
                          ) : (
                            unassignedRoleUsers.map((user, index) => (
                              <TableRow
                                key={`${user.role}-${user.email_id}`}
                                sx={{
                                  '&:last-of-type td': { borderBottom: 0 },
                                  '&:hover': { backgroundColor: TABLE_ROW_HOVER_BG },
                                  '& td': { borderBottom: index === unassignedRoleUsers.length - 1 ? 0 : `1px solid ${tableBorderColor}` },
                                }}
                              >
                                <TableCell sx={commonTableCellSx}>
                                  {(() => {
                                    const displayName = String(user.display_name || '').trim()
                                    const emailId = String(user.email_id || '').trim().toLowerCase()
                                    if (!displayName) return renderTruncatedCell('-')
                                    if (displayName.toLowerCase() === emailId) return renderTruncatedCell('-')
                                    return renderTruncatedCell(displayName)
                                  })()}
                                </TableCell>
                                <TableCell sx={commonTableCellSx}>
                                  {renderTruncatedCell(user.email_id || 'N/A')}
                                </TableCell>
                                <TableCell sx={commonTableCellSx}>
                                  {renderTruncatedCell(user.role === 'company_co' ? 'Company Coordinator' : 'Approver')}
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

              <Paper elevation={0} sx={{ ...shellCardSx, overflow: 'hidden' }}>
                <Box sx={sectionHeaderSx}>
                  <Typography sx={{ fontWeight: 850, color: 'text.primary' }}>All Units</Typography>
                </Box>
                <TableContainer sx={{ borderTop: `1px solid ${tableBorderColor}` }}>
                  <Table sx={{ minWidth: 720, tableLayout: 'fixed' }}>
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ ...commonHeadCellSx, width: '30%' }}>Name</TableCell>
                        <TableCell sx={{ ...commonHeadCellSx, width: '50%' }}>Address</TableCell>
                        <TableCell sx={{ ...commonHeadCellSx, width: '20%' }}>Total Users</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {unitData.units.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={3} sx={{ py: 3, px: 2.25, borderBottom: 0 }}>
                            <Typography color="text.secondary">No units found.</Typography>
                          </TableCell>
                        </TableRow>
                      ) : (
                        unitData.units.map((unit, index) => (
                          <TableRow
                            key={`details-${unit.unit_id || unit.id}`}
                            sx={{
                              '&:last-of-type td': { borderBottom: 0 },
                              '&:hover': { backgroundColor: TABLE_ROW_HOVER_BG },
                              '& td': { borderBottom: index === unitData.units.length - 1 ? 0 : `1px solid ${tableBorderColor}` },
                            }}
                          >
                            <TableCell sx={commonTableCellSx}>
                              {renderTruncatedCell(unit.unit_name || 'N/A')}
                            </TableCell>
                            <TableCell sx={commonTableCellSx}>
                              {renderTruncatedCell(unit.unit_address || 'N/A')}
                            </TableCell>
                            <TableCell sx={commonTableCellSx}>
                              {renderTruncatedCell(String(unit.total_users ?? 0))}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Paper>
            </Box>
          )}
        </Stack>
      </Box>

      <Dialog open={createDialog.open} onClose={handleCloseCreateDialog} fullWidth maxWidth="sm">
        <DialogTitle>Create Coordinator / Approver</DialogTitle>
        <DialogContent dividers sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2.5 }}>
          <FormControl fullWidth required disabled={createDialog.submitting}>
            <InputLabel id="siteadmin-create-user-role-label">Role</InputLabel>
            <Select
              labelId="siteadmin-create-user-role-label"
              label="Role"
              value={createDialog.type}
              onChange={(event) => setCreateDialog((prev) => ({ ...prev, type: event.target.value, error: '' }))}
            >
              <MenuItem value="company_co">Company Coordinator</MenuItem>
              <MenuItem value="approver">Approver</MenuItem>
            </Select>
          </FormControl>
          <TextField
            label="Email ID"
            type="email"
            value={createDialog.email}
            onChange={(event) => setCreateDialog((prev) => ({ ...prev, email: event.target.value, error: '' }))}
            disabled={createDialog.submitting}
            fullWidth
            required
          />
          {createDialog.error && <Alert severity="error">{createDialog.error}</Alert>}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseCreateDialog} disabled={createDialog.submitting}>Cancel</Button>
          <Button variant="contained" onClick={handleCreateMappedUser} disabled={createDialog.submitting}>
            {createDialog.submitting ? 'Creating...' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={assignmentDialog.open} onClose={handleCloseAssignmentDialog} fullWidth maxWidth="md">
        <DialogTitle>Assign {assignmentDialog.role === 'approver' ? 'Approver' : 'Company Coordinator'}</DialogTitle>
        <DialogContent dividers sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2.5 }}>
          <Typography color="text.secondary" sx={{ lineHeight: 1.5 }}>
            {assignmentDialog.unit?.unit_name || 'Selected unit'}
          </Typography>
          <FormControl fullWidth required disabled={assignmentDialog.submitting}>
            <InputLabel id="siteadmin-assignment-role-label">Assignment Type</InputLabel>
            <Select
              labelId="siteadmin-assignment-role-label"
              label="Assignment Type"
              value={assignmentDialog.role}
              onChange={(event) => handleAssignmentRoleChange(event.target.value)}
            >
              <MenuItem value="company_co">Company Coordinator</MenuItem>
              <MenuItem value="approver">Approver</MenuItem>
            </Select>
          </FormControl>
          <FormControl fullWidth required disabled={assignmentDialog.submitting || assignmentOptions.length === 0}>
            <InputLabel id="siteadmin-assignment-email-label">Email ID</InputLabel>
            <Select
              labelId="siteadmin-assignment-email-label"
              label="Email ID"
              value={assignmentDialog.email}
              onChange={(event) => setAssignmentDialog((prev) => ({ ...prev, email: event.target.value, error: '' }))}
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
          <Button onClick={handleCloseAssignmentDialog} disabled={assignmentDialog.submitting}>Cancel</Button>
          <Button variant="contained" onClick={handleUpdateAssignment} disabled={assignmentDialog.submitting || assignmentOptions.length === 0}>
            {assignmentDialog.submitting ? 'Assigning...' : 'Assign'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

export default CompanyUnitManagement
