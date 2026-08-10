import React, { useEffect, useMemo, useState } from 'react'
import { useTheme } from '@mui/material/styles'
import Box from '@mui/material/Box'
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
import ManagementPageHeader from '../../components/ManagementPageHeader'
import {
  getManagementTableBorderColor,
  getManagementTableContainerSx,
  TABLE_HEADER_BG,
  TABLE_ROW_HOVER_BG,
} from '../../uiConstants'

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

  const tableBorderColor = getManagementTableBorderColor(theme)
  const bodyCellSx = {
    py: 1.55,
    px: 2.25,
    borderBottom: `1px solid ${tableBorderColor}`,
    verticalAlign: 'top',
    fontSize: '0.92rem',
  }
  const headCellSx = {
    ...bodyCellSx,
    py: 1.7,
    fontSize: '0.84rem',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    color: 'text.secondary',
    backgroundColor: TABLE_HEADER_BG,
  }
  const filterControlSx = { minWidth: { xs: '100%', sm: 200 } }

  return (
    <>
      <ManagementPageHeader
        title="User Queries"
        subtitle="Review website issues and suggestions submitted by users across the platform."
        actions={
          <>
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
          </>
        }
      >
        {error ? <Alert severity="error" sx={{ borderRadius: 0, mb: 2 }}>{error}</Alert> : null}

        {loading ? (
          <Box sx={{ py: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1.5 }}>
            <CircularProgress size={24} />
            <Typography color="text.secondary">Loading user queries...</Typography>
          </Box>
        ) : filteredQueries.length === 0 ? (
          <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
            {queries.length === 0 ? 'No user queries submitted yet.' : 'No queries match the selected filters.'}
          </Typography>
        ) : (
          <TableContainer component={Box} sx={getManagementTableContainerSx(theme)}>
            <Table size="medium" sx={{ minWidth: 760, borderCollapse: 'separate', borderSpacing: 0 }}>
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
                {filteredQueries.map((query, index) => (
                  <TableRow
                    key={query.id}
                    hover
                    onClick={() => setSelectedQuery(query)}
                    sx={{
                      cursor: 'pointer',
                      '&:hover': { backgroundColor: TABLE_ROW_HOVER_BG },
                      '&:last-of-type td': { borderBottom: 0 },
                      '& td': {
                        borderBottom:
                          index === filteredQueries.length - 1 ? 0 : `1px solid ${tableBorderColor}`,
                      },
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
      </ManagementPageHeader>

      <Dialog
        open={Boolean(selectedQuery)}
        onClose={() => {
          if (updatingId) return
          setSelectedQuery(null)
        }}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: 2.5, overflow: 'hidden' } }}
      >
        <DialogTitle
          sx={{
            px: 3,
            pt: 2.5,
            pb: 2,
            borderBottom: '1px solid',
            borderColor: 'divider',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2 }}>
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={{ fontWeight: 800, fontSize: '1.2rem', lineHeight: 1.3 }}>
                Query Details
              </Typography>
              <Typography sx={{ mt: 0.5, color: 'text.secondary', fontSize: '0.875rem' }}>
                {selectedQuery ? formatIndianDateTime(selectedQuery.submitted_on) : '-'}
              </Typography>
            </Box>
            <Chip
              size="small"
              label={selectedQuery?.reviewed ? 'Reviewed' : 'Pending'}
              color={selectedQuery?.reviewed ? 'success' : 'default'}
              variant={selectedQuery?.reviewed ? 'filled' : 'outlined'}
              sx={{ flexShrink: 0, mt: 0.25 }}
            />
          </Box>
        </DialogTitle>
        <DialogContent sx={{ px: 3, py: 2.5, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
              gap: 1.5,
            }}
          >
            <Box
              sx={{
                p: 1.75,
                borderRadius: 1.5,
                border: '1px solid',
                borderColor: 'divider',
                backgroundColor: 'action.hover',
              }}
            >
              <Typography sx={{ fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'text.secondary', mb: 0.75 }}>
                Type
              </Typography>
              <Typography sx={{ fontWeight: 600, lineHeight: 1.4 }}>
                {selectedQuery?.type_of_query || '-'}
              </Typography>
            </Box>
            <Box
              sx={{
                p: 1.75,
                borderRadius: 1.5,
                border: '1px solid',
                borderColor: 'divider',
                backgroundColor: 'action.hover',
              }}
            >
              <Typography sx={{ fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'text.secondary', mb: 0.75 }}>
                User Email ID
              </Typography>
              <Typography sx={{ fontWeight: 600, lineHeight: 1.4, wordBreak: 'break-word' }}>
                {selectedQuery?.user_email_id || '-'}
              </Typography>
            </Box>
          </Box>

          <Box
            sx={{
              p: 2,
              borderRadius: 1.5,
              border: '1px solid',
              borderColor: 'divider',
            }}
          >
            <Typography sx={{ fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'text.secondary', mb: 1 }}>
              Explanation
            </Typography>
            <Typography sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.7 }}>
              {selectedQuery?.explanation || '-'}
            </Typography>
          </Box>

          {selectedQuery?.reviewed_on ? (
            <Typography sx={{ fontSize: '0.84rem', color: 'text.secondary' }}>
              Reviewed on {formatIndianDateTime(selectedQuery.reviewed_on)}
            </Typography>
          ) : null}
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2, borderTop: '1px solid', borderColor: 'divider', gap: 1.25 }}>
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
    </>
  )
}

export default UserQueries
