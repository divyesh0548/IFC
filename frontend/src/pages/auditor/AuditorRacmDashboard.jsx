import React, { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useTheme } from '@mui/material/styles'
import Box from '@mui/material/Box'
import FormControl from '@mui/material/FormControl'
import FormControlLabel from '@mui/material/FormControlLabel'
import InputLabel from '@mui/material/InputLabel'
import MenuItem from '@mui/material/MenuItem'
import Paper from '@mui/material/Paper'
import Select from '@mui/material/Select'
import Switch from '@mui/material/Switch'
import Typography from '@mui/material/Typography'
import Alert from '@mui/material/Alert'
import {
  DASHBOARD_PAGE_OUTER_SX,
  DASHBOARD_PAPER_SX,
  DASHBOARD_TABLE_WRAP_SX,
  FILTER_BOX_MIN_WIDTH,
  FILTER_DROPDOWN_MIN_WIDTH_LG,
  PAGE_SUBHEADER_TEXT_SX,
  TABLE_HEADER_BG,
  TABLE_ROW_HOVER_BG,
  getApprovalStatusBadgeSolidColors,
  getApprovalStatusBadgePillSx,
  formatRacmApprovalStatusLabel,
} from '../../uiConstants'
import { apiUrl } from '../../config/api'
import { useSyncGlobalLoading } from '../../contexts/GlobalLoadingContext'
import { useBusinessProcesses } from '../../hooks/useBusinessProcesses'

function getIsActive(value) {
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value !== 0

  const normalizedValue = String(value ?? '').trim().toLowerCase()
  if (!normalizedValue || normalizedValue === '0' || normalizedValue === 'false' || normalizedValue === 'null') {
    return false
  }

  return true
}

function normalizeBusinessProcess(value) {
  return String(value || '').trim()
}

function formatApprovalStatus(status) {
  return formatRacmApprovalStatusLabel(status)
}

