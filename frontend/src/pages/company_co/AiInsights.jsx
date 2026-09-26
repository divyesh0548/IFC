import React, { useEffect, useMemo, useRef, useState } from 'react'
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
import Accordion from '@mui/material/Accordion'
import AccordionSummary from '@mui/material/AccordionSummary'
import AccordionDetails from '@mui/material/AccordionDetails'
import LinearProgress from '@mui/material/LinearProgress'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import { useTheme } from '@mui/material/styles'
import { apiUrl } from '../../config/api'
import { useSyncGlobalLoading } from '../../contexts/GlobalLoadingContext'
import { DASHBOARD_PAGE_OUTER_SX, DASHBOARD_PAPER_SX, PAGE_SUBHEADER_TEXT_SX } from '../../uiConstants'
import { getFieldValue } from './dashboardClassificationUtils'
import { toast } from 'react-hot-toast'
import {
  downloadDesignGapReportPdf,
  formatInsufficientCheckLine,
  getDesignGapSummaryCounts,
  humanizeCheckLabel,
} from '../../utils/designGapReportPdf'
import {
  businessProcessesForUnits,
  financialYearsForScope,
  keepAllowed,
  normalizeScopeRows,
} from '../../utils/controlScopeFilters'

const TABLE_GRID_COLUMNS = '56px 140px 160px 180px 200px 120px 140px minmax(280px, 1fr)'
const FILTER_CONTROL_HEIGHT = 40
const JOB_POLL_MS = 2000
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

function statusChip(status) {
  const s = String(status || '').toLowerCase()
  if (s === 'good_design' || s === 'ok') {
    return <Chip size="small" icon={<CheckCircleOutlineIcon />} label={s === 'ok' ? 'OK' : 'Good design'} color="success" variant="outlined" />
  }
  if (s === 'has_gaps' || s === 'flagged') {
    return <Chip size="small" icon={<ErrorOutlineIcon />} label={s === 'flagged' ? 'Flagged' : 'Gaps'} color="error" variant="outlined" />
  }
  return <Chip size="small" icon={<InfoOutlinedIcon />} label="Insufficient data" color="warning" variant="outlined" />
}

const SHOW_DESIGN_GAP_USAGE = import.meta.env.DEV

function formatTokenCount(value) {
  if (value == null || value === '') return '—'
  const count = Number(value)
  return Number.isFinite(count) ? count.toLocaleString() : '—'
}

function isJobActive(job) {
  const status = String(job?.status || '').toLowerCase()
  return status === 'pending' || status === 'running'
}

