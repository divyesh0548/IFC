import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { alpha, useTheme } from '@mui/material/styles'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Checkbox from '@mui/material/Checkbox'
import ListItemText from '@mui/material/ListItemText'
import CircularProgress from '@mui/material/CircularProgress'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogContentText from '@mui/material/DialogContentText'
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
import AddIcon from '@mui/icons-material/Add'
import DeleteIcon from '@mui/icons-material/Delete'
import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded'
import UploadFileRoundedIcon from '@mui/icons-material/UploadFileRounded'
import { toast } from 'react-hot-toast'
import * as XLSX from 'xlsx'
import { apiUrl } from '../../config/api'
import { useSyncGlobalLoading } from '../../contexts/GlobalLoadingContext'
import { useAuth } from '../../contexts/AuthContext'
import { useOrganizationEmailWarning } from '../../hooks/useOrganizationEmailWarning'
import { DASHBOARD_PAGE_OUTER_SX, DASHBOARD_PAPER_SX, TABLE_HEADER_BG, TABLE_ROW_HOVER_BG } from '../../uiConstants'
import { getMobileValidationError, normalizeMobileDigits } from '../../utils/mobileValidation'

const bulkUploadRequiredHeaders = ['Name', 'Email ID', 'Department', 'Designation', 'Mobile']

function formatRoleLabel(role) {
  const normalized = String(role || '').trim()
  if (!normalized) return '-'
  if (normalized === 'company_co') return 'Company Coordinator'
  if (normalized === 'company_admin') return 'Company Admin'
  return normalized
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ')
}

