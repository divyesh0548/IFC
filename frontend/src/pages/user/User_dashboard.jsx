import React, { useEffect, useState } from 'react'
import { useTheme } from '@mui/material/styles'
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import Tooltip from '@mui/material/Tooltip'
import FormControl from '@mui/material/FormControl'
import FormControlLabel from '@mui/material/FormControlLabel'
import Alert from '@mui/material/Alert'
import TextField from '@mui/material/TextField'
import InputLabel from '@mui/material/InputLabel'
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import Switch from '@mui/material/Switch'
import {
  DASHBOARD_PAGE_OUTER_SX,
  DASHBOARD_PAPER_SX,
  FILTER_BOX_MIN_WIDTH,
  PAGE_SUBHEADER_TEXT_SX,
  STATUS_BADGE_PILL_SX,
  TABLE_HEADER_BG,
  TABLE_ROW_HOVER_BG,
  getConclusionBadgeSolidColors,
  getStatusBadgeSolidColors,
} from '../../uiConstants'
import { useSyncGlobalLoading } from '../../contexts/GlobalLoadingContext'
import { apiUrl, API_BASE_URL } from '../../config/api'
import { useBusinessProcesses } from '../../hooks/useBusinessProcesses'

function User_dashboard() {
  const theme = useTheme()
  const [userEmail, setUserEmail] = useState(null)
  const [forms, setForms] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [filterBusinessProcess, setFilterBusinessProcess] = useState('all')
  const [filterFinancialYear, setFilterFinancialYear] = useState('all')
  const [filterUnit, setFilterUnit] = useState('all')
  const [filterConclusion, setFilterConclusion] = useState('all')
  const [controlNumberInput, setControlNumberInput] = useState('')
  const [controlNumberFilter, setControlNumberFilter] = useState('')
  const [conclusionOptions, setConclusionOptions] = useState([])
  const [financialYearOptions, setFinancialYearOptions] = useState([])
  const [unitOptions, setUnitOptions] = useState([])
  const [cellWordWrap, setCellWordWrap] = useState(false)
  const [actionRequiredAlertDismissed, setActionRequiredAlertDismissed] = useState(false)
  const { businessProcessOptions } = useBusinessProcesses()

  useSyncGlobalLoading(loading)

  const extractUniqueFinancialYears = (rows) => {
    return [...new Set(
      (rows || [])
        .map((form) => form.financial_year?.toString().trim())
        .filter((year) => year && year !== '')
    )]
  }

  const formatStatus = (status) => {
    if (status === null || status === undefined) return 'Pending'
    const value = String(status).trim()
    return value ? value.charAt(0).toUpperCase() + value.slice(1) : 'Pending'
  }

  const formatDate = (date) => {
    if (!date) return 'N/A'
    const parsedDate = new Date(date)
    if (Number.isNaN(parsedDate.getTime())) return 'N/A'
    return parsedDate.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
  }

  const formatConclusion = (value) => {
    const normalized = String(value || '').trim()
    if (!normalized) return 'None'
    return normalized.charAt(0).toUpperCase() + normalized.slice(1)
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
          setUserEmail(data.user.email_id)
        }
      } catch (error) {
        console.error('Error fetching user info:', error)
      }
    }

    fetchUserInfo()
  }, [])

  useEffect(() => {
    if (userEmail) {
      fetchForms()
    }
  }, [userEmail, filter, filterBusinessProcess, filterFinancialYear, filterUnit, controlNumberFilter])

  const fetchForms = async () => {
    if (!userEmail) return

    setLoading(true)
    try {
      let url = `${API_BASE_URL}/api/control-forms?control_owner=${encodeURIComponent(userEmail)}&active=true`
      if (filter !== 'all') url += `&status=${encodeURIComponent(filter)}`
      if (filterBusinessProcess !== 'all') url += `&business_process=${encodeURIComponent(filterBusinessProcess)}`
      if (filterFinancialYear !== 'all') url += `&financial_year=${encodeURIComponent(filterFinancialYear)}`
      if (filterUnit !== 'all') url += `&unit_id=${encodeURIComponent(filterUnit)}`
      if (controlNumberFilter) url += `&control_number=${encodeURIComponent(controlNumberFilter)}`

      const response = await fetch(url, {
        method: 'GET',
        credentials: 'include',
      })
      const data = await response.json()

      if (response.ok && data.success) {
        const nextForms = Array.isArray(data.data) ? data.data : []
        const sortedForms = [...nextForms].sort((a, b) => {
          const dateA = a.created_at ? new Date(a.created_at).getTime() : 0
          const dateB = b.created_at ? new Date(b.created_at).getTime() : 0
          return dateB - dateA
        })

        setForms(sortedForms)
        setConclusionOptions(
          [...new Set(nextForms.map((form) => formatConclusion(form.control_design_conclusion)))].sort((a, b) => {
            if (a === 'None') return 1
            if (b === 'None') return -1
            return a.localeCompare(b)
          })
        )

        const latestYears = extractUniqueFinancialYears(nextForms)
        setFinancialYearOptions(latestYears)
        setUnitOptions(
          [...new Map(
            nextForms
              .map((form) => {
                const unitId = String(form.unit_id || '').trim()
                if (!unitId) return null
                return [unitId, { unitId, unitName: String(form.unit_name || form.unit_id || '').trim() || unitId }]
              })
              .filter(Boolean)
          ).values()].sort((a, b) => a.unitName.localeCompare(b.unitName))
        )
      } else {
        console.error('Error fetching forms:', data.message)
        setForms([])
        setConclusionOptions([])
        setFinancialYearOptions([])
        setUnitOptions([])
      }
    } catch (error) {
      console.error('Error fetching forms:', error)
      setForms([])
      setConclusionOptions([])
      setFinancialYearOptions([])
      setUnitOptions([])
    } finally {
      setLoading(false)
    }
  }

  const handleFormClick = (formId) => {
    window.open(`/user/form/${encodeURIComponent(formId)}`, '_blank', 'noopener,noreferrer')
  }

  const handleControlNumberSearchSubmit = (event) => {
    event.preventDefault()
    setControlNumberFilter(controlNumberInput.trim())
  }

  const handleControlNumberSearchClear = () => {
    setControlNumberInput('')
    setControlNumberFilter('')
  }

  const displayedForms = forms.filter((form) => {
    if (filterConclusion === 'all') return true
    return formatConclusion(form.control_design_conclusion) === filterConclusion
  })

  const actionRequiredCount = (forms || []).filter((form) => Boolean(form?.deficiency_action_status)).length

  useEffect(() => {
    if (actionRequiredCount > 0) {
      setActionRequiredAlertDismissed(false)
    }
  }, [actionRequiredCount])

  const truncatedTextSx = {
    display: 'inline-block',
    maxWidth: '100%',
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
  const tooltipSx = {
    bgcolor: theme.palette.mode === 'dark' ? 'rgba(17, 24, 39, 0.96)' : 'rgba(17, 24, 39, 0.92)',
    color: '#ffffff',
    fontSize: '0.75rem',
    lineHeight: 1.4,
    borderRadius: '8px',
    px: 1.25,
    py: 0.75,
    maxWidth: 420,
    boxShadow: '0 8px 20px rgba(15, 23, 42, 0.25)',
  }
  const dataCellSx = (base) => ({
    ...base,
    ...(cellWordWrap
      ? {
          whiteSpace: 'normal',
          wordBreak: 'break-word',
          overflow: 'visible',
          verticalAlign: 'top',
        }
      : {
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }),
  })

  return (
    <Box sx={DASHBOARD_PAGE_OUTER_SX}>
      <Paper
        elevation={3}
        sx={{
          ...DASHBOARD_PAPER_SX,
          p: 3,
          backgroundColor: theme.palette.background.paper,
          borderRadius: 2,
        }}
      >
        {actionRequiredCount > 0 && !actionRequiredAlertDismissed ? (
          <Alert severity="warning" onClose={() => setActionRequiredAlertDismissed(true)} sx={{ mb: 3, alignItems: 'center' }}>
            Action Required - {actionRequiredCount} RACMs are found ineffective
          </Alert>
        ) : null}

        <Box
          sx={{
            display: 'flex',
            flexDirection: { xs: 'column', sm: 'row' },
            justifyContent: 'space-between',
            alignItems: { xs: 'flex-start', sm: 'center' },
            mb: 3,
            gap: 2,
          }}
        >
          <Box>
            <Typography variant="h5" component="h2" sx={{ fontWeight: 700, color: theme.palette.text.primary }}>
              Assigned RACMs
            </Typography>
            <Typography variant="body2" sx={PAGE_SUBHEADER_TEXT_SX}>
              Track your assigned RACMs, filter by status, and open any item to review details.
            </Typography>
          </Box>

          <Box
            sx={{
              display: 'flex',
              flexDirection: { xs: 'column', sm: 'row' },
              gap: 2,
              alignItems: { xs: 'stretch', sm: 'center' },
              width: { xs: '100%', sm: 'auto' },
            }}
          >
            <Box sx={{ minWidth: FILTER_BOX_MIN_WIDTH }}>
              <FormControl variant="outlined" fullWidth size="small">
                <InputLabel id="status-filter-label">Status</InputLabel>
                <Select labelId="status-filter-label" id="status-filter" value={filter} label="Status" onChange={(e) => setFilter(e.target.value)}>
                  <MenuItem value="all">All</MenuItem>
                  <MenuItem value="pending">Pending</MenuItem>
                  <MenuItem value="sent for approval">Sent for Approval</MenuItem>
                  <MenuItem value="approved">Approved</MenuItem>
                  <MenuItem value="rejected">Rejected</MenuItem>
                </Select>
              </FormControl>
            </Box>

            <Box sx={{ minWidth: FILTER_BOX_MIN_WIDTH }}>
              <FormControl variant="outlined" fullWidth size="small">
                <InputLabel id="business-process-filter-label">Business Process</InputLabel>
                <Select labelId="business-process-filter-label" id="business-process-filter" value={filterBusinessProcess} label="Business Process" onChange={(e) => setFilterBusinessProcess(e.target.value)}>
                  <MenuItem value="all">All</MenuItem>
                  {businessProcessOptions.map((option) => (
                    <MenuItem key={option} value={option}>
                      {option}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>

            <Box sx={{ minWidth: FILTER_BOX_MIN_WIDTH }}>
              <FormControl variant="outlined" fullWidth size="small">
                <InputLabel id="financial-year-filter-label">Financial Year</InputLabel>
                <Select labelId="financial-year-filter-label" id="financial-year-filter" value={filterFinancialYear} label="Financial Year" onChange={(e) => setFilterFinancialYear(e.target.value)}>
                  <MenuItem value="all">All</MenuItem>
                  {financialYearOptions.map((option) => (
                    <MenuItem key={option} value={option}>
                      {option}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>

            <Box sx={{ minWidth: FILTER_BOX_MIN_WIDTH }}>
              <FormControl variant="outlined" fullWidth size="small">
                <InputLabel id="unit-filter-label">Unit</InputLabel>
                <Select labelId="unit-filter-label" id="unit-filter" value={filterUnit} label="Unit" onChange={(e) => setFilterUnit(e.target.value)}>
                  <MenuItem value="all">All</MenuItem>
                  {unitOptions.map((option) => (
                    <MenuItem key={option.unitId} value={option.unitId}>
                      {option.unitName}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>

            <Box sx={{ minWidth: FILTER_BOX_MIN_WIDTH }}>
              <FormControl variant="outlined" fullWidth size="small">
                <InputLabel id="conclusion-filter-label">Conclusion</InputLabel>
                <Select labelId="conclusion-filter-label" id="conclusion-filter" value={filterConclusion} label="Conclusion" onChange={(e) => setFilterConclusion(e.target.value)}>
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
        </Box>

        {loading ? (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Typography color="text.secondary">Loading forms...</Typography>
          </Box>
        ) : displayedForms.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Typography color="text.secondary">
              {filter === 'all'
                ? 'No active forms assigned to you.'
                : filter === 'pending'
                  ? 'No pending forms.'
                  : filter === 'sent for approval'
                    ? 'No forms sent for approval.'
                    : filter === 'approved'
                      ? 'No approved forms.'
                      : 'No rejected forms.'}
            </Typography>
          </Box>
        ) : (
          <Box>
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
                  size="small"
                  sx={{
                    minWidth: { xs: '100%', sm: 260 },
                    '& .MuiOutlinedInput-root': {
                      backgroundColor: 'transparent',
                    },
                  }}
                />
                <Button type="submit" variant="contained">
                  Search
                </Button>
                <Button type="button" variant="outlined" onClick={handleControlNumberSearchClear} disabled={!controlNumberInput && !controlNumberFilter}>
                  Clear
                </Button>
              </Box>

              <FormControlLabel
                control={<Switch checked={cellWordWrap} onChange={(e) => setCellWordWrap(e.target.checked)} size="small" color="primary" />}
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

            <Box sx={{ overflowX: 'auto' }}>
              <Box
                component="table"
                sx={{
                  minWidth: '100%',
                  borderCollapse: 'collapse',
                  '& th, & td': {
                    borderBottom: `1px solid ${theme.palette.divider}`,
                  },
                }}
              >
                <Box component="thead" sx={{ backgroundColor: TABLE_HEADER_BG }}>
                  <Box component="tr">
                    <Box component="th" sx={{ px: 3, py: 1.5, textAlign: 'left', fontSize: '0.75rem', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em', color: theme.palette.text.secondary }}>
                      #
                    </Box>
                    <Box component="th" sx={{ px: 3, py: 1.5, textAlign: 'left', fontSize: '0.75rem', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em', color: theme.palette.text.secondary, width: '260px', minWidth: '220px', maxWidth: '300px' }}>
                      Business Process
                    </Box>
                    <Box component="th" sx={{ px: 3, py: 1.5, textAlign: 'left', fontSize: '0.75rem', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em', color: theme.palette.text.secondary, width: '280px', minWidth: '240px', maxWidth: '340px' }}>
                      Sub Process
                    </Box>
                    <Box component="th" sx={{ px: 3, py: 1.5, textAlign: 'left', fontSize: '0.75rem', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em', color: theme.palette.text.secondary, width: '500px', minWidth: '500px', maxWidth: '600px' }}>
                      Description
                    </Box>
                    <Box component="th" sx={{ px: 3, py: 1.5, textAlign: 'left', fontSize: '0.75rem', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em', color: theme.palette.text.secondary }}>
                      Financial Year
                    </Box>
                    <Box component="th" sx={{ px: 3, py: 1.5, textAlign: 'left', fontSize: '0.75rem', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em', color: theme.palette.text.secondary, width: '220px', minWidth: '180px', maxWidth: '240px' }}>
                      Unit
                    </Box>
                    <Box component="th" sx={{ px: 3, py: 1.5, textAlign: 'left', fontSize: '0.75rem', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em', color: theme.palette.text.secondary }}>
                      Status
                    </Box>
                    <Box component="th" sx={{ px: 3, py: 1.5, textAlign: 'left', fontSize: '0.75rem', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em', color: theme.palette.text.secondary, width: '200px', minWidth: '180px', maxWidth: '220px' }}>
                      Conclusion
                    </Box>
                    <Box component="th" sx={{ px: 3, py: 1.5, textAlign: 'left', fontSize: '0.75rem', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em', color: theme.palette.text.secondary }}>
                      Due Date
                    </Box>
                  </Box>
                </Box>
                <Box component="tbody">
                  {displayedForms.map((form, index) => (
                    <Box
                      component="tr"
                      key={form.id}
                      onClick={() => handleFormClick(form.form_id)}
                      sx={{
                        cursor: 'pointer',
                        transition: 'background-color 0.2s',
                        '&:hover': {
                          backgroundColor: TABLE_ROW_HOVER_BG,
                        },
                      }}
                    >
                      <Box component="td" sx={{ px: 3, py: 2, whiteSpace: 'nowrap', fontSize: '0.875rem', fontWeight: 500, color: theme.palette.text.primary }}>
                        {index + 1}
                      </Box>
                      <Box component="td" sx={dataCellSx({ px: 3, py: 2, fontSize: '0.875rem', color: theme.palette.text.primary, width: '260px', minWidth: '220px', maxWidth: '300px' })}>
                        <Tooltip title={form.business_process || 'N/A'} arrow slotProps={{ tooltip: { sx: tooltipSx } }}>
                          <Box component="span" sx={dataCellTextSx}>
                            {form.business_process || 'N/A'}
                          </Box>
                        </Tooltip>
                      </Box>
                      <Box component="td" sx={dataCellSx({ px: 3, py: 2, fontSize: '0.875rem', color: theme.palette.text.primary, width: '280px', minWidth: '240px', maxWidth: '340px' })}>
                        <Tooltip title={form.sub_process || 'N/A'} arrow slotProps={{ tooltip: { sx: tooltipSx } }}>
                          <Box component="span" sx={dataCellTextSx}>
                            {form.sub_process || 'N/A'}
                          </Box>
                        </Tooltip>
                      </Box>
                      <Box component="td" sx={dataCellSx({ px: 3, py: 2, fontSize: '0.875rem', color: theme.palette.text.primary, width: '500px', minWidth: '400px', maxWidth: '600px' })}>
                        <Tooltip title={form.standard_control_description || 'N/A'} arrow slotProps={{ tooltip: { sx: tooltipSx } }}>
                          <Box component="span" sx={dataCellTextSx}>
                            {form.standard_control_description || 'N/A'}
                          </Box>
                        </Tooltip>
                      </Box>
                      <Box component="td" sx={dataCellSx({ px: 3, py: 2, width: '200px', minWidth: '180px', maxWidth: '220px', fontSize: '0.875rem', color: theme.palette.text.primary })}>
                        <Box component="span" sx={dataCellTextSx}>
                          {form.financial_year || 'N/A'}
                        </Box>
                      </Box>
                      <Box component="td" sx={dataCellSx({ px: 3, py: 2, fontSize: '0.875rem', color: theme.palette.text.primary, width: '220px', minWidth: '180px', maxWidth: '240px' })}>
                        <Tooltip title={form.unit_name || form.unit_id || 'N/A'} arrow slotProps={{ tooltip: { sx: tooltipSx } }}>
                          <Box component="span" sx={dataCellTextSx}>
                            {form.unit_name || form.unit_id || 'N/A'}
                          </Box>
                        </Tooltip>
                      </Box>
                      <Box component="td" sx={{ px: 3, py: 2, whiteSpace: 'nowrap' }}>
                        <Chip
                          label={formatStatus(form.status)}
                          size="small"
                          sx={{
                            height: 'auto',
                            py: 0.5,
                            borderRadius: '9999px',
                            backgroundColor: getStatusBadgeSolidColors(form.status).backgroundColor,
                            color: getStatusBadgeSolidColors(form.status).color,
                            fontWeight: 600,
                            '& .MuiChip-label': { px: 1 },
                          }}
                        />
                      </Box>
                      <Box component="td" sx={dataCellSx({ px: 3, py: 2, fontSize: '0.875rem', color: theme.palette.text.primary })}>
                        <Box component="span" sx={{ ...STATUS_BADGE_PILL_SX, ...getConclusionBadgeSolidColors(form.control_design_conclusion) }}>
                          {formatConclusion(form.control_design_conclusion)}
                        </Box>
                      </Box>
                      <Box component="td" sx={dataCellSx({ px: 3, py: 2, fontSize: '0.875rem', color: theme.palette.text.primary })}>
                        <Box component="span" sx={dataCellTextSx}>
                          {formatDate(form.due_date)}
                        </Box>
                      </Box>
                    </Box>
                  ))}
                </Box>
              </Box>
            </Box>
          </Box>
        )}
      </Paper>
    </Box>
  )
}

export default User_dashboard
