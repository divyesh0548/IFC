import React, { useState, useRef } from 'react'
import { alpha, useTheme } from '@mui/material/styles'
import { useNavigate } from 'react-router-dom'
import Button from '@mui/material/Button'
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import TextField from '@mui/material/TextField'
import MenuItem from '@mui/material/MenuItem'
import FormControl from '@mui/material/FormControl'
import InputLabel from '@mui/material/InputLabel'
import Select from '@mui/material/Select'
import IconButton from '@mui/material/IconButton'
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider'
import { DatePicker } from '@mui/x-date-pickers/DatePicker'
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs'
import CloudUploadIcon from '@mui/icons-material/CloudUpload'
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile'
import DeleteIcon from '@mui/icons-material/Delete'
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded'
import ChecklistRoundedIcon from '@mui/icons-material/ChecklistRounded'
import { toast } from 'react-hot-toast'
import * as XLSX from 'xlsx'
import dayjs from 'dayjs'

function ExcelUpload() {
  const theme = useTheme()
  const navigate = useNavigate()
  const fileInputRef = useRef(null)
  const [file, setFile] = useState(null)
  const [loading, setLoading] = useState(false)
  const [preview, setPreview] = useState(null)
  const [isDragging, setIsDragging] = useState(false)
  const [businessProcess, setBusinessProcess] = useState('')
  const [financialYear, setFinancialYear] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [reminderFrequency, setReminderFrequency] = useState('')
  const accentColor = theme.palette.primary.main
  const accentSoft = alpha(accentColor, theme.palette.mode === 'dark' ? 0.18 : 0.12)
  const accentBorder = alpha(accentColor, theme.palette.mode === 'dark' ? 0.22 : 0.14)
  const businessProcessOptions = [
    'Purchase to Pay',
    'Order to Cash',
    'Hire to Retire',
    'Capital Expenditure',
    'Treasury',
    'Financial Statement Closure Process',
    'Information Technology General Controls',
    'Entity Level Controls',
  ]
  const financialYearOptions = ['2024-25', '2025-26']

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

  const normalizeHeader = (value) => String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

  /**
   * Check if "Process Owner" column exists and gather its non-empty values.
   * Returns an object: { hasColumn: boolean, hasAnyValue: boolean, nonEmptyValues: string[] }.
   */
  const checkProcessOwnerColumn = async (inputFile) => {
    if (!inputFile) {
      return { hasColumn: false, hasAnyValue: false, nonEmptyValues: [] }
    }

    const buffer = await inputFile.arrayBuffer()
    const workbook = XLSX.read(buffer, { type: 'array' })
    const firstSheetName = workbook.SheetNames?.[0]
    if (!firstSheetName) {
      return { hasColumn: false, hasAnyValue: false, nonEmptyValues: [] }
    }

    const worksheet = workbook.Sheets[firstSheetName]
    const nonEmptyValues = []

    // Header row may not start at first row, so scan at least first 10 rows
    let hasColumn = false
    try {
      const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: false, defval: '' })

      const headerSearchLimit = Math.min(10, Array.isArray(rows) ? rows.length : 0)
      let headerRowIndex = -1
      let processOwnerIndex = -1

      for (let r = 0; r < headerSearchLimit; r++) {
        const row = Array.isArray(rows?.[r]) ? rows[r] : []
        const idx = row.findIndex((cell) => normalizeHeader(cell) === 'process owner')

        if (idx !== -1) {
          headerRowIndex = r
          processOwnerIndex = idx
          hasColumn = true
          break
        }
      }

      if (hasColumn && headerRowIndex !== -1 && processOwnerIndex !== -1) {
        for (let r = headerRowIndex + 1; r < rows.length; r++) {
          const row = Array.isArray(rows?.[r]) ? rows[r] : []
          const cellValue = row?.[processOwnerIndex]
          if (cellValue !== undefined && cellValue !== null && String(cellValue).trim() !== '') {
            nonEmptyValues.push(String(cellValue).trim())
          }
        }
      }
    } catch (err) {
      // If parsing fails, we fall back to "column not available" behavior.
      console.warn('Process Owner validation failed:', err)
    }

    const uniqueNonEmptyValues = [...new Set(nonEmptyValues)]
    const hasAnyValue = uniqueNonEmptyValues.length > 0

    return { hasColumn, hasAnyValue, nonEmptyValues: uniqueNonEmptyValues }
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

    try {
      const { hasColumn, hasAnyValue, nonEmptyValues } = await checkProcessOwnerColumn(file)

      if (hasColumn && !hasAnyValue) {
        // Column present but empty -> warn, but continue upload.
        toast('Process Owner column is empty.', { icon: '⚠️' })
      }

      if (hasColumn && hasAnyValue) {
        // Column exists and has at least one value: validate all non-empty entries as emails.
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        const invalidEmails = nonEmptyValues.filter((val) => !emailRegex.test(val))

        if (invalidEmails.length > 0) {
          // Block upload if any invalid email is found.
          toast.error('Please update a valid email_id in control_owner column.')
          return
        }
      }
    } catch (validationError) {
      console.warn('Could not validate Process Owner column in uploaded file:', validationError)
    }

    setLoading(true)

    try {
      const formData = new FormData()
      formData.append('excelFile', file)
      formData.append('businessProcess', businessProcess)
      formData.append('financialYear', financialYear)
      if (dueDateValue && reminderFrequencyValue) {
        formData.append('due_date', dueDateValue)
        formData.append('reminder_frequency', reminderFrequencyValue)
      }

      const response = await fetch('http://localhost:3000/api/control-forms/bulk-upload', {
        method: 'POST',
        credentials: 'include',
        body: formData
      })

      const data = await response.json()

      if (response.ok && data.success) {
        toast.success('File uploaded successfully')
        setFile(null)
        setPreview(null)
        setBusinessProcess('')
        setFinancialYear('')
        setDueDate('')
        setReminderFrequency('')
        // Reset file input
        e.target.reset()
      } else {
        toast.error(data.message || 'Failed to upload file')
      }
    } catch (err) {
      console.error('Upload error:', err)
      toast.error('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
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
                Bulk RACM onboarding
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
              Upload RACMs from Excel through a cleaner bulk import flow.
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
              Add a validated `.xlsx` file, pick the right business process and financial year, and optionally configure due dates and reminders before upload.
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
              'Business process and financial year are mandatory.',
              'Process Owner values, if present, must be valid email IDs.',
              'Due date and reminder frequency must be filled together.',
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

      <Box
        sx={{
          width: '100%',
          display: 'block',
        }}
      >
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
          <Box
            sx={{
              display: 'flex',
              flexDirection: { xs: 'column', sm: 'row' },
              justifyContent: 'space-between',
              alignItems: { xs: 'flex-start', sm: 'center' },
              gap: 1.5,
              mb: 2.5,
            }}
          >
            <Box>
              <Typography sx={{ fontSize: '1.35rem', fontWeight: 900, color: theme.palette.text.primary }}>
                Upload Setup
              </Typography>
              <Typography sx={{ mt: 0.6, fontSize: '0.93rem', color: theme.palette.text.secondary }}>
                Configure the file and submission details below.
              </Typography>
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

          <form onSubmit={handleSubmit}>
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
                  gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' },
                  gap: 2,
                  mb: 2.5,
                }}
              >
                <FormControl fullWidth required disabled={loading} variant="outlined">
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
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.1, mb: 1.8 }}>
                  <ChecklistRoundedIcon sx={{ fontSize: 20, color: theme.palette.text.secondary }} />
                  <Typography sx={{ fontSize: '1rem', fontWeight: 800, color: theme.palette.text.primary }}>
                    Reminder settings
                  </Typography>
                  <Typography sx={{ fontSize: '0.86rem', color: theme.palette.text.secondary }}>
                    Optional
                  </Typography>
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
                      <MenuItem value="">None</MenuItem>
                      <MenuItem value="Daily">Daily</MenuItem>
                      <MenuItem value="Weekly">Weekly</MenuItem>
                      <MenuItem value="Monthly">Monthly</MenuItem>
                    </Select>
                  </FormControl>
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
                  disabled={loading || !file || !businessProcess || !financialYear}
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
                  {loading ? 'Uploading...' : 'Upload Excel File'}
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
      </Box>
      </Box>
  )
}

export default ExcelUpload
