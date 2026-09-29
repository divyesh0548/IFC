import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
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
import Chip from '@mui/material/Chip'
import ArrowOutwardRoundedIcon from '@mui/icons-material/ArrowOutwardRounded'
import { useTheme } from '@mui/material/styles'
import { apiUrl } from '../../config/api'
import { useSyncGlobalLoading } from '../../contexts/GlobalLoadingContext'
import { DASHBOARD_PAGE_OUTER_SX, DASHBOARD_PAPER_SX, PAGE_SUBHEADER_TEXT_SX } from '../../uiConstants'
import { toast } from 'react-hot-toast'
import { downloadKeyManualReportPdf } from '../../utils/aiInsightReportPdf'
import {
  businessProcessesForUnits,
  financialYearsForScope,
  keepAllowed,
  normalizeScopeRows,
} from '../../utils/controlScopeFilters'

const TABLE_GRID_COLUMNS = '56px 150px 160px 180px 200px 120px minmax(240px, 1fr)'
const FILTER_CONTROL_HEIGHT = 40
const FILTER_SELECT_SX = {
  minWidth: { xs: '100%', sm: 200 },
  maxWidth: { xs: '100%', sm: 240 },
  height: FILTER_CONTROL_HEIGHT,
  '& .MuiInputBase-root': { height: FILTER_CONTROL_HEIGHT },
  '& .MuiSelect-select': {
    display: 'flex',
    alignItems: 'center',
    py: 0,
    height: FILTER_CONTROL_HEIGHT,
    boxSizing: 'border-box',
  },
}

const AUTOMATION_FIELD_LABELS = [
  'Current manual activity',
  'Automation opportunity',
  'Proposed solution',
  'Benefit',
  'Dependency',
  'Residual risk or limitation',
]

function parseAutomationOpportunity(text) {
  const raw = String(text || '').replace(/\r\n/g, '\n').trim()
  const hasKnownOpening = AUTOMATION_FIELD_LABELS.some((label) => raw.startsWith(`${label}\n`))
  if (!hasKnownOpening) return null
  const labelPattern = AUTOMATION_FIELD_LABELS
    .map((label) => label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('|')
  return raw
    .split(new RegExp(`\\n(?=(?:${labelPattern})\\n)`))
    .map((part) => {
      const newline = part.indexOf('\n')
      if (newline === -1) return null
      const label = part.slice(0, newline).trim()
      const value = part.slice(newline + 1).trim()
      if (!AUTOMATION_FIELD_LABELS.includes(label) || !value) return null
      return { label, value }
    })
    .filter(Boolean)
}

function AutomationOpportunityFields({ text }) {
  const raw = String(text || '').trim()
  const sections = parseAutomationOpportunity(raw)
  if (!sections || sections.length === 0) {
    return (
      <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.55 }}>
        {raw || 'Summary is empty.'}
      </Typography>
    )
  }
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
      {sections.map((section) => (
        <Box key={section.label}>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontWeight: 700, lineHeight: 1.3 }}>
            {section.label}
          </Typography>
          <Typography variant="body2" sx={{ mt: 0.25, whiteSpace: 'pre-wrap', lineHeight: 1.55 }}>
            {section.value}
          </Typography>
        </Box>
      ))}
    </Box>
  )
}

