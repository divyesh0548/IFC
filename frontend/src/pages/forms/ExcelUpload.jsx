import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTheme } from '@mui/material/styles'
import Navbar from '../../components/Siteadmin_navbar'
import Button from '@mui/material/Button'
import Alert from '@mui/material/Alert'

function ExcelUpload() {
  const theme = useTheme()
  const navigate = useNavigate()
  const [file, setFile] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [preview, setPreview] = useState(null)

  const handleLogout = async () => {
    try {
      const response = await fetch('http://localhost:3000/api/auth/user/logout', {
        method: 'POST',
        credentials: 'include',
      })

      const data = await response.json()

      if (response.ok && data.success) {
        navigate('/user/login')
      } else {
        navigate('/user/login')
      }
    } catch (error) {
      console.error('Logout error:', error)
      navigate('/user/login')
    }
  }

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0]
    
    if (!selectedFile) {
      setFile(null)
      setPreview(null)
      return
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
      return
    }

    // Validate file size (10MB limit)
    if (selectedFile.size > 10 * 1024 * 1024) {
      setError('File size exceeds 10MB limit.')
      setFile(null)
      setPreview(null)
      return
    }

    setFile(selectedFile)
    setError('')
    setSuccess('')
    setPreview({
      name: selectedFile.name,
      size: (selectedFile.size / 1024).toFixed(2) + ' KB',
      type: selectedFile.type
    })
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

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* File Input */}
              <div>
                <label htmlFor="excelFile" className="block text-sm font-medium text-secondary mb-2">
                  Select Excel File (.xlsx, .xls, or .csv)
                </label>
                <input
                  type="file"
                  id="excelFile"
                  name="excelFile"
                  accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
                  onChange={handleFileChange}
                  disabled={loading}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-secondary focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
                  required
                />
                <p className="mt-2 text-sm text-gray-500">
                  Maximum file size: 10MB. Supported formats: .xlsx, .xls, .csv
                </p>
              </div>

              {/* File Preview */}
              {preview && (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <h3 className="text-sm font-medium text-secondary mb-2">Selected File:</h3>
                  <ul className="text-sm text-gray-600 space-y-1">
                    <li><strong>Name:</strong> {preview.name}</li>
                    <li><strong>Size:</strong> {preview.size}</li>
                    <li><strong>Type:</strong> {preview.type}</li>
                  </ul>
                </div>
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

