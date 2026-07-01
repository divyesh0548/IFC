import React, { useEffect, useState, useRef } from 'react'
import { alpha, useTheme } from '@mui/material/styles'
import { useNavigate } from 'react-router-dom'
import Button from '@mui/material/Button'
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import Alert from '@mui/material/Alert'
import Collapse from '@mui/material/Collapse'
import TextField from '@mui/material/TextField'
import MenuItem from '@mui/material/MenuItem'
import FormControl from '@mui/material/FormControl'
import InputLabel from '@mui/material/InputLabel'
import Select from '@mui/material/Select'
import IconButton from '@mui/material/IconButton'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogContentText from '@mui/material/DialogContentText'
import DialogActions from '@mui/material/DialogActions'
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider'
import { DatePicker } from '@mui/x-date-pickers/DatePicker'
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs'
import CloudUploadIcon from '@mui/icons-material/CloudUpload'
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile'
import DeleteIcon from '@mui/icons-material/Delete'
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded'
import ChecklistRoundedIcon from '@mui/icons-material/ChecklistRounded'
import AddIcon from '@mui/icons-material/Add'
import { toast } from 'react-hot-toast'
import dayjs from 'dayjs'
import { parseRacmExcelFromArrayBuffer } from '../../utils/racmExcelParse'
import {
  findDetectedControlFrequencyHeader,
  getControlFrequencyValidationDetails,
} from '../../utils/controlFrequencyValidation'
import { RACM_BULK_IMPORT_SESSION_KEY } from '../../racmFormDetailFields'
import { useUnsavedChangesWarning } from '../../utils/useUnsavedChangesWarning'
import { apiUrl } from '../../config/api'
import { useBusinessProcesses } from '../../hooks/useBusinessProcesses'
import { useControlFrequencyOptions } from '../../hooks/useControlFrequencyOptions'
import ControlFrequencyValueMapDialog from '../../components/racm/ControlFrequencyValueMapDialog'
import { SampleSizeSettingsButton } from '../../components/company_co/UnitSampleSizeSettingsDialog'
import ActiveRacmTemplateNotice from '../../components/company_co/ActiveRacmTemplateNotice'
import { buildAutomaticColumnMappingForRows } from '../../utils/racmBulkImportColumnMapping'

const MAX_BULK_IMPORT_ROWS = 5000
const DUPLICATE_CONTROL_NUMBER_MESSAGE = 'Duplicate Control Number already exists for this company'
const DUPLICATE_CONTROL_NUMBER_NOTICE =
  'Change the control number and re-upload the excel or do not import control number'

