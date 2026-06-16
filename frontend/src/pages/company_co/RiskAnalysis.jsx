import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import FormControl from '@mui/material/FormControl'
import InputLabel from '@mui/material/InputLabel'
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import Alert from '@mui/material/Alert'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Tooltip from '@mui/material/Tooltip'
import ArrowOutwardRoundedIcon from '@mui/icons-material/ArrowOutwardRounded'
import { useTheme } from '@mui/material/styles'
import { apiUrl } from '../../config/api'
import { useSyncGlobalLoading } from '../../contexts/GlobalLoadingContext'
import { DASHBOARD_PAGE_OUTER_SX, DASHBOARD_PAPER_SX, PAGE_SUBHEADER_TEXT_SX, FILTER_DROPDOWN_MIN_WIDTH_SM } from '../../uiConstants'
import { getFieldValue } from './dashboardClassificationUtils'
import { toast } from 'react-hot-toast'

function formatServerErrorToast(errorCode) {
  const normalizedErrorCode = String(errorCode || '').trim() || 'UNKNOWN_ERROR'
  return `Error occured on server (${normalizedErrorCode})`
}

const DETAIL_FIELD_VALUE_SX = {
  color: 'text.secondary',
  lineHeight: 1.6,
}

const TABLE_TEXT_TRUNCATE_SX = {
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
}

const INSIGHT_CARD_LABEL_SX = {
  fontWeight: 700,
  color: 'text.primary',
  mb: 0.75,
}

const TABLE_GRID_COLUMNS = '220px 300px minmax(340px, 1fr)'

