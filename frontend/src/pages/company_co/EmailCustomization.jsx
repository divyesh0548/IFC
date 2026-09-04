import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTheme } from '@mui/material/styles'
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import TextField from '@mui/material/TextField'
import FormControl from '@mui/material/FormControl'
import InputLabel from '@mui/material/InputLabel'
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import Chip from '@mui/material/Chip'
import Alert from '@mui/material/Alert'
import CircularProgress from '@mui/material/CircularProgress'
import Tooltip from '@mui/material/Tooltip'
import RestoreIcon from '@mui/icons-material/Restore'
import SaveRoundedIcon from '@mui/icons-material/SaveRounded'
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded'
import LightbulbOutlinedIcon from '@mui/icons-material/LightbulbOutlined'
import { toast } from 'react-hot-toast'
import { apiUrl } from '../../config/api'
import AppDialog, { APP_DIALOG_PRIMARY_BUTTON_SX } from '../../components/AppDialog'
import { useSyncGlobalLoading } from '../../contexts/GlobalLoadingContext'
import { formatIndianDateTimeCompact } from '../../lib/dateTime'
import {
  DASHBOARD_PAGE_OUTER_SX,
  PAGE_SUBHEADER_TEXT_SX,
} from '../../uiConstants'

const AVAILABLE_VARIABLES = [
  { key: 'recipientName', label: 'Recipient Name', example: 'Divyesh Parmar' },
  { key: 'businessProcess', label: 'Business Process', example: 'Hire to Retire' },
  { key: 'formattedDueDate', label: 'Due Date', example: '15th September, 2026' },
  { key: 'racmLink', label: 'RACM Link', example: 'https://portal.example.com/user/form/123' },
  { key: 'coordinatorCompanyName', label: 'Company Name', example: 'Sharp and Tannan Associates' },
]

const DEFAULT_SUBJECT = 'Your IFC testing for {{businessProcess}} is ready'

const DEFAULT_BODY = `Hi {{recipientName}},

Hope you're having a good week!

I'm reaching out because your Internal Financial Controls assignment for {{businessProcess}} is now ready in the system. Nothing complicated; we just need your help to keep things moving.

Here's what we need from you:

1. You'll see the risk and control matrix from last year. Take a quick look through from here (View of the Risk & Control key issues) especially the risks we identified and the controls we put in place. You'll also spot the evidence that was submitted last year, which should give you a good sense of what we're looking for. (You will be able to download the evidence that was submitted last year.)

2. Upload the evidence for this year's testing against each control. The period and the amount of samples can be viewed in the RACM detail page.

What happens next?

Once you submit your evidence, our tester will review it to check if the control is operating effectively. They'll either pass or fail the control based on what they see. So the clearer your evidence, the smoother that review goes!

Deadline: {{formattedDueDate}}

Just shout if you hit any snags or have questions or you have any feedback on the performance of the controls or have noted any significant breaches; I'm happy to help.

RACM: {{racmLink}}

Thanks for cooperating.

Regards,
{{coordinatorCompanyName}}
`

function replacePreviewVars(text) {
  let result = text
  for (const v of AVAILABLE_VARIABLES) {
    result = result.replaceAll(`{{${v.key}}}`, v.example)
  }
  return result
}