function AiInsights() {
  const theme = useTheme()
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState([])
  const [unitOptions, setUnitOptions] = useState([])
  const [scopeRows, setScopeRows] = useState([])
  const [filterUnits, setFilterUnits] = useState([])
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
  const [apiReachable, setApiReachable] = useState(null)
  const [pendingGenerateMode, setPendingGenerateMode] = useState(null)
  const [activeJob, setActiveJob] = useState(null)
  const [jobJustCompleted, setJobJustCompleted] = useState(false)

  const [reportsOpen, setReportsOpen] = useState(false)
  const [reportUnitId, setReportUnitId] = useState('')
  const [reportBp, setReportBp] = useState('')
  const [reportFy, setReportFy] = useState('')
  const [reportScope, setReportScope] = useState(null)
  const [reportScopeLoading, setReportScopeLoading] = useState(false)
  const [reportData, setReportData] = useState(null)
  const [reportViewOpen, setReportViewOpen] = useState(false)
  const reportBusinessProcessOptions = useMemo(
    () => businessProcessesForUnits(scopeRows, reportUnitId ? [reportUnitId] : []),
    [scopeRows, reportUnitId]
  )
  const reportFinancialYearOptions = useMemo(
    () => financialYearsForScope(scopeRows, reportUnitId ? [reportUnitId] : [], reportBp ? [reportBp] : []),
    [scopeRows, reportUnitId, reportBp]
  )

  const openReports = () => {
    const unitId = filterUnits.length === 1 ? filterUnits[0] : ''
    const bpOptions = businessProcessesForUnits(scopeRows, unitId ? [unitId] : [])
    const bp = filterBusinessProcesses.length === 1 && bpOptions.includes(filterBusinessProcesses[0])
      ? filterBusinessProcesses[0]
      : ''
    const fyOptions = financialYearsForScope(scopeRows, unitId ? [unitId] : [], bp ? [bp] : [])
    const fy = filterFinancialYears.length === 1 && fyOptions.includes(filterFinancialYears[0])
      ? filterFinancialYears[0]
      : ''
    setReportUnitId(unitId)
    setReportBp(bp)
    setReportFy(fy)
    setReportScope(null)
    setReportData(null)
    setReportsOpen(true)
  }
  const [regenConfirmOpen, setRegenConfirmOpen] = useState(false)
  const [listTick, setListTick] = useState(0)

  const lastSelectedIndexRef = useRef(null)
  const insightGeneratedRef = useRef(new Map())
  const pollTimerRef = useRef(null)
  const reportsOpenRef = useRef(reportsOpen)
  const reportUnitIdRef = useRef(reportUnitId)
  const reportBpRef = useRef(reportBp)
  const reportFyRef = useRef(reportFy)
  reportsOpenRef.current = reportsOpen
  reportUnitIdRef.current = reportUnitId
  reportBpRef.current = reportBp
  reportFyRef.current = reportFy

  const jobRunning = isJobActive(activeJob)
  const reportFiltersReady = Boolean(reportUnitId && reportBp && reportFy)

  useSyncGlobalLoading(loading || reportScopeLoading)

  const pageFormIds = useMemo(
    () => rows.map((row) => String(getFieldValue(row, 'form_id', 'formId') || '').trim()).filter(Boolean),
    [rows]
  )

  rows.forEach((row) => {
    const id = String(row.form_id || '').trim()
    if (id) insightGeneratedRef.current.set(id, Boolean(row.has_design_gap_insight))
  })

  const selectedOnPageCount = pageFormIds.filter((id) => selectedFormIds.has(id)).length
  const generatedSelectionCount = useMemo(() => {
    let count = 0
    selectedFormIds.forEach((id) => {
      if (insightGeneratedRef.current.get(id)) count += 1
    })
    return count
  }, [selectedFormIds, rows])
  const allPageSelected = pageFormIds.length > 0 && selectedOnPageCount === pageFormIds.length

  const jobProgressPct = useMemo(() => {
    if (!activeJob?.total) return jobRunning ? 0 : 100
    return Math.min(100, Math.round((Number(activeJob.processed || 0) / Number(activeJob.total)) * 100))
  }, [activeJob, jobRunning])

  const stopPolling = () => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current)
      pollTimerRef.current = null
    }
  }

  const clearSelection = () => {
    setSelectedFormIds(new Set())
    setSelectionUnitId(null)
    lastSelectedIndexRef.current = null
  }

  const loadReportScope = async (overrides = {}) => {
    const unitId = overrides.unit_id ?? reportUnitIdRef.current
    const bp = overrides.business_process ?? reportBpRef.current
    const fy = overrides.financial_year ?? reportFyRef.current
    if (!unitId || !bp || !fy) return
    setReportScopeLoading(true)
    setReportScope(null)
    try {
      const params = new URLSearchParams({
        unit_id: unitId,
        business_process: bp,
        financial_year: fy,
      })
      const res = await fetch(apiUrl(`/api/company-co/ai-insights/design-gap/report-scope?${params}`), {
        credentials: 'include',
      })
      const data = await res.json()
      if (!res.ok || !data?.success) throw new Error(data?.message || 'Failed to load scope')
      setReportScope(data.data)
    } catch (error) {
      toast.error(error.message || 'Failed to load scope')
    } finally {
      setReportScopeLoading(false)
    }
  }

  const handleJobTerminal = async (job) => {
    stopPolling()
    setActiveJob(job)
    setJobJustCompleted(String(job?.status || '').toLowerCase() === 'completed')
    clearSelection()
    setListTick((t) => t + 1)
    if (reportsOpenRef.current && reportUnitIdRef.current && reportBpRef.current && reportFyRef.current) {
      await loadReportScope()
    }
    if (String(job?.status || '').toLowerCase() === 'completed') {
      if (job?.dry_run && job?.dry_run_txt) {
        try {
          const blob = new Blob([job.dry_run_txt], { type: 'text/plain;charset=utf-8' })
          const url = URL.createObjectURL(blob)
          const anchor = document.createElement('a')
          anchor.href = url
          anchor.download = `design_gap_dry_run_${job.job_id || 'prompts'}.txt`
          document.body.appendChild(anchor)
          anchor.click()
          anchor.remove()
          URL.revokeObjectURL(url)
          toast.success(job?.message || 'Dry-run prompts downloaded')
        } catch (error) {
          toast.error(error.message || 'Failed to download dry-run prompts')
        }
      } else {
        toast.success(job?.message || 'Design-gap job completed')
      }
    } else if (String(job?.status || '').toLowerCase() === 'failed') {
      toast.error(job?.message || 'Design-gap job failed')
    }
  }

  const startPollingJob = (jobId) => {
    stopPolling()
    const poll = async () => {
      try {
        const res = await fetch(apiUrl(`/api/company-co/ai-insights/design-gap/jobs/${jobId}`), {
          credentials: 'include',
        })
        const data = await res.json()
        if (!res.ok || !data?.success) return
        const job = data.data
        setActiveJob(job)
        if (!isJobActive(job)) {
          await handleJobTerminal(job)
        }
      } catch {
        // keep polling; transient network blips
      }
    }
    poll()
    pollTimerRef.current = setInterval(poll, JOB_POLL_MS)
  }

  useEffect(() => {
    let cancelled = false
    const checkAvailability = async () => {
      const maxAttempts = 3
      for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        try {
          const res = await fetch(apiUrl('/api/company-co/ai-insights/design-gap/availability'), {
            credentials: 'include',
          })
          const data = await res.json()
          const reachable = Boolean(data?.data?.reachable)
          if (cancelled) return
          if (reachable) {
            setApiReachable(true)
            return
          }
          if (attempt === maxAttempts) {
            setApiReachable(false)
            return
          }
        } catch {
          if (cancelled) return
          if (attempt === maxAttempts) {
            setApiReachable(false)
            return
          }
        }
        await new Promise((resolve) => setTimeout(resolve, 400 * attempt))
      }
    }
    checkAvailability()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(apiUrl('/api/company-co/ai-insights/design-gap/jobs/active'), {
          credentials: 'include',
        })
        const data = await res.json()
        if (cancelled || !data?.success || !data.data) return
        setActiveJob(data.data)
        setJobJustCompleted(false)
        if (isJobActive(data.data)) {
          toast('Design gap running…', { icon: '⏳' })
          startPollingJob(data.data.job_id)
        }
      } catch {
        // ignore
      }
    })()
    return () => {
      cancelled = true
      stopPolling()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
        filterUnits.forEach((u) => params.append('unit_ids', u))
        filterBusinessProcesses.forEach((bp) => params.append('business_processes', bp))
        filterFinancialYears.forEach((fy) => params.append('financial_years', fy))
        if (filterGenerationStatus) {
          params.set('generation_status', filterGenerationStatus)
        }

        const res = await fetch(apiUrl(`/api/company-co/ai-insights/design-gap/controls?${params}`), {
          credentials: 'include',
        })
        const data = await res.json()
        if (!res.ok || !data?.success) throw new Error(data?.message || 'Failed to load controls')
        if (cancelled) return
        setRows(Array.isArray(data.data) ? data.data : [])
        setTotalCount(Number(data.count || 0))
        setUnitOptions(data.filters?.units || [])
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

  const assertCanStartJob = () => {
    if (jobRunning) {
      toast.error('Previous job is running')
      return false
    }
    return true
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
        if (rangeRows.some((r) => String(r.unit_id || '').trim() !== rangeUnit)) {
          toast.error('Selection must stay within a single unit')
          return prev
        }
        if (selectionUnitId && selectionUnitId !== rangeUnit) {
          toast.error('Clear selection before choosing another unit')
          return prev
        }
        rangeRows.forEach((r) => {
          const id = String(r.form_id || '').trim()
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

  const toggleSelectAllPage = () => {
    if (allPageSelected) {
      setSelectedFormIds((prev) => {
        const next = new Set(prev)
        pageFormIds.forEach((id) => next.delete(id))
        if (next.size === 0) setSelectionUnitId(null)
        return next
      })
      return
    }
    const pageUnits = [...new Set(rows.map((r) => String(r.unit_id || '').trim()).filter(Boolean))]
    if (pageUnits.length > 1) {
      toast.error('This page has multiple units — select rows from one unit only')
      return
    }
    const pageUnit = pageUnits[0] || null
    if (selectionUnitId && pageUnit && selectionUnitId !== pageUnit) {
      toast.error('Clear selection before choosing another unit')
      return
    }
    setSelectedFormIds((prev) => {
      const next = new Set(prev)
      pageFormIds.forEach((id) => next.add(id))
      return next
    })
    if (pageUnit) setSelectionUnitId(pageUnit)
  }

  const runGenerate = async ({ formIds, regenerateExisting }) => {
    if (!assertCanStartJob()) return
    setJobJustCompleted(false)
    try {
      const res = await fetch(apiUrl('/api/company-co/ai-insights/design-gap/generate'), {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          form_ids: formIds,
          regenerate_existing: regenerateExisting,
        }),
      })
      const data = await res.json()
      if (res.status === 409 || data?.code === 'JOB_IN_PROGRESS') {
        toast.error(data?.message || 'Previous job is running')
        if (data?.data) {
          setActiveJob(data.data)
          if (isJobActive(data.data)) startPollingJob(data.data.job_id)
        }
        return
      }
      if (!res.ok || !data?.success) {
        throw new Error(data?.message || 'Generation failed')
      }
      const job = data.data
      if (!job?.job_id) {
        toast.success(job?.message || 'Nothing to generate')
        clearSelection()
        setListTick((t) => t + 1)
        if (reportsOpen && reportFiltersReady) await loadReportScope()
        return
      }
      setActiveJob(job)
      toast('Design gap running…', { icon: '⏳' })
      startPollingJob(job.job_id)
      clearSelection()
    } catch (error) {
      toast.error(error.message || 'Generation failed')
    } finally {
      setRegenConfirmOpen(false)
      setPendingGenerateMode(null)
    }
  }

  const handleGenerateSelected = async () => {
    if (!assertCanStartJob()) return
    const formIds = [...selectedFormIds]
    if (formIds.length === 0) {
      toast.error('Select at least one control')
      return
    }
    const selectedRows = rows.filter((r) => formIds.includes(String(r.form_id || '').trim()))
    const units = [...new Set(selectedRows.map((r) => String(r.unit_id || '').trim()).filter(Boolean))]
    if (units.length > 1) {
      toast.error('Selected controls must belong to one unit')
      return
    }
    const hasExisting = selectedRows.some((r) => r.has_design_gap_insight)
    if (hasExisting) {
      const existingCount = selectedRows.filter((r) => r.has_design_gap_insight).length
      const pendingCount = selectedRows.length - existingCount
      setPendingGenerateMode({ formIds, source: 'selection', existingCount, pendingCount })
      setRegenConfirmOpen(true)
      return
    }
    await runGenerate({ formIds, regenerateExisting: false })
  }

  useEffect(() => {
    if (reportsOpen && reportUnitId && reportBp && reportFy) {
      loadReportScope()
    } else if (reportsOpen) {
      setReportScope(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportsOpen, reportUnitId, reportBp, reportFy])

  const loadDesignGapReport = async (params) => {
    const res = await fetch(apiUrl(`/api/company-co/ai-insights/design-gap/report?${params}`), {
      credentials: 'include',
    })
    const data = await res.json()
    if (!res.ok || !data?.success) throw new Error(data?.message || 'Failed to load report')
    setReportData(data.data)
    setReportViewOpen(true)
  }

  const openReportView = async () => {
    try {
      const params = new URLSearchParams({
        unit_id: reportUnitId,
        business_process: reportBp,
        financial_year: reportFy,
      })
      await loadDesignGapReport(params)
    } catch (error) {
      toast.error(error.message || 'Failed to load report')
    }
  }

  const openSelectedReports = async () => {
    const formIds = [...selectedFormIds].filter((id) => insightGeneratedRef.current.get(id))
    if (formIds.length === 0) return
    try {
      const params = new URLSearchParams()
      formIds.forEach((id) => params.append('form_ids', id))
      await loadDesignGapReport(params)
    } catch (error) {
      toast.error(error.message || 'Failed to load report')
    }
  }

  const handleGenerateFromReports = async ({ regenerateExisting }) => {
    if (!assertCanStartJob()) return
    try {
      const params = new URLSearchParams({
        page: '1',
        page_size: '500',
        unit_ids: reportUnitId,
        business_processes: reportBp,
        financial_years: reportFy,
      })
      const listRes = await fetch(apiUrl(`/api/company-co/ai-insights/design-gap/controls?${params}`), {
        credentials: 'include',
      })
      const listData = await listRes.json()
      if (!listRes.ok || !listData?.success) throw new Error(listData?.message || 'Failed to list controls')
      const formIds = (listData.data || []).map((r) => String(r.form_id || '').trim()).filter(Boolean)
      if (formIds.length === 0) {
        toast.error('No controls in this scope')
        return
      }
      await runGenerate({ formIds, regenerateExisting })
    } catch (error) {
      toast.error(error.message || 'Generation failed')
    } finally {
      setRegenConfirmOpen(false)
    }
  }

  const unitLabel = (unitId) => {
    const match = unitOptions.find((u) => String(u.unit_id) === String(unitId))
    return match?.unit_name ? `${match.unit_name} (${unitId})` : unitId
  }

  const dismissCompletedBanner = () => {
    setJobJustCompleted(false)
    if (!jobRunning) setActiveJob(null)
  }

  return (
    <Box sx={DASHBOARD_PAGE_OUTER_SX}>
      <Paper sx={{ ...DASHBOARD_PAPER_SX, p: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 700 }}>
          Design Gap Analysis
        </Typography>
        <Typography variant="body2" sx={{ ...PAGE_SUBHEADER_TEXT_SX, mt: 0.75 }}>
          Design gap analysis — select controls from one unit, generate insights, or open a scoped report.
        </Typography>

        {apiReachable === false && (
          <Alert severity="warning" sx={{ mt: 2 }}>
            AI Summary API is not reachable. Start `AI-Summary-API-Backend` and check `AI_SUMMARY_API_URL` / `AI_SUMMARY_API_KEY`.
          </Alert>
        )}
        {errorMessage && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {errorMessage}
          </Alert>
        )}

        {(jobRunning || jobJustCompleted) && activeJob && (
          <Alert
            severity={jobJustCompleted ? 'success' : 'info'}
            icon={jobJustCompleted ? <CheckCircleIcon fontSize="inherit" /> : undefined}
            sx={{ mt: 2 }}
            onClose={jobJustCompleted ? dismissCompletedBanner : undefined}
          >
            {jobRunning ? (
              <Box sx={{ width: '100%' }}>
                <Typography variant="body2" sx={{ mb: 1 }}>
                  Design gap running… {activeJob.processed || 0} / {activeJob.total || 0}
                  {activeJob.current_control_number
                    ? ` · current: ${activeJob.current_control_number}`
                    : ''}
                </Typography>
                <LinearProgress variant="determinate" value={jobProgressPct} />
              </Box>
            ) : (
              <Typography variant="body2">
                {activeJob.message || 'Design-gap job completed. Table refreshed — open Reports to See Report when the scope is ready.'}
              </Typography>
            )}
          </Alert>
        )}

        <Box sx={{ mt: 2.5, display: 'flex', flexWrap: 'wrap', gap: 1.5, alignItems: 'center' }}>
          <FormControl size="small" sx={FILTER_SELECT_SX}>
            <InputLabel>Unit</InputLabel>
            <Select
              multiple
              label="Unit"
              value={filterUnits}
              onChange={(e) => {
                const nextUnits = typeof e.target.value === 'string' ? e.target.value.split(',') : e.target.value
                const nextBps = keepAllowed(filterBusinessProcesses, businessProcessesForUnits(scopeRows, nextUnits))
                const nextFys = keepAllowed(filterFinancialYears, financialYearsForScope(scopeRows, nextUnits, nextBps))
                setFilterUnits(nextUnits)
                setFilterBusinessProcesses(nextBps)
                setFilterFinancialYears(nextFys)
                setPage(0)
                clearSelection()
              }}
              renderValue={(selected) =>
                renderFilterValue(
                  getSelectedFilterLabel(
                    selected.map((id) => unitOptions.find((u) => u.unit_id === id)?.unit_name || id)
                  )
                )
              }
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
              onChange={(e) => {
                const nextBps = typeof e.target.value === 'string' ? e.target.value.split(',') : e.target.value
                setFilterBusinessProcesses(nextBps)
                setFilterFinancialYears(keepAllowed(filterFinancialYears, financialYearsForScope(scopeRows, filterUnits, nextBps)))
                setPage(0)
                clearSelection()
              }}
              renderValue={(selected) => renderFilterValue(getSelectedFilterLabel(selected))}
            >
              {businessProcessOptions.map((bp) => (
                <MenuItem key={bp} value={bp}>
                  <Checkbox checked={filterBusinessProcesses.includes(bp)} size="small" />
                  <ListItemText primary={bp} />
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
              onChange={(e) => {
                setFilterFinancialYears(e.target.value)
                setPage(0)
                clearSelection()
              }}
              renderValue={(selected) => renderFilterValue(getSelectedFilterLabel(selected))}
            >
              {financialYearOptions.map((fy) => (
                <MenuItem key={fy} value={fy}>
                  <Checkbox checked={filterFinancialYears.includes(fy)} size="small" />
                  <ListItemText primary={fy} />
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl size="small" sx={FILTER_SELECT_SX}>
            <InputLabel>Generation</InputLabel>
            <Select
              label="Generation"
              value={filterGenerationStatus}
              onChange={(e) => {
                setFilterGenerationStatus(e.target.value)
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

          <Button variant="outlined" onClick={openReports}>
            Reports
          </Button>
          {generatedSelectionCount > 0 && (
            <Button variant="outlined" onClick={openSelectedReports}>
              See Reports ({generatedSelectionCount})
            </Button>
          )}
          <Button
            variant="contained"
            disabled={selectedFormIds.size === 0 || jobRunning}
            onClick={handleGenerateSelected}
          >
            Generate Selected ({selectedFormIds.size})
          </Button>
        </Box>

        {selectionUnitId && (
          <Typography variant="caption" sx={{ display: 'block', mt: 1, color: 'text.secondary' }}>
            Selection locked to unit: {unitLabel(selectionUnitId)}
          </Typography>
        )}

        <Box
          sx={{
            mt: 2.5,
            border: `1px solid ${theme.palette.divider}`,
            borderRadius: 2,
            overflow: 'hidden',
          }}
        >
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: TABLE_GRID_COLUMNS,
              gap: 1,
              px: 1.5,
              py: 1,
              bgcolor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.04)' : 'rgba(15,23,42,0.03)',
              borderBottom: `1px solid ${theme.palette.divider}`,
              alignItems: 'center',
            }}
          >
            <Checkbox
              size="small"
              checked={allPageSelected}
              indeterminate={selectedOnPageCount > 0 && !allPageSelected}
              onChange={toggleSelectAllPage}
            />
            <Typography variant="caption" fontWeight={700}>Control</Typography>
            <Typography variant="caption" fontWeight={700}>Insight</Typography>
            <Typography variant="caption" fontWeight={700}>Unit</Typography>
            <Typography variant="caption" fontWeight={700}>Business Process</Typography>
            <Typography variant="caption" fontWeight={700}>FY</Typography>
            <Typography variant="caption" fontWeight={700}>Sub Process</Typography>
            <Typography variant="caption" fontWeight={700}>Risk</Typography>
          </Box>

          {rows.length === 0 && !loading ? (
            <Box sx={{ p: 3 }}>
              <Typography color="text.secondary">No controls found for the current filters.</Typography>
            </Box>
          ) : (
            rows.map((row, index) => {
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
                    bgcolor: checked ? alphaPrimary(theme) : 'transparent',
                  }}
                >
                  <Checkbox
                    size="small"
                    checked={checked}
                    onClick={(e) => toggleRow(formId, row.unit_id, index, e.shiftKey)}
                  />
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>{row.control_number || '—'}</Typography>
                  <Box>
                    {row.has_design_gap_insight
                      ? statusChip(row.control_design_status)
                      : <Chip size="small" label="Not generated" variant="outlined" />}
                  </Box>
                  <Typography variant="body2" noWrap>{row.unit_name || row.unit_id || '—'}</Typography>
                  <Typography variant="body2" noWrap>{row.business_process || '—'}</Typography>
                  <Typography variant="body2" noWrap>{row.financial_year || '—'}</Typography>
                  <Typography variant="body2" noWrap>{row.sub_process || '—'}</Typography>
                  <Typography variant="body2" noWrap color="text.secondary">{row.risk_description || '—'}</Typography>
                </Box>
              )
            })
          )}
        </Box>

        <TablePagination
          component="div"
          count={totalCount}
          page={page}
          onPageChange={(_e, next) => setPage(next)}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={(e) => {
            setRowsPerPage(Number.parseInt(e.target.value, 10))
            setPage(0)
          }}
          rowsPerPageOptions={[10, 25, 50]}
        />
      </Paper>

      {/* Reports filters */}
      <Dialog open={reportsOpen} onClose={() => !jobRunning && setReportsOpen(false)} fullWidth maxWidth="md">
        <DialogTitle>Design Gap Reports</DialogTitle>
        <DialogContent dividers>
          {jobRunning && (
            <Alert severity="info" sx={{ mb: 2 }}>
              Design gap running… {activeJob?.processed || 0} / {activeJob?.total || 0}
              <LinearProgress variant="determinate" value={jobProgressPct} sx={{ mt: 1 }} />
            </Alert>
          )}

          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, minmax(0, 1fr))' },
              gap: 2,
              mb: 2,
            }}
          >
            <FormControl fullWidth size="small">
              <InputLabel>Unit</InputLabel>
              <Select
                label="Unit"
                value={reportUnitId}
                onChange={(e) => {
                  const unitId = e.target.value
                  const nextBp = businessProcessesForUnits(scopeRows, [unitId]).includes(reportBp) ? reportBp : ''
                  const allowedFys = financialYearsForScope(scopeRows, [unitId], nextBp ? [nextBp] : [])
                  setReportUnitId(unitId)
                  setReportBp(nextBp)
                  setReportFy(allowedFys.includes(reportFy) ? reportFy : '')
                  setReportScope(null)
                  setReportData(null)
                }}
              >
                {unitOptions.map((u) => (
                  <MenuItem key={u.unit_id} value={u.unit_id}>
                    {u.unit_name || u.unit_id}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl fullWidth size="small" disabled={!reportUnitId}>
              <InputLabel>Business Process</InputLabel>
              <Select
                label="Business Process"
                value={reportBp}
                onChange={(e) => {
                  const nextBp = e.target.value
                  const allowedFys = financialYearsForScope(scopeRows, [reportUnitId], [nextBp])
                  setReportBp(nextBp)
                  setReportFy(allowedFys.includes(reportFy) ? reportFy : '')
                  setReportScope(null)
                  setReportData(null)
                }}
              >
                {reportBusinessProcessOptions.map((bp) => (
                  <MenuItem key={bp} value={bp}>{bp}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl fullWidth size="small" disabled={!reportBp}>
              <InputLabel>Financial Year</InputLabel>
              <Select
                label="Financial Year"
                value={reportFy}
                onChange={(e) => {
                  setReportFy(e.target.value)
                  setReportScope(null)
                  setReportData(null)
                }}
              >
                {reportFinancialYearOptions.map((fy) => (
                  <MenuItem key={fy} value={fy}>{fy}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>

          {!reportFiltersReady && (
            <Typography variant="body2" color="text.secondary">
              Select unit, business process, and financial year to view the report scope.
            </Typography>
          )}

          {reportFiltersReady && reportScopeLoading && (
            <Typography variant="body2" color="text.secondary">Loading scope…</Typography>
          )}

          {reportFiltersReady && reportScope && !reportScopeLoading && (
            <Box>
              <Alert severity="info" sx={{ mb: 2 }}>
                Controls in scope: <strong>{reportScope.total_racms}</strong>
                <br />
                With design-gap summary: <strong>{reportScope.with_insight}</strong>
                <br />
                Missing summary: <strong>{reportScope.missing_insight}</strong>
              </Alert>
              {reportScope.all_generated ? (
                <Typography variant="body2" color="text.secondary">
                  All controls in this scope already have a design-gap summary.
                </Typography>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  You can generate for missing controls only, or regenerate including existing (extra cost).
                </Typography>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ flexWrap: 'wrap', gap: 1 }}>
          <Button onClick={() => setReportsOpen(false)} disabled={jobRunning}>Close</Button>
          {reportScope && reportFiltersReady && (
            <>
              {reportScope.with_insight > 0 && (
                <Button variant="outlined" onClick={openReportView}>See Report</Button>
              )}
              {reportScope.all_generated ? (
                <Button
                  variant="contained"
                  color="warning"
                  disabled={jobRunning}
                  onClick={() => {
                    if (!assertCanStartJob()) return
                    setPendingGenerateMode({
                      source: 'reports_all',
                      existingCount: Number(reportScope.with_insight || 0),
                      pendingCount: Number(reportScope.missing_insight || 0),
                    })
                    setRegenConfirmOpen(true)
                  }}
                >
                  Generate Again
                </Button>
              ) : (
                <>
                  <Button
                    variant="contained"
                    disabled={jobRunning || reportScope.missing_insight === 0}
                    onClick={() => handleGenerateFromReports({ regenerateExisting: false })}
                  >
                    Generate Missing
                  </Button>
                  {reportScope.with_insight > 0 && (
                    <Button
                      variant="outlined"
                      color="warning"
                      disabled={jobRunning}
                      onClick={() => {
                        if (!assertCanStartJob()) return
                        setPendingGenerateMode({
                          source: 'reports_regen',
                          existingCount: Number(reportScope.with_insight || 0),
                          pendingCount: Number(reportScope.missing_insight || 0),
                        })
                        setRegenConfirmOpen(true)
                      }}
                    >
                      Generate All (incl. existing)
                    </Button>
                  )}
                </>
              )}
            </>
          )}
        </DialogActions>
      </Dialog>

      {/* Regen cost confirm */}
      <Dialog open={regenConfirmOpen} onClose={() => !jobRunning && setRegenConfirmOpen(false)}>
        <DialogTitle>Regenerate existing summaries?</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            Some selected controls already have a design-gap summary. Regenerating them will call the AI again and may incur extra cost.
          </Typography>
          <Box sx={{ mt: 1.75, display: 'flex', flexDirection: 'column', gap: 0.75 }}>
            <Typography variant="body2">
              Already have summary: <strong>{Number(pendingGenerateMode?.existingCount || 0)}</strong>
            </Typography>
            <Typography variant="body2">
              Pending to generate: <strong>{Number(pendingGenerateMode?.pendingCount || 0)}</strong>
            </Typography>
          </Box>
          <Typography variant="body2" sx={{ mt: 1.5 }}>
            Choose <strong>Skip existing</strong> to only generate for controls without a summary, or <strong>Regenerate all</strong> to overwrite.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRegenConfirmOpen(false)} disabled={jobRunning}>Cancel</Button>
          {pendingGenerateMode?.source !== 'reports_all' && (
            <Button
              disabled={jobRunning}
              onClick={async () => {
                if (pendingGenerateMode?.source === 'selection') {
                  await runGenerate({ formIds: pendingGenerateMode.formIds, regenerateExisting: false })
                } else if (pendingGenerateMode?.source === 'reports_regen') {
                  await handleGenerateFromReports({ regenerateExisting: false })
                }
              }}
            >
              Skip existing
            </Button>
          )}
          <Button
            variant="contained"
            color="warning"
            disabled={jobRunning}
            onClick={async () => {
              if (pendingGenerateMode?.source === 'selection') {
                await runGenerate({ formIds: pendingGenerateMode.formIds, regenerateExisting: true })
              } else {
                await handleGenerateFromReports({ regenerateExisting: true })
              }
            }}
          >
            Regenerate all
          </Button>
        </DialogActions>
      </Dialog>

      {/* Report viewer */}
      <Dialog open={reportViewOpen} onClose={() => setReportViewOpen(false)} fullWidth maxWidth="lg">
        <DialogTitle>Design Gap Report</DialogTitle>
        <DialogContent>
          {reportData && (() => {
            const counts = getDesignGapSummaryCounts(reportData)
            const gapControls = (reportData.controls || []).filter((c) =>
              (c.results || []).some((r) => r.status === 'flagged')
            )
            const insufControls = (reportData.controls || []).filter((c) =>
              (c.results || []).some((r) => r.status === 'insufficient_data')
            )
            const companyName = String(reportData.meta?.company_name || '').trim() || '—'
            const unitName = String(reportData.meta?.unit_name || '').trim() || '—'
            return (
              <Box>
                <Typography variant="body2" color="text.secondary">
                  {companyName} | {unitName}
                </Typography>
                <Typography variant="subtitle1" fontWeight={700} sx={{ mt: 0.5 }}>
                  {reportData.meta?.business_process}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5, pb: 1.5, borderBottom: `1px solid ${theme.palette.divider}` }}>
                  Financial year: {reportData.meta?.financial_year}
                  {' · '}
                  Controls reviewed: {counts.reviewed}
                </Typography>

                <Box
                  sx={{
                    mt: 2,
                    mb: 2.5,
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignItems: 'baseline',
                    gap: 2.5,
                  }}
                >
                  {[
                    { label: 'No Design Gap', value: counts.withoutGaps, tone: 'good' },
                    { label: 'Gaps', value: counts.gaps, tone: 'bad' },
                    { label: 'Insufficient data', value: counts.insufficientData, tone: 'neutral' },
                  ].map((item) => (
                    <Typography key={item.label} variant="body1" component="span" sx={{ whiteSpace: 'nowrap' }}>
                      <Box component="span" color="text.secondary">
                        {item.label}:{' '}
                      </Box>
                      <Box
                        component="span"
                        sx={{
                          fontWeight: 800,
                          color:
                            item.tone === 'good'
                              ? 'success.main'
                              : item.tone === 'bad'
                                ? 'error.main'
                                : 'text.primary',
                        }}
                      >
                        {item.value}
                      </Box>
                    </Typography>
                  ))}
                </Box>

                <Typography
                  variant="subtitle1"
                  fontWeight={700}
                  sx={{ mt: 1, mb: 1, pb: 0.75, borderBottom: `1px solid ${theme.palette.divider}` }}
                >
                  Gaps
                </Typography>
                {gapControls.map((c) => (
                  <Accordion
                    key={c.form_id}
                    disableGutters
                    elevation={0}
                    sx={{
                      mb: 1.5,
                      border: `1px solid ${theme.palette.divider}`,
                      borderRadius: '10px !important',
                      overflow: 'hidden',
                      bgcolor: 'background.paper',
                      '&:before': { display: 'none' },
                      boxShadow: 'none',
                    }}
                  >
                    <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ px: 1.75 }}>
                      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
                        {statusChip('has_gaps')}
                        <Typography fontWeight={700}>{c.control_number}</Typography>
                      </Box>
                    </AccordionSummary>
                    <AccordionDetails sx={{ px: 1.75, pt: 0, pb: 1.75 }}>
                      {c.summary && (
                        <Typography variant="body2" sx={{ mb: 1.5 }}>
                          <Box component="span" fontWeight={700}>Summary: </Box>
                          {c.summary}
                        </Typography>
                      )}
                      {(c.results || []).filter((r) => r.status === 'flagged').map((r) => (
                        <Box key={r.check_id} sx={{ mb: 1.5 }}>
                          <Typography variant="body2" fontWeight={700}>
                            {humanizeCheckLabel(r.check_id)}
                          </Typography>
                          {r.alignment && (
                            <Typography variant="body2" sx={{ mt: 0.5 }}>
                              <Box component="span" fontWeight={700}>Alignment: </Box>
                              {r.alignment}
                            </Typography>
                          )}
                          {(r.alignment_rationale || r.inconsistency) && (
                            <Typography variant="body2" sx={{ mt: 0.5 }}>
                              {r.alignment_rationale || r.inconsistency}
                            </Typography>
                          )}
                          {(r.proposed_solution || r.recommendation) && (
                            <Typography variant="body2" sx={{ mt: 0.5 }} color="text.secondary">
                              Proposed solution: {r.proposed_solution || r.recommendation}
                            </Typography>
                          )}
                        </Box>
                      ))}
                      <DesignGapUsageLine control={c} />
                    </AccordionDetails>
                  </Accordion>
                ))}
                {gapControls.length === 0 && (
                  <Typography variant="body2" color="text.secondary">None</Typography>
                )}

                <Typography
                  variant="subtitle1"
                  fontWeight={700}
                  sx={{ mt: 2, mb: 1, pb: 0.75, borderBottom: `1px solid ${theme.palette.divider}` }}
                >
                  Insufficient data
                </Typography>
                {insufControls.map((c) => {
                  const insuf = (c.results || []).filter((r) => r.status === 'insufficient_data')
                  return (
                    <Box
                      key={`insuf-${c.form_id}`}
                      sx={{
                        mb: 1.5,
                        p: 1.75,
                        border: `1px solid ${theme.palette.divider}`,
                        borderRadius: '10px',
                      }}
                    >
                      <Typography variant="body2" fontWeight={700} sx={{ mb: 1 }}>{c.control_number}</Typography>
                      {insuf.map((r) => (
                        <Typography key={r.check_id} variant="body2" component="div" color="text.secondary" sx={{ mb: 0.75 }}>
                          {formatInsufficientCheckLine(r)}
                        </Typography>
                      ))}
                      <DesignGapUsageLine control={c} />
                    </Box>
                  )
                })}
                {insufControls.length === 0 && (
                  <Typography variant="body2" color="text.secondary">None</Typography>
                )}
              </Box>
            )
          })()}
        </DialogContent>
        <DialogActions>
          <Button
            variant="outlined"
            disabled={!reportData}
            onClick={() => {
              try {
                downloadDesignGapReportPdf(reportData)
                toast.success('PDF downloaded')
              } catch (error) {
                toast.error(error.message || 'Failed to export PDF')
              }
            }}
          >
            Export PDF
          </Button>
          <Button onClick={() => setReportViewOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

function DesignGapUsageLine({ control }) {
  if (!SHOW_DESIGN_GAP_USAGE) return null
  return (
    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
      Model: {control.model_name || '—'}
      {' · '}
      Prompt tokens: {formatTokenCount(control.prompt_tokens)}
      {' · '}
      Completion tokens: {formatTokenCount(control.completion_tokens)}
      {' · '}
      Total tokens: {formatTokenCount(control.total_tokens)}
    </Typography>
  )
}

function alphaPrimary(theme) {
  return theme.palette.mode === 'dark' ? 'rgba(59,130,246,0.12)' : 'rgba(37,99,235,0.06)'
}

export default AiInsights
