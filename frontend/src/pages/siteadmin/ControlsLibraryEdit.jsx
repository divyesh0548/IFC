import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTheme } from '@mui/material/styles'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import CircularProgress from '@mui/material/CircularProgress'
import FormControl from '@mui/material/FormControl'
import IconButton from '@mui/material/IconButton'
import InputLabel from '@mui/material/InputLabel'
import MenuItem from '@mui/material/MenuItem'
import Paper from '@mui/material/Paper'
import Select from '@mui/material/Select'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import { toast } from 'react-hot-toast'
import AppDialog, {
  APP_DIALOG_PRIMARY_BUTTON_SX,
  getAppDialogCancelButtonSx,
} from '../../components/AppDialog'
import { apiUrl } from '../../config/api'
import { useSyncGlobalLoading } from '../../contexts/GlobalLoadingContext'
import { useBusinessProcesses } from '../../hooks/useBusinessProcesses'
import { useControlFrequencyOptions } from '../../hooks/useControlFrequencyOptions'
import { FORM_DETAIL_MAX_WIDTH } from '../../uiConstants'
import { RACM_FIELD_LABELS } from '../../racmFormDetailFields'

const EMPTY_FORM = {
  business_process: '',
  sub_process: '',
  risk_description: '',
  risk_heat: '',
  control_objective: '',
  standard_control_description: '',
  control_type_ma: '',
  control_type_fo: '',
  nature_of_control: '',
  process_walkthrough: '',
  key_control: '',
  application_name: '',
  audit_evidence_accuracy: '',
  whether_fraud_risks_exist: '',
  control_frequency: '',
}

const MULTILINE_FIELDS = new Set([
  'risk_description',
  'control_objective',
  'standard_control_description',
  'process_walkthrough',
  'audit_evidence_accuracy',
])

const PROCESS_AND_RISK_FIELDS = [
  'business_process',
  'sub_process',
  'risk_heat',
  'risk_description',
]

const CONTROL_DETAIL_FIELDS = [
  'control_objective',
  'standard_control_description',
  'process_walkthrough',
  'control_type_fo',
  'control_type_ma',
  'nature_of_control',
  'key_control',
  'application_name',
  'audit_evidence_accuracy',
  'whether_fraud_risks_exist',
  'control_frequency',
]

const FIELD_LABELS = {
  ...RACM_FIELD_LABELS,
  business_process: 'Business Process',
  audit_evidence_accuracy: 'Control Evidence to be obtained',
}

function normalizeComparable(value) {
  return String(value || '').trim().toLowerCase()
}

