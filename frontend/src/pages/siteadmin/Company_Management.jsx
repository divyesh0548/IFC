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
import ManagementPageHeader from '../../components/ManagementPageHeader'
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
    <ManagementPageHeader
      title="Company Management"
      subtitle={loading ? 'Loading...' : `${companies.length} ${companies.length === 1 ? 'company' : 'companies'} registered`}
      actions={
        <Button
          component={Link}
          to="/siteadmin/create-company"
          variant="contained"
          color="secondary"
          sx={{
            px: 2.5,
            py: 1,
            fontSize: '0.875rem',
            fontWeight: 700,
            textTransform: 'none',
            boxShadow: 'none',
          }}
        >
          + Add New Company
        </Button>
      }
    >
        {error && (
          <Alert
            severity="error"
            sx={{
              mb: 2,
              borderRadius: 0,
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
              minHeight: '280px',
            }}
          >
            <CircularProgress size={32} />
          </Box>
        ) : companies.length === 0 ? (
          <Card
            sx={{
              borderRadius: 1.5,
              boxShadow: 'none',
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
                    <Typography
                      variant="h6"
                      component="h2"
                      sx={{
                        fontWeight: 800,
                        mb: 2.5,
                        color: theme.palette.text.primary,
                        fontSize: '1.2rem',
                        lineHeight: 1.35,
                        borderBottom: `1px solid ${theme.palette.divider}`,
                        pb: 2,
                        letterSpacing: '-0.02em',
                      }}
                    >
                      {company.company_name || 'N/A'}
                    </Typography>

                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <Box>
                        <Typography
                          variant="caption"
                          sx={{
                            fontWeight: 600,
                            color: theme.palette.text.secondary,
                            fontSize: '0.7rem',
                            textTransform: 'uppercase',
                            letterSpacing: '0.06em',
                            display: 'block',
                            mb: 0.6,
                          }}
                        >
                          Registered Email
                        </Typography>
                        <Typography
                          variant="body2"
                          noWrap
                          title={company.registered_email || 'N/A'}
                          sx={{
                            color: theme.palette.text.primary,
                            fontSize: '0.875rem',
                            fontWeight: 500,
                            lineHeight: 1.5,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {company.registered_email || 'N/A'}
                        </Typography>
                      </Box>

                      <Box
                        sx={{
                          display: 'flex',
                          alignItems: 'baseline',
                          flexWrap: 'wrap',
                          gap: 2.5,
                          rowGap: 1,
                        }}
                      >
                        <Typography
                          variant="body2"
                          sx={{
                            color: theme.palette.text.primary,
                            fontSize: '0.875rem',
                            fontWeight: 500,
                            lineHeight: 1.5,
                          }}
                        >
                          <Box
                            component="span"
                            sx={{
                              color: theme.palette.text.secondary,
                              fontWeight: 600,
                              fontSize: '0.7rem',
                              textTransform: 'uppercase',
                              letterSpacing: '0.05em',
                              mr: 0.75,
                            }}
                          >
                            Units
                          </Box>
                          {Number(company.total_units || 0)}
                        </Typography>
                        <Typography
                          variant="body2"
                          sx={{
                            color: theme.palette.text.primary,
                            fontSize: '0.875rem',
                            fontWeight: 500,
                            lineHeight: 1.5,
                          }}
                        >
                          <Box
                            component="span"
                            sx={{
                              color: theme.palette.text.secondary,
                              fontWeight: 600,
                              fontSize: '0.7rem',
                              textTransform: 'uppercase',
                              letterSpacing: '0.05em',
                              mr: 0.75,
                            }}
                          >
                            Admins
                          </Box>
                          {Number(company.total_company_admins || 0)}
                        </Typography>
                      </Box>

                      <Box>
                        <Typography
                          variant="caption"
                          sx={{
                            fontWeight: 600,
                            color: theme.palette.text.secondary,
                            fontSize: '0.7rem',
                            textTransform: 'uppercase',
                            letterSpacing: '0.06em',
                            display: 'block',
                            mb: 0.6,
                          }}
                        >
                          Registration Date
                        </Typography>
                        <Typography
                          variant="body2"
                          sx={{
                            color: theme.palette.text.primary,
                            fontSize: '0.875rem',
                            fontWeight: 500,
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
    </ManagementPageHeader>
  )
}

export default Company_Management