function formatDate(date) {
  if (!date) return 'N/A'
  const parsedDate = new Date(date)
  if (Number.isNaN(parsedDate.getTime())) return 'N/A'

  return parsedDate.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function AuditorRacmDashboard() {
  const theme = useTheme()
  const navigate = useNavigate()
  const location = useLocation()
  const [forms, setForms] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filterActive, setFilterActive] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterBusinessProcess, setFilterBusinessProcess] = useState('all')
  const [filterFinancialYear, setFilterFinancialYear] = useState('all')
  const [filterCompany, setFilterCompany] = useState('all')
  const [filterUnit, setFilterUnit] = useState('all')
  const [cellWordWrap, setCellWordWrap] = useState(false)
  const { businessProcessOptions } = useBusinessProcesses()
  const isCompanyAdminView = location.pathname.startsWith('/company_admin')
  const racmEndpoint = isCompanyAdminView ? '/api/company-admin/racm-dashboard/racms' : '/api/auditor/racms'
  const detailPathPrefix = isCompanyAdminView ? '/company_admin/form/' : '/auditor/form/'

  useSyncGlobalLoading(loading)

  useEffect(() => {
    let cancelled = false

    const fetchForms = async () => {
      setLoading(true)
      setError('')

      try {
        const response = await fetch(apiUrl(racmEndpoint), {
          method: 'GET',
          credentials: 'include',
        })
        const data = await response.json()

        if (cancelled) return

        if (response.ok && data.success) {
          const nextForms = Array.isArray(data.data) ? data.data : []
          const sortedForms = [...nextForms].sort((a, b) => {
            const dateA = a.created_at ? new Date(a.created_at).getTime() : 0
            const dateB = b.created_at ? new Date(b.created_at).getTime() : 0
            return dateB - dateA
          })
          setForms(sortedForms)
        } else {
          setError(data.message || 'Failed to fetch RACMs')
          setForms([])
        }
      } catch (fetchError) {
        console.error('Auditor RACM dashboard error:', fetchError)
        if (!cancelled) {
          setError('Error fetching RACMs')
          setForms([])
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    fetchForms()

    return () => {
      cancelled = true
    }
  }, [racmEndpoint])

  const companyOptions = [...new Map(
    forms
      .filter((form) => String(form.company_identifier || '').trim() !== '')
      .map((form) => [
        form.company_identifier,
        {
          value: form.company_identifier,
          label: form.company_name || form.company_identifier,
        },
      ]),
  ).values()]

  const financialYearOptions = [...new Set(
    forms
      .map((form) => String(form.financial_year || '').trim())
      .filter(Boolean),
  )]
  const businessProcessFilterOptions = [...new Set([
    ...businessProcessOptions.map(normalizeBusinessProcess),
    ...forms.map((form) => normalizeBusinessProcess(form.business_process)),
  ].filter(Boolean))].sort((a, b) => a.localeCompare(b))

  const isUnitFilterEnabled = isCompanyAdminView || filterCompany !== 'all'

  const scopedFormsForUnits = isUnitFilterEnabled
    ? (isCompanyAdminView
      ? forms
      : forms.filter((form) => String(form.company_identifier || '') === filterCompany))
    : []

  const unitOptions = [...new Map(
    scopedFormsForUnits
      .filter((form) => String(form.unit_id || '').trim() !== '')
      .map((form) => {
        const unitKey = `${form.company_identifier || ''}::${form.unit_id || ''}`
        return [
          unitKey,
          {
            value: unitKey,
            label: form.unit_name || 'Unit',
          },
        ]
      }),
  ).values()]

  useEffect(() => {
    if (filterCompany === 'all') return

    const companyStillExists = companyOptions.some((option) => option.value === filterCompany)
    if (!companyStillExists) {
      setFilterCompany('all')
    }
  }, [companyOptions, filterCompany])

  useEffect(() => {
    if (filterUnit === 'all') return

    const unitStillExists = unitOptions.some((option) => option.value === filterUnit)
    if (!unitStillExists) {
      setFilterUnit('all')
    }
  }, [filterUnit, unitOptions])

  const filteredForms = forms.filter((form) => {
    if (filterActive !== 'all') {
      const isActive = getIsActive(form.active)
      if (filterActive === 'active' && !isActive) return false
      if (filterActive === 'inactive' && isActive) return false
    }

    if (filterStatus !== 'all') {
      const statusLabel = formatApprovalStatus(form.status)
      if (statusLabel !== filterStatus) return false
    }

    if (filterBusinessProcess !== 'all' && normalizeBusinessProcess(form.business_process) !== filterBusinessProcess) {
      return false
    }

    if (filterFinancialYear !== 'all' && String(form.financial_year || '') !== filterFinancialYear) {
      return false
    }

    if (!isCompanyAdminView && filterCompany !== 'all' && String(form.company_identifier || '') !== filterCompany) {
      return false
    }

    if (filterUnit !== 'all') {
      const formUnitKey = `${form.company_identifier || ''}::${form.unit_id || ''}`
      if (formUnitKey !== filterUnit) return false
    }

    return true
  })

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
  const AUDITOR_TABLE_COL_PX = {
    controlNumber: 105,
    businessProcess: 140,
    subProcess: 150,
    description: 195,
    financialYear: 95,
    processOwner: 145,
    unit: 125,
    company: 145,
    status: 95,
    active: 85,
    dueDate: 100,
  }
  const auditorTableColWidthsOrdered = [
    AUDITOR_TABLE_COL_PX.controlNumber,
    AUDITOR_TABLE_COL_PX.businessProcess,
    AUDITOR_TABLE_COL_PX.subProcess,
    AUDITOR_TABLE_COL_PX.description,
    AUDITOR_TABLE_COL_PX.financialYear,
    AUDITOR_TABLE_COL_PX.processOwner,
    AUDITOR_TABLE_COL_PX.unit,
    AUDITOR_TABLE_COL_PX.company,
    AUDITOR_TABLE_COL_PX.status,
    AUDITOR_TABLE_COL_PX.active,
    AUDITOR_TABLE_COL_PX.dueDate,
  ]
  const auditorTableTotalWidthPx = auditorTableColWidthsOrdered.reduce((a, b) => a + b, 0)
  const pctColSx = (px) => {
    const pct = (100 * px) / auditorTableTotalWidthPx
    const s = `${pct}%`
    return {
      width: s,
      minWidth: s,
      maxWidth: s,
      boxSizing: 'border-box',
    }
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
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            mb: 3,
            gap: 2,
          }}
        >
          <Box
            sx={{
              display: 'flex',
              flexDirection: { xs: 'column', lg: 'row' },
              justifyContent: 'space-between',
              alignItems: { xs: 'stretch', lg: 'flex-start' },
              gap: 2,
            }}
          >
            <Box sx={{ minWidth: 0, pr: { lg: 2 } }}>
              <Typography
                variant="h5"
                component="h2"
                sx={{
                  fontWeight: 700,
                  color: theme.palette.text.primary,
                }}
              >
                RACM Dashboard
              </Typography>
              {/* <Typography variant="body2" sx={PAGE_SUBHEADER_TEXT_SX}>
                Review RACMs across all companies with the same operational filters as the coordinator dashboard, but in read-only mode.
              </Typography> */}
            </Box>

            <Box
              sx={{
                display: 'flex',
                flexDirection: { xs: 'column', sm: 'row' },
                flexWrap: 'wrap',
                justifyContent: 'flex-end',
                gap: 2,
                alignItems: { xs: 'stretch', sm: 'center' },
                width: { xs: '100%', lg: 'auto' },
                maxWidth: { lg: 'calc(100% - 320px)' },
              }}
            >
              <Box sx={{ minWidth: FILTER_BOX_MIN_WIDTH }}>
                <FormControl fullWidth size="small" sx={filterControlSx}>
                  <InputLabel id="auditor-racm-active-label">Active</InputLabel>
                  <Select
                    labelId="auditor-racm-active-label"
                    value={filterActive}
                    label="Active"
                    onChange={(event) => setFilterActive(event.target.value)}
                  >
                    <MenuItem value="all">All</MenuItem>
                    <MenuItem value="active">Active</MenuItem>
                    <MenuItem value="inactive">Inactive</MenuItem>
                  </Select>
                </FormControl>
              </Box>

              <Box sx={{ minWidth: FILTER_BOX_MIN_WIDTH }}>
                <FormControl fullWidth size="small" sx={filterControlSx}>
                  <InputLabel id="auditor-racm-status-label">Status</InputLabel>
                  <Select
                    labelId="auditor-racm-status-label"
                    value={filterStatus}
                    label="Status"
                    onChange={(event) => setFilterStatus(event.target.value)}
                  >
                    <MenuItem value="all">All</MenuItem>
                    <MenuItem value="Pending">Pending</MenuItem>
                    <MenuItem value="Sent for Approval">Sent for Approval</MenuItem>
                    <MenuItem value="Approved">Approved</MenuItem>
                    <MenuItem value="Rejected">Rejected</MenuItem>
                  </Select>
                </FormControl>
              </Box>

              {!isCompanyAdminView && (
                <Box sx={{ minWidth: FILTER_BOX_MIN_WIDTH }}>
                  <FormControl fullWidth size="small" sx={filterControlSx}>
                    <InputLabel id="auditor-racm-company-label">Company</InputLabel>
                    <Select
                      labelId="auditor-racm-company-label"
                      value={filterCompany}
                      label="Company"
                      onChange={(event) => {
                        setFilterCompany(event.target.value)
                        setFilterUnit('all')
                      }}
                    >
                      <MenuItem value="all">All</MenuItem>
                      {companyOptions.map((option) => (
                        <MenuItem key={option.value} value={option.value}>
                          {option.label}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Box>
              )}

              <Box sx={{ minWidth: FILTER_BOX_MIN_WIDTH }}>
                <FormControl fullWidth size="small" sx={filterControlSx}>
                  <InputLabel id="auditor-racm-unit-label">Unit</InputLabel>
                  <Select
                    labelId="auditor-racm-unit-label"
                    value={filterUnit}
                    label="Unit"
                    disabled={!isUnitFilterEnabled}
                    onChange={(event) => setFilterUnit(event.target.value)}
                  >
                    <MenuItem value="all">All</MenuItem>
                    {unitOptions.map((option) => (
                      <MenuItem key={option.value} value={option.value}>
                        {option.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Box>

              <Box sx={{ minWidth: FILTER_BOX_MIN_WIDTH }}>
                <FormControl fullWidth size="small" sx={filterControlSx}>
                  <InputLabel id="auditor-racm-business-process-label">Business Process</InputLabel>
                  <Select
                    labelId="auditor-racm-business-process-label"
                    value={filterBusinessProcess}
                    label="Business Process"
                    onChange={(event) => setFilterBusinessProcess(event.target.value)}
                  >
                    <MenuItem value="all">All</MenuItem>
                    {businessProcessFilterOptions.map((option) => (
                      <MenuItem key={option} value={option}>
                        {option}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Box>

              <Box sx={{ minWidth: FILTER_BOX_MIN_WIDTH }}>
                <FormControl fullWidth size="small" sx={filterControlSx}>
                  <InputLabel id="auditor-racm-financial-year-label">Financial Year</InputLabel>
                  <Select
                    labelId="auditor-racm-financial-year-label"
                    value={filterFinancialYear}
                    label="Financial Year"
                    onChange={(event) => setFilterFinancialYear(event.target.value)}
                  >
                    <MenuItem value="all">All</MenuItem>
                    {financialYearOptions.map((option) => (
                      <MenuItem key={option} value={option}>
                        {option}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Box>
            </Box>
          </Box>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>
            {error}
          </Alert>
        )}

        {loading ? (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Typography color="text.secondary">Loading RACMs...</Typography>
          </Box>
        ) : filteredForms.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Typography color="text.secondary">
              No RACMs match the selected filters.
            </Typography>
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
              <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>
                {filteredForms.length} RACM{filteredForms.length === 1 ? '' : 's'}
              </Typography>
              <FormControlLabel
                control={(
                  <Switch
                    checked={cellWordWrap}
                    onChange={(event) => setCellWordWrap(event.target.checked)}
                    size="small"
                    color="primary"
                  />
                )}
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

            <Box sx={DASHBOARD_TABLE_WRAP_SX}>
              <Box
                component="table"
                sx={{
                  width: '100%',
                  tableLayout: 'fixed',
                  borderCollapse: 'collapse',
                  '& th, & td': {
                    borderBottom: `1px solid ${theme.palette.divider}`,
                  },
                }}
              >
                <Box component="colgroup">
                  {auditorTableColWidthsOrdered.map((w, i) => (
                    <Box key={i} component="col" sx={pctColSx(w)} />
                  ))}
                </Box>
                <Box component="thead" sx={{ backgroundColor: TABLE_HEADER_BG }}>
                  <Box component="tr">
                    <Box
                      component="th"
                      sx={{
                        px: 2,
                        py: 1.5,
                        textAlign: 'left',
                        fontSize: '0.75rem',
                        fontWeight: 500,
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        color: theme.palette.text.secondary,
                        ...pctColSx(AUDITOR_TABLE_COL_PX.controlNumber),
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
                        ...pctColSx(AUDITOR_TABLE_COL_PX.businessProcess),
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
                        ...pctColSx(AUDITOR_TABLE_COL_PX.subProcess),
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
                        ...pctColSx(AUDITOR_TABLE_COL_PX.description),
                      }}
                    >
                      Standard Control Description
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
                        ...pctColSx(AUDITOR_TABLE_COL_PX.financialYear),
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
                        ...pctColSx(AUDITOR_TABLE_COL_PX.processOwner),
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
                        ...pctColSx(AUDITOR_TABLE_COL_PX.unit),
                      }}
                    >
                      Unit Name
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
                        ...pctColSx(AUDITOR_TABLE_COL_PX.company),
                      }}
                    >
                      Company
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
                        ...pctColSx(AUDITOR_TABLE_COL_PX.status),
                      }}
                    >
                      Status
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
                        ...pctColSx(AUDITOR_TABLE_COL_PX.active),
                      }}
                    >
                      Active
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
                        ...pctColSx(AUDITOR_TABLE_COL_PX.dueDate),
                      }}
                    >
                      Due Date
                    </Box>
                  </Box>
                </Box>
                <Box component="tbody">
                  {filteredForms.map((form, index) => {
                    const approvalStatus = formatApprovalStatus(form.status)
                    const approvalStatusColors = getApprovalStatusBadgeSolidColors(approvalStatus)
                    const isActive = getIsActive(form.active)

                    return (
                      <Box
                        component="tr"
                        key={form.form_id || form.id || index}
                        onClick={() => navigate(`${detailPathPrefix}${form.form_id}`)}
                        sx={{
                          cursor: 'pointer',
                          transition: 'background-color 0.2s',
                          '&:hover': {
                            backgroundColor: TABLE_ROW_HOVER_BG,
                          },
                        }}
                      >
                        <Box component="td" sx={{ px: 2, py: 2, whiteSpace: 'nowrap', fontSize: '0.875rem', fontWeight: 600, color: theme.palette.text.primary, ...pctColSx(AUDITOR_TABLE_COL_PX.controlNumber) }}>
                          {form.control_number || form.form_id || 'N/A'}
                        </Box>
                        <Box component="td" sx={dataCellSx({ px: 2.5, py: 2, fontSize: '0.875rem', color: theme.palette.text.primary, ...pctColSx(AUDITOR_TABLE_COL_PX.businessProcess) })}>
                          <Box component="span" sx={dataCellTextSx}>
                            {form.business_process || 'N/A'}
                          </Box>
                        </Box>
                        <Box component="td" sx={dataCellSx({ px: 2.5, py: 2, fontSize: '0.875rem', color: theme.palette.text.primary, ...pctColSx(AUDITOR_TABLE_COL_PX.subProcess) })}>
                          <Box component="span" sx={dataCellTextSx}>
                            {form.sub_process || 'N/A'}
                          </Box>
                        </Box>
                        <Box component="td" sx={dataCellSx({ px: 2.5, py: 2, fontSize: '0.875rem', color: theme.palette.text.primary, ...pctColSx(AUDITOR_TABLE_COL_PX.description) })}>
                          <Box component="span" sx={dataCellTextSx}>
                            {form.standard_control_description || 'N/A'}
                          </Box>
                        </Box>
                        <Box component="td" sx={dataCellSx({ px: 3, py: 2, fontSize: '0.875rem', color: theme.palette.text.primary, ...pctColSx(AUDITOR_TABLE_COL_PX.financialYear) })}>
                          <Box component="span" sx={dataCellTextSx}>
                            {form.financial_year || 'N/A'}
                          </Box>
                        </Box>
                        <Box component="td" sx={dataCellSx({ px: 2.5, py: 2, fontSize: '0.875rem', color: theme.palette.text.primary, ...pctColSx(AUDITOR_TABLE_COL_PX.processOwner) })}>
                          <Box component="span" sx={dataCellTextSx}>
                            {form.control_owner_name || form.control_owner || 'N/A'}
                          </Box>
                        </Box>
                        <Box component="td" sx={dataCellSx({ px: 2.5, py: 2, fontSize: '0.875rem', color: theme.palette.text.primary, ...pctColSx(AUDITOR_TABLE_COL_PX.unit) })}>
                          <Box component="span" sx={dataCellTextSx}>
                            {form.unit_name || 'N/A'}
                          </Box>
                        </Box>
                        <Box component="td" sx={dataCellSx({ px: 2.5, py: 2, fontSize: '0.875rem', color: theme.palette.text.primary, ...pctColSx(AUDITOR_TABLE_COL_PX.company) })}>
                          <Box component="span" sx={dataCellTextSx}>
                            {form.company_name || 'N/A'}
                          </Box>
                        </Box>
                        <Box component="td" sx={{ px: 3, py: 2, whiteSpace: 'nowrap', ...pctColSx(AUDITOR_TABLE_COL_PX.status) }}>
                          <Box
                            component="span"
                            sx={{
                              ...getApprovalStatusBadgePillSx(approvalStatus),
                              ...approvalStatusColors,
                            }}
                          >
                            {approvalStatus}
                          </Box>
                        </Box>
                        <Box component="td" sx={{ px: 3, py: 2, whiteSpace: 'nowrap', ...pctColSx(AUDITOR_TABLE_COL_PX.active) }}>
                          <Box component="span" sx={{ fontSize: '0.875rem', fontWeight: 600, color: theme.palette.text.primary }}>
                            {isActive ? 'Active' : 'Inactive'}
                          </Box>
                        </Box>
                        <Box component="td" sx={dataCellSx({ px: 3, py: 2, fontSize: '0.875rem', color: theme.palette.text.primary, ...pctColSx(AUDITOR_TABLE_COL_PX.dueDate) })}>
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
          </Box>
        )}
      </Paper>
    </Box>
  )
}

export default AuditorRacmDashboard
