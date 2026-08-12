import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { alpha, useTheme } from '@mui/material/styles'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Checkbox from '@mui/material/Checkbox'
import CircularProgress from '@mui/material/CircularProgress'
import FormControl from '@mui/material/FormControl'
import FormControlLabel from '@mui/material/FormControlLabel'
import FormGroup from '@mui/material/FormGroup'
import FormLabel from '@mui/material/FormLabel'
import InputLabel from '@mui/material/InputLabel'
import MenuItem from '@mui/material/MenuItem'
import Paper from '@mui/material/Paper'
import Select from '@mui/material/Select'
import Typography from '@mui/material/Typography'
import CloudDownloadIcon from '@mui/icons-material/CloudDownload'
import CloudUploadIcon from '@mui/icons-material/CloudUpload'
import DeleteIcon from '@mui/icons-material/Delete'
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import { toast } from 'react-hot-toast'
import * as XLSX from 'xlsx'
import { useNavigate } from 'react-router-dom'
import ManagementPageHeader from '../../components/ManagementPageHeader'
import { apiUrl } from '../../config/api'
import { useSyncGlobalLoading } from '../../contexts/GlobalLoadingContext'
import { useBusinessProcesses } from '../../hooks/useBusinessProcesses'
import { getManagementTableBorderColor } from '../../uiConstants'

async function readWorkbookSheetNames(file) {
  const buffer = await file.arrayBuffer()
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: false })
  return Array.isArray(workbook.SheetNames) ? workbook.SheetNames : []
}