function downloadDryRunPrompt(text, filename) {
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

function parseUnitIdsFromSearchParams(searchParams) {
  const values = [
    ...searchParams.getAll('unit_ids'),
    ...(searchParams.get('unit_id') ? [searchParams.get('unit_id')] : []),
  ]
  return [...new Set(values.map((value) => String(value || '').trim()).filter(Boolean))]
}

function getSelectedFilterLabel(selected) {
  if (!Array.isArray(selected) || selected.length === 0) return 'All'
  if (selected.length === 1) return selected[0]
  return `${selected.length} selected`
}

function renderFilterValue(label) {
  return (
    <Typography component="span" variant="body2" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
      {label}
    </Typography>
  )
}

function KeyManualAiInsightsSummary() {
  const theme = useTheme()
  const [searchParams] = useSearchParams()
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [rows, setRows] = useState([])
  const [unitOptions, setUnitOptions] = useState([])
  const [scopeRows, setScopeRows] = useState([])
  const [filterUnits, setFilterUnits] = useState(() => parseUnitIdsFromSearchParams(searchParams))
  const [filterBusinessProcesses, setFilterBusinessProcesses] = useState([])
  const [filterFinancialYears, setFilterFinancialYears] = useState([])
  const [filterGenerationStatus, setFilterGenerationStatus] = useState('')
  const businessProcessOptions = useMemo(
    () => businessProcessesForUnits(scopeRows, filterUnits),
    [scopeRows, filterUnits]
  )
  const financialYearOptions = useMemo(
    () => financialYearsForScope(scopeRows, filterUnits, filterBusinessProcesses),
    [scopeRows, filterUnits, filterBusinessProcesses]
  )
  const [page, setPage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(10)
  const [totalCount, setTotalCount] = useState(0)
  const [selectedFormIds, setSelectedFormIds] = useState(new Set())
  const [selectionUnitId, setSelectionUnitId] = useState(null)
  const [errorMessage, setErrorMessage] = useState('')
  const [listTick, setListTick] = useState(0)
  const [regenConfirmOpen, setRegenConfirmOpen] = useState(false)
  const [pendingGenerate, setPendingGenerate] = useState(null)
  const [reportOpen, setReportOpen] = useState(false)
  const [reportLoading, setReportLoading] = useState(false)
  const [reportData, setReportData] = useState(null)
  const rowMetaRef = useRef(new Map())
  const summaryGeneratedRef = useRef(new Map())
  const lastSelectedIndexRef = useRef(null)

  useSyncGlobalLoading(loading || generating)

  rows.forEach((row) => {
    const formId = String(row.form_id || '').trim()
    if (formId) {
      rowMetaRef.current.set(formId, row)
      summaryGeneratedRef.current.set(formId, Boolean(row.has_summary))
    }
  })

  const generatedSelectionCount = useMemo(() => {
    let count = 0
    selectedFormIds.forEach((id) => {
      if (summaryGeneratedRef.current.get(id)) count += 1
    })
    return count
  }, [selectedFormIds, rows])

  const pageFormIds = useMemo(
    () => rows.map((row) => String(row.form_id || '').trim()).filter(Boolean),
    [rows]
  )
  const selectedOnPageCount = pageFormIds.filter((id) => selectedFormIds.has(id)).length
  const allPageSelected = pageFormIds.length > 0 && selectedOnPageCount === pageFormIds.length

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
        filterBusinessProcesses.forEach((value) => params.append('business_processes', value))
        filterFinancialYears.forEach((value) => params.append('financial_years', value))
        if (filterGenerationStatus) params.set('generation_status', filterGenerationStatus)

        const response = await fetch(apiUrl(`/api/company-co/ai-insights/key-manual-summary?${params}`), {
          credentials: 'include',
        })
        const data = await response.json()
        if (!response.ok || !data?.success) throw new Error(data?.message || 'Failed to load controls')
        if (cancelled) return
        setRows(Array.isArray(data.data) ? data.data : [])
        setTotalCount(Number(data.count || 0))
        setUnitOptions(Array.isArray(data.filters?.units) ? data.filters.units : [])
        setScopeRows(normalizeScopeRows(data.filters?.scope_rows))
      } catch (error) {
        if (!cancelled) {
          setRows([])
          setTotalCount(0)
          setErrorMessage(error.message || 'Failed to load controls')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetchData()
    return () => {
      cancelled = true
    }
  }, [page, rowsPerPage, filterUnits, filterBusinessProcesses, filterFinancialYears, filterGenerationStatus, listTick])

  const clearSelection = () => {
    setSelectedFormIds(new Set())
    setSelectionUnitId(null)
    lastSelectedIndexRef.current = null
  }

  const toggleRow = (formId, unitId, index, shiftKey) => {
    const unit = String(unitId || '').trim()
    setSelectedFormIds((prev) => {
      const next = new Set(prev)
      if (shiftKey && lastSelectedIndexRef.current != null) {
        const start = Math.min(lastSelectedIndexRef.current, index)
        const end = Math.max(lastSelectedIndexRef.current, index)
        const rangeRows = rows.slice(start, end + 1)
        const rangeUnit = String(rangeRows[0]?.unit_id || '').trim()
        if (rangeRows.some((row) => String(row.unit_id || '').trim() !== rangeUnit)) {
          toast.error('Selection must stay within a single unit')
          return prev
        }
        if (selectionUnitId && selectionUnitId !== rangeUnit) {
          toast.error('Clear selection before choosing another unit')
          return prev
        }
        rangeRows.forEach((row) => {
          const id = String(row.form_id || '').trim()
          if (id) next.add(id)
        })
        setSelectionUnitId(rangeUnit)
      } else if (next.has(formId)) {
        next.delete(formId)
        if (next.size === 0) setSelectionUnitId(null)
      } else {
        if (selectionUnitId && selectionUnitId !== unit) {
          toast.error('Select controls from one unit only')
          return prev
        }
        next.add(formId)
        setSelectionUnitId(unit)
      }
      return next
    })
    lastSelectedIndexRef.current = index
  }

  const runGenerate = async ({ formIds, regenerateExisting }) => {
    setGenerating(true)
    setRegenConfirmOpen(false)
    setPendingGenerate(null)
    try {
      const availabilityResponse = await fetch(apiUrl('/api/company-co/ai-insights/key-manual-summary/availability'), {
        credentials: 'include',
      })
      const availabilityData = await availabilityResponse.json()
      if (!availabilityResponse.ok || !availabilityData?.success || !availabilityData?.data?.reachable) {
        toast('AI Summary API is not reachable')
        return
      }

      const response = await fetch(apiUrl('/api/company-co/ai-insights/key-manual-summary/generate'), {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          form_ids: formIds,
          regenerate_existing: regenerateExisting,
        }),
      })
      const data = await response.json()
      if (response.status === 409) {
        toast('LLM Server is busy, Try again after some moments')
        return
      }
      if (!response.ok || !data?.success) throw new Error(data?.message || 'Failed to generate AI summary')
      if (data.data?.dry_run) {
        if (data.data.dry_run_txt) {
          downloadDryRunPrompt(data.data.dry_run_txt, 'automation_opportunity_dry_run.txt')
        }
        toast.success('Dry run: the prompt file was downloaded. The model was not called.')
        return
      }
      const generated = Number(data.data?.generated || 0)
      const skipped = Number(data.data?.skipped || 0)
      toast.success(`Summary generated for ${generated} control${generated === 1 ? '' : 's'}${skipped ? `. Skipped ${skipped} existing.` : '.'}`)
      clearSelection()
      setListTick((value) => value + 1)
    } catch (error) {
      toast.error(error.message || 'Failed to generate AI summary')
    } finally {
      setGenerating(false)
    }
  }

  const handleGenerateSelected = async () => {
    const selectedRows = [...selectedFormIds].map((id) => rowMetaRef.current.get(id)).filter(Boolean)
    if (selectedRows.length === 0) {
      toast.error('Select at least one control')
      return
    }
    const formIds = selectedRows.map((row) => String(row.form_id || '').trim()).filter(Boolean)
    const existingCount = selectedRows.filter((row) => row.has_summary).length
    if (existingCount > 0) {
      setPendingGenerate({
        formIds,
        existingCount,
        pendingCount: selectedRows.length - existingCount,
      })
      setRegenConfirmOpen(true)
      return
    }
    await runGenerate({ formIds, regenerateExisting: false })
  }

  const openControlWindow = (formId) => {
    const normalizedFormId = String(formId || '').trim()
    if (!normalizedFormId) {
      toast.error('Form ID is not available for this control')
      return
    }
    window.open(`/company-co/form/${encodeURIComponent(normalizedFormId)}`, '_blank', 'noopener,noreferrer')
  }

  const openSelectedReports = async () => {
    const formIds = [...selectedFormIds].filter((id) => summaryGeneratedRef.current.get(id))
    if (formIds.length === 0) return
    setReportLoading(true)
    setReportData(null)
    setReportOpen(true)
    try {
      const params = new URLSearchParams()
      formIds.forEach((id) => params.append('form_ids', id))
      const response = await fetch(apiUrl(`/api/company-co/ai-insights/key-manual-summary/report?${params}`), {
        credentials: 'include',
      })
      const data = await response.json()
      if (!response.ok || !data?.success) throw new Error(data?.message || 'Failed to load report')
      setReportData(data.data)
    } catch (error) {
      setReportOpen(false)
      toast.error(error.message || 'Failed to load report')
    } finally {
      setReportLoading(false)
    }
  }

  return (
    <Box sx={DASHBOARD_PAGE_OUTER_SX}>
      <Paper sx={{ ...DASHBOARD_PAPER_SX, p: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 700 }}>
          Key + Manual AI Insights
        </Typography>
        <Typography variant="body2" sx={{ ...PAGE_SUBHEADER_TEXT_SX, mt: 0.75 }}>
          Key and manual controls only. Select controls from one unit and generate a summary. Generating again replaces the saved summary for that control.
        </Typography>

        {errorMessage && (
          <Alert severity="error" sx={{ mt: 2 }}>{errorMessage}</Alert>
        )}

        <Box sx={{ mt: 2.5, position: 'relative', display: 'flex', flexWrap: 'wrap', gap: 1.5, alignItems: 'center' }}>
          <FormControl size="small" sx={FILTER_SELECT_SX}>
            <InputLabel>Unit</InputLabel>
            <Select
              multiple
              label="Unit"
              value={filterUnits}
              onChange={(event) => {
                const nextUnits = typeof event.target.value === 'string' ? event.target.value.split(',') : event.target.value
                const nextBps = keepAllowed(filterBusinessProcesses, businessProcessesForUnits(scopeRows, nextUnits))
                setFilterUnits(nextUnits)
                setFilterBusinessProcesses(nextBps)
                setFilterFinancialYears(keepAllowed(filterFinancialYears, financialYearsForScope(scopeRows, nextUnits, nextBps)))
                setPage(0)
                clearSelection()
              }}
              renderValue={(selected) => renderFilterValue(getSelectedFilterLabel(
                selected.map((id) => unitOptions.find((unit) => unit.unit_id === id)?.unit_name || id)
              ))}
            >
              {unitOptions.map((unit) => (
                <MenuItem key={unit.unit_id} value={unit.unit_id}>
                  <Checkbox checked={filterUnits.includes(unit.unit_id)} size="small" />
                  <ListItemText primary={unit.unit_name || unit.unit_id} />
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl size="small" sx={FILTER_SELECT_SX} disabled={filterUnits.length === 0}>
            <InputLabel>Business Process</InputLabel>
            <Select
              multiple
              label="Business Process"
              value={filterBusinessProcesses}
              onChange={(event) => {
                const nextBps = typeof event.target.value === 'string' ? event.target.value.split(',') : event.target.value
                setFilterBusinessProcesses(nextBps)
                setFilterFinancialYears(keepAllowed(filterFinancialYears, financialYearsForScope(scopeRows, filterUnits, nextBps)))
                setPage(0)
                clearSelection()
              }}
              renderValue={(selected) => renderFilterValue(getSelectedFilterLabel(selected))}
            >
              {businessProcessOptions.map((value) => (
                <MenuItem key={value} value={value}>
                  <Checkbox checked={filterBusinessProcesses.includes(value)} size="small" />
                  <ListItemText primary={value} />
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl size="small" sx={FILTER_SELECT_SX} disabled={filterBusinessProcesses.length === 0}>
            <InputLabel>Financial Year</InputLabel>
            <Select
              multiple
              label="Financial Year"
              value={filterFinancialYears}
              onChange={(event) => {
                setFilterFinancialYears(typeof event.target.value === 'string' ? event.target.value.split(',') : event.target.value)
                setPage(0)
                clearSelection()
              }}
              renderValue={(selected) => renderFilterValue(getSelectedFilterLabel(selected))}
            >
              {financialYearOptions.map((value) => (
                <MenuItem key={value} value={value}>
                  <Checkbox checked={filterFinancialYears.includes(value)} size="small" />
                  <ListItemText primary={value} />
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl size="small" sx={FILTER_SELECT_SX}>
            <InputLabel>Generation</InputLabel>
            <Select
              label="Generation"
              value={filterGenerationStatus}
              onChange={(event) => {
                setFilterGenerationStatus(event.target.value)
                setPage(0)
                clearSelection()
              }}
            >
              <MenuItem value="">All</MenuItem>
              <MenuItem value="generated">Generated</MenuItem>
              <MenuItem value="not_generated">Not Generated</MenuItem>
            </Select>
          </FormControl>

          <Box sx={{ flex: 1 }} />

          {generatedSelectionCount > 0 && (
            <Button variant="outlined" disabled={reportLoading} onClick={openSelectedReports}>
              See Reports ({generatedSelectionCount})
            </Button>
          )}
          <Button
            variant="contained"
            disabled={selectedFormIds.size === 0 || generating}
            onClick={handleGenerateSelected}
          >
            {generating ? 'Generating…' : `Generate Selected (${selectedFormIds.size})`}
          </Button>
          <Typography
            variant="caption"
            sx={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: '100%',
              mt: 0.25,
              height: 16,
              lineHeight: '16px',
              color: 'text.secondary',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              visibility: selectionUnitId ? 'visible' : 'hidden',
            }}
          >
            Selection locked to one unit.
          </Typography>
        </Box>

        <Box sx={{ mt: 2.5, border: `1px solid ${theme.palette.divider}`, borderRadius: 2, overflow: 'hidden' }}>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: TABLE_GRID_COLUMNS,
              gap: 1,
              px: 1.5,
              py: 1,
              borderBottom: `1px solid ${theme.palette.divider}`,
              alignItems: 'center',
            }}
          >
            <Checkbox
              size="small"
              checked={allPageSelected}
              indeterminate={selectedOnPageCount > 0 && !allPageSelected}
              onChange={() => {
                if (allPageSelected) {
                  setSelectedFormIds((prev) => {
                    const next = new Set(prev)
                    pageFormIds.forEach((id) => next.delete(id))
                    if (next.size === 0) setSelectionUnitId(null)
                    return next
                  })
                  return
                }
                const pageUnits = [...new Set(rows.map((row) => String(row.unit_id || '').trim()).filter(Boolean))]
                if (pageUnits.length > 1) {
                  toast.error('This page has multiple units — select rows from one unit only')
                  return
                }
                if (selectionUnitId && pageUnits[0] && selectionUnitId !== pageUnits[0]) {
                  toast.error('Clear selection before choosing another unit')
                  return
                }
                setSelectedFormIds((prev) => {
                  const next = new Set(prev)
                  pageFormIds.forEach((id) => next.add(id))
                  return next
                })
                if (pageUnits[0]) setSelectionUnitId(pageUnits[0])
              }}
            />
            <Typography variant="caption" fontWeight={700}>Control</Typography>
            <Typography variant="caption" fontWeight={700}>Summary</Typography>
            <Typography variant="caption" fontWeight={700}>Unit</Typography>
            <Typography variant="caption" fontWeight={700}>Business Process</Typography>
            <Typography variant="caption" fontWeight={700}>FY</Typography>
            <Typography variant="caption" fontWeight={700}>Risk</Typography>
          </Box>

          {rows.length === 0 && !loading ? (
            <Box sx={{ p: 3 }}>
              <Typography color="text.secondary">No key manual controls found for the current filters.</Typography>
            </Box>
          ) : rows.map((row, index) => {
            const formId = String(row.form_id || '').trim()
            const checked = selectedFormIds.has(formId)
            return (
              <Box
                key={formId || index}
                sx={{
                  display: 'grid',
                  gridTemplateColumns: TABLE_GRID_COLUMNS,
                  gap: 1,
                  px: 1.5,
                  py: 1.1,
                  alignItems: 'center',
                  borderBottom: `1px solid ${theme.palette.divider}`,
                }}
              >
                <Checkbox
                  size="small"
                  checked={checked}
                  onClick={(event) => {
                    event.stopPropagation()
                    toggleRow(formId, row.unit_id, index, event.shiftKey)
                  }}
                />
                <Typography variant="body2" sx={{ fontWeight: 600 }}>{row.control_number || '—'}</Typography>
                <Box>
                  <Chip
                    size="small"
                    label={row.has_summary ? 'Generated' : 'Not generated'}
                    color={row.has_summary ? 'success' : 'default'}
                    variant={row.has_summary ? 'filled' : 'outlined'}
                  />
                </Box>
                <Typography variant="body2" noWrap>{row.unit_name || '—'}</Typography>
                <Typography variant="body2" noWrap>{row.business_process || '—'}</Typography>
                <Typography variant="body2" noWrap>{row.financial_year || '—'}</Typography>
                <Typography variant="body2" noWrap color="text.secondary">{row.risk_description || '—'}</Typography>
              </Box>
            )
          })}
        </Box>

        <TablePagination
          component="div"
          count={totalCount}
          page={page}
          onPageChange={(_event, next) => setPage(next)}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={(event) => {
            setRowsPerPage(Number.parseInt(event.target.value, 10))
            setPage(0)
          }}
          rowsPerPageOptions={[10, 25, 50]}
        />
      </Paper>

      <Dialog open={reportOpen} onClose={() => !reportLoading && setReportOpen(false)} fullWidth maxWidth="lg">
        <DialogTitle>Key + Manual Report</DialogTitle>
        <DialogContent>
          {reportLoading ? (
            <Typography variant="body2" color="text.secondary">Loading report...</Typography>
          ) : (
            <Box>
              <Typography variant="body2" color="text.secondary">
                {String(reportData?.meta?.company_name || '').trim() || '—'}
                {' | '}
                {String(reportData?.meta?.unit_name || '').trim() || '—'}
              </Typography>
              {reportData?.meta?.business_process ? (
                <Typography variant="subtitle1" fontWeight={700} sx={{ mt: 0.5 }}>
                  {reportData.meta.business_process}
                </Typography>
              ) : null}
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ display: 'block', mt: 0.5, pb: 1.5, borderBottom: `1px solid ${theme.palette.divider}` }}
              >
                Controls reviewed: {Number(reportData?.meta?.controls_reviewed || reportData?.controls?.length || 0)}
              </Typography>
              <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                {(reportData?.controls || []).map((control) => (
                  <Box
                    key={control.form_id}
                    sx={{
                      p: 1.75,
                      border: `1px solid ${theme.palette.divider}`,
                      borderRadius: '10px',
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, mb: 1 }}>
                      <Typography variant="body2" fontWeight={700}>
                        {control.control_number || '—'}
                      </Typography>
                      <Button
                        size="small"
                        variant="text"
                        onClick={() => openControlWindow(control.form_id)}
                        endIcon={<ArrowOutwardRoundedIcon sx={{ fontSize: 16 }} />}
                        sx={{ whiteSpace: 'nowrap' }}
                      >
                        Open control
                      </Button>
                    </Box>
                    <AutomationOpportunityFields text={control.rationalisation_opportunity} />
                  </Box>
                ))}
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button
            variant="outlined"
            disabled={!reportData || reportLoading}
            onClick={() => {
              try {
                downloadKeyManualReportPdf(reportData)
                toast.success('PDF downloaded')
              } catch (error) {
                toast.error(error.message || 'Failed to export PDF')
              }
            }}
          >
            Export PDF
          </Button>
          <Button onClick={() => setReportOpen(false)} disabled={reportLoading}>Close</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={regenConfirmOpen} onClose={() => !generating && setRegenConfirmOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Regenerate summary?</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            Some selected controls already have a summary. Generating again replaces the saved summary for that control.
          </Typography>
          <Typography variant="body2" sx={{ mt: 1.5 }}>
            Already have summary: <strong>{Number(pendingGenerate?.existingCount || 0)}</strong>
          </Typography>
          <Typography variant="body2">
            Pending to generate: <strong>{Number(pendingGenerate?.pendingCount || 0)}</strong>
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRegenConfirmOpen(false)} disabled={generating}>Cancel</Button>
          <Button
            disabled={generating || Number(pendingGenerate?.pendingCount || 0) === 0}
            onClick={() => runGenerate({ formIds: pendingGenerate?.formIds || [], regenerateExisting: false })}
          >
            Skip existing
          </Button>
          <Button
            variant="contained"
            color="warning"
            disabled={generating}
            onClick={() => runGenerate({ formIds: pendingGenerate?.formIds || [], regenerateExisting: true })}
          >
            Regenerate all
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

export default KeyManualAiInsightsSummary
