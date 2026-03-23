import React, { useState, useRef } from 'react'
import { useTheme } from '@mui/material/styles'
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
import Divider from '@mui/material/Divider'
import CloudUploadIcon from '@mui/icons-material/CloudUpload'
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile'
import DeleteIcon from '@mui/icons-material/Delete'
import { toast } from 'react-hot-toast'
import * as XLSX from 'xlsx'

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

    // Validate file type
    const validTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      'application/vnd.ms-excel', // .xls
      'text/csv' // .csv
    ]

    if (!validTypes.includes(selectedFile.type)) {
      toast.error('Invalid file type. Please upload an Excel file (.xlsx, .xls) or CSV file.')
      setFile(null)
      setPreview(null)
      return false
    }

    // Validate file size (10MB limit)
    if (selectedFile.size > 10 * 1024 * 1024) {
      toast.error('File size exceeds 10MB limit.')
      setFile(null)
      setPreview(null)
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

    // Strategy A: Read as array-of-arrays (header row + data rows)
    try {
      const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: false, defval: '' })
      const headerRow = Array.isArray(rows) && rows.length > 0 ? rows[0] : []

      if (Array.isArray(headerRow) && headerRow.length > 0) {
        const processOwnerIndex = headerRow.findIndex(
          (header) => normalizeHeader(header) === 'process owner'
        )

        if (processOwnerIndex !== -1) {
          const dataRows = Array.isArray(rows) && rows.length > 1 ? rows.slice(1) : []
          dataRows.forEach((row) => {
            if (!Array.isArray(row)) return
            const cellValue = row[processOwnerIndex]
            if (cellValue !== undefined && cellValue !== null && String(cellValue).trim() !== '') {
              nonEmptyValues.push(String(cellValue).trim())
            }
          })
        }
      }
    } catch (err) {
      // Ignore and fall back to object-based parsing
      console.warn('Process Owner validation (header-based) failed:', err)
    }

    // Strategy B: Read as array-of-objects (most reliable for `"Process Owner": "abcd12345"` cases)
    let hasColumn = false
    try {
      const objectRows = XLSX.utils.sheet_to_json(worksheet, { raw: false, defval: '' })
      if (Array.isArray(objectRows) && objectRows.length > 0) {
        // Find the actual column key that maps to "process owner"
        const sampleRow = objectRows[0] || {}
        const processOwnerKey = Object.keys(sampleRow).find(
          (key) => normalizeHeader(key) === 'process owner'
        )

        if (processOwnerKey) {
          hasColumn = true
          objectRows.forEach((row) => {
            if (!row || typeof row !== 'object') return
            const val = row[processOwnerKey]
            if (val !== undefined && val !== null && String(val).trim() !== '') {
              nonEmptyValues.push(String(val).trim())
            }
          })
        }
      }
    } catch (err) {
      console.warn('Process Owner validation (object-based) failed:', err)
    }

    // Determine hasColumn: either object-based found it OR header-based found values OR header contains it
    // If we collected any values, we definitely have the column.
    if (nonEmptyValues.length > 0) {
      hasColumn = true
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
          toast.error('Email of Process Owner is not valid. Please correct it before uploading.')
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
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center', 
        justifyContent: 'center', 
        minHeight: 'calc(100vh - 4rem)', 
        px: 2, 
        py: 4 
      }}
    >
        <Box sx={{ width: '100%', maxWidth: '800px' }}>
          <Paper 
            elevation={3}
            sx={{
              p: 4,
              backgroundColor: theme.palette.background.paper,
              borderRadius: 2,
            }}
          >
            <Typography
              variant="h4"
              component="h1"
              sx={{
                fontWeight: 700,
                color: theme.palette.secondary.main,
                mb: 3,
                textAlign: 'center',
              }}
            >
              Upload RACM from Excel
            </Typography>

            <form onSubmit={handleSubmit}>
              {/* Hidden File Input */}
              <input
                type="file"
                ref={fileInputRef}
                id="excelFile"
                name="excelFile"
                accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
                onChange={handleFileChange}
                disabled={loading}
                style={{ display: 'none' }}
                required
              />

              {/* MUI File Upload Area */}
              {!preview ? (
                <Paper
                  elevation={isDragging ? 4 : 1}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={handleFileSelect}
                  sx={{
                    p: 4,
                    mb: 3,
                    border: 1,
                    borderColor: isDragging ? theme.palette.secondary.main : 'divider',
                    borderStyle: 'dashed',
                    borderRadius: 1,
                    textAlign: 'center',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    backgroundColor: isDragging ? 'action.hover' : 'background.paper',
                    transition: 'all 0.2s ease',
                    '&:hover': {
                      backgroundColor: loading ? 'background.paper' : 'action.hover',
                      borderColor: loading ? 'divider' : theme.palette.secondary.main,
                    },
                  }}
                >
                  <CloudUploadIcon
                    sx={{
                      fontSize: 48,
                      color: theme.palette.secondary.main,
                      mb: 2,
                    }}
                  />
                  <Typography variant="body1" color="textSecondary">
                    Click to upload or drag and drop
                  </Typography>
                </Paper>
              ) : (
                <Paper
                  elevation={1}
                  sx={{
                    p: 2.5,
                    mb: 3,
                    border: 1,
                    borderColor: 'divider',
                    borderRadius: 1,
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flex: 1 }}>
                      <InsertDriveFileIcon
                        sx={{
                          fontSize: 32,
                          color: theme.palette.secondary.main,
                        }}
                      />
                      <Typography variant="body1" fontWeight="medium">
                        {preview.name}
                      </Typography>
                    </Box>
                    <IconButton
                      onClick={handleRemoveFile}
                      disabled={loading}
                      size="small"
                      sx={{ ml: 2 }}
                    >
                      <DeleteIcon />
                    </IconButton>
                  </Box>
                </Paper>
              )}

              {/* Business Process Dropdown */}
              <FormControl 
                fullWidth 
                required 
                sx={{ mb: 3 }}
                disabled={loading}
              >
                <InputLabel id="business-process-label">Business Process</InputLabel>
                <Select
                  labelId="business-process-label"
                  id="business-process"
                  value={businessProcess}
                  label="Business Process"
                  onChange={(e) => setBusinessProcess(e.target.value)}
                  variant="filled"
                >
                  <MenuItem value="Purchase to Pay">Purchase to Pay</MenuItem>
                  <MenuItem value="Order to Cash">Order to Cash</MenuItem>
                  <MenuItem value="Hire to Retire">Hire to Retire</MenuItem>
                  <MenuItem value="Capital Expenditure">Capital Expenditure</MenuItem>
                  <MenuItem value="Treasury">Treasury</MenuItem>
                  <MenuItem value="Financial Statement Closure Process">Financial Statement Closure Process</MenuItem>
                  <MenuItem value="Information Technology General Controls">Information Technology General Controls</MenuItem>
                  <MenuItem value="Entity Level Controls">Entity Level Controls</MenuItem>
                </Select>
              </FormControl>

              {/* Financial Year Dropdown */}
              <FormControl 
                fullWidth 
                required 
                sx={{ mb: 3 }}
                disabled={loading}
              >
                <InputLabel id="financial-year-label">Financial Year</InputLabel>
                <Select
                  labelId="financial-year-label"
                  id="financial-year"
                  value={financialYear}
                  label="Financial Year"
                  onChange={(e) => setFinancialYear(e.target.value)}
                  variant="filled"
                >
                  <MenuItem value="2024-25">2024-25</MenuItem>
                  <MenuItem value="2025-26">2025-26</MenuItem>
                </Select>
              </FormControl>

              {/* Reminder Settings (Optional) */}
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' },
                  gap: 2,
                  mb: 3,
                  alignItems: 'center',
                }}
              >
                <TextField
                  type="date"
                  label="Due Date (Optional)"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  fullWidth
                  size="small"
                  InputLabelProps={{ shrink: true }}
                  inputProps={{ min: getTomorrowDateString() }}
                  disabled={loading}
                />

                <FormControl fullWidth size="small" disabled={loading}>
                  <InputLabel id="reminder-frequency-label">Reminder Frequency (Optional)</InputLabel>
                  <Select
                    labelId="reminder-frequency-label"
                    value={reminderFrequency}
                    label="Reminder Frequency (Optional)"
                    onChange={(e) => setReminderFrequency(e.target.value)}
                    variant="filled"
                  >
                    <MenuItem value="">None</MenuItem>
                    <MenuItem value="Daily">Daily</MenuItem>
                    <MenuItem value="Weekly">Weekly</MenuItem>
                    <MenuItem value="Monthly">Monthly</MenuItem>
                  </Select>
                </FormControl>
              </Box>

              {/* Instructions */}
              <Box
                sx={{
                  p: 2,
                  mb: 2,
                  borderRadius: 1,
                  backgroundColor: theme.palette.mode === 'dark' 
                    ? 'rgba(3, 105, 161, 0.15)' 
                    : 'rgba(3, 105, 161, 0.08)',
                  border: `1px solid ${theme.palette.mode === 'dark' 
                    ? 'rgba(3, 105, 161, 0.3)' 
                    : 'rgba(3, 105, 161, 0.2)'}`,
                }}
              >
                <Typography
                  variant="subtitle2"
                  sx={{
                    fontWeight: 600,
                    mb: 1,
                    color: theme.palette.mode === 'dark' 
                      ? theme.palette.secondary.light 
                      : theme.palette.secondary.dark,
                  }}
                >
                  Excel File Format Instructions:
                </Typography>
                <Box
                  component="ul"
                  sx={{
                    m: 0,
                    pl: 2.5,
                    color: theme.palette.mode === 'dark' 
                      ? theme.palette.text.secondary 
                      : theme.palette.secondary.dark,
                    '& li': {
                      mb: 0.5,
                      fontSize: '0.875rem',
                    },
                  }}
                >
                  <li>First row should contain column headers</li>
                  <li>Column names should match the form fields (case-insensitive)</li>
                  <li>Each subsequent row represents one RACM entry</li>
                  <li>Empty cells will be stored as null values</li>
                  <li>Supported column names include: Description of Control, Process, Sub-process, Risk Description, etc.</li>
                </Box>
              </Box>

              {/* Submit Button */}
              <Button
                type="submit"
                disabled={loading || !file || !businessProcess || !financialYear}
                variant="contained"
                color="secondary"
                fullWidth
                sx={{
                  py: 1.5,
                  fontSize: theme.typography.customSizes.medium,
                  fontWeight: 600,
                  textTransform: 'none',
                  mb: 2,
                }}
              >
                {loading ? 'Uploading...' : 'Upload Excel File'}
              </Button>

              {/* Back Button */}
              <Button
                type="button"
                onClick={() => navigate('/company_co/dashboard')}
                variant="outlined"
                fullWidth
                sx={{
                  py: 1.5,
                  fontSize: theme.typography.customSizes.medium,
                  fontWeight: 600,
                  textTransform: 'none',
                  borderColor: theme.palette.mode === 'dark' 
                    ? 'rgba(255, 255, 255, 0.23)' 
                    : '#6b7280',
                  color: theme.palette.text.primary,
                  '&:hover': {
                    borderColor: theme.palette.mode === 'dark' 
                      ? 'rgba(255, 255, 255, 0.3)' 
                      : '#4b5563',
                    backgroundColor: theme.palette.mode === 'dark' 
                      ? 'rgba(255, 255, 255, 0.08)' 
                      : 'rgba(107, 114, 128, 0.08)',
                  },
                }}
              >
                Back to Dashboard
              </Button>

              {/* Other Actions (separate from upload) */}
              <Divider sx={{ my: 3 }} />
              <Typography
                variant="subtitle2"
                sx={{
                  fontWeight: 700,
                  mb: 1.5,
                  color: theme.palette.text.secondary,
                }}
              >
                Other actions
              </Typography>
              <Button
                type="button"
                onClick={() => navigate('/company_co/create-form')}
                variant="outlined"
                color="secondary"
                fullWidth
                sx={{
                  py: 1.5,
                  fontSize: theme.typography.customSizes.medium,
                  fontWeight: 700,
                  textTransform: 'none',
                  borderWidth: 2,
                  '&:hover': { borderWidth: 2 },
                }}
              >
                Create RACM Manually
              </Button>
            </form>
          </Paper>
        </Box>
      </Box>
  )
}

export default ExcelUpload

