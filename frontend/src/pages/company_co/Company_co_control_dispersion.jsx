import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTheme } from '@mui/material/styles'
import Button from '@mui/material/Button'
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import Alert from '@mui/material/Alert'
import Link from '@mui/material/Link'
import FormControl from '@mui/material/FormControl'
import InputLabel from '@mui/material/InputLabel'
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import { PieChart } from '@mui/x-charts/PieChart'
import {
  DASHBOARD_PAGE_OUTER_SX,
  DASHBOARD_PAPER_SX,
  FILTER_DROPDOWN_MIN_WIDTH_LG,
  PAGE_SUBHEADER_TEXT_SX,
  toRacmApprovalStatusQueryParam,
} from '../../uiConstants'
import { useSyncGlobalLoading } from '../../contexts/GlobalLoadingContext'
import { useAuth } from '../../contexts/AuthContext'
import { apiUrl } from '../../config/api'
import {
  normalizeValue,
  getFieldValue,
  classifyNatureOfControl,
  classifyControlType,
  isKeyControlValue,
  isNonKeyControlValue,
  matchesDashboardFilters,
  countUnclassifiedControls,
} from './dashboardClassificationUtils'

const EMPTY_STATS = {
  totalRacms: 0,
  keyControls: 0,
  nonKeyControls: 0,
  keyNotClassified: 0,
  keyUnclassifiedValues: [],
  preventive: 0,
  detective: 0,
  corrective: 0,
  natureNotClassified: 0,
  natureUnclassifiedValues: [],
  manual: 0,
  automated: 0,
  semiAutomated: 0,
  typeNotClassified: 0,
  typeUnclassifiedValues: [],
}

const PIE_CHART_SIZE = 260
const PIE_CHART_INNER_RADIUS = 0
const PIE_CHART_OUTER_RADIUS = 120
const SUMMARY_COLUMN_MIN_WIDTH = 112
const SUMMARY_PROCESS_COLUMN_MIN_WIDTH = 260
const HIGH_RISK_COLUMN_INDEX = 10

const formatProcessName = (value) => {
  const normalized = String(value || '').trim()
  return normalized || 'Unassigned'
}

const createBusinessProcessSummaryRows = (forms, futureFilters = {}) => {
  const activeFilters = futureFilters

  return (forms || []).reduce((rows, form) => {
    if (!matchesDashboardFilters(form, activeFilters)) {
      return rows
    }

    const businessProcess = formatProcessName(getFieldValue(form, 'business_process', 'businessProcess'))
    const row = rows.get(businessProcess) || {
      businessProcess,
      totalRacms: 0,
      keyControls: 0,
      nonKeyControls: 0,
      preventive: 0,
      detective: 0,
      corrective: 0,
      manual: 0,
      automated: 0,
      semiAutomated: 0,
      highRiskNonAutomated: 0,
    }

    const keyControl = normalizeValue(getFieldValue(form, 'key_control', 'keyControl'))
    const natureOfControl = classifyNatureOfControl(getFieldValue(form, 'nature_of_control', 'natureOfControl'))
    const controlType = classifyControlType(getFieldValue(form, 'control_type_ma', 'controlTypeMa'))
    const riskHeat = normalizeValue(getFieldValue(form, 'risk_heat', 'riskHeat'))

    row.totalRacms += 1

    if (isKeyControlValue(keyControl)) {
      row.keyControls += 1
    } else if (isNonKeyControlValue(keyControl)) {
      row.nonKeyControls += 1
    }

    if (natureOfControl === 'preventive') {
      row.preventive += 1
    } else if (natureOfControl === 'detective') {
      row.detective += 1
    } else if (natureOfControl === 'corrective') {
      row.corrective += 1
    }

    if (controlType === 'manual') {
      row.manual += 1
      if (riskHeat === 'high') {
        row.highRiskNonAutomated += 1
      }
    } else if (controlType === 'automated') {
      row.automated += 1
    } else if (controlType === 'semiAutomated') {
      row.semiAutomated += 1
      if (riskHeat === 'high') {
        row.highRiskNonAutomated += 1
      }
    }

    rows.set(businessProcess, row)
    return rows
  }, new Map())
}

const calculatePercentage = (value, total) => {
  if (total <= 0) {
    return 0
  }

  return Math.round((Number(value || 0) / total) * 100)
}

