import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTheme } from '@mui/material/styles'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import CircularProgress from '@mui/material/CircularProgress'
import FormControl from '@mui/material/FormControl'
import InputLabel from '@mui/material/InputLabel'
import MenuItem from '@mui/material/MenuItem'
import Select from '@mui/material/Select'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import TablePagination from '@mui/material/TablePagination'
import Typography from '@mui/material/Typography'
import CloudUploadIcon from '@mui/icons-material/CloudUpload'
import ManagementPageHeader from '../../components/ManagementPageHeader'
import { apiUrl } from '../../config/api'
import { useSyncGlobalLoading } from '../../contexts/GlobalLoadingContext'
import {
  getManagementTableBorderColor,
  getManagementTableContainerSx,
  TABLE_HEADER_BG,
  TABLE_ROW_HOVER_BG,
} from '../../uiConstants'

const DEFAULT_ROWS_PER_PAGE = 10
const ROWS_PER_PAGE_OPTIONS = [10, 25, 50]

function truncateText(value, maxLength = 100) {
  const text = String(value || '').trim()
  if (!text) return '—'
  if (text.length <= maxLength) return text
  return `${text.slice(0, maxLength).trimEnd()}…`
}

function ControlsLibrary() {
  const theme = useTheme()
  const navigate = useNavigate()
  const [controls, setControls] = useState([])
  const [totalCount, setTotalCount] = useState(0)
  const [page, setPage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(DEFAULT_ROWS_PER_PAGE)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [businessProcessFilter, setBusinessProcessFilter] = useState('all')
  const [subProcessFilter, setSubProcessFilter] = useState('all')
  const [subProcessOptions, setSubProcessOptions] = useState([])
  const [subProcessesLoading, setSubProcessesLoading] = useState(false)

  useSyncGlobalLoading(loading || subProcessesLoading)

  const fetchControls = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams()
      params.set('page', String(page + 1))
      params.set('page_size', String(rowsPerPage))
      if (businessProcessFilter !== 'all') {
        params.set('business_process', businessProcessFilter)
      }
      if (businessProcessFilter !== 'all' && subProcessFilter !== 'all') {
        params.set('sub_process', subProcessFilter)
      }

      const query = params.toString()
      const response = await fetch(
        apiUrl(`/api/siteadmin/controls-library?${query}`),
        { credentials: 'include' }
      )
      const data = await response.json()

      if (response.ok && data.success) {
        const nextControls = Array.isArray(data.data) ? data.data : []
        const nextTotal = Number(data.count || 0)
        const lastValidPage = Math.max(0, Math.ceil(nextTotal / rowsPerPage) - 1)

        if (nextTotal > 0 && nextControls.length === 0 && page > lastValidPage) {
          setPage(lastValidPage)
          return
        }

        setControls(nextControls)
        setTotalCount(nextTotal)
      } else {
        setControls([])
        setTotalCount(0)
        setError(data.message || 'Failed to fetch controls library')
      }
    } catch (fetchError) {
      console.error('Fetch controls library error:', fetchError)
      setControls([])
      setTotalCount(0)
      setError('Network error while fetching controls library')
    } finally {
      setLoading(false)
    }
  }, [businessProcessFilter, subProcessFilter, page, rowsPerPage])

  useEffect(() => {
    fetchControls()
  }, [fetchControls])

  useEffect(() => {
    let cancelled = false

    const fetchSubProcesses = async () => {
      if (businessProcessFilter === 'all') {
        setSubProcessOptions([])
        return
      }

      setSubProcessesLoading(true)
      try {
        const response = await fetch(
          apiUrl(
            `/api/siteadmin/controls-library/sub-processes?business_process=${encodeURIComponent(businessProcessFilter)}`
          ),
          { credentials: 'include' }
        )
        const data = await response.json()
        if (cancelled) return

        if (response.ok && data.success) {
          setSubProcessOptions(Array.isArray(data.data) ? data.data : [])
        } else {
          setSubProcessOptions([])
        }
      } catch (fetchError) {
        console.error('Fetch sub-processes error:', fetchError)
        if (!cancelled) setSubProcessOptions([])
      } finally {
        if (!cancelled) setSubProcessesLoading(false)
      }
    }

    fetchSubProcesses()
    return () => {
      cancelled = true
    }
  }, [businessProcessFilter])

  const businessProcessOptions = useMemo(() => {
    const names = new Set()
    controls.forEach((row) => {
      const name = String(row.business_process || '').trim()
      if (name) names.add(name)
    })
    if (businessProcessFilter !== 'all') {
      names.add(businessProcessFilter)
    }
    return [...names].sort((a, b) => a.localeCompare(b))
  }, [controls, businessProcessFilter])

  // When filtering by BP, options come from API; also seed from current rows for all-view BP dropdown.
  const [allBusinessProcesses, setAllBusinessProcesses] = useState([])

  useEffect(() => {
    let cancelled = false
    const loadAllBusinessProcesses = async () => {
      try {
        const response = await fetch(apiUrl('/api/siteadmin/controls-library/summary'), {
          credentials: 'include',
        })
        const data = await response.json()
        if (cancelled) return
        if (response.ok && data.success) {
          setAllBusinessProcesses(
            (Array.isArray(data.data) ? data.data : [])
              .map((row) => String(row.business_process || '').trim())
              .filter(Boolean)
              .sort((a, b) => a.localeCompare(b))
          )
        }
      } catch (err) {
        console.error('Fetch controls library summary error:', err)
      }
    }
    loadAllBusinessProcesses()
    return () => {
      cancelled = true
    }
  }, [])

  const bpFilterOptions = allBusinessProcesses.length > 0
    ? allBusinessProcesses
    : businessProcessOptions

  const sortedControls = useMemo(
    () => [...controls].sort((a, b) => Number(a.id) - Number(b.id)),
    [controls]
  )

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
  const filterControlSx = { minWidth: { xs: '100%', sm: 220 } }

  return (
    <ManagementPageHeader
      title="Controls Library"
      subtitle="Browse uploaded controls. Filter by business process and sub-process, then open a row to edit."
      actions={
        <>
          <FormControl size="small" sx={filterControlSx}>
            <InputLabel id="controls-library-bp-filter-label">Business Process</InputLabel>
            <Select
              labelId="controls-library-bp-filter-label"
              label="Business Process"
              value={businessProcessFilter}
              onChange={(event) => {
                setBusinessProcessFilter(event.target.value)
                setSubProcessFilter('all')
                setPage(0)
              }}
            >
              <MenuItem value="all">All</MenuItem>
              {bpFilterOptions.map((option) => (
                <MenuItem key={option} value={option}>
                  {option}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl
            size="small"
            sx={filterControlSx}
            disabled={businessProcessFilter === 'all'}
          >
            <InputLabel id="controls-library-sp-filter-label">Sub-Process</InputLabel>
            <Select
              labelId="controls-library-sp-filter-label"
              label="Sub-Process"
              value={subProcessFilter}
              onChange={(event) => {
                setSubProcessFilter(event.target.value)
                setPage(0)
              }}
            >
              <MenuItem value="all">All</MenuItem>
              {subProcessOptions.map((option) => (
                <MenuItem key={option} value={option}>
                  {option}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <Button
            variant="contained"
            color="secondary"
            startIcon={<CloudUploadIcon />}
            onClick={() => navigate('/siteadmin/controls-library/upload')}
            sx={{ textTransform: 'none', fontWeight: 700 }}
          >
            Upload Excel
          </Button>
        </>
      }
    >
      {error ? <Alert severity="error" sx={{ borderRadius: 0, mb: 2 }}>{error}</Alert> : null}

      {loading ? (
        <Box sx={{ py: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1.5 }}>
          <CircularProgress size={24} />
          <Typography color="text.secondary">Loading controls library...</Typography>
        </Box>
      ) : totalCount === 0 ? (
        <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
          No controls found. Upload an Excel file to populate the library.
        </Typography>
      ) : (
        <>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
            Showing {totalCount} control{totalCount === 1 ? '' : 's'}
            {businessProcessFilter !== 'all' ? ` for ${businessProcessFilter}` : ''}
            {subProcessFilter !== 'all' ? ` / ${subProcessFilter}` : ''}
            . Click a row to edit.
          </Typography>
          <TableContainer sx={getManagementTableContainerSx(theme)}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ ...headCellSx, width: 72 }}>ID</TableCell>
                  <TableCell sx={{ ...headCellSx, minWidth: 120, width: '10%' }}>Business Process</TableCell>
                  <TableCell sx={headCellSx}>Sub-Process</TableCell>
                  <TableCell sx={headCellSx}>Risk Description</TableCell>
                  <TableCell sx={headCellSx}>Standard Control Description</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {sortedControls.map((row) => (
                  <TableRow
                    key={row.id}
                    hover
                    onClick={() => window.open(`/siteadmin/controls-library/${row.id}`, '_blank', 'noopener,noreferrer')}
                    sx={{
                      cursor: 'pointer',
                      '&:hover': { backgroundColor: TABLE_ROW_HOVER_BG },
                    }}
                  >
                    <TableCell sx={{ ...bodyCellSx, width: 72 }}>{row.id}</TableCell>
                    <TableCell sx={{ ...bodyCellSx, minWidth: 120, width: '10%' }}>{row.business_process || '—'}</TableCell>
                    <TableCell sx={bodyCellSx}>{truncateText(row.sub_process, 80)}</TableCell>
                    <TableCell sx={bodyCellSx}>{truncateText(row.risk_description, 120)}</TableCell>
                    <TableCell sx={bodyCellSx}>{truncateText(row.standard_control_description, 100)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          <TablePagination
            component="div"
            count={totalCount}
            page={page}
            onPageChange={(_event, newPage) => setPage(newPage)}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={(event) => {
              setRowsPerPage(parseInt(event.target.value, 10))
              setPage(0)
            }}
            rowsPerPageOptions={ROWS_PER_PAGE_OPTIONS}
            sx={{
              borderTop: `1px solid ${theme.palette.divider}`,
              mt: 0.5,
              '& .MuiTablePagination-toolbar': {
                px: { xs: 0.5, sm: 1 },
              },
            }}
          />
        </>
      )}
    </ManagementPageHeader>
  )
}

export default ControlsLibrary
