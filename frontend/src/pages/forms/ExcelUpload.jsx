import React, { useState, useRef } from 'react'
import { useTheme } from '@mui/material/styles'
import { useNavigate } from 'react-router-dom'
import Navbar from '../../components/Global_navbar'
import { useUserLogout } from '../../hooks/useUserLogout'
import Button from '@mui/material/Button'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import IconButton from '@mui/material/IconButton'
import CloudUploadIcon from '@mui/icons-material/CloudUpload'
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile'
import DeleteIcon from '@mui/icons-material/Delete'

function ExcelUpload() {
  const theme = useTheme()
  const navigate = useNavigate()
  const fileInputRef = useRef(null)
  const [file, setFile] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [preview, setPreview] = useState(null)
  const [isDragging, setIsDragging] = useState(false)

  const handleLogout = useUserLogout()

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
      setError('Invalid file type. Please upload an Excel file (.xlsx, .xls) or CSV file.')
      setFile(null)
      setPreview(null)
      return false
    }

    // Validate file size (10MB limit)
    if (selectedFile.size > 10 * 1024 * 1024) {
      setError('File size exceeds 10MB limit.')
      setFile(null)
      setPreview(null)
      return false
    }

    setFile(selectedFile)
    setError('')
    setSuccess('')
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
    setError('')
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (!file) {
      setError('Please select a file to upload')
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
        setSuccess(`Successfully imported ${data.count} control form(s)!`)
        setFile(null)
        setPreview(null)
        // Reset file input
        e.target.reset()
        
        // Clear success message after 5 seconds
        setTimeout(() => {
          setSuccess('')
        }, 5000)
      } else {
        setError(data.message || 'Failed to upload file')
      }
    } catch (err) {
      console.error('Upload error:', err)
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-primary">
      <Navbar onLogout={handleLogout} header="Upload Control Forms from Excel" />

      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-4rem)] px-4 py-8">
        <div className="w-full max-w-2xl">
          <div className="bg-white rounded-lg shadow-lg p-8">
            <h1 className="text-3xl font-bold text-secondary mb-6 text-center">
              Upload Control Forms from Excel
            </h1>

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

              {/* Error Message */}
              {error && (
                <Alert severity="error" sx={{ mb: 2 }}>
                  {error}
                </Alert>
              )}

              {/* Success Message */}
              {success && (
                <Alert severity="success" sx={{ mb: 2 }}>
                  {success}
                </Alert>
              )}

              {/* Instructions */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-blue-900 mb-2">Excel File Format Instructions:</h3>
                <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
                  <li>First row should contain column headers</li>
                  <li>Column names should match the form fields (case-insensitive)</li>
                  <li>Each subsequent row represents one control form entry</li>
                  <li>Empty cells will be stored as null values</li>
                  <li>Supported column names include: Description of Control, Process, Sub-process, Risk Description, etc.</li>
                </ul>
              </div>

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
                variant="contained"
                fullWidth
                sx={{
                  py: 1.5,
                  fontSize: theme.typography.customSizes.medium,
                  fontWeight: 600,
                  textTransform: 'none',
                  backgroundColor: '#6b7280',
                  color: '#ffffff',
                  '&:hover': {
                    backgroundColor: '#4b5563',
                  },
                }}
              >
                Back to Dashboard
              </Button>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ExcelUpload