function ExcelUpload() {
  const theme = useTheme()
  const navigate = useNavigate()
  const fileInputRef = useRef(null)
  const [file, setFile] = useState(null)
  const [loading, setLoading] = useState(false)
  const [preview, setPreview] = useState(null)
  const [isDragging, setIsDragging] = useState(false)
  const [businessProcess, setBusinessProcess] = useState('')
  const [unitId, setUnitId] = useState('')
  const [unitOptions, setUnitOptions] = useState([])
  const [financialYear, setFinancialYear] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [reminderFrequency, setReminderFrequency] = useState('')
  const [headerMode, setHeaderMode] = useState('auto')
  const [headerRowNumber, setHeaderRowNumber] = useState('')
  const [mappingDialogOpen, setMappingDialogOpen] = useState(false)
  const [pendingImport, setPendingImport] = useState(null)
  const [duplicateControlNumberNotice, setDuplicateControlNumberNotice] = useState('')
  const { businessProcessOptions, loading: businessProcessesLoading } = useBusinessProcesses()
  const { controlFrequencyOptions, loading: controlFrequencyOptionsLoading } = useControlFrequencyOptions()
  const [controlFrequencyMappingDialogState, setControlFrequencyMappingDialogState] = useState({
    open: false,
    invalidValues: [],
    ctx: null,
    selections: {},
  })
  const [showSampleSizeNotice, setShowSampleSizeNotice] = useState(false)
  const accentColor = theme.palette.primary.main
  const accentSoft = alpha(accentColor, theme.palette.mode === 'dark' ? 0.18 : 0.12)
  const accentBorder = alpha(accentColor, theme.palette.mode === 'dark' ? 0.22 : 0.14)

  const hasAnyProgress =
    !!file ||
    !!preview ||
    String(businessProcess || '').trim() !== '' ||
    String(unitId || '').trim() !== '' ||
    String(financialYear || '').trim() !== '' ||
    String(dueDate || '').trim() !== '' ||
    String(reminderFrequency || '').trim() !== '' ||
    headerMode !== 'auto' ||
    String(headerRowNumber || '').trim() !== '' ||
    !!pendingImport
  const hasReminderValues = String(dueDate || '').trim() !== '' || String(reminderFrequency || '').trim() !== ''

  useUnsavedChangesWarning(
    hasAnyProgress,
    'Your progress will be lost on this upload page. Do you want to continue?'
  )

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setShowSampleSizeNotice(true)
    }, 200)
    return () => window.clearTimeout(timer)
  }, [])

  // Show 2 FY ranges based on current year (e.g. 2026 -> 2025-26, 2026-27)
  const currentYear = new Date().getFullYear()
  const baseFYStart = currentYear - 1
  const financialYearOptions = Array.from({ length: 2 }, (_, i) => {
    const startYear = baseFYStart + i
    const endYearShort = String((startYear + 1) % 100).padStart(2, '0')
    return `${startYear}-${endYearShort}`
  })

  useEffect(() => {
    let cancelled = false

    const fetchUnits = async () => {
      try {
        const response = await fetch(apiUrl('/api/company-co/assigned-units'), {
          credentials: 'include',
        })
        const result = await response.json()

        if (!cancelled && response.ok && result?.success) {
          const units = Array.isArray(result.units) ? result.units : []
          setUnitOptions(units)
          setUnitId((current) => current || units[0]?.unit_id || '')
        }
      } catch (error) {
        console.error('Failed to fetch units for RACM upload:', error)
      }
    }

    fetchUnits()

    return () => {
      cancelled = true
    }
  }, [])

  const getTomorrowDateString = () => {
    const d = new Date()
    d.setDate(d.getDate() + 1)
    return d.toISOString().split('T')[0]
  }

  const validateAndSetFile = (selectedFile) => {
    if (!selectedFile) {
      setFile(null)
      setPreview(null)
      return false
    }

    const clearFilePicker = () => {
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }

    // Enforce .xlsx extension only (frontend limitation only)
    const fileName = String(selectedFile.name || '').toLowerCase()
    if (!fileName.endsWith('.xlsx')) {
      toast.error('Only .xlsx files are allowed. Please upload an .xlsx file.')
      setFile(null)
      setPreview(null)
      clearFilePicker()
      return false
    }

    // Validate file type
    const validTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
    ]

    if (!validTypes.includes(selectedFile.type)) {
      toast.error('Invalid file type. Please upload an .xlsx file.')
      setFile(null)
      setPreview(null)
      clearFilePicker()
      return false
    }

    // Validate file size (20MB limit)
    if (selectedFile.size > 20 * 1024 * 1024) {
      toast.error('File size exceeds 20MB limit.')
      setFile(null)
      setPreview(null)
      clearFilePicker()
      return false
    }

    setFile(selectedFile)
    setPreview({
      name: selectedFile.name
    })
    return true
  }

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0]
    validateAndSetFile(selectedFile)
  }

  const handleDragOver = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }

  const handleDragLeave = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)

    const droppedFile = e.dataTransfer.files[0]
    validateAndSetFile(droppedFile)
  }

  const handleFileSelect = () => {
    fileInputRef.current?.click()
  }

  const handleRemoveFile = () => {
    setFile(null)
    setPreview(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleResetReminderSettings = () => {
    setDueDate('')
    setReminderFrequency('')
  }

  const clearFormAfterSuccess = (formEvent) => {
    setDuplicateControlNumberNotice('')
    setFile(null)
    setPreview(null)
    setBusinessProcess('')
    setUnitId(unitOptions[0]?.unit_id || '')
    setFinancialYear('')
    setDueDate('')
    setReminderFrequency('')
    setHeaderMode('auto')
    setHeaderRowNumber('')
    if (fileInputRef.current) fileInputRef.current.value = ''
    if (formEvent?.target && typeof formEvent.target.reset === 'function') {
      formEvent.target.reset()
    }
  }

  const runBulkImport = async (ctx, options = {}) => {
    const {
      column_mapping: columnMapping,
      control_frequency_value_mapping: controlFrequencyValueMapping,
      formEvent,
    } = options
    const {
      rows,
      businessProcess: bp,
      financialYear: fy,
      unitId: selectedUnitId,
      dueDateValue,
      reminderFrequencyValue,
    } = ctx

    setLoading(true)
    setDuplicateControlNumberNotice('')
    try {
      const payload = {
        businessProcess: bp,
        financialYear: fy,
        unit_id: selectedUnitId,
        rows,
      }
      if (dueDateValue && reminderFrequencyValue) {
        payload.due_date = dueDateValue
        payload.reminder_frequency = reminderFrequencyValue
      }
      if (columnMapping && typeof columnMapping === 'object' && Object.keys(columnMapping).length > 0) {
        payload.column_mapping = columnMapping
      }
      if (
        controlFrequencyValueMapping &&
        typeof controlFrequencyValueMapping === 'object' &&
        Object.keys(controlFrequencyValueMapping).length > 0
      ) {
        payload.control_frequency_value_mapping = controlFrequencyValueMapping
      }

      const response = await fetch(apiUrl('/api/control-forms/bulk-import-rows'), {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
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
        clearFormAfterSuccess(formEvent)
      } else {
        if (String(data?.message || '').includes(DUPLICATE_CONTROL_NUMBER_MESSAGE)) {
          setDuplicateControlNumberNotice(DUPLICATE_CONTROL_NUMBER_NOTICE)
        }
        toast.error(data.message || 'Failed to import RACMs')
      }
    } catch (err) {
      console.error('Import error:', err)
      toast.error('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!file) {
      toast.error('Please select a file to upload')
      return
    }

    if (!businessProcess) {
      toast.error('Please select a business process')
      return
    }

    if (!unitId) {
      toast.error('Please select a unit')
      return
    }

    if (!financialYear) {
      toast.error('Please select a financial year')
      return
    }

    const dueDateValue = String(dueDate || '').trim()
    const reminderFrequencyValue = String(reminderFrequency || '').trim()
    if ((dueDateValue && !reminderFrequencyValue) || (!dueDateValue && reminderFrequencyValue)) {
      toast.error('Please fill both Due Date and Reminder Frequency (or keep both empty).')
      return
    }

    const headerRowValue = String(headerRowNumber || '').trim()
    const manualHeaderRowNumber = headerMode === 'manual' ? Number(headerRowValue) : null
    if (headerMode === 'manual') {
      if (!headerRowValue || !Number.isInteger(manualHeaderRowNumber) || manualHeaderRowNumber < 1) {
        toast.error('Please enter a valid header row number starting from 1.')
        return
      }
    }

    let rows
    try {
      const buffer = await file.arrayBuffer()
      rows = parseRacmExcelFromArrayBuffer(buffer, {
        headerRowNumber: manualHeaderRowNumber,
      })
    } catch (parseErr) {
      toast.error(parseErr.message || 'Could not read the Excel file.')
      return
    }

    if (rows.length > MAX_BULK_IMPORT_ROWS) {
      toast.error(`Too many data rows (max ${MAX_BULK_IMPORT_ROWS}). Split the workbook and import in parts.`)
      return
    }

    setPendingImport({
      rows,
      businessProcess,
      unitId,
      financialYear,
      dueDateValue,
      reminderFrequencyValue,
      fileName: file.name,
    })
    setMappingDialogOpen(true)
  }

  const handleMappingDialogCancel = () => {
    setMappingDialogOpen(false)
    setPendingImport(null)
  }

  const loadBulkImportMappingContext = async (selectedUnitId) => {
    const [mappingResponse, templateResponse] = await Promise.all([
      fetch(apiUrl('/api/control-forms/column-mapping-config'), { credentials: 'include' }),
      fetch(
        apiUrl(`/api/company-co/racm-templates?unit_id=${encodeURIComponent(selectedUnitId)}`),
        { credentials: 'include' }
      ),
    ])
    const mappingData = await mappingResponse.json()
    const templateData = await templateResponse.json()
    if (!mappingResponse.ok || !mappingData?.success || !mappingData?.data?.simpleColumnMapping) {
      throw new Error('Could not load column mapping config')
    }
    const templateExtraFields =
      templateResponse.ok && templateData.success && Array.isArray(templateData.data?.extra_fields)
        ? templateData.data.extra_fields
        : []
    return {
      mappingConfig: {
        simpleColumnMapping: mappingData.data.simpleColumnMapping,
        columnPatterns: mappingData.data.columnPatterns,
      },
      templateExtraFields,
    }
  }

  const handleAutomaticColumnMapping = async () => {
    if (!pendingImport) {
      handleMappingDialogCancel()
      return
    }

    let columnMapping = {}
    try {
      const { mappingConfig, templateExtraFields } = await loadBulkImportMappingContext(pendingImport.unitId)
      columnMapping = buildAutomaticColumnMappingForRows(
        pendingImport.rows,
        mappingConfig,
        templateExtraFields
      )
    } catch (error) {
      console.error('Failed to build automatic column mapping:', error)
      toast.error('Could not prepare column mapping for import. Try manual column mapping.')
      return
    }

    const detectedControlFrequencyHeader = findDetectedControlFrequencyHeader(pendingImport.rows)
    if (!detectedControlFrequencyHeader) {
      toast.error(
        'Control Frequency column was not detected automatically. Map it manually or correct the Excel file and upload again.'
      )
      return
    }

    const controlFrequencyValidation = getControlFrequencyValidationDetails(
      pendingImport.rows,
      detectedControlFrequencyHeader
    )
    if (!controlFrequencyValidation.ok) {
      if (controlFrequencyValidation.reason === 'invalid_value') {
        setMappingDialogOpen(false)
        setControlFrequencyMappingDialogState({
          open: true,
          invalidValues: controlFrequencyValidation.invalidValues,
          ctx: {
            importCtx: pendingImport,
            column_mapping: columnMapping,
          },
          selections: Object.fromEntries(
            controlFrequencyValidation.invalidValues.map((value) => [value, ''])
          ),
        })
        return
      }
      toast.error(controlFrequencyValidation.message)
      return
    }

    const ctx = pendingImport
    setMappingDialogOpen(false)
    setPendingImport(null)
    await runBulkImport(ctx, { column_mapping: columnMapping })
  }

  const handleCustomColumnMapping = () => {
    if (!pendingImport) {
      handleMappingDialogCancel()
      return
    }
    const p = pendingImport
    try {
      const sessionPayload = {
        rows: p.rows,
        businessProcess: p.businessProcess,
        unitId: p.unitId,
        financialYear: p.financialYear,
        fileName: p.fileName || '',
      }
      if (p.dueDateValue && p.reminderFrequencyValue) {
        sessionPayload.due_date = p.dueDateValue
        sessionPayload.reminder_frequency = p.reminderFrequencyValue
      }
      sessionStorage.setItem(RACM_BULK_IMPORT_SESSION_KEY, JSON.stringify(sessionPayload))
    } catch (err) {
      console.error(err)
      toast.error(
        'Could not store the file data for mapping. Try a smaller file, or use automatic mapping.'
      )
      return
    }
    setMappingDialogOpen(false)
    setPendingImport(null)
    navigate('/company_co/control-creation/column-map')
  }

  const handleControlFrequencyMappingCancel = () => {
    setControlFrequencyMappingDialogState({
      open: false,
      invalidValues: [],
      ctx: null,
      selections: {},
    })
  }

  const handleControlFrequencyMappingConfirm = async (mapping) => {
    const ctx = controlFrequencyMappingDialogState.ctx
    handleControlFrequencyMappingCancel()
    if (!ctx?.importCtx) return
    await runBulkImport(ctx.importCtx, {
      column_mapping: ctx.column_mapping,
      control_frequency_value_mapping: mapping,
    })
  }

  return (
    <Box
      sx={{
        width: '100%',
        px: 0,
        py: 2,
        display: 'flex',
        flexDirection: 'column',
        gap: 3,
      }}
    >
      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', sm: 'row' },
          justifyContent: 'space-between',
          alignItems: { xs: 'stretch', sm: 'center' },
          gap: 1.5,
        }}
      >
        <Box sx={{ display: 'flex', gap: 1.25, flexWrap: 'wrap', alignItems: 'center' }}>
          <SampleSizeSettingsButton unitOptions={unitOptions} selectedUnitId={unitId} />
          <Button
            type="button"
            onClick={() => navigate('/company_co/manual-control-creation')}
            variant="contained"
            startIcon={<AddIcon />}
            sx={{
              textTransform: 'none',
              fontWeight: 700,
              borderRadius: 999,
              px: 2.2,
            }}
          >
            Manual RACM Creation
          </Button>
        </Box>
        <Button
          type="button"
          onClick={() => navigate('/company_co/dashboard')}
          variant="outlined"
          sx={{
            textTransform: 'none',
            fontWeight: 400,
            borderRadius: 999,
            px: 2,
            alignSelf: { xs: 'flex-start', sm: 'center' },
            borderColor:
              theme.palette.mode === 'dark'
                ? alpha(theme.palette.common.white, 0.16)
                : alpha(theme.palette.text.primary, 0.14),
            color: theme.palette.text.primary,
          }}
        >
          Back to Dashboard
        </Button>
      </Box>

      <Collapse in={showSampleSizeNotice}>
        <Alert
          severity="info"
          onClose={() => setShowSampleSizeNotice(false)}
          sx={{
            borderRadius: 2,
            boxShadow: theme.palette.mode === 'dark'
              ? '0 8px 24px rgba(0, 0, 0, 0.24)'
              : '0 8px 24px rgba(15, 23, 42, 0.08)',
          }}
        >
          Review the sample size for each control frequency before creating RACMs.
        </Alert>
      </Collapse>

      <ActiveRacmTemplateNotice unitId={unitId} variant="bulk" />

      <Box
        sx={{
          position: 'relative',
          overflow: 'hidden',
          borderRadius: 3,
          border: '1px solid',
          borderColor:
            theme.palette.mode === 'dark'
              ? alpha(theme.palette.common.white, 0.08)
              : alpha(theme.palette.primary.main, 0.1),
          background: theme.palette.mode === 'dark'
            ? `linear-gradient(145deg, ${alpha(theme.palette.primary.dark, 0.34)} 0%, ${alpha(theme.palette.background.paper, 0.9)} 50%, ${alpha(theme.palette.primary.main, 0.18)} 100%)`
            : `linear-gradient(145deg, ${alpha(theme.palette.primary.light, 0.34)} 0%, ${alpha(theme.palette.background.paper, 0.98)} 48%, ${alpha(theme.palette.secondary.light, 0.4)} 100%)`,
          boxShadow: theme.palette.mode === 'dark'
            ? '0 22px 48px rgba(0, 0, 0, 0.28)'
            : '0 22px 48px rgba(15, 23, 42, 0.08)',
        }}
      >
        <Box
          sx={{
            position: 'absolute',
            top: -80,
            right: -30,
            width: 240,
            height: 240,
            borderRadius: '50%',
            background: `radial-gradient(circle, ${alpha(accentColor, 0.22)} 0%, transparent 72%)`,
          }}
        />
        <Box
          sx={{
            position: 'relative',
            p: { xs: 2.5, sm: 3.5, md: 4 },
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1.4fr) minmax(320px, 0.9fr)' },
            gap: 3,
          }}
        >
          <Box sx={{ minWidth: 0 }}>
            <Box
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 1,
                px: 1.35,
                py: 0.72,
                borderRadius: 999,
                mb: 2,
                backgroundColor: alpha(theme.palette.background.paper, theme.palette.mode === 'dark' ? 0.1 : 0.72),
                border: `1px solid ${accentBorder}`,
              }}
            >
              <AutoAwesomeRoundedIcon sx={{ fontSize: 16, color: accentColor }} />
              <Typography sx={{ fontSize: '0.82rem', fontWeight: 700, color: theme.palette.text.secondary }}>
                Bulk RACM Import
              </Typography>
            </Box>
            <Typography
              sx={{
                fontSize: { xs: '1.9rem', sm: '2.45rem', md: '2.85rem' },
                fontWeight: 900,
                lineHeight: 1.05,
                letterSpacing: '-0.03em',
                color: theme.palette.text.primary,
                maxWidth: 760,
              }}
            >
              Import RACMs from Excel in bulk with header mapping support.
            </Typography>
            <Typography
              sx={{
                mt: 1.4,
                maxWidth: 760,
                fontSize: { xs: '0.98rem', sm: '1.03rem' },
                lineHeight: 1.7,
                color: theme.palette.text.secondary,
              }}
            >
              Upload RACMs in bulk with Excel or switch to the manual creation flow for individual entries.
            </Typography>
          </Box>

          <Box
            sx={{
              display: 'grid',
              gap: 1.4,
              alignContent: 'start',
              pt: { xs: 0, lg: 1 },
            }}
          >
            <Typography sx={{ fontSize: '0.88rem', fontWeight: 800, color: theme.palette.text.secondary }}>
              Upload checklist
            </Typography>
            {[
              'Use a .xlsx file only, up to 20 MB.',
              `Bussiness Process in excel will be ignored and will be set to the selected business process.`,
              'Due date and reminder frequency are optional and can be configured later',
            ].map((item) => (
              <Box key={item} sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.1 }}>
                <Box
                  sx={{
                    width: 9,
                    height: 9,
                    borderRadius: '50%',
                    mt: '7px',
                    backgroundColor: accentColor,
                    flexShrink: 0,
                  }}
                />
                <Typography sx={{ fontSize: '0.92rem', lineHeight: 1.65, color: theme.palette.text.primary }}>
                  {item}
                </Typography>
              </Box>
            ))}
          </Box>
        </Box>
      </Box>

      <Paper
        elevation={0}
        sx={{
          p: { xs: 2.2, sm: 3, md: 3.25 },
          borderRadius: 3,
          border: '1px solid',
          borderColor:
            theme.palette.mode === 'dark'
              ? alpha(theme.palette.common.white, 0.08)
              : alpha(theme.palette.divider, 1),
          backgroundColor: alpha(theme.palette.background.paper, 0.96),
          boxShadow: theme.palette.mode === 'dark'
            ? '0 18px 36px rgba(0, 0, 0, 0.2)'
            : '0 18px 36px rgba(15, 23, 42, 0.05)',
        }}
      >
        <Box sx={{ mb: 2.5 }}>
          <Typography sx={{ fontSize: '1.35rem', fontWeight: 900, color: theme.palette.text.primary }}>
            Upload Setup
          </Typography>
          <Typography sx={{ mt: 0.6, fontSize: '0.93rem', color: theme.palette.text.secondary }}>
            Configure the file and submission details below.
          </Typography>
        </Box>

        <form onSubmit={handleSubmit}>
              {duplicateControlNumberNotice ? (
                <Alert severity="warning" sx={{ mb: 2.5 }}>
                  {duplicateControlNumberNotice}
                </Alert>
              ) : null}

              {/* Hidden File Input */}
              <input
                type="file"
                ref={fileInputRef}
                id="excelFile"
                name="excelFile"
                accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                onChange={handleFileChange}
                disabled={loading}
                style={{ display: 'none' }}
                required
              />

              {/* MUI File Upload Area */}
              {!preview ? (
                <Paper
                  elevation={0}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={loading ? undefined : handleFileSelect}
                  sx={{
                    p: { xs: 3, sm: 4 },
                    mb: 3,
                    border: '1.5px dashed',
                    borderColor: isDragging ? accentColor : alpha(theme.palette.divider, 0.95),
                    borderRadius: 2,
                    textAlign: 'center',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    background: isDragging
                      ? `linear-gradient(180deg, ${alpha(accentColor, theme.palette.mode === 'dark' ? 0.18 : 0.08)} 0%, transparent 100%)`
                      : theme.palette.mode === 'dark'
                        ? alpha(theme.palette.common.white, 0.02)
                        : alpha('#f8fafc', 0.9),
                    transition: 'border-color 180ms ease, background-color 180ms ease, box-shadow 180ms ease',
                    '&:hover': loading
                      ? {}
                      : {
                          borderColor: alpha(accentColor, 0.8),
                          boxShadow: `inset 0 0 0 1px ${alpha(accentColor, 0.12)}`,
                        },
                  }}
                >
                  <Box
                    sx={{
                      width: 72,
                      height: 72,
                      borderRadius: 2,
                      display: 'grid',
                      placeItems: 'center',
                      mx: 'auto',
                      mb: 2,
                      color: theme.palette.mode === 'dark' ? alpha(theme.palette.common.white, 0.92) : accentColor,
                      backgroundColor: accentSoft,
                    }}
                  >
                    <CloudUploadIcon sx={{ fontSize: 38 }} />
                  </Box>
                  <Typography sx={{ fontSize: '1.1rem', fontWeight: 800, color: theme.palette.text.primary }}>
                    Drop your Excel file here
                  </Typography>
                  <Typography sx={{ mt: 0.8, fontSize: '0.94rem', color: theme.palette.text.secondary }}>
                    Click to browse or drag and drop a `.xlsx` file up to 20 MB.
                  </Typography>
                </Paper>
              ) : (
                <Paper
                  elevation={0}
                  sx={{
                    p: 2.2,
                    mb: 3,
                    border: '1px solid',
                    borderColor: accentBorder,
                    borderRadius: 2,
                    backgroundColor: alpha(accentColor, theme.palette.mode === 'dark' ? 0.12 : 0.05),
                  }}
                >
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: { xs: 'flex-start', sm: 'center' },
                      justifyContent: 'space-between',
                      gap: 2,
                      flexWrap: 'wrap',
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flex: 1, minWidth: 0 }}>
                      <Box
                        sx={{
                          width: 48,
                          height: 48,
                          borderRadius: 2,
                          display: 'grid',
                          placeItems: 'center',
                          backgroundColor: alpha(accentColor, theme.palette.mode === 'dark' ? 0.2 : 0.12),
                          color: theme.palette.mode === 'dark' ? alpha(theme.palette.common.white, 0.92) : accentColor,
                          flexShrink: 0,
                        }}
                      >
                        <InsertDriveFileIcon sx={{ fontSize: 26 }} />
                      </Box>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography sx={{ fontSize: '0.82rem', fontWeight: 800, color: theme.palette.text.secondary }}>
                          Selected file
                        </Typography>
                        <Typography sx={{ mt: 0.2, fontSize: '0.98rem', fontWeight: 800, color: theme.palette.text.primary, wordBreak: 'break-word' }}>
                          {preview.name}
                        </Typography>
                      </Box>
                    </Box>
                    <IconButton
                      onClick={handleRemoveFile}
                      disabled={loading}
                      size="small"
                      sx={{
                        color: theme.palette.text.primary,
                        border: '1px solid',
                        borderColor: alpha(theme.palette.text.primary, 0.14),
                      }}
                    >
                      <DeleteIcon />
                    </IconButton>
                  </Box>
                </Paper>
              )}

              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', md: 'repeat(3, minmax(0, 1fr))' },
                  gap: 2,
                  mb: 2.5,
                }}
              >
                <FormControl fullWidth required disabled={loading || businessProcessesLoading} variant="outlined">
                  <InputLabel id="business-process-label">Business Process</InputLabel>
                  <Select
                    labelId="business-process-label"
                    id="business-process"
                    value={businessProcess}
                    label="Business Process"
                    onChange={(e) => setBusinessProcess(e.target.value)}
                  >
                    {businessProcessOptions.map((option) => (
                      <MenuItem key={option} value={option}>
                        {option}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <FormControl fullWidth required disabled={loading || unitOptions.length === 0} variant="outlined">
                  <InputLabel id="unit-label">Unit</InputLabel>
                  <Select
                    labelId="unit-label"
                    id="unit"
                    value={unitId}
                    label="Unit"
                    onChange={(e) => setUnitId(e.target.value)}
                  >
                    {unitOptions.map((unit) => (
                      <MenuItem key={unit.unit_id || unit.id} value={unit.unit_id}>
                        {unit.unit_name || unit.unit_id}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <FormControl fullWidth required disabled={loading} variant="outlined">
                  <InputLabel id="financial-year-label">Financial Year</InputLabel>
                  <Select
                    labelId="financial-year-label"
                    id="financial-year"
                    value={financialYear}
                    label="Financial Year"
                    onChange={(e) => setFinancialYear(e.target.value)}
                  >
                    {financialYearOptions.map((option) => (
                      <MenuItem key={option} value={option}>
                        {option}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Box>

              <Paper
                elevation={0}
                sx={{
                  p: { xs: 2, sm: 2.2 },
                  mb: 2.5,
                  borderRadius: 2,
                  border: '1px solid',
                  borderColor:
                    theme.palette.mode === 'dark'
                      ? alpha(theme.palette.common.white, 0.07)
                      : alpha(theme.palette.divider, 0.95),
                  backgroundColor: theme.palette.mode === 'dark'
                    ? alpha(theme.palette.common.white, 0.025)
                    : alpha('#f8fafc', 0.85),
                }}
              >
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: 1.1,
                    rowGap: 1,
                    mb: 1.8,
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.1, flex: 1, minWidth: 0 }}>
                    <ChecklistRoundedIcon sx={{ fontSize: 20, color: theme.palette.text.secondary }} />
                    <Typography sx={{ fontSize: '1rem', fontWeight: 800, color: theme.palette.text.primary }}>
                      Reminder settings
                    </Typography>
                    <Typography sx={{ fontSize: '0.86rem', color: theme.palette.text.secondary }}>
                      Optional
                    </Typography>
                  </Box>
                  <Button
                    type="button"
                    variant="outlined"
                    size="small"
                    onClick={handleResetReminderSettings}
                    disabled={loading || !hasReminderValues}
                    sx={{
                      textTransform: 'none',
                      borderRadius: 2,
                      ml: { xs: 'auto', sm: 0 },
                    }}
                  >
                    Reset
                  </Button>
                </Box>
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' },
                    gap: 2,
                  }}
                >
                  <LocalizationProvider dateAdapter={AdapterDayjs}>
                    <DatePicker
                      label="Due Date"
                      value={dueDate ? dayjs(dueDate) : null}
                      onChange={(newValue) => {
                        if (!newValue || !newValue.isValid()) {
                          setDueDate('')
                          return
                        }
                        setDueDate(newValue.format('YYYY-MM-DD'))
                      }}
                      minDate={dayjs(getTomorrowDateString())}
                      disabled={loading}
                      slotProps={{
                        textField: {
                          fullWidth: true,
                        },
                      }}
                    />
                  </LocalizationProvider>

                  <FormControl fullWidth disabled={loading} variant="outlined">
                    <InputLabel id="reminder-frequency-label">Reminder Frequency</InputLabel>
                    <Select
                      labelId="reminder-frequency-label"
                      value={reminderFrequency}
                      label="Reminder Frequency"
                      onChange={(e) => setReminderFrequency(e.target.value)}
                    >
                      <MenuItem value="Daily">Daily</MenuItem>
                      <MenuItem value="Weekly">Weekly</MenuItem>
                      <MenuItem value="Monthly">Monthly</MenuItem>
                    </Select>
                  </FormControl>
                </Box>
              </Paper>

              <Paper
                elevation={0}
                sx={{
                  p: { xs: 2, sm: 2.2 },
                  mb: 2.5,
                  borderRadius: 2,
                  border: '1px solid',
                  borderColor:
                    theme.palette.mode === 'dark'
                      ? alpha(theme.palette.common.white, 0.07)
                      : alpha(theme.palette.divider, 0.95),
                  backgroundColor: theme.palette.mode === 'dark'
                    ? alpha(theme.palette.common.white, 0.025)
                    : alpha('#f8fafc', 0.85),
                }}
              >
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1fr) minmax(160px, 0.5fr)' },
                    gap: 2,
                    alignItems: 'start',
                  }}
                >
                  <FormControl fullWidth disabled={loading} variant="outlined">
                    <InputLabel id="header-mode-label">Header Location</InputLabel>
                    <Select
                      labelId="header-mode-label"
                      value={headerMode}
                      label="Header Location"
                      onChange={(e) => {
                        setHeaderMode(e.target.value)
                        if (e.target.value === 'auto') setHeaderRowNumber('')
                      }}
                    >
                      <MenuItem value="auto">Auto detect header</MenuItem>
                      <MenuItem value="manual">Use Excel row number</MenuItem>
                    </Select>
                  </FormControl>
                  <TextField
                    label="Header Row Number"
                    type="number"
                    value={headerRowNumber}
                    onChange={(e) => setHeaderRowNumber(e.target.value)}
                    disabled={loading || headerMode === 'auto'}
                    required={headerMode === 'manual'}
                    inputProps={{ min: 1, step: 1 }}
                    helperText="Use Excel row numbering, starting from 1."
                    fullWidth
                  />
                </Box>
              </Paper>

              <Box
                sx={{
                  display: 'flex',
                  flexDirection: { xs: 'column', sm: 'row' },
                  gap: 1.5,
                }}
              >
                <Button
                  type="submit"
                  disabled={
                    loading ||
                    businessProcessesLoading ||
                    mappingDialogOpen ||
                    !file ||
                    !businessProcess ||
                    !unitId ||
                    !financialYear
                  }
                  variant="contained"
                  color="secondary"
                  sx={{
                    py: 1.45,
                    fontWeight: 400,
                    fontSize: '0.96rem',
                    textTransform: 'none',
                    borderRadius: 2,
                    width: 'auto',
                    minWidth: 180,
                    alignSelf: 'flex-start',
                  }}
                >
                  {loading ? 'Importing…' : 'Import RACMs'}
                </Button>
                <Button
                  type="button"
                  onClick={handleFileSelect}
                  variant="outlined"
                  disabled={loading}
                  sx={{
                    py: 1.45,
                    px: 2.2,
                    fontWeight: 400,
                    fontSize: '0.95rem',
                    textTransform: 'none',
                    borderRadius: 2,
                    borderColor:
                      theme.palette.mode === 'dark'
                        ? alpha(theme.palette.common.white, 0.16)
                        : alpha(theme.palette.text.primary, 0.14),
                    color: theme.palette.text.primary,
                  }}
                >
                  Replace File
                </Button>
              </Box>
            </form>
      </Paper>

      <Dialog
        open={mappingDialogOpen}
        onClose={handleMappingDialogCancel}
        aria-labelledby="racm-mapping-dialog-title"
        aria-describedby="racm-mapping-dialog-description"
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 2,
            minWidth: { xs: '90%', sm: '440px' },
            boxShadow:
              theme.palette.mode === 'dark'
                ? '0 8px 32px rgba(0, 0, 0, 0.4)'
                : '0 8px 32px rgba(0, 0, 0, 0.12)',
          },
        }}
      >
        <DialogTitle
          id="racm-mapping-dialog-title"
          sx={{
            pb: 2,
            pt: 2.5,
            px: 3,
            fontWeight: 600,
            fontSize: '1.25rem',
            color: theme.palette.text.primary,
          }}
        >
          Column Mapping
        </DialogTitle>
        <DialogContent sx={{ px: 3, pt: 1, pb: 3 }}>
          <DialogContentText
            id="racm-mapping-dialog-description"
            sx={{
              color: theme.palette.text.secondary,
              fontSize: '0.9375rem',
              lineHeight: 1.6,
              m: 0,
              mb: 2,
              mt: 1.5,
            }}
          >
            Do you want to review and map Excel column headers to RACM fields? Use this when your sheet
            uses names that do not match the active template (for example, map &quot;Query Name&quot; to
            Application Name). Automatic import uses the active template for the selected unit, including
            custom and assertion columns where headers match template keywords.
          </DialogContentText>
          <Box sx={{ display: 'grid', gap: 1.5 }}>
            <Box
              sx={{
                p: 2,
                borderRadius: 1.5,
                border: '1px solid',
                borderColor: alpha(theme.palette.divider, 0.9),
                backgroundColor:
                  theme.palette.mode === 'dark'
                    ? alpha(theme.palette.common.white, 0.02)
                    : alpha('#f8fafc', 0.9),
              }}
            >
              <Typography sx={{ fontSize: '0.98rem', fontWeight: 800, color: theme.palette.text.primary, mb: 0.6 }}>
                Use automatic mapping
              </Typography>
              <Typography sx={{ fontSize: '0.9rem', lineHeight: 1.6, color: theme.palette.text.secondary }}>
                Continue immediately when your Excel headers already match the active unit template.
              </Typography>
            </Box>
            <Box
              sx={{
                p: 2,
                borderRadius: 1.5,
                border: '1px solid',
                borderColor: accentBorder,
                backgroundColor: accentSoft,
              }}
            >
              <Typography sx={{ fontSize: '0.98rem', fontWeight: 800, color: theme.palette.text.primary, mb: 0.6 }}>
                Adjust column mapping
              </Typography>
              <Typography sx={{ fontSize: '0.9rem', lineHeight: 1.6, color: theme.palette.text.secondary }}>
                Review detected headers one by one and map them manually before importing.
              </Typography>
            </Box>
          </Box>
        </DialogContent>
        <DialogActions
          sx={{
            px: 3,
            pb: 3,
            pt: 2.5,
            gap: 1.5,
            flexWrap: 'wrap',
            borderTop: '1px solid',
            borderColor: 'divider',
          }}
        >
          <Button
            onClick={handleMappingDialogCancel}
            variant="outlined"
            sx={{
              textTransform: 'none',
              px: 3,
              py: 1,
              minWidth: '100px',
              borderColor:
                theme.palette.mode === 'dark'
                  ? 'rgba(255, 255, 255, 0.23)'
                  : 'rgba(0, 0, 0, 0.23)',
              color: theme.palette.text.primary,
              '&:hover': {
                borderColor:
                  theme.palette.mode === 'dark'
                    ? 'rgba(255, 255, 255, 0.3)'
                    : 'rgba(0, 0, 0, 0.3)',
                backgroundColor:
                  theme.palette.mode === 'dark'
                    ? 'rgba(255, 255, 255, 0.05)'
                    : 'rgba(0, 0, 0, 0.04)',
              },
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleAutomaticColumnMapping}
            variant="outlined"
            disabled={loading}
            sx={{
              textTransform: 'none',
              px: 3,
              py: 1,
              minWidth: '164px',
              borderColor: alpha(accentColor, 0.35),
              color: accentColor,
              '&:hover': {
                borderColor: alpha(accentColor, 0.55),
                backgroundColor: alpha(accentColor, 0.06),
              },
            }}
          >
            Use automatic mapping
          </Button>
          <Button
            onClick={handleCustomColumnMapping}
            variant="contained"
            color="secondary"
            disabled={loading}
            autoFocus
            sx={{
              textTransform: 'none',
              px: 3,
              py: 1,
              minWidth: '164px',
              fontWeight: 600,
            }}
          >
            Adjust column mapping
          </Button>
        </DialogActions>
      </Dialog>
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
      </Box>
  )
}

export default ExcelUpload
