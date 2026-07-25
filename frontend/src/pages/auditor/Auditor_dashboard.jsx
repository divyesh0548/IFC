import React, { useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useTheme } from '@mui/material/styles'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import CircularProgress from '@mui/material/CircularProgress'
import Dialog from '@mui/material/Dialog'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import FormControl from '@mui/material/FormControl'
import Grid from '@mui/material/Grid'
import InputLabel from '@mui/material/InputLabel'
import MenuItem from '@mui/material/MenuItem'
import Paper from '@mui/material/Paper'
import Select from '@mui/material/Select'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TablePagination from '@mui/material/TablePagination'
import TableRow from '@mui/material/TableRow'
import Typography from '@mui/material/Typography'
import { MAIN_CONTENT_MAX_WIDTH, TABLE_HEADER_BG, TABLE_ROW_HOVER_BG } from '../../uiConstants'
import { apiUrl } from '../../config/api'
import { useSyncGlobalLoading } from '../../contexts/GlobalLoadingContext'
import { parseDateValue } from '../../lib/dateTime'

const ROWS_PER_PAGE_OPTIONS = [10, 25, 50]

function formatDate(dateString) {
  const timestamp = parseDateValue(dateString)?.getTime()
  if (!timestamp || Number.isNaN(timestamp)) return 'N/A'
  return new Date(timestamp).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })
}

function formatRole(role) {
  const normalized = String(role || '').trim()
  if (!normalized) return 'N/A'
  const labels = {
    company_admin: 'Company Admin',
    company_co: 'Company Coordinator',
    siteadmin: 'Site Admin',
  }
  return labels[normalized] || normalized.split('_').filter(Boolean).map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ')
}

