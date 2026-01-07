import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Navbar from '../../components/Siteadmin_navbar'
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

function ApproverDashboard() {
  const navigate = useNavigate()
  const [approver, setApprover] = useState(null)
  const [pendingForms, setPendingForms] = useState([])
  const [allForms, setAllForms] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('pending') // 'pending', 'all', 'approved', 'rejected'

  useEffect(() => {
    // Fetch approver info on component mount
    const fetchApproverInfo = async () => {
      try {
        const response = await fetch('http://localhost:3000/api/auth/approver/verify', {
          method: 'GET',
          credentials: 'include',
        })

        const data = await response.json()

        if (response.ok && data.success) {
          setApprover(data.approver)
        } else {
          navigate('/approver/login')
        }
      } catch (error) {
        console.error('Error fetching approver info:', error)
        navigate('/approver/login')
      }
    }

    fetchApproverInfo()
  }, [navigate])

  useEffect(() => {
    if (approver) {
      fetchForms()
    }
  }, [approver, filter])

  const fetchForms = async () => {
    setLoading(true)
    try {
      let url = 'http://localhost:3000/api/approver/control-forms'
      
      if (filter === 'pending') {
        url = 'http://localhost:3000/api/approver/pending-approvals'
      } else if (filter === 'approved') {
        url += '?approved_rejected=Approved'
      } else if (filter === 'rejected') {
        url += '?approved_rejected=Rejected'
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
    window.open(`/approver/form/${formId}`, '_blank')
  }

  const handleLogout = async () => {
    try {
      const response = await fetch('http://localhost:3000/api/auth/approver/logout', {
        method: 'POST',
        credentials: 'include',
      })

      const data = await response.json()

      if (response.ok && data.success) {
        navigate('/approver/login')
      } else {
        console.error('Logout failed:', data.message)
        navigate('/approver/login')
      }
    } catch (error) {
      console.error('Logout error:', error)
      navigate('/approver/login')
    }
  }

  const formsToDisplay = filter === 'pending' ? pendingForms : allForms

  return (
    <div className="min-h-screen bg-primary">
      <Navbar onLogout={handleLogout} header="Approver Dashboard" />

      {/* Dashboard Content */}
      <div className="container mx-auto px-4 py-8">

        {/* Filter Buttons */}
        <Box sx={{ display: 'flex', gap: 2, mb: 4 }}>
          <Button
            onClick={() => setFilter('pending')}
            variant={filter === 'pending' ? 'contained' : 'outlined'}
            color={filter === 'pending' ? 'secondary' : 'inherit'}
            sx={{
              minWidth: '100px',
              textTransform: 'none',
            }}
          >
            Pending
          </Button>
          <Button
            onClick={() => setFilter('all')}
            variant={filter === 'all' ? 'contained' : 'outlined'}
            color={filter === 'all' ? 'secondary' : 'inherit'}
            sx={{
              minWidth: '100px',
              textTransform: 'none',
            }}
          >
            All
          </Button>
          <Button
            onClick={() => setFilter('approved')}
            variant={filter === 'approved' ? 'contained' : 'outlined'}
            color={filter === 'approved' ? 'secondary' : 'inherit'}
            sx={{
              minWidth: '100px',
              textTransform: 'none',
            }}
          >
            Approved
          </Button>
          <Button
            onClick={() => setFilter('rejected')}
            variant={filter === 'rejected' ? 'contained' : 'outlined'}
            color={filter === 'rejected' ? 'secondary' : 'inherit'}
            sx={{
              minWidth: '100px',
              textTransform: 'none',
            }}
          >
            Rejected
          </Button>
        </Box>

        {/* Forms Section */}
        <Card>
          <CardContent>
            <Typography variant="h6" component="h2" sx={{ fontWeight: 600, mb: 3, color: 'text.primary' }}>
              {filter === 'pending' ? 'Pending Approvals' : filter === 'approved' ? 'Approved Forms' : filter === 'rejected' ? 'Rejected Forms' : 'All Control Forms'}
            </Typography>

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
                    <TableRow sx={{ backgroundColor: '#f8f9fa' }}>
                      <TableCell sx={{ fontWeight: 600 }}>#</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Description</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Process</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Approval Status</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Created At</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {formsToDisplay.map((form, index) => {
                      const isActive = form.active && form.active !== '' && form.active !== '0'
                      const approvalStatus = form.approved_rejected || 'Pending'
                      const isPending = !form.approved_rejected || form.approved_rejected === ''
                      const isApproved = form.approved_rejected === 'Approved'
                      const isRejected = form.approved_rejected === 'Rejected'
                      
                      return (
                        <TableRow
                          key={form.id}
                          hover
                          sx={{ cursor: 'pointer' }}
                          onClick={() => handleFormClick(form.form_id)}
                        >
                          <TableCell>{index + 1}</TableCell>
                          <TableCell>{form.description_of_control || 'N/A'}</TableCell>
                          <TableCell>{form.process || 'N/A'}</TableCell>
                          <TableCell>
                            <Chip
                              label={isActive ? 'Active' : 'Inactive'}
                              size="small"
                              sx={{
                                backgroundColor: isActive ? '#10b981' : '#ef4444',
                                color: '#ffffff',
                              }}
                            />
                          </TableCell>
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
      </div>
    </div>
  )
}

export default ApproverDashboard