function ControlsLibraryEdit() {
  const theme = useTheme()
  const navigate = useNavigate()
  const { id } = useParams()
  const { businessProcessOptions, loading: businessProcessesLoading } = useBusinessProcesses()
  const { controlFrequencyOptions } = useControlFrequencyOptions()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [isEditMode, setIsEditMode] = useState(false)
  const [error, setError] = useState('')
  const [formData, setFormData] = useState(EMPTY_FORM)
  const [savedForm, setSavedForm] = useState(EMPTY_FORM)
  const [originalSubProcess, setOriginalSubProcess] = useState('')
  const [subProcessWarningOpen, setSubProcessWarningOpen] = useState(false)

  useSyncGlobalLoading(loading || saving || businessProcessesLoading)

  const dropdownOptions = useMemo(() => {
    const frequencyValues = controlFrequencyOptions.map((row) => row.value).filter(Boolean)
    const fallbackFrequencies = [
      'Daily',
      'Weekly',
      'Fortnightly',
      'Monthly',
      'Quarterly',
      'Half Yearly',
      'Yearly',
      'As and when',
    ]

    return {
      risk_heat: ['High', 'Medium', 'Low'],
      control_type_fo: ['Financial', 'Operational'],
      control_type_ma: ['Manual', 'Automated'],
      nature_of_control: ['Preventive', 'Detective'],
      key_control: ['Yes', 'No'],
      whether_fraud_risks_exist: ['Yes', 'No'],
      control_frequency: frequencyValues.length > 0 ? frequencyValues : fallbackFrequencies,
    }
  }, [controlFrequencyOptions])

  const fetchEntry = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const response = await fetch(apiUrl(`/api/siteadmin/controls-library/${id}`), {
        credentials: 'include',
      })
      const data = await response.json()

      if (response.ok && data.success && data.data) {
        const row = data.data
        const nextForm = { ...EMPTY_FORM }
        Object.keys(EMPTY_FORM).forEach((key) => {
          nextForm[key] = row[key] == null ? '' : String(row[key])
        })
        setFormData(nextForm)
        setSavedForm(nextForm)
        setOriginalSubProcess(nextForm.sub_process)
        setIsEditMode(false)
      } else {
        setError(data.message || 'Failed to load controls library entry')
      }
    } catch (fetchError) {
      console.error('Fetch controls library entry error:', fetchError)
      setError('Network error while loading controls library entry')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    fetchEntry()
  }, [fetchEntry])

  const handleChange = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }))
  }

  const handleStartEdit = () => {
    setFormData(savedForm)
    setIsEditMode(true)
  }

  const handleCancelEdit = () => {
    setFormData(savedForm)
    setSubProcessWarningOpen(false)
    setIsEditMode(false)
  }

  const saveEntry = async () => {
    if (!String(formData.business_process || '').trim()) {
      toast.error('Business process is required')
      return
    }

    setSaving(true)
    try {
      const response = await fetch(apiUrl(`/api/siteadmin/controls-library/${id}`), {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })
      const data = await response.json()

      if (response.ok && data.success) {
        toast.success(data.message || 'Control updated')
        const row = data.data || {}
        const nextForm = { ...EMPTY_FORM }
        Object.keys(EMPTY_FORM).forEach((key) => {
          nextForm[key] = row[key] == null ? '' : String(row[key])
        })
        setFormData(nextForm)
        setSavedForm(nextForm)
        setOriginalSubProcess(nextForm.sub_process)
        setSubProcessWarningOpen(false)
        setIsEditMode(false)
      } else {
        toast.error(data.message || 'Failed to update control')
      }
    } catch (saveError) {
      console.error('Update controls library entry error:', saveError)
      toast.error('Network error while saving')
    } finally {
      setSaving(false)
    }
  }

  const handleSaveClick = () => {
    const subProcessChanged = normalizeComparable(formData.sub_process)
      !== normalizeComparable(originalSubProcess)

    if (subProcessChanged) {
      setSubProcessWarningOpen(true)
      return
    }

    saveEntry()
  }

  const renderViewField = (field) => {
    const label = FIELD_LABELS[field] || field
    const value = String(formData[field] || '').trim()
    const isMultiline = MULTILINE_FIELDS.has(field)

    return (
      <Box
        key={field}
        sx={{
          p: 2.5,
          borderRadius: 2,
          backgroundColor: theme.palette.mode === 'dark'
            ? 'rgba(255, 255, 255, 0.03)'
            : 'rgba(0, 0, 0, 0.02)',
          border: '1px solid',
          borderColor: theme.palette.mode === 'dark'
            ? 'rgba(255, 255, 255, 0.08)'
            : 'rgba(0, 0, 0, 0.06)',
          gridColumn: isMultiline ? { xs: '1', md: '1 / -1' } : undefined,
        }}
      >
        <Typography
          variant="caption"
          sx={{
            display: 'block',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            mb: 1.5,
            color: 'text.primary',
            fontSize: '0.75rem',
          }}
        >
          {label}
        </Typography>
        <Typography
          variant="body1"
          sx={{
            color: value ? 'text.primary' : 'text.secondary',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            lineHeight: 1.6,
          }}
        >
          {value || '—'}
        </Typography>
      </Box>
    )
  }

  const renderField = (field) => {
    if (!isEditMode) {
      return renderViewField(field)
    }

    const label = FIELD_LABELS[field] || field
    const value = formData[field] || ''
    const isMultiline = MULTILINE_FIELDS.has(field)
    const options = dropdownOptions[field]

    if (field === 'business_process') {
      return (
        <FormControl key={field} fullWidth required disabled={saving}>
          <InputLabel id={`${field}-label`}>{label}</InputLabel>
          <Select
            labelId={`${field}-label`}
            label={label}
            value={value}
            onChange={(event) => handleChange(field, event.target.value)}
          >
            {businessProcessOptions.map((option) => (
              <MenuItem key={option} value={option}>
                {option}
              </MenuItem>
            ))}
            {value && !businessProcessOptions.includes(value) ? (
              <MenuItem value={value}>{value}</MenuItem>
            ) : null}
          </Select>
        </FormControl>
      )
    }

    if (options) {
      const knownOptions = options.includes(value) || !value
        ? options
        : [...options, value]

      return (
        <FormControl key={field} fullWidth disabled={saving}>
          <InputLabel id={`${field}-label`}>{label}</InputLabel>
          <Select
            labelId={`${field}-label`}
            label={label}
            value={value}
            onChange={(event) => handleChange(field, event.target.value)}
          >
            <MenuItem value="">
              <em>None</em>
            </MenuItem>
            {knownOptions.map((option) => (
              <MenuItem key={option} value={option}>
                {option}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      )
    }

    return (
      <TextField
        key={field}
        fullWidth
        label={label}
        value={value}
        onChange={(event) => handleChange(field, event.target.value)}
        multiline={isMultiline}
        minRows={isMultiline ? 4 : undefined}
        disabled={saving}
        sx={{
          gridColumn: isMultiline ? { xs: '1', md: '1 / -1' } : undefined,
        }}
      />
    )
  }

  if (loading) {
    return (
      <Box sx={{ py: 8, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 1.5 }}>
        <CircularProgress size={28} />
        <Typography color="text.secondary">Loading control...</Typography>
      </Box>
    )
  }

  if (error) {
    return (
      <Box sx={{ maxWidth: FORM_DETAIL_MAX_WIDTH, mx: 'auto', px: 0, py: 2 }}>
        <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>
        <Button
          variant="outlined"
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate('/siteadmin/controls-library')}
          sx={{ textTransform: 'none' }}
        >
          Back to Controls Library
        </Button>
      </Box>
    )
  }

  return (
    <Box
      sx={{
        width: '100%',
        maxWidth: FORM_DETAIL_MAX_WIDTH,
        mx: 'auto',
        px: 0,
        py: 0,
      }}
    >
      <Paper
        elevation={3}
        sx={{
          p: 4,
          backgroundColor: theme.palette.background.paper,
          borderRadius: 2,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 3, gap: 1 }}>
          <IconButton
            onClick={() => navigate('/siteadmin/controls-library')}
            aria-label="back to controls library"
            sx={{ color: theme.palette.text.primary }}
          >
            <ArrowBackIcon />
          </IconButton>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography
              variant="h4"
              component="h1"
              sx={{ fontWeight: 700, letterSpacing: '-0.02em' }}
            >
              {isEditMode ? 'Edit Controls Library Entry' : 'Controls Library Entry'}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              ID {id}
              {formData.business_process ? ` · ${formData.business_process}` : ''}
            </Typography>
          </Box>
          <Stack direction="row" spacing={1.5}>
            {isEditMode ? (
              <>
                <Button
                  variant="outlined"
                  onClick={handleCancelEdit}
                  disabled={saving}
                  sx={{ textTransform: 'none' }}
                >
                  Cancel
                </Button>
                <Button
                  variant="contained"
                  onClick={handleSaveClick}
                  disabled={saving}
                  sx={{ textTransform: 'none', fontWeight: 700 }}
                >
                  {saving ? 'Saving...' : 'Save changes'}
                </Button>
              </>
            ) : (
              <Button
                variant="contained"
                onClick={handleStartEdit}
                sx={{ textTransform: 'none', fontWeight: 700 }}
              >
                Edit
              </Button>
            )}
          </Stack>
        </Box>

        <Box
          sx={{
            mb: 4,
            borderTop: '2px solid',
            borderColor: 'divider',
            pt: 3,
          }}
        >
          <Typography
            variant="h6"
            sx={{ fontWeight: 700, mb: 3, fontSize: '1.125rem' }}
          >
            Process and risk
          </Typography>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' },
              gap: 3,
            }}
          >
            {PROCESS_AND_RISK_FIELDS.map(renderField)}
          </Box>
        </Box>

        <Box
          sx={{
            borderTop: '2px solid',
            borderColor: 'divider',
            pt: 3,
            mb: 2,
          }}
        >
          <Typography
            variant="h6"
            sx={{ fontWeight: 700, mb: 3, fontSize: '1.125rem' }}
          >
            Control Details
          </Typography>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' },
              gap: 3,
            }}
          >
            {CONTROL_DETAIL_FIELDS.map(renderField)}
          </Box>
        </Box>
      </Paper>

      <AppDialog
        open={subProcessWarningOpen}
        onClose={() => !saving && setSubProcessWarningOpen(false)}
        title="Sub-process change warning"
        titleId="controls-library-subprocess-warning-title"
        description="You are changing the Sub-Process. Controls are grouped by sub-process for suggestions. Changing it will separate this control from its current group. You can still continue."
        descriptionId="controls-library-subprocess-warning-desc"
        showTitleDivider
        actions={
          <>
            <Button
              onClick={() => setSubProcessWarningOpen(false)}
              variant="outlined"
              disabled={saving}
              sx={getAppDialogCancelButtonSx(theme)}
            >
              Go back
            </Button>
            <Button
              onClick={saveEntry}
              variant="contained"
              disabled={saving}
              sx={APP_DIALOG_PRIMARY_BUTTON_SX}
            >
              {saving ? 'Saving...' : 'Continue and save'}
            </Button>
          </>
        }
      />
    </Box>
  )
}

export default ControlsLibraryEdit
