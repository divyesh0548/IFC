import React, { useEffect, useMemo, useState } from 'react'
import { alpha, useTheme } from '@mui/material/styles'
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import Alert from '@mui/material/Alert'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import CircularProgress from '@mui/material/CircularProgress'
import Chip from '@mui/material/Chip'
import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import FormControl from '@mui/material/FormControl'
import InputLabel from '@mui/material/InputLabel'
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import { toast } from 'react-hot-toast'
import { apiUrl } from '../../config/api'
import { useSyncGlobalLoading } from '../../contexts/GlobalLoadingContext'
import { formatIndianDateTime } from '../../lib/dateTime'
import { DASHBOARD_PAGE_OUTER_SX, DASHBOARD_PAPER_SX, TABLE_HEADER_BG, TABLE_ROW_HOVER_BG } from '../../uiConstants'

const REVIEW_FILTER_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'pending', label: 'Pending Review' },
  { value: 'reviewed', label: 'Reviewed' },
]

const TYPE_FILTER_OPTIONS = [
  { value: 'all', label: 'All Types' },
  { value: 'Website Issue', label: 'Website Issue' },
  { value: 'Suggestion', label: 'Suggestion' },
]

function truncateText(value, maxLength = 120) {
  const text = String(value || '').trim()
  if (!text) return '-'
  if (text.length <= maxLength) return text
  return `${text.slice(0, maxLength).trimEnd()}...`
}

