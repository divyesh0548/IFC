import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useTheme } from '@mui/material/styles'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import CircularProgress from '@mui/material/CircularProgress'
import FormControl from '@mui/material/FormControl'
import InputAdornment from '@mui/material/InputAdornment'
import InputLabel from '@mui/material/InputLabel'
import MenuItem from '@mui/material/MenuItem'
import Paper from '@mui/material/Paper'
import Select from '@mui/material/Select'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import SearchRoundedIcon from '@mui/icons-material/SearchRounded'
import LightbulbOutlinedIcon from '@mui/icons-material/LightbulbOutlined'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import { toast } from 'react-hot-toast'
import { useSearchParams } from 'react-router-dom'
import { apiUrl } from '../../config/api'
import { useSyncGlobalLoading } from '../../contexts/GlobalLoadingContext'
import { TABLE_ROW_HOVER_BG } from '../../uiConstants'
import AppDialog, { APP_DIALOG_PRIMARY_BUTTON_SX, getAppDialogCancelButtonSx } from '../../components/AppDialog'
import ApproverAssignmentHelpDialog from '../../components/approver/ApproverAssignmentHelpDialog'
import ApproverAssignmentsPanel from '../../components/approver/ApproverAssignmentsPanel'
import {
  buildConflictingApproverAssignmentWarning,
  buildDuplicateApproverAssignmentBlockMessage,
  findConflictingApproverScopeAssignment,
  findDuplicateApproverScopeAssignment,
} from '../../utils/approverAssignmentDisplay'

const emptyData = {
  approvers: [],
  approverAssignments: [],
  units: [],
  businessProcesses: [],
}

const createAssignmentDialogState = () => ({
  open: false,
  approver: null,
  scopeType: 'UNIT',
  unitId: '',
  businessProcess: '',
  submitting: false,
  error: '',
})