function ControlsLibraryUpload() {
  const theme = useTheme()
  const navigate = useNavigate()
  const fileInputRef = useRef(null)
  const { businessProcessOptions, loading: businessProcessesLoading } = useBusinessProcesses()
  const [businessProcess, setBusinessProcess] = useState('')
  const [file, setFile] = useState(null)
  const [sheetNames, setSheetNames] = useState([])
  const [selectedSheets, setSelectedSheets] = useState([])
  const [sheetNamesLoading, setSheetNamesLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [summaryLoading, setSummaryLoading] = useState(false)
  const [summaryRows, setSummaryRows] = useState([])
  const [isDragging, setIsDragging] = useState(false)

  useSyncGlobalLoading(businessProcessesLoading || uploading || summaryLoading || sheetNamesLoading)

  const borderColor = getManagementTableBorderColor(theme)
  const accentColor = theme.palette.primary.main
  const accentSoft = alpha(accentColor, theme.palette.mode === 'dark' ? 0.18 : 0.12)
  const accentBorder = alpha(accentColor, theme.palette.mode === 'dark' ? 0.22 : 0.14)

  const requiresSheetSelection = sheetNames.length > 1
  const hasValidSheetSelection = !requiresSheetSelection || selectedSheets.length > 0

  const fetchSummary = useCallback(async () => {
    setSummaryLoading(true)
    try {
      const response = await fetch(apiUrl('/api/siteadmin/controls-library/summary'), {
        credentials: 'include',
      })
      const data = await response.json()
      if (response.ok && data.success) {
        setSummaryRows(Array.isArray(data.data) ? data.data : [])
      } else {
        setSummaryRows([])
      }
    } catch (error) {
      console.error('Controls library summary error:', error)
      setSummaryRows([])
    } finally {
      setSummaryLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchSummary()
  }, [fetchSummary])

  const handleDownloadTemplate = async () => {
    try {
      const response = await fetch(apiUrl('/api/siteadmin/controls-library/template'), {
        credentials: 'include',
      })
      if (!response.ok) {
        toast.error('Failed to download template')
        return
      }
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = 'controls_library_template.xlsx'
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Template download error:', error)
      toast.error('Failed to download template')
    }
  }

  const resetFile = () => {
    setFile(null)
    setSheetNames([])
    setSelectedSheets([])
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const loadSheetNames = async (selectedFile) => {
    setSheetNamesLoading(true)
    try {
      const names = await readWorkbookSheetNames(selectedFile)
      setSheetNames(names)
      setSelectedSheets(names.length === 1 ? [...names] : [])
    } catch (error) {
      console.error('Failed to read workbook sheets:', error)
      setSheetNames([])
      setSelectedSheets([])
      toast.error('Could not read worksheets from this Excel file')
    } finally {
      setSheetNamesLoading(false)
    }
  }

  const handleFileSelection = async (selectedFile) => {
    if (!selectedFile) return
    const name = String(selectedFile.name || '').toLowerCase()
    if (!name.endsWith('.xlsx') && !name.endsWith('.xls')) {
      toast.error('Please upload an Excel file (.xlsx or .xls)')
      return
    }
    setFile(selectedFile)
    await loadSheetNames(selectedFile)
  }

  const handleSheetToggle = (sheetName) => {
    setSelectedSheets((current) => {
      if (current.includes(sheetName)) {
        return current.filter((name) => name !== sheetName)
      }
      return [...current, sheetName]
    })
  }

  const handleSelectAllSheets = () => {
    setSelectedSheets([...sheetNames])
  }

  const handleClearSheetSelection = () => {
    setSelectedSheets([])
  }

  const handleUpload = async () => {
    const bp = String(businessProcess || '').trim()
    if (!bp) {
      toast.error('Please select a business process')
      return
    }
    if (!file) {
      toast.error('Please choose an Excel file to upload')
      return
    }
    if (requiresSheetSelection && selectedSheets.length === 0) {
      toast.error('Select at least one worksheet to import')
      return
    }

    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('business_process', bp)
      formData.append('file', file)
      if (sheetNames.length > 0) {
        const sheetsToSend = requiresSheetSelection ? selectedSheets : sheetNames
        formData.append('sheet_names', JSON.stringify(sheetsToSend))
      }

      const response = await fetch(apiUrl('/api/siteadmin/controls-library/upload'), {
        method: 'POST',
        credentials: 'include',
        body: formData,
      })
      const data = await response.json()

      if (response.ok && data.success) {
        toast.success(data.message || 'Controls library uploaded')
        resetFile()
        fetchSummary()
        navigate('/siteadmin/controls-library')
      } else {
        toast.error(data.message || 'Failed to upload controls library')
      }
    } catch (error) {
      console.error('Controls library upload error:', error)
      toast.error('Network error. Please try again.')
    } finally {
      setUploading(false)
    }
  }

  const sortedSummary = useMemo(
    () => [...summaryRows].sort((a, b) => String(a.business_process).localeCompare(String(b.business_process))),
    [summaryRows]
  )

  return (
    <Box sx={{ width: '100%' }}>
      <ManagementPageHeader
        title="Upload Controls Library"
        subtitle="Upload normalized controls for each business process. Existing controls for the selected business process are replaced."
        actions={
          <Button
            variant="outlined"
            startIcon={<ArrowBackIcon />}
            onClick={() => navigate('/siteadmin/controls-library')}
            sx={{ textTransform: 'none', fontWeight: 600 }}
          >
            Back to library
          </Button>
        }
      />

      <Paper
        elevation={0}
        sx={{
          p: 3,
          mb: 3,
          border: '1px solid',
          borderColor,
          borderRadius: 2,
        }}
      >
        <Box
          sx={{
            display: 'grid',
            gap: 2.5,
            gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
          }}
        >
          <FormControl fullWidth required>
            <InputLabel id="controls-library-bp-label">Business Process</InputLabel>
            <Select
              labelId="controls-library-bp-label"
              label="Business Process"
              value={businessProcess}
              onChange={(event) => setBusinessProcess(event.target.value)}
            >
              {businessProcessOptions.map((option) => (
                <MenuItem key={option} value={option}>
                  {option}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
            <Button
              variant="outlined"
              startIcon={<CloudDownloadIcon />}
              onClick={handleDownloadTemplate}
              sx={{ textTransform: 'none', fontWeight: 600 }}
            >
              Download template
            </Button>
          </Box>
        </Box>

        {!file ? (
          <Box
            sx={{
              mt: 3,
              p: 3,
              borderRadius: 2,
              border: '1px dashed',
              borderColor: isDragging ? accentColor : accentBorder,
              backgroundColor: isDragging ? accentSoft : 'transparent',
              textAlign: 'center',
              cursor: 'pointer',
            }}
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(event) => {
              event.preventDefault()
              setIsDragging(true)
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(event) => {
              event.preventDefault()
              setIsDragging(false)
              const droppedFile = event.dataTransfer?.files?.[0]
              handleFileSelection(droppedFile)
            }}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              hidden
              onChange={(event) => handleFileSelection(event.target.files?.[0])}
            />
            <CloudUploadIcon sx={{ fontSize: 40, color: accentColor, mb: 1 }} />
            <Typography sx={{ fontWeight: 700, mb: 0.5 }}>
              Drop Excel file here or click to browse
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Upload replaces existing controls for the selected business process.
            </Typography>
          </Box>
        ) : (
          <Box
            sx={{
              mt: 2,
              p: 2,
              borderRadius: 2,
              border: '1px solid',
              borderColor,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 2,
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0 }}>
              <InsertDriveFileIcon color="primary" />
              <Box sx={{ minWidth: 0 }}>
                <Typography sx={{ fontWeight: 700 }} noWrap>
                  {file.name}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {(file.size / 1024).toFixed(1)} KB
                </Typography>
              </Box>
            </Box>
            <Button
              color="error"
              startIcon={<DeleteIcon />}
              onClick={resetFile}
              sx={{ textTransform: 'none' }}
            >
              Remove
            </Button>
          </Box>
        )}

        {file && sheetNamesLoading ? (
          <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <CircularProgress size={20} />
            <Typography variant="body2" color="text.secondary">
              Reading worksheets...
            </Typography>
          </Box>
        ) : null}

        {file && !sheetNamesLoading && requiresSheetSelection ? (
          <Box
            sx={{
              mt: 2,
              p: 2,
              borderRadius: 2,
              border: '1px solid',
              borderColor: accentBorder,
              backgroundColor: accentSoft,
            }}
          >
            <FormControl component="fieldset" variant="standard" fullWidth>
              <FormLabel
                component="legend"
                sx={{ fontWeight: 700, color: 'text.primary', mb: 1 }}
              >
                Select worksheets to import
              </FormLabel>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                This file has multiple sheets. Choose at least one sheet before uploading.
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, mb: 1.5, flexWrap: 'wrap' }}>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={handleSelectAllSheets}
                  sx={{ textTransform: 'none' }}
                >
                  Select all
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={handleClearSheetSelection}
                  sx={{ textTransform: 'none' }}
                >
                  Clear selection
                </Button>
              </Box>
              <FormGroup>
                {sheetNames.map((sheetName) => (
                  <FormControlLabel
                    key={sheetName}
                    control={
                      <Checkbox
                        checked={selectedSheets.includes(sheetName)}
                        onChange={() => handleSheetToggle(sheetName)}
                      />
                    }
                    label={sheetName}
                  />
                ))}
              </FormGroup>
              {selectedSheets.length === 0 ? (
                <Typography variant="caption" color="error" sx={{ mt: 1, display: 'block' }}>
                  Select at least one worksheet to continue.
                </Typography>
              ) : (
                <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                  {selectedSheets.length} of {sheetNames.length} worksheet(s) selected
                </Typography>
              )}
            </FormControl>
          </Box>
        ) : null}

        {file && !sheetNamesLoading && sheetNames.length === 1 ? (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
            Worksheet: <strong>{sheetNames[0]}</strong>
          </Typography>
        ) : null}

        <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
          <Button
            variant="contained"
            startIcon={uploading ? <CircularProgress size={18} color="inherit" /> : <CloudUploadIcon />}
            disabled={
              uploading
              || !file
              || !businessProcess
              || sheetNamesLoading
              || !hasValidSheetSelection
            }
            onClick={handleUpload}
            sx={{ textTransform: 'none', fontWeight: 700, px: 3 }}
          >
            Upload controls
          </Button>
        </Box>
      </Paper>

      <Paper
        elevation={0}
        sx={{
          p: 3,
          border: '1px solid',
          borderColor,
          borderRadius: 2,
        }}
      >
        <Typography sx={{ fontWeight: 700, mb: 2 }}>
          Uploaded library summary
        </Typography>
        {summaryLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
            <CircularProgress size={28} />
          </Box>
        ) : sortedSummary.length === 0 ? (
          <Typography color="text.secondary">No controls uploaded yet.</Typography>
        ) : (
          <Box sx={{ display: 'grid', gap: 0.75 }}>
            {sortedSummary.map((row) => (
              <Typography key={row.business_process} color="text.secondary">
                {row.row_count} controls are inserted for {row.business_process}.
              </Typography>
            ))}
          </Box>
        )}
      </Paper>
    </Box>
  )
}

export default ControlsLibraryUpload
