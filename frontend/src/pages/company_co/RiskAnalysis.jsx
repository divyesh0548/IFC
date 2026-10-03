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
import TextField from '@mui/material/TextField'
import Alert from '@mui/material/Alert'
import Checkbox from '@mui/material/Checkbox'
import Chip from '@mui/material/Chip'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import ListItemText from '@mui/material/ListItemText'
import TablePagination from '@mui/material/TablePagination'
import Tooltip from '@mui/material/Tooltip'
import ArrowOutwardRoundedIcon from '@mui/icons-material/ArrowOutwardRounded'
import { useTheme } from '@mui/material/styles'
import * as XLSX from 'xlsx'
import { apiUrl } from '../../config/api'
import { useSyncGlobalLoading } from '../../contexts/GlobalLoadingContext'
import { DASHBOARD_PAGE_OUTER_SX, DASHBOARD_PAPER_SX, PAGE_SUBHEADER_TEXT_SX } from '../../uiConstants'
import { getFieldValue } from './dashboardClassificationUtils'
import { toast } from 'react-hot-toast'
import { downloadRiskAnalysisReportPdf } from '../../utils/aiInsightReportPdf'
import {
  businessProcessesForUnits,
  financialYearsForScope,
  keepAllowed,
  normalizeScopeRows,
} from '../../utils/controlScopeFilters'

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

function RiskStatementFields({ item, index }) {
  const risk = String(item?.risk || '').trim()
  const pointer = String(item?.pointer || '').trim()
  const body = (
    <Typography variant="body2" sx={{ lineHeight: 1.6 }}>
      {risk || pointer || '—'}
    </Typography>
  )
  if (index == null) return body
  return (
    <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
      <Typography variant="body2" sx={{ fontWeight: 800, minWidth: 22, lineHeight: 1.4 }}>
        {`${index}.`}
      </Typography>
      <Box sx={{ flex: 1, minWidth: 0 }}>{body}</Box>
    </Box>
  )
}

function RiskOutputDetails({ item, indent = false }) {
  const addressedBy = Array.isArray(item?.addressedBy) ? item.addressedBy.filter(Boolean) : []
  const rows = [
    ['Partially covered by', addressedBy.join(', ')],
    ['Sub-process', item?.subProcess || item?.sub_process],
    ['Proposed solution', item?.proposedSolution || item?.proposed_solution],
    ['Potential impact', item?.potentialImpact || item?.potential_impact],
  ]
    .map(([label, value]) => [label, String(value || '').trim()])
    .filter(([, value]) => value)

  if (rows.length === 0) return null
  return (
    <Box sx={{ mt: 0.75, pl: indent ? '30px' : 0, display: 'flex', flexDirection: 'column', gap: 0.35 }}>
      {rows.map(([label, value]) => (
        <Typography key={label} variant="body2" sx={DETAIL_FIELD_VALUE_SX}>
          <Typography component="span" variant="body2" sx={{ fontWeight: 700, color: 'text.secondary' }}>
            {`${label}: `}
          </Typography>
          {value}
        </Typography>
      ))}
    </Box>
  )
}

const TABLE_GRID_COLUMNS = '56px 220px 180px 220px 140px 240px minmax(340px, 1fr)'

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

function fileStamp() {
  return new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')
}

