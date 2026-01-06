import React, { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { useTheme } from '@mui/material/styles'
import Navbar from '../../components/Siteadmin_navbar'
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';

function FormDetail() {
  const theme = useTheme()
  const { form_id } = useParams()
  const [formData, setFormData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [updating, setUpdating] = useState(false)

  useEffect(() => {
    fetchFormData()
  }, [form_id])

  const fetchFormData = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`http://localhost:3000/api/control-forms/${form_id}`, {
        method: 'GET',
        credentials: 'include',
      })

      const data = await response.json()

      if (response.ok && data.success) {
        setFormData(data.data)
      } else {
        setError(data.message || 'Failed to fetch form data')
      }
    } catch (error) {
      console.error('Error fetching form data:', error)
      setError('Error fetching form data')
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = async () => {
    try {
      const response = await fetch('http://localhost:3000/api/auth/user/logout', {
        method: 'POST',
        credentials: 'include',
      })

      const data = await response.json()

      if (response.ok && data.success) {
        window.location.href = '/user/login'
      } else {
        window.location.href = '/user/login'
      }
    } catch (error) {
      console.error('Logout error:', error)
      window.location.href = '/user/login'
    }
  }

  const handleToggleActive = async () => {
    if (!formData) return

    setUpdating(true)
    try {
      // Determine new active status
      const isCurrentlyActive = formData.active && formData.active !== '' && formData.active !== '0'
      const newActiveStatus = isCurrentlyActive ? '0' : '1'

      const response = await fetch(`http://localhost:3000/api/control-forms/${form_id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          active: newActiveStatus
        }),
      })

      const data = await response.json()

      if (response.ok && data.success) {
        // Update local state
        setFormData({
          ...formData,
          active: newActiveStatus
        })
      } else {
        console.error('Error updating form:', data.message)
        alert('Failed to update form status: ' + (data.message || 'Unknown error'))
      }
    } catch (error) {
      console.error('Error updating form:', error)
      alert('Error updating form status')
    } finally {
      setUpdating(false)
    }
  }

  const formatDateTime = (dateString) => {
    if (!dateString) return 'N/A'
    const date = new Date(dateString)
    return date.toLocaleString('en-IN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      timeZone: 'Asia/Kolkata'
    })
  }

  // Define field labels mapping
  const fieldLabels = {
    description_of_control: 'Description of Control',
    process: 'Process',
    sub_process: 'Sub Process',
    risk_description: 'Risk Description',
    whether_fraud_risks_exist: 'Whether Fraud Risks Exist',
    control_objective: 'Control Objective',
    control_to_address: 'Control to Address',
    mrc_or_not: 'MRC or Not',
    source_data_report_logic_report_parameters: 'Source Data/Report Logic/Report Parameters',
    relevant_data_elements_of_ipe: 'Relevant Data Elements of IPE',
    type_of_control: 'Type of Control',
    nature_of_control: 'Nature of Control',
    type_of_risk_mitigation_method: 'Type of Risk Mitigation Method',
    process_owner: 'Process Owner',
    reviewer_process_supervisor: 'Reviewer/Process Supervisor',
    control_frequency: 'Control Frequency',
    basis_of_sampling: 'Basis of Sampling',
    docs_to_review_for_dms_audit: 'Docs to Review for DMS Audit',
    type_of_risk_associated: 'Type of Risk Associated',
    financial_reporting: 'Financial Reporting',
    checks_performed: 'Checks Performed',
    effective_or_not_effective: 'Effective or Not Effective',
    done: 'Done',
    findings: 'Findings',
    gap_description_resolution: 'Gap Description & Resolution',
    doc_uploaded_by_user: 'Doc Uploaded by User',
    active: 'Active',
    approved_rejected: 'Approved/Rejected',
    reason_by_approver: 'Reason by Approver',
  }

  // Fields to exclude from display
  const excludedFields = ['id', 'form_id', 'company_identifier', 'created_at', 'active', 'approved_rejected', 'reason_by_approver']

  if (loading) {
    return (
      <div className="min-h-screen bg-primary">
        <Navbar onLogout={handleLogout} header="Control Form" />
        <div className="flex items-center justify-center min-h-[calc(100vh-4rem)]">
          <p className="text-secondary text-lg">Loading form data...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-primary">
        <Navbar onLogout={handleLogout} header="Control Form" />
        <div className="flex items-center justify-center min-h-[calc(100vh-4rem)]">
          <div className="bg-white rounded-xl shadow-lg p-8 max-w-md">
            <p className="text-red-600 text-lg text-center">{error}</p>
          </div>
        </div>
      </div>
    )
  }

  if (!formData) {
    return (
      <div className="min-h-screen bg-primary">
        <Navbar onLogout={handleLogout} header="Control Form" />
        <div className="flex items-center justify-center min-h-[calc(100vh-4rem)]">
          <div className="bg-white rounded-xl shadow-lg p-8 max-w-md">
            <p className="text-secondary text-lg text-center">Form not found</p>
          </div>
        </div>
      </div>
    )
  }

  const isActive = formData?.active && formData.active !== '' && formData.active !== '0'

  return (
    <div className="min-h-screen bg-primary">
      <Navbar onLogout={handleLogout} header="Control Form" />

      <div className="w-full max-w-[1500px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Typography 
          variant="h4" 
          component="h1" 
          sx={{ 
            fontWeight: 700, 
            textAlign: 'center', 
            mb: 4,
            color: 'text.primary'
          }}
        >
          Control Form
        </Typography>
        <div className="flex flex-col lg:flex-row">
          {/* Left Sidebar - 25% */}
          <div className="w-full lg:w-1/4 pr-6">
            <div className="sticky top-4">
              <Card>
                <CardContent sx={{ p: 3 }}>
                  <div className="space-y-6">
                    {/* Active/Inactive Toggle Button */}
                    <div>
                      <Typography
                        variant="body2"
                        component="label"
                        sx={{
                          display: 'block',
                          fontWeight: 600,
                          mb: 2,
                          color: 'text.primary'
                        }}
                      >
                        Form Status
                      </Typography>
                      <Button
                        onClick={handleToggleActive}
                        disabled={updating}
                        fullWidth
                        variant="contained"
                        sx={{
                          py: 1.5,
                          fontWeight: 600,
                          textTransform: 'none',
                          ...(isActive ? {
                            backgroundColor: '#10b981',
                            color: '#ffffff',
                            '&:hover': {
                              backgroundColor: '#059669',
                            },
                          } : {
                            backgroundColor: '#ef4444',
                            color: '#ffffff',
                            '&:hover': {
                              backgroundColor: '#dc2626',
                            },
                          }),
                          ...(updating && {
                            opacity: 0.6,
                            cursor: 'not-allowed',
                          }),
                        }}
                      >
                        {updating ? 'Updating...' : (isActive ? '✓ Active' : '✗ Inactive')}
                      </Button>
                    </div>

                    {/* Creation Time */}
                    <Box sx={{ pt: 3, borderTop: '1px solid', borderColor: 'divider' }}>
                      <Typography
                        variant="body2"
                        component="label"
                        sx={{
                          display: 'block',
                          fontWeight: 600,
                          mb: 1,
                          color: 'text.primary'
                        }}
                      >
                        Created At
                      </Typography>
                      <Typography variant="body2" sx={{ color: 'text.primary' }}>
                        {formatDateTime(formData?.created_at)}
                      </Typography>
                    </Box>

                    {/* Approved/Rejected */}
                    <Box sx={{ pt: 3, borderTop: '1px solid', borderColor: 'divider' }}>
                      <Typography
                        variant="body2"
                        component="label"
                        sx={{
                          display: 'block',
                          fontWeight: 600,
                          mb: 1,
                          color: 'text.primary'
                        }}
                      >
                        Approved/Rejected
                      </Typography>
                      <Typography variant="body2" sx={{ color: 'text.primary' }}>
                        {formData?.approved_rejected || '-'}
                      </Typography>
                    </Box>

                    {/* Reason by Approver */}
                    <Box sx={{ pt: 3, borderTop: '1px solid', borderColor: 'divider' }}>
                      <Typography
                        variant="body2"
                        component="label"
                        sx={{
                          display: 'block',
                          fontWeight: 600,
                          mb: 1,
                          color: 'text.primary'
                        }}
                      >
                        Reason by Approver
                      </Typography>
                      <Typography 
                        variant="body2" 
                        sx={{ 
                          color: 'text.primary',
                          wordBreak: 'break-word'
                        }}
                      >
                        {formData?.reason_by_approver || '-'}
                      </Typography>
                    </Box>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Vertical Divider */}
          <div className="hidden lg:block w-px bg-gray-300"></div>

          {/* Right Side - 75% */}
          <div className="w-full lg:w-3/4 pl-6">
            <Card>
              <CardContent sx={{ p: 4 }}>
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: {
                      xs: '1fr',
                      md: 'repeat(2, 1fr)',
                    },
                    gap: 3,
                  }}
                >
                  {Object.keys(formData)
                    .filter(key => !excludedFields.includes(key))
                    .map((key) => {
                      const label = fieldLabels[key] || key.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())
                      const value = formData[key]
                      const isEmpty = value === null || value === undefined || value === ''

                      return (
                        <Box
                          key={key}
                          sx={{
                            pb: 3,
                            borderBottom: '1px solid',
                            borderColor: 'divider',
                            '&:last-child': {
                              borderBottom: 'none',
                            },
                          }}
                        >
                          <Typography
                            variant="caption"
                            component="dt"
                            sx={{
                              display: 'block',
                              fontWeight: 600,
                              textTransform: 'uppercase',
                              letterSpacing: '0.5px',
                              mb: 1,
                              color: 'text.primary',
                              fontSize: '0.75rem',
                            }}
                          >
                            {label}
                          </Typography>
                          <Typography
                            variant="body2"
                            component="dd"
                            sx={{
                              color: isEmpty ? 'text.disabled' : 'text.primary',
                              wordBreak: 'break-word',
                              lineHeight: 1.6,
                              fontSize: '0.9375rem',
                            }}
                          >
                            {isEmpty ? '-' : String(value)}
                          </Typography>
                        </Box>
                      )
                    })}
                </Box>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}

export default FormDetail

