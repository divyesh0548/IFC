import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import FormControl from '@mui/material/FormControl'
import InputLabel from '@mui/material/InputLabel'
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import Alert from '@mui/material/Alert'
import Checkbox from '@mui/material/Checkbox'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import ListItemText from '@mui/material/ListItemText'
import TablePagination from '@mui/material/TablePagination'
import Tooltip from '@mui/material/Tooltip'
import ArrowOutwardRoundedIcon from '@mui/icons-material/ArrowOutwardRounded'
import { useTheme } from '@mui/material/styles'
import { apiUrl } from '../../config/api'
import { useSyncGlobalLoading } from '../../contexts/GlobalLoadingContext'
import { DASHBOARD_PAGE_OUTER_SX, DASHBOARD_PAPER_SX, PAGE_SUBHEADER_TEXT_SX } from '../../uiConstants'
import { getFieldValue } from './dashboardClassificationUtils'
import { toast } from 'react-hot-toast'

function formatServerErrorToast(errorCode) {
  const normalizedErrorCode = String(errorCode || '').trim() || 'UNKNOWN_ERROR'
  return `Error occured on server (${normalizedErrorCode})`
}

const DETAIL_FIELD_VALUE_SX = {
  color: 'text.secondary',
  lineHeight: 1.6,
}

const TABLE_TEXT_TRUNCATE_SX = {
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
}

const INSIGHT_CARD_LABEL_SX = {
  fontWeight: 700,
  color: 'text.primary',
  mb: 0.75,
}

const TABLE_GRID_COLUMNS = '56px 160px 180px 220px 140px 240px minmax(340px, 1fr)'

function getSelectedFilterLabel(selected, options, getLabel = (value) => value) {
  if (!Array.isArray(selected) || selected.length === 0) return 'All'
  if (selected.length === 1) return getLabel(selected[0])
  return `${selected.length} selected`
}

const FILTER_CONTROL_HEIGHT = 40

const FILTER_SELECT_SX = {
  minWidth: { xs: '100%', sm: 220 },
  maxWidth: { xs: '100%', sm: 260 },
  height: FILTER_CONTROL_HEIGHT,
  '& .MuiInputBase-root': {
    height: FILTER_CONTROL_HEIGHT,
  },
  '& .MuiSelect-select': {
    display: 'flex',
    alignItems: 'center',
    py: 0,
    height: FILTER_CONTROL_HEIGHT,
    boxSizing: 'border-box',
  },
}

