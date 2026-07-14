import React, { useEffect, useState } from 'react'
import { alpha, useTheme } from '@mui/material/styles'
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import Tooltip from '@mui/material/Tooltip'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import FormControl from '@mui/material/FormControl'
import FormControlLabel from '@mui/material/FormControlLabel'
import Alert from '@mui/material/Alert'
import TextField from '@mui/material/TextField'
import InputLabel from '@mui/material/InputLabel'
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import Switch from '@mui/material/Switch'
import {
  DASHBOARD_PAGE_OUTER_SX,
  DASHBOARD_PAPER_SX,
  FILTER_BOX_MIN_WIDTH,
  PAGE_SUBHEADER_TEXT_SX,
  CONCLUSION_BADGE_TABLE_PILL_SX,
  CONCLUSION_TABLE_CELL_SX,
  TABLE_HEADER_BG,
  TABLE_ROW_HOVER_BG,
  getConclusionBadgeSolidColors,
  getStatusBadgeSolidColors,
  formatRacmApprovalStatusLabel,
  isMuiAlertCloseActionClick,
} from '../../uiConstants'
import { useSyncGlobalLoading } from '../../contexts/GlobalLoadingContext'
import { apiUrl, API_BASE_URL } from '../../config/api'
import { useBusinessProcesses } from '../../hooks/useBusinessProcesses'

