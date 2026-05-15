import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTheme } from '@mui/material/styles'
import Button from '@mui/material/Button'
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import FormControl from '@mui/material/FormControl'
import InputLabel from '@mui/material/InputLabel'
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import { PieChart } from '@mui/x-charts/PieChart'
import {
  FILTER_DROPDOWN_MIN_WIDTH_LG,
  PAGE_SUBHEADER_TEXT_SX,
} from '../../uiConstants'
import { useSyncGlobalLoading } from '../../contexts/GlobalLoadingContext'
import { apiUrl } from '../../config/api'
import { useBusinessProcesses } from '../../hooks/useBusinessProcesses'

const EMPTY_STATS = {
  totalRacms: 0,
  keyControls: 0,
  nonKeyControls: 0,
  keyNotClassified: 0,
  keyUnclassifiedValues: [],
  preventive: 0,
  detective: 0,
  natureNotClassified: 0,
  natureUnclassifiedValues: [],
  manual: 0,
  automated: 0,
  typeNotClassified: 0,
  typeUnclassifiedValues: [],
}

function Company_Co_dashboard() {
  const theme = useTheme()
  const navigate = useNavigate()
  const [companyIdentifier, setCompanyIdentifier] = useState(null)
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
  const [loading, setLoading] = useState(true)
  const [statsLoading, setStatsLoading] = useState(true)
  const { businessProcessOptions } = useBusinessProcesses()
  useSyncGlobalLoading(loading || statsLoading)

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
      params.set('status', filterApprovalStatus.toLowerCase())
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

    const fetchDashboardStats = async () => {
      setStatsLoading(true)
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
          throw new Error('Failed to fetch RACM dashboard stats')
        }

        setDashboardStats({
          totalRacms: Number(summaryData.data?.totalRacms || 0),
          keyControls: Number(keyData.data?.keyControls || 0),
          nonKeyControls: Number(keyData.data?.nonKeyControls || 0),
          keyNotClassified: Number(keyData.data?.notClassified || 0),
          keyUnclassifiedValues: Array.isArray(keyData.data?.unclassifiedValues) ? keyData.data.unclassifiedValues : [],
          preventive: Number(natureData.data?.preventive || 0),
          detective: Number(natureData.data?.detective || 0),
          natureNotClassified: Number(natureData.data?.notClassified || 0),
          natureUnclassifiedValues: Array.isArray(natureData.data?.unclassifiedValues) ? natureData.data.unclassifiedValues : [],
          manual: Number(typeData.data?.manual || 0),
          automated: Number(typeData.data?.automated || 0),
          typeNotClassified: Number(typeData.data?.notClassified || 0),
          typeUnclassifiedValues: Array.isArray(typeData.data?.unclassifiedValues) ? typeData.data.unclassifiedValues : [],
        })
      } catch (error) {
        console.error('Error fetching RACM dashboard stats:', error)
        setDashboardStats(EMPTY_STATS)
      } finally {
        setStatsLoading(false)
      }
    }

    fetchDashboardStats()
  }, [
    companyIdentifier,
    filterActive,
    filterApprovalStatus,
    filterBusinessProcess,
    filterFinancialYear,
    filterUnit,
    filterConclusion,
  ])

  const shouldShowUnitMapping = mappedUnits.length > 0
  const automatedPercentage = dashboardStats.totalRacms > 0
    ? Math.round((dashboardStats.automated / dashboardStats.totalRacms) * 100)
    : 0

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

  const renderPieBreakdownCard = ({
    title,
    primaryValue,
    primaryLabel,
    secondaryLabel,
    secondaryValue,
    notClassified,
    unclassifiedValues,
    colors,
    extraRows = [],
  }) => (
    <Paper
      elevation={3}
      sx={{
        borderRadius: 2,
        overflow: 'hidden',
        height: 500,
      }}
    >
      <Box
        sx={{
          px: 3,
          py: 2,
          borderBottom: `1px solid ${theme.palette.divider}`,
          backgroundColor:
            theme.palette.mode === 'dark'
              ? 'rgba(255, 255, 255, 0.06)'
              : theme.palette.grey[100],
        }}
      >
        <Typography variant="h6" sx={{ fontWeight: 700, color: theme.palette.text.primary }}>
          {title}
        </Typography>
      </Box>
      <Box
        sx={{
          px: 3,
          py: 2.5,
          display: 'flex',
          flexDirection: { xs: 'column', lg: 'row' },
          alignItems: 'stretch',
          gap: 2,
        }}
      >
        <Box
          sx={{
            flexBasis: { xs: '100%', lg: '70%' },
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            minHeight: 280,
          }}
        >
          {primaryValue + secondaryValue > 0 ? (
            <PieChart
              // height={280}
              // width={450}
              margin={{ top: 0, right: 0, bottom: 0, left: 0 }}
              series={[
                {
                  innerRadius: 0,
                  outerRadius: 120,
                  paddingAngle: 1,
                  cornerRadius: 1,
                  cx: 240,
                  cy: 140,
                  data: [
                    { id: 0, value: primaryValue, label: title.split(' / ')[0], color: colors[0] },
                    { id: 1, value: secondaryValue, label: secondaryLabel, color: colors[1] },
                  ],
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
                maxWidth: 420,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 2,
                border: `1px dashed ${theme.palette.divider}`,
                color: theme.palette.text.secondary,
              }}
            >
              <Typography variant="body2">No classified RACMs</Typography>
            </Box>
          )}
        </Box>
        <Box
          sx={{
            flexBasis: { xs: '100%', lg: '30%' },
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'flex-start',
            gap: 1.25,
            pt: { xs: 0, lg: 0.75 },
            pr: { xs: 0, lg: 0.5 },
            alignSelf: 'flex-start',
          }}
        >
          {[
            { label: primaryLabel, value: primaryValue },
            { label: secondaryLabel, value: secondaryValue },
            ...extraRows,
          ].map((item) => (
            <Box
              key={item.label}
              sx={{
                display: 'flex',
                alignItems: 'baseline',
                justifyContent: 'space-between',
                gap: 2,
                py: 0.5,
                borderBottom: `1px solid ${theme.palette.divider}`,
              }}
            >
              <Typography variant="body2" sx={{ fontWeight: 700, color: theme.palette.text.primary }}>
                {item.label}
              </Typography>
              <Typography
                variant="body2"
                sx={{ fontWeight: 700, color: theme.palette.text.primary, textAlign: 'right', whiteSpace: 'nowrap' }}
              >
                {statsLoading ? '...' : item.value}
              </Typography>
            </Box>
          ))}
        </Box>
      </Box>
      <Box
        sx={{
          px: 3,
          pt: 0,
          pb: 2.5,
        }}
      >
        <Box
          sx={{
            pt: 2,
            borderTop: `1px solid ${theme.palette.divider}`,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, flexWrap: 'wrap' }}>
            <Typography variant="body2" sx={{ fontWeight: 700, color: theme.palette.text.primary }}>
              Unclassified RACMs:
            </Typography>
            <Typography variant="body2" sx={{ color: theme.palette.text.primary }}>
              {statsLoading ? '...' : notClassified}
            </Typography>
          </Box>
        </Box>
        <Box sx={{ mt: 1.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
            <Typography variant="body2" sx={{ fontWeight: 700, color: theme.palette.text.primary }}>
              Unclassified values:
            </Typography>
            {unclassifiedValues.length > 0 ? (
              <Box
                sx={{
                  minWidth: 0,
                  flex: 1,
                  overflowX: 'auto',
                  overflowY: 'hidden',
                  whiteSpace: 'nowrap',
                  '&::-webkit-scrollbar': {
                    height: 6,
                  },
                }}
              >
                <Box sx={{ display: 'inline-flex', gap: 1, pr: 1 }}>
                  {unclassifiedValues.map((value) => (
                    <Box
                      key={value}
                      component="span"
                      sx={{
                        px: 1.25,
                        py: 0.75,
                        borderRadius: 999,
                        fontSize: '0.75rem',
                        lineHeight: 1,
                        color: theme.palette.text.primary,
                        backgroundColor: theme.palette.action.hover,
                        border: `1px solid ${theme.palette.divider}`,
                        whiteSpace: 'nowrap',
                        flex: '0 0 auto',
                      }}
                    >
                      {value}
                    </Box>
                  ))}
                </Box>
              </Box>
            ) : (
              <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>
                None
              </Typography>
            )}
          </Box>
        </Box>
      </Box>
    </Paper>
  )

  return (
    <Box sx={{ maxWidth: '100%', mx: 'auto', px: 0, py: 4 }}>
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
            RACM Dashboard
          </Typography>
          <Typography variant="body2" sx={PAGE_SUBHEADER_TEXT_SX}>
            Counts regenerate based on the selected company coordinator filters, including unit mapping.
          </Typography>
        </Box>
        <Button variant="contained" onClick={() => navigate('/company_co/racm-management')}>
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
            Total RACMs
          </Typography>
          <Typography variant="h4" sx={{ mt: 0.5, fontWeight: 800, color: theme.palette.text.primary }}>
            {statsLoading ? '...' : dashboardStats.totalRacms}
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
          title: 'Key / Non-Key RACMs',
          primaryLabel: 'Key Controls',
          primaryValue: dashboardStats.keyControls,
          secondaryLabel: 'Non-Key Controls',
          secondaryValue: dashboardStats.nonKeyControls,
          notClassified: dashboardStats.keyNotClassified,
          unclassifiedValues: dashboardStats.keyUnclassifiedValues,
          colors: ['#0f766e', '#94a3b8'],
        })}
        {renderPieBreakdownCard({
          title: 'Preventive / Detective RACMs',
          primaryLabel: 'Preventive',
          primaryValue: dashboardStats.preventive,
          secondaryLabel: 'Detective',
          secondaryValue: dashboardStats.detective,
          notClassified: dashboardStats.natureNotClassified,
          unclassifiedValues: dashboardStats.natureUnclassifiedValues,
          colors: ['#1d4ed8', '#f59e0b'],
        })}
        {renderPieBreakdownCard({
          title: 'Automated / Manual RACMs',
          primaryLabel: 'Automated',
          primaryValue: dashboardStats.automated,
          secondaryLabel: 'Manual',
          secondaryValue: dashboardStats.manual,
          notClassified: dashboardStats.typeNotClassified,
          unclassifiedValues: dashboardStats.typeUnclassifiedValues,
          colors: ['#7c3aed', '#ea580c'],
          extraRows: [
            {
              label: 'Automated %',
              value: `${automatedPercentage}%`,
            },
          ],
        })}
      </Box>

    </Box>
  )
}

export default Company_Co_dashboard
