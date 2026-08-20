import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTheme } from '@mui/material/styles'
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import Tooltip from '@mui/material/Tooltip'
import FormControl from '@mui/material/FormControl'
import FormControlLabel from '@mui/material/FormControlLabel'
import InputLabel from '@mui/material/InputLabel'
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import Switch from '@mui/material/Switch'
import Alert from '@mui/material/Alert'
import Button from '@mui/material/Button'
import TextField from '@mui/material/TextField'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import { alpha } from '@mui/material/styles'
import {
  DASHBOARD_PAGE_OUTER_SX,
  DASHBOARD_PAPER_SX,
  FILTER_DROPDOWN_MIN_WIDTH_LG,
  PAGE_SUBHEADER_TEXT_SX,
  TABLE_HEADER_BG,
  TABLE_ROW_HOVER_BG,
  CONCLUSION_BADGE_TABLE_PILL_SX,
  CONCLUSION_TABLE_CELL_SX,
  getApprovalStatusBadgeSolidColors,
  getApprovalStatusBadgePillSx,
  getConclusionBadgeSolidColors,
  formatRacmApprovalStatusLabel,
  isMuiAlertCloseActionClick,
} from '../../uiConstants'
import { STORAGE_KEYS } from '../../storageKeys'
import { useSyncGlobalLoading } from '../../contexts/GlobalLoadingContext'
import { useAuth } from '../../contexts/AuthContext'
import { apiUrl } from '../../config/api'
import { useBusinessProcesses } from '../../hooks/useBusinessProcesses'
import { formatIndianDateTime as formatIndianDateTimeShared, parseDateValue } from '../../lib/dateTime'