function AuditorCompaniesPage() {
  const theme = useTheme()
  const [companies, setCompanies] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedCompany, setSelectedCompany] = useState(null)
  useSyncGlobalLoading(loading)

  useEffect(() => {
    let cancelled = false
    const fetchCompanies = async () => {
      setLoading(true)
      setError('')
      try {
        const response = await fetch(apiUrl('/api/auditor/companies'), { credentials: 'include' })
        const data = await response.json()
        if (cancelled) return
        if (response.ok && data.success) setCompanies(Array.isArray(data.data) ? data.data : [])
        else setError(data.message || 'Failed to fetch companies')
      } catch (fetchError) {
        console.error('Auditor companies page error:', fetchError)
        if (!cancelled) setError('Network error while loading companies')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetchCompanies()
    return () => { cancelled = true }
  }, [])

  return (
    <Box sx={{ minHeight: '100vh', backgroundColor: theme.palette.background.default }}>
      <Box sx={{ maxWidth: MAIN_CONTENT_MAX_WIDTH, mx: 'auto', width: '100%', px: 0, py: { xs: 3, sm: 4, md: 5 } }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', mb: 4, pb: 3, borderBottom: '1px solid', borderColor: 'divider' }}>
          <Box>
            <Typography variant="h5" component="h1" sx={{ fontWeight: 600, color: 'text.primary', mb: 0.75, fontSize: { xs: '1.375rem', sm: '1.5rem' }, letterSpacing: '-0.02em' }}>
              Company Management
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.875rem' }}>
              {loading ? 'Loading...' : `${companies.length} ${companies.length === 1 ? 'company' : 'companies'} registered`}
            </Typography>
          </Box>
        </Box>

        {error ? <Alert severity="error" sx={{ mb: 3, borderRadius: 1 }}>{error}</Alert> : null}
        {loading ? (
          <Box sx={{ display: 'grid', placeItems: 'center', minHeight: 400 }}><CircularProgress size={32} /></Box>
        ) : companies.length === 0 ? (
          <Card sx={{ borderRadius: 1, border: `1px solid ${theme.palette.divider}`, boxShadow: theme.palette.mode === 'dark' ? '0 1px 3px rgba(0,0,0,0.3)' : '0 1px 3px rgba(0,0,0,0.12)' }}>
            <CardContent sx={{ py: 6, px: 4 }}><Typography sx={{ textAlign: 'center', color: 'text.secondary' }}>No companies registered yet.</Typography></CardContent>
          </Card>
        ) : (
          <Grid container spacing={2.5}>
            {companies.map((company) => (
              <Grid key={company.company_identifier || company.id} size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
                <Card
                  onClick={() => setSelectedCompany(company)}
                  sx={{ height: '100%', display: 'flex', flexDirection: 'column', borderRadius: 1, border: `1px solid ${theme.palette.divider}`, boxShadow: theme.palette.mode === 'dark' ? '0 1px 3px rgba(0,0,0,0.3)' : '0 1px 3px rgba(0,0,0,0.12)', transition: 'all 0.2s ease-in-out', cursor: 'pointer', '&:hover': { borderColor: theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.3)' : '#bdbdbd', boxShadow: theme.palette.mode === 'dark' ? '0 4px 12px rgba(0,0,0,0.5)' : '0 4px 12px rgba(0,0,0,0.15)', transform: 'translateY(-2px)' } }}
                >
                  <CardContent sx={{ flexGrow: 1, p: 3 }}>
                    <Typography variant="h6" component="h2" sx={{ fontWeight: 600, mb: 2.5, color: 'text.primary', fontSize: '1.125rem', lineHeight: 1.4, borderBottom: `1px solid ${theme.palette.divider}`, pb: 2 }}>
                      {company.company_name || 'N/A'}
                    </Typography>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.25 }}>
                      <CompanyCardField label="Company Identifier" value={company.company_identifier} mono />
                      <CompanyCardField label="Registered Email" value={company.registered_email} />
                      <CompanyCardField label="Registration Date" value={formatDate(company.created_at)} />
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        )}
      </Box>

      <Dialog open={Boolean(selectedCompany)} onClose={() => setSelectedCompany(null)} fullWidth maxWidth="md">
        <DialogTitle sx={{ fontWeight: 700 }}>{selectedCompany?.company_name || 'Company Details'}</DialogTitle>
        <DialogContent dividers>
          <Box sx={{ display: 'grid', gap: 1.25 }}>
            <CompanyDetailRow label="Company Identifier" value={selectedCompany?.company_identifier} />
            <CompanyDetailRow label="Registered Email" value={selectedCompany?.registered_email} />
            <CompanyDetailRow label="Registered Address" value={selectedCompany?.registered_address} />
            <CompanyDetailRow label="Unique Identification Number" value={selectedCompany?.unique_identification_number} />
            <CompanyDetailRow label="GST" value={selectedCompany?.gst} />
            <CompanyDetailRow label="PAN" value={selectedCompany?.pan} />
            <CompanyDetailRow label="Registration Date" value={formatDate(selectedCompany?.created_at)} />
          </Box>
          <Typography sx={{ fontWeight: 700, mt: 3, mb: 1.25 }}>Units</Typography>
          {selectedCompany?.company_units?.length ? selectedCompany.company_units.map((unit) => (
            <Paper key={unit.id || unit.unit_id} variant="outlined" sx={{ p: 2, mb: 1.25, borderRadius: 1 }}>
              <Typography sx={{ fontWeight: 700 }}>{unit.unit_name || unit.unit_id || 'Unit'}</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>{unit.unit_address || 'No address available'}</Typography>
            </Paper>
          )) : <Typography variant="body2" color="text.secondary">No units available.</Typography>}
        </DialogContent>
      </Dialog>
    </Box>
  )
}

function CompanyCardField({ label, value, mono = false }) {
  return (
    <Box>
      <Typography variant="caption" sx={{ fontWeight: 500, color: 'text.secondary', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', mb: 0.75 }}>{label}</Typography>
      <Typography variant="body2" noWrap sx={{ color: 'text.primary', fontSize: '0.875rem', fontFamily: mono ? 'monospace' : 'inherit', overflow: 'hidden', textOverflow: 'ellipsis' }}>{value || 'N/A'}</Typography>
    </Box>
  )
}

function CompanyDetailRow({ label, value }) {
  return <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '190px minmax(0, 1fr)' }, gap: { xs: 0.25, sm: 2 }, py: 1, borderBottom: '1px solid', borderColor: 'divider' }}><Typography variant="body2" color="text.secondary" sx={{ fontWeight: 700 }}>{label}</Typography><Typography variant="body2" sx={{ wordBreak: 'break-word' }}>{value || 'N/A'}</Typography></Box>
}

function AuditorUsersPage() {
  const theme = useTheme()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [companyFilter, setCompanyFilter] = useState('all')
  const [page, setPage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(10)
  useSyncGlobalLoading(loading)

  useEffect(() => {
    let cancelled = false
    const fetchUsers = async () => {
      setLoading(true)
      setError('')
      try {
        const response = await fetch(apiUrl('/api/auditor/users'), { credentials: 'include' })
        const data = await response.json()
        if (cancelled) return
        if (response.ok && data.success) setUsers((Array.isArray(data.data) ? data.data : []).filter((user) => user.role !== 'siteadmin'))
        else setError(data.message || 'Failed to fetch users')
      } catch (fetchError) {
        console.error('Auditor users page error:', fetchError)
        if (!cancelled) setError('Network error while loading users')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetchUsers()
    return () => { cancelled = true }
  }, [])

  const roleOptions = useMemo(() => [...new Set(users.map((user) => String(user.role || '').trim()).filter(Boolean))].sort(), [users])
  const companyOptions = useMemo(() => [...new Map(users.filter((user) => user.company_identifier).map((user) => [user.company_identifier, { value: user.company_identifier, label: user.company_name || user.company_identifier }])).values()], [users])
  const filteredUsers = useMemo(() => users.filter((user) => (roleFilter === 'all' || user.role === roleFilter) && (companyFilter === 'all' || user.company_identifier === companyFilter)), [users, roleFilter, companyFilter])
  const visibleUsers = filteredUsers.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
  const filterSx = { minWidth: { xs: '100%', sm: 220 } }

  const handleRoleChange = (value) => { setRoleFilter(value); setPage(0) }
  const handleCompanyChange = (value) => { setCompanyFilter(value); setPage(0) }

  return (
    <Box sx={{ py: 2 }}>
      <Paper elevation={3} sx={{ p: 3, borderRadius: 2, backgroundColor: theme.palette.background.paper }}>
        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, justifyContent: 'space-between', gap: 2, mb: 3 }}>
          <Box><Typography variant="h5" sx={{ fontWeight: 700 }}>Users</Typography><Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>View users across all companies.</Typography></Box>
          <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 1.5 }}>
            <FormControl size="small" sx={filterSx}><InputLabel id="auditor-user-role-label">User Type</InputLabel><Select labelId="auditor-user-role-label" label="User Type" value={roleFilter} onChange={(event) => handleRoleChange(event.target.value)}><MenuItem value="all">All types</MenuItem>{roleOptions.map((role) => <MenuItem key={role} value={role}>{formatRole(role)}</MenuItem>)}</Select></FormControl>
            <FormControl size="small" sx={filterSx}><InputLabel id="auditor-user-company-label">Company</InputLabel><Select labelId="auditor-user-company-label" label="Company" value={companyFilter} onChange={(event) => handleCompanyChange(event.target.value)}><MenuItem value="all">All companies</MenuItem>{companyOptions.map((company) => <MenuItem key={company.value} value={company.value}>{company.label}</MenuItem>)}</Select></FormControl>
          </Box>
        </Box>
        {error ? <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert> : null}
        {loading ? <Box sx={{ py: 6, display: 'grid', placeItems: 'center' }}><CircularProgress size={32} /></Box> : (
          <>
            <TableContainer sx={{ border: `1px solid ${theme.palette.divider}`, borderRadius: 1 }}>
              <Table size="small"><TableHead sx={{ backgroundColor: TABLE_HEADER_BG }}><TableRow>{['Name', 'Email', 'Company', 'User Type', 'Department', 'Designation', 'Mobile'].map((label) => <TableCell key={label} sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>{label}</TableCell>)}</TableRow></TableHead>
                <TableBody>{visibleUsers.length ? visibleUsers.map((user) => <TableRow key={user.id || user.email_id} hover sx={{ '&:hover': { backgroundColor: TABLE_ROW_HOVER_BG } }}><TableCell>{user.emp_name || 'N/A'}</TableCell><TableCell>{user.email_id || 'N/A'}</TableCell><TableCell>{user.company_name || user.company_identifier || 'N/A'}</TableCell><TableCell>{formatRole(user.role)}</TableCell><TableCell>{user.department || 'N/A'}</TableCell><TableCell>{user.designation || 'N/A'}</TableCell><TableCell>{user.mobile || 'N/A'}</TableCell></TableRow>) : <TableRow><TableCell colSpan={7} align="center" sx={{ py: 5, color: 'text.secondary' }}>No users match the selected filters.</TableCell></TableRow>}</TableBody>
              </Table>
            </TableContainer>
            <TablePagination component="div" count={filteredUsers.length} page={page} onPageChange={(_event, newPage) => setPage(newPage)} rowsPerPage={rowsPerPage} onRowsPerPageChange={(event) => { setRowsPerPage(Number(event.target.value)); setPage(0) }} rowsPerPageOptions={ROWS_PER_PAGE_OPTIONS} />
          </>
        )}
      </Paper>
    </Box>
  )
}

function Auditor_dashboard() {
  const location = useLocation()
  if (location.pathname === '/auditor/companies') return <AuditorCompaniesPage />
  if (location.pathname === '/auditor/users') return <AuditorUsersPage />
  return <Box sx={{ py: 2 }}><Alert severity="info">Select a module from the auditor home page.</Alert></Box>
}

export default Auditor_dashboard
