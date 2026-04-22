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
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogContentText from '@mui/material/DialogContentText'
import DialogTitle from '@mui/material/DialogTitle'
import Checkbox from '@mui/material/Checkbox'
import FormControlLabel from '@mui/material/FormControlLabel'
import DeleteIcon from '@mui/icons-material/Delete'
import { toast } from 'react-hot-toast'
import { MAIN_CONTENT_MAX_WIDTH } from '../../uiConstants'
import { useSyncGlobalLoading } from '../../contexts/GlobalLoadingContext'

function Company_Management() {
  const theme = useTheme()
  const navigate = useNavigate()
  const [companies, setCompanies] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [selectedCompany, setSelectedCompany] = useState(null)
  const [deletingCompany, setDeletingCompany] = useState(false)
  const [deleteOptions, setDeleteOptions] = useState({
    deleteUsers: false,
    deleteRacms: false,
  })
  useSyncGlobalLoading(loading || deletingCompany)

  useEffect(() => {
    fetchCompanies()
  }, [])

  const fetchCompanies = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('http://localhost:3000/api/siteadmin/companies', {
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
    const date = new Date(dateString)
    return date.toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: 'Asia/Kolkata'
    })
  }

  const handleDeleteClick = (event, company) => {
    event.stopPropagation()
    setSelectedCompany(company)
    setDeleteOptions({
      deleteUsers: false,
      deleteRacms: false,
    })
    setDeleteDialogOpen(true)
  }

  const handleDeleteCancel = () => {
    if (deletingCompany) return
    setDeleteDialogOpen(false)
    setSelectedCompany(null)
  }

  const handleDeleteOptionChange = (field) => (event) => {
    setDeleteOptions(prev => ({
      ...prev,
      [field]: event.target.checked,
    }))
  }

  const handleDeleteConfirm = async () => {
    if (!selectedCompany?.company_identifier) return

    setDeletingCompany(true)
    setError(null)
    try {
      const response = await fetch(
        `http://localhost:3000/api/siteadmin/companies/${encodeURIComponent(selectedCompany.company_identifier)}`,
        {
          method: 'DELETE',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(deleteOptions),
        }
      )

      const data = await response.json()

      if (response.ok && data.success) {
        toast.success(data.message || 'Company deleted successfully')
        setCompanies(prev =>
          prev.filter(company => company.company_identifier !== selectedCompany.company_identifier)
        )
        setDeleteDialogOpen(false)
        setSelectedCompany(null)
      } else {
        setError(data.message || 'Failed to delete company')
      }
    } catch (err) {
      console.error('Error deleting company:', err)
      setError('Error deleting company')
    } finally {
      setDeletingCompany(false)
    }
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
                    <Box sx={{ mt: 2.5, pt: 2, borderTop: `1px solid ${theme.palette.divider}` }}>
                      <Button
                        variant="outlined"
                        color="error"
                        size="small"
                        startIcon={<DeleteIcon />}
                        disabled={deletingCompany}
                        onClick={(event) => handleDeleteClick(event, company)}
                        sx={{
                          textTransform: 'none',
                          borderRadius: '4px',
                          fontWeight: 600,
                        }}
                      >
                        Delete
                      </Button>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        )}
      </Box>
      <Dialog
        open={deleteDialogOpen}
        onClose={handleDeleteCancel}
        aria-labelledby="delete-company-dialog-title"
        PaperProps={{
          sx: {
            borderRadius: '6px',
            width: '100%',
            maxWidth: 560,
          },
        }}
      >
        <DialogTitle id="delete-company-dialog-title" sx={{ fontWeight: 700 }}>
          Delete Company
        </DialogTitle>
        <DialogContent>
          <DialogContentText component="div" sx={{ color: 'text.secondary' }}>
            Delete <strong>{selectedCompany?.company_name || 'this company'}</strong>?
            <Box component="span" sx={{ display: 'block', mt: 1.5 }}>
              Company can be deleted without selecting these options. Select the data you also want to remove.
            </Box>
          </DialogContentText>
          <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 0.75 }}>
            <FormControlLabel
              control={
                <Checkbox
                  checked={deleteOptions.deleteUsers}
                  onChange={handleDeleteOptionChange('deleteUsers')}
                  disabled={deletingCompany}
                />
              }
              label="Delete users"
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={deleteOptions.deleteRacms}
                  onChange={handleDeleteOptionChange('deleteRacms')}
                  disabled={deletingCompany}
                />
              }
              label="Delete RACMs"
            />
          </Box>
          {deleteOptions.deleteRacms && (
            <Alert severity="warning" sx={{ mt: 2 }}>
              All associated sample documents and user-uploaded documents will be removed permanently from S3 and the database.
            </Alert>
          )}
          {deleteOptions.deleteUsers && (
            <Alert severity="warning" sx={{ mt: 1.5 }}>
              All users with this company identifier will be deleted permanently.
            </Alert>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, gap: 1, flexWrap: 'wrap' }}>
          <Button onClick={handleDeleteCancel} disabled={deletingCompany}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color="error"
            disabled={deletingCompany}
            onClick={handleDeleteConfirm}
          >
            {deletingCompany ? 'Deleting...' : 'Delete Company'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

export default Company_Management
