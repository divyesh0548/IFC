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
import {
  FILTER_DROPDOWN_MIN_WIDTH_LG,
  PAGE_SUBHEADER_TEXT_SX,
  TABLE_HEADER_BG,
  TABLE_ROW_HOVER_BG,
  STATUS_BADGE_PILL_SX,
  getApprovalStatusBadgeSolidColors,
} from '../../uiConstants'
import { STORAGE_KEYS } from '../../storageKeys'
import { useSyncGlobalLoading } from '../../contexts/GlobalLoadingContext'
import { apiUrl } from '../../config/api'
import { useBusinessProcesses } from '../../hooks/useBusinessProcesses'

function ApproverDashboard() {
  const theme = useTheme()
  const navigate = useNavigate()
  const [approver, setApprover] = useState(null)
  const [forms, setForms] = useState([])
  const [financialYearOptions, setFinancialYearOptions] = useState([])
  const [loading, setLoading] = useState(true)
  useSyncGlobalLoading(loading)
  const [filterStatus, setFilterStatus] = useState('pending') // 'pending', 'all', 'approved', 'rejected'
  const [filterBusinessProcess, setFilterBusinessProcess] = useState('all')
  const [filterFinancialYear, setFilterFinancialYear] = useState('all')
  const [filterUnit, setFilterUnit] = useState('all')
  const [filterConclusion, setFilterConclusion] = useState('all')
  const [mappedUnits, setMappedUnits] = useState([])
  const [cellWordWrap, setCellWordWrap] = useState(false)
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
    // Fetch user info on component mount
    const fetchUserInfo = async () => {
      try {
        const response = await fetch(apiUrl('/api/auth/verify'), {
          method: 'GET',
          credentials: 'include',
        })

        const data = await response.json()

        if (response.ok && data.success) {
          if (data.user.role !== 'approver') {
            localStorage.removeItem(STORAGE_KEYS.approverFinancialYears)
            navigate('/login')
            return
          }

          // Store user info as approver for compatibility
          setApprover({
            id: data.user.id,
            email_id: data.user.email_id
          })
        } else {
          localStorage.removeItem(STORAGE_KEYS.approverFinancialYears)
          navigate('/login')
        }
      } catch (error) {
        console.error('Error fetching user info:', error)
        localStorage.removeItem(STORAGE_KEYS.approverFinancialYears)
        navigate('/login')
      }
    }

    loadCachedFinancialYearOptions()
    fetchUserInfo()
  }, [navigate])

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

  /** Display label for approver UI; keep actual statuses and only use "—" for empty values. */
  const formatStatus = (status) => {
    if (status === null || status === undefined) {
      return '—'
    }
    const s = String(status).trim()
    if (s === '') {
      return '—'
    }
    return s.charAt(0).toUpperCase() + s.slice(1)
  }

  const matchesApproverStatusFilter = (form, statusFilter) => {
    if (statusFilter === 'all') return true
    const raw = (form.status ?? '').toString().trim()
    if (statusFilter === 'pending') {
      return raw === 'sent for approval'
    }
    if (statusFilter === 'approved') {
      return raw.toLowerCase() === 'approved'
    }
    if (statusFilter === 'rejected') {
      return raw.toLowerCase() === 'rejected'
    }
    return true
  }

  const formatConclusion = (value) => {
    const normalized = String(value || '').trim()
    if (!normalized) return 'None'
    return normalized.charAt(0).toUpperCase() + normalized.slice(1)
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
          const dateA = a.sent_for_approval_timestamp ? new Date(a.sent_for_approval_timestamp).getTime() : 0
          const dateB = b.sent_for_approval_timestamp ? new Date(b.sent_for_approval_timestamp).getTime() : 0
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
    navigate(`/approver/form/${formId}`)
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

    if (!isActive) {
      return false
    }

    return true
  })
  const conclusionOptions = [...new Set(
    (forms || []).map((form) => formatConclusion(form.control_design_conclusion))
  )].sort((a, b) => {
    if (a === 'None') return 1
    if (b === 'None') return -1
    return a.localeCompare(b)
  })
  const approverActionRequiredCount = (forms || []).filter((form) =>
    String(form?.deficiency_response_status || '').trim().toLowerCase() === 'submitted_for_review'
  ).length
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
    idx: 72,
    businessProcess: 200,
    subProcess: 200,
    standardControl: 280,
    unit: 180,
    financialYear: 140,
    processOwner: 220,
    conclusion: 160,
    approval: 120,
    sentForApprovalAt: 180,
  }
  const approverTableColWidthsOrdered = [
    APPROVER_TABLE_COL_PX.idx,
    APPROVER_TABLE_COL_PX.businessProcess,
    APPROVER_TABLE_COL_PX.subProcess,
    APPROVER_TABLE_COL_PX.standardControl,
    ...(showUnitContext ? [APPROVER_TABLE_COL_PX.unit] : []),
    APPROVER_TABLE_COL_PX.financialYear,
    APPROVER_TABLE_COL_PX.processOwner,
    APPROVER_TABLE_COL_PX.conclusion,
    APPROVER_TABLE_COL_PX.approval,
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
    <Box
      sx={{
        maxWidth: '100%',
        mx: 'auto',
        px: 0,
        pt: 0.5,
        pb: 4,
      }}
    >
      {approverActionRequiredCount > 0 ? (
        <Box
          sx={{
            mb: 2,
            px: 2,
            py: 1.25,
            borderRadius: 2,
            backgroundColor: '#fef3c7',
            border: '1px solid #f59e0b',
          }}
        >
          <Typography
            variant="body2"
            sx={{
              color: '#92400e',
              fontWeight: 700,
            }}
          >
            Action Required - {approverActionRequiredCount} RACMs are awaiting deficiency response review
          </Typography>
        </Box>
      ) : null}
      <Paper
        elevation={3}
        sx={{
          p: 3,
          backgroundColor: theme.palette.background.paper,
          borderRadius: 2,
        }}
      >
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
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <Typography
              variant="h5"
              component="h2"
              sx={{
                fontWeight: 700,
              }}
            >
              {filterStatus === 'pending'
                ? 'Pending Approvals'
                : filterStatus === 'approved'
                ? 'Approved RACM'
                : filterStatus === 'rejected'
                ? 'Rejected RACM'
              : 'All RACMs'}
            </Typography>
            <Typography sx={PAGE_SUBHEADER_TEXT_SX}>
              Review active RACMs, and open a control to approve or reject.
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
                <MenuItem value="pending">Pending</MenuItem>
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
        ) : formsToDisplay.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Typography color="text.secondary">No forms found.</Typography>
          </Box>
        ) : (
          <Box>
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'flex-end',
                alignItems: 'center',
                mb: 1.5,
                flexWrap: 'wrap',
                gap: 1,
              }}
            >
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
                  '& .MuiFormControlLabel-label': {
                    fontSize: '0.875rem',
                    color: 'text.secondary',
                  },
                }}
              />
            </Box>
            <Box
              sx={{
                overflowX: 'auto',
                scrollbarGutter: 'stable',
              }}
            >
            <Box
              component="table"
              sx={{
                tableLayout: 'fixed',
                width: '100%',
                minWidth: approverTableTotalWidthPx,
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
                      ...pctColSx(APPROVER_TABLE_COL_PX.idx),
                    }}
                  >
                    #
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
                      ...pctColSx(APPROVER_TABLE_COL_PX.approval),
                    }}
                  >
                    Approval Status
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
                          ...pctColSx(APPROVER_TABLE_COL_PX.idx),
                          fontSize: '0.875rem',
                          color: theme.palette.text.primary,
                          ...(cellWordWrap ? { verticalAlign: 'top' } : {}),
                        }}
                      >
                        {index + 1}
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
                        sx={mergeDataTdSx({
                          px: 2.5,
                          py: 2,
                          ...pctColSx(APPROVER_TABLE_COL_PX.conclusion),
                          fontSize: '0.875rem',
                          color: theme.palette.text.primary,
                        })}
                      >
                        <Box component="span" sx={dataCellTextSx}>
                          {formatConclusion(form.control_design_conclusion)}
                        </Box>
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
                            ...STATUS_BADGE_PILL_SX,
                            ...getApprovalStatusBadgeSolidColors(status),
                          }}
                        >
                          {status}
                        </Box>
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
                          {form.sent_for_approval_timestamp
                            ? new Date(form.sent_for_approval_timestamp).toLocaleDateString('en-IN', {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })
                            : 'N/A'}
                        </Box>
                      </Box>
                    </Box>
                  )
                })}
              </Box>
            </Box>
          </Box>
          </Box>
        )}
      </Paper>
    </Box>
  )
}

export default ApproverDashboard
