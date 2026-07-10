import React, { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTheme } from '@mui/material/styles'
import Button from '@mui/material/Button'
import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'
import Grid from '@mui/material/Grid'
import CircularProgress from '@mui/material/CircularProgress'
import Alert from '@mui/material/Alert'
import { MAIN_CONTENT_MAX_WIDTH } from '../../uiConstants'
import { useSyncGlobalLoading } from '../../contexts/GlobalLoadingContext'
import { apiUrl } from '../../config/api'
import { parseDateValue } from '../../lib/dateTime'

function Company_Management() {
  const theme = useTheme()
  const navigate = useNavigate()
  const [companies, setCompanies] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  useSyncGlobalLoading(loading)

  useEffect(() => {
    fetchCompanies()
  }, [])

  const fetchCompanies = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(apiUrl('/api/siteadmin/companies'), {
        method: 'GET',
        credentials: 'include',
      })

      const data = await response.json()

      if (response.ok && data.success) {
        setCompanies(data.data || [])
      } else {
        setError(data.message || 'Failed to fetch companies')
      }
    } catch (err) {
      console.error('Error fetching companies:', err)
      setError('Error fetching companies')
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A'
    const timestamp = parseDateValue(dateString)?.getTime()
    if (Number.isNaN(timestamp)) return 'N/A'

    return new Date(timestamp).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }

  return (
    <Box
      sx={{
        minHeight: '100vh',
        backgroundColor: theme.palette.background.default,
      }}
    >
        {/* Dashboard Content */}
      <Box
        sx={{
          maxWidth: MAIN_CONTENT_MAX_WIDTH,
          mx: 'auto',
          width: '100%',
          px: 0,
          py: { xs: 3, sm: 4, md: 5 },
        }}
      >
        {/* Header Section */}
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            mb: 4,
            pb: 3,
            borderBottom: '1px solid',
            borderColor: theme.palette.divider,
            flexDirection: { xs: 'column', sm: 'row' },
            gap: 3,
          }}
        >
          <Box sx={{ flex: 1 }}>
            <Typography
              variant="h5"
              component="h1"
              sx={{
                fontWeight: 600,
                color: theme.palette.text.primary,
                mb: 0.75,
                fontSize: { xs: '1.375rem', sm: '1.5rem' },
                letterSpacing: '-0.02em',
              }}
            >
              Company Management
            </Typography>
            <Typography
              variant="body2"
              sx={{
                color: theme.palette.text.secondary,
                fontSize: '0.875rem',
                fontWeight: 400,
              }}
            >
              {loading ? 'Loading...' : `${companies.length} ${companies.length === 1 ? 'company' : 'companies'} registered`}
            </Typography>
          </Box>
          
          <Button
            component={Link}
            to="/siteadmin/create-company"
            variant="contained"
            color="secondary"
            sx={{
              px: 3.5,
              py: 1.25,
              fontSize: '0.875rem',
              fontWeight: 500,
              textTransform: 'none',
              borderRadius: '4px',
              boxShadow: 'none',
              '&:hover': {
                boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
              },
            }}
          >
            + Add New Company
          </Button>
        </Box>

        {error && (
          <Alert 
            severity="error" 
            sx={{ 
              mb: 3,
              borderRadius: '4px',
            }}
          >
            {error}
          </Alert>
        )}

        {loading ? (
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
        ) : companies.length === 0 ? (
          <Card
            sx={{
              borderRadius: '4px',
              boxShadow: theme.palette.mode === 'dark' 
                ? '0 1px 3px rgba(0,0,0,0.3)' 
                : '0 1px 3px rgba(0,0,0,0.12)',
              border: `1px solid ${theme.palette.divider}`,
              backgroundColor: theme.palette.background.paper,
            }}
          >
            <CardContent sx={{ py: 6, px: 4 }}>
              <Typography
                variant="body1"
                sx={{
                  textAlign: 'center',
                  color: theme.palette.text.secondary,
                  fontSize: '0.9375rem',
                  fontWeight: 400,
                }}
              >
                No companies registered yet. Create your first company to get started.
              </Typography>
            </CardContent>
          </Card>
        ) : (
          <Grid container spacing={2.5}>
            {companies.map((company) => (
              <Grid
                item
                xs={12}
                sm={6}
                md={4}
                lg={3}
                key={company.id}
                sx={{
                  flexBasis: {
                    xs: '100%',
                    sm: '50%',
                    md: '33.33%',
                    lg: '25%',
                  },
                  maxWidth: {
                    xs: '100%',
                    sm: '50%',
                    md: '33.33%',
                    lg: '25%',
                  },
                }}
              >
                <Card
                  onClick={() => navigate(`/siteadmin/company/${company.company_identifier}`)}
                  sx={{
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    borderRadius: '4px',
                    border: `1px solid ${theme.palette.divider}`,
                    boxShadow: theme.palette.mode === 'dark' 
                      ? '0 1px 3px rgba(0,0,0,0.3)' 
                      : '0 1px 3px rgba(0,0,0,0.12)',
                    transition: 'all 0.2s ease-in-out',
                    backgroundColor: theme.palette.background.paper,
                    cursor: 'pointer',
                    '&:hover': {
                      borderColor: theme.palette.mode === 'dark' 
                        ? 'rgba(255, 255, 255, 0.3)' 
                        : '#bdbdbd',
                      boxShadow: theme.palette.mode === 'dark' 
                        ? '0 4px 12px rgba(0,0,0,0.5)' 
                        : '0 4px 12px rgba(0,0,0,0.15)',
                      transform: 'translateY(-2px)',
                    },
                  }}
                >
                  <CardContent sx={{ flexGrow: 1, p: 3 }}>
                    {/* Company Name */}
                    <Typography
                      variant="h6"
                      component="h2"
                      sx={{
                        fontWeight: 600,
                        mb: 2.5,
                        color: theme.palette.text.primary,
                        fontSize: '1.125rem',
                        lineHeight: 1.4,
                        borderBottom: `1px solid ${theme.palette.divider}`,
                        pb: 2,
                        letterSpacing: '-0.01em',
                      }}
                    >
                      {company.company_name || 'N/A'}
                    </Typography>

                    {/* Company Details */}
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.25 }}>
                      <Box>
                        <Typography
                          variant="caption"
                          sx={{
                            fontWeight: 500,
                            color: theme.palette.text.secondary,
                            fontSize: '0.75rem',
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px',
                            display: 'block',
                            mb: 0.75,
                          }}
                        >
                          Company Identifier
                        </Typography>
                        <Typography
                          variant="body2"
                          noWrap
                          sx={{
                            color: theme.palette.text.primary,
                            fontSize: '0.875rem',
                            fontWeight: 500,
                            fontFamily: 'monospace',
                            letterSpacing: '0.5px',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {company.company_identifier || 'N/A'}
                        </Typography>
                      </Box>

                      <Box>
                        <Typography
                          variant="caption"
                          sx={{
                            fontWeight: 500,
                            color: theme.palette.text.secondary,
                            fontSize: '0.75rem',
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px',
                            display: 'block',
                            mb: 0.75,
                          }}
                        >
                          Registered Email
                        </Typography>
                        <Typography
                          variant="body2"
                          noWrap
                          sx={{
                            color: theme.palette.text.primary,
                            fontSize: '0.875rem',
                            lineHeight: 1.5,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {company.registered_email || 'N/A'}
                        </Typography>
                      </Box>

                      <Box>
                        <Typography
                          variant="caption"
                          sx={{
                            fontWeight: 500,
                            color: theme.palette.text.secondary,
                            fontSize: '0.75rem',
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px',
                            display: 'block',
                            mb: 0.75,
                          }}
                        >
                          Registration Date
                        </Typography>
                        <Typography
                          variant="body2"
                          sx={{
                            color: theme.palette.text.primary,
                            fontSize: '0.875rem',
                            lineHeight: 1.5,
                          }}
                        >
                          {formatDate(company.created_at)}
                        </Typography>
                      </Box>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        )}
      </Box>
    </Box>
  )
}

export default Company_Management
