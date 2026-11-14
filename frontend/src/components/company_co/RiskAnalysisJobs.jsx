import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import { apiUrl } from '../../config/api'

const LABELS = {
  queued: 'Queued — waiting for the AI service',
  generating_concise: 'Generating concise risk list',
  generating_missing: 'Generating overall missing risks',
  completed: 'Completed — results are in Overall missing risks',
  failed: 'Could not generate risks',
}

export default function RiskAnalysisJobs({ refreshKey = 0, onCompleted, hideFailed = false }) {
  const [jobs, setJobs] = useState([])
  const [error, setError] = useState('')
  const known = useRef(new Map())
  useEffect(() => {
    let cancelled = false
    let timer
    const load = async () => {
      try {
        const response = await fetch(apiUrl('/api/company-co/risk-analysis/jobs'), { credentials: 'include' })
        const data = await response.json()
        if (!response.ok || !data.success) throw new Error(data.message || 'Could not load automatic risk analysis status.')
        if (cancelled) return
        const next = data.data || []
        if (next.some((job) => job.status === 'completed' && known.current.has(job.id) && known.current.get(job.id) !== 'completed')) {
          onCompleted?.()
        }
        known.current = new Map(next.map((job) => [job.id, job.status]))
        setJobs(next)
        setError('')
      } catch (err) {
        if (!cancelled) setError(err.message)
      } finally {
        if (!cancelled) timer = window.setTimeout(load, 10000)
      }
    }
    load()
    return () => { cancelled = true; window.clearTimeout(timer) }
  }, [refreshKey, onCompleted])

  if (error) return <Alert severity="warning" sx={{ my: 2 }}>{error}</Alert>
  const visibleJobs = hideFailed ? jobs.filter((job) => job.status !== 'failed') : jobs
  if (!visibleJobs.length) return null
  return (
    <Box sx={{ my: 2, p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
      <Typography variant="subtitle1" fontWeight={700}>Automatic risk analysis</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
        Requests run one at a time. Select the matching unit and business process in Risk Analysis to view results.
      </Typography>
      <Box sx={{ maxHeight: 240, overflowY: 'auto' }}>
        {visibleJobs.map((job) => (
          <Alert key={job.id} severity={job.status === 'failed' ? 'warning' : job.status === 'completed' ? 'success' : 'info'} sx={{ mb: 1 }}>
            <Typography variant="body2" fontWeight={600}>{job.unit_name || job.unit_id} · {job.business_process}</Typography>
            <Typography variant="caption" component="div">
              Requested {new Date(job.created_at).toLocaleString()}
            </Typography>
            {LABELS[job.status] || job.status}
            {job.status === 'queued' && job.attempts > 0 ? ' — retry scheduled' : ''}
            {job.status === 'failed' ? <Typography variant="body2">{job.error_message} Generate the concise list, then missing risks manually from Risk Analysis.</Typography> : null}
          </Alert>
        ))}
      </Box>
      <Button component={Link} to="/company-co/risk-analysis" size="small">Open Risk Analysis → Overall missing risks</Button>
    </Box>
  )
}
