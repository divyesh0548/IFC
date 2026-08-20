import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTheme } from '@mui/material/styles'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import FormControl from '@mui/material/FormControl'
import FormControlLabel from '@mui/material/FormControlLabel'
import InputLabel from '@mui/material/InputLabel'
import MenuItem from '@mui/material/MenuItem'
import Paper from '@mui/material/Paper'
import Select from '@mui/material/Select'
import Switch from '@mui/material/Switch'
import TextField from '@mui/material/TextField'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import TablePagination from '@mui/material/TablePagination'
import { apiUrl, API_BASE_URL } from '../../config/api'
import { useSyncGlobalLoading } from '../../contexts/GlobalLoadingContext'
import { useAuth } from '../../contexts/AuthContext'
import { useBusinessProcesses } from '../../hooks/useBusinessProcesses'
import { getRacmProcessOwnerDisplayValue } from '../../racmFormDetailFields'
import {
  DASHBOARD_PAGE_OUTER_SX,
  DASHBOARD_PAPER_SX,
  DASHBOARD_TABLE_WRAP_SX,
  FILTER_DROPDOWN_MIN_WIDTH_LG,
  PAGE_SUBHEADER_TEXT_SX,
  CONCLUSION_BADGE_TABLE_PILL_SX,
  CONCLUSION_TABLE_CELL_SX,
  TABLE_HEADER_BG,
  TABLE_ROW_HOVER_BG,
  getApprovalStatusBadgeSolidColors,
  getApprovalStatusBadgePillSx,
  getConclusionBadgeSolidColors,
  formatRacmApprovalStatusLabel,
  toRacmApprovalStatusQueryParam,
} from '../../uiConstants'

const DEFAULT_ROWS_PER_PAGE = 10
const ROWS_PER_PAGE_OPTIONS = [10, 25, 50]

function getIsActive(value) {
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value !== 0
  const normalized = String(value ?? '').trim().toLowerCase()
  if (!normalized || normalized === '0' || normalized === 'false' || normalized === 'null') {
    return false
  }
  return true
}

function formatStatus(status) {
  return formatRacmApprovalStatusLabel(status)
}

function formatConclusion(value) {
  const normalized = String(value || '').trim()
  if (!normalized) return 'None'
  return normalized.charAt(0).toUpperCase() + normalized.slice(1)
}