function User_dashboard() {
  const theme = useTheme()
  const [userEmail, setUserEmail] = useState(null)
  const [forms, setForms] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [filterBusinessProcess, setFilterBusinessProcess] = useState('all')
  const [filterFinancialYear, setFilterFinancialYear] = useState('all')
  const [filterUnit, setFilterUnit] = useState('all')
  const [filterConclusion, setFilterConclusion] = useState('all')
  const [controlNumberInput, setControlNumberInput] = useState('')
  const [controlNumberFilter, setControlNumberFilter] = useState('')
  const [conclusionOptions, setConclusionOptions] = useState([])
  const [financialYearOptions, setFinancialYearOptions] = useState([])
  const [unitOptions, setUnitOptions] = useState([])
  const [cellWordWrap, setCellWordWrap] = useState(false)
  const [actionRequiredAlertDismissed, setActionRequiredAlertDismissed] = useState(false)
  const [actionRequiredDialogOpen, setActionRequiredDialogOpen] = useState(false)
  const { businessProcessOptions } = useBusinessProcesses()

  useSyncGlobalLoading(loading)

  const extractUniqueFinancialYears = (rows) => {
    return [...new Set(
      (rows || [])
        .map((form) => form.financial_year?.toString().trim())
        .filter((year) => year && year !== '')
    )]
  }

  const formatStatus = (status) => formatRacmApprovalStatusLabel(status)

  const formatDate = (date) => {
    if (!date) return 'N/A'
    const parsedDate = new Date(date)
    if (Number.isNaN(parsedDate.getTime())) return 'N/A'
    return parsedDate.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
  }

  const formatConclusion = (value) => {
    const normalized = String(value || '').trim()
    if (!normalized) return 'None'
    return normalized.charAt(0).toUpperCase() + normalized.slice(1)
  }

  useEffect(() => {
    const fetchUserInfo = async () => {
      try {
        const response = await fetch(apiUrl('/api/auth/verify'), {
          method: 'GET',
          credentials: 'include',
        })
        const data = await response.json()
        if (response.ok && data.success) {
          setUserEmail(data.user.email_id)
        }
      } catch (error) {
        console.error('Error fetching user info:', error)
      }
    }

    fetchUserInfo()
  }, [])

  useEffect(() => {
    if (userEmail) {
      fetchForms()
    }
  }, [userEmail, filter, filterBusinessProcess, filterFinancialYear, filterUnit, controlNumberFilter])

  const fetchForms = async () => {
    if (!userEmail) return

    setLoading(true)
    try {
      let url = `${API_BASE_URL}/api/control-forms?control_owner=${encodeURIComponent(userEmail)}&active=true`
      if (filter !== 'all') url += `&status=${encodeURIComponent(filter)}`
      if (filterBusinessProcess !== 'all') url += `&business_process=${encodeURIComponent(filterBusinessProcess)}`
      if (filterFinancialYear !== 'all') url += `&financial_year=${encodeURIComponent(filterFinancialYear)}`
      if (filterUnit !== 'all') url += `&unit_id=${encodeURIComponent(filterUnit)}`
      if (controlNumberFilter) url += `&control_number=${encodeURIComponent(controlNumberFilter)}`

      const response = await fetch(url, {
        method: 'GET',
        credentials: 'include',
      })
      const data = await response.json()

      if (response.ok && data.success) {
        const nextForms = Array.isArray(data.data) ? data.data : []
        const sortedForms = [...nextForms].sort((a, b) => {
          const dateA = a.created_at ? new Date(a.created_at).getTime() : 0
          const dateB = b.created_at ? new Date(b.created_at).getTime() : 0
          return dateB - dateA
        })

        setForms(sortedForms)
        setConclusionOptions(
          [...new Set(nextForms.map((form) => formatConclusion(form.control_design_conclusion)))].sort((a, b) => {
            if (a === 'None') return 1
            if (b === 'None') return -1
            return a.localeCompare(b)
          })
        )

        const latestYears = extractUniqueFinancialYears(nextForms)
        setFinancialYearOptions(latestYears)
        setUnitOptions(
          [...new Map(
            nextForms
              .map((form) => {
                const unitId = String(form.unit_id || '').trim()
                if (!unitId) return null
                return [unitId, { unitId, unitName: String(form.unit_name || form.unit_id || '').trim() || unitId }]
              })
              .filter(Boolean)
          ).values()].sort((a, b) => a.unitName.localeCompare(b.unitName))
        )
      } else {
        console.error('Error fetching forms:', data.message)
        setForms([])
        setConclusionOptions([])
        setFinancialYearOptions([])
        setUnitOptions([])
      }
    } catch (error) {
      console.error('Error fetching forms:', error)
      setForms([])
      setConclusionOptions([])
      setFinancialYearOptions([])
      setUnitOptions([])
    } finally {
      setLoading(false)
    }
  }

  const handleFormClick = (formId) => {
    window.open(`/user/form/${encodeURIComponent(formId)}`, '_blank', 'noopener,noreferrer')
  }

  const handleControlNumberSearchSubmit = (event) => {
    event.preventDefault()
    setControlNumberFilter(controlNumberInput.trim())
  }

  const handleControlNumberSearchClear = () => {
    setControlNumberInput('')
    setControlNumberFilter('')
  }

  const displayedForms = forms.filter((form) => {
    if (filterConclusion === 'all') return true
    return formatConclusion(form.control_design_conclusion) === filterConclusion
  })

  const actionRequiredCount = (forms || []).filter((form) => Boolean(form?.deficiency_action_status)).length
  const actionRequiredForms = (forms || []).filter((form) => Boolean(form?.deficiency_action_status))

  useEffect(() => {
    if (actionRequiredCount > 0) {
      setActionRequiredAlertDismissed(false)
    }
  }, [actionRequiredCount])

  const truncatedTextSx = {
    display: 'inline-block',
    maxWidth: '100%',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  }
  const wrappedTextSx = {
    display: 'block',
    maxWidth: '100%',
    whiteSpace: 'normal',
    wordBreak: 'break-word',
    overflow: 'visible',
  }
  const dataCellTextSx = cellWordWrap ? wrappedTextSx : truncatedTextSx
  const tooltipSx = {
    bgcolor: theme.palette.mode === 'dark' ? 'rgba(17, 24, 39, 0.96)' : 'rgba(17, 24, 39, 0.92)',
    color: '#ffffff',
    fontSize: '0.75rem',
    lineHeight: 1.4,
    borderRadius: '8px',
    px: 1.25,
    py: 0.75,
    maxWidth: 420,
    boxShadow: '0 8px 20px rgba(15, 23, 42, 0.25)',
  }
  const dataCellSx = (base) => ({
    ...base,
    ...(cellWordWrap
      ? {
          whiteSpace: 'normal',
          wordBreak: 'break-word',
          overflow: 'visible',
          verticalAlign: 'top',
        }
      : {
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }),
  })

  const USER_TABLE_COL_PX = {
    controlNumber: 100,
    businessProcess: 125,
    subProcess: 135,
    standardControl: 175,
    financialYear: 95,
    unit: 105,
    status: 105,
    conclusion: 170,
    dueDate: 95,
  }
  const userTableColWidthsOrdered = [
    USER_TABLE_COL_PX.controlNumber,
    USER_TABLE_COL_PX.businessProcess,
    USER_TABLE_COL_PX.subProcess,
    USER_TABLE_COL_PX.standardControl,
    USER_TABLE_COL_PX.financialYear,
    USER_TABLE_COL_PX.unit,
    USER_TABLE_COL_PX.status,
    USER_TABLE_COL_PX.conclusion,
    USER_TABLE_COL_PX.dueDate,
  ]
  const userTableTotalWidthPx = userTableColWidthsOrdered.reduce((a, b) => a + b, 0)
  const pctColSx = (px) => {
    const pct = (100 * px) / userTableTotalWidthPx
    const s = `${pct}%`
    return {
      width: s,
      minWidth: s,
      maxWidth: s,
      boxSizing: 'border-box',
    }
  }

  return (
    <Box sx={DASHBOARD_PAGE_OUTER_SX}>
      <Paper
        elevation={3}
        sx={{
          ...DASHBOARD_PAPER_SX,
          p: 3,
          backgroundColor: theme.palette.background.paper,
          borderRadius: 2,
        }}
      >
        {!loading && actionRequiredCount > 0 && !actionRequiredAlertDismissed ? (
          <Alert
            severity="warning"
            onClose={(event) => {
              event?.stopPropagation?.()
              setActionRequiredAlertDismissed(true)
            }}
            onClick={(event) => {
              if (isMuiAlertCloseActionClick(event)) return
              setActionRequiredDialogOpen(true)
            }}
            sx={{
              mb: 3,
              alignItems: 'center',
              cursor: 'pointer',
              '& .MuiAlert-message': {
                width: '100%',
              },
            }}
          >
            <Typography sx={{ fontWeight: 700 }}>
              Action Required - {actionRequiredCount} RACMs are found ineffective
            </Typography>
          </Alert>
        ) : null}

        <Box
          sx={{
            display: 'flex',
            flexDirection: { xs: 'column', sm: 'row' },
            justifyContent: 'space-between',
            alignItems: { xs: 'flex-start', sm: 'center' },
            mb: 3,
            gap: 2,
          }}
        >
          <Box>
            <Typography variant="h5" component="h2" sx={{ fontWeight: 700, color: theme.palette.text.primary }}>
              Assigned RACMs
            </Typography>
            <Typography variant="body2" sx={PAGE_SUBHEADER_TEXT_SX}>
              Track your assigned RACMs, filter by status, and open any item to review details.
            </Typography>
          </Box>

          <Box
            sx={{
              display: 'flex',
              flexDirection: { xs: 'column', sm: 'row' },
              gap: 2,
              alignItems: { xs: 'stretch', sm: 'center' },
              width: { xs: '100%', sm: 'auto' },
            }}
          >
            <Box sx={{ minWidth: FILTER_BOX_MIN_WIDTH }}>
              <FormControl variant="outlined" fullWidth size="small">
                <InputLabel id="status-filter-label">Status</InputLabel>
                <Select labelId="status-filter-label" id="status-filter" value={filter} label="Status" onChange={(e) => setFilter(e.target.value)}>
                  <MenuItem value="all">All</MenuItem>
                  <MenuItem value="pending">Pending</MenuItem>
                  <MenuItem value="sent for approval">Sent for Approval</MenuItem>
                  <MenuItem value="approved">Approved</MenuItem>
                  <MenuItem value="rejected">Rejected</MenuItem>
                </Select>
              </FormControl>
            </Box>

            <Box sx={{ minWidth: FILTER_BOX_MIN_WIDTH }}>
              <FormControl variant="outlined" fullWidth size="small">
                <InputLabel id="business-process-filter-label">Business Process</InputLabel>
                <Select labelId="business-process-filter-label" id="business-process-filter" value={filterBusinessProcess} label="Business Process" onChange={(e) => setFilterBusinessProcess(e.target.value)}>
                  <MenuItem value="all">All</MenuItem>
                  {businessProcessOptions.map((option) => (
                    <MenuItem key={option} value={option}>
                      {option}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>

            <Box sx={{ minWidth: FILTER_BOX_MIN_WIDTH }}>
              <FormControl variant="outlined" fullWidth size="small">
                <InputLabel id="financial-year-filter-label">Financial Year</InputLabel>
                <Select labelId="financial-year-filter-label" id="financial-year-filter" value={filterFinancialYear} label="Financial Year" onChange={(e) => setFilterFinancialYear(e.target.value)}>
                  <MenuItem value="all">All</MenuItem>
                  {financialYearOptions.map((option) => (
                    <MenuItem key={option} value={option}>
                      {option}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>

            <Box sx={{ minWidth: FILTER_BOX_MIN_WIDTH }}>
              <FormControl variant="outlined" fullWidth size="small">
                <InputLabel id="unit-filter-label">Unit</InputLabel>
                <Select labelId="unit-filter-label" id="unit-filter" value={filterUnit} label="Unit" onChange={(e) => setFilterUnit(e.target.value)}>
                  <MenuItem value="all">All</MenuItem>
                  {unitOptions.map((option) => (
                    <MenuItem key={option.unitId} value={option.unitId}>
                      {option.unitName}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>

            <Box sx={{ minWidth: FILTER_BOX_MIN_WIDTH }}>
              <FormControl variant="outlined" fullWidth size="small">
                <InputLabel id="conclusion-filter-label">Conclusion</InputLabel>
                <Select labelId="conclusion-filter-label" id="conclusion-filter" value={filterConclusion} label="Conclusion" onChange={(e) => setFilterConclusion(e.target.value)}>
                  <MenuItem value="all">All</MenuItem>
                  {conclusionOptions.map((option) => (
                    <MenuItem key={option} value={option}>
                      {option}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>
          </Box>
        </Box>

        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            mb: 1.5,
            flexWrap: 'wrap',
            gap: 1,
          }}
        >
          <Box
            component="form"
            onSubmit={handleControlNumberSearchSubmit}
            sx={{
              display: 'flex',
              flexDirection: { xs: 'column', sm: 'row' },
              gap: 1,
              alignItems: { xs: 'stretch', sm: 'center' },
            }}
          >
            <TextField
              label="Control Number"
              value={controlNumberInput}
              onChange={(e) => setControlNumberInput(e.target.value)}
              size="small"
              sx={{
                minWidth: { xs: '100%', sm: 260 },
                '& .MuiOutlinedInput-root': {
                  backgroundColor: 'transparent',
                },
              }}
            />
            <Button type="submit" variant="contained">
              Search
            </Button>
            <Button type="button" variant="outlined" onClick={handleControlNumberSearchClear} disabled={!controlNumberInput && !controlNumberFilter}>
              Clear
            </Button>
          </Box>

          <FormControlLabel
            control={<Switch checked={cellWordWrap} onChange={(e) => setCellWordWrap(e.target.checked)} size="small" color="primary" />}
            label="Word wrap"
            sx={{
              mr: 0,
              userSelect: 'none',
              '& .MuiFormControlLabel-label': {
                fontSize: '0.8125rem',
                color: theme.palette.text.secondary,
              },
            }}
          />
        </Box>

        {loading ? (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Typography color="text.secondary">Loading forms...</Typography>
          </Box>
        ) : displayedForms.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Typography color="text.secondary">
              {controlNumberFilter
                ? 'No forms match the control number search.'
                : filter === 'all'
                  ? 'No active forms assigned to you.'
                  : filter === 'pending'
                    ? 'No pending forms.'
                    : filter === 'sent for approval'
                      ? 'No forms sent for approval.'
                      : filter === 'approved'
                        ? 'No approved forms.'
                        : 'No rejected forms.'}
            </Typography>
          </Box>
        ) : (
          <Box>
            <Box
              component="table"
              sx={{
                tableLayout: 'fixed',
                width: '100%',
                borderCollapse: 'collapse',
                '& th, & td': {
                  borderBottom: `1px solid ${theme.palette.divider}`,
                },
              }}
            >
              <Box component="colgroup">
                {userTableColWidthsOrdered.map((w, i) => (
                  <Box key={i} component="col" sx={pctColSx(w)} />
                ))}
              </Box>
              <Box component="thead" sx={{ backgroundColor: TABLE_HEADER_BG }}>
                <Box component="tr">
                  <Box component="th" sx={{ px: 2, py: 1.5, textAlign: 'left', fontSize: '0.75rem', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em', color: theme.palette.text.secondary, ...pctColSx(USER_TABLE_COL_PX.controlNumber) }}>
                    Control Number
                  </Box>
                  <Box component="th" sx={{ px: 2, py: 1.5, textAlign: 'left', fontSize: '0.75rem', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em', color: theme.palette.text.secondary, ...pctColSx(USER_TABLE_COL_PX.businessProcess) }}>
                    Business Process
                  </Box>
                  <Box component="th" sx={{ px: 2, py: 1.5, textAlign: 'left', fontSize: '0.75rem', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em', color: theme.palette.text.secondary, ...pctColSx(USER_TABLE_COL_PX.subProcess) }}>
                    Sub Process
                  </Box>
                  <Box component="th" sx={{ px: 2, py: 1.5, textAlign: 'left', fontSize: '0.75rem', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em', color: theme.palette.text.secondary, ...pctColSx(USER_TABLE_COL_PX.standardControl) }}>
                    Description
                  </Box>
                  <Box component="th" sx={{ px: 2, py: 1.5, textAlign: 'left', fontSize: '0.75rem', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em', color: theme.palette.text.secondary, ...pctColSx(USER_TABLE_COL_PX.financialYear) }}>
                    Financial Year
                  </Box>
                  <Box component="th" sx={{ px: 2, py: 1.5, textAlign: 'left', fontSize: '0.75rem', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em', color: theme.palette.text.secondary, ...pctColSx(USER_TABLE_COL_PX.unit) }}>
                    Unit
                  </Box>
                  <Box component="th" sx={{ px: 2, py: 1.5, textAlign: 'left', fontSize: '0.75rem', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em', color: theme.palette.text.secondary, ...pctColSx(USER_TABLE_COL_PX.status) }}>
                    Status
                  </Box>
                  <Box component="th" sx={{ px: 2, py: 1.5, textAlign: 'left', fontSize: '0.75rem', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em', color: theme.palette.text.secondary, ...pctColSx(USER_TABLE_COL_PX.conclusion) }}>
                    Conclusion
                  </Box>
                  <Box component="th" sx={{ px: 2, py: 1.5, textAlign: 'left', fontSize: '0.75rem', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em', color: theme.palette.text.secondary, ...pctColSx(USER_TABLE_COL_PX.dueDate) }}>
                    Due Date
                  </Box>
                </Box>
              </Box>
              <Box component="tbody">
                {displayedForms.map((form, index) => {
                  const conclusionLabel = formatConclusion(form.control_design_conclusion)
                  return (
                  <Box
                    component="tr"
                    key={form.id}
                    onClick={() => handleFormClick(form.form_id)}
                    sx={{
                      cursor: 'pointer',
                      transition: 'background-color 0.2s',
                      '&:hover': {
                        backgroundColor: TABLE_ROW_HOVER_BG,
                      },
                    }}
                  >
                    <Box component="td" sx={{ px: 2, py: 2, whiteSpace: 'nowrap', fontSize: '0.875rem', fontWeight: 600, color: theme.palette.text.primary, ...pctColSx(USER_TABLE_COL_PX.controlNumber), ...(cellWordWrap ? { verticalAlign: 'top' } : {}) }}>
                      {form.control_number || form.form_id}
                    </Box>
                    <Box component="td" sx={dataCellSx({ px: 2, py: 2, fontSize: '0.875rem', color: theme.palette.text.primary, ...pctColSx(USER_TABLE_COL_PX.businessProcess) })}>
                      <Tooltip title={form.business_process || 'N/A'} arrow slotProps={{ tooltip: { sx: tooltipSx } }}>
                        <Box component="span" sx={dataCellTextSx}>
                          {form.business_process || 'N/A'}
                        </Box>
                      </Tooltip>
                    </Box>
                    <Box component="td" sx={dataCellSx({ px: 2, py: 2, fontSize: '0.875rem', color: theme.palette.text.primary, ...pctColSx(USER_TABLE_COL_PX.subProcess) })}>
                      <Tooltip title={form.sub_process || 'N/A'} arrow slotProps={{ tooltip: { sx: tooltipSx } }}>
                        <Box component="span" sx={dataCellTextSx}>
                          {form.sub_process || 'N/A'}
                        </Box>
                      </Tooltip>
                    </Box>
                    <Box component="td" sx={dataCellSx({ px: 2, py: 2, fontSize: '0.875rem', color: theme.palette.text.primary, ...pctColSx(USER_TABLE_COL_PX.standardControl) })}>
                      <Tooltip title={form.standard_control_description || 'N/A'} arrow slotProps={{ tooltip: { sx: tooltipSx } }}>
                        <Box component="span" sx={dataCellTextSx}>
                          {form.standard_control_description || 'N/A'}
                        </Box>
                      </Tooltip>
                    </Box>
                    <Box component="td" sx={dataCellSx({ px: 2, py: 2, fontSize: '0.875rem', color: theme.palette.text.primary, ...pctColSx(USER_TABLE_COL_PX.financialYear) })}>
                      <Box component="span" sx={dataCellTextSx}>
                        {form.financial_year || 'N/A'}
                      </Box>
                    </Box>
                    <Box component="td" sx={dataCellSx({ px: 2, py: 2, fontSize: '0.875rem', color: theme.palette.text.primary, ...pctColSx(USER_TABLE_COL_PX.unit) })}>
                      <Tooltip title={form.unit_name || form.unit_id || 'N/A'} arrow slotProps={{ tooltip: { sx: tooltipSx } }}>
                        <Box component="span" sx={dataCellTextSx}>
                          {form.unit_name || form.unit_id || 'N/A'}
                        </Box>
                      </Tooltip>
                    </Box>
                    <Box component="td" sx={{ px: 2, py: 2, whiteSpace: 'nowrap', ...pctColSx(USER_TABLE_COL_PX.status), ...(cellWordWrap ? { verticalAlign: 'top' } : {}) }}>
                      <Chip
                        label={formatStatus(form.status)}
                        size="small"
                        sx={{
                          height: 'auto',
                          py: 0.5,
                          borderRadius: '9999px',
                          backgroundColor: getStatusBadgeSolidColors(form.status).backgroundColor,
                          color: getStatusBadgeSolidColors(form.status).color,
                          fontWeight: 600,
                          maxWidth: '100%',
                          '& .MuiChip-label': {
                            px: 1,
                            whiteSpace: 'normal',
                            wordBreak: 'break-word',
                            overflowWrap: 'break-word',
                            lineHeight: 1.35,
                          },
                        }}
                      />
                    </Box>
                    <Box component="td" sx={{ px: 2, py: 2, fontSize: '0.875rem', color: theme.palette.text.primary, ...pctColSx(USER_TABLE_COL_PX.conclusion), ...CONCLUSION_TABLE_CELL_SX }}>
                      <Tooltip title={conclusionLabel} arrow slotProps={{ tooltip: { sx: tooltipSx } }}>
                        <Box component="span" sx={{ ...CONCLUSION_BADGE_TABLE_PILL_SX, ...getConclusionBadgeSolidColors(form.control_design_conclusion) }}>
                          {conclusionLabel}
                        </Box>
                      </Tooltip>
                    </Box>
                    <Box component="td" sx={dataCellSx({ px: 2, py: 2, fontSize: '0.875rem', color: theme.palette.text.primary, ...pctColSx(USER_TABLE_COL_PX.dueDate) })}>
                      <Box component="span" sx={dataCellTextSx}>
                        {formatDate(form.due_date)}
                      </Box>
                    </Box>
                  </Box>
                  )
                })}
              </Box>
            </Box>
          </Box>
        )}
      </Paper>

      <Dialog
        open={actionRequiredDialogOpen}
        onClose={() => setActionRequiredDialogOpen(false)}
        fullWidth
        maxWidth="md"
        PaperProps={{
          sx: {
            borderRadius: 2,
            minWidth: { xs: '90%', sm: '560px' },
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
          Ineffective RACMs
        </DialogTitle>
        <DialogContent dividers sx={{ px: 3, pt: 2.5, pb: 3 }}>
          <Typography variant="body2" sx={{ color: theme.palette.text.secondary, mb: 2 }}>
            Click any RACM below to open its details in a new page.
          </Typography>
          {actionRequiredForms.length === 0 ? (
            <Typography color="text.secondary">No ineffective RACMs found.</Typography>
          ) : null}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
            {actionRequiredForms.map((form) => (
              <Box
                key={`action-required-dialog-${form.form_id}`}
                role="button"
                tabIndex={0}
                onClick={() => handleFormClick(form.form_id)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    handleFormClick(form.form_id)
                  }
                }}
                sx={{
                  p: 1.75,
                  borderRadius: 1.5,
                  border: `1px solid ${theme.palette.divider}`,
                  backgroundColor: theme.palette.background.paper,
                  cursor: 'pointer',
                  transition: 'background-color 0.2s, border-color 0.2s',
                  '&:hover, &:focus-visible': {
                    backgroundColor: TABLE_ROW_HOVER_BG,
                    borderColor: alpha(theme.palette.warning.main, 0.45),
                    outline: 'none',
                  },
                }}
              >
                <Typography sx={{ fontWeight: 700, color: theme.palette.text.primary }}>
                  {form.control_number || form.form_id}
                </Typography>
                <Typography variant="body2" sx={{ color: theme.palette.text.secondary, mt: 0.25 }}>
                  {[form.business_process, form.sub_process, form.financial_year].filter(Boolean).join(' | ') || form.form_id}
                </Typography>
              </Box>
            ))}
          </Box>
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
            onClick={() => setActionRequiredDialogOpen(false)}
            variant="outlined"
            sx={{
              textTransform: 'none',
              px: 3,
              py: 1,
              minWidth: '100px',
              borderColor: theme.palette.mode === 'dark'
                ? 'rgba(255, 255, 255, 0.23)'
                : 'rgba(0, 0, 0, 0.23)',
            }}
          >
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

export default User_dashboard
