import React, { useState, useEffect } from 'react'
import { useTheme } from '@mui/material/styles'
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import FormControl from '@mui/material/FormControl'
import FormControlLabel from '@mui/material/FormControlLabel'
import InputLabel from '@mui/material/InputLabel'
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import Switch from '@mui/material/Switch'
import Badge from '@mui/material/Badge'
import Button from '@mui/material/Button'
import TextField from '@mui/material/TextField'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import TablePagination from '@mui/material/TablePagination'
import InsertDriveFileRoundedIcon from '@mui/icons-material/InsertDriveFileRounded'
import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded'
import FolderOpenRoundedIcon from '@mui/icons-material/FolderOpenRounded'
import { toast } from 'react-hot-toast'
import {
  DASHBOARD_PAGE_OUTER_SX,
  DASHBOARD_PAPER_SX,
  DASHBOARD_TABLE_WRAP_SX,
  FILTER_DROPDOWN_MIN_WIDTH_LG,
  PAGE_SUBHEADER_TEXT_SX,
  TABLE_HEADER_BG,
  TABLE_ROW_HOVER_BG,
} from '../../uiConstants'
import { useSyncGlobalLoading } from '../../contexts/GlobalLoadingContext'
import { apiUrl, API_BASE_URL } from '../../config/api'
import { useBusinessProcesses } from '../../hooks/useBusinessProcesses'
import { formatIndianDateTime } from '../../lib/dateTime'
import { formatRacmUserDocumentSubtitle } from '../../lib/racmUserDocuments'
import { getRacmProcessOwnerDisplayValue } from '../../racmFormDetailFields'

const DEFAULT_ROWS_PER_PAGE = 10
const ROWS_PER_PAGE_OPTIONS = [10, 25, 50]

function getFileName(filePath) {
  const raw = String(filePath || '').trim()
  if (!raw) return 'Document'
  const withoutQuery = raw.split('?')[0]
  const segments = withoutQuery.split('/')
  return segments[segments.length - 1] || 'Document'
}

function getUserDocCount(form) {
  return Array.isArray(form?.doc_uploaded_by_user_docs) ? form.doc_uploaded_by_user_docs.length : 0
}

