import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Alert from '@mui/material/Alert'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import FormControl from '@mui/material/FormControl'
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import InputLabel from '@mui/material/InputLabel'
import TextField from '@mui/material/TextField'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import DialogContentText from '@mui/material/DialogContentText'
import { toast } from 'react-hot-toast'
import {
  RACM_BULK_IMPORT_MAPPABLE_FIELDS,
  RACM_FIELD_LABELS,
  RACM_BULK_IMPORT_SESSION_KEY,
} from '../../racmFormDetailFields'
import { useSyncGlobalLoading } from '../../contexts/GlobalLoadingContext'
import { PAGE_SUBHEADER_TEXT_SX } from '../../uiConstants'
import { useUnsavedChangesWarning } from '../../utils/useUnsavedChangesWarning'
import { apiUrl } from '../../config/api'
import { getControlFrequencyValidationDetails } from '../../utils/controlFrequencyValidation'
import { useControlFrequencyOptions } from '../../hooks/useControlFrequencyOptions'
import ControlFrequencyValueMapDialog from '../../components/racm/ControlFrequencyValueMapDialog'
import AssertionYesNoMapDialog from '../../components/racm/AssertionYesNoMapDialog'
import {
  parseExtraFieldMappingValue,
  toExtraFieldMappingValue,
} from '../../utils/racmTemplateKeywords'
import {
  applyAssertionYesNoMapping,
  getAssertionExcelHeaders,
  getAssertionYesNoMappingPrompt,
} from '../../utils/assertionYesNoMapping'
import {
  BULK_IMPORT_AUTO,
  BULK_IMPORT_SKIP,
  buildColumnMapping,
  buildMappableFieldSet,
  buildUniqueAutoDetectedByHeader,
  collectBulkImportHeaders,
  getEffectiveMappedField,
} from '../../utils/racmBulkImportColumnMapping'
import {
  softApplySavedColumnMapping,
  mergeValueMappings,
  filterUnmappedInvalidFrequencyValues,
  filterUnmappedAssertionValues,
} from '../../utils/racmSavedColumnMapping'

const AUTO = BULK_IMPORT_AUTO
const SKIP = BULK_IMPORT_SKIP
const DUPLICATE_CONTROL_NUMBER_MESSAGE = 'Duplicate Control Number already exists for this company'
const DUPLICATE_CONTROL_NUMBER_NOTICE =
  'Change the control number and re-upload the excel or do not import control number'

/**
 * @returns {{ ok: true } | { ok: false, fieldLabel: string, excelHeaders: string[] }}
 */
function findDuplicateFieldMappings(
  headers,
  selections,
  autoDetectedByHeader,
  mappingConfig,
  mappableSet,
  extraFields = []
) {
  const byField = new Map()
  for (const h of headers) {
    const field = getEffectiveMappedField(h, selections, autoDetectedByHeader, mappingConfig, mappableSet)
    if (!field) continue
    if (!byField.has(field)) byField.set(field, [])
    byField.get(field).push(h)
  }
  for (const [fieldKey, excelHeaders] of byField) {
    if (excelHeaders.length > 1) {
      const parsedExtra = parseExtraFieldMappingValue(fieldKey)
      const fieldLabel = parsedExtra
        ? (extraFields.find((item) => item.field_key === parsedExtra)?.label
          || parsedExtra.replace(/_/g, ' '))
        : (RACM_FIELD_LABELS[fieldKey] || fieldKey.replace(/_/g, ' '))
      return { ok: false, fieldLabel, excelHeaders }
    }
  }
  return { ok: true }
}

