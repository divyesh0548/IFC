import React, { useState, useRef } from 'react'
import { useTheme } from '@mui/material/styles'
import { useNavigate } from 'react-router-dom'
import Button from '@mui/material/Button'
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import IconButton from '@mui/material/IconButton'
import CloudUploadIcon from '@mui/icons-material/CloudUpload'
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile'
import DeleteIcon from '@mui/icons-material/Delete'
import { toast } from 'react-hot-toast'

function ExcelUpload() {
  const theme = useTheme()
  const navigate = useNavigate()
  const fileInputRef = useRef(null)
  const [file, setFile] = useState(null)
  const [loading, setLoading] = useState(false)
  const [preview, setPreview] = useState(null)
  const [isDragging, setIsDragging] = useState(false)

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

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!file) {
      toast.error('Please select a file to upload')
      return
    }

    setLoading(true)

    try {
      const formData = new FormData()
      formData.append('excelFile', file)

      const response = await fetch('http://localhost:3000/api/control-forms/bulk-upload', {
        method: 'POST',
        credentials: 'include',
        body: formData
      })

      const data = await response.json()

      if (response.ok && data.success) {
        toast.success(`Successfully imported ${data.count} control form(s)!`)
        setFile(null)
        setPreview(null)
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
              Upload Control Forms from Excel
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
                  <li>Each subsequent row represents one control form entry</li>
                  <li>Empty cells will be stored as null values</li>
                  <li>Supported column names include: Description of Control, Process, Sub-process, Risk Description, etc.</li>
                </Box>
              </Box>

              {/* Submit Button */}
              <Button
                type="submit"
                disabled={loading || !file}
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
            </form>
          </Paper>
        </Box>
      </Box>
  )
}

export default ExcelUpload