function RacmUserDocuments() {
  const theme = useTheme()
  const [companyIdentifier, setCompanyIdentifier] = useState(null)
  const [forms, setForms] = useState([])
  const [page, setPage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(DEFAULT_ROWS_PER_PAGE)
  const [totalCount, setTotalCount] = useState(0)
  const [filterActive, setFilterActive] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterBusinessProcess, setFilterBusinessProcess] = useState('all')
  const [filterFinancialYear, setFilterFinancialYear] = useState('all')
  const [filterUnit, setFilterUnit] = useState('all')
  const [filterConclusion, setFilterConclusion] = useState('all')
  const [conclusionOptions, setConclusionOptions] = useState([])
  const [coordinatorUnits, setCoordinatorUnits] = useState([])
  const [financialYearOptions, setFinancialYearOptions] = useState([])
  const [cellWordWrap, setCellWordWrap] = useState(false)
  const [controlNumberInput, setControlNumberInput] = useState('')
  const [controlNumberFilter, setControlNumberFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [docsDialogOpen, setDocsDialogOpen] = useState(false)
  const [selectedForm, setSelectedForm] = useState(null)
  const { businessProcessOptions } = useBusinessProcesses()

  useSyncGlobalLoading(loading)

  const showUnitColumn = coordinatorUnits.length > 1
  const showUnitFilter = coordinatorUnits.length > 1

  const getFinancialYearStorageKey = (companyId) => `ifc_financial_year_options_${companyId}`

  const extractUniqueFinancialYears = (rows) =>
    [...new Set(
      (rows || [])
        .map((form) => form.financial_year?.toString().trim())
        .filter((year) => year && year !== '')
    )]

  const getFormUnitName = (form) => {
    const unitName = String(form?.unit_name || '').trim()
    if (unitName) return unitName
    const unitId = String(form?.unit_id || '').trim()
    const mappedUnit = coordinatorUnits.find((unit) => String(unit.unit_id || '').trim() === unitId)
    return mappedUnit?.unit_name || unitId || 'N/A'
  }

  const formatProcessOwner = (form) => getRacmProcessOwnerDisplayValue(form)

  const handleControlNumberSearchSubmit = (event) => {
    event.preventDefault()
    setControlNumberFilter(controlNumberInput.trim())
    setPage(0)
  }

  const handleControlNumberSearchClear = () => {
    setControlNumberInput('')
    setControlNumberFilter('')
    setPage(0)
  }

  const handleFormClick = (formId) => {
    if (!formId) return
    window.open(`/company_co/form/${encodeURIComponent(formId)}`, '_blank', 'noopener,noreferrer')
  }

  const filterFormControlSx = {
    flex: { xs: '1 1 100%', sm: '1 1 0' },
    minWidth: { xs: '100%', sm: 110 },
    maxWidth: { xs: '100%', sm: FILTER_DROPDOWN_MIN_WIDTH_LG },
    width: { xs: '100%', sm: 'auto' },
    '& .MuiOutlinedInput-root': {
      width: '100%',
      backgroundColor: 'transparent',
      '& fieldset': {
        borderColor: theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.23)' : '#d1d5db',
      },
      '&:hover fieldset': {
        borderColor: theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.3)' : '#9ca3af',
      },
      '&.Mui-focused fieldset': {
        borderColor: theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.3)' : '#9ca3af',
      },
    },
    '& .MuiInputLabel-root': {
      color: theme.palette.text.primary,
    },
    '& .MuiSelect-root': {
      color: theme.palette.text.primary,
    },
    '& .MuiSelect-select': {
      overflow: 'hidden',
      textOverflow: 'ellipsis',
    },
  }

  const truncatedTextSx = {
    display: 'block',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  }
  const wrappedTextSx = {
    display: 'block',
    maxWidth: '100%',
    whiteSpace: 'normal',
    wordBreak: 'break-word',
    overflow: 'visible',
  }
  const dataCellTextSx = cellWordWrap ? wrappedTextSx : truncatedTextSx
  const dataCellSx = (base) => ({
    ...base,
    ...(cellWordWrap
      ? {
          whiteSpace: 'normal',
          wordBreak: 'break-word',
          overflow: 'visible',
          textOverflow: 'clip',
          verticalAlign: 'top',
        }
      : {
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }),
  })

  const buildFormsListUrl = () => {
    const params = new URLSearchParams({
      company_identifier: companyIdentifier,
      page: String(page + 1),
      page_size: String(rowsPerPage),
      active_or_valid_assignment: 'true',
    })

    if (filterActive === 'active') {
      params.set('active', 'true')
    } else if (filterActive === 'inactive') {
      params.set('active', 'false')
    }

    if (filterStatus !== 'all') {
      params.set('status', filterStatus === 'Pending' ? 'pending' : filterStatus.toLowerCase())
    }

    if (filterBusinessProcess !== 'all') {
      params.set('business_process', filterBusinessProcess)
    }

    if (filterFinancialYear !== 'all') {
      params.set('financial_year', filterFinancialYear)
    }

    if (filterUnit !== 'all') {
      params.set('unit_id', filterUnit)
    }

    if (filterConclusion !== 'all') {
      params.set('conclusion', filterConclusion)
    }

    if (controlNumberFilter) {
      params.set('control_number', controlNumberFilter)
    }

    return `${API_BASE_URL}/api/control-forms?${params.toString()}`
  }

  const loadFinancialYearOptions = async (companyId) => {
    const storageKey = getFinancialYearStorageKey(companyId)
    try {
      const cached = localStorage.getItem(storageKey)
      if (cached) {
        const parsed = JSON.parse(cached)
        if (Array.isArray(parsed) && parsed.length > 0) {
          setFinancialYearOptions(parsed)
          return
        }
      }
    } catch (error) {
      console.error('Error reading financial year options from localStorage:', error)
    }

    try {
      const url = `${API_BASE_URL}/api/control-forms?company_identifier=${encodeURIComponent(companyId)}`
      const response = await fetch(url, {
        method: 'GET',
        credentials: 'include',
      })
      const data = await response.json()
      if (response.ok && data.success) {
        const years = extractUniqueFinancialYears(data.data)
        setFinancialYearOptions(years)
        localStorage.setItem(storageKey, JSON.stringify(years))
      }
    } catch (error) {
      console.error('Error bootstrapping financial year options:', error)
    }
  }

  const fetchCoordinatorUnits = async () => {
    try {
      const response = await fetch(apiUrl('/api/company-co/unit-management'), {
        method: 'GET',
        credentials: 'include',
      })
      const data = await response.json()

      if (response.ok && data.success) {
        const assignedUnits = Array.isArray(data.data?.currentCoordinatorUnits)
          ? data.data.currentCoordinatorUnits
          : []
        setCoordinatorUnits(assignedUnits)
        setFilterUnit((current) => {
          if (current === 'all') return current
          return assignedUnits.some((unit) => unit.unit_id === current) ? current : 'all'
        })
      } else {
        setCoordinatorUnits([])
      }
    } catch (error) {
      console.error('Error fetching coordinator units:', error)
      setCoordinatorUnits([])
    }
  }

  const fetchForms = async () => {
    if (!companyIdentifier) return

    setLoading(true)
    try {
      const response = await fetch(buildFormsListUrl(), {
        method: 'GET',
        credentials: 'include',
      })
      const data = await response.json()

      if (response.ok && data.success) {
        const nextForms = Array.isArray(data.data) ? data.data : []
        const nextTotal = Number(data.count || 0)
        const nextPage = Math.max(0, Number(data.page || 1) - 1)

        if (nextTotal > 0 && nextForms.length === 0 && nextPage > 0) {
          setPage(nextPage - 1)
          return
        }

        setForms(nextForms)
        setTotalCount(nextTotal)
        setConclusionOptions(
          Array.isArray(data.summary?.conclusion_options) ? data.summary.conclusion_options : []
        )

        const latestYears = extractUniqueFinancialYears(nextForms)
        if (latestYears.length > 0) {
          const mergedYears = [...new Set([...(financialYearOptions || []), ...latestYears])]
          if (mergedYears.length !== financialYearOptions.length) {
            setFinancialYearOptions(mergedYears)
            localStorage.setItem(getFinancialYearStorageKey(companyIdentifier), JSON.stringify(mergedYears))
          }
        }
      } else {
        setForms([])
        setTotalCount(0)
      }
    } catch (error) {
      console.error('Error fetching forms:', error)
      setForms([])
      setTotalCount(0)
    } finally {
      setLoading(false)
    }
  }

  const handleDownloadUserDocument = async (filePath) => {
    if (!filePath) return

    try {
      const fileName = getFileName(filePath)
      const response = await fetch(
        `${API_BASE_URL}/api/control-forms/download-document?path=${encodeURIComponent(filePath)}`,
        {
          method: 'GET',
          credentials: 'include',
        }
      )

      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const anchor = document.createElement('a')
        anchor.href = url
        anchor.download = fileName
        document.body.appendChild(anchor)
        anchor.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(anchor)
        return
      }

      let errorMessage = 'Failed to download user document'
      try {
        const errorData = await response.json()
        errorMessage = errorData.message || errorData.error || errorMessage
      } catch (parseError) {
        errorMessage = `Download failed with status ${response.status}`
      }
      toast.error(errorMessage)
    } catch (error) {
      console.error('Error downloading user document:', error)
      toast.error(`Error downloading user document: ${error.message}`)
    }
  }

  const handleOpenDocsDialog = (form) => {
    setSelectedForm(form)
    setDocsDialogOpen(true)
  }

  const handleCloseDocsDialog = () => {
    setDocsDialogOpen(false)
    setSelectedForm(null)
  }

  useEffect(() => {
    const fetchUserInfo = async () => {
      try {
        const response = await fetch(apiUrl('/api/auth/verify'), {
          method: 'GET',
          credentials: 'include',
        })
        const data = await response.json()
        if (response.ok && data.success) {
          setCompanyIdentifier(data.user.company_identifier)
        }
      } catch (error) {
        console.error('Error fetching user info:', error)
      }
    }

    fetchUserInfo()
  }, [])

  useEffect(() => {
    if (!companyIdentifier) return
    loadFinancialYearOptions(companyIdentifier)
    fetchCoordinatorUnits()
  }, [companyIdentifier])

  useEffect(() => {
    if (companyIdentifier) {
      fetchForms()
    }
  }, [
    companyIdentifier,
    filterActive,
    filterStatus,
    filterBusinessProcess,
    filterFinancialYear,
    filterUnit,
    filterConclusion,
    controlNumberFilter,
    page,
    rowsPerPage,
  ])

  const selectedUserDocs = Array.isArray(selectedForm?.doc_uploaded_by_user_docs)
    ? selectedForm.doc_uploaded_by_user_docs
    : []
  const selectedUserDocCount = selectedUserDocs.length
  const tableColumnCount = showUnitColumn ? 7 : 6
  const showEmptyState = !loading && forms.length === 0
  const DOC_TABLE_COL_PX = {
    controlNumber: 100,
    businessProcess: 140,
    standardControl: 260,
    unit: 90,
    financialYear: 100,
    processOwner: 150,
    userDocuments: 120,
  }
  const docTableColWidthsOrdered = [
    DOC_TABLE_COL_PX.controlNumber,
    DOC_TABLE_COL_PX.businessProcess,
    DOC_TABLE_COL_PX.standardControl,
    ...(showUnitColumn ? [DOC_TABLE_COL_PX.unit] : []),
    DOC_TABLE_COL_PX.financialYear,
    DOC_TABLE_COL_PX.processOwner,
    DOC_TABLE_COL_PX.userDocuments,
  ]
  const docTableTotalWidthPx = docTableColWidthsOrdered.reduce((a, b) => a + b, 0)
  const pctColSx = (px) => {
    const pct = (100 * px) / docTableTotalWidthPx
    const s = `${pct}%`
    return {
      width: s,
      minWidth: s,
      maxWidth: s,
      boxSizing: 'border-box',
    }
  }

  const renderTableBody = () => {
    if (loading) {
      return (
        <Box component="tr">
          <Box
            component="td"
            colSpan={tableColumnCount}
            sx={{
              px: 2.5,
              py: 6,
              textAlign: 'center',
              color: 'text.secondary',
              fontSize: '0.875rem',
            }}
          >
            Loading RACMs...
          </Box>
        </Box>
      )
    }

    if (showEmptyState) {
      return (
        <Box component="tr">
          <Box
            component="td"
            colSpan={tableColumnCount}
            sx={{
              px: 2.5,
              py: 6,
              textAlign: 'center',
              color: 'text.secondary',
              fontSize: '0.875rem',
            }}
          >
            {controlNumberFilter
              ? 'No RACMs match the control number search.'
              : 'No active or valid-assignment RACMs found.'}
          </Box>
        </Box>
      )
    }

    return forms.map((form) => {
      const userDocCount = getUserDocCount(form)
      return (
        <Box
          component="tr"
          key={form.form_id || form.id}
          onClick={() => handleFormClick(form.form_id)}
          sx={{
            cursor: 'pointer',
            transition: 'background-color 0.2s',
            '&:hover': {
              backgroundColor: TABLE_ROW_HOVER_BG,
            },
          }}
        >
          <Box
            component="td"
            sx={dataCellSx({
              px: 2.5,
              py: 2,
              fontSize: '0.875rem',
              fontWeight: 600,
              color: theme.palette.text.primary,
              ...pctColSx(DOC_TABLE_COL_PX.controlNumber),
            })}
          >
            <Box component="span" sx={dataCellTextSx}>
              {form.control_number || form.form_id || 'N/A'}
            </Box>
          </Box>
          <Box
            component="td"
            sx={dataCellSx({
              px: 2.5,
              py: 2,
              fontSize: '0.875rem',
              color: theme.palette.text.primary,
              ...pctColSx(DOC_TABLE_COL_PX.businessProcess),
            })}
          >
            <Box component="span" sx={dataCellTextSx}>
              {form.business_process || 'N/A'}
            </Box>
          </Box>
          <Box
            component="td"
            sx={dataCellSx({
              px: 2.5,
              py: 2,
              fontSize: '0.875rem',
              color: theme.palette.text.primary,
              ...pctColSx(DOC_TABLE_COL_PX.standardControl),
            })}
          >
            <Tooltip title={form.standard_control_description || 'N/A'} arrow>
              <Box component="span" sx={dataCellTextSx}>
                {form.standard_control_description || 'N/A'}
              </Box>
            </Tooltip>
          </Box>
          {showUnitColumn && (
            <Box
              component="td"
              sx={dataCellSx({
                px: 2.5,
                py: 2,
                fontSize: '0.875rem',
                color: theme.palette.text.primary,
                ...pctColSx(DOC_TABLE_COL_PX.unit),
              })}
            >
              <Box component="span" sx={dataCellTextSx}>
                {getFormUnitName(form)}
              </Box>
            </Box>
          )}
          <Box
            component="td"
            sx={dataCellSx({
              px: 2.5,
              py: 2,
              fontSize: '0.875rem',
              color: theme.palette.text.primary,
              ...pctColSx(DOC_TABLE_COL_PX.financialYear),
            })}
          >
            <Box component="span" sx={dataCellTextSx}>
              {form.financial_year || 'N/A'}
            </Box>
          </Box>
          <Box
            component="td"
            sx={dataCellSx({
              px: 2.5,
              py: 2,
              fontSize: '0.875rem',
              color: theme.palette.text.primary,
              ...pctColSx(DOC_TABLE_COL_PX.processOwner),
            })}
          >
            <Tooltip title={formatProcessOwner(form)} arrow>
              <Box component="span" sx={dataCellTextSx}>
                {formatProcessOwner(form)}
              </Box>
            </Tooltip>
          </Box>
          <Box
            component="td"
            sx={{
              px: 2.5,
              py: 2,
              textAlign: 'center',
              ...pctColSx(DOC_TABLE_COL_PX.userDocuments),
            }}
          >
            <Tooltip
              title={
                userDocCount > 0
                  ? 'View uploaded documents'
                  : 'No user documents uploaded'
              }
            >
              <span>
                <Badge
                  badgeContent={userDocCount}
                  color="secondary"
                  showZero
                  overlap="circular"
                  sx={{
                    '& .MuiBadge-badge': {
                      fontWeight: 700,
                    },
                  }}
                >
                  <IconButton
                    size="small"
                    color={userDocCount > 0 ? 'secondary' : 'default'}
                    onClick={(event) => {
                      event.stopPropagation()
                      handleOpenDocsDialog(form)
                    }}
                    aria-label={`View ${userDocCount} user document(s)`}
                    disabled={userDocCount === 0}
                  >
                    <FolderOpenRoundedIcon fontSize="small" />
                  </IconButton>
                </Badge>
              </span>
            </Tooltip>
          </Box>
        </Box>
      )
    })
  }

  return (
    <Box sx={DASHBOARD_PAGE_OUTER_SX}>
      <Paper
        elevation={0}
        sx={{
          ...DASHBOARD_PAPER_SX,
          p: { xs: 2, sm: 3 },
          borderRadius: 2,
          border: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Box
          sx={{
            display: 'flex',
            flexDirection: { xs: 'column', lg: 'row' },
            justifyContent: 'space-between',
            alignItems: { xs: 'stretch', lg: 'flex-start' },
            gap: 2,
            mb: 3,
            minWidth: 0,
          }}
        >
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, flexShrink: 0 }}>
            <Typography variant="h5" component="h2" sx={{ fontWeight: 700 }}>
              RACM Document Uploads
            </Typography>
            <Typography sx={PAGE_SUBHEADER_TEXT_SX}>
              View user-uploaded documents for assigned RACMs.
            </Typography>
          </Box>

          <Box
            sx={{
              display: 'flex',
              flexDirection: { xs: 'column', sm: 'row' },
              gap: 2,
              alignItems: { xs: 'stretch', sm: 'flex-start' },
              width: '100%',
              flex: { lg: '1 1 0' },
              minWidth: 0,
              flexWrap: { xs: 'wrap', sm: 'nowrap' },
              justifyContent: { sm: 'flex-end' },
            }}
          >
            {showUnitFilter && (
              <FormControl variant="outlined" sx={filterFormControlSx}>
                <InputLabel id="unit-filter-label">Unit</InputLabel>
                <Select
                  labelId="unit-filter-label"
                  value={filterUnit}
                  label="Unit"
                  onChange={(e) => {
                    setFilterUnit(e.target.value)
                    setPage(0)
                  }}
                >
                  <MenuItem value="all">All</MenuItem>
                  {coordinatorUnits.map((unit) => (
                    <MenuItem key={unit.unit_id || unit.id} value={unit.unit_id}>
                      {unit.unit_name || unit.unit_id}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}

            <FormControl variant="outlined" sx={filterFormControlSx}>
              <InputLabel id="business-process-filter-label">Business Process</InputLabel>
              <Select
                labelId="business-process-filter-label"
                value={filterBusinessProcess}
                label="Business Process"
                onChange={(e) => {
                  setFilterBusinessProcess(e.target.value)
                  setPage(0)
                }}
              >
                <MenuItem value="all">All</MenuItem>
                {businessProcessOptions.map((option) => (
                  <MenuItem key={option} value={option}>
                    {option}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl variant="outlined" sx={filterFormControlSx}>
              <InputLabel id="financial-year-filter-label">Financial Year</InputLabel>
              <Select
                labelId="financial-year-filter-label"
                value={filterFinancialYear}
                label="Financial Year"
                onChange={(e) => {
                  setFilterFinancialYear(e.target.value)
                  setPage(0)
                }}
              >
                <MenuItem value="all">All</MenuItem>
                {financialYearOptions.map((option) => (
                  <MenuItem key={option} value={option}>
                    {option}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl variant="outlined" sx={filterFormControlSx}>
              <InputLabel id="activity-filter-label">Activity</InputLabel>
              <Select
                labelId="activity-filter-label"
                value={filterActive}
                label="Activity"
                onChange={(e) => {
                  setFilterActive(e.target.value)
                  setPage(0)
                }}
              >
                <MenuItem value="all">All</MenuItem>
                <MenuItem value="active">Active</MenuItem>
                <MenuItem value="inactive">Inactive</MenuItem>
              </Select>
            </FormControl>

            <FormControl variant="outlined" sx={filterFormControlSx}>
              <InputLabel id="status-filter-label">Status</InputLabel>
              <Select
                labelId="status-filter-label"
                value={filterStatus}
                label="Status"
                onChange={(e) => {
                  setFilterStatus(e.target.value)
                  setPage(0)
                }}
              >
                <MenuItem value="all">All</MenuItem>
                <MenuItem value="Approved">Approved</MenuItem>
                <MenuItem value="Rejected">Rejected</MenuItem>
                <MenuItem value="Pending">Pending</MenuItem>
              </Select>
            </FormControl>

            <FormControl variant="outlined" sx={filterFormControlSx}>
              <InputLabel id="conclusion-filter-label">Conclusion</InputLabel>
              <Select
                labelId="conclusion-filter-label"
                value={filterConclusion}
                label="Conclusion"
                onChange={(e) => {
                  setFilterConclusion(e.target.value)
                  setPage(0)
                }}
              >
                <MenuItem value="all">All</MenuItem>
                {conclusionOptions.map((option) => (
                  <MenuItem key={option} value={option}>
                    {option}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
        </Box>

        <Box sx={{ width: '100%', minWidth: 0 }}>
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              mb: 1.5,
              flexWrap: 'wrap',
              gap: 1,
            }}
          >
            <Box
              component="form"
              onSubmit={handleControlNumberSearchSubmit}
              sx={{
                display: 'flex',
                flexDirection: { xs: 'column', sm: 'row' },
                gap: 1,
                alignItems: { xs: 'stretch', sm: 'center' },
              }}
            >
              <TextField
                label="Control Number"
                value={controlNumberInput}
                onChange={(e) => setControlNumberInput(e.target.value)}
                disabled={loading}
                size="small"
                sx={{
                  minWidth: { xs: '100%', sm: 260 },
                  '& .MuiOutlinedInput-root': {
                    backgroundColor: 'transparent',
                  },
                }}
              />
              <Button type="submit" variant="contained" disabled={loading}>
                Search
              </Button>
              <Button
                type="button"
                variant="outlined"
                onClick={handleControlNumberSearchClear}
                disabled={loading || (!controlNumberInput && !controlNumberFilter)}
              >
                Clear
              </Button>
            </Box>
            <FormControlLabel
              control={
                <Switch
                  checked={cellWordWrap}
                  onChange={(e) => setCellWordWrap(e.target.checked)}
                  size="small"
                  color="primary"
                  disabled={loading}
                />
              }
              label="Word wrap"
              sx={{
                mr: 0,
                userSelect: 'none',
                '& .MuiFormControlLabel-label': {
                  fontSize: '0.8125rem',
                  color: theme.palette.text.secondary,
                },
              }}
            />
          </Box>

          <Box sx={DASHBOARD_TABLE_WRAP_SX}>
            <Box
              component="table"
              sx={{
                width: '100%',
                tableLayout: 'fixed',
                borderCollapse: 'collapse',
                '& th, & td': {
                  borderBottom: `1px solid ${theme.palette.divider}`,
                },
              }}
            >
              <Box component="colgroup">
                {docTableColWidthsOrdered.map((w, i) => (
                  <Box key={i} component="col" sx={pctColSx(w)} />
                ))}
              </Box>
              <Box component="thead" sx={{ backgroundColor: TABLE_HEADER_BG }}>
                <Box component="tr">
                  <Box
                    component="th"
                    sx={{
                      px: 2.5,
                      py: 1.5,
                      textAlign: 'left',
                      fontSize: '0.75rem',
                      fontWeight: 500,
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      color: theme.palette.text.secondary,
                      ...pctColSx(DOC_TABLE_COL_PX.controlNumber),
                    }}
                  >
                    Control Number
                  </Box>
                  <Box
                    component="th"
                    sx={{
                      px: 2.5,
                      py: 1.5,
                      textAlign: 'left',
                      fontSize: '0.75rem',
                      fontWeight: 500,
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      color: theme.palette.text.secondary,
                      ...pctColSx(DOC_TABLE_COL_PX.businessProcess),
                    }}
                  >
                    Business Process
                  </Box>
                  <Box
                    component="th"
                    sx={{
                      px: 2.5,
                      py: 1.5,
                      textAlign: 'left',
                      fontSize: '0.75rem',
                      fontWeight: 500,
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      color: theme.palette.text.secondary,
                      ...pctColSx(DOC_TABLE_COL_PX.standardControl),
                    }}
                  >
                    Standard Control Description
                  </Box>
                  {showUnitColumn && (
                    <Box
                      component="th"
                      sx={{
                        px: 2.5,
                        py: 1.5,
                        textAlign: 'left',
                        fontSize: '0.75rem',
                        fontWeight: 500,
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        color: theme.palette.text.secondary,
                        ...pctColSx(DOC_TABLE_COL_PX.unit),
                      }}
                    >
                      Unit
                    </Box>
                  )}
                  <Box
                    component="th"
                    sx={{
                      px: 2.5,
                      py: 1.5,
                      textAlign: 'left',
                      fontSize: '0.75rem',
                      fontWeight: 500,
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      color: theme.palette.text.secondary,
                      ...pctColSx(DOC_TABLE_COL_PX.financialYear),
                    }}
                  >
                    Financial Year
                  </Box>
                  <Box
                    component="th"
                    sx={{
                      px: 2.5,
                      py: 1.5,
                      textAlign: 'left',
                      fontSize: '0.75rem',
                      fontWeight: 500,
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      color: theme.palette.text.secondary,
                      ...pctColSx(DOC_TABLE_COL_PX.processOwner),
                    }}
                  >
                    Process Owner
                  </Box>
                  <Box
                    component="th"
                    sx={{
                      px: 2.5,
                      py: 1.5,
                      textAlign: 'center',
                      fontSize: '0.75rem',
                      fontWeight: 500,
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      color: theme.palette.text.secondary,
                      ...pctColSx(DOC_TABLE_COL_PX.userDocuments),
                    }}
                  >
                    User Documents
                  </Box>
                </Box>
              </Box>

              <Box component="tbody">{renderTableBody()}</Box>
            </Box>
          </Box>

          <TablePagination
            component="div"
            count={totalCount}
            page={page}
            onPageChange={(_, newPage) => setPage(newPage)}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={(event) => {
              setRowsPerPage(parseInt(event.target.value, 10))
              setPage(0)
            }}
            rowsPerPageOptions={ROWS_PER_PAGE_OPTIONS}
            disabled={loading}
            sx={{
              borderTop: `1px solid ${theme.palette.divider}`,
              mt: 0.5,
              '& .MuiTablePagination-toolbar': {
                px: { xs: 0.5, sm: 1 },
              },
            }}
          />
        </Box>
      </Paper>

      <Dialog
        open={docsDialogOpen}
        onClose={handleCloseDocsDialog}
        fullWidth
        maxWidth="md"
        aria-labelledby="racm-user-documents-dialog-title"
      >
        <DialogTitle id="racm-user-documents-dialog-title" sx={{ fontWeight: 700 }}>
          User Documents ({selectedUserDocCount})
        </DialogTitle>
        <DialogContent dividers>
          {selectedForm ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mb: 2 }}>
              <Typography variant="body2" color="text.secondary">
                <strong>Control Number:</strong> {selectedForm.control_number || selectedForm.form_id || 'N/A'}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                <strong>Business Process:</strong> {selectedForm.business_process || 'N/A'}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                <strong>Process Owner:</strong> {formatProcessOwner(selectedForm)}
              </Typography>
            </Box>
          ) : null}

          {selectedUserDocs.length > 0 ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
              {selectedUserDocs.map((doc, index) => {
                const docPath = doc.doc_uploaded_by_user
                return (
                  <Box
                    key={doc.id || `${docPath}-${index}`}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1.5,
                      p: 1.5,
                      border: '1px solid',
                      borderColor: 'divider',
                      borderRadius: 1,
                    }}
                  >
                    <InsertDriveFileRoundedIcon color="action" />
                    <Box sx={{ minWidth: 0, flex: 1 }}>
                      <Typography
                        variant="body2"
                        sx={{
                          fontWeight: 600,
                          color: 'text.primary',
                          overflowWrap: 'anywhere',
                        }}
                      >
                        {getFileName(docPath)}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {formatRacmUserDocumentSubtitle(
                          doc,
                          (value) => formatIndianDateTime(value, 'Uploaded document')
                        )}
                      </Typography>
                    </Box>
                    <Tooltip title="Download">
                      <IconButton
                        size="small"
                        onClick={() => handleDownloadUserDocument(docPath)}
                        aria-label={`Download ${getFileName(docPath)}`}
                      >
                        <DownloadRoundedIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Box>
                )
              })}
            </Box>
          ) : (
            <Typography variant="body2" color="text.secondary">
              No user uploaded documents available.
            </Typography>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={handleCloseDocsDialog}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

export default RacmUserDocuments