function formatDate(date) {
  if (!date) return 'N/A'
  const parsed = new Date(date)
  if (Number.isNaN(parsed.getTime())) return 'N/A'
  return parsed.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function CompanyAdminRacmDashboard() {
  const theme = useTheme()
  const navigate = useNavigate()
  const { companyIdentifier } = useAuth()
  const [forms, setForms] = useState([])
  const [page, setPage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(DEFAULT_ROWS_PER_PAGE)
  const [totalCount, setTotalCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [cellWordWrap, setCellWordWrap] = useState(false)
  const [filterActive, setFilterActive] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterBusinessProcess, setFilterBusinessProcess] = useState('all')
  const [filterFinancialYear, setFilterFinancialYear] = useState('all')
  const [filterUnit, setFilterUnit] = useState('all')
  const [filterConclusion, setFilterConclusion] = useState('all')
  const [controlNumberInput, setControlNumberInput] = useState('')
  const [controlNumberFilter, setControlNumberFilter] = useState('')
  const [conclusionOptions, setConclusionOptions] = useState([])
  const [unitOptions, setUnitOptions] = useState([])
  const [financialYearOptions, setFinancialYearOptions] = useState([])
  const { businessProcessOptions } = useBusinessProcesses()

  useSyncGlobalLoading(loading)

  useEffect(() => {
    if (!companyIdentifier) return
    const fetchFilters = async () => {
      try {
        const response = await fetch(apiUrl('/api/company-admin/racm-dashboard/filters'), {
          method: 'GET',
          credentials: 'include',
        })
        const data = await response.json()
        if (response.ok && data.success) {
          setUnitOptions(
            (data.data?.units || []).map((unit) => ({
              value: String(unit.unit_id || '').trim(),
              label: unit.unit_name || unit.unit_id || 'Unit',
            })).filter((unit) => unit.value)
          )
          setFinancialYearOptions(
            (data.data?.financialYears || []).map((year) => String(year).trim()).filter(Boolean)
          )
        }
      } catch (error) {
        console.error('Error fetching dashboard filters:', error)
      }
    }
    fetchFilters()
  }, [companyIdentifier])

  useEffect(() => {
    if (companyIdentifier) {
      fetchForms()
    }
  }, [
    companyIdentifier,
    filterActive,
    filterStatus,
    filterBusinessProcess,
    filterFinancialYear,
    filterUnit,
    filterConclusion,
    controlNumberFilter,
    page,
    rowsPerPage,
  ])

  const buildFormsListUrl = () => {
    const params = new URLSearchParams()
    params.set('page', String(page + 1))
    params.set('page_size', String(rowsPerPage))

    if (filterActive === 'active') {
      params.set('active', 'true')
    } else if (filterActive === 'inactive') {
      params.set('active', 'false')
    }

    if (filterStatus !== 'all') {
      const statusParam = toRacmApprovalStatusQueryParam(filterStatus)
      if (statusParam) params.set('status', statusParam)
    }

    if (filterBusinessProcess !== 'all') {
      params.set('business_process', filterBusinessProcess)
    }

    if (filterFinancialYear !== 'all') {
      params.set('financial_year', filterFinancialYear)
    }

    if (filterUnit !== 'all') {
      params.set('unit_id', filterUnit)
    }

    if (filterConclusion !== 'all') {
      params.set('conclusion', filterConclusion)
    }

    if (controlNumberFilter) {
      params.set('control_number', controlNumberFilter)
    }

    return `${API_BASE_URL}/api/control-forms?${params.toString()}`
  }

  const fetchForms = async () => {
    if (!companyIdentifier) return
    setLoading(true)
    try {
      const response = await fetch(buildFormsListUrl(), {
        method: 'GET',
        credentials: 'include',
      })
      const data = await response.json()

      if (response.ok && data.success) {
        const nextForms = Array.isArray(data.data) ? data.data : []
        const nextTotal = Number(data.count || 0)
        const lastValidPage = Math.max(0, Math.ceil(nextTotal / rowsPerPage) - 1)

        if (nextTotal > 0 && nextForms.length === 0 && page > lastValidPage) {
          setPage(lastValidPage)
          return
        }

        setForms(nextForms)
        setTotalCount(nextTotal)
        setConclusionOptions(
          Array.isArray(data.summary?.conclusion_options) ? data.summary.conclusion_options : []
        )
      } else {
        setForms([])
        setTotalCount(0)
      }
    } catch (error) {
      console.error('Error fetching forms:', error)
      setForms([])
      setTotalCount(0)
    } finally {
      setLoading(false)
    }
  }

  const handleFormClick = (formId) => {
    window.open(
      `/company_admin/form/${encodeURIComponent(formId)}`,
      '_blank',
      'noopener,noreferrer'
    )
  }

  const handleControlNumberSearchSubmit = (event) => {
    event.preventDefault()
    setControlNumberFilter(controlNumberInput.trim())
    setPage(0)
  }

  const handleControlNumberSearchClear = () => {
    setControlNumberInput('')
    setControlNumberFilter('')
    setPage(0)
  }

  const showUnitColumn = unitOptions.length > 1
  const businessProcessFilterOptions = [...new Set([
    ...businessProcessOptions,
    ...forms.map((form) => String(form.business_process || '').trim()),
  ].filter(Boolean))].sort((a, b) => a.localeCompare(b))

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
      ? { whiteSpace: 'normal', wordBreak: 'break-word', overflow: 'visible', verticalAlign: 'top' }
      : { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }),
  })
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
    },
    '& .MuiInputLabel-root': { color: theme.palette.text.primary },
    '& .MuiSelect-root': { color: theme.palette.text.primary },
  }
  const CA_TABLE_COL_PX = {
    controlNumber: 110,
    businessProcess: 140,
    subProcess: 150,
    standardControl: 210,
    financialYear: 95,
    unit: 120,
    processOwner: 140,
    activity: 85,
    approvalStatus: 105,
    conclusion: 150,
    dueDate: 95,
  }
  const caTableColWidthsOrdered = [
    CA_TABLE_COL_PX.controlNumber,
    CA_TABLE_COL_PX.businessProcess,
    CA_TABLE_COL_PX.subProcess,
    CA_TABLE_COL_PX.standardControl,
    CA_TABLE_COL_PX.financialYear,
    ...(showUnitColumn ? [CA_TABLE_COL_PX.unit] : []),
    CA_TABLE_COL_PX.processOwner,
    CA_TABLE_COL_PX.activity,
    CA_TABLE_COL_PX.approvalStatus,
    CA_TABLE_COL_PX.conclusion,
    CA_TABLE_COL_PX.dueDate,
  ]
  const caTableTotalWidthPx = caTableColWidthsOrdered.reduce((a, b) => a + b, 0)
  const pctColSx = (px) => {
    const pct = (100 * px) / caTableTotalWidthPx
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
      <Paper elevation={3} sx={{ ...DASHBOARD_PAPER_SX, p: 3 }}>
        <Box
          sx={{
            display: 'flex',
            alignItems: { xs: 'stretch', sm: 'flex-start' },
            justifyContent: 'space-between',
            flexDirection: { xs: 'column', sm: 'row' },
            gap: 1.5,
            mb: 0.5,
          }}
        >
          <Box sx={{ pr: { sm: 2, md: 3 }, mr: { sm: 1 } }}>
            <Typography variant="h5" component="h1" sx={{ fontWeight: 700, mb: 0.5 }}>
              RACM Dashboard
            </Typography>
          </Box>
          <Button
            variant="contained"
            color="secondary"
            size="small"
            onClick={() => navigate('/company_admin/ifc-report')}
            sx={{ textTransform: 'none', fontWeight: 600, alignSelf: { xs: 'stretch', sm: 'center' } }}
          >
            Reports
          </Button>
        </Box>

        <Box sx={{ mt: 3, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Box
            sx={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 2,
              alignItems: 'center',
            }}
          >
            <FormControl variant="outlined" sx={filterControlSx}>
              <InputLabel id="ca-unit-filter-label">Unit</InputLabel>
              <Select
                labelId="ca-unit-filter-label"
                value={filterUnit}
                label="Unit"
                onChange={(e) => {
                  setFilterUnit(e.target.value)
                  setPage(0)
                }}
              >
                <MenuItem value="all">All</MenuItem>
                {unitOptions.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl variant="outlined" sx={filterControlSx}>
              <InputLabel id="ca-bp-filter-label">Business Process</InputLabel>
              <Select
                labelId="ca-bp-filter-label"
                value={filterBusinessProcess}
                label="Business Process"
                onChange={(e) => {
                  setFilterBusinessProcess(e.target.value)
                  setPage(0)
                }}
              >
                <MenuItem value="all">All</MenuItem>
                {businessProcessFilterOptions.map((option) => (
                  <MenuItem key={option} value={option}>
                    {option}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl variant="outlined" sx={filterControlSx}>
              <InputLabel id="ca-fy-filter-label">Financial Year</InputLabel>
              <Select
                labelId="ca-fy-filter-label"
                value={filterFinancialYear}
                label="Financial Year"
                onChange={(e) => {
                  setFilterFinancialYear(e.target.value)
                  setPage(0)
                }}
              >
                <MenuItem value="all">All</MenuItem>
                {financialYearOptions.map((option) => (
                  <MenuItem key={option} value={option}>
                    {option}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl variant="outlined" sx={filterControlSx}>
              <InputLabel id="ca-activity-filter-label">Activity</InputLabel>
              <Select
                labelId="ca-activity-filter-label"
                value={filterActive}
                label="Activity"
                onChange={(e) => {
                  setFilterActive(e.target.value)
                  setPage(0)
                }}
              >
                <MenuItem value="all">All</MenuItem>
                <MenuItem value="active">Active</MenuItem>
                <MenuItem value="inactive">Inactive</MenuItem>
              </Select>
            </FormControl>

            <FormControl variant="outlined" sx={filterControlSx}>
              <InputLabel id="ca-status-filter-label">Approval Status</InputLabel>
              <Select
                labelId="ca-status-filter-label"
                value={filterStatus}
                label="Approval Status"
                onChange={(e) => {
                  setFilterStatus(e.target.value)
                  setPage(0)
                }}
              >
                <MenuItem value="all">All</MenuItem>
                <MenuItem value="Approved">Approved</MenuItem>
                <MenuItem value="Rejected">Rejected</MenuItem>
                <MenuItem value="Pending">Pending</MenuItem>
                <MenuItem value="Sent for Approval">Sent for Approval</MenuItem>
              </Select>
            </FormControl>

            <FormControl variant="outlined" sx={filterControlSx}>
              <InputLabel id="ca-conclusion-filter-label">Conclusion</InputLabel>
              <Select
                labelId="ca-conclusion-filter-label"
                value={filterConclusion}
                label="Conclusion"
                onChange={(e) => {
                  setFilterConclusion(e.target.value)
                  setPage(0)
                }}
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

          <Box>
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 1,
                mb: 1.5,
              }}
            >
              <Typography sx={{ ...PAGE_SUBHEADER_TEXT_SX, flex: '1 1 240px', minWidth: 0, pr: { sm: 2 } }}>
                View and filter RACMs across your company units.
              </Typography>
              <FormControlLabel
                control={
                  <Switch
                    checked={cellWordWrap}
                    onChange={(e) => setCellWordWrap(e.target.checked)}
                    size="small"
                  />
                }
                label="Word wrap"
                sx={{
                  mr: 0,
                  flexShrink: 0,
                  userSelect: 'none',
                  '& .MuiFormControlLabel-label': {
                    fontSize: '0.8125rem',
                    color: theme.palette.text.secondary,
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
                sx={{ minWidth: { xs: '100%', sm: 260 } }}
              />
              <Button type="submit" variant="contained">
                Search
              </Button>
              {(controlNumberInput || controlNumberFilter) ? (
                <Button type="button" variant="outlined" onClick={handleControlNumberSearchClear}>
                  Clear
                </Button>
              ) : null}
            </Box>
          </Box>

          {loading ? (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Typography color="text.secondary">Loading forms...</Typography>
            </Box>
          ) : totalCount === 0 ? (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Typography color="text.secondary">
                {controlNumberFilter ? 'No forms match the control number search.' : 'No forms found.'}
              </Typography>
            </Box>
          ) : (
            <>
              <Box sx={DASHBOARD_TABLE_WRAP_SX}>
                <Box
                  component="table"
                  sx={{
                    width: '100%',
                    tableLayout: 'fixed',
                    borderCollapse: 'collapse',
                    '& th, & td': { borderBottom: `1px solid ${theme.palette.divider}` },
                  }}
                >
                  <Box component="colgroup">
                    {caTableColWidthsOrdered.map((w, i) => (
                      <Box key={i} component="col" sx={pctColSx(w)} />
                    ))}
                  </Box>
                  <Box component="thead" sx={{ backgroundColor: TABLE_HEADER_BG }}>
                    <Box component="tr">
                      {[
                        { label: 'Control Number', key: 'controlNumber' },
                        { label: 'Business Process', key: 'businessProcess' },
                        { label: 'Sub Process', key: 'subProcess' },
                        { label: 'Standard Control Description', key: 'standardControl' },
                        { label: 'Financial Year', key: 'financialYear' },
                        ...(showUnitColumn ? [{ label: 'Unit', key: 'unit' }] : []),
                        { label: 'Process Owner', key: 'processOwner' },
                        { label: 'Activity', key: 'activity' },
                        { label: 'Approval Status', key: 'approvalStatus' },
                        { label: 'Conclusion', key: 'conclusion' },
                        { label: 'Due Date', key: 'dueDate' },
                      ].map((col) => (
                        <Box
                          key={col.label}
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
                            ...pctColSx(CA_TABLE_COL_PX[col.key]),
                          }}
                        >
                          {col.label}
                        </Box>
                      ))}
                    </Box>
                  </Box>
                  <Box component="tbody">
                    {forms.map((form) => {
                      const isActive = getIsActive(form.active)
                      const status = formatStatus(form.status)
                      const processOwner = getRacmProcessOwnerDisplayValue(form)
                      const conclusionLabel = formatConclusion(form.control_design_conclusion)

                      return (
                        <Box
                          component="tr"
                          key={form.form_id || form.id}
                          onClick={() => handleFormClick(form.form_id)}
                          sx={{
                            cursor: 'pointer',
                            transition: 'background-color 0.2s',
                            '&:hover': { backgroundColor: TABLE_ROW_HOVER_BG },
                          }}
                        >
                          <Box component="td" sx={dataCellSx({ px: 2.5, py: 2, fontSize: '0.875rem', ...pctColSx(CA_TABLE_COL_PX.controlNumber) })}>
                            <Box component="span" sx={{ ...dataCellTextSx, fontWeight: 600 }}>
                              {form.control_number || form.form_id || 'N/A'}
                            </Box>
                          </Box>
                          <Box component="td" sx={dataCellSx({ px: 2.5, py: 2, fontSize: '0.875rem', ...pctColSx(CA_TABLE_COL_PX.businessProcess) })}>
                            <Box component="span" sx={dataCellTextSx}>{form.business_process || 'N/A'}</Box>
                          </Box>
                          <Box component="td" sx={dataCellSx({ px: 2.5, py: 2, fontSize: '0.875rem', ...pctColSx(CA_TABLE_COL_PX.subProcess) })}>
                            <Tooltip title={form.sub_process || 'N/A'} arrow slotProps={{ tooltip: { sx: tooltipSx } }}>
                              <Box component="span" sx={dataCellTextSx}>{form.sub_process || 'N/A'}</Box>
                            </Tooltip>
                          </Box>
                          <Box component="td" sx={dataCellSx({ px: 2.5, py: 2, fontSize: '0.875rem', ...pctColSx(CA_TABLE_COL_PX.standardControl) })}>
                            <Tooltip
                              title={form.standard_control_description || 'N/A'}
                              arrow
                              slotProps={{ tooltip: { sx: tooltipSx } }}
                            >
                              <Box component="span" sx={dataCellTextSx}>
                                {form.standard_control_description || 'N/A'}
                              </Box>
                            </Tooltip>
                          </Box>
                          <Box component="td" sx={dataCellSx({ px: 2.5, py: 2, fontSize: '0.875rem', ...pctColSx(CA_TABLE_COL_PX.financialYear) })}>
                            <Box component="span" sx={dataCellTextSx}>{form.financial_year || 'N/A'}</Box>
                          </Box>
                          {showUnitColumn && (
                            <Box component="td" sx={dataCellSx({ px: 2.5, py: 2, fontSize: '0.875rem', ...pctColSx(CA_TABLE_COL_PX.unit) })}>
                              <Tooltip
                                title={form.unit_name || form.unit_id || 'N/A'}
                                arrow
                                slotProps={{ tooltip: { sx: tooltipSx } }}
                              >
                                <Box component="span" sx={dataCellTextSx}>
                                  {form.unit_name || form.unit_id || 'N/A'}
                                </Box>
                              </Tooltip>
                            </Box>
                          )}
                          <Box component="td" sx={dataCellSx({ px: 2.5, py: 2, fontSize: '0.875rem', ...pctColSx(CA_TABLE_COL_PX.processOwner) })}>
                            <Tooltip title={processOwner} arrow slotProps={{ tooltip: { sx: tooltipSx } }}>
                              <Box component="span" sx={dataCellTextSx}>{processOwner}</Box>
                            </Tooltip>
                          </Box>
                          <Box component="td" sx={{ px: 2.5, py: 2, whiteSpace: 'nowrap', ...pctColSx(CA_TABLE_COL_PX.activity) }}>
                            <Box component="span" sx={{ fontSize: '0.875rem', fontWeight: 600 }}>
                              {isActive ? 'Active' : 'Inactive'}
                            </Box>
                          </Box>
                          <Box component="td" sx={{ px: 2.5, py: 2, whiteSpace: 'nowrap', ...pctColSx(CA_TABLE_COL_PX.approvalStatus) }}>
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
                          <Box component="td" sx={{ px: 2.5, py: 2, ...pctColSx(CA_TABLE_COL_PX.conclusion), ...CONCLUSION_TABLE_CELL_SX }}>
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
                          <Box component="td" sx={dataCellSx({ px: 2.5, py: 2, fontSize: '0.875rem', ...pctColSx(CA_TABLE_COL_PX.dueDate) })}>
                            <Box component="span" sx={dataCellTextSx}>{formatDate(form.due_date)}</Box>
                          </Box>
                        </Box>
                      )
                    })}
                  </Box>
                </Box>
              </Box>
              <TablePagination
                component="div"
                count={totalCount}
                page={page}
                onPageChange={(_event, newPage) => setPage(newPage)}
                rowsPerPage={rowsPerPage}
                onRowsPerPageChange={(event) => {
                  setRowsPerPage(parseInt(event.target.value, 10))
                  setPage(0)
                }}
                rowsPerPageOptions={ROWS_PER_PAGE_OPTIONS}
              />
            </>
          )}
        </Box>
      </Paper>
    </Box>
  )
}

export default CompanyAdminRacmDashboard
