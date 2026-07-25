import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import Button from '@mui/material/Button'
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import Alert from '@mui/material/Alert'
import FormControl from '@mui/material/FormControl'
import InputLabel from '@mui/material/InputLabel'
import MenuItem from '@mui/material/MenuItem'
import Select from '@mui/material/Select'
import Chip from '@mui/material/Chip'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import { useTheme } from '@mui/material/styles'
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded'
import PsychologyAltRoundedIcon from '@mui/icons-material/PsychologyAltRounded'
import SmartToyRoundedIcon from '@mui/icons-material/SmartToyRounded'
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded'
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded'
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded'
import { apiUrl } from '../../config/api'
import { useSyncGlobalLoading } from '../../contexts/GlobalLoadingContext'
import { DASHBOARD_PAGE_OUTER_SX, DASHBOARD_PAPER_SX, PAGE_SUBHEADER_TEXT_SX } from '../../uiConstants'
import { toast } from 'react-hot-toast'

function formatDateTime(value) {
  if (!value) return 'Not available'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Not available'
  return date.toLocaleString()
}

function formatRunOptionLabel(run) {
  return `Run ${run.id} - ${run.model_name || 'Model unavailable'} - ${formatDateTime(run.created_at)}`
}

function formatModelName(value) {
  return String(value || 'Model unavailable').trim().toUpperCase()
}

function getStatusChipSx(theme, status) {
  const normalizedStatus = String(status || '').trim().toLowerCase()

  if (normalizedStatus === 'completed' || normalizedStatus === 'success') {
    return {
      color: theme.palette.mode === 'dark' ? '#dcfce7' : '#166534',
      borderColor: theme.palette.mode === 'dark' ? 'rgba(74,222,128,0.52)' : 'rgba(34,197,94,0.32)',
      backgroundColor: theme.palette.mode === 'dark' ? 'rgba(20,83,45,0.72)' : 'rgba(34,197,94,0.14)',
    }
  }

  if (normalizedStatus === 'in_progress' || normalizedStatus === 'in progress') {
    return {
      color: theme.palette.mode === 'dark' ? '#dbeafe' : '#1d4ed8',
      borderColor: theme.palette.mode === 'dark' ? 'rgba(96,165,250,0.52)' : 'rgba(59,130,246,0.32)',
      backgroundColor: theme.palette.mode === 'dark' ? 'rgba(30,64,175,0.72)' : 'rgba(59,130,246,0.14)',
    }
  }

  if (normalizedStatus === 'failed') {
    return {
      color: theme.palette.mode === 'dark' ? '#fee2e2' : '#b91c1c',
      borderColor: theme.palette.mode === 'dark' ? 'rgba(248,113,113,0.56)' : 'rgba(239,68,68,0.32)',
      backgroundColor: theme.palette.mode === 'dark' ? 'rgba(127,29,29,0.78)' : 'rgba(239,68,68,0.14)',
    }
  }

  return {
    color: theme.palette.mode === 'dark' ? '#e2e8f0' : '#0f172a',
    borderColor: theme.palette.mode === 'dark' ? 'rgba(226,232,240,0.24)' : 'rgba(15,23,42,0.16)',
    backgroundColor: theme.palette.mode === 'dark' ? 'rgba(226,232,240,0.10)' : 'rgba(15,23,42,0.06)',
  }
}

function formatStatusLabel(status) {
  const normalizedStatus = String(status || '').trim().toLowerCase()
  if (normalizedStatus === 'in_progress') return 'In Progress'
  if (normalizedStatus === 'completed') return 'Success'
  if (normalizedStatus === 'failed') return 'Failed'
  return String(status || 'Unknown').trim() || 'Unknown'
}

function openRacmDetail(formId) {
  const normalizedFormId = String(formId || '').trim()
  if (!normalizedFormId) return
  window.open(`/company_co/form/${encodeURIComponent(normalizedFormId)}`, '_blank', 'noopener,noreferrer')
}

function formatServerErrorToast(errorCode) {
  const normalizedErrorCode = String(errorCode || '').trim() || 'UNKNOWN_ERROR'
  return `Error occured on server (${normalizedErrorCode})`
}

function formatRunSummaryFieldLabel(label) {
  return `${label}:`
}

function isInProgressStatus(status) {
  const normalizedStatus = String(status || '').trim().toLowerCase()
  return normalizedStatus === 'in_progress' || normalizedStatus === 'in progress'
}