function CompanyAdminApproverManagement() {
  const theme = useTheme()
  const [searchParams] = useSearchParams()
  const presetUnitId = String(searchParams.get('unit_id') || '').trim()
  const [data, setData] = useState(emptyData)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [assignmentFilter, setAssignmentFilter] = useState('all')
  const [unitFilter, setUnitFilter] = useState(presetUnitId || 'all')
  const [assignmentDialog, setAssignmentDialog] = useState(createAssignmentDialogState)
  const [assignmentHelpOpen, setAssignmentHelpOpen] = useState(false)

  useSyncGlobalLoading(loading)
  useSyncGlobalLoading(assignmentDialog.submitting)

  const fetchApproverManagement = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [unitResponse, filtersResponse] = await Promise.all([
        fetch(apiUrl('/api/company-admin/unit-management'), { credentials: 'include' }),
        fetch(apiUrl('/api/company-admin/racm-dashboard/filters'), { credentials: 'include' }),
      ])

      const [unitResult, filtersResult] = await Promise.all([unitResponse.json(), filtersResponse.json()])

      if (!unitResponse.ok || !unitResult?.success) {
        throw new Error(unitResult?.message || 'Failed to fetch approver management data')
      }
      if (!filtersResponse.ok || !filtersResult?.success) {
        throw new Error(filtersResult?.message || 'Failed to fetch business process list')
      }

      setData({
        approvers: Array.isArray(unitResult.data?.approvers) ? unitResult.data.approvers : [],
        approverAssignments: Array.isArray(unitResult.data?.approverAssignments) ? unitResult.data.approverAssignments : [],
        units: Array.isArray(unitResult.data?.units) ? unitResult.data.units : [],
        businessProcesses: Array.isArray(filtersResult.data?.businessProcesses) ? filtersResult.data.businessProcesses : [],
      })
    } catch (fetchError) {
      console.error('Company admin approver management fetch error:', fetchError)
      setData(emptyData)
      setError(fetchError.message || 'Network error while fetching approver management data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchApproverManagement()
  }, [fetchApproverManagement])

  const approverRows = useMemo(() => {
    const normalizedSearch = String(searchTerm || '').trim().toLowerCase()

    return data.approvers
      .map((approver) => {
        const approverEmail = String(approver.email_id || '').trim().toLowerCase()
        const assignments = data.approverAssignments.filter((item) => {
          const sameApprover = String(item.approver_email_id || '').trim().toLowerCase() === approverEmail
          const sameUnit = unitFilter === 'all' || String(item.unit_id || '').trim() === unitFilter
          return sameApprover && sameUnit
        })
        return {
          ...approver,
          assignments,
          assigned: assignments.length > 0,
        }
      })
      .filter((approver) => {
        if (assignmentFilter === 'assigned' && !approver.assigned) return false
        if (assignmentFilter === 'unassigned' && approver.assigned) return false

        if (!normalizedSearch) return true
        const displayName = String(approver.display_name || '').trim().toLowerCase()
        const emailId = String(approver.email_id || '').trim().toLowerCase()
        return displayName.includes(normalizedSearch) || emailId.includes(normalizedSearch)
      })
      .sort((left, right) => String(left.display_name || left.email_id || '').localeCompare(String(right.display_name || right.email_id || '')))
  }, [assignmentFilter, data.approverAssignments, data.approvers, searchTerm, unitFilter])

  const currentAssignments = useMemo(() => {
    if (!assignmentDialog.approver?.email_id) return []
    const approverEmail = String(assignmentDialog.approver.email_id || '').trim().toLowerCase()
    return data.approverAssignments.filter((item) => String(item.approver_email_id || '').trim().toLowerCase() === approverEmail)
  }, [assignmentDialog.approver, data.approverAssignments])

  const conflictingAssignmentWarning = useMemo(() => {
    if (!assignmentDialog.open || !assignmentDialog.approver?.email_id || !assignmentDialog.unitId) {
      return ''
    }

    const conflictingAssignment = findConflictingApproverScopeAssignment(data.approverAssignments, {
      approverEmail: assignmentDialog.approver.email_id,
      assignmentScope: assignmentDialog.scopeType,
      unitId: assignmentDialog.unitId,
      businessProcess: assignmentDialog.businessProcess,
    })

    return buildConflictingApproverAssignmentWarning(conflictingAssignment)
  }, [
    assignmentDialog.approver,
    assignmentDialog.businessProcess,
    assignmentDialog.open,
    assignmentDialog.scopeType,
    assignmentDialog.unitId,
    data.approverAssignments,
  ])

  const duplicateAssignmentBlockMessage = useMemo(() => {
    if (!assignmentDialog.open || !assignmentDialog.approver?.email_id || !assignmentDialog.unitId) {
      return ''
    }
    if (assignmentDialog.scopeType === 'BUSINESS_PROCESS' && !assignmentDialog.businessProcess) {
      return ''
    }

    const duplicateAssignment = findDuplicateApproverScopeAssignment(data.approverAssignments, {
      approverEmail: assignmentDialog.approver.email_id,
      assignmentScope: assignmentDialog.scopeType,
      unitId: assignmentDialog.unitId,
      businessProcess: assignmentDialog.businessProcess,
    })

    if (!duplicateAssignment) return ''

    const selectedUnit = data.units.find((unit) => unit.unit_id === assignmentDialog.unitId)

    return buildDuplicateApproverAssignmentBlockMessage(assignmentDialog.scopeType, {
      unitName: selectedUnit?.unit_name || duplicateAssignment.unit_name || assignmentDialog.unitId,
      businessProcess: assignmentDialog.businessProcess || duplicateAssignment.business_process,
    })
  }, [
    assignmentDialog.approver,
    assignmentDialog.businessProcess,
    assignmentDialog.open,
    assignmentDialog.scopeType,
    assignmentDialog.unitId,
    data.approverAssignments,
    data.units,
  ])

  const isAssignmentSaveBlocked = Boolean(duplicateAssignmentBlockMessage)

  const handleOpenAssignmentDialog = (approver) => {
    setAssignmentDialog({
      ...createAssignmentDialogState(),
      open: true,
      approver,
    })
  }

  const handleSaveAssignment = async () => {
    if (!assignmentDialog.approver?.email_id) {
      setAssignmentDialog((prev) => ({ ...prev, error: 'Approver is required' }))
      return
    }
    if (!assignmentDialog.unitId) {
      setAssignmentDialog((prev) => ({ ...prev, error: 'Unit is required' }))
      return
    }
    if (assignmentDialog.scopeType === 'BUSINESS_PROCESS' && !assignmentDialog.businessProcess) {
      setAssignmentDialog((prev) => ({ ...prev, error: 'Business process is required' }))
      return
    }
    if (isAssignmentSaveBlocked) {
      setAssignmentDialog((prev) => ({ ...prev, error: duplicateAssignmentBlockMessage }))
      return
    }

    setAssignmentDialog((prev) => ({ ...prev, submitting: true, error: '' }))
    try {
      const response = await fetch(apiUrl('/api/company-admin/unit-management/approver-assignments'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          approver_email_id: assignmentDialog.approver.email_id,
          assignment_scope: assignmentDialog.scopeType,
          unit_id: assignmentDialog.unitId,
          business_process: assignmentDialog.scopeType === 'BUSINESS_PROCESS' ? assignmentDialog.businessProcess : null,
        }),
      })

      const result = await response.json()
      if (!response.ok || !result?.success) {
        throw new Error(result?.message || 'Failed to save approver assignment')
      }

      toast.success(result.message || 'Approver assignment saved successfully')
      setAssignmentDialog(createAssignmentDialogState())
      await fetchApproverManagement()
    } catch (saveError) {
      const message = saveError.message || 'Failed to save approver assignment'
      toast.error(message)
      setAssignmentDialog((prev) => ({ ...prev, submitting: false, error: message }))
    }
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, py: 2 }}>
      <Box sx={{ pb: 2, borderBottom: '1px solid', borderColor: 'divider', display: 'flex', justifyContent: 'space-between', gap: 1.5, flexWrap: 'wrap' }}>
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
            <Typography component="h1" sx={{ fontSize: { xs: '1.45rem', sm: '1.7rem' }, fontWeight: 850, lineHeight: 1.15 }}>
              Approver Management
            </Typography>
            <Tooltip title="How approver assignment works">
              <IconButton
                size="small"
                onClick={() => setAssignmentHelpOpen(true)}
                aria-label="How approver assignment works"
                sx={{ color: 'warning.main' }}
              >
                <LightbulbOutlinedIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
          <Typography sx={{ mt: 0.6, color: 'text.secondary', fontSize: '0.94rem', lineHeight: 1.6 }}>
            Search approvers, filter by assignment status, and assign unit or process scope.
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1.2, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <TextField
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Search by email or name"
            size="small"
            sx={{ minWidth: { xs: '100%', sm: 280 } }}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchRoundedIcon sx={{ color: 'text.secondary', fontSize: 20 }} />
                  </InputAdornment>
                ),
              },
            }}
          />
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel id="company-admin-approver-filter-label">Assignment</InputLabel>
            <Select
              labelId="company-admin-approver-filter-label"
              label="Assignment"
              value={assignmentFilter}
              onChange={(event) => setAssignmentFilter(event.target.value)}
            >
              <MenuItem value="all">All</MenuItem>
              <MenuItem value="assigned">Assigned</MenuItem>
              <MenuItem value="unassigned">Unassigned</MenuItem>
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 180 }}>
            <InputLabel id="company-admin-approver-unit-filter-label">Unit</InputLabel>
            <Select
              labelId="company-admin-approver-unit-filter-label"
              label="Unit"
              value={unitFilter}
              onChange={(event) => setUnitFilter(event.target.value)}
            >
              <MenuItem value="all">All</MenuItem>
              {data.units.map((unit) => (
                <MenuItem key={unit.unit_id} value={unit.unit_id}>
                  {unit.unit_name || unit.unit_id}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>
      </Box>

      {error && <Alert severity="error">{error}</Alert>}

      {loading ? (
        <Paper elevation={0} sx={{ p: 4, borderRadius: 2, border: '1px solid', borderColor: 'divider', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1.25 }}>
          <CircularProgress size={22} />
          <Typography color="text.secondary">Loading approver management data...</Typography>
        </Paper>
      ) : approverRows.length === 0 ? (
        <Typography sx={{ py: 4, color: 'text.secondary' }}>
          No approvers found for the selected filter.
        </Typography>
      ) : (
        <Box sx={{ width: '100%' }}>
          {approverRows.map((row, index) => {
            const displayName = String(row.display_name || '').trim()
            const emailId = String(row.email_id || '').trim()
            const showName = displayName && displayName.toLowerCase() !== emailId.toLowerCase()

            return (
              <Box
                key={row.email_id}
                onClick={() => handleOpenAssignmentDialog(row)}
                sx={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 1.5,
                  px: 0.25,
                  py: 1.5,
                  cursor: 'pointer',
                  textAlign: 'left',
                  borderBottom: '1px solid',
                  borderColor: 'divider',
                  '&:hover': { backgroundColor: TABLE_ROW_HOVER_BG },
                }}
              >
                <Typography sx={{ fontWeight: 700, color: 'text.secondary', minWidth: 28, pt: 0.1 }}>
                  {index + 1}.
                </Typography>
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Typography sx={{ fontWeight: 700, color: 'text.primary', lineHeight: 1.35 }}>
                    {emailId || '-'}
                  </Typography>
                  {showName ? (
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
                      {displayName}
                    </Typography>
                  ) : null}
                  <Typography sx={{ mt: 0.35, color: 'text.secondary', fontSize: '0.8rem' }}>
                    click to view details
                  </Typography>
                </Box>
              </Box>
            )
          })}
        </Box>
      )}

      <AppDialog
        open={assignmentDialog.open}
        onClose={() => !assignmentDialog.submitting && setAssignmentDialog(createAssignmentDialogState())}
        title={assignmentDialog.approver ? (
          <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1.1, flexWrap: 'wrap' }}>
            <Typography component="span" sx={{ fontSize: '1.1rem', fontWeight: 700, lineHeight: 1.25, mb:1 }}>
              Assign Approver
            </Typography>
            <Typography component="span" sx={{ color: 'text.secondary', fontSize: '0.92rem', fontWeight: 400, lineHeight: 1.25 }}>
              ({assignmentDialog.approver.email_id})
            </Typography>
          </Box>
        ) : 'Assign Approver'}
        titleId="company-admin-approver-assignment-dialog-title"
        fullWidth
        maxWidth="md"
        showTitleDivider
        titleSx={{ pb: 1.15 }}
        contentSx={{ pt: 2.2 }}
        actions={(
          <>
            <Button onClick={() => setAssignmentDialog(createAssignmentDialogState())} disabled={assignmentDialog.submitting} variant="outlined" sx={getAppDialogCancelButtonSx(theme)}>
              Cancel
            </Button>
            <Button
              variant="contained"
              onClick={handleSaveAssignment}
              disabled={
                assignmentDialog.submitting
                || !assignmentDialog.unitId
                || (assignmentDialog.scopeType === 'BUSINESS_PROCESS' && !assignmentDialog.businessProcess)
                || isAssignmentSaveBlocked
              }
              sx={APP_DIALOG_PRIMARY_BUTTON_SX}
            >
              {assignmentDialog.submitting ? 'Saving...' : 'Save Assignment'}
            </Button>
          </>
        )}
      >
        <Typography sx={{ fontWeight: 700, mt: 1 }}>Current Assignments</Typography>
        <ApproverAssignmentsPanel
          key={assignmentDialog.approver?.email_id || 'none'}
          assignments={currentAssignments}
          scopeLabelStyle="company_admin"
        />

        <Typography sx={{ fontWeight: 700, mt: 0.5 }}>New Assignment</Typography>
        <FormControl fullWidth required>
          <InputLabel id="company-admin-approver-scope-label">Assignment Type</InputLabel>
          <Select
            labelId="company-admin-approver-scope-label"
            label="Assignment Type"
            value={assignmentDialog.scopeType}
            onChange={(event) => setAssignmentDialog((prev) => ({ ...prev, scopeType: event.target.value, error: '' }))}
          >
            <MenuItem value="UNIT">Unit</MenuItem>
            <MenuItem value="BUSINESS_PROCESS">Unit + Business Process</MenuItem>
          </Select>
        </FormControl>
        <FormControl fullWidth required>
          <InputLabel id="company-admin-approver-unit-label" shrink>
            Unit
          </InputLabel>
          <Select
            labelId="company-admin-approver-unit-label"
            label="Unit"
            value={assignmentDialog.unitId}
            onChange={(event) => setAssignmentDialog((prev) => ({ ...prev, unitId: event.target.value, error: '' }))}
            displayEmpty
            renderValue={(selected) => {
              if (!selected) {
                return (
                  <Typography component="span" sx={{ color: 'text.secondary' }}>
                    Select unit
                  </Typography>
                )
              }
              const unit = data.units.find((item) => item.unit_id === selected)
              return unit?.unit_name || selected
            }}
          >
            {data.units.map((unit) => (
              <MenuItem key={unit.unit_id} value={unit.unit_id}>
                {unit.unit_name || unit.unit_id}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        {assignmentDialog.scopeType === 'BUSINESS_PROCESS' ? (
          <FormControl fullWidth required>
            <InputLabel id="company-admin-approver-process-label" shrink>
              Business Process
            </InputLabel>
            <Select
              labelId="company-admin-approver-process-label"
              label="Business Process"
              value={assignmentDialog.businessProcess}
              onChange={(event) => setAssignmentDialog((prev) => ({ ...prev, businessProcess: event.target.value, error: '' }))}
              displayEmpty
              renderValue={(selected) => {
                if (!selected) {
                  return (
                    <Typography component="span" sx={{ color: 'text.secondary' }}>
                      Select business process
                    </Typography>
                  )
                }
                return selected
              }}
            >
              {data.businessProcesses.map((processName) => (
                <MenuItem key={processName} value={processName}>
                  {processName}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        ) : null}
        {duplicateAssignmentBlockMessage ? (
          <Alert severity="error" sx={{ mt: 0.5 }}>
            {duplicateAssignmentBlockMessage}
          </Alert>
        ) : conflictingAssignmentWarning ? (
          <Alert severity="warning" sx={{ mt: 0.5 }}>
            {conflictingAssignmentWarning}
          </Alert>
        ) : null}
        {assignmentDialog.error && <Alert severity="error">{assignmentDialog.error}</Alert>}
      </AppDialog>

      <ApproverAssignmentHelpDialog
        open={assignmentHelpOpen}
        onClose={() => setAssignmentHelpOpen(false)}
        variant="company_admin"
      />
    </Box>
  )
}

export default CompanyAdminApproverManagement
