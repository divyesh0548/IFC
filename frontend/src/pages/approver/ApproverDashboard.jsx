import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTheme } from '@mui/material/styles'
import Button from '@mui/material/Button'
import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Paper from '@mui/material/Paper'
import Chip from '@mui/material/Chip'
import FormControl from '@mui/material/FormControl'
import InputLabel from '@mui/material/InputLabel'
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import { FILTER_DROPDOWN_MIN_WIDTH_SM } from '../../uiConstants'

function ApproverDashboard() {
  const theme = useTheme()
  const navigate = useNavigate()
  const [approver, setApprover] = useState(null)
  const [pendingForms, setPendingForms] = useState([])
  const [allForms, setAllForms] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('pending') // 'pending', 'all', 'approved', 'rejected'

  useEffect(() => {
    // Fetch user info on component mount
    const fetchUserInfo = async () => {
      try {
        const response = await fetch('http://localhost:3000/api/auth/verify', {
          method: 'GET',
          credentials: 'include',
        })

        const data = await response.json()

        if (response.ok && data.success) {
          // Store user info as approver for compatibility
          setApprover({
            id: data.user.id,
            email_id: data.user.email_id
          })
        } else {
          navigate('/login')
        }
      } catch (error) {
        console.error('Error fetching user info:', error)
        navigate('/login')
      }
    }

    fetchUserInfo()
  }, [navigate])

  useEffect(() => {
    if (approver) {
      fetchForms()
    }
  }, [approver, filter])

  const fetchForms = async () => {
    setLoading(true)
    try {
      // Always exclude inactive forms - only fetch active forms
      let url = 'http://localhost:3000/api/approver/control-forms?active=true'
      
      if (filter === 'pending') {
        url += `&status=${encodeURIComponent('sent for approval')}`
      } else if (filter === 'approved') {
        url += `&status=${encodeURIComponent('Approved')}`
      } else if (filter === 'rejected') {
        url += `&status=${encodeURIComponent('Rejected')}`
      }

      const response = await fetch(url, {
        method: 'GET',
        credentials: 'include',
      })

      const data = await response.json()

      if (response.ok && data.success) {
        const sortedForms = [...data.data].sort((a, b) => {
          const dateA = a.created_at ? new Date(a.created_at).getTime() : 0
          const dateB = b.created_at ? new Date(b.created_at).getTime() : 0
          return dateB - dateA // Descending order (newest first)
        })
        
        if (filter === 'pending') {
          setPendingForms(sortedForms)
        } else {
          setAllForms(sortedForms)
        }
      } else {
        console.error('Error fetching forms:', data.message)
      }
    } catch (error) {
      console.error('Error fetching forms:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleFormClick = (formId) => {
    navigate(`/approver/form/${formId}`)
  }

  const formsToDisplay = filter === 'pending' ? pendingForms : allForms

  return (
    <Box
      sx={{
        maxWidth: '100%',
        mx: 'auto',
        px: 2,
        py: 4,
      }}
    >
        {/* Forms Section */}
        <Card
          sx={{
            maxWidth: '100%',
          }}
        >
          <CardContent>
            <Box
              sx={{
                display: 'flex',
                flexDirection: { xs: 'column', sm: 'row' },
                justifyContent: 'space-between',
                alignItems: { xs: 'flex-start', sm: 'center' },
                gap: 2,
                mb: 3,
              }}
            >
              <Typography variant="h6" component="h2" sx={{ fontWeight: 600, color: 'text.primary' }}>
                {filter === 'pending' ? 'Pending Approvals' : filter === 'approved' ? 'Approved Forms' : filter === 'rejected' ? 'Rejected Forms' : 'All RACM'}
              </Typography>

              {/* Status Filter */}
              <Box sx={{ minWidth: { xs: '100%', sm: FILTER_DROPDOWN_MIN_WIDTH_SM } }}>
                <FormControl
                  variant="outlined"
                  fullWidth
                  size="small"
                >
                  <InputLabel id="approver-status-filter-label">Status</InputLabel>
                  <Select
                    labelId="approver-status-filter-label"
                    id="approver-status-filter"
                    value={filter}
                    label="Status"
                    onChange={(e) => setFilter(e.target.value)}
                  >
                    <MenuItem value="all">All</MenuItem>
                    <MenuItem value="pending">Pending</MenuItem>
                    <MenuItem value="approved">Approved</MenuItem>
                    <MenuItem value="rejected">Rejected</MenuItem>
                  </Select>
                </FormControl>
              </Box>
            </Box>

            {loading ? (
              <Typography variant="body1" sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>
                Loading forms...
              </Typography>
            ) : formsToDisplay.length === 0 ? (
              <Typography variant="body1" sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>
                No forms found.
              </Typography>
            ) : (
              <TableContainer component={Paper} elevation={0}>
                <Table>
                  <TableHead>
                    <TableRow sx={{ backgroundColor: theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.05)' : '#f8f9fa' }}>
                      <TableCell sx={{ fontWeight: 600 }}>#</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Description</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Business Process</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Company</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Process Owner</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Approval Status</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Created At</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {formsToDisplay.map((form, index) => {
                      const approvalStatus = form.status === 'sent for approval'
                        ? 'pending'
                        : (form.status || 'Pending')
                      const isPending = !form.status || form.status === '' || form.status === 'sent for approval'
                      const isApproved = form.status === 'Approved'
                      const isRejected = form.status === 'Rejected'
                      
                      return (
                        <TableRow
                          key={form.id}
                          hover
                          sx={{ cursor: 'pointer' }}
                          onClick={() => handleFormClick(form.form_id)}
                        >
                          <TableCell>{index + 1}</TableCell>
                          <TableCell>{form.standard_control_description || 'N/A'}</TableCell>
                          <TableCell>{form.business_process || 'N/A'}</TableCell>
                          <TableCell>{form.company_name || 'N/A'}</TableCell>
                          <TableCell>{form.process_owner_name || form.process_owner || 'N/A'}</TableCell>
                          <TableCell>
                            <Chip
                              label={approvalStatus}
                              size="small"
                              sx={{
                                backgroundColor: isPending ? '#fef3c7' : isApproved ? '#d1fae5' : '#fee2e2',
                                color: isPending ? '#f59e0b' : isApproved ? '#10b981' : '#ef4444',
                                fontWeight: 600,
                              }}
                            />
                          </TableCell>
                          <TableCell>
                            {form.created_at
                              ? new Date(form.created_at).toLocaleDateString('en-IN', {
                                  year: 'numeric',
                                  month: 'short',
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })
                              : 'N/A'}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </CardContent>
        </Card>
      </Box>
  )
}

export default ApproverDashboard