function RiskAnalysis() {
  const theme = useTheme()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState([])
  const [financialYearOptions, setFinancialYearOptions] = useState([])
  const [filterBusinessProcess, setFilterBusinessProcess] = useState('all')
  const [filterFinancialYear, setFilterFinancialYear] = useState('all')
  const [errorMessage, setErrorMessage] = useState('')
  const [selectedControl, setSelectedControl] = useState(null)
  const [analysisDialogOpen, setAnalysisDialogOpen] = useState(false)
  const [analysisLoading, setAnalysisLoading] = useState(false)
  const [analysisGenerating, setAnalysisGenerating] = useState(false)
  const [analysisData, setAnalysisData] = useState(null)
  useSyncGlobalLoading(loading)

  useEffect(() => {
    let cancelled = false

    const fetchData = async () => {
      setLoading(true)
      setErrorMessage('')

      try {
        const [filtersResponse, racmsResponse] = await Promise.all([
          fetch(apiUrl('/api/company-co/dashboard/filters'), {
            credentials: 'include',
          }),
          fetch(apiUrl('/api/company-co/dashboard/racms'), {
            credentials: 'include',
          }),
        ])

        const [filtersData, racmsData] = await Promise.all([
          filtersResponse.json(),
          racmsResponse.json(),
        ])

        if (!filtersResponse.ok || !filtersData?.success) {
          throw new Error(filtersData?.message || 'Failed to fetch risk-analysis filters')
        }

        if (!racmsResponse.ok || !racmsData?.success) {
          throw new Error(racmsData?.message || 'Failed to fetch risk-analysis controls')
        }

        if (!cancelled) {
          setFinancialYearOptions(Array.isArray(filtersData.data?.financialYears) ? filtersData.data.financialYears : [])
          setRows(Array.isArray(racmsData.data) ? racmsData.data : [])
        }
      } catch (error) {
        console.error('Error fetching risk analysis data:', error)
        if (!cancelled) {
          setFinancialYearOptions([])
          setRows([])
          setErrorMessage(error.message || 'Failed to load risk analysis data')
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    fetchData()

    return () => {
      cancelled = true
    }
  }, [])

  const businessProcessOptions = useMemo(() => (
    [...new Set(
      (rows || [])
        .map((row) => String(getFieldValue(row, 'business_process', 'businessProcess') || '').trim())
        .filter(Boolean)
    )].sort((left, right) => left.localeCompare(right))
  ), [rows])

  const filteredRows = useMemo(() => (
    (rows || []).filter((row) => {
      const businessProcess = String(getFieldValue(row, 'business_process', 'businessProcess') || '').trim()
      const financialYear = String(getFieldValue(row, 'financial_year', 'financialYear') || '').trim()

      if (filterBusinessProcess !== 'all' && businessProcess !== filterBusinessProcess) {
        return false
      }

      if (filterFinancialYear !== 'all' && financialYear !== filterFinancialYear) {
        return false
      }

      return true
    })
  ), [filterBusinessProcess, filterFinancialYear, rows])

  const handleOpenAnalysisDialog = async (row) => {
    const controlNumber = String(getFieldValue(row, 'control_number', 'controlNumber') || '').trim()
    if (!controlNumber) return

    setSelectedControl(row)
    setAnalysisDialogOpen(true)
    setAnalysisLoading(true)
    setAnalysisData(null)

    try {
      const response = await fetch(apiUrl(`/api/company-co/risk-analysis/control/${encodeURIComponent(controlNumber)}`), {
        credentials: 'include',
      })
      const data = await response.json()

      if (!response.ok || !data?.success) {
        throw new Error(data?.message || 'Failed to fetch risk analysis')
      }

      setAnalysisData(data.data || null)
    } catch (error) {
      console.error('Error fetching stored risk analysis:', error)
      toast.error(error.message || 'Failed to fetch risk analysis')
    } finally {
      setAnalysisLoading(false)
    }
  }

  const handleGenerateAnalysis = async () => {
    const controlNumber = String(getFieldValue(selectedControl, 'control_number', 'controlNumber') || '').trim()
    if (!controlNumber) return

    setAnalysisGenerating(true)
    try {
      const response = await fetch(apiUrl(`/api/company-co/risk-analysis/control/${encodeURIComponent(controlNumber)}/generate`), {
        method: 'POST',
        credentials: 'include',
      })
      const data = await response.json()

      if (!response.ok || !data?.success) {
        const error = new Error(data?.message || 'Failed to generate risk analysis')
        error.serverCode = String(data?.code || '').trim()
        throw error
      }

      setAnalysisData((prev) => ({
        control: prev?.control || {
          form_id: getFieldValue(selectedControl, 'form_id', 'formId'),
          company_identifier: '',
          business_process: String(getFieldValue(selectedControl, 'business_process', 'businessProcess') || '').trim(),
          sub_process: String(getFieldValue(selectedControl, 'sub_process', 'subProcess') || '').trim(),
          risk_description: String(getFieldValue(selectedControl, 'risk_description', 'riskDescription') || '').trim(),
          control_objective: '',
          standard_control_description: '',
          control_number: controlNumber,
        },
        analysis: data.data?.analysis || null,
      }))
      toast.success('Risk analysis generated successfully.')
    } catch (error) {
      console.error('Error generating risk analysis:', error)
      toast.error(formatServerErrorToast(error?.serverCode))
    } finally {
      setAnalysisGenerating(false)
    }
  }

  const handleCloseDialog = () => {
    if (analysisGenerating) return
    setAnalysisDialogOpen(false)
    setSelectedControl(null)
    setAnalysisLoading(false)
    setAnalysisData(null)
  }

  const handleOpenControlInNewWindow = () => {
    const normalizedFormId = String(
      analysisData?.control?.form_id || getFieldValue(selectedControl, 'form_id', 'formId') || ''
    ).trim()

    if (!normalizedFormId) {
      toast.error('Form ID is not available for this control')
      return
    }

    window.open(`/company_co/form/${encodeURIComponent(normalizedFormId)}`, '_blank', 'noopener,noreferrer')
  }

  const renderAnalysisResponse = () => {
    const response = analysisData?.analysis?.response_json
    if (!response) {
      return (
        <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>
          No stored risk analysis exists for this control. Generate risk analysis for this control.
        </Typography>
      )
    }

    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        <Box
          sx={{
            p: 2,
            borderRadius: 2,
            border: `1px solid ${theme.palette.divider}`,
            backgroundColor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.02)' : theme.palette.common.white,
          }}
        >
          <Typography variant="body2" sx={INSIGHT_CARD_LABEL_SX}>
            Matched Sub-Process
          </Typography>
          <Typography variant="body2" sx={DETAIL_FIELD_VALUE_SX}>
            {response.matchedSubProcess || 'N/A'}
          </Typography>
        </Box>

        <Box
          sx={{
            p: 2,
            borderRadius: 2,
            border: `1px solid ${theme.palette.divider}`,
            backgroundColor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.02)' : theme.palette.common.white,
          }}
        >
          <Typography variant="body2" sx={INSIGHT_CARD_LABEL_SX}>
            Missing Risks
          </Typography>
          {Array.isArray(response.missingRiskPointers) && response.missingRiskPointers.length > 0 ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {response.missingRiskPointers.map((item, index) => (
                <Box
                  key={`${item.risk}-${index}`}
                  sx={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 1.25,
                  }}
                >
                  <Typography
                    variant="body2"
                    component="span"
                    sx={{
                      flexShrink: 0,
                      minWidth: '1.5rem',
                      fontWeight: 700,
                      color: theme.palette.text.primary,
                      lineHeight: 1.6,
                    }}
                  >
                    {index + 1}.
                  </Typography>
                  <Typography
                    variant="body2"
                    component="span"
                    sx={{ color: theme.palette.text.primary, lineHeight: 1.6 }}
                  >
                    {item.pointer}
                  </Typography>
                </Box>
              ))}
            </Box>
          ) : (
            <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>
              No missing-risk pointers returned.
            </Typography>
          )}
        </Box>
      </Box>
    )
  }

  return (
    <Box sx={DASHBOARD_PAGE_OUTER_SX}>
      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', md: 'row' },
          alignItems: { xs: 'flex-start', md: 'flex-start' },
          justifyContent: 'space-between',
          gap: 2,
          mb: 3,
          pb: 2.5,
          borderBottom: `1px solid ${theme.palette.divider}`,
        }}
      >
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800, color: theme.palette.text.primary }}>
            Risk Analysis
          </Typography>
          <Typography variant="body2" sx={PAGE_SUBHEADER_TEXT_SX}>
            Review control risks by business process and financial year.
          </Typography>
        </Box>
        <Button variant="contained" onClick={() => navigate('/company_co/dashboard')}>
          Back To Dashboard
        </Button>
      </Box>

      {errorMessage ? (
        <Alert severity="info" sx={{ mb: 3 }}>
          {errorMessage}
        </Alert>
      ) : null}

      <Paper
        elevation={3}
        sx={{
          ...DASHBOARD_PAPER_SX,
          borderRadius: 3,
          overflow: 'hidden',
          border: `1px solid ${theme.palette.divider}`,
          boxShadow: theme.palette.mode === 'dark'
            ? '0 10px 28px rgba(0, 0, 0, 0.28)'
            : '0 12px 30px rgba(15, 23, 42, 0.08)',
        }}
      >
        <Box
          sx={{
            px: 3,
            pt: 3,
            pb: 2,
            borderBottom: `1px solid ${theme.palette.divider}`,
          }}
        >
          <Box
            sx={{
              display: 'flex',
              alignItems: { xs: 'flex-start', sm: 'center' },
              justifyContent: 'space-between',
              gap: 2,
              flexWrap: 'wrap',
            }}
          >
            <Typography variant="h6" sx={{ fontWeight: 700, color: theme.palette.text.primary }}>
              Controls Risk Analysis
            </Typography>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1.25,
                flexWrap: 'wrap',
                ml: { xs: 0, sm: 'auto' },
              }}
            >
              <FormControl size="small" variant="outlined" sx={{ minWidth: FILTER_DROPDOWN_MIN_WIDTH_SM }}>
                <InputLabel id="risk-analysis-business-process-label">Business Process</InputLabel>
                <Select
                  labelId="risk-analysis-business-process-label"
                  value={filterBusinessProcess}
                  label="Business Process"
                  onChange={(event) => setFilterBusinessProcess(event.target.value)}
                >
                  <MenuItem value="all">All</MenuItem>
                  {businessProcessOptions.map((option) => (
                    <MenuItem key={option} value={option}>
                      {option}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <FormControl size="small" variant="outlined" sx={{ minWidth: FILTER_DROPDOWN_MIN_WIDTH_SM }}>
                <InputLabel id="risk-analysis-financial-year-label">Financial Year</InputLabel>
                <Select
                  labelId="risk-analysis-financial-year-label"
                  value={filterFinancialYear}
                  label="Financial Year"
                  onChange={(event) => setFilterFinancialYear(event.target.value)}
                >
                  <MenuItem value="all">All</MenuItem>
                  {financialYearOptions.map((option) => (
                    <MenuItem key={option} value={option}>
                      {option}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>
          </Box>
          <Typography variant="body2" sx={{ mt: 0.75, color: theme.palette.text.secondary }}>
            Showing {filteredRows.length} controls for the selected filters.
          </Typography>
        </Box>

        <Box sx={{ width: '100%', overflowX: 'auto' }}>
          <Box sx={{ minWidth: 900 }}>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: TABLE_GRID_COLUMNS,
                borderBottom: `1px solid ${theme.palette.divider}`,
                backgroundColor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.03)' : theme.palette.grey[100],
              }}
            >
              {['Control Number', 'Sub Process', 'Risk Description'].map((column) => (
                <Box
                  key={column}
                  sx={{
                    px: 2,
                    py: 1.75,
                    borderRight: `1px solid ${theme.palette.divider}`,
                    '&:last-of-type': {
                      borderRight: 'none',
                    },
                  }}
                >
                  <Typography variant="body2" sx={{ fontWeight: 700, color: theme.palette.text.primary }}>
                    {column}
                  </Typography>
                </Box>
              ))}
            </Box>

            {loading ? (
              <Box sx={{ px: 3, py: 4 }}>
                <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>
                  Loading risk analysis controls...
                </Typography>
              </Box>
            ) : filteredRows.length === 0 ? (
              <Box sx={{ px: 3, py: 4 }}>
                <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>
                  No controls found for the selected business process and financial year.
                </Typography>
              </Box>
            ) : (
              filteredRows.map((row, index) => (
                <Box
                  key={String(getFieldValue(row, 'form_id', 'formId') || getFieldValue(row, 'control_number', 'controlNumber') || index)}
                  component="button"
                  type="button"
                  onClick={() => handleOpenAnalysisDialog(row)}
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: TABLE_GRID_COLUMNS,
                    borderBottom: index === filteredRows.length - 1 ? 'none' : `1px solid ${theme.palette.divider}`,
                    backgroundColor: index % 2 === 0
                      ? 'transparent'
                      : theme.palette.mode === 'dark'
                        ? 'rgba(255,255,255,0.02)'
                        : theme.palette.grey[50],
                    borderLeft: 'none',
                    borderRight: 'none',
                    borderTop: 'none',
                    width: '100%',
                    textAlign: 'left',
                    font: 'inherit',
                    cursor: 'pointer',
                    '&:hover': {
                      backgroundColor: theme.palette.mode === 'dark' ? 'rgba(59,130,246,0.10)' : 'rgba(59,130,246,0.05)',
                    },
                  }}
                >
                  <Box sx={{ px: 2, py: 1.75, borderRight: `1px solid ${theme.palette.divider}` }}>
                    <Tooltip
                      title={String(getFieldValue(row, 'control_number', 'controlNumber') || '').trim() || 'Unassigned'}
                      arrow
                    >
                      <Typography
                        variant="body2"
                        sx={{ color: theme.palette.text.primary, fontWeight: 600, ...TABLE_TEXT_TRUNCATE_SX }}
                      >
                        {String(getFieldValue(row, 'control_number', 'controlNumber') || '').trim() || 'Unassigned'}
                      </Typography>
                    </Tooltip>
                  </Box>
                  <Box sx={{ px: 2, py: 1.75, borderRight: `1px solid ${theme.palette.divider}` }}>
                    <Tooltip
                      title={String(getFieldValue(row, 'sub_process', 'subProcess') || '').trim() || 'Unassigned'}
                      arrow
                    >
                      <Typography
                        variant="body2"
                        sx={{ color: theme.palette.text.primary, fontWeight: 500, ...TABLE_TEXT_TRUNCATE_SX }}
                      >
                        {String(getFieldValue(row, 'sub_process', 'subProcess') || '').trim() || 'Unassigned'}
                      </Typography>
                    </Tooltip>
                  </Box>
                  <Box sx={{ px: 2, py: 1.75 }}>
                    <Tooltip
                      title={String(getFieldValue(row, 'risk_description', 'riskDescription') || '').trim() || 'Not available'}
                      arrow
                    >
                      <Typography
                        variant="body2"
                        sx={{ color: theme.palette.text.primary, fontWeight: 500, ...TABLE_TEXT_TRUNCATE_SX }}
                      >
                        {String(getFieldValue(row, 'risk_description', 'riskDescription') || '').trim() || 'Not available'}
                      </Typography>
                    </Tooltip>
                  </Box>
                </Box>
              ))
            )}
          </Box>
        </Box>
      </Paper>

      <Dialog
        open={analysisDialogOpen}
        onClose={handleCloseDialog}
        fullWidth
        maxWidth="md"
      >
        <DialogTitle
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 1,
          }}
        >
          <Typography variant="h6" sx={{ fontWeight: 700, color: theme.palette.text.primary }}>
            Risk Analysis
          </Typography>
          <Button
            size="small"
            variant="text"
            onClick={handleOpenControlInNewWindow}
            endIcon={<ArrowOutwardRoundedIcon sx={{ fontSize: 16 }} />}
            sx={{
              fontSize: theme.typography.body2.fontSize,
              whiteSpace: 'nowrap',
            }}
          >
            Open RACM
          </Button>
        </DialogTitle>
        <DialogContent dividers>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            <Box
              sx={{
                display: 'flex',
                alignItems: { xs: 'flex-start', sm: 'center' },
                justifyContent: 'space-between',
                gap: 1,
                flexDirection: { xs: 'column', sm: 'row' },
              }}
            >
              <Typography variant="subtitle1" sx={{ fontWeight: 700, color: theme.palette.text.primary }}>
                AI Generated Insights
              </Typography>
              {analysisData?.analysis?.response_json ? (
                <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>
                  Confidence: {analysisData.analysis.response_json.matchConfidence || 'N/A'}
                </Typography>
              ) : null}
            </Box>
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                gap: 1.5,
              }}
            >
              {analysisLoading ? (
                <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>
                  Loading stored risk analysis...
                </Typography>
              ) : renderAnalysisResponse()}
            </Box>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={handleCloseDialog} disabled={analysisGenerating}>
            Close
          </Button>
          <Button
            variant="contained"
            color="secondary"
            onClick={handleGenerateAnalysis}
            disabled={analysisLoading || analysisGenerating || !selectedControl}
          >
            {analysisGenerating ? 'Generating…' : 'Generate Risk Analysis'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

export default RiskAnalysis