function filePart(value, fallback) {
  return String(value || fallback || 'export')
    .replace(/[^\w.-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80) || fallback || 'export'
}

function normalizeRiskLabel(value) {
  return String(value || '').replace(/\s+/g, ' ').trim()
}

function comparisonChipColor(status) {
  if (status === 'Fully addressed') return 'success'
  if (status === 'Partially addressed') return 'warning'
  return 'default'
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
  const [scopeRows, setScopeRows] = useState([])
  const [filterUnits, setFilterUnits] = useState([])
  const [filterBusinessProcesses, setFilterBusinessProcesses] = useState([])
  const [filterFinancialYears, setFilterFinancialYears] = useState([])
  const [filterGenerationStatus, setFilterGenerationStatus] = useState('')
  const [listTick, setListTick] = useState(0)
  const [regenConfirmOpen, setRegenConfirmOpen] = useState(false)
  const [pendingGenerate, setPendingGenerate] = useState(null)
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
  const [selectedControlNumbers, setSelectedControlNumbers] = useState(new Set())
  const [errorMessage, setErrorMessage] = useState('')
  const [selectedControl, setSelectedControl] = useState(null)
  const [analysisDialogOpen, setAnalysisDialogOpen] = useState(false)
  const [analysisLoading, setAnalysisLoading] = useState(false)
  const [analysisGenerating, setAnalysisGenerating] = useState(false)
  const [comparingRisk, setComparingRisk] = useState('')
  const [batchGenerating, setBatchGenerating] = useState(false)
  const [analysisData, setAnalysisData] = useState(null)
  const [reportOpen, setReportOpen] = useState(false)
  const [reportLoading, setReportLoading] = useState(false)
  const [reportData, setReportData] = useState(null)
  const [conciseList, setConciseList] = useState(null)
  const [conciseLoading, setConciseLoading] = useState(false)
  const [conciseGenerating, setConciseGenerating] = useState(false)
  const [conciseListOpen, setConciseListOpen] = useState(false)
  const [conciseTick, setConciseTick] = useState(0)
  const [businessProcessOverview, setBusinessProcessOverview] = useState(null)
  const [businessProcessOverviewText, setBusinessProcessOverviewText] = useState('')
  const [businessProcessOverviewLoading, setBusinessProcessOverviewLoading] = useState(false)
  const [businessProcessOverviewSaving, setBusinessProcessOverviewSaving] = useState(false)
  const [businessProcessOverviewError, setBusinessProcessOverviewError] = useState('')
  const [controlConcise, setControlConcise] = useState({ loading: false, exists: false })
  const lastSelectedIndexRef = useRef(null)
  const rowMetaRef = useRef(new Map())
  useSyncGlobalLoading(loading || batchGenerating || analysisGenerating || conciseGenerating || businessProcessOverviewSaving)

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
        if (filterGenerationStatus) params.set('generation_status', filterGenerationStatus)

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
          setScopeRows(normalizeScopeRows(data.filters?.scope_rows))
        }
      } catch (error) {
        console.error('Error fetching risk analysis data:', error)
        if (!cancelled) {
          setUnitOptions([])
          setScopeRows([])
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
  }, [filterBusinessProcesses, filterFinancialYears, filterGenerationStatus, filterUnits, page, rowsPerPage, listTick])

  rows.forEach((row) => {
    const controlNumber = String(getFieldValue(row, 'control_number', 'controlNumber') || '').trim()
    if (controlNumber) rowMetaRef.current.set(controlNumber, row)
  })

  const selectedControlsOnPage = useMemo(() => (
    rows.filter((row) => selectedControlNumbers.has(String(getFieldValue(row, 'control_number', 'controlNumber') || '').trim()))
  ), [rows, selectedControlNumbers])

  const allPageControlsSelected = rows.length > 0 && selectedControlsOnPage.length === rows.length
  const somePageControlsSelected = selectedControlsOnPage.length > 0 && selectedControlsOnPage.length < rows.length
  const generatedSelectionCount = useMemo(() => (
    [...selectedControlNumbers].filter((controlNumber) => Boolean(rowMetaRef.current.get(controlNumber)?.has_risk_analysis)).length
  ), [rows, selectedControlNumbers])

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

    const unitId = String(getFieldValue(row, 'unit_id', 'unitId') || '').trim()
    const businessProcess = String(getFieldValue(row, 'business_process', 'businessProcess') || '').trim()
    setSelectedControl(row)
    setAnalysisDialogOpen(true)
    setAnalysisLoading(true)
    setAnalysisData(null)
    setControlConcise({ loading: true, exists: false, unitId, businessProcess })

    const conciseParams = new URLSearchParams({ unit_id: unitId, business_process: businessProcess })
    fetch(apiUrl(`/api/company-co/risk-analysis/concise-list?${conciseParams}`), { credentials: 'include' })
      .then((conciseResponse) => conciseResponse.json().then((conciseData) => ({ ok: conciseResponse.ok, conciseData })))
      .then(({ ok, conciseData }) => {
        setControlConcise({
          loading: false,
          exists: Boolean(ok && conciseData?.success && conciseData?.data?.exists),
          unitId,
          businessProcess,
        })
      })
      .catch(() => {
        setControlConcise({ loading: false, exists: false, unitId, businessProcess })
      })

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
    if (!controlConcise.exists) {
      toast.error('Generate the concise risk list for this unit and business process first.')
      return
    }

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

      if (data.data?.dry_run) {
        if (data.data.dry_run_txt) {
          downloadDryRunPrompt(data.data.dry_run_txt, `risk_analysis_dry_run_${controlNumber || 'prompt'}.txt`)
        }
        toast.success(data.message || 'Dry-run prompt downloaded')
        return
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
      setListTick((value) => value + 1)
    } catch (error) {
      console.error('Error generating risk analysis:', error)
      toast.error(error?.serverCode ? formatServerErrorToast(error.serverCode) : (error.message || 'Failed to generate risk analysis'))
    } finally {
      setAnalysisGenerating(false)
    }
  }

  const runGenerateSelected = async ({ formIds, regenerateExisting }) => {
    setBatchGenerating(true)
    setRegenConfirmOpen(false)
    setPendingGenerate(null)
    try {
      const response = await fetch(apiUrl('/api/company-co/risk-analysis/generate'), {
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
      if (!response.ok || !data?.success) {
        throw new Error(data?.message || 'Failed to generate risk analysis')
      }
      if (data.data?.dry_run) {
        if (data.data.dry_run_txt) {
          downloadDryRunPrompt(data.data.dry_run_txt, 'risk_analysis_dry_run_prompts.txt')
        }
        toast.success(data.message || 'Dry-run prompts downloaded')
        return
      }
      const generated = Number(data.data?.generated || 0)
      const skipped = Number(data.data?.skipped || 0)
      toast.success(`Risk analysis generated for ${generated} control${generated === 1 ? '' : 's'}${skipped ? `. Skipped ${skipped} existing.` : '.'}`)
      setSelectedControlNumbers(new Set())
      setListTick((value) => value + 1)
    } catch (error) {
      toast.error(error.message || 'Failed to generate risk analysis')
    } finally {
      setBatchGenerating(false)
    }
  }

  const conciseScopeReady = filterUnits.length === 1 && filterBusinessProcesses.length === 1
  const businessProcessOverviewScopeReady = filterBusinessProcesses.length === 1
  const businessProcessOverviewHasChanges = businessProcessOverviewScopeReady
    && businessProcessOverviewText.trim() !== String(businessProcessOverview?.overview_text || '').trim()

  useEffect(() => {
    if (!conciseScopeReady) {
      setConciseList(null)
      setConciseLoading(false)
      return undefined
    }
    let cancelled = false
    const loadConciseList = async () => {
      setConciseLoading(true)
      try {
        const params = new URLSearchParams({
          unit_id: filterUnits[0],
          business_process: filterBusinessProcesses[0],
        })
        const response = await fetch(apiUrl(`/api/company-co/risk-analysis/concise-list?${params}`), {
          credentials: 'include',
        })
        const data = await response.json()
        if (!response.ok || !data?.success) throw new Error(data?.message || 'Failed to load concise risk list')
        if (!cancelled) setConciseList(data.data)
      } catch (error) {
        if (!cancelled) {
          setConciseList(null)
          toast.error(error.message || 'Failed to load concise risk list')
        }
      } finally {
        if (!cancelled) setConciseLoading(false)
      }
    }
    loadConciseList()
    return () => {
      cancelled = true
    }
  }, [conciseScopeReady, filterUnits, filterBusinessProcesses, conciseTick])

  useEffect(() => {
    if (!businessProcessOverviewScopeReady) {
      setBusinessProcessOverview(null)
      setBusinessProcessOverviewText('')
      setBusinessProcessOverviewLoading(false)
      setBusinessProcessOverviewError('')
      return undefined
    }

    let cancelled = false
    const loadBusinessProcessOverview = async () => {
      setBusinessProcessOverviewLoading(true)
      setBusinessProcessOverviewError('')
      try {
        const params = new URLSearchParams({
          business_process: filterBusinessProcesses[0],
        })
        const response = await fetch(apiUrl(`/api/company-co/risk-analysis/business-process-overview?${params}`), {
          credentials: 'include',
        })
        const data = await response.json()
        if (!response.ok || !data?.success) throw new Error(data?.message || 'Failed to load business process overview')
        if (!cancelled) {
          setBusinessProcessOverview(data.data || null)
          setBusinessProcessOverviewText(String(data.data?.overview_text || ''))
        }
      } catch (error) {
        if (!cancelled) {
          setBusinessProcessOverview(null)
          setBusinessProcessOverviewText('')
          setBusinessProcessOverviewError(error.message || 'Failed to load business process overview')
        }
      } finally {
        if (!cancelled) setBusinessProcessOverviewLoading(false)
      }
    }

    loadBusinessProcessOverview()
    return () => {
      cancelled = true
    }
  }, [businessProcessOverviewScopeReady, filterBusinessProcesses])

  const saveBusinessProcessOverview = async () => {
    if (!businessProcessOverviewScopeReady) return
    const overviewText = businessProcessOverviewText.trim()
    if (!overviewText) {
      toast.error('Business process overview is required.')
      return
    }

    setBusinessProcessOverviewSaving(true)
    setBusinessProcessOverviewError('')
    try {
      const response = await fetch(apiUrl('/api/company-co/risk-analysis/business-process-overview'), {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          business_process: filterBusinessProcesses[0],
          overview_text: overviewText,
        }),
      })
      const data = await response.json()
      if (!response.ok || !data?.success) throw new Error(data?.message || 'Failed to save business process overview')
      setBusinessProcessOverview(data.data || null)
      setBusinessProcessOverviewText(String(data.data?.overview_text || overviewText))
      toast.success(data.message || 'Business process overview saved')
    } catch (error) {
      setBusinessProcessOverviewError(error.message || 'Failed to save business process overview')
      toast.error(error.message || 'Failed to save business process overview')
    } finally {
      setBusinessProcessOverviewSaving(false)
    }
  }

  const generateConciseList = async () => {
    if (!conciseScopeReady) return
    setConciseGenerating(true)
    try {
      const response = await fetch(apiUrl('/api/company-co/risk-analysis/concise-list'), {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          unit_id: filterUnits[0],
          business_process: filterBusinessProcesses[0],
        }),
      })
      const data = await response.json()
      if (response.status === 409) {
        toast('LLM Server is busy, Try again after some moments')
        return
      }
      if (!response.ok || !data?.success) throw new Error(data?.message || 'Failed to generate concise risk list')
      if (data.data?.dry_run) {
        if (data.data.dry_run_txt) {
          downloadDryRunPrompt(data.data.dry_run_txt, 'risk_analysis_concise_list_dry_run.txt')
        }
        toast.success(data.message || 'Dry-run prompt downloaded')
        return
      }
      setConciseList(data.data)
      setControlConcise((current) => (
        current.unitId === filterUnits[0]
        && String(current.businessProcess || '').trim().toLowerCase() === String(filterBusinessProcesses[0] || '').trim().toLowerCase()
          ? { ...current, exists: true, loading: false }
          : current
      ))
      toast.success(data.message || 'Concise risk list saved')
    } catch (error) {
      toast.error(error.message || 'Failed to generate concise risk list')
    } finally {
      setConciseGenerating(false)
    }
  }

  const exportConciseListExcel = () => {
    const risks = Array.isArray(conciseList?.risks) ? conciseList.risks : []
    if (!risks.length) {
      toast.error('No concise risk list is available to export.')
      return
    }

    const unitId = String(conciseList?.unit_id || filterUnits[0] || '').trim()
    const unitName = String(
      unitOptions.find((unit) => String(unit.unit_id) === unitId)?.unit_name || unitId || ''
    ).trim()
    const businessProcess = String(conciseList?.business_process || filterBusinessProcesses[0] || '').trim()
    const updatedAt = formatRiskAnalysisTimestamp(conciseList?.updated_at)
    const modelName = String(conciseList?.model_name || '').trim()

    const rows = risks.map((item, index) => ({
      'Sr No': index + 1,
      'Unit ID': unitId,
      'Unit Name': unitName,
      'Business Process': businessProcess,
      Risk: String(item?.risk || '').trim(),
      'Control Numbers': (Array.isArray(item?.controlNumbers) ? item.controlNumbers : [])
        .map((value) => String(value || '').trim())
        .filter(Boolean)
        .join(', '),
      'Generated Model': modelName,
      'Updated At': updatedAt,
      'Source Control Count': Number(conciseList?.source_control_count || 0) || '',
      'Current Control Count': Number(conciseList?.current_control_count || 0) || '',
      Stale: conciseList?.stale ? 'Yes' : 'No',
    }))

    const worksheet = XLSX.utils.json_to_sheet(rows)
    worksheet['!cols'] = [
      { wch: 8 },
      { wch: 16 },
      { wch: 24 },
      { wch: 28 },
      { wch: 55 },
      { wch: 28 },
      { wch: 24 },
      { wch: 24 },
      { wch: 20 },
      { wch: 20 },
      { wch: 10 },
    ]

    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Concise Risk List')
    XLSX.writeFile(
      workbook,
      `concise_risk_list_${filePart(unitName || unitId, 'unit')}_${filePart(businessProcess, 'bp')}_${fileStamp()}.xlsx`
    )
    toast.success('Concise risk list exported')
  }

  const openSelectedReports = async () => {
    const formIds = [...selectedControlNumbers]
      .map((controlNumber) => rowMetaRef.current.get(controlNumber))
      .filter((row) => row?.has_risk_analysis)
      .map((row) => String(row.form_id || '').trim())
      .filter(Boolean)
    if (formIds.length === 0) return
    setReportLoading(true)
    setReportData(null)
    setReportOpen(true)
    try {
      const params = new URLSearchParams()
      formIds.forEach((id) => params.append('form_ids', id))
      const response = await fetch(apiUrl(`/api/company-co/risk-analysis/report?${params}`), {
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

  const handleGenerateSelectedAnalyses = async () => {
    const selectedRows = [...selectedControlNumbers]
      .map((controlNumber) => rowMetaRef.current.get(controlNumber))
      .filter(Boolean)
    if (selectedRows.length === 0) {
      toast('Select at least one control for risk analysis.')
      return
    }
    const units = [...new Set(selectedRows.map((row) => String(row.unit_id || '').trim()).filter(Boolean))]
    if (units.length > 1) {
      toast.error('Selected controls must belong to one unit')
      return
    }
    const formIds = selectedRows.map((row) => String(row.form_id || '').trim()).filter(Boolean)
    const existingCount = selectedRows.filter((row) => row.has_risk_analysis).length
    if (existingCount > 0) {
      setPendingGenerate({
        formIds,
        existingCount,
        pendingCount: selectedRows.length - existingCount,
      })
      setRegenConfirmOpen(true)
      return
    }
    await runGenerateSelected({ formIds, regenerateExisting: false })
  }

  const handleCloseDialog = () => {
    if (analysisGenerating || comparingRisk) return
    setAnalysisDialogOpen(false)
    setSelectedControl(null)
    setAnalysisLoading(false)
    setAnalysisData(null)
    setComparingRisk('')
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

  const handleCompareRisk = async (risk) => {
    const controlNumber = String(
      analysisData?.control?.control_number
      || getFieldValue(selectedControl, 'control_number', 'controlNumber')
      || ''
    ).trim()
    const selectedRisk = normalizeRiskLabel(risk)
    if (!controlNumber || !selectedRisk || comparingRisk) return

    setComparingRisk(selectedRisk)
    try {
      const response = await fetch(
        apiUrl(`/api/company-co/risk-analysis/control/${encodeURIComponent(controlNumber)}/compare`),
        {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ risk: selectedRisk }),
        }
      )
      const data = await response.json()
      if (response.status === 409) {
        toast('LLM Server is busy, Try again after some moments')
        return
      }
      if (!response.ok || !data?.success) {
        const error = new Error(data?.message || 'Failed to compare risk')
        error.serverCode = String(data?.code || '').trim()
        throw error
      }
      if (data.data?.dry_run) {
        if (data.data.dry_run_txt) {
          downloadDryRunPrompt(data.data.dry_run_txt, `risk_comparison_dry_run_${controlNumber || 'prompt'}.txt`)
        }
        toast.success(data.message || 'Dry-run prompt downloaded')
        return
      }

      const comparison = data.data?.comparison
      if (!comparison?.addressedStatus) {
        throw new Error('Risk comparison did not return a result')
      }
      setAnalysisData((prev) => {
        const responseJson = { ...(prev?.analysis?.response_json || {}) }
        responseJson.riskComparisons = {
          ...(responseJson.riskComparisons || {}),
          [comparison.risk || selectedRisk]: comparison,
        }
        return {
          ...prev,
          analysis: {
            ...(prev?.analysis || {}),
            response_json: responseJson,
          },
        }
      })
    } catch (error) {
      console.error('Error comparing risk:', error)
      toast.error(error?.serverCode ? formatServerErrorToast(error.serverCode) : (error.message || 'Failed to compare risk'))
    } finally {
      setComparingRisk('')
    }
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
    const missingRiskPointers = Array.isArray(response.missingRiskPointers) ? response.missingRiskPointers : []
    if (Array.isArray(response.risks)) {
      const missingRisks = response.risks.filter((item) => item?.status !== 'Addressed Risk')
      const riskCardSx = {
        p: 2,
        backgroundColor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.02)' : theme.palette.common.white,
      }
      return (
        <Box sx={{
          display: 'flex',
          flexDirection: 'column',
          border: `1px solid ${theme.palette.divider}`,
          borderRadius: 2,
          overflow: 'hidden',
        }}
        >
          <Box sx={riskCardSx}>
            <Typography variant="body2" sx={INSIGHT_CARD_LABEL_SX}>Missing / partially covered risks</Typography>
            {missingRisks.length === 0 ? (
              <Typography variant="body2" sx={DETAIL_FIELD_VALUE_SX}>None</Typography>
            ) : missingRisks.map((item, index) => (
              <Box key={`missing-${item.risk}-${index}`} sx={{ mb: 1.5 }}>
                <RiskStatementFields item={item} index={index + 1} />
                <RiskOutputDetails item={item} indent />
              </Box>
            ))}
          </Box>
        </Box>
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
          {missingRiskPointers.length > 0 ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              {missingRiskPointers.map((item, index) => {
                const risk = normalizeRiskLabel(item?.risk)
                const pointer = String(item?.pointer || '').trim()
                const comparison = response.riskComparisons?.[risk]
                const isComparing = comparingRisk === risk
                const addressedBy = Array.isArray(comparison?.addressedBy)
                  ? comparison.addressedBy.filter(Boolean)
                  : []
                return (
                  <Box
                    key={`${risk}-${index}`}
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
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75, minWidth: 0 }}>
                      <Typography variant="body2" sx={{ color: theme.palette.text.primary, lineHeight: 1.6 }}>
                        {pointer}
                      </Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                        {comparison?.addressedStatus ? (
                          <Chip
                            size="small"
                            label={comparison.addressedStatus}
                            color={comparisonChipColor(comparison.addressedStatus)}
                            variant={comparison.addressedStatus === 'Not addressed' ? 'outlined' : 'filled'}
                          />
                        ) : null}
                        <Button
                          size="small"
                          variant="text"
                          onClick={() => handleCompareRisk(risk)}
                          disabled={!risk || Boolean(comparingRisk) || analysisGenerating}
                          sx={{ whiteSpace: 'normal', textAlign: 'left', lineHeight: 1.4 }}
                        >
                          {isComparing ? 'Comparing…' : comparison?.addressedStatus ? 'Compare again' : 'Check if this risk is addressed in other controls or not'}
                        </Button>
                      </Box>
                      {comparison?.addressedStatus ? (
                        <Typography variant="body2" sx={{ color: theme.palette.text.secondary, lineHeight: 1.6 }}>
                          {comparison.reason}
                          {addressedBy.length > 0 ? ` Addressed by ${addressedBy.join(', ')}.` : ''}
                        </Typography>
                      ) : null}
                    </Box>
                  </Box>
                )
              })}
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

      <Box
        sx={{
          display: 'flex',
          justifyContent: 'flex-end',
          mb: 3,
        }}
      >
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1.25,
            flexWrap: 'wrap',
            justifyContent: 'flex-end',
            width: { xs: '100%', md: 'auto' },
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
              onChange={(event) => {
                const nextUnits = typeof event.target.value === 'string'
                  ? event.target.value.split(',').filter(Boolean)
                  : event.target.value
                const nextBps = keepAllowed(filterBusinessProcesses, businessProcessesForUnits(scopeRows, nextUnits))
                setFilterUnits(nextUnits)
                setFilterBusinessProcesses(nextBps)
                setFilterFinancialYears(keepAllowed(filterFinancialYears, financialYearsForScope(scopeRows, nextUnits, nextBps)))
                setPage(0)
                setSelectedControlNumbers(new Set())
                lastSelectedIndexRef.current = null
              }}
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

          <FormControl size="small" variant="outlined" sx={FILTER_SELECT_SX} disabled={filterUnits.length === 0}>
            <InputLabel id="risk-analysis-business-process-label" shrink>Business Process</InputLabel>
            <Select
              labelId="risk-analysis-business-process-label"
              multiple
              value={filterBusinessProcesses}
              label="Business Process"
              displayEmpty
              notched
              disabled={filterUnits.length === 0}
              onChange={(event) => {
                const nextBps = typeof event.target.value === 'string'
                  ? event.target.value.split(',').filter(Boolean)
                  : event.target.value
                setFilterBusinessProcesses(nextBps)
                setFilterFinancialYears(keepAllowed(filterFinancialYears, financialYearsForScope(scopeRows, filterUnits, nextBps)))
                setPage(0)
                setSelectedControlNumbers(new Set())
                lastSelectedIndexRef.current = null
              }}
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

          <FormControl size="small" variant="outlined" sx={FILTER_SELECT_SX} disabled={filterBusinessProcesses.length === 0}>
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

          <FormControl size="small" variant="outlined" sx={FILTER_SELECT_SX}>
            <InputLabel id="risk-analysis-generation-label" shrink>Generation</InputLabel>
            <Select
              labelId="risk-analysis-generation-label"
              value={filterGenerationStatus}
              label="Generation"
              displayEmpty
              notched
              onChange={(event) => {
                setFilterGenerationStatus(event.target.value)
                setPage(0)
                setSelectedControlNumbers(new Set())
                lastSelectedIndexRef.current = null
              }}
            >
              <MenuItem value="">All</MenuItem>
              <MenuItem value="generated">Generated</MenuItem>
              <MenuItem value="not_generated">Not Generated</MenuItem>
            </Select>
          </FormControl>

          {generatedSelectionCount > 0 ? (
            <Button variant="outlined" disabled={reportLoading} onClick={openSelectedReports} sx={{ whiteSpace: 'nowrap' }}>
              See Reports ({generatedSelectionCount})
            </Button>
          ) : null}
          <Button
            variant="contained"
            color="secondary"
            onClick={handleGenerateSelectedAnalyses}
            disabled={batchGenerating || selectedControlNumbers.size === 0}
            sx={{ whiteSpace: 'nowrap' }}
          >
            {batchGenerating ? 'Generating...' : `Generate Selected (${selectedControlNumbers.size})`}
          </Button>
        </Box>
      </Box>

      <Paper
        elevation={0}
        sx={{
          mb: 3,
          p: 2,
          borderRadius: 2,
          border: `1px solid ${theme.palette.divider}`,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
              Business process overview
            </Typography>
            {businessProcessOverviewScopeReady ? (
              <Typography variant="body2" sx={{ color: theme.palette.text.secondary, mt: 0.5 }}>
                {filterBusinessProcesses[0]}
              </Typography>
            ) : null}
          </Box>
          <Button
            variant="contained"
            onClick={saveBusinessProcessOverview}
            disabled={
              !businessProcessOverviewScopeReady
              || businessProcessOverviewLoading
              || businessProcessOverviewSaving
              || !businessProcessOverviewText.trim()
              || !businessProcessOverviewHasChanges
            }
            sx={{ whiteSpace: 'nowrap' }}
          >
            {businessProcessOverviewSaving ? 'Saving...' : 'Save overview'}
          </Button>
        </Box>
        {!businessProcessOverviewScopeReady ? (
          <Typography variant="body2" sx={{ mt: 1.5, color: theme.palette.text.secondary }}>
            Select one business process to add or update its overview.
          </Typography>
        ) : (
          <>
            {businessProcessOverviewLoading ? (
              <Typography variant="body2" sx={{ mt: 1.5, color: theme.palette.text.secondary }}>
                Loading business process overview...
              </Typography>
            ) : null}
            {businessProcessOverviewError ? (
              <Alert severity="warning" sx={{ mt: 1.5 }}>
                {businessProcessOverviewError}
              </Alert>
            ) : null}
            <TextField
              label="Overview"
              value={businessProcessOverviewText}
              onChange={(event) => setBusinessProcessOverviewText(event.target.value)}
              fullWidth
              multiline
              minRows={4}
              disabled={businessProcessOverviewLoading || businessProcessOverviewSaving}
              inputProps={{ maxLength: 20000 }}
              sx={{ mt: 1.5 }}
            />
            {businessProcessOverview?.updated_at ? (
              <Typography variant="caption" sx={{ display: 'block', mt: 1, color: theme.palette.text.secondary }}>
                {`Last saved: ${formatRiskAnalysisTimestamp(businessProcessOverview.updated_at)}`}
              </Typography>
            ) : null}
          </>
        )}
      </Paper>

      <Paper
        elevation={0}
        sx={{
          mb: 3,
          p: 2,
          borderRadius: 2,
          border: `1px solid ${theme.palette.divider}`,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
              Concise risk list
            </Typography>
            <Typography variant="body2" sx={{ color: theme.palette.text.secondary, mt: 0.5 }}>
              Adding, removing, or changing risk descriptions invalidates this list. It has to be regenerated before risk analysis.
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            {conciseScopeReady && conciseList?.exists ? (
              <>
                <Button
                  variant="outlined"
                  onClick={() => setConciseListOpen(true)}
                  disabled={conciseLoading}
                  sx={{ whiteSpace: 'nowrap' }}
                >
                  View risks
                </Button>
                <Button
                  variant="outlined"
                  onClick={exportConciseListExcel}
                  disabled={conciseLoading || !Array.isArray(conciseList?.risks) || conciseList.risks.length === 0}
                  sx={{ whiteSpace: 'nowrap' }}
                >
                  Export Excel
                </Button>
              </>
            ) : null}
            <Button
              variant="contained"
              onClick={generateConciseList}
              disabled={!conciseScopeReady || conciseGenerating || conciseLoading}
              sx={{ whiteSpace: 'nowrap' }}
            >
              {conciseGenerating
                ? 'Generating...'
                : conciseList?.exists
                  ? 'Regenerate concise list'
                  : 'Generate concise list'}
            </Button>
          </Box>
        </Box>
        {!conciseScopeReady ? (
          <Typography variant="body2" sx={{ mt: 1.5, color: theme.palette.text.secondary }}>
            Select one unit and one business process to generate the concise risk list.
          </Typography>
        ) : conciseLoading ? (
          <Typography variant="body2" sx={{ mt: 1.5, color: theme.palette.text.secondary }}>
            Loading concise risk list...
          </Typography>
        ) : conciseList?.stale ? (
          <Alert severity="warning" sx={{ mt: 1.5 }}>
            Adding, removing, or changing risk descriptions invalidated this concise list. Regenerate it before running risk analysis.
          </Alert>
        ) : null}
      </Paper>

      <Dialog open={conciseListOpen} onClose={() => setConciseListOpen(false)} fullWidth maxWidth="md">
        <DialogTitle>Concise risk list</DialogTitle>
        <DialogContent>
          {Array.isArray(conciseList?.risks) && conciseList.risks.length > 0 ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
              {conciseList.risks.map((item, index) => (
                <Box key={`${item.risk}-${index}`}>
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>
                    {`${index + 1}. ${item.risk || '—'}`}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {`Control numbers: ${(Array.isArray(item.controlNumbers) ? item.controlNumbers : []).filter(Boolean).join(', ') || 'No control number'}`}
                  </Typography>
                </Box>
              ))}
            </Box>
          ) : (
            <Typography variant="body2" color="text.secondary">No concise risks are stored.</Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button
            onClick={exportConciseListExcel}
            disabled={!Array.isArray(conciseList?.risks) || conciseList.risks.length === 0}
          >
            Export Excel
          </Button>
          <Button onClick={() => setConciseListOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

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
            pt: 2,
            pb: 1.5,
            borderBottom: `1px solid ${theme.palette.divider}`,
          }}
        >
          <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>
            Showing {rows.length} of {totalCount} assigned-unit controls for the selected filters.
          </Typography>
        </Box>

        <Box sx={{ width: '100%', overflowX: 'auto', userSelect: 'none' }}>
          <Box sx={{ minWidth: 960 }}>
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
                    <Chip
                      size="small"
                      label={row.has_risk_analysis ? 'Generated' : 'Not generated'}
                      color={row.has_risk_analysis ? 'success' : 'default'}
                      variant={row.has_risk_analysis ? 'filled' : 'outlined'}
                      sx={{ mt: 0.75 }}
                    />
                    {row.has_risk_analysis && String(getFieldValue(row, 'model_name', 'modelName') || '').trim() ? (
                      <Tooltip title={String(getFieldValue(row, 'model_name', 'modelName') || '').trim()} arrow>
                        <Typography
                          variant="caption"
                          sx={{
                            display: 'block',
                            mt: 0.5,
                            color: theme.palette.text.secondary,
                            ...TABLE_TEXT_TRUNCATE_SX,
                          }}
                        >
                          {String(getFieldValue(row, 'model_name', 'modelName') || '').trim()}
                        </Typography>
                      </Tooltip>
                    ) : null}
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
                {String(analysisData?.analysis?.model_name || '').trim() ? (
                  <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>
                    Model: {String(analysisData.analysis.model_name).trim()}
                  </Typography>
                ) : null}
                {analysisData?.analysis?.response_json && !Array.isArray(analysisData.analysis.response_json.risks) ? (
                  <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>
                    Confidence: {analysisData.analysis.response_json.matchConfidence || 'N/A'}
                  </Typography>
                ) : null}
              </Box>
            </Box>
            {!controlConcise.loading && !controlConcise.exists ? (
              <Alert severity="warning">
                Generate the concise risk list for this unit and business process before analysing this control.
              </Alert>
            ) : null}
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
          <Button onClick={handleCloseDialog} disabled={analysisGenerating || Boolean(comparingRisk)}>
            Close
          </Button>
          <Button
            variant="contained"
            color="secondary"
            onClick={handleGenerateAnalysis}
            disabled={analysisLoading || analysisGenerating || !selectedControl || Boolean(comparingRisk) || controlConcise.loading || !controlConcise.exists}
          >
            {analysisGenerating ? 'Generating…' : 'Generate Risk Analysis'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={reportOpen} onClose={() => !reportLoading && setReportOpen(false)} fullWidth maxWidth="lg">
        <DialogTitle>Risk Analysis Report</DialogTitle>
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
                Financial year: {String(reportData?.meta?.financial_year || '').trim() || '—'}
                {' · '}
                Controls reviewed: {Number(reportData?.meta?.controls_reviewed || reportData?.controls?.length || 0)}
              </Typography>
              <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                {(reportData?.controls || []).map((control) => {
                  const response = control.response_json || {}
                  const storedRisks = Array.isArray(response.risks) ? response.risks : null
                  const pointers = Array.isArray(response.missingRiskPointers) ? response.missingRiskPointers : []
                  const missingRisks = storedRisks ? storedRisks.filter((item) => item?.status !== 'Addressed Risk') : []
                  return (
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
                          onClick={() => {
                            const formId = String(control.form_id || '').trim()
                            if (!formId) return
                            window.open(`/company-co/form/${encodeURIComponent(formId)}`, '_blank', 'noopener,noreferrer')
                          }}
                          endIcon={<ArrowOutwardRoundedIcon sx={{ fontSize: 16 }} />}
                          sx={{ whiteSpace: 'nowrap' }}
                        >
                          Open control
                        </Button>
                      </Box>
                      {storedRisks ? (
                        <Box sx={{
                          display: 'flex',
                          flexDirection: 'column',
                          border: `1px solid ${theme.palette.divider}`,
                          borderRadius: '10px',
                          overflow: 'hidden',
                        }}
                        >
                          <Box sx={{ p: 1.5 }}>
                            <Typography variant="body2" fontWeight={700} sx={{ mb: 1 }}>Missing / partially covered risks</Typography>
                            {missingRisks.length === 0 ? (
                              <Typography variant="body2" color="text.secondary">None</Typography>
                            ) : missingRisks.map((item, index) => (
                              <Box key={`missing-${item.risk}-${index}`} sx={{ mb: 1.25 }}>
                                <RiskStatementFields item={item} index={index + 1} />
                                <RiskOutputDetails item={item} indent />
                              </Box>
                            ))}
                          </Box>
                        </Box>
                      ) : (
                        <>
                      <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>
                        Matched sub-process: {response.matchedSubProcess || control.matched_sub_process || 'N/A'}
                      </Typography>
                      <Typography variant="body2" sx={{ color: theme.palette.text.secondary, mb: 1 }}>
                        Confidence: {response.matchConfidence || control.match_confidence || 'N/A'}
                      </Typography>
                      {pointers.length === 0 ? (
                        <Typography variant="body2" color="text.secondary">No missing-risk pointers returned.</Typography>
                      ) : pointers.map((item, index) => {
                        const risk = String(item?.risk || '').replace(/\s+/g, ' ').trim()
                        const comparison = response.riskComparisons?.[risk]
                          || Object.entries(response.riskComparisons || {}).find(([key]) => String(key).trim().toLowerCase() === risk.toLowerCase())?.[1]
                        const addressedBy = Array.isArray(comparison?.addressedBy) ? comparison.addressedBy.filter(Boolean) : []
                        return (
                          <Box key={`${risk}-${index}`} sx={{ mt: 1 }}>
                            <Typography variant="body2">{`${index + 1}. ${item?.pointer || '—'}`}</Typography>
                            {comparison?.addressedStatus ? (
                              <Typography variant="body2" color="text.secondary">
                                {comparison.addressedStatus}
                                {comparison.reason ? ` — ${comparison.reason}` : ''}
                                {addressedBy.length > 0 ? ` Addressed by ${addressedBy.join(', ')}.` : ''}
                              </Typography>
                            ) : null}
                          </Box>
                        )
                      })}
                        </>
                      )}
                    </Box>
                  )
                })}
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
                downloadRiskAnalysisReportPdf(reportData)
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

      <Dialog open={regenConfirmOpen} onClose={() => !batchGenerating && setRegenConfirmOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Regenerate risk analysis?</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            Some selected controls already have a risk analysis. Regenerating them will call the model again.
          </Typography>
          <Typography variant="body2" sx={{ mt: 1.5 }}>
            Already have summary: <strong>{Number(pendingGenerate?.existingCount || 0)}</strong>
          </Typography>
          <Typography variant="body2">
            Pending to generate: <strong>{Number(pendingGenerate?.pendingCount || 0)}</strong>
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRegenConfirmOpen(false)} disabled={batchGenerating}>Cancel</Button>
          <Button
            disabled={batchGenerating || Number(pendingGenerate?.pendingCount || 0) === 0}
            onClick={() => runGenerateSelected({ formIds: pendingGenerate?.formIds || [], regenerateExisting: false })}
          >
            Skip existing
          </Button>
          <Button
            variant="contained"
            color="warning"
            disabled={batchGenerating}
            onClick={() => runGenerateSelected({ formIds: pendingGenerate?.formIds || [], regenerateExisting: true })}
          >
            Regenerate all
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

export default RiskAnalysis