function KeyManualAiInsightsSummary() {
  const theme = useTheme()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const generatingRef = useRef(false)
  const [llmBusy, setLlmBusy] = useState(false)
  const [refreshingRuns, setRefreshingRuns] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [runs, setRuns] = useState([])
  const [run, setRun] = useState(null)
  const [rows, setRows] = useState([])
  const [excludedEntityLevelCount, setExcludedEntityLevelCount] = useState(0)
  const [excludedNoticeDismissed, setExcludedNoticeDismissed] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  useSyncGlobalLoading(loading)

  const fetchRun = useCallback(async (runIdOverride, { shouldApply = () => true } = {}) => {
    setLoading(true)
    setErrorMessage('')
    try {
      const requestedRunId = typeof runIdOverride === 'string'
        ? runIdOverride.trim()
        : String(searchParams.get('run_id') || '').trim()
      const suffix = requestedRunId ? `?run_id=${encodeURIComponent(requestedRunId)}` : ''
      const response = await fetch(apiUrl(`/api/company-co/ai-insights/key-manual-summary${suffix}`), {
        credentials: 'include',
      })
      const data = await response.json()

      if (!response.ok || !data?.success) {
        throw new Error(data?.message || 'Failed to fetch AI insights summary')
      }

      if (shouldApply()) {
        setRuns(Array.isArray(data.data?.runs) ? data.data.runs : [])
        setRun(data.data?.run || null)
        setRows(Array.isArray(data.data?.rows) ? data.data.rows : [])
        setExcludedEntityLevelCount(Number(data.data?.excluded_entity_level_count || 0))
      }

      return data.data || null
    } catch (error) {
      console.error('Error fetching key manual AI insights summary:', error)
      if (shouldApply()) {
        setRuns([])
        setRun(null)
        setRows([])
        setExcludedEntityLevelCount(0)
        setErrorMessage(error.message || 'Failed to fetch AI insights summary')
      }
      return null
    } finally {
      if (shouldApply()) {
        setLoading(false)
      }
    }
  }, [searchParams])

  const fetchAiAvailability = useCallback(async ({ showUnavailableToast = false } = {}) => {
    try {
      const availabilityResponse = await fetch(apiUrl('/api/company-co/ai-insights/key-manual-summary/availability'), {
        credentials: 'include',
      })
      const availabilityData = await availabilityResponse.json()
      const reachable = Boolean(availabilityData?.data?.reachable)
      const busy = Boolean(availabilityData?.data?.llm_busy)

      if (!availabilityResponse.ok || !availabilityData?.success || !reachable) {
        setLlmBusy(false)
        if (showUnavailableToast) toast('This feature is under development')
        return { reachable: false, busy: false }
      }

      setLlmBusy(busy)
      return { reachable, busy }
    } catch (availabilityError) {
      console.error('Error checking AI summary availability:', availabilityError)
      setLlmBusy(false)
      if (showUnavailableToast) toast('This feature is under development')
      return { reachable: false, busy: false }
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    fetchRun(undefined, { shouldApply: () => !cancelled })

    return () => {
      cancelled = true
    }
  }, [fetchRun])

  useEffect(() => {
    let cancelled = false

    const refreshAvailability = async () => {
      const availability = await fetchAiAvailability()
      if (!cancelled) {
        setLlmBusy(Boolean(availability.busy))
      }
    }

    refreshAvailability()
    const intervalId = window.setInterval(refreshAvailability, 5000)

    return () => {
      cancelled = true
      window.clearInterval(intervalId)
    }
  }, [fetchAiAvailability])

  const handleRunChange = (event) => {
    const nextRunId = String(event.target.value || '').trim()
    const nextParams = new URLSearchParams(searchParams)

    if (nextRunId) {
      nextParams.set('run_id', nextRunId)
    } else {
      nextParams.delete('run_id')
    }

    setSearchParams(nextParams)
  }

  const handleGenerateAiSummary = async () => {
    if (generatingRef.current || generating || llmBusy) {
      toast('LLM Server is busy, Try again after some moments')
      return
    }

    generatingRef.current = true
    setGenerating(true)
    try {
      const availability = await fetchAiAvailability({ showUnavailableToast: true })
      if (!availability.reachable) {
        return
      }
      if (availability.busy) {
        toast('LLM Server is busy, Try again after some moments')
        return
      }

      const nextParams = new URLSearchParams(searchParams)
      nextParams.delete('run_id')
      const suffix = nextParams.toString() ? `?${nextParams.toString()}` : ''
      const response = await fetch(apiUrl(`/api/company-co/ai-insights/key-manual-summary/generate${suffix}`), {
        method: 'POST',
        credentials: 'include',
      })
      const data = await response.json()

      if (!response.ok || !data?.success) {
        const error = new Error(data?.message || 'Failed to generate AI summary')
        error.serverCode = String(data?.code || '').trim()
        error.status = response.status
        throw error
      }

      const generatedRunId = String(data.data?.run_id || '').trim()
      if (generatedRunId) {
        const updatedParams = new URLSearchParams(searchParams)
        updatedParams.set('run_id', generatedRunId)
        setSearchParams(updatedParams)
        await fetchRun(generatedRunId)
      }
      toast.success(
        `AI summary generated for ${Number(data.data?.control_count || 0)} controls using ${data.data?.model_name || 'the configured model'}. Excluded Entity Level Controls: ${Number(data.data?.excluded_entity_level_count || 0)}.`
      )
    } catch (error) {
      console.error('Error generating AI summary:', error)
      if (error?.status === 409 || error?.serverCode === 'AI_MODEL_BUSY') {
        setLlmBusy(true)
        toast('LLM Server is busy, Try again after some moments')
      } else {
        toast.error(formatServerErrorToast(error?.serverCode))
      }
    } finally {
      generatingRef.current = false
      setGenerating(false)
      fetchAiAvailability()
    }
  }

  const handleRefreshRuns = async () => {
    setRefreshingRuns(true)
    try {
      await Promise.all([
        fetchRun(),
        fetchAiAvailability(),
      ])
      toast.success('AI insights runs refreshed.')
    } finally {
      setRefreshingRuns(false)
    }
  }

  const handleDeleteRun = async () => {
    const currentRunId = String(run?.id || '').trim()
    if (!currentRunId) return

    if (isInProgressStatus(run?.status)) {
      toast('In-progress AI insights runs cannot be deleted. Try again after generation completes.')
      setDeleteDialogOpen(false)
      return
    }

    setDeleting(true)
    try {
      const response = await fetch(apiUrl(`/api/company-co/ai-insights/key-manual-summary/${encodeURIComponent(currentRunId)}`), {
        method: 'DELETE',
        credentials: 'include',
      })
      const data = await response.json()

      if (!response.ok || !data?.success) {
        const error = new Error(data?.message || 'Failed to delete AI insights run')
        error.serverCode = String(data?.code || '').trim()
        error.status = response.status
        throw error
      }

      const remainingRuns = runs.filter((item) => item.id !== currentRunId)
      const nextParams = new URLSearchParams(searchParams)

      if (remainingRuns.length > 0) {
        nextParams.set('run_id', remainingRuns[0].id)
      } else {
        nextParams.delete('run_id')
      }

      setSearchParams(nextParams)
      toast.success('AI insights run deleted successfully.')
    } catch (error) {
      console.error('Error deleting AI insights run:', error)
      if (error?.status === 409 || error?.serverCode === 'AI_RUN_IN_PROGRESS') {
        toast('In-progress AI insights runs cannot be deleted. Try again after generation completes.')
      } else {
        toast.error(error.message || 'Failed to delete AI insights run')
      }
    } finally {
      setDeleting(false)
      setDeleteDialogOpen(false)
    }
  }

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
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <Box
          sx={{
            position: 'absolute',
            top: -48,
            right: -12,
            width: 180,
            height: 180,
            borderRadius: '50%',
            background: theme.palette.mode === 'dark'
              ? 'radial-gradient(circle, rgba(56,189,248,0.20) 0%, rgba(56,189,248,0) 72%)'
              : 'radial-gradient(circle, rgba(14,165,233,0.18) 0%, rgba(14,165,233,0) 72%)',
            pointerEvents: 'none',
          }}
        />
        <Box>
          <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 1, mb: 1.25 }}>
            <Chip
              icon={<AutoAwesomeRoundedIcon />}
              label="AI Insight Workspace"
              size="small"
              sx={{
                fontWeight: 700,
                color: theme.palette.mode === 'dark' ? '#dbeafe' : '#0f172a',
                backgroundColor: theme.palette.mode === 'dark' ? 'rgba(59,130,246,0.18)' : 'rgba(59,130,246,0.12)',
              }}
            />
            <Box sx={{ display: 'flex', gap: 0.75, color: theme.palette.primary.main }}>
              <PsychologyAltRoundedIcon sx={{ fontSize: 20 }} />
              <SmartToyRoundedIcon sx={{ fontSize: 20 }} />
            </Box>
          </Box>
          <Typography variant="h4" sx={{ fontWeight: 800, color: theme.palette.text.primary }}>
            High Risk Manual Key Control Summary
          </Typography>
          <Typography variant="body2" sx={PAGE_SUBHEADER_TEXT_SX}>
            Entity Level Controls are excluded from AI insight generation because they are not treated as high risk controls in this category.
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
          <Button
            variant="contained"
            color="secondary"
            onClick={handleGenerateAiSummary}
            disabled={generating}
          >
            {generating ? 'Generating AI Summary...' : 'Generate AI Summary'}
          </Button>
          <Button variant="contained" onClick={() => navigate('/company_co/dashboard')}>
            Back To Dashboard
          </Button>
        </Box>
      </Box>

      {errorMessage ? (
        <Alert severity="info" sx={{ mb: 3 }}>
          {errorMessage}
        </Alert>
      ) : null}

      {excludedEntityLevelCount > 0 && !excludedNoticeDismissed ? (
        <Alert
          severity="info"
          onClose={() => setExcludedNoticeDismissed(true)}
          sx={{ mb: 3 }}
        >
          {excludedEntityLevelCount} Entity Level Control{excludedEntityLevelCount === 1 ? '' : 's'} excluded from AI insight generation because they are not treated as high risk controls in this category.
        </Alert>
      ) : null}

      <Paper
        elevation={3}
        sx={{
          ...DASHBOARD_PAPER_SX,
          p: 3,
          mb: 3,
          borderRadius: 3,
          border: `1px solid ${theme.palette.divider}`,
          boxShadow: theme.palette.mode === 'dark'
            ? '0 10px 28px rgba(0, 0, 0, 0.28)'
            : '0 12px 30px rgba(15, 23, 42, 0.08)',
          background: theme.palette.mode === 'dark'
            ? 'linear-gradient(135deg, rgba(15,23,42,0.96) 0%, rgba(15,23,42,0.82) 100%)'
            : 'linear-gradient(135deg, rgba(248,250,252,0.98) 0%, rgba(239,246,255,0.92) 100%)',
        }}
      >
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            flexDirection: { xs: 'column', sm: 'row' },
          }}
        >
          <FormControl fullWidth size="small">
            <InputLabel id="ai-run-select-label">Select Run</InputLabel>
            <Select
              labelId="ai-run-select-label"
              id="ai-run-select"
              value={run?.id || ''}
              label="Select Run"
              onChange={handleRunChange}
              displayEmpty
              renderValue={(selected) => {
                if (!selected) return 'Select run'
                const selectedRun = runs.find((item) => item.id === selected)
                if (!selectedRun) return `Run ${selected}`
                return (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
                    <Typography
                      variant="body2"
                      sx={{
                        fontWeight: 600,
                        color: theme.palette.text.primary,
                        minWidth: 0,
                        flex: 1,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {formatRunOptionLabel(selectedRun)}
                    </Typography>
                    <Chip
                      label={formatStatusLabel(selectedRun.status)}
                      size="small"
                      variant="outlined"
                      sx={{
                        fontWeight: 700,
                        height: 24,
                        ...getStatusChipSx(theme, selectedRun.status),
                      }}
                    />
                  </Box>
                )
              }}
            >
              {runs.map((item) => (
                <MenuItem key={item.id} value={item.id}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%', minWidth: 0 }}>
                    <Typography
                      variant="body2"
                      sx={{
                        color: theme.palette.text.primary,
                        fontWeight: 500,
                        minWidth: 0,
                        flex: 1,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {formatRunOptionLabel(item)}
                    </Typography>
                    <Chip
                      label={formatStatusLabel(item.status)}
                      size="small"
                      variant="outlined"
                      sx={{
                        fontWeight: 700,
                        height: 24,
                        ...getStatusChipSx(theme, item.status),
                      }}
                    />
                  </Box>
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <Button
            variant="outlined"
            startIcon={<RefreshRoundedIcon />}
            onClick={handleRefreshRuns}
            disabled={refreshingRuns}
            sx={{ minWidth: { xs: '100%', sm: 132 }, whiteSpace: 'nowrap' }}
          >
            {refreshingRuns ? 'Refreshing...' : 'Refresh Runs'}
          </Button>
          <Button
            variant="outlined"
            color="error"
            startIcon={<DeleteOutlineRoundedIcon />}
            onClick={() => {
              if (isInProgressStatus(run?.status)) {
                toast('In-progress AI insights runs cannot be deleted. Try again after generation completes.')
                return
              }
              setDeleteDialogOpen(true)
            }}
            disabled={!run || deleting}
            sx={{ minWidth: { xs: '100%', sm: 140 }, whiteSpace: 'nowrap' }}
          >
            {deleting ? 'Deleting…' : 'Delete Run'}
          </Button>
        </Box>
      </Paper>

      <Dialog
        open={deleteDialogOpen}
        onClose={deleting ? undefined : () => setDeleteDialogOpen(false)}
        fullWidth
        maxWidth="sm"
        PaperProps={{
          sx: {
            borderRadius: 3,
            border: `1px solid ${theme.palette.divider}`,
            background: theme.palette.mode === 'dark'
              ? 'linear-gradient(180deg, rgba(15,23,42,0.98) 0%, rgba(30,41,59,0.96) 100%)'
              : 'linear-gradient(180deg, rgba(255,255,255,0.99) 0%, rgba(248,250,252,0.98) 100%)',
          },
        }}
      >
        <DialogTitle sx={{ fontWeight: 800, pb: 1 }}>
          Delete AI Insights Run
        </DialogTitle>
        <DialogContent sx={{ pt: '8px !important' }}>
          <Typography variant="body2" sx={{ mb: 2, color: theme.palette.text.secondary }}>
            {isInProgressStatus(run?.status)
              ? 'This run is still being generated and cannot be deleted until processing completes.'
              : 'This will permanently remove the selected run and all stored insight rows linked to it.'}
          </Typography>

          {run ? (
            <Box
              sx={{
                borderRadius: 2.5,
                border: `1px solid ${theme.palette.divider}`,
                backgroundColor: theme.palette.mode === 'dark' ? 'rgba(148,163,184,0.08)' : 'rgba(15,23,42,0.03)',
                p: 2,
                display: 'grid',
                gap: 1.25,
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, flexWrap: 'wrap' }}>
                <Typography variant="body2" sx={{ fontWeight: 700, color: theme.palette.text.primary }}>
                  {formatRunSummaryFieldLabel('Run ID')} {run.id}
                </Typography>
                <Chip
                  label={formatStatusLabel(run.status)}
                  size="small"
                  variant="outlined"
                  sx={{
                    fontWeight: 700,
                    height: 26,
                    ...getStatusChipSx(theme, run.status),
                  }}
                />
              </Box>
              <Typography variant="body2" sx={{ color: theme.palette.text.primary }}>
                <Box component="span" sx={{ fontWeight: 700 }}>
                  {formatRunSummaryFieldLabel('Model')}
                </Box>{' '}
                {formatModelName(run.model_name)}
              </Typography>
              <Typography variant="body2" sx={{ color: theme.palette.text.primary }}>
                <Box component="span" sx={{ fontWeight: 700 }}>
                  {formatRunSummaryFieldLabel('Created')}
                </Box>{' '}
                {formatDateTime(run.created_at)}
              </Typography>
              <Typography variant="body2" sx={{ color: theme.palette.text.primary }}>
                <Box component="span" sx={{ fontWeight: 700 }}>
                  {formatRunSummaryFieldLabel('Stored Controls')}
                </Box>{' '}
                {Number(run.row_count || 0)}
              </Typography>
            </Box>
          ) : null}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, pt: 0.5 }}>
          <Button
            onClick={() => setDeleteDialogOpen(false)}
            disabled={deleting}
            variant="text"
          >
            Cancel
          </Button>
          <Button
            onClick={handleDeleteRun}
            disabled={!run || deleting || isInProgressStatus(run?.status)}
            variant="contained"
            color="error"
            startIcon={<DeleteOutlineRoundedIcon />}
          >
            {deleting ? 'Deleting…' : 'Delete Run'}
          </Button>
        </DialogActions>
      </Dialog>

      {run ? (
        <Paper
          elevation={3}
          sx={{
            ...DASHBOARD_PAPER_SX,
            p: 2.5,
            mb: 3,
            borderRadius: 3,
            border: `1px solid ${theme.palette.divider}`,
            boxShadow: theme.palette.mode === 'dark'
              ? '0 10px 28px rgba(0, 0, 0, 0.28)'
              : '0 12px 30px rgba(15, 23, 42, 0.08)',
          }}
        >
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1.5,
              flexWrap: 'wrap',
            }}
          >
            <AutoAwesomeRoundedIcon sx={{ color: theme.palette.primary.main }} />
            <Typography variant="body1" sx={{ fontWeight: 700, color: theme.palette.text.primary }}>
              {formatModelName(run.model_name)}
            </Typography>
            <Chip
              label={`${run.row_count} controls`}
              size="small"
              variant="outlined"
              sx={{
                fontWeight: 700,
                color: theme.palette.mode === 'dark' ? '#e2e8f0' : '#0f172a',
                borderColor: theme.palette.mode === 'dark' ? 'rgba(226,232,240,0.45)' : 'rgba(15,23,42,0.24)',
                backgroundColor: theme.palette.mode === 'dark' ? 'rgba(226,232,240,0.10)' : 'rgba(15,23,42,0.06)',
              }}
            />
          </Box>
        </Paper>
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
        {/* <Box
          sx={{
            px: 3,
            pt: 3,
            pb: 2,
            borderBottom: `1px solid ${theme.palette.divider}`,
          }}
        >
          <Typography variant="h6" sx={{ fontWeight: 700, color: theme.palette.text.primary }}>
            Stored Insight Rows
          </Typography>
        </Box> */}

        <Box sx={{ width: '100%', overflowX: 'auto' }}>
          <Box sx={{ minWidth: 980 }}>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: '220px 220px minmax(420px, 1fr)',
                borderBottom: `1px solid ${theme.palette.divider}`,
                backgroundColor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.03)' : theme.palette.grey[100],
              }}
            >
              {['Control Number', 'Business Process', 'Rationalisation Opportunity'].map((column) => (
                <Box key={column} sx={{ px: 2, py: 1.75, borderRight: `1px solid ${theme.palette.divider}`, '&:last-of-type': { borderRight: 'none' } }}>
                  <Typography variant="body2" sx={{ fontWeight: 700, color: theme.palette.text.primary }}>
                    {column}
                  </Typography>
                </Box>
              ))}
            </Box>

            {loading ? (
              <Box sx={{ px: 3, py: 4 }}>
                <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>
                  Loading AI insight rows...
                </Typography>
              </Box>
            ) : rows.length === 0 ? (
              <Box sx={{ px: 3, py: 4 }}>
                <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>
                  No stored AI insight rows found for this run.
                </Typography>
              </Box>
            ) : (
              rows.map((row, index) => (
                <Box
                  key={row.id}
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: '220px 220px minmax(420px, 1fr)',
                    borderBottom: index === rows.length - 1 ? 'none' : `1px solid ${theme.palette.divider}`,
                    backgroundColor: index % 2 === 0
                      ? 'transparent'
                      : theme.palette.mode === 'dark'
                        ? 'rgba(255,255,255,0.02)'
                        : theme.palette.grey[50],
                  }}
                >
                  <Box
                    sx={{
                      px: 2,
                      py: 1.75,
                      borderRight: `1px solid ${theme.palette.divider}`,
                    }}
                  >
                    <Box
                      component="button"
                      type="button"
                      onClick={() => openRacmDetail(row.form_id)}
                      disabled={!row.form_id}
                      sx={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 0.75,
                        p: 0,
                        border: 'none',
                        background: 'transparent',
                        color: row.form_id ? theme.palette.primary.main : theme.palette.text.secondary,
                        cursor: row.form_id ? 'pointer' : 'not-allowed',
                        font: 'inherit',
                      }}
                    >
                      <Typography
                        variant="body2"
                        sx={{
                          color: 'inherit',
                          fontWeight: 700,
                          textDecoration: row.form_id ? 'underline' : 'none',
                          textUnderlineOffset: '3px',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {row.control_number}
                      </Typography>
                      {row.form_id ? <OpenInNewRoundedIcon sx={{ fontSize: 16 }} /> : null}
                    </Box>
                  </Box>

                  <Box
                    sx={{
                      px: 2,
                      py: 1.75,
                      borderRight: `1px solid ${theme.palette.divider}`,
                    }}
                  >
                    <Typography
                      variant="body2"
                      sx={{
                        color: theme.palette.text.primary,
                        fontWeight: 500,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {row.business_process || 'Unassigned'}
                    </Typography>
                  </Box>

                  <Box
                    sx={{
                      px: 2,
                      py: 1.75,
                    }}
                  >
                    <Typography
                      variant="body2"
                      sx={{
                        color: theme.palette.text.primary,
                        fontWeight: 500,
                        whiteSpace: 'normal',
                      }}
                    >
                      {row.rationalisation_opportunity}
                    </Typography>
                  </Box>
                </Box>
              ))
            )}
          </Box>
        </Box>
      </Paper>
    </Box>
  )
}

export default KeyManualAiInsightsSummary
