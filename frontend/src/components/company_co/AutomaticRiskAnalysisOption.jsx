import { useEffect, useState } from 'react'
import Accordion from '@mui/material/Accordion'
import AccordionSummary from '@mui/material/AccordionSummary'
import AccordionDetails from '@mui/material/AccordionDetails'
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded'
import { apiUrl } from '../../config/api'
import Typography from '@mui/material/Typography'
import FormControl from '@mui/material/FormControl'
import FormLabel from '@mui/material/FormLabel'
import RadioGroup from '@mui/material/RadioGroup'
import FormControlLabel from '@mui/material/FormControlLabel'
import Radio from '@mui/material/Radio'
import Button from '@mui/material/Button'
import { Link } from 'react-router-dom'

export default function AutomaticRiskAnalysisOption({ value, onChange, disabled }) {
  const [available, setAvailable] = useState(false)
  useEffect(() => {
    let cancelled = false
    let timer
    let controller
    const check = async () => {
      controller = new AbortController()
      const timeout = window.setTimeout(() => controller.abort(), 20000)
      try {
        const response = await fetch(apiUrl('/api/company-co/risk-analysis/availability'), {
          credentials: 'include', signal: controller.signal,
        })
        const data = await response.json()
        if (cancelled) return
        const reachable = Boolean(response.ok && data?.success && data?.data?.reachable)
        setAvailable(reachable)
        if (!reachable) onChange(false)
      } catch {
        if (!cancelled) { setAvailable(false); onChange(false) }
      } finally {
        window.clearTimeout(timeout)
        if (!cancelled) timer = window.setTimeout(check, 30000)
      }
    }
    check()
    return () => { cancelled = true; controller?.abort(); window.clearTimeout(timer) }
  }, [onChange])

  if (!available) return null
  return (
    <Accordion disableGutters elevation={0} sx={{ my: 2, border: '1px solid', borderColor: 'divider', borderRadius: '8px !important', '&:before': { display: 'none' } }}>
      <AccordionSummary expandIcon={<ExpandMoreRoundedIcon />} aria-controls="automatic-risk-analysis-content" id="automatic-risk-analysis-heading">
        <Typography variant="body2" fontWeight={600}>Automatic missing-risk generation · {value ? 'Yes' : 'No'}</Typography>
      </AccordionSummary>
      <AccordionDetails id="automatic-risk-analysis-content">
      <FormControl disabled={disabled}>
        <FormLabel sx={{ color: 'text.primary' }} id="automatic-risk-analysis-label">
          Automatically generate missing risks after this import?
        </FormLabel>
        <RadioGroup row aria-labelledby="automatic-risk-analysis-label" value={value ? 'yes' : 'no'}
          onChange={(event) => onChange(event.target.value === 'yes')}>
          <FormControlLabel value="no" control={<Radio />} label="No" />
          <FormControlLabel value="yes" control={<Radio />} label="Yes" />
        </RadioGroup>
      </FormControl>
      <Typography variant="body2" color="text.secondary">
        Generates the concise risk list first, then overall missing risks for the selected unit and business process.
        You can continue working while it runs in the background.
      </Typography>
      <Button component={Link} to="/company-co/risk-analysis" target="_blank" rel="noopener" size="small" sx={{ mt: 0.5 }}>
        View results: Risk Analysis → Overall missing risks
      </Button>
      </AccordionDetails>
    </Accordion>
  )
}