function CompanyAdminUserManagement() {
  const theme = useTheme()
  const navigate = useNavigate()
  const bulkFileInputRef = useRef(null)
  const { email } = useAuth()
  const currentUserEmail = String(email || '').trim().toLowerCase()
  const [users, setUsers] = useState([])
  const [unitOptions, setUnitOptions] = useState([])
  const [unitsLoading, setUnitsLoading] = useState(false)
  const [loadingUsers, setLoadingUsers] = useState(true)
  const [usersError, setUsersError] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [deleteMode, setDeleteMode] = useState(false)
  const [selectedUserEmails, setSelectedUserEmails] = useState(new Set())
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deletingUsers, setDeletingUsers] = useState(false)
  const [bulkDialog, setBulkDialog] = useState({
    open: false,
    unitIds: [],
    fileName: '',
    rows: [],
    nonOrgCount: 0,
    confirmNonOrg: false,
    submitting: false,
    error: '',
  })
  const [bulkWarningDialogOpen, setBulkWarningDialogOpen] = useState(false)
  const pageLoading = loadingUsers || bulkDialog.submitting || deletingUsers || unitsLoading
  const { countNonOrganizationEmails } = useOrganizationEmailWarning()

  useSyncGlobalLoading(pageLoading)

  const fetchUsers = async () => {
    setLoadingUsers(true)
    setUsersError('')
    try {
      const response = await fetch(apiUrl('/api/company-admin/users'), { credentials: 'include' })
      const result = await response.json()
      if (response.ok && result?.success) {
        setUsers(Array.isArray(result.users) ? result.users : [])
      } else {
        setUsersError(result.message || 'Failed to fetch users')
      }
    } catch (error) {
      console.error('Company admin fetch users error:', error)
      setUsersError('Network error while fetching users')
    } finally {
      setLoadingUsers(false)
    }
  }

  useEffect(() => {
    fetchUsers()
    fetchCompanyUnits()
  }, [])

  const fetchCompanyUnits = async () => {
    setUnitsLoading(true)
    try {
      const response = await fetch(apiUrl('/api/company-admin/unit-management'), { credentials: 'include' })
      const result = await response.json()
      if (response.ok && result?.success) {
        const units = Array.isArray(result.data?.units) ? result.data.units : []
        setUnitOptions(units)
      } else {
        setUnitOptions([])
      }
    } catch (error) {
      console.error('Company admin fetch units error:', error)
      setUnitOptions([])
    } finally {
      setUnitsLoading(false)
    }
  }

  useEffect(() => {
    if (!deleteMode) {
      setSelectedUserEmails(new Set())
    }
  }, [deleteMode])

  const handleDeleteModeClickOutside = useCallback((event) => {
    if (deleteDialogOpen) return

    const target = event.target
    const isCheckbox = target.type === 'checkbox'
      || target.closest('input[type="checkbox"]')
      || target.closest('[role="checkbox"]')
    const isDialog = target.closest('[role="dialog"]')
    const isDeleteModeToggle = target.closest('[data-delete-mode-toggle]')

    if (isCheckbox || isDialog || isDeleteModeToggle) return

    setDeleteMode(false)
    setSelectedUserEmails(new Set())
  }, [deleteDialogOpen])

  useEffect(() => {
    if (!deleteMode) return undefined

    const timeoutId = setTimeout(() => {
      document.addEventListener('click', handleDeleteModeClickOutside, true)
    }, 100)

    return () => {
      clearTimeout(timeoutId)
      document.removeEventListener('click', handleDeleteModeClickOutside, true)
    }
  }, [deleteMode, handleDeleteModeClickOutside])

  const roleOptions = useMemo(() => Array.from(new Set(users.map((user) => String(user.role || '').trim()).filter(Boolean))).sort(), [users])
  const filteredUsers = useMemo(
    () => users.filter((user) => roleFilter === 'all' || String(user.role || '').trim() === roleFilter),
    [users, roleFilter]
  )

  const hasMultipleUnits = unitOptions.length > 1
  const getUnitNamesFromIds = useCallback((unitIds) => (
    (Array.isArray(unitIds) ? unitIds : [])
      .map((unitId) => unitOptions.find((unit) => unit.unit_id === unitId))
      .filter(Boolean)
      .map((unit) => unit.unit_name || unit.unit_id)
  ), [unitOptions])

  const openBulkDialog = () => {
    setBulkDialog({
      open: true,
      unitIds: unitOptions[0]?.unit_id ? [unitOptions[0].unit_id] : [],
      fileName: '',
      rows: [],
      nonOrgCount: 0,
      confirmNonOrg: false,
      submitting: false,
      error: '',
    })
  }

  const closeBulkDialog = () => {
    setBulkDialog({
      open: false,
      unitIds: [],
      fileName: '',
      rows: [],
      nonOrgCount: 0,
      confirmNonOrg: false,
      submitting: false,
      error: '',
    })
  }

  const handleBulkFileChange = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      const arrayBuffer = await file.arrayBuffer()
      const workbook = XLSX.read(arrayBuffer, { type: 'array' })
      const worksheet = workbook.Sheets[workbook.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json(worksheet, { defval: '' })
      setBulkDialog((prev) => ({
        ...prev,
        fileName: file.name,
        rows: rows.map((row) => ({
          emp_name: String(row['Name'] || '').trim(),
          email_id: String(row['Email ID'] || '').trim(),
          department: String(row['Department'] || '').trim(),
          designation: String(row['Designation'] || '').trim(),
          mobile: normalizeMobileDigits(row['Mobile']) || '',
        })),
        nonOrgCount: countNonOrganizationEmails(rows.map((row) => String(row['Email ID'] || '').trim())),
        confirmNonOrg: false,
        error: '',
      }))
    } catch (error) {
      console.error('Company admin bulk parse error:', error)
      setBulkDialog((prev) => ({ ...prev, rows: [], error: 'Failed to read excel file' }))
    }
  }

  const executeBulkUpload = async () => {
    if (bulkDialog.unitIds.length === 0) {
      setBulkDialog((prev) => ({ ...prev, error: 'Select at least one unit to map users' }))
      return
    }

    if (bulkDialog.rows.length === 0) {
      setBulkDialog((prev) => ({ ...prev, error: 'Upload a valid excel file first' }))
      return
    }

    const invalidMobileRows = bulkDialog.rows
      .map((row, index) => ({ row, rowNumber: index + 2 }))
      .filter(({ row }) => !row.mobile || getMobileValidationError(row.mobile))

    if (invalidMobileRows.length > 0) {
      setBulkDialog((prev) => ({
        ...prev,
        error: `Invalid or missing mobile number on row(s): ${invalidMobileRows.map((item) => item.rowNumber).join(', ')}`,
      }))
      return
    }

    setBulkDialog((prev) => ({ ...prev, submitting: true, error: '' }))
    try {
      const response = await fetch(apiUrl('/api/company-admin/users/bulk'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          role: 'user',
          unit_ids: bulkDialog.unitIds,
          users: bulkDialog.rows,
        }),
      })
      const result = await response.json()
      if (!response.ok || !result?.success) {
        throw new Error(result?.message || 'Failed to upload users')
      }
      toast.success(result.message || 'Bulk upload completed')
      setBulkDialog({ open: false, unitIds: [], fileName: '', rows: [], nonOrgCount: 0, confirmNonOrg: false, submitting: false, error: '' })
      await fetchUsers()
    } catch (error) {
      setBulkDialog((prev) => ({ ...prev, submitting: false, error: error.message || 'Failed to upload users' }))
    }
  }

  const handleBulkUpload = async () => {
    if (bulkDialog.nonOrgCount > 0 && !bulkDialog.confirmNonOrg) {
      setBulkWarningDialogOpen(true)
      return
    }
    await executeBulkUpload()
  }

  const handleExport = () => {
    if (filteredUsers.length === 0) {
      toast.error('No users available for export')
      return
    }
    const worksheet = XLSX.utils.json_to_sheet(filteredUsers.map((user) => ({
      Name: user.emp_name || '-',
      'Email ID': user.email_id || '-',
      Role: formatRoleLabel(user.role),
      Department: user.department || '-',
      Designation: user.designation || '-',
      Mobile: user.mobile || '-',
    })))
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Users')
    XLSX.writeFile(workbook, 'company_admin_users.xlsx')
  }

  const handleDeleteUsers = async () => {
    setDeletingUsers(true)
    try {
      const response = await fetch(apiUrl('/api/company-admin/users/delete'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email_ids: Array.from(selectedUserEmails) }),
      })
      const result = await response.json()
      if (!response.ok || !result?.success) {
        throw new Error(result?.message || 'Failed to delete users')
      }
      toast.success(result.message || 'Users deleted successfully')
      setDeleteDialogOpen(false)
      setDeleteMode(false)
      setSelectedUserEmails(new Set())
      await fetchUsers()
    } catch (error) {
      toast.error(error.message || 'Failed to delete users')
    } finally {
      setDeletingUsers(false)
    }
  }

  const tableBorderColor = alpha(theme.palette.text.primary, theme.palette.mode === 'light' ? 0.16 : 0.2)
  const bodyCellSx = { py: 1.55, px: 2.25, borderBottom: `1px solid ${tableBorderColor}`, verticalAlign: 'top' }
  const headCellSx = { ...bodyCellSx, py: 1.7, fontSize: '0.84rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'text.secondary', backgroundColor: TABLE_HEADER_BG }

  return (
    <Box sx={DASHBOARD_PAGE_OUTER_SX}>
      <Paper elevation={0} sx={{ ...DASHBOARD_PAPER_SX, overflow: 'visible', backgroundColor: 'transparent', boxShadow: 'none', borderRadius: 0 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap', alignItems: { xs: 'stretch', md: 'flex-start' }, py: 2.25, flexDirection: { xs: 'column', md: 'row' }, borderBottom: '1px solid', borderColor: 'divider', mb: 2 }}>
          <Box>
            <Typography component="h1" sx={{ fontSize: { xs: '1.45rem', sm: '1.7rem' }, fontWeight: 850, lineHeight: 1.15 }}>
              User Management
            </Typography>
            <Typography sx={{ mt: 0.65, color: 'text.secondary', lineHeight: 1.6 }}>
              Manage all company users and create company coordinators, approvers, or normal users without immediate assignment.
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 1.25, flexWrap: 'wrap', alignItems: 'center' }}>
            <FormControl size="small" sx={{ minWidth: { xs: '100%', sm: 220 } }} disabled={deleteMode}>
              <InputLabel id="company-admin-role-filter">Role</InputLabel>
              <Select labelId="company-admin-role-filter" label="Role" value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)}>
                <MenuItem value="all">All Roles</MenuItem>
                {roleOptions.map((role) => (
                  <MenuItem key={role} value={role}>{formatRoleLabel(role)}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <Button variant="outlined" startIcon={<UploadFileRoundedIcon />} disabled={deleteMode} onClick={openBulkDialog} sx={{ textTransform: 'none', fontWeight: 700 }}>
              Bulk Upload
            </Button>
            <Button variant="outlined" startIcon={<DownloadRoundedIcon />} disabled={deleteMode} onClick={handleExport} sx={{ textTransform: 'none', fontWeight: 700 }}>
              Export
            </Button>
            <Button
              data-delete-mode-toggle
              variant={deleteMode ? 'contained' : 'outlined'}
              color="error"
              onClick={() => {
                if (deleteMode) {
                  if (selectedUserEmails.size === 0) {
                    setDeleteMode(false)
                    return
                  }
                  setDeleteDialogOpen(true)
                  return
                }
                setDeleteMode(true)
              }}
              sx={{ minWidth: 0, px: 1.25 }}
            >
              <DeleteIcon />
            </Button>
            <Button variant="contained" color="secondary" disabled={deleteMode} onClick={() => navigate('/company_admin/create-user')} sx={{ minWidth: 0, px: 1.25 }}>
              <AddIcon />
            </Button>
          </Box>
        </Box>

        {usersError && <Alert severity="error" sx={{ borderRadius: 0, m: 0 }}>{usersError}</Alert>}

        <TableContainer component={Box} sx={{ border: `1px solid ${tableBorderColor}`, borderRadius: 1.5, overflow: 'hidden', backgroundColor: theme.palette.mode === 'dark' ? alpha(theme.palette.background.paper, 0.96) : alpha(theme.palette.background.paper, 0.92) }}>
          <Table size="medium" sx={{ minWidth: 950, borderCollapse: 'separate', borderSpacing: 0 }}>
            <TableHead>
              <TableRow>
                {deleteMode ? <TableCell sx={{ ...headCellSx, width: 54, px: 2 }} /> : null}
                <TableCell sx={headCellSx}>Name</TableCell>
                <TableCell sx={headCellSx}>Email ID</TableCell>
                <TableCell sx={headCellSx}>Role</TableCell>
                <TableCell sx={headCellSx}>Department</TableCell>
                <TableCell sx={headCellSx}>Designation</TableCell>
                <TableCell sx={headCellSx}>Mobile</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loadingUsers ? (
                <TableRow>
                  <TableCell colSpan={deleteMode ? 7 : 6} align="center" sx={{ py: 5, borderBottom: 0 }}>
                    <CircularProgress size={26} />
                  </TableCell>
                </TableRow>
              ) : filteredUsers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={deleteMode ? 7 : 6} align="center" sx={{ py: 5, borderBottom: 0 }}>
                    No users found for your company.
                  </TableCell>
                </TableRow>
              ) : (
                filteredUsers.map((user, index) => {
                  const isCurrentUser = String(user.email_id || '').trim().toLowerCase() === currentUserEmail
                  const rowTextSx = isCurrentUser ? { fontWeight: 700 } : undefined
                  return (
                  <TableRow key={`${user.email_id}-${index}`} sx={{ '&:hover': { backgroundColor: TABLE_ROW_HOVER_BG }, '&:last-of-type td': { borderBottom: 0 }, '& td': { borderBottom: index === filteredUsers.length - 1 ? 0 : `1px solid ${tableBorderColor}` } }}>
                    {deleteMode ? (
                      <TableCell sx={{ ...bodyCellSx, px: 2, width: 54 }}>
                        <Checkbox
                          checked={selectedUserEmails.has(user.email_id)}
                          disabled={user.role === 'company_admin'}
                          onChange={() => setSelectedUserEmails((prev) => {
                            const next = new Set(prev)
                            if (next.has(user.email_id)) next.delete(user.email_id)
                            else next.add(user.email_id)
                            return next
                          })}
                        />
                      </TableCell>
                    ) : null}
                    <TableCell sx={{ ...bodyCellSx, ...rowTextSx }}>{user.emp_name || '-'}</TableCell>
                    <TableCell sx={{ ...bodyCellSx, ...rowTextSx }}>{user.email_id || '-'}</TableCell>
                    <TableCell sx={{ ...bodyCellSx, ...rowTextSx }}>{formatRoleLabel(user.role)}</TableCell>
                    <TableCell sx={{ ...bodyCellSx, ...rowTextSx }}>{user.department || '-'}</TableCell>
                    <TableCell sx={{ ...bodyCellSx, ...rowTextSx }}>{user.designation || '-'}</TableCell>
                    <TableCell sx={{ ...bodyCellSx, ...rowTextSx }}>{user.mobile || '-'}</TableCell>
                  </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      <Dialog open={bulkDialog.open} onClose={() => !bulkDialog.submitting && closeBulkDialog()} fullWidth maxWidth="sm">
        <DialogTitle>Bulk User Upload</DialogTitle>
        <DialogContent dividers sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2.5 }}>
          <Alert severity="info">
            Bulk upload creates normal users only. Select unit carefully. Multiple units are allowed.
          </Alert>
          {unitOptions.length === 0 ? (
            <Alert severity="info">No units are configured for this company.</Alert>
          ) : (
            <FormControl fullWidth required disabled={bulkDialog.submitting}>
              <InputLabel id="company-admin-bulk-unit-label">{hasMultipleUnits ? 'Units' : 'Unit'}</InputLabel>
              <Select
                labelId="company-admin-bulk-unit-label"
                label={hasMultipleUnits ? 'Units' : 'Unit'}
                multiple={hasMultipleUnits}
                value={hasMultipleUnits ? bulkDialog.unitIds : (bulkDialog.unitIds[0] || '')}
                onChange={(event) => setBulkDialog((prev) => ({
                  ...prev,
                  unitIds: typeof event.target.value === 'string' ? event.target.value.split(',') : event.target.value,
                  error: '',
                }))}
                renderValue={
                  hasMultipleUnits
                    ? (selected) => getUnitNamesFromIds(Array.isArray(selected) ? selected : []).join(', ')
                    : undefined
                }
              >
                {unitOptions.map((unit) => (
                  <MenuItem key={unit.unit_id || unit.id} value={unit.unit_id}>
                    {hasMultipleUnits ? <Checkbox checked={bulkDialog.unitIds.includes(unit.unit_id)} size="small" /> : null}
                    <ListItemText primary={unit.unit_name || unit.unit_id} />
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}
          <Button variant="outlined" component="label" startIcon={<UploadFileRoundedIcon />}>
            Upload Excel
            <input ref={bulkFileInputRef} type="file" hidden accept=".xlsx,.xls" onChange={handleBulkFileChange} />
          </Button>
          <Button
            variant="outlined"
            startIcon={<DownloadRoundedIcon />}
            onClick={() => {
              const worksheet = XLSX.utils.aoa_to_sheet([bulkUploadRequiredHeaders])
              const workbook = XLSX.utils.book_new()
              XLSX.utils.book_append_sheet(workbook, worksheet, 'Bulk Users Template')
              XLSX.writeFile(workbook, 'company_admin_bulk_user_template.xlsx')
            }}
          >
            Download Template
          </Button>
          {bulkDialog.fileName && <Typography color="text.secondary">Selected file: {bulkDialog.fileName}</Typography>}
          {bulkDialog.rows.length > 0 && <Typography color="text.secondary">Parsed rows: {bulkDialog.rows.length}</Typography>}
          {bulkDialog.error && <Alert severity="error">{bulkDialog.error}</Alert>}
        </DialogContent>
        <DialogActions>
          <Button onClick={closeBulkDialog} disabled={bulkDialog.submitting}>Cancel</Button>
          <Button variant="contained" onClick={handleBulkUpload} disabled={bulkDialog.submitting || bulkDialog.rows.length === 0 || bulkDialog.unitIds.length === 0}>
            {bulkDialog.submitting ? 'Uploading...' : 'Upload'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={bulkWarningDialogOpen} onClose={() => !bulkDialog.submitting && setBulkWarningDialogOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Non-organization Email IDs</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {bulkDialog.nonOrgCount} non-organization email ids are found, if possible use company email for data security.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBulkWarningDialogOpen(false)} disabled={bulkDialog.submitting}>Cancel</Button>
          <Button
            variant="contained"
            onClick={async () => {
              setBulkWarningDialogOpen(false)
              setBulkDialog((prev) => ({ ...prev, confirmNonOrg: true }))
              await executeBulkUpload()
            }}
            disabled={bulkDialog.submitting}
          >
            Continue
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={deleteDialogOpen} onClose={() => !deletingUsers && setDeleteDialogOpen(false)}>
        <DialogTitle sx={{ px: 3, pt: 2.5, pb: 2, fontWeight: 600, fontSize: '1.25rem' }}>Confirm Delete</DialogTitle>
        <DialogContent sx={{ px: 3, pt: 2.25, pb: 2.25 }}>
          <DialogContentText sx={{ m: 0, mb: 1.5, lineHeight: 1.5 }}>
            Deleting selected users will remove them from the company. RACMs owned by deleted process owners will be set inactive.
          </DialogContentText>
          <Typography sx={{ mt: 1.5, fontWeight: 600 }}>
            Total selected users: {selectedUserEmails.size}
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2.25, gap: 1.25, borderTop: '1px solid', borderColor: 'divider' }}>
          <Button onClick={() => setDeleteDialogOpen(false)} disabled={deletingUsers}>Cancel</Button>
          <Button variant="contained" color="error" onClick={handleDeleteUsers} disabled={deletingUsers || selectedUserEmails.size === 0}>
            {deletingUsers ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

export default CompanyAdminUserManagement