function ApproverDashboard() {
  const theme = useTheme()
  const navigate = useNavigate()
  const { user, role, isAuthenticated, loading: authLoading } = useAuth()
  const [approver, setApprover] = useState(null)
  const [forms, setForms] = useState([])
  const [financialYearOptions, setFinancialYearOptions] = useState([])
  const [loading, setLoading] = useState(true)
  useSyncGlobalLoading(loading)
  const [filterStatus, setFilterStatus] = useState('sent for approval') // awaiting approver action
  const [filterBusinessProcess, setFilterBusinessProcess] = useState('all')
  const [filterFinancialYear, setFilterFinancialYear] = useState('all')
  const [filterUnit, setFilterUnit] = useState('all')
  const [filterConclusion, setFilterConclusion] = useState('all')
  const [conclusionOptions, setConclusionOptions] = useState([])
  const [mappedUnits, setMappedUnits] = useState([])
  const [cellWordWrap, setCellWordWrap] = useState(false)
  const [actionRequiredAlertDismissed, setActionRequiredAlertDismissed] = useState(false)
  const [actionRequiredDialogOpen, setActionRequiredDialogOpen] = useState(false)
  const [controlNumberInput, setControlNumberInput] = useState('')
  const [controlNumberFilter, setControlNumberFilter] = useState('')
  const showUnitContext = mappedUnits.length > 1
  const { businessProcessOptions } = useBusinessProcesses()

  const getDistinctFinancialYears = (rows) => {
    return [...new Set(
      (rows || [])
        .map((form) => (form.financial_year ?? '').toString().trim())
        .filter(Boolean)
    )].sort((a, b) => a.localeCompare(b))
  }

  const loadCachedFinancialYearOptions = () => {
    try {
      const cached = localStorage.getItem(STORAGE_KEYS.approverFinancialYears)
      if (!cached) return

      const parsed = JSON.parse(cached)
      if (Array.isArray(parsed)) {
        setFinancialYearOptions(parsed)
      }
    } catch (error) {
      console.error('Error reading approver financial year options from localStorage:', error)
    }
  }

  useEffect(() => {
    loadCachedFinancialYearOptions()
  }, [])

  useEffect(() => {
    if (authLoading) return

    if (!isAuthenticated || role !== 'approver' || !user) {
      localStorage.removeItem(STORAGE_KEYS.approverFinancialYears)
      navigate('/login')
      return
    }

    setApprover({
      id: user.id,
      email_id: user.email_id,
    })
  }, [authLoading, isAuthenticated, role, user, navigate])

  useEffect(() => {
    if (approver) {
      fetchMappedUnits()
    }
  }, [approver])

  useEffect(() => {
    if (approver) {
      bootstrapFilterOptions()
      fetchForms()
    }
  }, [approver, filterUnit])

  useEffect(() => {
    if (filterFinancialYear !== 'all' && !financialYearOptions.includes(filterFinancialYear)) {
      setFilterFinancialYear('all')
    }
  }, [financialYearOptions, filterFinancialYear])

  const bootstrapFilterOptions = async () => {
    try {
      const response = await fetch(getApproverControlFormsUrl(), {
        method: 'GET',
        credentials: 'include',
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        console.error('Error loading approver filter options:', data.message)
        return
      }

      const years = getDistinctFinancialYears(data.data)
      setFinancialYearOptions(years)
      localStorage.setItem(STORAGE_KEYS.approverFinancialYears, JSON.stringify(years))
    } catch (error) {
      console.error('Error loading approver filter options:', error)
    }
  }

  const fetchMappedUnits = async () => {
    try {
      const response = await fetch(apiUrl('/api/approver/home-stats'), {
        method: 'GET',
        credentials: 'include',
      })
      const data = await response.json()

      if (response.ok && data.success) {
        setMappedUnits(Array.isArray(data.data?.mapped_units) ? data.data.mapped_units : [])
      } else {
        setMappedUnits([])
      }
    } catch (error) {
      console.error('Error loading approver units:', error)
      setMappedUnits([])
    }
  }

  const getApproverControlFormsUrl = () => {
    const params = new URLSearchParams()
    if (filterUnit !== 'all') {
      params.set('unit_id', filterUnit)
    }
    const query = params.toString()
    return apiUrl(`/api/approver/control-forms${query ? `?${query}` : ''}`)
  }

  /** Display label for approver UI; keep Sent for Approval distinct from empty/Pending. */
  const formatStatus = (status) => formatRacmApprovalStatusLabel(status)

  const matchesApproverStatusFilter = (form, statusFilter) => {
    if (statusFilter === 'all') return true
    const raw = (form.status ?? '').toString().trim().toLowerCase()
    if (statusFilter === 'sent for approval' || statusFilter === 'pending') {
      return raw === 'sent for approval'
    }
    if (statusFilter === 'approved') {
      return raw === 'approved'
    }
    if (statusFilter === 'rejected') {
      return raw === 'rejected'
    }
    return true
  }

  const formatConclusion = (value) => {
    const normalized = String(value || '').trim()
    if (!normalized) return 'None'
    return normalized.charAt(0).toUpperCase() + normalized.slice(1)
  }

  const formatSentForApprovalDateTime = (value) => {
    return formatIndianDateTimeShared(value, 'N/A')
  }

  const fetchForms = async () => {
    setLoading(true)
    try {
      const url = getApproverControlFormsUrl()

      const response = await fetch(url, {
        method: 'GET',
        credentials: 'include',
      })

      const data = await response.json()

      if (response.ok && data.success) {
        const sortedForms = [...data.data].sort((a, b) => {
          const dateA = parseDateValue(a.sent_for_approval_timestamp)?.getTime() || 0
          const dateB = parseDateValue(b.sent_for_approval_timestamp)?.getTime() || 0
          return dateB - dateA // Descending order (newest first)
        })

        const latestFinancialYears = getDistinctFinancialYears(data.data)
        if (latestFinancialYears.length > 0) {
          setFinancialYearOptions((currentOptions) => {
            const mergedFinancialYears = [...new Set([...(currentOptions || []), ...latestFinancialYears])]
              .sort((a, b) => a.localeCompare(b))

            if (JSON.stringify(mergedFinancialYears) !== JSON.stringify(currentOptions)) {
              localStorage.setItem(STORAGE_KEYS.approverFinancialYears, JSON.stringify(mergedFinancialYears))
              return mergedFinancialYears
            }

            return currentOptions
          })
        }

        setConclusionOptions(
          [...new Set(
            (data.data || []).map((form) => formatConclusion(form.control_design_conclusion))
          )].sort((a, b) => {
            if (a === 'None') return 1
            if (b === 'None') return -1
            return a.localeCompare(b)
          })
        )

        setForms(sortedForms)
      } else {
        console.error('Error fetching forms:', data.message)
      }
    } catch (error) {
      console.error('Error fetching forms:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleFormClick = (formId) => {
    window.open(
      `/approver/form/${encodeURIComponent(formId)}`,
      '_blank',
      'noopener,noreferrer'
    )
  }

  const handleControlNumberSearchSubmit = (event) => {
    event.preventDefault()
    setControlNumberFilter(controlNumberInput.trim())
  }

  const handleControlNumberSearchClear = () => {
    setControlNumberInput('')
    setControlNumberFilter('')
  }

  const formsToDisplay = forms.filter((form) => {
    const normalizedBusinessProcess = (form.business_process ?? '').toString().trim()
    const normalizedFinancialYear = (form.financial_year ?? '').toString().trim()
    const isActive = form.active && form.active !== '' && form.active !== '0'

    if (filterBusinessProcess !== 'all' && normalizedBusinessProcess !== filterBusinessProcess) {
      return false
    }

    if (filterFinancialYear !== 'all' && normalizedFinancialYear !== filterFinancialYear) {
      return false
    }

    if (!matchesApproverStatusFilter(form, filterStatus)) {
      return false
    }

    if (filterConclusion !== 'all' && formatConclusion(form.control_design_conclusion) !== filterConclusion) {
      return false
    }

    if (controlNumberFilter) {
      const needle = controlNumberFilter.trim().toLowerCase()
      const controlNumber = String(form.control_number || form.form_id || '').trim().toLowerCase()
      if (controlNumber !== needle) {
        return false
      }
    }

    if (!isActive) {
      return false
    }

    return true
  })
  const approverActionRequiredForms = (forms || []).filter((form) =>
    String(form?.deficiency_response_status || '').trim().toLowerCase() === 'submitted_for_review'
  )
  const approverActionRequiredCount = approverActionRequiredForms.length

  useEffect(() => {
    if (approverActionRequiredCount > 0) {
      setActionRequiredAlertDismissed(false)
    }
  }, [approverActionRequiredCount])
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

  const mergeDataTdSx = (base) => ({
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

  const APPROVER_TABLE_COL_PX = {
    controlNumber: 110,
    businessProcess: 160,
    subProcess: 185,
    standardControl: 270,
    unit: 170,
    financialYear: 130,
    processOwner: 150,
    conclusion: 185,
    approval: 120,
    sentForApprovalAt: 200,
  }
  const approverTableColWidthsOrdered = [
    APPROVER_TABLE_COL_PX.controlNumber,
    APPROVER_TABLE_COL_PX.businessProcess,
    APPROVER_TABLE_COL_PX.subProcess,
    APPROVER_TABLE_COL_PX.standardControl,
    ...(showUnitContext ? [APPROVER_TABLE_COL_PX.unit] : []),
    APPROVER_TABLE_COL_PX.financialYear,
    APPROVER_TABLE_COL_PX.processOwner,
    APPROVER_TABLE_COL_PX.approval,
    APPROVER_TABLE_COL_PX.conclusion,
    APPROVER_TABLE_COL_PX.sentForApprovalAt,
  ]
  const approverTableTotalWidthPx = approverTableColWidthsOrdered.reduce((a, b) => a + b, 0)
  /** Percentage of table width — keeps columns stable when word wrap toggles while table is width:100%. */
  const pctColSx = (px) => {
    const pct = (100 * px) / approverTableTotalWidthPx
    const s = `${pct}%`
    return {
      width: s,
      minWidth: s,
      maxWidth: s,
      boxSizing: 'border-box',
    }
  }

  const tooltipSx = {
    bgcolor: theme.palette.mode === 'dark' ? 'grey.900' : 'grey.800',
    fontSize: '0.75rem',
    maxWidth: 420,
  }
  const filterControlSx = {
    minWidth: { xs: '100%', sm: FILTER_DROPDOWN_MIN_WIDTH_LG },
    '& .MuiOutlinedInput-root': {
      backgroundColor: 'transparent',
      '& fieldset': {
        borderColor: theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.23)' : '#d1d5db',
      },
      '&:hover fieldset': {
        borderColor: theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.3)' : '#9ca3af',
      },
      '&.Mui-focused fieldset': {
        borderColor: theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.3)' : '#9ca3af',
      },
    },
    '& .MuiInputLabel-root': {
      color: theme.palette.text.primary,
    },
    '& .MuiSelect-root': {
      color: theme.palette.text.primary,
    },
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
        {approverActionRequiredCount > 0 && !actionRequiredAlertDismissed ? (
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
              Action Required - {approverActionRequiredCount} RACMs are awaiting Mitigation/Compensatory Plans review
            </Typography>
            {/* <Typography variant="body2">
              Click to view control numbers.
            </Typography> */}
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
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, pr: { sm: 2, md: 3 }, mr: { sm: 1 } }}>
            <Typography
              variant="h5"
              component="h2"
              sx={{
                fontWeight: 700,
              }}
            >
              {filterStatus === 'sent for approval' || filterStatus === 'pending'
                ? 'Sent for Approval'
                : filterStatus === 'approved'
                ? 'Approved RACM'
                : filterStatus === 'rejected'
                ? 'Rejected RACM'
              : 'All RACMs'}
            </Typography>
          </Box>

          <Box
            sx={{
              display: 'flex',
              flexDirection: { xs: 'column', sm: 'row' },
              gap: 2,
              alignItems: { xs: 'stretch', sm: 'center' },
              width: { xs: '100%', sm: 'auto' },
              flexWrap: 'wrap',
            }}
          >
            {showUnitContext && (
              <FormControl variant="outlined" sx={filterControlSx}>
                <InputLabel id="approver-unit-filter-label">Unit</InputLabel>
                <Select
                  labelId="approver-unit-filter-label"
                  id="approver-unit-filter"
                  value={filterUnit}
                  label="Unit"
                  onChange={(e) => setFilterUnit(e.target.value)}
                >
                  <MenuItem value="all">All</MenuItem>
                  {mappedUnits.map((unit) => (
                    <MenuItem key={unit.unit_id || unit.id} value={unit.unit_id}>
                      {unit.unit_name || unit.unit_id}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}

            <FormControl variant="outlined" sx={filterControlSx}>
              <InputLabel id="approver-business-process-filter-label">Business Process</InputLabel>
              <Select
                labelId="approver-business-process-filter-label"
                id="approver-business-process-filter"
                value={filterBusinessProcess}
                label="Business Process"
                onChange={(e) => setFilterBusinessProcess(e.target.value)}
              >
                <MenuItem value="all">All</MenuItem>
                {businessProcessOptions.map((option) => (
                  <MenuItem key={option} value={option}>
                    {option}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl variant="outlined" sx={filterControlSx}>
              <InputLabel id="approver-financial-year-filter-label">Financial Year</InputLabel>
              <Select
                labelId="approver-financial-year-filter-label"
                id="approver-financial-year-filter"
                value={filterFinancialYear}
                label="Financial Year"
                onChange={(e) => setFilterFinancialYear(e.target.value)}
              >
                <MenuItem value="all">All</MenuItem>
                {financialYearOptions.map((year) => (
                  <MenuItem key={year} value={year}>
                    {year}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl variant="outlined" sx={filterControlSx}>
              <InputLabel id="approver-status-filter-label">Status</InputLabel>
              <Select
                labelId="approver-status-filter-label"
                id="approver-status-filter"
                value={filterStatus}
                label="Status"
                onChange={(e) => setFilterStatus(e.target.value)}
              >
                <MenuItem value="all">All</MenuItem>
                <MenuItem value="sent for approval">Sent for Approval</MenuItem>
                <MenuItem value="approved">Approved</MenuItem>
                <MenuItem value="rejected">Rejected</MenuItem>
              </Select>
            </FormControl>

            <FormControl variant="outlined" sx={filterControlSx}>
              <InputLabel id="approver-conclusion-filter-label">Conclusion</InputLabel>
              <Select
                labelId="approver-conclusion-filter-label"
                id="approver-conclusion-filter"
                value={filterConclusion}
                label="Conclusion"
                onChange={(e) => setFilterConclusion(e.target.value)}
              >
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

        {loading ? (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Typography color="text.secondary">Loading forms...</Typography>
          </Box>
        ) : (
          <Box>
            <Box sx={{ mb: 1.5 }}>
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
                <Typography sx={{ ...PAGE_SUBHEADER_TEXT_SX, flex: '1 1 240px', minWidth: 0, pr: { sm: 2 } }}>
                  Review active RACMs, and open a control to approve or reject.
                </Typography>
                <FormControlLabel
                  control={
                    <Switch
                      checked={cellWordWrap}
                      onChange={(e) => setCellWordWrap(e.target.checked)}
                      size="small"
                      color="primary"
                    />
                  }
                  label="Word wrap"
                  sx={{
                    mr: 0,
                    userSelect: 'none',
                    flex: '0 0 auto',
                    '& .MuiFormControlLabel-label': {
                      fontSize: '0.875rem',
                      color: 'text.secondary',
                    },
                  }}
                />
              </Box>
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
                {(controlNumberInput || controlNumberFilter) ? (
                  <Button
                    type="button"
                    variant="outlined"
                    onClick={handleControlNumberSearchClear}
                  >
                    Clear
                  </Button>
                ) : null}
              </Box>
            </Box>
            {formsToDisplay.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <Typography color="text.secondary">
                  {controlNumberFilter ? 'No forms match the control number search.' : 'No forms found.'}
                </Typography>
              </Box>
            ) : (
            <Box
              component="table"
              sx={{
                tableLayout: 'fixed',
                width: '100%',
                borderCollapse: 'collapse',
                borderSpacing: 0,
                '& th, & td': {
                  borderBottom: `1px solid ${theme.palette.divider}`,
                },
              }}
            >
              <Box component="colgroup">
                {approverTableColWidthsOrdered.map((w, i) => (
                  <Box key={i} component="col" sx={pctColSx(w)} />
                ))}
              </Box>
              <Box
                component="thead"
                sx={{
                  backgroundColor: TABLE_HEADER_BG,
                }}
              >
                <Box component="tr">
                  <Box
                    component="th"
                    sx={{
                      px: 2.5,
                      py: 1.5,
                      textAlign: 'left',
                      fontSize: '0.75rem',
                      fontWeight: 500,
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      color: theme.palette.text.secondary,
                      ...pctColSx(APPROVER_TABLE_COL_PX.controlNumber),
                    }}
                  >
                    Control Number
                  </Box>
                  <Box
                    component="th"
                    sx={{
                      px: 2.5,
                      py: 1.5,
                      textAlign: 'left',
                      fontSize: '0.75rem',
                      fontWeight: 500,
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      color: theme.palette.text.secondary,
                      ...pctColSx(APPROVER_TABLE_COL_PX.businessProcess),
                    }}
                  >
                    Business Process
                  </Box>
                  <Box
                    component="th"
                    sx={{
                      px: 2.5,
                      py: 1.5,
                      textAlign: 'left',
                      fontSize: '0.75rem',
                      fontWeight: 500,
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      color: theme.palette.text.secondary,
                      ...pctColSx(APPROVER_TABLE_COL_PX.subProcess),
                    }}
                  >
                    Sub Process
                  </Box>
                  <Box
                    component="th"
                    sx={{
                      px: 2.5,
                      py: 1.5,
                      textAlign: 'left',
                      fontSize: '0.75rem',
                      fontWeight: 500,
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      color: theme.palette.text.secondary,
                      ...pctColSx(APPROVER_TABLE_COL_PX.standardControl),
                    }}
                  >
                    Description
                  </Box>
                  {showUnitContext && (
                    <Box
                      component="th"
                      sx={{
                        px: 2.5,
                        py: 1.5,
                        textAlign: 'left',
                        fontSize: '0.75rem',
                        fontWeight: 500,
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        color: theme.palette.text.secondary,
                        ...pctColSx(APPROVER_TABLE_COL_PX.unit),
                      }}
                    >
                      Unit Name
                    </Box>
                  )}
                  <Box
                    component="th"
                    sx={{
                      px: 2.5,
                      py: 1.5,
                      textAlign: 'left',
                      fontSize: '0.75rem',
                      fontWeight: 500,
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      color: theme.palette.text.secondary,
                      ...pctColSx(APPROVER_TABLE_COL_PX.financialYear),
                    }}
                  >
                    Financial Year
                  </Box>
                  <Box
                    component="th"
                    sx={{
                      px: 2.5,
                      py: 1.5,
                      textAlign: 'left',
                      fontSize: '0.75rem',
                      fontWeight: 500,
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      color: theme.palette.text.secondary,
                      ...pctColSx(APPROVER_TABLE_COL_PX.processOwner),
                    }}
                  >
                    Process Owner
                  </Box>
                  <Box
                    component="th"
                    sx={{
                      px: 3,
                      py: 1.5,
                      textAlign: 'left',
                      fontSize: '0.75rem',
                      fontWeight: 500,
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      color: theme.palette.text.secondary,
                      ...pctColSx(APPROVER_TABLE_COL_PX.approval),
                    }}
                  >
                    Approval Status
                  </Box>
                  <Box
                    component="th"
                    sx={{
                      px: 2.5,
                      py: 1.5,
                      textAlign: 'left',
                      fontSize: '0.75rem',
                      fontWeight: 500,
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      color: theme.palette.text.secondary,
                      ...pctColSx(APPROVER_TABLE_COL_PX.conclusion),
                    }}
                  >
                    Conclusion
                  </Box>
                  <Box
                    component="th"
                    sx={{
                      px: 3,
                      py: 1.5,
                      textAlign: 'left',
                      fontSize: '0.75rem',
                      fontWeight: 500,
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      color: theme.palette.text.secondary,
                      ...pctColSx(APPROVER_TABLE_COL_PX.sentForApprovalAt),
                    }}
                  >
                    Sent for Approval on
                  </Box>
                </Box>
              </Box>
              <Box component="tbody">
                {formsToDisplay.map((form, index) => {
                  const status = formatStatus(form.status)
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
                      <Box
                        component="td"
                        sx={{
                          px: 2.5,
                          py: 2,
                          ...pctColSx(APPROVER_TABLE_COL_PX.controlNumber),
                          fontSize: '0.875rem',
                          fontWeight: 600,
                          color: theme.palette.text.primary,
                          ...(cellWordWrap ? { verticalAlign: 'top' } : {}),
                        }}
                      >
                        {form.control_number || form.form_id}
                      </Box>
                      <Box
                        component="td"
                        sx={mergeDataTdSx({
                          px: 2.5,
                          py: 2,
                          ...pctColSx(APPROVER_TABLE_COL_PX.businessProcess),
                          fontSize: '0.875rem',
                          color: theme.palette.text.primary,
                        })}
                      >
                        <Box component="span" sx={dataCellTextSx}>
                          {form.business_process || 'N/A'}
                        </Box>
                      </Box>
                      <Box
                        component="td"
                        sx={mergeDataTdSx({
                          px: 2.5,
                          py: 2,
                          ...pctColSx(APPROVER_TABLE_COL_PX.subProcess),
                          fontSize: '0.875rem',
                          color: theme.palette.text.primary,
                        })}
                      >
                        <Box component="span" sx={dataCellTextSx}>
                          {form.sub_process || 'N/A'}
                        </Box>
                      </Box>
                      <Box
                        component="td"
                        sx={mergeDataTdSx({
                          px: 2.5,
                          py: 2,
                          ...pctColSx(APPROVER_TABLE_COL_PX.standardControl),
                          fontSize: '0.875rem',
                          color: theme.palette.text.primary,
                        })}
                      >
                        {cellWordWrap ? (
                          <Box component="span" sx={dataCellTextSx}>
                            {form.standard_control_description || 'N/A'}
                          </Box>
                        ) : (
                          <Tooltip
                            title={form.standard_control_description || 'N/A'}
                            arrow
                            slotProps={{ tooltip: { sx: tooltipSx } }}
                          >
                            <Box component="span" sx={dataCellTextSx}>
                              {form.standard_control_description || 'N/A'}
                            </Box>
                          </Tooltip>
                        )}
                      </Box>
                      {showUnitContext && (
                        <Box
                          component="td"
                          sx={mergeDataTdSx({
                            px: 2.5,
                            py: 2,
                            ...pctColSx(APPROVER_TABLE_COL_PX.unit),
                            fontSize: '0.875rem',
                            color: theme.palette.text.primary,
                          })}
                        >
                          {cellWordWrap ? (
                            <Box component="span" sx={dataCellTextSx}>
                              {form.unit_name || form.unit_id || 'N/A'}
                            </Box>
                          ) : (
                            <Tooltip
                              title={form.unit_name || form.unit_id || 'N/A'}
                              arrow
                              slotProps={{ tooltip: { sx: tooltipSx } }}
                            >
                              <Box component="span" sx={dataCellTextSx}>
                                {form.unit_name || form.unit_id || 'N/A'}
                              </Box>
                            </Tooltip>
                          )}
                        </Box>
                      )}
                      <Box
                        component="td"
                        sx={mergeDataTdSx({
                          px: 2.5,
                          py: 2,
                          ...pctColSx(APPROVER_TABLE_COL_PX.financialYear),
                          fontSize: '0.875rem',
                          color: theme.palette.text.primary,
                        })}
                      >
                        <Box component="span" sx={dataCellTextSx}>
                          {form.financial_year || 'N/A'}
                        </Box>
                      </Box>
                      <Box
                        component="td"
                        sx={mergeDataTdSx({
                          px: 2.5,
                          py: 2,
                          ...pctColSx(APPROVER_TABLE_COL_PX.processOwner),
                          fontSize: '0.875rem',
                          color: theme.palette.text.primary,
                        })}
                      >
                        {cellWordWrap ? (
                          <Box component="span" sx={dataCellTextSx}>
                            {form.control_owner_name || form.control_owner || 'N/A'}
                          </Box>
                        ) : (
                          <Tooltip
                            title={form.control_owner_name || form.control_owner || 'N/A'}
                            arrow
                            slotProps={{ tooltip: { sx: tooltipSx } }}
                          >
                            <Box component="span" sx={dataCellTextSx}>
                              {form.control_owner_name || form.control_owner || 'N/A'}
                            </Box>
                          </Tooltip>
                        )}
                      </Box>
                      <Box
                        component="td"
                        sx={{
                          px: 3,
                          py: 2,
                          whiteSpace: 'nowrap',
                          ...pctColSx(APPROVER_TABLE_COL_PX.approval),
                          ...(cellWordWrap ? { verticalAlign: 'top' } : {}),
                        }}
                      >
                          <Box
                            component="span"
                            sx={{
                              ...getApprovalStatusBadgePillSx(status),
                              ...getApprovalStatusBadgeSolidColors(status),
                            }}
                          >
                          {status}
                        </Box>
                      </Box>
                      <Box
                        component="td"
                        sx={mergeDataTdSx({
                          px: 2.5,
                          py: 2,
                          ...pctColSx(APPROVER_TABLE_COL_PX.conclusion),
                          ...CONCLUSION_TABLE_CELL_SX,
                          fontSize: '0.875rem',
                          color: theme.palette.text.primary,
                        })}
                      >
                        <Tooltip title={conclusionLabel} arrow slotProps={{ tooltip: { sx: tooltipSx } }}>
                          <Box
                            component="span"
                            sx={{
                              ...CONCLUSION_BADGE_TABLE_PILL_SX,
                              ...getConclusionBadgeSolidColors(form.control_design_conclusion),
                            }}
                          >
                            {conclusionLabel}
                          </Box>
                        </Tooltip>
                      </Box>
                      <Box
                        component="td"
                        sx={mergeDataTdSx({
                          px: 3,
                          py: 2,
                          ...pctColSx(APPROVER_TABLE_COL_PX.sentForApprovalAt),
                          fontSize: '0.875rem',
                          color: theme.palette.text.primary,
                        })}
                      >
                        <Box component="span" sx={dataCellTextSx}>
                          {formatSentForApprovalDateTime(form.sent_for_approval_timestamp)}
                        </Box>
                      </Box>
                    </Box>
                  )
                })}
              </Box>
            </Box>
            )}
          </Box>
        )}

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
            Mitigation/Compensatory Plans Review Required
          </DialogTitle>
          <DialogContent dividers sx={{ px: 3, pt: 2.5, pb: 3 }}>
            <Typography variant="body2" sx={{ color: theme.palette.text.secondary, mb: 2 }}>
              Click any control below to open its details in a new page.
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
              {approverActionRequiredForms.map((form) => (
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
              sx={{ textTransform: 'none', px: 3, py: 1, minWidth: '100px' }}
            >
              Close
            </Button>
          </DialogActions>
        </Dialog>
      </Paper>
    </Box>
  )
}

export default ApproverDashboard