function ExcelColumnMap() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [initializing, setInitializing] = useState(true)
  const [payload, setPayload] = useState(null)
  const [mappingConfig, setMappingConfig] = useState(null)
  const [templateExtraFields, setTemplateExtraFields] = useState([])
  const [templateFieldsLoaded, setTemplateFieldsLoaded] = useState(false)
  const [activeTemplate, setActiveTemplate] = useState(null)
  const [savedMappings, setSavedMappings] = useState([])
  const [selectedSavedMappingId, setSelectedSavedMappingId] = useState('')
  const [appliedPresetId, setAppliedPresetId] = useState(null)
  const [sessionAssertionYesNoMapping, setSessionAssertionYesNoMapping] = useState({})
  const [sessionControlFrequencyValueMapping, setSessionControlFrequencyValueMapping] = useState({})
  const [saveMappingDialog, setSaveMappingDialog] = useState({
    open: false,
    name: '',
    overwrite: false,
    submitting: false,
    error: '',
    pendingNavigate: false,
  })
  const [userOverrides, setUserOverrides] = useState({})
  const [duplicateControlNumberNotice, setDuplicateControlNumberNotice] = useState('')
  const { controlFrequencyOptions, loading: controlFrequencyOptionsLoading } = useControlFrequencyOptions()
  const [controlFrequencyMappingDialogState, setControlFrequencyMappingDialogState] = useState({
    open: false,
    invalidValues: [],
    submitContext: null,
    selections: {},
  })
  const [assertionYesNoMappingDialogState, setAssertionYesNoMappingDialogState] = useState({
    open: false,
    distinctValues: [],
    assertionHeaders: [],
    submitContext: null,
    selections: {},
  })
  useSyncGlobalLoading(initializing || loading)
  const headers = useMemo(() => (payload ? collectBulkImportHeaders(payload.rows) : []), [payload])

  const mappableSet = useMemo(
    () => buildMappableFieldSet(templateExtraFields),
    [templateExtraFields]
  )

  const autoDetectedByHeader = useMemo(() => {
    if (!mappingConfig || !templateFieldsLoaded) return {}
    return buildUniqueAutoDetectedByHeader(headers, mappingConfig, templateExtraFields, mappableSet)
  }, [headers, mappingConfig, templateExtraFields, mappableSet, templateFieldsLoaded])

  const selections = useMemo(() => {
    if (!mappingConfig || !payload || !templateFieldsLoaded) return null
    const next = {}
    headers.forEach((header) => {
      if (Object.prototype.hasOwnProperty.call(userOverrides, header)) {
        next[header] = userOverrides[header]
      } else {
        next[header] = autoDetectedByHeader[header] || SKIP
      }
    })
    return next
  }, [mappingConfig, payload, templateFieldsLoaded, headers, autoDetectedByHeader, userOverrides])

  const getSelectValue = (header) => {
    if (Object.prototype.hasOwnProperty.call(userOverrides, header)) {
      return userOverrides[header]
    }
    return autoDetectedByHeader[header] || SKIP
  }

  const hasAnyProgress = useMemo(
    () => Object.keys(userOverrides).length > 0,
    [userOverrides]
  )

  useUnsavedChangesWarning(
    hasAnyProgress,
    'Your progress will be lost on this column mapping page. Do you want to continue?'
  )

  useEffect(() => {
    const loadMappingConfig = async () => {
      try {
        const response = await fetch(apiUrl('/api/control-forms/column-mapping-config'), {
          credentials: 'include',
        })
        const data = await response.json()
        if (!response.ok || !data?.success || !data?.data) {
          throw new Error('Failed to load mapping config')
        }
        if (!data.data.simpleColumnMapping || !Array.isArray(data.data.columnPatterns)) {
          throw new Error('Invalid mapping config response')
        }
        setMappingConfig({
          simpleColumnMapping: data.data.simpleColumnMapping,
          columnPatterns: data.data.columnPatterns,
        })
      } catch (error) {
        console.error(error)
        toast.error('Could not load column mapping config. Please try again.')
        navigate('/company-co/control-creation', { replace: true })
        setInitializing(false)
      }
    }
    loadMappingConfig()
  }, [navigate])

  useEffect(() => {
    try {
      if (!mappingConfig) return
      const raw = sessionStorage.getItem(RACM_BULK_IMPORT_SESSION_KEY)
      if (!raw) {
        toast.error('No import data found. Start again from the upload page.')
        navigate('/company-co/control-creation', { replace: true })
        return
      }
      const data = JSON.parse(raw)
      if (!data?.rows?.length || !data.businessProcess || !data.financialYear || !data.unitId) {
        toast.error('Invalid import session.')
        sessionStorage.removeItem(RACM_BULK_IMPORT_SESSION_KEY)
        navigate('/company-co/control-creation', { replace: true })
        return
      }
      setPayload(data)
    } catch (e) {
      console.error(e)
      toast.error('Could not load import session.')
      navigate('/company-co/control-creation', { replace: true })
    }
  }, [navigate, mappingConfig])

  useEffect(() => {
    setUserOverrides({})
  }, [payload?.unitId])

  useEffect(() => {
    if (!payload?.unitId) {
      setTemplateExtraFields([])
      setActiveTemplate(null)
      setSavedMappings([])
      setSelectedSavedMappingId('')
      setAppliedPresetId(null)
      setSessionAssertionYesNoMapping({})
      setSessionControlFrequencyValueMapping({})
      return undefined
    }

    let cancelled = false
    setTemplateExtraFields([])
    setTemplateFieldsLoaded(false)
    setActiveTemplate(null)
    setSavedMappings([])
    setSelectedSavedMappingId('')
    setAppliedPresetId(null)
    setSessionAssertionYesNoMapping({})
    setSessionControlFrequencyValueMapping({})
    ;(async () => {
      try {
        const [templateResponse, mappingsResponse] = await Promise.all([
          fetch(
            apiUrl(`/api/company-co/racm-templates?unit_id=${encodeURIComponent(payload.unitId)}`),
            { credentials: 'include' }
          ),
          fetch(
            apiUrl(`/api/company-co/excel-column-mappings?unit_id=${encodeURIComponent(payload.unitId)}`),
            { credentials: 'include' }
          ),
        ])
        const templateData = await templateResponse.json()
        const mappingsData = await mappingsResponse.json()

        if (!cancelled && templateResponse.ok && templateData.success) {
          setTemplateExtraFields(
            (Array.isArray(templateData.data?.extra_fields) ? templateData.data.extra_fields : [])
              .filter((field) => String(field.section_key || '').trim() !== 'design_implementation')
          )
          const template = templateData.data?.template || null
          setActiveTemplate(template)
        }

        if (!cancelled && mappingsResponse.ok && mappingsData.success) {
          setSavedMappings(Array.isArray(mappingsData.data?.mappings) ? mappingsData.data.mappings : [])
          if (mappingsData.data?.active_template) {
            setActiveTemplate((prev) => prev || mappingsData.data.active_template)
          }
        }
      } catch (error) {
        console.error('Failed to load unit template fields / saved mappings for bulk import:', error)
      } finally {
        if (!cancelled) {
          setUserOverrides({})
          setTemplateFieldsLoaded(true)
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [payload?.unitId])

  const handleApplySavedMapping = () => {
    const mappingId = Number(selectedSavedMappingId)
    const preset = savedMappings.find((item) => Number(item.id) === mappingId)
    if (!preset) {
      toast.error('Select a saved mapping first.')
      return
    }

    const soft = softApplySavedColumnMapping({
      savedColumnMapping: preset.column_mapping,
      headers,
      mappableSet,
    })
    setUserOverrides(soft.overrides)
    setAppliedPresetId(preset.id)
    setSessionAssertionYesNoMapping(mergeValueMappings(preset.assertion_yes_no_mapping))
    setSessionControlFrequencyValueMapping(mergeValueMappings(preset.control_frequency_value_mapping))

    const parts = [`Applied ${soft.appliedCount} column(s)`]
    if (soft.skippedTargetCount > 0) {
      parts.push(`${soft.skippedTargetCount} target(s) no longer in template`)
    }
    if (soft.unmatchedHeaderCount > 0) {
      parts.push(`${soft.unmatchedHeaderCount} Excel header(s) not in preset`)
    }
    toast.success(parts.join('. ') + '.')

    void fetch(apiUrl(`/api/company-co/excel-column-mappings/${preset.id}/touch`), {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ unit_id: payload.unitId }),
    }).catch(() => {})
  }

  useEffect(() => {
    if (mappingConfig && payload && templateFieldsLoaded) {
      setInitializing(false)
    }
  }, [mappingConfig, payload, templateFieldsLoaded])

  const rowCountLabel = useMemo(
    () => (payload?.rows?.length ? payload.rows.length.toLocaleString() : '0'),
    [payload]
  )

  const fieldOptions = useMemo(() => {
    const standard = RACM_BULK_IMPORT_MAPPABLE_FIELDS.map((key) => ({
      value: key,
      label: key === 'control_number'
        ? 'Control Number (not mandatory — auto-generated if not imported from Excel)'
        : (RACM_FIELD_LABELS[key] || key.replace(/_/g, ' ')),
    }))
    const extras = templateExtraFields.map((field) => ({
      value: toExtraFieldMappingValue(field.field_key),
      label: `${field.label} (custom)`,
    }))
    return [...standard, ...extras]
  }, [templateExtraFields])
  const fieldOptionMap = useMemo(
    () => new Map(fieldOptions.map((opt) => [opt.value, opt.label])),
    [fieldOptions]
  )
  const mappedFieldByHeader = useMemo(() => {
    if (!selections) return {}
    const out = {}
    headers.forEach((header) => {
      out[header] = getEffectiveMappedField(header, selections, autoDetectedByHeader, mappingConfig, mappableSet)
    })
    return out
  }, [headers, selections, autoDetectedByHeader, mappingConfig, mappableSet])
  const isFieldUsedByAnotherHeader = (field, currentHeader) =>
    headers.some((header) => header !== currentHeader && mappedFieldByHeader[header] === field)

  const handleBack = () => {
    sessionStorage.removeItem(RACM_BULK_IMPORT_SESSION_KEY)
    navigate('/company-co/control-creation')
  }

  const handleSubmit = async () => {
    if (!payload || !selections) return

    const dup = findDuplicateFieldMappings(
      headers,
      selections,
      autoDetectedByHeader,
      mappingConfig,
      mappableSet,
      templateExtraFields
    )
    if (!dup.ok) {
      const cols = dup.excelHeaders.map((c) => `"${c}"`).join(', ')
      toast.error(`${dup.fieldLabel} cannot map to more than one Excel column (${cols}).`)
      return
    }

    const controlFrequencyHeader = headers.find(
      (header) => mappedFieldByHeader[header] === 'control_frequency'
    )
    if (!controlFrequencyHeader) {
      toast.error('Mapping of Control Frequency column is mandatory. Please map it before importing.')
      return
    }

    const column_mapping = buildColumnMapping(
      headers,
      selections,
      autoDetectedByHeader,
      mappingConfig,
      mappableSet
    )

    let rowsForImport = payload.rows
    if (Object.keys(sessionAssertionYesNoMapping).length > 0) {
      const assertionHeaders = getAssertionExcelHeaders(column_mapping, templateExtraFields)
      if (assertionHeaders.length > 0) {
        rowsForImport = applyAssertionYesNoMapping(
          payload.rows,
          assertionHeaders,
          sessionAssertionYesNoMapping
        )
        setPayload((prev) => (prev ? { ...prev, rows: rowsForImport } : prev))
      }
    }

    const assertionPrompt = getAssertionYesNoMappingPrompt(
      rowsForImport,
      column_mapping,
      templateExtraFields
    )
    if (assertionPrompt.needed) {
      const remainingValues = filterUnmappedAssertionValues(
        assertionPrompt.distinctValues,
        sessionAssertionYesNoMapping
      )
      if (remainingValues.length > 0) {
        setAssertionYesNoMappingDialogState({
          open: true,
          distinctValues: remainingValues,
          assertionHeaders: assertionPrompt.assertionHeaders,
          submitContext: {
            column_mapping,
            controlFrequencyHeader,
            rows: rowsForImport,
          },
          selections: Object.fromEntries(remainingValues.map((value) => [value, ''])),
        })
        return
      }
    }

    await continueImportAfterAssertionMapping(
      column_mapping,
      rowsForImport,
      controlFrequencyHeader
    )
  }

  const continueImportAfterAssertionMapping = async (
    column_mapping,
    rows,
    controlFrequencyHeader
  ) => {
    const controlFrequencyValidation = getControlFrequencyValidationDetails(
      rows,
      controlFrequencyHeader
    )
    if (!controlFrequencyValidation.ok) {
      if (controlFrequencyValidation.reason === 'invalid_value') {
        const remainingInvalid = filterUnmappedInvalidFrequencyValues(
          controlFrequencyValidation.invalidValues,
          sessionControlFrequencyValueMapping
        )
        if (remainingInvalid.length > 0) {
          setControlFrequencyMappingDialogState({
            open: true,
            invalidValues: remainingInvalid,
            submitContext: {
              column_mapping,
              rows,
            },
            selections: Object.fromEntries(remainingInvalid.map((value) => [value, ''])),
          })
          return
        }

        await submitImport(
          column_mapping,
          sessionControlFrequencyValueMapping,
          rows
        )
        return
      }
      toast.error(controlFrequencyValidation.message)
      return
    }

    await submitImport(
      column_mapping,
      Object.keys(sessionControlFrequencyValueMapping).length > 0
        ? sessionControlFrequencyValueMapping
        : null,
      rows
    )
  }

  const openSaveMappingDialog = () => {
    const defaultName = appliedPresetId
      ? (savedMappings.find((item) => Number(item.id) === Number(appliedPresetId))?.name || '')
      : ''
    setSaveMappingDialog({
      open: true,
      name: defaultName,
      overwrite: false,
      submitting: false,
      error: '',
      pendingNavigate: true,
    })
  }

  const closeSaveMappingDialog = ({ navigateAway = false } = {}) => {
    const shouldNavigate = navigateAway || saveMappingDialog.pendingNavigate
    setSaveMappingDialog({
      open: false,
      name: '',
      overwrite: false,
      submitting: false,
      error: '',
      pendingNavigate: false,
    })
    if (shouldNavigate) {
      sessionStorage.removeItem(RACM_BULK_IMPORT_SESSION_KEY)
      navigate('/company-co/control-creation', { replace: true })
    }
  }

  const handleSaveMappingConfirm = async ({ overwrite = false } = {}) => {
    const name = String(saveMappingDialog.name || '').trim()
    if (!name) {
      setSaveMappingDialog((prev) => ({ ...prev, error: 'Enter a mapping name.' }))
      return
    }
    const templateId = Number(activeTemplate?.id)
    if (!Number.isInteger(templateId) || templateId <= 0) {
      setSaveMappingDialog((prev) => ({
        ...prev,
        error: 'Active template is missing. Mapping cannot be saved.',
      }))
      return
    }

    const column_mapping = buildColumnMapping(
      headers,
      selections,
      autoDetectedByHeader,
      mappingConfig,
      mappableSet
    )

    setSaveMappingDialog((prev) => ({ ...prev, submitting: true, error: '', overwrite }))
    try {
      const response = await fetch(apiUrl('/api/company-co/excel-column-mappings'), {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          unit_id: payload.unitId,
          name,
          template_id: templateId,
          column_mapping,
          assertion_yes_no_mapping:
            Object.keys(sessionAssertionYesNoMapping).length > 0
              ? sessionAssertionYesNoMapping
              : null,
          control_frequency_value_mapping:
            Object.keys(sessionControlFrequencyValueMapping).length > 0
              ? sessionControlFrequencyValueMapping
              : null,
          excel_headers: headers,
          overwrite: Boolean(overwrite),
        }),
      })
      const data = await response.json()
      if (response.status === 409 || data?.code === 'NAME_EXISTS') {
        setSaveMappingDialog((prev) => ({
          ...prev,
          submitting: false,
          overwrite: true,
          error: 'A mapping with this name already exists. Click Overwrite to replace it.',
        }))
        return
      }
      if (!response.ok || !data?.success) {
        throw new Error(data?.message || 'Failed to save mapping')
      }
      toast.success(data.message || (data.overwritten ? 'Mapping overwritten.' : 'Mapping saved.'))
      closeSaveMappingDialog({ navigateAway: true })
    } catch (error) {
      console.error(error)
      setSaveMappingDialog((prev) => ({
        ...prev,
        submitting: false,
        error: error.message || 'Failed to save mapping',
      }))
    }
  }

  const submitImport = async (
    column_mapping,
    controlFrequencyValueMapping = null,
    rowsOverride = null
  ) => {
    const mergedFrequencyMapping = mergeValueMappings(
      sessionControlFrequencyValueMapping,
      controlFrequencyValueMapping
    )
    if (Object.keys(mergedFrequencyMapping).length > 0) {
      setSessionControlFrequencyValueMapping(mergedFrequencyMapping)
    }

    const body = {
      businessProcess: payload.businessProcess,
      financialYear: payload.financialYear,
      unit_id: payload.unitId,
      rows: Array.isArray(rowsOverride) ? rowsOverride : payload.rows,
      column_mapping,
    }
    if (payload.due_date && payload.reminder_frequency) {
      body.due_date = payload.due_date
      body.reminder_frequency = payload.reminder_frequency
    }
    if (Object.keys(mergedFrequencyMapping).length > 0) {
      body.control_frequency_value_mapping = mergedFrequencyMapping
    }

    setLoading(true)
    setDuplicateControlNumberNotice('')
    try {
      const response = await fetch(apiUrl('/api/control-forms/bulk-import-rows'), {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await response.json()

      if (response.ok && data.success) {
        const inserted = data.data?.insertedCount ?? 0
        const skipped = data.data?.skippedCount ?? 0
        const dups = data.data?.duplicateCount ?? 0
        const errs = data.data?.errorCount ?? 0
        const extra =
          skipped + dups + errs > 0
            ? ` (${skipped} skipped, ${dups} duplicates, ${errs} errors)`
            : ''
        toast.success(
          typeof data.message === 'string' && data.message.trim() !== ''
            ? data.message
            : `Created ${inserted} RACM(s)${extra}.`
        )
        openSaveMappingDialog()
      } else {
        if (String(data?.message || '').includes(DUPLICATE_CONTROL_NUMBER_MESSAGE)) {
          setDuplicateControlNumberNotice(DUPLICATE_CONTROL_NUMBER_NOTICE)
        }
        toast.error(data.message || 'Failed to import RACMs')
      }
    } catch (err) {
      console.error(err)
      toast.error('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleControlFrequencyMappingCancel = () => {
    setControlFrequencyMappingDialogState({
      open: false,
      invalidValues: [],
      submitContext: null,
      selections: {},
    })
  }

  const handleControlFrequencyMappingConfirm = async (mapping) => {
    const submitContext = controlFrequencyMappingDialogState.submitContext
    handleControlFrequencyMappingCancel()
    if (!submitContext?.column_mapping) return
    const merged = mergeValueMappings(sessionControlFrequencyValueMapping, mapping)
    setSessionControlFrequencyValueMapping(merged)
    await submitImport(
      submitContext.column_mapping,
      merged,
      submitContext.rows || null
    )
  }

  const handleAssertionYesNoMappingCancel = () => {
    setAssertionYesNoMappingDialogState({
      open: false,
      distinctValues: [],
      assertionHeaders: [],
      submitContext: null,
      selections: {},
    })
  }

  const handleAssertionYesNoMappingSkip = async () => {
    const submitContext = assertionYesNoMappingDialogState.submitContext
    handleAssertionYesNoMappingCancel()
    if (!submitContext?.column_mapping || !submitContext?.controlFrequencyHeader) return
    await continueImportAfterAssertionMapping(
      submitContext.column_mapping,
      submitContext.rows || payload.rows,
      submitContext.controlFrequencyHeader
    )
  }

  const handleAssertionYesNoMappingConfirm = async (mapping) => {
    const submitContext = assertionYesNoMappingDialogState.submitContext
    const assertionHeaders = assertionYesNoMappingDialogState.assertionHeaders
    handleAssertionYesNoMappingCancel()
    if (!submitContext?.column_mapping || !submitContext?.controlFrequencyHeader) return

    const mergedAssertionMapping = mergeValueMappings(sessionAssertionYesNoMapping, mapping)
    setSessionAssertionYesNoMapping(mergedAssertionMapping)

    const mappedRows = applyAssertionYesNoMapping(
      submitContext.rows || payload.rows,
      assertionHeaders,
      mergedAssertionMapping
    )
    setPayload((prev) => (prev ? { ...prev, rows: mappedRows } : prev))
    await continueImportAfterAssertionMapping(
      submitContext.column_mapping,
      mappedRows,
      submitContext.controlFrequencyHeader
    )
  }

  if (!payload) {
    return (
      <Box sx={{ py: 4 }}>
        <Typography color="text.secondary">Loading…</Typography>
      </Box>
    )
  }

  if (!selections) {
    return (
      <Box sx={{ py: 4 }}>
        <Typography color="text.secondary">Loading…</Typography>
      </Box>
    )
  }

  return (
    <Box sx={{ width: '100%', px: 0, py: 2 }}>
      <Paper
        elevation={0}
        sx={{
          p: { xs: 2, sm: 3 },
          mb: 2,
          borderRadius: 2,
          border: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Typography variant="h5" sx={{ fontWeight: 800 }}>
          Map Excel columns
        </Typography>
        <Typography sx={{ ...PAGE_SUBHEADER_TEXT_SX, mt: 1 }}>
          Match each column from <strong>{payload.fileName || 'your file'}</strong> to a RACM field, or
          choose Auto-detect when a field is suggested. Columns with no match default to{' '}
          <strong>Skip — do not import</strong>. Financial year is taken from the upload step, not from the
          sheet.
        </Typography>

        {duplicateControlNumberNotice ? (
          <Alert severity="warning" sx={{ mt: 2 }}>
            {duplicateControlNumberNotice}
          </Alert>
        ) : null}

        <Box
          sx={{
            mt: 2,
            display: 'flex',
            flexDirection: { xs: 'column', sm: 'row' },
            gap: 1.5,
            alignItems: { xs: 'stretch', sm: 'flex-end' },
          }}
        >
          <FormControl fullWidth size="small" disabled={loading || savedMappings.length === 0}>
            <InputLabel id="saved-mapping-label">Use previous mapping</InputLabel>
            <Select
              labelId="saved-mapping-label"
              label="Use previous mapping"
              value={selectedSavedMappingId}
              onChange={(event) => setSelectedSavedMappingId(event.target.value)}
            >
              <MenuItem value="">
                <em>{savedMappings.length === 0 ? 'No saved mappings for this template' : 'Select a mapping'}</em>
              </MenuItem>
              {savedMappings.map((mapping) => (
                <MenuItem key={mapping.id} value={String(mapping.id)}>
                  {mapping.name}
                  {mapping.template_version != null ? ` (saved from v${mapping.template_version})` : ''}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <Button
            variant="outlined"
            onClick={handleApplySavedMapping}
            disabled={loading || !selectedSavedMappingId}
            sx={{ textTransform: 'none', whiteSpace: 'nowrap', minWidth: { sm: 140 } }}
          >
            Apply mapping
          </Button>
        </Box>
        {activeTemplate?.template_name ? (
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
            Showing saved mappings for template &quot;{activeTemplate.template_name}&quot;
            {activeTemplate.version != null ? ` (active v${activeTemplate.version})` : ''}.
          </Typography>
        ) : null}

        <Box
          sx={{
            mt: 2,
            display: 'flex',
            flexDirection: 'column',
            gap: 1,
          }}
        >
          {[
            'Review the detected Excel columns on the left.',
            'Choose the correct RACM field for each column.',
            'Skip header mapping for the column that should not be imported.',
          ].map((item, index) => (
            <Box
              key={item}
              sx={{
                p: 1.25,
                borderRadius: 2,
                bgcolor: 'action.hover',
                display: 'flex',
                alignItems: 'center',
                gap: 1,
              }}
            >
              <Typography
                sx={{
                  minWidth: 24,
                  height: 24,
                  borderRadius: '50%',
                  bgcolor: 'primary.main',
                  color: 'primary.contrastText',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  display: 'grid',
                  placeItems: 'center',
                }}
              >
                {index + 1}
              </Typography>
              <Typography
                sx={{
                  color: 'text.secondary',
                  fontSize: '0.92rem',
                  fontWeight: 600,
                }}
              >
                {item}
              </Typography>
            </Box>
          ))}
        </Box>
      </Paper>

      <Box
        sx={{
          mb: 2,
          display: 'grid',
          columnGap: 1.5,
          rowGap: 1.5,
          gridTemplateColumns: { xs: '1fr', md: 'repeat(3, minmax(0, 1fr))' },
        }}
      >
        <Box
          sx={{
            px: 1.5,
            py: 1.25,
            borderRadius: 2,
            bgcolor: (theme) =>
              theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.04)' : 'grey.50',
            border: '1px solid',
            borderColor: (theme) =>
              theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.08)' : 'divider',
            minHeight: { md: 84 },
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
          }}
        >
          <Typography
            sx={{
              color: 'text.secondary',
              fontSize: '0.74rem',
              fontWeight: 700,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              mb: 0.4,
            }}
          >
            Business process
          </Typography>
          <Typography
            sx={{
              color: 'text.primary',
              fontWeight: 700,
              lineHeight: 1.3,
              wordBreak: 'break-word',
              fontSize: { xs: '1.05rem', sm: '1.15rem' },
            }}
          >
            {payload.businessProcess}
          </Typography>
        </Box>

        <Box
          sx={{
            px: 1.5,
            py: 1.25,
            borderRadius: 2,
            bgcolor: (theme) =>
              theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.04)' : 'grey.50',
            border: '1px solid',
            borderColor: (theme) =>
              theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.08)' : 'divider',
            minHeight: { md: 84 },
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
          }}
        >
          <Typography
            sx={{
              color: 'text.secondary',
              fontSize: '0.74rem',
              fontWeight: 700,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              mb: 0.4,
            }}
          >
            Financial year
          </Typography>
          <Typography
            sx={{
              color: 'text.primary',
              fontWeight: 700,
              lineHeight: 1.2,
              fontSize: { xs: '1.2rem', sm: '1.3rem' },
            }}
          >
            {payload.financialYear}
          </Typography>
        </Box>

        <Box
          sx={{
            px: 1.5,
            py: 1.25,
            borderRadius: 2,
            bgcolor: (theme) =>
              theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.04)' : 'grey.50',
            border: '1px solid',
            borderColor: (theme) =>
              theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.08)' : 'divider',
            minHeight: { md: 84 },
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
          }}
        >
          <Typography
            sx={{
              color: 'text.secondary',
              fontSize: '0.74rem',
              fontWeight: 700,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              mb: 0.4,
            }}
          >
            Rows detected
          </Typography>
          <Typography
            sx={{
              color: 'text.primary',
              fontWeight: 700,
              lineHeight: 1.2,
              fontSize: { xs: '1.2rem', sm: '1.3rem' },
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {rowCountLabel}
          </Typography>
          <Typography sx={{ mt: 0.2, color: 'text.secondary', fontSize: '0.82rem' }}>
            Ready for column mapping
          </Typography>
        </Box>
      </Box>

      <TableContainer
        component={Paper}
        elevation={0}
        sx={{
          borderRadius: 2,
          border: '1px solid',
          borderColor: 'divider',
          mb: 2,
        }}
      >
        <Table size="small" sx={{ minWidth: 650, tableLayout: 'fixed' }}>
          <TableHead>
            <TableRow sx={{ bgcolor: 'action.hover' }}>
              <TableCell
                sx={{
                  fontWeight: 700,
                  width: '50%',
                  borderBottom: '1px solid',
                  borderBottomColor: 'divider',
                }}
              >
                Excel column (detected)
              </TableCell>
              <TableCell
                sx={{
                  fontWeight: 700,
                  width: '50%',
                  borderBottom: '1px solid',
                  borderBottomColor: 'divider',
                }}
              >
                Target RACM field
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {headers.map((header) => (
              <TableRow
                key={header}
                hover
                sx={{
                  '&:last-child td': {
                    borderBottom: 'none',
                  },
                }}
              >
                <TableCell
                  sx={{
                    verticalAlign: 'middle',
                    width: '50%',
                    borderBottom: '1px solid',
                    borderBottomColor: 'divider',
                  }}
                >
                  <Typography sx={{ fontWeight: 600, wordBreak: 'break-word' }}>{header}</Typography>
                </TableCell>
                <TableCell
                  sx={{
                    width: '50%',
                    borderBottom: '1px solid',
                    borderBottomColor: 'divider',
                  }}
                >
                  <FormControl fullWidth size="small" disabled={loading}>
                    <Select
                      displayEmpty
                      value={getSelectValue(header)}
                      renderValue={(value) => {
                        if (value === AUTO) {
                          const detected = autoDetectedByHeader[header]
                          if (detected) return fieldOptionMap.get(detected) || detected
                          return 'Select a RACM field'
                        }
                        if (value === SKIP) return 'Skip — do not import'
                        return fieldOptionMap.get(value) || value
                      }}
                      onChange={(e) =>
                        setUserOverrides((prev) => ({ ...prev, [header]: e.target.value }))
                      }
                    >
                      <MenuItem value={AUTO}>
                        {autoDetectedByHeader[header]
                          ? `Auto-detect: ${fieldOptionMap.get(autoDetectedByHeader[header]) || autoDetectedByHeader[header]}`
                          : 'Auto-detect: Select a RACM field'}
                      </MenuItem>
                      <MenuItem value={SKIP}>Skip — do not import</MenuItem>
                      {fieldOptions.map((opt) => (
                        <MenuItem
                          key={opt.value}
                          value={opt.value}
                          disabled={isFieldUsedByAnotherHeader(opt.value, header)}
                        >
                          {opt.label}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5 }}>
        <Button variant="contained" color="secondary" disabled={loading} onClick={handleSubmit}>
          {loading ? 'Importing…' : 'Submit import'}
        </Button>
        <Button variant="outlined" disabled={loading} onClick={handleBack}>
          Cancel
        </Button>
      </Box>
      <ControlFrequencyValueMapDialog
        open={controlFrequencyMappingDialogState.open}
        invalidValues={controlFrequencyMappingDialogState.invalidValues}
        options={controlFrequencyOptions}
        selections={controlFrequencyMappingDialogState.selections}
        loading={loading || controlFrequencyOptionsLoading}
        onCancel={handleControlFrequencyMappingCancel}
        onSelectionsChange={(selections) =>
          setControlFrequencyMappingDialogState((prev) => ({
            ...prev,
            selections,
          }))
        }
        onConfirm={handleControlFrequencyMappingConfirm}
      />
      <AssertionYesNoMapDialog
        open={assertionYesNoMappingDialogState.open}
        distinctValues={assertionYesNoMappingDialogState.distinctValues}
        selections={assertionYesNoMappingDialogState.selections}
        loading={loading}
        onCancel={handleAssertionYesNoMappingCancel}
        onSkip={handleAssertionYesNoMappingSkip}
        onSelectionsChange={(selections) =>
          setAssertionYesNoMappingDialogState((prev) => ({
            ...prev,
            selections,
          }))
        }
        onConfirm={handleAssertionYesNoMappingConfirm}
      />

      <Dialog
        open={saveMappingDialog.open}
        onClose={() => {
          if (!saveMappingDialog.submitting) closeSaveMappingDialog({ navigateAway: true })
        }}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>Save column mapping?</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1.5 }}>
          <DialogContentText>
            Save this mapping (including assertion and control-frequency value maps) for reuse on the next import for this template.
          </DialogContentText>
          <TextField
            autoFocus
            fullWidth
            label="Mapping name"
            value={saveMappingDialog.name}
            onChange={(event) =>
              setSaveMappingDialog((prev) => ({
                ...prev,
                name: event.target.value,
                error: '',
                overwrite: false,
              }))
            }
            disabled={saveMappingDialog.submitting}
            error={Boolean(saveMappingDialog.error)}
            helperText={saveMappingDialog.error || 'Use a clear name, e.g. P2P vendor export'}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
          <Button
            onClick={() => closeSaveMappingDialog({ navigateAway: true })}
            disabled={saveMappingDialog.submitting}
            sx={{ textTransform: 'none' }}
          >
            Skip
          </Button>
          {saveMappingDialog.overwrite ? (
            <Button
              variant="contained"
              color="warning"
              disabled={saveMappingDialog.submitting}
              onClick={() => handleSaveMappingConfirm({ overwrite: true })}
              sx={{ textTransform: 'none' }}
            >
              {saveMappingDialog.submitting ? 'Saving…' : 'Overwrite'}
            </Button>
          ) : (
            <Button
              variant="contained"
              disabled={saveMappingDialog.submitting}
              onClick={() => handleSaveMappingConfirm({ overwrite: false })}
              sx={{ textTransform: 'none' }}
            >
              {saveMappingDialog.submitting ? 'Saving…' : 'Save'}
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </Box>
  )
}

export default ExcelColumnMap
