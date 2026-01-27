import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTheme } from '@mui/material/styles'
import Button from '@mui/material/Button'
import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'
import IconButton from '@mui/material/IconButton'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import CircularProgress from '@mui/material/CircularProgress'
import Alert from '@mui/material/Alert'
import Grid from '@mui/material/Grid'
import Divider from '@mui/material/Divider'

function CompanyDetail() {
  const theme = useTheme()
  const navigate = useNavigate()
  const { company_identifier } = useParams()
  const [company, setCompany] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetchCompany()
  }, [company_identifier])

  const fetchCompany = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`http://localhost:3000/api/companies/${company_identifier}`, {
        method: 'GET',
        credentials: 'include',
      })

      const data = await response.json()

      if (response.ok && data.success) {
        setCompany(data.data)
      } else {
        setError(data.message || 'Failed to fetch company data')
      }
    } catch (err) {
      console.error('Error fetching company:', err)
      setError('Error fetching company data')
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A'
    const date = new Date(dateString)
    return date.toLocaleString('en-IN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Kolkata'
    })
  }

  const FieldDisplay = ({ label, value, fullWidth = false, bold = false, showBorder = true }) => (
    <Box 
      sx={{ 
        pt: showBorder ? 3.5 : 0,
        pb: showBorder ? 3.5 : 0,
        borderBottom: showBorder ? `1px solid ${theme.palette.divider}` : 'none',
        '&:last-child': {
          borderBottom: 'none',
          pb: 0,
        },
        '&:first-of-type': {
          pt: 0,
        },
      }}
    >
      <Typography
        variant="caption"
        sx={{
          fontWeight: 600,
          color: theme.palette.text.secondary,
          fontSize: '0.75rem',
          textTransform: 'uppercase',
          letterSpacing: '0.8px',
          display: 'block',
          mb: 1.5,
          textAlign: 'left',
        }}
      >
        {label}
      </Typography>
      <Typography
        variant="body1"
        sx={{
          color: theme.palette.text.primary,
          fontSize: '0.9375rem',
          fontWeight: bold ? 700 : 500,
          wordBreak: 'break-word',
          lineHeight: 1.7,
          letterSpacing: bold ? '-0.01em' : 'normal',
          textAlign: 'left',
        }}
      >
        {value || 'N/A'}
      </Typography>
    </Box>
  )

  if (loading) {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '400px',
        }}
      >
        <CircularProgress size={32} />
      </Box>
    )
  }

  if (error) {
    return (
      <Box
        sx={{
          maxWidth: '1400px',
          mx: 'auto',
          px: { xs: 2, sm: 3, md: 4 },
          py: { xs: 3, sm: 4, md: 5 },
        }}
      >
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate('/siteadmin/dashboard')}
          variant="outlined"
        >
          Back to Dashboard
        </Button>
      </Box>
    )
  }

  if (!company) {
    return (
      <Box
        sx={{
          maxWidth: '1400px',
          mx: 'auto',
          px: { xs: 2, sm: 3, md: 4 },
          py: { xs: 3, sm: 4, md: 5 },
        }}
      >
        <Alert severity="info" sx={{ mb: 3 }}>
          Company not found
        </Alert>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate('/siteadmin/dashboard')}
          variant="outlined"
        >
          Back to Dashboard
        </Button>
      </Box>
    )
  }

  return (
    <Box
      sx={{
        minHeight: '100vh',
        backgroundColor: theme.palette.background.default,
      }}
    >
      <Box
        sx={{
          maxWidth: '1400px',
          mx: 'auto',
          px: { xs: 2, sm: 3, md: 4 },
          py: { xs: 3, sm: 4, md: 5 },
        }}
      >
        {/* Header */}
        <Box 
          sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            mb: 5,
            pb: 3,
            borderBottom: `2px solid ${theme.palette.divider}`,
          }}
        >
          <IconButton
            onClick={() => navigate('/siteadmin/dashboard')}
            sx={{
              mr: 2.5,
              color: theme.palette.text.primary,
              backgroundColor: theme.palette.mode === 'dark'
                ? 'rgba(255, 255, 255, 0.05)'
                : 'rgba(0, 0, 0, 0.02)',
              '&:hover': {
                backgroundColor: theme.palette.mode === 'dark'
                  ? 'rgba(255, 255, 255, 0.1)'
                  : 'rgba(0, 0, 0, 0.06)',
              },
              transition: 'all 0.2s ease-in-out',
            }}
            aria-label="back to dashboard"
          >
            <ArrowBackIcon />
          </IconButton>
          <Typography
            variant="h4"
            component="h1"
            sx={{
              fontWeight: 700,
              color: theme.palette.text.primary,
              letterSpacing: '-0.02em',
              fontSize: { xs: '1.5rem', sm: '1.75rem', md: '2rem' },
            }}
          >
            Company Details
          </Typography>
        </Box>

        {/* Company Information Card */}
        <Card
          sx={{
            borderRadius: 3,
            boxShadow: theme.palette.mode === 'dark'
              ? '0 4px 20px rgba(0, 0, 0, 0.3)'
              : '0 2px 12px rgba(0, 0, 0, 0.08)',
            border: `1px solid ${theme.palette.divider}`,
            backgroundColor: theme.palette.background.paper,
            overflow: 'hidden',
          }}
        >
          <CardContent sx={{ p: { xs: 3, sm: 4, md: 5 } }}>
            <Box sx={{ maxWidth: '700px', mx: 'auto', width: 'fit-content' }}>
              <FieldDisplay 
                label="Company Name" 
                value={company.company_name} 
                bold={true}
              />
              <FieldDisplay label="Company Identifier" value={company.company_identifier} />
              <FieldDisplay label="Registered Email" value={company.registered_email} />
              <FieldDisplay label="Registered Address" value={company.registered_address} fullWidth />
              <FieldDisplay label="Unique Identification Number" value={company.unique_identification_number} />
              <FieldDisplay label="GST" value={company.gst} />
              <FieldDisplay label="PAN" value={company.pan} />
              <FieldDisplay label="Number of Corporate Offices" value={company.number_of_corporate_offices} />
              <FieldDisplay label="Number of Factory Units" value={company.number_of_factory_units} />
              <FieldDisplay label="Registration Date" value={formatDate(company.created_at)} showBorder={false} />
            </Box>
          </CardContent>
        </Card>
      </Box>
    </Box>
  )
}

export default CompanyDetail