function EmailCustomization() {
  const theme = useTheme()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [units, setUnits] = useState([])
  const [templates, setTemplates] = useState([])
  const [selectedUnitId, setSelectedUnitId] = useState('')
  const [subject, setSubject] = useState(DEFAULT_SUBJECT)
  const [body, setBody] = useState(DEFAULT_BODY)
  const [hasCustomTemplate, setHasCustomTemplate] = useState(false)
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null)
  const [showPreview, setShowPreview] = useState(false)
  const [infoDialogOpen, setInfoDialogOpen] = useState(false)

  useSyncGlobalLoading(loading)
  useSyncGlobalLoading(saving)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(apiUrl('/api/company-co/email-templates'), { credentials: 'include' })
      const json = await res.json()
      if (!res.ok || !json?.success) throw new Error(json?.message || 'Failed to fetch')
      const fetchedUnits = json.data?.units || []
      const fetchedTemplates = json.data?.templates || []
      setUnits(fetchedUnits)
      setTemplates(fetchedTemplates)
    } catch (err) {
      toast.error(err.message || 'Failed to load email templates')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  useEffect(() => {
    if (!selectedUnitId) {
      setSubject(DEFAULT_SUBJECT)
      setBody(DEFAULT_BODY)
      setHasCustomTemplate(false)
      setLastUpdatedAt(null)
      return
    }
    const existing = templates.find((t) => t.unit_id === selectedUnitId)
    if (existing && (existing.email_subject || existing.email_body)) {
      setSubject(existing.email_subject || DEFAULT_SUBJECT)
      setBody(existing.email_body || DEFAULT_BODY)
      setHasCustomTemplate(true)
      setLastUpdatedAt(existing.updated_at || null)
    } else {
      setSubject(DEFAULT_SUBJECT)
      setBody(DEFAULT_BODY)
      setHasCustomTemplate(false)
      setLastUpdatedAt(null)
    }
    setShowPreview(false)
  }, [selectedUnitId, templates])

  const handleSave = async () => {
    if (!selectedUnitId) { toast.error('Please select a unit.'); return }
    setSaving(true)
    try {
      const res = await fetch(apiUrl('/api/company-co/email-templates'), {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ unit_id: selectedUnitId, email_subject: subject, email_body: body }),
      })
      const json = await res.json()
      if (!res.ok || !json?.success) throw new Error(json?.message || 'Failed to save')
      toast.success(json.message || 'Template saved')
      await fetchData()
    } catch (err) {
      toast.error(err.message || 'Failed to save template')
    } finally {
      setSaving(false)
    }
  }

  const handleReset = async () => {
    if (!selectedUnitId) return
    setSaving(true)
    try {
      const res = await fetch(apiUrl(`/api/company-co/email-templates/${encodeURIComponent(selectedUnitId)}`), {
        method: 'DELETE',
        credentials: 'include',
      })
      const json = await res.json()
      if (!res.ok || !json?.success) throw new Error(json?.message || 'Failed to reset')
      toast.success(json.message || 'Template reset to default')
      await fetchData()
    } catch (err) {
      toast.error(err.message || 'Failed to reset template')
    } finally {
      setSaving(false)
    }
  }

  const insertVariable = (field, varKey) => {
    const tag = `{{${varKey}}}`
    if (field === 'subject') setSubject((prev) => prev + tag)
    else setBody((prev) => prev + tag)
  }

  const selectedUnitName = useMemo(() => {
    const u = units.find((u) => u.unit_id === selectedUnitId)
    return u?.unit_name || selectedUnitId || ''
  }, [units, selectedUnitId])

  const previewSubject = useMemo(() => replacePreviewVars(subject), [subject])
  const previewBody = useMemo(() => replacePreviewVars(body), [body])
  const formattedLastUpdated = useMemo(() => {
    if (!lastUpdatedAt) return null
    const formatted = formatIndianDateTimeCompact(lastUpdatedAt, '')
    return formatted || null
  }, [lastUpdatedAt])

  const isDark = theme.palette.mode === 'dark'
  const inputFieldBg = isDark ? 'rgba(30, 41, 59, 0.72)' : 'rgba(248, 250, 252, 1)'

  return (
    <Box sx={DASHBOARD_PAGE_OUTER_SX}>
      <Paper
        elevation={0}
        sx={{ overflow: 'visible', backgroundColor: 'transparent', boxShadow: 'none', borderRadius: 0 }}
      >
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: { xs: 'stretch', md: 'flex-start' },
            gap: 2,
            px: { xs: 0, sm: 0.5 },
            py: 2.25,
            flexDirection: { xs: 'column', md: 'row' },
            borderBottom: '1px solid',
            borderColor: 'divider',
            mb: 2,
          }}
        >
          <Box sx={{ minWidth: 0, flex: 1, width: '100%' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Button
                variant="text"
                size="small"
                startIcon={<ArrowBackRoundedIcon />}
                onClick={() => navigate('/company-co/racm-communication')}
                sx={{ textTransform: 'none', fontWeight: 600, minWidth: 0, px: 1 }}
              >
                Back
              </Button>
            </Box>
            <Box
              sx={{
                display: 'flex',
                alignItems: { xs: 'stretch', md: 'flex-start' },
                justifyContent: 'space-between',
                gap: 2,
                mt: 1,
                flexDirection: { xs: 'column', md: 'row' },
              }}
            >
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                  <Typography
                    component="h1"
                    sx={{ fontSize: { xs: '1.45rem', sm: '1.7rem' }, fontWeight: 850, color: 'text.primary', lineHeight: 1.15 }}
                  >
                    Email Template Customization
                  </Typography>
                  <Button
                    size="small"
                    variant="text"
                    startIcon={<LightbulbOutlinedIcon fontSize="small" />}
                    onClick={() => setInfoDialogOpen(true)}
                    sx={{ textTransform: 'none', fontWeight: 600, color: 'text.secondary', px: 1 }}
                  >
                    Info
                  </Button>
                </Box>
                <Typography sx={{ ...PAGE_SUBHEADER_TEXT_SX, mt: 0.75, maxWidth: '100%' }}>
                  Customize the email subject and body sent to process owners when RACMs are assigned. Use variables to insert dynamic values.
                </Typography>
              </Box>

              {!loading && units.length > 0 && (
                <Box
                  sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: { xs: 'stretch', md: 'flex-end' },
                    gap: 0.75,
                    flex: '0 0 auto',
                    alignSelf: { xs: 'stretch', md: 'flex-start' },
                    minWidth: { md: 220 },
                  }}
                >
                  <FormControl size="small" sx={{ minWidth: 220, maxWidth: 320, width: { xs: '100%', md: 'auto' } }}>
                    <InputLabel id="unit-select-label">Select Unit</InputLabel>
                    <Select
                      labelId="unit-select-label"
                      value={selectedUnitId}
                      label="Select Unit"
                      onChange={(e) => setSelectedUnitId(e.target.value)}
                    >
                      {units.map((u) => (
                        <MenuItem key={u.unit_id} value={u.unit_id}>{u.unit_name || u.unit_id}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  {selectedUnitId && formattedLastUpdated ? (
                    <Typography
                      sx={{
                        fontSize: '0.8125rem',
                        color: 'text.secondary',
                        fontWeight: 600,
                        textAlign: { xs: 'left', md: 'right' },
                        whiteSpace: 'nowrap',
                      }}
                    >
                      Last Updated: {formattedLastUpdated}
                    </Typography>
                  ) : null}
                </Box>
              )}
            </Box>
          </Box>
        </Box>

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
            <CircularProgress />
          </Box>
        ) : units.length === 0 ? (
          <Alert severity="info" sx={{ mt: 2 }}>No units are assigned to you.</Alert>
        ) : !selectedUnitId ? (
          <Box
            sx={{
              mt: 4,
              py: 6,
              px: 2,
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            <Typography
              sx={{
                fontSize: '1.05rem',
                fontWeight: 600,
                color: 'text.secondary',
                textAlign: 'center',
              }}
            >
              Select a unit to start editing template
            </Typography>
          </Box>
        ) : (
          <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 3 }}>
            <Box>
              <Typography sx={{ fontWeight: 700, fontSize: '0.875rem', mb: 1, color: 'text.secondary' }}>
                Available Variables (click to insert at end)
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                {AVAILABLE_VARIABLES.map((v) => (
                  <Tooltip key={v.key} title={`Inserts {{${v.key}}} — Example: ${v.example}`} arrow>
                    <Chip
                      label={v.key}
                      size="small"
                      variant="outlined"
                      onClick={() => insertVariable('body', v.key)}
                      sx={{ cursor: 'pointer', fontFamily: 'monospace', fontSize: '0.8rem' }}
                    />
                  </Tooltip>
                ))}
              </Box>
            </Box>

            <TextField
              label="Email Subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              fullWidth
              size="small"
              sx={{
                maxWidth: 900,
                '& .MuiOutlinedInput-root': {
                  backgroundColor: inputFieldBg,
                },
              }}
            />

            <TextField
              label="Email Body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              fullWidth
              multiline
              minRows={14}
              maxRows={30}
              InputProps={{
                sx: { fontFamily: 'monospace', fontSize: '0.875rem', whiteSpace: 'pre-wrap' },
              }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  backgroundColor: inputFieldBg,
                },
              }}
            />

            <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'center' }}>
              <Button
                variant="contained"
                color="primary"
                startIcon={<SaveRoundedIcon />}
                onClick={handleSave}
                disabled={saving || !selectedUnitId}
                sx={{ textTransform: 'none', fontWeight: 700, px: 3 }}
              >
                {saving ? 'Saving...' : 'Save Template'}
              </Button>
              {hasCustomTemplate && (
                <Button
                  variant="outlined"
                  color="warning"
                  startIcon={<RestoreIcon />}
                  onClick={handleReset}
                  disabled={saving}
                  sx={{ textTransform: 'none', fontWeight: 700 }}
                >
                  Reset to Default
                </Button>
              )}
              <Button
                variant="outlined"
                onClick={() => setShowPreview(true)}
                sx={{ textTransform: 'none', fontWeight: 600 }}
              >
                Preview
              </Button>
            </Box>
          </Box>
        )}
      </Paper>

      <AppDialog
        open={showPreview}
        onClose={() => setShowPreview(false)}
        title="Email Preview"
        titleId="email-template-preview-dialog"
        showTitleDivider
        maxWidth="md"
        fullWidth
        actions={
          <Button
            variant="contained"
            onClick={() => setShowPreview(false)}
            sx={APP_DIALOG_PRIMARY_BUTTON_SX}
          >
            Close
          </Button>
        }
      >
        <Typography sx={{ fontWeight: 600, fontSize: '0.875rem', color: 'text.secondary', mb: 1.5 }}>
          Unit: {selectedUnitName}
        </Typography>
        <Box
          sx={{
            p: 2.5,
            borderRadius: 1.5,
            border: '1px solid',
            borderColor: 'divider',
            backgroundColor: isDark ? 'rgba(30, 41, 59, 0.8)' : 'rgba(248, 250, 252, 1)',
          }}
        >
          <Typography sx={{ fontWeight: 700, fontSize: '0.95rem', mb: 1.5 }}>
            Subject: {previewSubject}
          </Typography>
          <Typography
            component="pre"
            sx={{
              fontFamily: 'inherit',
              fontSize: '0.875rem',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              lineHeight: 1.7,
              m: 0,
              color: 'text.primary',
            }}
          >
            {previewBody}
          </Typography>
        </Box>
      </AppDialog>

      <AppDialog
        open={infoDialogOpen}
        onClose={() => setInfoDialogOpen(false)}
        title="About Email Template Customization"
        titleId="email-template-info-dialog"
        showTitleDivider
        description={
          'This page lets you customize the email that is sent to Process Owners when their RACMs are set to Active and they receive their assignment notification.\n\n' +
          'Which email is affected?\n' +
          'Only the "RACM Active Assignment" email — the one sent to process owners when a coordinator activates an RACM and assigns it. No other emails on the platform (e.g. inactive notifications, approval emails, deficiency reminders) are affected by this template.\n\n' +
          'How to edit:\n' +
          '1. Select the unit for which you want to customize the template.\n' +
          '2. Edit the Subject and Body fields. Use the variable chips (e.g. recipientName, businessProcess) to insert dynamic values that will be replaced with real data when the email is sent.\n' +
          '3. Click "Preview" to see how the email will look with sample values.\n' +
          '4. Click "Save Template" to apply your changes.\n\n' +
          'To revert to the original default email, click "Reset to Default".\n\n' +
          'Templates are unit-level — each unit can have its own customized email. If no custom template is saved for a unit, the system default email will be used.'
        }
        actions={
          <Button
            variant="contained"
            onClick={() => setInfoDialogOpen(false)}
            sx={APP_DIALOG_PRIMARY_BUTTON_SX}
          >
            Got it
          </Button>
        }
      />
    </Box>
  )
}

export default EmailCustomization