function renderFilterValue(label) {
  return (
    <Typography
      component="span"
      variant="body2"
      sx={{
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </Typography>
  )
}

function formatRiskAnalysisTimestamp(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function RiskAnalysis() {
  const theme = useTheme()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState([])
  const [unitOptions, setUnitOptions] = useState([])
  const [businessProcessOptions, setBusinessProcessOptions] = useState([])
  const [financialYearOptions, setFinancialYearOptions] = useState([])
  const [filterUnits, setFilterUnits] = useState([])
  const [filterBusinessProcesses, setFilterBusinessProcesses] = useState([])
  const [filterFinancialYears, setFilterFinancialYears] = useState([])
  const [page, setPage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(10)
  const [totalCount, setTotalCount] = useState(0)
  const [selectedControlNumbers, setSelectedControlNumbers] = useState(new Set())
  const [errorMessage, setErrorMessage] = useState('')
  const [selectedControl, setSelectedControl] = useState(null)
  const [analysisDialogOpen, setAnalysisDialogOpen] = useState(false)
  const [analysisLoading, setAnalysisLoading] = useState(false)
  const [analysisGenerating, setAnalysisGenerating] = useState(false)
  const [batchGenerating, setBatchGenerating] = useState(false)
  const [analysisData, setAnalysisData] = useState(null)
  const lastSelectedIndexRef = useRef(null)
  useSyncGlobalLoading(loading || batchGenerating || analysisGenerating)

  const pageControlNumbers = useMemo(
    () =>
      rows
        .map((row) => String(getFieldValue(row, 'control_number', 'controlNumber') || '').trim())
        .filter(Boolean),
    [rows]
  )

  useEffect(() => {
    let cancelled = false

    const fetchData = async () => {
      setLoading(true)
      setErrorMessage('')

      try {
        const params = new URLSearchParams({
          page: String(page + 1),
          page_size: String(rowsPerPage),
        })

        filterUnits.forEach((unitId) => params.append('unit_ids', unitId))
        filterBusinessProcesses.forEach((businessProcess) => params.append('business_processes', businessProcess))
        filterFinancialYears.forEach((financialYear) => params.append('financial_years', financialYear))

        const response = await fetch(apiUrl(`/api/company-co/risk-analysis/controls?${params.toString()}`), {
          credentials: 'include',
        })
        const data = await response.json()

        if (!response.ok || !data?.success) {
          throw new Error(data?.message || 'Failed to fetch risk-analysis controls')
        }

        if (!cancelled) {
          setRows(Array.isArray(data.data) ? data.data : [])
          setTotalCount(Number(data.count || 0))
          setUnitOptions(Array.isArray(data.filters?.units) ? data.filters.units : [])
          setBusinessProcessOptions(Array.isArray(data.filters?.business_processes) ? data.filters.business_processes : [])
          setFinancialYearOptions(Array.isArray(data.filters?.financial_years) ? data.filters.financial_years : [])
        }
      } catch (error) {
        console.error('Error fetching risk analysis data:', error)
        if (!cancelled) {
          setUnitOptions([])
          setBusinessProcessOptions([])
          setFinancialYearOptions([])
          setRows([])
          setTotalCount(0)
          setErrorMessage(error.message || 'Failed to load risk analysis data')
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    fetchData()

    return () => {
      cancelled = true
    }
  }, [filterBusinessProcesses, filterFinancialYears, filterUnits, page, rowsPerPage])

  const selectedControlsOnPage = useMemo(() => (
    rows.filter((row) => selectedControlNumbers.has(String(getFieldValue(row, 'control_number', 'controlNumber') || '').trim()))
  ), [rows, selectedControlNumbers])

  const allPageControlsSelected = rows.length > 0 && selectedControlsOnPage.length === rows.length
  const somePageControlsSelected = selectedControlsOnPage.length > 0 && selectedControlsOnPage.length < rows.length

  const resetPageForFilterChange = (setter) => (event) => {
    const value = event.target.value
    setter(typeof value === 'string' ? value.split(',').filter(Boolean) : value)
    setPage(0)
    setSelectedControlNumbers(new Set())
    lastSelectedIndexRef.current = null
  }

  const toggleControlSelection = (controlNumber, event) => {
    const normalizedControlNumber = String(controlNumber || '').trim()
    if (!normalizedControlNumber) return

    const currentIndex = pageControlNumbers.indexOf(normalizedControlNumber)
    if (currentIndex < 0) return

    const isShiftSelect = Boolean(event?.nativeEvent?.shiftKey || event?.shiftKey)
    const anchorIndex = lastSelectedIndexRef.current

    if (isShiftSelect && Number.isInteger(anchorIndex) && pageControlNumbers[anchorIndex]) {
      const start = Math.min(anchorIndex, currentIndex)
      const end = Math.max(anchorIndex, currentIndex)
      setSelectedControlNumbers((current) => {
        const next = new Set(current)
        for (let index = start; index <= end; index += 1) {
          const rangeControlNumber = pageControlNumbers[index]
          if (rangeControlNumber) next.add(rangeControlNumber)
        }
        return next
      })
      lastSelectedIndexRef.current = currentIndex
      return
    }

    setSelectedControlNumbers((current) => {
      const next = new Set(current)
      if (next.has(normalizedControlNumber)) {
        next.delete(normalizedControlNumber)
      } else {
        next.add(normalizedControlNumber)
      }
      return next
    })
    lastSelectedIndexRef.current = currentIndex
  }

  const togglePageSelection = () => {
    setSelectedControlNumbers((current) => {
      const next = new Set(current)
      if (pageControlNumbers.length > 0 && pageControlNumbers.every((controlNumber) => next.has(controlNumber))) {
        pageControlNumbers.forEach((controlNumber) => next.delete(controlNumber))
        lastSelectedIndexRef.current = null
      } else {
        pageControlNumbers.forEach((controlNumber) => next.add(controlNumber))
        lastSelectedIndexRef.current = pageControlNumbers.length > 0 ? pageControlNumbers.length - 1 : null
      }

      return next
    })
  }

  const handleOpenAnalysisDialog = async (row) => {
    const controlNumber = String(getFieldValue(row, 'control_number', 'controlNumber') || '').trim()
    if (!controlNumber) return

    setSelectedControl(row)
    setAnalysisDialogOpen(true)
    setAnalysisLoading(true)
    setAnalysisData(null)

    try {
      const response = await fetch(apiUrl(`/api/company-co/risk-analysis/control/${encodeURIComponent(controlNumber)}`), {
        credentials: 'include',
      })
      const data = await response.json()

      if (!response.ok || !data?.success) {
        throw new Error(data?.message || 'Failed to fetch risk analysis')
      }

      setAnalysisData(data.data || null)
    } catch (error) {
      console.error('Error fetching stored risk analysis:', error)
      toast.error(error.message || 'Failed to fetch risk analysis')
    } finally {
      setAnalysisLoading(false)
    }
  }

  const handleGenerateAnalysis = async () => {
    const controlNumber = String(getFieldValue(selectedControl, 'control_number', 'controlNumber') || '').trim()
    if (!controlNumber) return

    setAnalysisGenerating(true)
    try {
      const response = await fetch(apiUrl(`/api/company-co/risk-analysis/control/${encodeURIComponent(controlNumber)}/generate`), {
        method: 'POST',
        credentials: 'include',
      })
      const data = await response.json()

      if (!response.ok || !data?.success) {
        const error = new Error(data?.message || 'Failed to generate risk analysis')
        error.serverCode = String(data?.code || '').trim()
        throw error
      }

      setAnalysisData((prev) => ({
        control: prev?.control || {
          form_id: getFieldValue(selectedControl, 'form_id', 'formId'),
          company_identifier: '',
          business_process: String(getFieldValue(selectedControl, 'business_process', 'businessProcess') || '').trim(),
          sub_process: String(getFieldValue(selectedControl, 'sub_process', 'subProcess') || '').trim(),
          risk_description: String(getFieldValue(selectedControl, 'risk_description', 'riskDescription') || '').trim(),
          control_objective: '',
          standard_control_description: '',
          control_number: controlNumber,
        },
        analysis: data.data?.analysis || null,
      }))
      toast.success('Risk analysis generated successfully.')
    } catch (error) {
      console.error('Error generating risk analysis:', error)
      toast.error(formatServerErrorToast(error?.serverCode))
    } finally {
      setAnalysisGenerating(false)
    }
  }

  const handleGenerateSelectedAnalyses = async () => {
    const controlNumbers = [...selectedControlNumbers]
    if (controlNumbers.length === 0) {
      toast('Select at least one RACM for risk analysis.')
      return
    }

    setBatchGenerating(true)
    let generatedCount = 0
    let failedCount = 0

    try {
      for (const controlNumber of controlNumbers) {
        try {
          const response = await fetch(apiUrl(`/api/company-co/risk-analysis/control/${encodeURIComponent(controlNumber)}/generate`), {
            method: 'POST',
            credentials: 'include',
          })
          const data = await response.json()

          if (!response.ok || !data?.success) {
            failedCount += 1
            if (response.status === 409 || String(data?.code || '').trim() === 'AI_MODEL_BUSY') {
              toast('LLM Server is busy, Try again after some moments')
              break
            }
          } else {
            generatedCount += 1
          }
        } catch (error) {
          console.error('Error generating selected risk analysis:', error)
          failedCount += 1
        }
      }

      if (generatedCount > 0) {
        toast.success(`Risk analysis generated for ${generatedCount} RACM${generatedCount === 1 ? '' : 's'}.`)
        setSelectedControlNumbers(new Set())
      }

      if (failedCount > 0 && generatedCount === 0) {
        toast.error('Risk analysis generation failed for the selected RACMs.')
      }
    } finally {
      setBatchGenerating(false)
    }
  }

  const handleCloseDialog = () => {
    if (analysisGenerating) return
    setAnalysisDialogOpen(false)
    setSelectedControl(null)
    setAnalysisLoading(false)
    setAnalysisData(null)
  }

  const handleOpenControlInNewWindow = () => {
    const normalizedFormId = String(
      analysisData?.control?.form_id || getFieldValue(selectedControl, 'form_id', 'formId') || ''
    ).trim()

    if (!normalizedFormId) {
      toast.error('Form ID is not available for this control')
      return
    }

    window.open(`/company-co/form/${encodeURIComponent(normalizedFormId)}`, '_blank', 'noopener,noreferrer')
  }

  const renderAnalysisResponse = () => {
    const response = analysisData?.analysis?.response_json
    if (!response) {
      return (
        <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>
          No stored risk analysis exists for this control. Generate risk analysis for this control.
        </Typography>
      )
    }

    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        <Box
          sx={{
            p: 2,
            borderRadius: 2,
            border: `1px solid ${theme.palette.divider}`,
            backgroundColor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.02)' : theme.palette.common.white,
          }}
        >
          <Typography variant="body2" sx={INSIGHT_CARD_LABEL_SX}>
            Matched Sub-Process
          </Typography>
          <Typography variant="body2" sx={DETAIL_FIELD_VALUE_SX}>
            {response.matchedSubProcess || 'N/A'}
          </Typography>
        </Box>

        <Box
          sx={{
            p: 2,
            borderRadius: 2,
            border: `1px solid ${theme.palette.divider}`,
            backgroundColor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.02)' : theme.palette.common.white,
          }}
        >
          <Typography variant="body2" sx={INSIGHT_CARD_LABEL_SX}>
            Missing Risks
          </Typography>
          {Array.isArray(response.missingRiskPointers) && response.missingRiskPointers.length > 0 ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {response.missingRiskPointers.map((item, index) => (
                <Box
                  key={`${item.risk}-${index}`}
                  sx={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 1.25,
                  }}
                >
                  <Typography
                    variant="body2"
                    component="span"
                    sx={{
                      flexShrink: 0,
                      minWidth: '1.5rem',
                      fontWeight: 700,
                      color: theme.palette.text.primary,
                      lineHeight: 1.6,
                    }}
                  >
                    {index + 1}.
                  </Typography>
                  <Typography
                    variant="body2"
                    component="span"
                    sx={{ color: theme.palette.text.primary, lineHeight: 1.6 }}
                  >
                    {item.pointer}
                  </Typography>
                </Box>
              ))}
            </Box>
          ) : (
            <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>
              No missing-risk pointers returned.
            </Typography>
          )}
        </Box>
      </Box>
    )
  }

  const analysisGeneratedAt = formatRiskAnalysisTimestamp(
    analysisData?.analysis?.updated_at || analysisData?.analysis?.created_at
  )

  return (
    <Box sx={DASHBOARD_PAGE_OUTER_SX}>
      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', md: 'row' },
          alignItems: { xs: 'flex-start', md: 'flex-start' },
          justifyContent: 'space-between',
          gap: 2,
          mb: 3,
          pb: 2.5,
          borderBottom: `1px solid ${theme.palette.divider}`,
        }}
      >
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800, color: theme.palette.text.primary }}>
            Risk Analysis
          </Typography>
          <Typography variant="body2" sx={PAGE_SUBHEADER_TEXT_SX}>
            Review control risks by business process and financial year.
          </Typography>
        </Box>
        <Button variant="contained" onClick={() => navigate('/company-co/dashboard')}>
          Back To Dashboard
        </Button>
      </Box>

      {errorMessage ? (
        <Alert severity="info" sx={{ mb: 3 }}>
          {errorMessage}
        </Alert>
      ) : null}

      <Paper
        elevation={3}
        sx={{
          ...DASHBOARD_PAPER_SX,
          borderRadius: 3,
          overflow: 'hidden',
          border: `1px solid ${theme.palette.divider}`,
          boxShadow: theme.palette.mode === 'dark'
            ? '0 10px 28px rgba(0, 0, 0, 0.28)'
            : '0 12px 30px rgba(15, 23, 42, 0.08)',
        }}
      >
        <Box
          sx={{
            px: 3,
            pt: 3,
            pb: 2,
            borderBottom: `1px solid ${theme.palette.divider}`,
          }}
        >
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1.25,
              flexWrap: 'wrap',
            }}
          >
              <FormControl size="small" variant="outlined" sx={FILTER_SELECT_SX}>
                <InputLabel id="risk-analysis-unit-label" shrink>Unit</InputLabel>
                <Select
                  labelId="risk-analysis-unit-label"
                  multiple
                  value={filterUnits}
                  label="Unit"
                  displayEmpty
                  notched
                  onChange={resetPageForFilterChange(setFilterUnits)}
                  renderValue={(selected) => renderFilterValue(
                    getSelectedFilterLabel(
                      selected,
                      unitOptions,
                      (unitId) => unitOptions.find((unit) => String(unit.unit_id) === String(unitId))?.unit_name || unitId
                    )
                  )}
                >
                  {unitOptions.map((unit) => (
                    <MenuItem key={unit.unit_id} value={unit.unit_id}>
                      <Checkbox checked={filterUnits.includes(unit.unit_id)} size="small" />
                      <ListItemText primary={unit.unit_name || unit.unit_id} />
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <FormControl size="small" variant="outlined" sx={FILTER_SELECT_SX}>
                <InputLabel id="risk-analysis-business-process-label" shrink>Business Process</InputLabel>
                <Select
                  labelId="risk-analysis-business-process-label"
                  multiple
                  value={filterBusinessProcesses}
                  label="Business Process"
                  displayEmpty
                  notched
                  onChange={resetPageForFilterChange(setFilterBusinessProcesses)}
                  renderValue={(selected) => renderFilterValue(getSelectedFilterLabel(selected, businessProcessOptions))}
                >
                  {businessProcessOptions.map((option) => (
                    <MenuItem key={option} value={option}>
                      <Checkbox checked={filterBusinessProcesses.includes(option)} size="small" />
                      <ListItemText primary={option} />
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <FormControl size="small" variant="outlined" sx={FILTER_SELECT_SX}>
                <InputLabel id="risk-analysis-financial-year-label" shrink>Financial Year</InputLabel>
                <Select
                  labelId="risk-analysis-financial-year-label"
                  multiple
                  value={filterFinancialYears}
                  label="Financial Year"
                  displayEmpty
                  notched
                  onChange={resetPageForFilterChange(setFilterFinancialYears)}
                  renderValue={(selected) => renderFilterValue(getSelectedFilterLabel(selected, financialYearOptions))}
                >
                  {financialYearOptions.map((option) => (
                    <MenuItem key={option} value={option}>
                      <Checkbox checked={filterFinancialYears.includes(option)} size="small" />
                      <ListItemText primary={option} />
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <Button
                variant="contained"
                color="secondary"
                onClick={handleGenerateSelectedAnalyses}
                disabled={batchGenerating || selectedControlNumbers.size === 0}
                sx={{
                  height: FILTER_CONTROL_HEIGHT,
                  whiteSpace: 'nowrap',
                  px: 2,
                }}
              >
                {batchGenerating ? 'Generating...' : `Generate Selected (${selectedControlNumbers.size})`}
              </Button>
          </Box>
          <Typography variant="body2" sx={{ mt: 0.75, color: theme.palette.text.secondary }}>
            Showing {rows.length} of {totalCount} assigned-unit controls for the selected filters.
          </Typography>
        </Box>

        <Box sx={{ width: '100%', overflowX: 'auto', userSelect: 'none' }}>
          <Box sx={{ minWidth: 900 }}>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: TABLE_GRID_COLUMNS,
                borderBottom: `1px solid ${theme.palette.divider}`,
                backgroundColor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.03)' : theme.palette.grey[100],
              }}
            >
              {['', 'Control Number', 'Unit', 'Business Process', 'Financial Year', 'Sub Process', 'Risk Description'].map((column, index) => (
                <Box
                  key={column || 'select-all'}
                  sx={{
                    px: index === 0 ? 0.5 : 2,
                    py: 1.75,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: index === 0 ? 'center' : 'flex-start',
                    borderRight: `1px solid ${theme.palette.divider}`,
                    '&:last-of-type': {
                      borderRight: 'none',
                    },
                  }}
                >
                  {index === 0 ? (
                    <Checkbox
                      size="small"
                      checked={allPageControlsSelected}
                      indeterminate={somePageControlsSelected}
                      onChange={togglePageSelection}
                      sx={{ p: 0.5 }}
                    />
                  ) : (
                    <Typography variant="body2" sx={{ fontWeight: 700, color: theme.palette.text.primary }}>
                      {column}
                    </Typography>
                  )}
                </Box>
              ))}
            </Box>

            {loading ? (
              <Box sx={{ px: 3, py: 4 }}>
                <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>
                  Loading risk analysis controls...
                </Typography>
              </Box>
            ) : rows.length === 0 ? (
              <Box sx={{ px: 3, py: 4 }}>
                <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>
                  No controls found for the selected filters.
                </Typography>
              </Box>
            ) : (
              rows.map((row, index) => {
                const controlNumber = String(getFieldValue(row, 'control_number', 'controlNumber') || '').trim()
                const isSelected = selectedControlNumbers.has(controlNumber)

                return (
                <Box
                  key={String(getFieldValue(row, 'form_id', 'formId') || getFieldValue(row, 'control_number', 'controlNumber') || index)}
                  component="button"
                  type="button"
                  onClick={() => handleOpenAnalysisDialog(row)}
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: TABLE_GRID_COLUMNS,
                    borderBottom: index === rows.length - 1 ? 'none' : `1px solid ${theme.palette.divider}`,
                    backgroundColor: index % 2 === 0
                      ? 'transparent'
                      : theme.palette.mode === 'dark'
                        ? 'rgba(255,255,255,0.02)'
                        : theme.palette.grey[50],
                    borderLeft: 'none',
                    borderRight: 'none',
                    borderTop: 'none',
                    width: '100%',
                    textAlign: 'left',
                    font: 'inherit',
                    cursor: 'pointer',
                    '&:hover': {
                      backgroundColor: theme.palette.mode === 'dark' ? 'rgba(59,130,246,0.10)' : 'rgba(59,130,246,0.05)',
                    },
                  }}
                >
                  <Box
                    sx={{
                      px: 0.5,
                      py: 1.25,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRight: `1px solid ${theme.palette.divider}`,
                    }}
                  >
                    <Checkbox
                      size="small"
                      checked={isSelected}
                      onClick={(event) => {
                        event.stopPropagation()
                        if (event.shiftKey) {
                          event.preventDefault()
                          toggleControlSelection(controlNumber, event)
                        }
                      }}
                      onChange={(event) => {
                        if (event.nativeEvent.shiftKey || event.shiftKey) return
                        toggleControlSelection(controlNumber, event)
                      }}
                      disabled={!controlNumber || batchGenerating}
                      sx={{ p: 0.5 }}
                    />
                  </Box>
                  <Box sx={{ px: 2, py: 1.75, borderRight: `1px solid ${theme.palette.divider}` }}>
                    <Tooltip
                      title={String(getFieldValue(row, 'control_number', 'controlNumber') || '').trim() || 'Unassigned'}
                      arrow
                    >
                      <Typography
                        variant="body2"
                        sx={{ color: theme.palette.text.primary, fontWeight: 600, ...TABLE_TEXT_TRUNCATE_SX }}
                      >
                        {String(getFieldValue(row, 'control_number', 'controlNumber') || '').trim() || 'Unassigned'}
                      </Typography>
                    </Tooltip>
                  </Box>
                  <Box sx={{ px: 2, py: 1.75, borderRight: `1px solid ${theme.palette.divider}` }}>
                    <Tooltip title={String(getFieldValue(row, 'unit_name', 'unitName') || getFieldValue(row, 'unit_id', 'unitId') || '').trim() || 'Unassigned'} arrow>
                      <Typography variant="body2" sx={{ color: theme.palette.text.primary, fontWeight: 500, ...TABLE_TEXT_TRUNCATE_SX }}>
                        {String(getFieldValue(row, 'unit_name', 'unitName') || getFieldValue(row, 'unit_id', 'unitId') || '').trim() || 'Unassigned'}
                      </Typography>
                    </Tooltip>
                  </Box>
                  <Box sx={{ px: 2, py: 1.75, borderRight: `1px solid ${theme.palette.divider}` }}>
                    <Tooltip title={String(getFieldValue(row, 'business_process', 'businessProcess') || '').trim() || 'Unassigned'} arrow>
                      <Typography variant="body2" sx={{ color: theme.palette.text.primary, fontWeight: 500, ...TABLE_TEXT_TRUNCATE_SX }}>
                        {String(getFieldValue(row, 'business_process', 'businessProcess') || '').trim() || 'Unassigned'}
                      </Typography>
                    </Tooltip>
                  </Box>
                  <Box sx={{ px: 2, py: 1.75, borderRight: `1px solid ${theme.palette.divider}` }}>
                    <Tooltip title={String(getFieldValue(row, 'financial_year', 'financialYear') || '').trim() || 'Unassigned'} arrow>
                      <Typography variant="body2" sx={{ color: theme.palette.text.primary, fontWeight: 500, ...TABLE_TEXT_TRUNCATE_SX }}>
                        {String(getFieldValue(row, 'financial_year', 'financialYear') || '').trim() || 'Unassigned'}
                      </Typography>
                    </Tooltip>
                  </Box>
                  <Box sx={{ px: 2, py: 1.75, borderRight: `1px solid ${theme.palette.divider}` }}>
                    <Tooltip
                      title={String(getFieldValue(row, 'sub_process', 'subProcess') || '').trim() || 'Unassigned'}
                      arrow
                    >
                      <Typography
                        variant="body2"
                        sx={{ color: theme.palette.text.primary, fontWeight: 500, ...TABLE_TEXT_TRUNCATE_SX }}
                      >
                        {String(getFieldValue(row, 'sub_process', 'subProcess') || '').trim() || 'Unassigned'}
                      </Typography>
                    </Tooltip>
                  </Box>
                  <Box sx={{ px: 2, py: 1.75 }}>
                    <Tooltip
                      title={String(getFieldValue(row, 'risk_description', 'riskDescription') || '').trim() || 'Not available'}
                      arrow
                    >
                      <Typography
                        variant="body2"
                        sx={{ color: theme.palette.text.primary, fontWeight: 500, ...TABLE_TEXT_TRUNCATE_SX }}
                      >
                        {String(getFieldValue(row, 'risk_description', 'riskDescription') || '').trim() || 'Not available'}
                      </Typography>
                    </Tooltip>
                  </Box>
                </Box>
              )})
            )}
          </Box>
        </Box>
        <TablePagination
          component="div"
          count={totalCount}
          page={page}
          onPageChange={(event, nextPage) => {
            lastSelectedIndexRef.current = null
            setPage(nextPage)
          }}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={(event) => {
            lastSelectedIndexRef.current = null
            setRowsPerPage(Number.parseInt(event.target.value, 10))
            setPage(0)
            setSelectedControlNumbers(new Set())
          }}
          rowsPerPageOptions={[10, 25, 50]}
        />
      </Paper>

      <Dialog
        open={analysisDialogOpen}
        onClose={handleCloseDialog}
        fullWidth
        maxWidth="md"
      >
        <DialogTitle
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 1,
          }}
        >
          <Typography variant="h6" sx={{ fontWeight: 700, color: theme.palette.text.primary }}>
            {`Risk Analysis - ${
              String(
                analysisData?.control?.control_number
                || getFieldValue(selectedControl, 'control_number', 'controlNumber')
                || ''
              ).trim() || '—'
            }`}
          </Typography>
          <Button
            size="small"
            variant="text"
            onClick={handleOpenControlInNewWindow}
            endIcon={<ArrowOutwardRoundedIcon sx={{ fontSize: 16 }} />}
            sx={{
              fontSize: theme.typography.body2.fontSize,
              whiteSpace: 'nowrap',
            }}
          >
            Open RACM
          </Button>
        </DialogTitle>
        <DialogContent dividers>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            <Box
              sx={{
                display: 'flex',
                alignItems: { xs: 'flex-start', sm: 'center' },
                justifyContent: 'space-between',
                gap: 1,
                flexDirection: { xs: 'column', sm: 'row' },
              }}
            >
              {analysisGeneratedAt ? (
                <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>
                  Last generated: {analysisGeneratedAt}
                </Typography>
              ) : <Box />}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
                {analysisData?.analysis?.response_json ? (
                  <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>
                    Confidence: {analysisData.analysis.response_json.matchConfidence || 'N/A'}
                  </Typography>
                ) : null}
              </Box>
            </Box>
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                gap: 1.5,
              }}
            >
              {analysisLoading ? (
                <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>
                  Loading stored risk analysis...
                </Typography>
              ) : renderAnalysisResponse()}
            </Box>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={handleCloseDialog} disabled={analysisGenerating}>
            Close
          </Button>
          <Button
            variant="contained"
            color="secondary"
            onClick={handleGenerateAnalysis}
            disabled={analysisLoading || analysisGenerating || !selectedControl}
          >
            {analysisGenerating ? 'Generating…' : 'Generate Risk Analysis'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

export default RiskAnalysis
