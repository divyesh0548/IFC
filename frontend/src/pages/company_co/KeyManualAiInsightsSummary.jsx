import React, { useEffect, useState } from 'react'
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
import { useTheme } from '@mui/material/styles'
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded'
import PsychologyAltRoundedIcon from '@mui/icons-material/PsychologyAltRounded'
import SmartToyRoundedIcon from '@mui/icons-material/SmartToyRounded'
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded'
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded'
import { apiUrl } from '../../config/api'
import { useSyncGlobalLoading } from '../../contexts/GlobalLoadingContext'
import { PAGE_SUBHEADER_TEXT_SX } from '../../uiConstants'
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
      color: '#166534',
      borderColor: 'rgba(34,197,94,0.32)',
      backgroundColor: 'rgba(34,197,94,0.14)',
    }
  }

  if (normalizedStatus === 'in_progress' || normalizedStatus === 'in progress') {
    return {
      color: '#1d4ed8',
      borderColor: 'rgba(59,130,246,0.32)',
      backgroundColor: 'rgba(59,130,246,0.14)',
    }
  }

  if (normalizedStatus === 'failed') {
    return {
      color: '#b91c1c',
      borderColor: 'rgba(239,68,68,0.32)',
      backgroundColor: 'rgba(239,68,68,0.14)',
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

function KeyManualAiInsightsSummary() {
  const theme = useTheme()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [runs, setRuns] = useState([])
  const [run, setRun] = useState(null)
  const [rows, setRows] = useState([])
  const [errorMessage, setErrorMessage] = useState('')
  useSyncGlobalLoading(loading)

  useEffect(() => {
    let cancelled = false

    const fetchRun = async () => {
      setLoading(true)
      setErrorMessage('')
      try {
        const runId = String(searchParams.get('run_id') || '').trim()
        const suffix = runId ? `?run_id=${encodeURIComponent(runId)}` : ''
        const response = await fetch(apiUrl(`/api/company-co/ai-insights/key-manual-summary${suffix}`), {
          credentials: 'include',
        })
        const data = await response.json()

        if (!response.ok || !data?.success) {
          throw new Error(data?.message || 'Failed to fetch AI insights summary')
        }

        if (!cancelled) {
          setRuns(Array.isArray(data.data?.runs) ? data.data.runs : [])
          setRun(data.data?.run || null)
          setRows(Array.isArray(data.data?.rows) ? data.data.rows : [])
        }
      } catch (error) {
        console.error('Error fetching key manual AI insights summary:', error)
        if (!cancelled) {
          setRuns([])
          setRun(null)
          setRows([])
          setErrorMessage(error.message || 'Failed to fetch AI insights summary')
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    fetchRun()

    return () => {
      cancelled = true
    }
  }, [searchParams])

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
    setGenerating(true)
    try {
      let availabilityData = null

      try {
        const availabilityResponse = await fetch(apiUrl('/api/company-co/ai-insights/key-manual-summary/availability'), {
          credentials: 'include',
        })
        availabilityData = await availabilityResponse.json()

        if (!availabilityResponse.ok || !availabilityData?.success || !availabilityData?.data?.reachable) {
          toast('This feature is under development')
          return
        }
      } catch (availabilityError) {
        console.error('Error checking AI summary availability:', availabilityError)
        toast('This feature is under development')
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
        throw new Error(data?.message || 'Failed to generate AI summary')
      }

      const updatedParams = new URLSearchParams(searchParams)
      updatedParams.set('run_id', String(data.data?.run_id || '').trim())
      setSearchParams(updatedParams)
      toast.success(
        `AI summary generated for ${Number(data.data?.control_count || 0)} controls using ${data.data?.model_name || 'the configured model'}.`
      )
    } catch (error) {
      console.error('Error generating AI summary:', error)
      toast.error(error.message || 'Failed to generate AI summary')
    } finally {
      setGenerating(false)
    }
  }

  const handleDeleteRun = async () => {
    const currentRunId = String(run?.id || '').trim()
    if (!currentRunId) return

    const confirmed = window.confirm(`Delete AI insights run ${currentRunId}? This will also remove all stored insight rows for this run.`)
    if (!confirmed) return

    setDeleting(true)
    try {
      const response = await fetch(apiUrl(`/api/company-co/ai-insights/key-manual-summary/${encodeURIComponent(currentRunId)}`), {
        method: 'DELETE',
        credentials: 'include',
      })
      const data = await response.json()

      if (!response.ok || !data?.success) {
        throw new Error(data?.message || 'Failed to delete AI insights run')
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
      toast.error(error.message || 'Failed to delete AI insights run')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Box sx={{ maxWidth: '100%', mx: 'auto', px: 0, py: 4 }}>
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
            All manual and key controls are included in high risk category.
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
          <Button
            variant="contained"
            color="secondary"
            onClick={handleGenerateAiSummary}
            disabled={generating}
          >
            {generating ? 'Generating…' : 'Generate AI Summary'}
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

      <Paper
        elevation={3}
        sx={{
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
            color="error"
            startIcon={<DeleteOutlineRoundedIcon />}
            onClick={handleDeleteRun}
            disabled={!run || deleting}
            sx={{ minWidth: { xs: '100%', sm: 140 }, whiteSpace: 'nowrap' }}
          >
            {deleting ? 'Deleting…' : 'Delete Run'}
          </Button>
        </Box>
      </Paper>

      {run ? (
        <Paper
          elevation={3}
          sx={{
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