const countControlsByCombination = (forms, filters = {}) =>
  (forms || []).reduce((counts, form) => {
    if (!matchesDashboardFilters(form, filters)) {
      return counts
    }

    const keyControl = normalizeValue(getFieldValue(form, 'key_control', 'keyControl'))
    const controlType = classifyControlType(getFieldValue(form, 'control_type_ma', 'controlTypeMa'))
    const riskHeat = normalizeValue(getFieldValue(form, 'risk_heat', 'riskHeat'))
    const isKey = isKeyControlValue(keyControl)
    const isHighRisk = riskHeat.includes('high')

    if (isKey && controlType === 'manual') {
      counts.keyManual += 1

      if (isHighRisk) {
        counts.highKeyManual += 1
      }
    }

    if (isKey && controlType === 'automated') {
      counts.keyAutomated += 1
    }

    return counts
  }, {
    keyManual: 0,
    keyAutomated: 0,
    highKeyManual: 0,
  })

function ControlDispersionDashboard() {
  const theme = useTheme()
  const navigate = useNavigate()
  const { companyIdentifier } = useAuth()
  const [dashboardStats, setDashboardStats] = useState(EMPTY_STATS)
  const [filterActive, setFilterActive] = useState('all')
  const [filterBusinessProcess, setFilterBusinessProcess] = useState('all')
  const [filterFinancialYear, setFilterFinancialYear] = useState('all')
  const [filterApprovalStatus, setFilterApprovalStatus] = useState('all')
  const [filterUnit, setFilterUnit] = useState('all')
  const [filterConclusion, setFilterConclusion] = useState('all')
  const [conclusionOptions, setConclusionOptions] = useState([])
  const [financialYearOptions, setFinancialYearOptions] = useState([])
  const [mappedUnits, setMappedUnits] = useState([])
  const [unclassifiedAlertDismissed, setUnclassifiedAlertDismissed] = useState(false)
  const [loading, setLoading] = useState(true)
  const [chartStatsLoading, setChartStatsLoading] = useState(true)
  const [businessProcessSummaryLoading, setBusinessProcessSummaryLoading] = useState(true)
  const [allRacms, setAllRacms] = useState([])
  useSyncGlobalLoading(loading || chartStatsLoading || businessProcessSummaryLoading)

  useEffect(() => {
    let cancelled = false

    const fetchDashboardFilters = async () => {
      if (!cancelled) {
        setLoading(true)
      }
      try {
        const response = await fetch(apiUrl('/api/company-co/dashboard/filters'), {
          method: 'GET',
          credentials: 'include',
        })
        const data = await response.json()

        if (!cancelled && response.ok && data.success) {
          setMappedUnits(Array.isArray(data.data?.units) ? data.data.units : [])
          setFinancialYearOptions(Array.isArray(data.data?.financialYears) ? data.data.financialYears : [])
          setConclusionOptions(Array.isArray(data.data?.conclusions) ? data.data.conclusions : [])
          return
        }

        if (!cancelled) {
          setMappedUnits([])
          setFinancialYearOptions([])
          setConclusionOptions([])
        }
      } catch (error) {
        console.error('Error fetching dashboard filters:', error)
        if (!cancelled) {
          setMappedUnits([])
          setFinancialYearOptions([])
          setConclusionOptions([])
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    fetchDashboardFilters()

    return () => {
      cancelled = true
    }
  }, [])

  const buildDashboardQueryString = () => {
    const params = new URLSearchParams()

    if (filterActive === 'active') {
      params.set('active', 'true')
    } else if (filterActive === 'inactive') {
      params.set('active', 'false')
    }

    if (filterBusinessProcess !== 'all') {
      params.set('business_process', filterBusinessProcess)
    }

    if (filterFinancialYear !== 'all') {
      params.set('financial_year', filterFinancialYear)
    }

    if (filterApprovalStatus !== 'all') {
      const statusParam = toRacmApprovalStatusQueryParam(filterApprovalStatus)
      if (statusParam) params.set('status', statusParam)
    }

    if (filterUnit !== 'all') {
      params.set('unit_id', filterUnit)
    }

    if (filterConclusion !== 'all') {
      params.set('conclusion', filterConclusion)
    }

    return params.toString()
  }

  useEffect(() => {
    if (!companyIdentifier) return

    const fetchChartStats = async () => {
      setChartStatsLoading(true)
      try {
        const search = buildDashboardQueryString()
        const suffix = search ? `?${search}` : ''
        const [summaryResponse, keyResponse, natureResponse, typeResponse] = await Promise.all([
          fetch(apiUrl(`/api/company-co/dashboard/summary${suffix}`), { credentials: 'include' }),
          fetch(apiUrl(`/api/company-co/dashboard/key-controls${suffix}`), { credentials: 'include' }),
          fetch(apiUrl(`/api/company-co/dashboard/nature-of-control${suffix}`), { credentials: 'include' }),
          fetch(apiUrl(`/api/company-co/dashboard/control-type${suffix}`), { credentials: 'include' }),
        ])

        const [summaryData, keyData, natureData, typeData] = await Promise.all([
          summaryResponse.json(),
          keyResponse.json(),
          natureResponse.json(),
          typeResponse.json(),
        ])

        if (
          !summaryResponse.ok || !summaryData?.success ||
          !keyResponse.ok || !keyData?.success ||
          !natureResponse.ok || !natureData?.success ||
          !typeResponse.ok || !typeData?.success
        ) {
          throw new Error('Failed to fetch RACM chart stats')
        }

        setDashboardStats((prev) => ({
          ...prev,
          totalRacms: Number(summaryData.data?.totalRacms || 0),
          keyControls: Number(keyData.data?.keyControls || 0),
          nonKeyControls: Number(keyData.data?.nonKeyControls || 0),
          keyNotClassified: Number(keyData.data?.notClassified || 0),
          keyUnclassifiedValues: Array.isArray(keyData.data?.unclassifiedValues) ? keyData.data.unclassifiedValues : [],
          preventive: Number(natureData.data?.preventive || 0),
          detective: Number(natureData.data?.detective || 0),
          corrective: Number(natureData.data?.corrective || 0),
          natureNotClassified: Number(natureData.data?.notClassified || 0),
          natureUnclassifiedValues: Array.isArray(natureData.data?.unclassifiedValues) ? natureData.data.unclassifiedValues : [],
          manual: Number(typeData.data?.manual || 0),
          automated: Number(typeData.data?.automated || 0),
          semiAutomated: Number(typeData.data?.semiAutomated || 0),
          typeNotClassified: Number(typeData.data?.notClassified || 0),
          typeUnclassifiedValues: Array.isArray(typeData.data?.unclassifiedValues) ? typeData.data.unclassifiedValues : [],
        }))
      } catch (error) {
        console.error('Error fetching RACM chart stats:', error)
        setDashboardStats((prev) => ({
          ...prev,
          totalRacms: 0,
          keyControls: 0,
          nonKeyControls: 0,
          keyNotClassified: 0,
          keyUnclassifiedValues: [],
          preventive: 0,
          detective: 0,
          corrective: 0,
          natureNotClassified: 0,
          natureUnclassifiedValues: [],
          manual: 0,
          automated: 0,
          semiAutomated: 0,
          typeNotClassified: 0,
          typeUnclassifiedValues: [],
        }))
      } finally {
        setChartStatsLoading(false)
      }
    }

    fetchChartStats()
  }, [
    companyIdentifier,
    filterActive,
    filterApprovalStatus,
    filterBusinessProcess,
    filterFinancialYear,
    filterUnit,
    filterConclusion,
  ])

  useEffect(() => {
    if (!companyIdentifier) return

    let cancelled = false

    const fetchAllRacms = async () => {
      setBusinessProcessSummaryLoading(true)
      try {
        const response = await fetch(apiUrl('/api/company-co/dashboard/racms'), {
          credentials: 'include',
        })
        const data = await response.json()

        if (!response.ok || !data?.success) {
          throw new Error(data?.message || 'Failed to fetch RACMs')
        }

        if (!cancelled) {
          setAllRacms(Array.isArray(data.data) ? data.data : [])
        }
      } catch (error) {
        console.error('Error fetching RACMs for business-process summary:', error)
        if (!cancelled) {
          setAllRacms([])
        }
      } finally {
        if (!cancelled) {
          setBusinessProcessSummaryLoading(false)
        }
      }
    }

    fetchAllRacms()

    return () => {
      cancelled = true
    }
  }, [companyIdentifier])

  const shouldShowUnitMapping = mappedUnits.length > 0

  const normalizedMappedUnits = mappedUnits
    .map((unit) => ({
      unitId: String(unit?.unit_id || '').trim(),
      unitName: String(unit?.unit_name || unit?.unit_id || '').trim(),
    }))
    .filter((unit) => unit.unitId)

  useEffect(() => {
    if (!shouldShowUnitMapping && filterUnit !== 'all') {
      setFilterUnit('all')
      return
    }

    if (
      shouldShowUnitMapping &&
      filterUnit !== 'all' &&
      !normalizedMappedUnits.some((unit) => unit.unitId === filterUnit)
    ) {
      setFilterUnit('all')
    }
  }, [filterUnit, normalizedMappedUnits, shouldShowUnitMapping])

  const dashboardFilters = {
    active: filterActive,
    businessProcess: filterBusinessProcess,
    financialYear: filterFinancialYear,
    approvalStatus: filterApprovalStatus,
    unit: filterUnit,
    conclusion: filterConclusion,
  }

  const businessProcessSummaryRows = Array.from(createBusinessProcessSummaryRows(allRacms).values())
    .sort((left, right) => left.businessProcess.localeCompare(right.businessProcess))
  const businessProcessOptions = [...new Set(
    (allRacms || [])
      .map((form) => String(getFieldValue(form, 'business_process', 'businessProcess') || '').trim())
      .filter(Boolean)
  )].sort((left, right) => left.localeCompare(right))
  const controlCombinationCounts = countControlsByCombination(allRacms)
  const locallyComputedUnclassifiedCount = countUnclassifiedControls(allRacms, dashboardFilters)
  const unclassifiedControlsCount = Math.max(
    locallyComputedUnclassifiedCount,
    Number(dashboardStats.keyNotClassified || 0),
    Number(dashboardStats.natureNotClassified || 0),
    Number(dashboardStats.typeNotClassified || 0),
  )
  const highRiskColumnBackground = theme.palette.mode === 'dark'
    ? 'rgba(239, 68, 68, 0.16)'
    : 'rgba(239, 68, 68, 0.10)'

  useEffect(() => {
    setUnclassifiedAlertDismissed(false)
  }, [
    filterActive,
    filterBusinessProcess,
    filterFinancialYear,
    filterApprovalStatus,
    filterUnit,
    filterConclusion,
  ])

  const renderPieBreakdownCard = ({
    title,
    primaryValue,
    primaryLabel,
    secondaryLabel,
    secondaryValue,
    colors,
    extraRows = [],
  }) => {
    const breakdownRows = [
      { label: primaryLabel, value: primaryValue, color: colors[0] },
      { label: secondaryLabel, value: secondaryValue, color: colors[1] },
      ...extraRows.map((row) => ({
        ...row,
        color: row.color ?? colors[2] ?? colors[0],
      })),
    ]
    const classifiedTotal = breakdownRows.reduce((sum, item) => sum + Number(item.value || 0), 0)
    const normalizedRows = breakdownRows.map((item, index) => ({
      ...item,
      id: index,
      percentage: calculatePercentage(item.value, classifiedTotal),
    }))

    return (
    <Paper
      elevation={3}
      sx={{
        ...DASHBOARD_PAPER_SX,
        borderRadius: 3,
        overflow: 'hidden',
        height: '100%',
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
          pb: 1.5,
          textAlign: 'center',
        }}
      >
        <Typography variant="h6" sx={{ fontWeight: 700, color: theme.palette.text.primary, borderBottom: `1px solid ${theme.palette.divider}`, pb: 1.5 }}>
          {title}
        </Typography>
        {/* <Typography variant="body2" sx={{ mt: 0.75, color: theme.palette.text.secondary }}>
          Classified RACMs: {statsLoading ? '...' : classifiedTotal}
        </Typography> */}
      </Box>
      <Box
        sx={{
          px: 3,
          pb: 3,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 2.5,
        }}
      >
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            width: '100%',
            minHeight: 260,
          }}
        >
          {classifiedTotal > 0 ? (
            <PieChart
              width={PIE_CHART_SIZE}
              height={PIE_CHART_SIZE}
              margin={{ top: 8, right: 8, bottom: 8, left: 8 }}
              series={[
                {
                  innerRadius: PIE_CHART_INNER_RADIUS,
                  outerRadius: PIE_CHART_OUTER_RADIUS,
                  paddingAngle: 1,
                  cornerRadius: 1,
                  cx: PIE_CHART_SIZE / 2,
                  cy: PIE_CHART_SIZE / 2,
                  data: normalizedRows,
                },
              ]}
              slotProps={{
                legend: {
                  hidden: true,
                },
              }}
            />
          ) : (
            <Box
              sx={{
                height: 260,
                width: '100%',
                maxWidth: PIE_CHART_SIZE,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 2,
                border: `1px dashed ${theme.palette.divider}`,
                backgroundColor: theme.palette.action.hover,
                color: theme.palette.text.secondary,
              }}
            >
              <Typography variant="body2">No controls to display</Typography>
            </Box>
          )}
        </Box>
        <Box
          sx={{
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            gap: 1.25,
          }}
        >
          {normalizedRows.map((item) => (
            <Box
              key={item.label}
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 2,
                px: 1.5,
                py: 1.25,
                borderRadius: 2,
                border: `1px solid ${theme.palette.divider}`,
                backgroundColor: theme.palette.mode === 'dark'
                  ? 'rgba(255,255,255,0.03)'
                  : theme.palette.grey[50],
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
                {item.color ? (
                  <Box
                    component="span"
                    aria-hidden
                    sx={{
                      width: 10,
                      height: 10,
                      borderRadius: '50%',
                      backgroundColor: item.color,
                      flexShrink: 0,
                    }}
                  />
                ) : null}
                <Typography variant="body2" sx={{ fontWeight: 700, color: theme.palette.text.primary }}>
                  {`${item.label} (${item.percentage}%)`}
                </Typography>
              </Box>
              <Typography
                variant="body2"
                sx={{ fontWeight: 700, color: theme.palette.text.primary, textAlign: 'right', whiteSpace: 'nowrap' }}
              >{chartStatsLoading ? '...' : item.value}</Typography>
            </Box>
          ))}
        </Box>
      </Box>
    </Paper>
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
            Control Dispersion Dashboard
          </Typography>
          <Typography variant="body2" sx={PAGE_SUBHEADER_TEXT_SX}>
            Analyze the controls for your company
          </Typography>
        </Box>
        <Button variant="contained" onClick={() => navigate('/company-co/racm-management')}>
          Open RACM Management
        </Button>
      </Box>

      <Box
        sx={{
          mb: 3,
          display: 'flex',
          flexDirection: { xs: 'column', lg: 'row' },
          justifyContent: 'space-between',
          alignItems: { xs: 'flex-start', lg: 'flex-start' },
          gap: 2,
          borderBottom: `1px solid ${theme.palette.divider}`,
          pb: 2.5,
        }}
      >
        <Box
          sx={{
            minWidth: { xs: '100%', lg: 'auto' },
          }}
        >
          <Typography
            variant="body2"
            sx={{ color: theme.palette.text.secondary, textTransform: 'uppercase', letterSpacing: '0.05em' }}
          >
            Total Controls
          </Typography>
          <Typography variant="h4" sx={{ mt: 0.5, fontWeight: 800, color: theme.palette.text.primary }}>
            {chartStatsLoading ? '...' : dashboardStats.totalRacms}
          </Typography>
        </Box>

        <Box
          sx={{
            display: 'flex',
            flexDirection: { xs: 'column', sm: 'row' },
            gap: 2,
            alignItems: { xs: 'stretch', sm: 'center' },
            justifyContent: { xs: 'flex-start', lg: 'flex-end' },
            width: { xs: '100%', lg: 'auto' },
            flexWrap: 'wrap',
          }}
        >
          <FormControl variant="outlined" sx={{ minWidth: FILTER_DROPDOWN_MIN_WIDTH_LG }}>
            <InputLabel id="business-process-filter-label">Business Process</InputLabel>
            <Select
              labelId="business-process-filter-label"
              id="business-process-filter"
              value={filterBusinessProcess}
              label="Business Process"
              onChange={(e) => setFilterBusinessProcess(e.target.value)}
            >
              <MenuItem value="all">All</MenuItem>
              {businessProcessOptions.map((option) => (
                <MenuItem key={option} value={option}>
                  {option}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl variant="outlined" sx={{ minWidth: FILTER_DROPDOWN_MIN_WIDTH_LG }}>
            <InputLabel id="financial-year-filter-label">Financial Year</InputLabel>
            <Select
              labelId="financial-year-filter-label"
              id="financial-year-filter"
              value={filterFinancialYear}
              label="Financial Year"
              onChange={(e) => setFilterFinancialYear(e.target.value)}
            >
              <MenuItem value="all">All</MenuItem>
              {financialYearOptions.map((option) => (
                <MenuItem key={option} value={option}>
                  {option}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl variant="outlined" sx={{ minWidth: FILTER_DROPDOWN_MIN_WIDTH_LG }}>
            <InputLabel id="active-status-filter-label">Activity</InputLabel>
            <Select
              labelId="active-status-filter-label"
              id="active-status-filter"
              value={filterActive}
              label="Activity"
              onChange={(e) => setFilterActive(e.target.value)}
            >
              <MenuItem value="all">All</MenuItem>
              <MenuItem value="active">Active</MenuItem>
              <MenuItem value="inactive">Inactive</MenuItem>
            </Select>
          </FormControl>

          <FormControl variant="outlined" sx={{ minWidth: FILTER_DROPDOWN_MIN_WIDTH_LG }}>
            <InputLabel id="approval-status-filter-label">Approval Status</InputLabel>
            <Select
              labelId="approval-status-filter-label"
              id="approval-status-filter"
              value={filterApprovalStatus}
              label="Approval Status"
              onChange={(e) => setFilterApprovalStatus(e.target.value)}
            >
              <MenuItem value="all">All</MenuItem>
              <MenuItem value="Approved">Approved</MenuItem>
              <MenuItem value="Rejected">Rejected</MenuItem>
              <MenuItem value="Pending">Pending</MenuItem>
              <MenuItem value="Sent for Approval">Sent for Approval</MenuItem>
            </Select>
          </FormControl>

          <FormControl variant="outlined" sx={{ minWidth: FILTER_DROPDOWN_MIN_WIDTH_LG }}>
            <InputLabel id="conclusion-filter-label">Conclusion</InputLabel>
            <Select
              labelId="conclusion-filter-label"
              id="conclusion-filter"
              value={filterConclusion}
              label="Conclusion"
              onChange={(e) => setFilterConclusion(e.target.value)}
            >
              <MenuItem value="all">All</MenuItem>
              {conclusionOptions.map((option) => (
                <MenuItem key={option} value={option}>
                  {option}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {shouldShowUnitMapping ? (
            <FormControl variant="outlined" sx={{ minWidth: FILTER_DROPDOWN_MIN_WIDTH_LG }}>
              <InputLabel id="unit-filter-label">Unit</InputLabel>
              <Select
                labelId="unit-filter-label"
                id="unit-filter"
                value={filterUnit}
                label="Unit"
                onChange={(e) => setFilterUnit(e.target.value)}
              >
                <MenuItem value="all">All</MenuItem>
                {normalizedMappedUnits.map((unit) => (
                  <MenuItem key={unit.unitId} value={unit.unitId}>
                    {unit.unitName || unit.unitId}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          ) : null}
        </Box>
      </Box>

      {!unclassifiedAlertDismissed && !businessProcessSummaryLoading && unclassifiedControlsCount > 0 ? (
        <Alert
          severity="error"
          onClose={(event) => {
            event?.stopPropagation?.()
            setUnclassifiedAlertDismissed(true)
          }}
          sx={{
            mb: 3,
            cursor: 'pointer',
            alignItems: 'center',
            '& .MuiAlert-message': {
              width: '100%',
            },
          }}
          onClick={() => navigate(`/company-co/unclassified-controls${buildDashboardQueryString() ? `?${buildDashboardQueryString()}` : ''}`)}
        >
          {`Found ${unclassifiedControlsCount} unclassified control${unclassifiedControlsCount === 1 ? '' : 's'}. Click to open the unclassified controls view.`}
        </Alert>
      ) : null}

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', xl: 'repeat(3, minmax(0, 1fr))' },
          alignItems: 'start',
          gap: 3,
          mb: 3,
        }}
      >
        {renderPieBreakdownCard({
          title: 'Key / Non-Key Controls',
          primaryLabel: 'Key Controls',
          primaryValue: dashboardStats.keyControls,
          secondaryLabel: 'Non-Key',
          secondaryValue: dashboardStats.nonKeyControls,
          colors: ['#0f766e', '#94a3b8'],
        })}
        {renderPieBreakdownCard({
          title: 'Preventive / Detective Controls',
          primaryLabel: 'Preventive',
          primaryValue: dashboardStats.preventive,
          secondaryLabel: 'Detective',
          secondaryValue: dashboardStats.detective,
          colors: ['#1d4ed8', '#f59e0b'],
          extraRows: [
            {
              label: 'Corrective',
              value: dashboardStats.corrective,
              color: '#dc2626',
            },
          ],
        })}
        {renderPieBreakdownCard({
          title: 'Automated / Manual Controls',
          primaryLabel: 'Automated',
          primaryValue: dashboardStats.automated,
          secondaryLabel: 'Manual',
          secondaryValue: dashboardStats.manual,
          colors: ['#7c3aed', '#ea580c'],
          extraRows: [
            {
              label: 'Semi-Automated',
              value: dashboardStats.semiAutomated,
              color: '#0f766e',
            },
          ],
        })}
      </Box>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', xl: 'repeat(3, minmax(0, 1fr))' },
          alignItems: 'start',
          gap: 3,
          mb: 3,
        }}
      >
        {[
          {
            label: 'Key + Manual Controls',
            value: controlCombinationCounts.keyManual,
            backgroundColor: 'transparent',
            valueColor: theme.palette.text.primary,
            linkLabel: 'View AI summary',
            onClick: () => navigate('/company-co/key-manual-ai-insights'),
          },
          {
            label: 'Key + Automated Controls',
            value: controlCombinationCounts.keyAutomated,
            backgroundColor: 'transparent',
            valueColor: theme.palette.text.primary,
          },
          {
            label: 'High Risk + Key + Manual Controls',
            value: controlCombinationCounts.highKeyManual,
            backgroundColor: theme.palette.mode === 'dark' ? 'rgba(220, 38, 38, 0.12)' : 'rgba(220, 38, 38, 0.08)',
            valueColor: theme.palette.text.primary,
          },
        ].map((item) => (
          <Paper
            key={item.label}
            elevation={3}
            sx={{
              ...DASHBOARD_PAPER_SX,
              px: 3,
              py: 2.5,
              borderRadius: 3,
              border: `1px solid ${theme.palette.divider}`,
              height: '100%',
              backgroundColor: item.backgroundColor,
              boxShadow: theme.palette.mode === 'dark'
                ? '0 10px 28px rgba(0, 0, 0, 0.28)'
                : '0 12px 30px rgba(15, 23, 42, 0.08)',
            }}
          >
            <Typography
              variant="body2"
              sx={{ color: theme.palette.text.secondary, textTransform: 'uppercase', letterSpacing: '0.05em' }}
            >
              {item.label}
            </Typography>
            <Typography variant="h4" sx={{ mt: 0.75, fontWeight: 800, color: item.valueColor }}>
              {businessProcessSummaryLoading ? '...' : item.value}
            </Typography>
            {item.onClick ? (
              <Link
                component="button"
                type="button"
                underline="hover"
                onClick={item.onClick}
                sx={{
                  mt: 1.25,
                  p: 0,
                  border: 'none',
                  background: 'none',
                  color: theme.palette.primary.main,
                  fontWeight: 700,
                  fontSize: '0.92rem',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                {`${item.linkLabel} ->`}
              </Link>
            ) : null}
          </Paper>
        ))}
      </Box>

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
          <Typography variant="h6" sx={{ fontWeight: 700, color: theme.palette.text.primary }}>
            Summary of Controls
          </Typography>
          <Typography variant="body2" sx={{ mt: 0.75, color: theme.palette.text.secondary }}>
            Company-wide counts across all RACMs (not affected by dashboard filters).
          </Typography>
        </Box>

        <Box sx={{ width: '100%', overflowX: 'auto' }}>
          <Box sx={{ minWidth: `calc(${SUMMARY_PROCESS_COLUMN_MIN_WIDTH}px + ${SUMMARY_COLUMN_MIN_WIDTH}px * 10)` }}>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: `${SUMMARY_PROCESS_COLUMN_MIN_WIDTH}px repeat(10, minmax(${SUMMARY_COLUMN_MIN_WIDTH}px, 1fr))`,
                borderBottom: `1px solid ${theme.palette.divider}`,
                backgroundColor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.03)' : theme.palette.grey[100],
              }}
            >
              {[
                'Business Process',
                'Total Controls',
                'Key Controls',
                'Non-Key Controls',
                'Preventive',
                'Detective',
                'Corrective',
                'Manual',
                'Automated',
                'Semi-Automated',
                'High Risk Non-Automated',
              ].map((column) => (
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

            {businessProcessSummaryLoading ? (
              <Box sx={{ px: 3, py: 4 }}>
                <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>
                  Loading business-process summary...
                </Typography>
              </Box>
            ) : businessProcessSummaryRows.length === 0 ? (
              <Box sx={{ px: 3, py: 4 }}>
                <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>
                  No Controls available.
                </Typography>
              </Box>
            ) : (
              businessProcessSummaryRows.map((row, index) => (
                <Box
                  key={row.businessProcess}
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: `${SUMMARY_PROCESS_COLUMN_MIN_WIDTH}px repeat(10, minmax(${SUMMARY_COLUMN_MIN_WIDTH}px, 1fr))`,
                    borderBottom: index === businessProcessSummaryRows.length - 1 ? 'none' : `1px solid ${theme.palette.divider}`,
                    backgroundColor: index % 2 === 0
                      ? 'transparent'
                      : theme.palette.mode === 'dark'
                        ? 'rgba(255,255,255,0.02)'
                        : theme.palette.grey[50],
                  }}
                >
                  {[
                    row.businessProcess,
                    row.totalRacms,
                    row.keyControls,
                    row.nonKeyControls,
                    row.preventive,
                    row.detective,
                    row.corrective,
                    row.manual,
                    row.automated,
                    row.semiAutomated,
                    row.highRiskNonAutomated,
                  ].map((value, valueIndex) => (
                    <Box
                      key={`${row.businessProcess}-${valueIndex}`}
                      sx={{
                        px: 2,
                        py: 1.75,
                        borderRight: `1px solid ${theme.palette.divider}`,
                        backgroundColor:
                          valueIndex === HIGH_RISK_COLUMN_INDEX && Number(value) > 0
                            ? highRiskColumnBackground
                            : 'transparent',
                        '&:last-of-type': {
                          borderRight: 'none',
                        },
                      }}
                    >
                      <Typography
                        variant="body2"
                        sx={{
                          color: theme.palette.text.primary,
                          fontWeight: valueIndex === 0 ? 600 : 500,
                          whiteSpace: valueIndex === 0 ? 'normal' : 'nowrap',
                        }}
                      >
                        {value}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              ))
            )}
          </Box>
        </Box>
      </Paper>

      <Paper
        elevation={3}
        sx={{
          ...DASHBOARD_PAPER_SX,
          mt: 3,
          borderRadius: 3,
          border: `1px solid ${theme.palette.divider}`,
          boxShadow: theme.palette.mode === 'dark'
            ? '0 10px 28px rgba(0, 0, 0, 0.28)'
            : '0 12px 30px rgba(15, 23, 42, 0.08)',
          overflow: 'hidden',
        }}
      >
        <Box
          sx={{
            px: 3,
            py: 3,
            display: 'flex',
            flexDirection: { xs: 'column', md: 'row' },
            alignItems: { xs: 'flex-start', md: 'center' },
            justifyContent: 'space-between',
            gap: 2,
          }}
        >
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 700, color: theme.palette.text.primary }}>
              Risk Analysis
            </Typography>
            <Typography variant="body2" sx={{ mt: 0.75, color: theme.palette.text.secondary }}>
              Open the risk analysis view to review controls by business process and financial year.
            </Typography>
          </Box>
          <Link
            component="button"
            type="button"
            underline="hover"
            onClick={() => navigate('/company-co/risk-analysis')}
            sx={{
              p: 0,
              border: 'none',
              background: 'none',
              color: theme.palette.primary.main,
              fontWeight: 700,
              fontSize: '0.95rem',
              cursor: 'pointer',
              textAlign: 'left',
            }}
          >
            Open Risk Analysis {'->'}
          </Link>
        </Box>
      </Paper>

    </Box>
  )
}

export default ControlDispersionDashboard