function UserQueries() {
  const theme = useTheme()
  const [queries, setQueries] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [updatingId, setUpdatingId] = useState(null)
  const [reviewFilter, setReviewFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')
  const [selectedQuery, setSelectedQuery] = useState(null)

  useSyncGlobalLoading(loading || Boolean(updatingId))

  const fetchQueries = async () => {
    setLoading(true)
    setError('')
    try {
      const response = await fetch(apiUrl('/api/siteadmin/user-queries'), {
        credentials: 'include',
      })
      const data = await response.json()

      if (response.ok && data.success) {
        setQueries(Array.isArray(data.data) ? data.data : [])
      } else {
        setError(data.message || 'Failed to fetch user queries')
      }
    } catch (fetchError) {
      console.error('Fetch user queries error:', fetchError)
      setError('Network error while fetching user queries')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchQueries()
  }, [])

  const filteredQueries = useMemo(() => queries.filter((query) => {
    const matchesReview = reviewFilter === 'all'
      || (reviewFilter === 'pending' && !query.reviewed)
      || (reviewFilter === 'reviewed' && query.reviewed)
    const matchesType = typeFilter === 'all' || query.type_of_query === typeFilter
    return matchesReview && matchesType
  }), [queries, reviewFilter, typeFilter])

  const handleMarkReviewed = async (query) => {
    if (!query || query.reviewed) return

    setUpdatingId(query.id)
    try {
      const response = await fetch(apiUrl(`/api/siteadmin/user-queries/${query.id}/reviewed`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ reviewed: true }),
      })
      const data = await response.json()

      if (response.ok && data.success) {
        toast.success(data.message || 'Query marked as reviewed')
        setQueries((current) => current.map((item) => (
          item.id === query.id ? { ...item, ...data.data } : item
        )))
        setSelectedQuery((current) => (
          current?.id === query.id ? { ...current, ...data.data } : current
        ))
      } else {
        toast.error(data.message || 'Failed to update query')
      }
    } catch (updateError) {
      console.error('Update user query error:', updateError)
      toast.error('Failed to update query')
    } finally {
      setUpdatingId(null)
    }
  }

  const tableBorderColor = alpha(theme.palette.text.primary, theme.palette.mode === 'light' ? 0.14 : 0.18)
  const bodyCellSx = {
    py: 1.5,
    px: 2,
    borderBottom: `1px solid ${tableBorderColor}`,
    verticalAlign: 'top',
    fontSize: '0.92rem',
  }
  const headCellSx = {
    ...bodyCellSx,
    py: 1.6,
    fontSize: '0.78rem',
    fontWeight: 800,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    color: 'text.secondary',
    backgroundColor: TABLE_HEADER_BG,
  }
  const filterControlSx = { minWidth: { xs: '100%', sm: 200 } }

  return (
    <Box sx={DASHBOARD_PAGE_OUTER_SX}>
      <Paper elevation={0} sx={{ ...DASHBOARD_PAPER_SX, p: 0, overflow: 'hidden' }}>
        <Box sx={{ px: { xs: 2.5, sm: 3 }, py: 2.5, borderBottom: '1px solid', borderColor: 'divider' }}>
          <Typography component="h1" sx={{ fontSize: { xs: '1.45rem', sm: '1.7rem' }, fontWeight: 850 }}>
            User Queries
          </Typography>
          <Typography sx={{ mt: 0.75, color: 'text.secondary', lineHeight: 1.7, maxWidth: 760 }}>
            Review website issues and suggestions submitted by users across the platform.
          </Typography>
        </Box>

        {error ? <Alert severity="error" sx={{ m: 2.5 }}>{error}</Alert> : null}

        {loading ? (
          <Box sx={{ px: 3, py: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1.5 }}>
            <CircularProgress size={24} />
            <Typography color="text.secondary">Loading user queries...</Typography>
          </Box>
        ) : (
          <Box sx={{ px: { xs: 1.5, sm: 2.5 }, pb: 3, pt: 2 }}>
            <Box
              sx={{
                px: 1,
                pb: 2,
                display: 'flex',
                flexWrap: 'wrap',
                gap: 1.5,
                alignItems: 'center',
              }}
            >
              <FormControl size="small" sx={filterControlSx}>
                <InputLabel id="user-query-review-filter-label">Review Status</InputLabel>
                <Select
                  labelId="user-query-review-filter-label"
                  label="Review Status"
                  value={reviewFilter}
                  onChange={(event) => setReviewFilter(event.target.value)}
                >
                  {REVIEW_FILTER_OPTIONS.map((option) => (
                    <MenuItem key={option.value} value={option.value}>
                      {option.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl size="small" sx={filterControlSx}>
                <InputLabel id="user-query-type-filter-label">Query Type</InputLabel>
                <Select
                  labelId="user-query-type-filter-label"
                  label="Query Type"
                  value={typeFilter}
                  onChange={(event) => setTypeFilter(event.target.value)}
                >
                  {TYPE_FILTER_OPTIONS.map((option) => (
                    <MenuItem key={option.value} value={option.value}>
                      {option.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>

            {filteredQueries.length === 0 ? (
              <Typography color="text.secondary" sx={{ px: 1 }}>
                {queries.length === 0 ? 'No user queries submitted yet.' : 'No queries match the selected filters.'}
              </Typography>
            ) : (
              <TableContainer component={Paper} elevation={0} sx={{ overflowX: 'auto', borderRadius: 2 }}>
                <Table sx={{ minWidth: 760 }}>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={headCellSx}>Submitted On</TableCell>
                      <TableCell sx={headCellSx}>Type</TableCell>
                      <TableCell sx={headCellSx}>User Email ID</TableCell>
                      <TableCell sx={headCellSx}>Explanation</TableCell>
                      <TableCell sx={headCellSx}>Reviewed</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredQueries.map((query) => (
                      <TableRow
                        key={query.id}
                        hover
                        onClick={() => setSelectedQuery(query)}
                        sx={{
                          cursor: 'pointer',
                          '&:hover': { backgroundColor: TABLE_ROW_HOVER_BG },
                          '&:last-of-type td': { borderBottom: 0 },
                        }}
                      >
                        <TableCell sx={bodyCellSx}>
                          {formatIndianDateTime(query.submitted_on)}
                        </TableCell>
                        <TableCell sx={bodyCellSx}>{query.type_of_query || '-'}</TableCell>
                        <TableCell sx={{ ...bodyCellSx, wordBreak: 'break-word', maxWidth: 240 }}>
                          {query.user_email_id || '-'}
                        </TableCell>
                        <TableCell sx={{ ...bodyCellSx, whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxWidth: 360 }}>
                          {truncateText(query.explanation)}
                        </TableCell>
                        <TableCell sx={bodyCellSx}>
                          <Chip
                            size="small"
                            label={query.reviewed ? 'Reviewed' : 'Pending'}
                            color={query.reviewed ? 'success' : 'default'}
                            variant={query.reviewed ? 'filled' : 'outlined'}
                          />
                          {query.reviewed_on ? (
                            <Typography sx={{ fontSize: '0.76rem', color: 'text.secondary', mt: 0.6 }}>
                              {formatIndianDateTime(query.reviewed_on)}
                            </Typography>
                          ) : null}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Box>
        )}
      </Paper>

      <Dialog
        open={Boolean(selectedQuery)}
        onClose={() => {
          if (updatingId) return
          setSelectedQuery(null)
        }}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}
      >
        <DialogTitle sx={{ fontWeight: 800 }}>Query Details</DialogTitle>
        <DialogContent dividers sx={{ display: 'grid', gap: 1.5 }}>
          <Box>
            <Typography sx={{ fontSize: '0.78rem', fontWeight: 800, textTransform: 'uppercase', color: 'text.secondary' }}>
              Submitted On
            </Typography>
            <Typography>{selectedQuery ? formatIndianDateTime(selectedQuery.submitted_on) : '-'}</Typography>
          </Box>
          <Box>
            <Typography sx={{ fontSize: '0.78rem', fontWeight: 800, textTransform: 'uppercase', color: 'text.secondary' }}>
              Type
            </Typography>
            <Typography>{selectedQuery?.type_of_query || '-'}</Typography>
          </Box>
          <Box>
            <Typography sx={{ fontSize: '0.78rem', fontWeight: 800, textTransform: 'uppercase', color: 'text.secondary' }}>
              User Email ID
            </Typography>
            <Typography sx={{ wordBreak: 'break-word' }}>{selectedQuery?.user_email_id || '-'}</Typography>
          </Box>
          <Box>
            <Typography sx={{ fontSize: '0.78rem', fontWeight: 800, textTransform: 'uppercase', color: 'text.secondary' }}>
              Explanation
            </Typography>
            <Typography sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.7 }}>
              {selectedQuery?.explanation || '-'}
            </Typography>
          </Box>
          <Box>
            <Typography sx={{ fontSize: '0.78rem', fontWeight: 800, textTransform: 'uppercase', color: 'text.secondary' }}>
              Review Status
            </Typography>
            <Box sx={{ mt: 0.5, display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
              <Chip
                size="small"
                label={selectedQuery?.reviewed ? 'Reviewed' : 'Pending'}
                color={selectedQuery?.reviewed ? 'success' : 'default'}
                variant={selectedQuery?.reviewed ? 'filled' : 'outlined'}
              />
              {selectedQuery?.reviewed_on ? (
                <Typography sx={{ fontSize: '0.84rem', color: 'text.secondary' }}>
                  {formatIndianDateTime(selectedQuery.reviewed_on)}
                </Typography>
              ) : null}
            </Box>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button
            onClick={() => setSelectedQuery(null)}
            disabled={Boolean(updatingId)}
            sx={{ textTransform: 'none' }}
          >
            Close
          </Button>
          {selectedQuery && !selectedQuery.reviewed ? (
            <Button
              variant="contained"
              color="secondary"
              disabled={updatingId === selectedQuery.id}
              onClick={() => handleMarkReviewed(selectedQuery)}
              sx={{ textTransform: 'none', fontWeight: 700 }}
            >
              {updatingId === selectedQuery.id ? 'Updating...' : 'Mark Reviewed'}
            </Button>
          ) : null}
        </DialogActions>
      </Dialog>
    </Box>
  )
}

export default UserQueries
