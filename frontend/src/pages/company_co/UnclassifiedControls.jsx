import React, { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useTheme } from '@mui/material/styles'
import Button from '@mui/material/Button'
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import FormControl from '@mui/material/FormControl'
import InputLabel from '@mui/material/InputLabel'
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import {
  DASHBOARD_PAGE_OUTER_SX,
  DASHBOARD_PAPER_SX,
  FILTER_DROPDOWN_MIN_WIDTH_LG,
  PAGE_SUBHEADER_TEXT_SX,
} from '../../uiConstants'
import { useSyncGlobalLoading } from '../../contexts/GlobalLoadingContext'
import { apiUrl } from '../../config/api'
import {
  createUnclassifiedSummaryRows,
  countUnclassifiedControls,
  getFieldValue,
  getUnclassifiedFlags,
  matchesDashboardFilters,
} from './dashboardClassificationUtils'

const SUMMARY_COLUMN_MIN_WIDTH = 160
const SUMMARY_PROCESS_COLUMN_MIN_WIDTH = 260

function UnclassifiedControls() {
  const theme = useTheme()
  const navigate = useNavigate()
  const location = useLocation()
  const [loading, setLoading] = useState(true)
  const [forms, setForms] = useState([])
  const [selectedDialog, setSelectedDialog] = useState(null)
  const [filterActive, setFilterActive] = useState('all')
  const [filterBusinessProcess, setFilterBusinessProcess] = useState('all')
  const [filterUnit, setFilterUnit] = useState('all')
  const [filterFinancialYear, setFilterFinancialYear] = useState('all')
  const [filterApprovalStatus, setFilterApprovalStatus] = useState('all')
  const [filterConclusion, setFilterConclusion] = useState('all')
  const [mappedUnits, setMappedUnits] = useState([])
  useSyncGlobalLoading(loading)

  useEffect(() => {
    let cancelled = false

    const fetchDashboardRacms = async () => {
      setLoading(true)
      try {
        const [racmsResponse, filtersResponse] = await Promise.all([
          fetch(apiUrl('/api/company-co/dashboard/racms'), {
            credentials: 'include',
          }),
          fetch(apiUrl('/api/company-co/dashboard/filters'), {
            credentials: 'include',
          }),
        ])
        const [racmsData, filtersData] = await Promise.all([
          racmsResponse.json(),
          filtersResponse.json(),
        ])

        if (!racmsResponse.ok || !racmsData?.success) {
          throw new Error(racmsData?.message || 'Failed to fetch unclassified controls')
        }

        if (!cancelled) {
          setForms(Array.isArray(racmsData.data) ? racmsData.data : [])
          setMappedUnits(
            filtersResponse.ok && filtersData?.success && Array.isArray(filtersData.data?.units)
              ? filtersData.data.units
              : []
          )
        }
      } catch (error) {
        console.error('Error fetching unclassified controls:', error)
        if (!cancelled) {
          setForms([])
          setMappedUnits([])
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    fetchDashboardRacms()

    return () => {
      cancelled = true
    }
  }, [location.search])

  useEffect(() => {
    const query = new URLSearchParams(location.search || '')
    const activeParam = query.get('active')
    const statusParam = String(query.get('status') || '').trim()

    setFilterActive(activeParam === 'true' ? 'active' : activeParam === 'false' ? 'inactive' : 'all')
    setFilterBusinessProcess(query.get('business_process') || 'all')
    setFilterUnit(query.get('unit_id') || 'all')
    setFilterFinancialYear(query.get('financial_year') || 'all')
    setFilterApprovalStatus(
      statusParam
        ? statusParam.charAt(0).toUpperCase() + statusParam.slice(1).toLowerCase()
        : 'all'
    )
    setFilterConclusion(query.get('conclusion') || 'all')
  }, [location.search])

  const unitOptions = [...new Map(
    (mappedUnits.length > 0 ? mappedUnits : forms || [])
      .map((unitLike) => {
        const unitId = String(unitLike?.unit_id || '').trim()
        if (!unitId) return null
        const unitName = String(unitLike?.unit_name || '').trim() || unitId
        return [unitId, { unitId, unitName }]
      })
      .filter(Boolean)
  ).values()].sort((a, b) => a.unitName.localeCompare(b.unitName))

  const financialYearOptions = [...new Set(
    (forms || [])
      .map((form) => String(form?.financial_year || '').trim())
      .filter(Boolean)
  )].sort((a, b) => b.localeCompare(a))

  const businessProcessOptions = [...new Set(
    (forms || [])
      .map((form) => String(getFieldValue(form, 'business_process', 'businessProcess') || '').trim())
      .filter(Boolean)
  )].sort((a, b) => a.localeCompare(b))

  const conclusionOptions = [...new Set(
    (forms || [])
      .map((form) => {
        const rawConclusion = String(form?.control_design_conclusion || '').trim()
        return rawConclusion
          ? rawConclusion.charAt(0).toUpperCase() + rawConclusion.slice(1).toLowerCase()
          : 'None'
      })
  )].sort((a, b) => {
    if (a === 'None') return 1
    if (b === 'None') return -1
    return a.localeCompare(b)
  })

  const dashboardFilters = {
    active: filterActive,
    businessProcess: filterBusinessProcess,
    financialYear: filterFinancialYear,
    approvalStatus: filterApprovalStatus,
    unit: filterUnit,
    conclusion: filterConclusion,
  }

  const filteredForms = (forms || []).filter((form) => {
    return matchesDashboardFilters(form, dashboardFilters)
  })

  const summaryRows = createUnclassifiedSummaryRows(filteredForms)
    .sort((left, right) => left.businessProcess.localeCompare(right.businessProcess))
  const totalUnclassifiedControls = countUnclassifiedControls(filteredForms)

  const getDialogForms = (businessProcess, categoryKey) => (
    filteredForms.filter((form) => {
      const flags = getUnclassifiedFlags(form)
      if (!flags.isUnclassified) {
        return false
      }

      if (businessProcess !== 'Total') {
        const currentBusinessProcess = String(getFieldValue(form, 'business_process', 'businessProcess') || '').trim() || 'Unassigned'
        if (currentBusinessProcess !== businessProcess) {
          return false
        }
      }

      if (categoryKey === 'total') {
        return true
      }

      if (categoryKey === 'key') {
        return flags.key
      }

      if (categoryKey === 'nature') {
        return flags.nature
      }

      if (categoryKey === 'type') {
        return flags.type
      }

      return false
    })
  )

  const getCategoryDistinctValues = (formsForDialog, categoryKey) => {
    const valuesByCategory = {
      key: [],
      nature: [],
      type: [],
    }

    ;(formsForDialog || []).forEach((form) => {
      const flags = getUnclassifiedFlags(form)
      const keyValue = String(getFieldValue(form, 'key_control', 'keyControl') || '').trim() || 'Empty'
      const natureValue = String(getFieldValue(form, 'nature_of_control', 'natureOfControl') || '').trim() || 'Empty'
      const typeValue = String(getFieldValue(form, 'control_type_ma', 'controlTypeMa') || '').trim() || 'Empty'

      if (flags.key) valuesByCategory.key.push(keyValue)
      if (flags.nature) valuesByCategory.nature.push(natureValue)
      if (flags.type) valuesByCategory.type.push(typeValue)
    })

    const toDistinct = (values) => [...new Set(values.filter(Boolean))]

    if (categoryKey === 'total') {
      return {
        key: toDistinct(valuesByCategory.key),
        nature: toDistinct(valuesByCategory.nature),
        type: toDistinct(valuesByCategory.type),
      }
    }

    return {
      [categoryKey]: toDistinct(valuesByCategory[categoryKey] || []),
    }
  }

  const handleCellClick = (businessProcess, categoryKey, dialogTitle) => {
    const matchingForms = getDialogForms(businessProcess, categoryKey)
    setSelectedDialog({
      businessProcess,
      categoryKey,
      dialogTitle,
      forms: matchingForms,
      distinctValues: getCategoryDistinctValues(matchingForms, categoryKey),
    })
  }

  const openControlForm = (formId) => {
    const normalizedFormId = String(formId || '').trim()
    if (!normalizedFormId) return
    window.open(`/company-co/form/${encodeURIComponent(normalizedFormId)}`, '_blank', 'noopener,noreferrer')
  }

  const tableColumns = [
    { key: 'businessProcess', label: 'Business Process' },
    { key: 'totalUnclassifiedControls', label: 'Total Unclassified Controls', dialogKey: 'total' },
    { key: 'keyNonKeyControls', label: 'Key / Non-Key Controls', dialogKey: 'key' },
    { key: 'preventiveDetectiveControls', label: 'Preventive / Detective Controls', dialogKey: 'nature' },
    { key: 'automatedManualControls', label: 'Automated / Manual Controls', dialogKey: 'type' },
  ]

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
            Unclassified Controls
          </Typography>
          <Typography variant="body2" sx={PAGE_SUBHEADER_TEXT_SX}>
            Each count indicates a control that is not classified in that particular category.
          </Typography>
        </Box>
        <Button variant="contained" onClick={() => navigate(`/company-co/dashboard${location.search || ''}`)}>
          Back To Dashboard
        </Button>
      </Box>

      <Box
        sx={{
          mb: 3,
          display: 'flex',
          flexWrap: 'nowrap',
          overflowX: 'auto',
          overflowY: 'visible',
          alignItems: 'flex-start',
          gap: 2,
          pt: 0.5,
          pb: 0.5,
        }}
      >
        <FormControl variant="outlined" size="small" sx={{ minWidth: FILTER_DROPDOWN_MIN_WIDTH_LG, maxWidth: FILTER_DROPDOWN_MIN_WIDTH_LG, flex: '0 0 auto' }}>
          <InputLabel id="unclassified-business-process-filter-label">Business Process</InputLabel>
          <Select
            labelId="unclassified-business-process-filter-label"
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

        <FormControl variant="outlined" size="small" sx={{ minWidth: FILTER_DROPDOWN_MIN_WIDTH_LG, maxWidth: FILTER_DROPDOWN_MIN_WIDTH_LG, flex: '0 0 auto' }}>
          <InputLabel id="unclassified-financial-year-filter-label">Financial Year</InputLabel>
          <Select
            labelId="unclassified-financial-year-filter-label"
            value={filterFinancialYear}
            label="Financial Year"
            onChange={(event) => setFilterFinancialYear(event.target.value)}
          >
            <MenuItem value="all">All</MenuItem>
            {financialYearOptions.map((year) => (
              <MenuItem key={year} value={year}>
                {year}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl variant="outlined" size="small" sx={{ minWidth: FILTER_DROPDOWN_MIN_WIDTH_LG, maxWidth: FILTER_DROPDOWN_MIN_WIDTH_LG, flex: '0 0 auto' }}>
          <InputLabel id="unclassified-active-filter-label">Activity</InputLabel>
          <Select
            labelId="unclassified-active-filter-label"
            value={filterActive}
            label="Activity"
            onChange={(event) => setFilterActive(event.target.value)}
          >
            <MenuItem value="all">All</MenuItem>
            <MenuItem value="active">Active</MenuItem>
            <MenuItem value="inactive">Inactive</MenuItem>
          </Select>
        </FormControl>

        <FormControl variant="outlined" size="small" sx={{ minWidth: FILTER_DROPDOWN_MIN_WIDTH_LG, maxWidth: FILTER_DROPDOWN_MIN_WIDTH_LG, flex: '0 0 auto' }}>
          <InputLabel id="unclassified-approval-filter-label">Approval Status</InputLabel>
          <Select
            labelId="unclassified-approval-filter-label"
            value={filterApprovalStatus}
            label="Approval Status"
            onChange={(event) => setFilterApprovalStatus(event.target.value)}
          >
            <MenuItem value="all">All</MenuItem>
            <MenuItem value="Approved">Approved</MenuItem>
            <MenuItem value="Rejected">Rejected</MenuItem>
            <MenuItem value="Pending">Pending</MenuItem>
            <MenuItem value="Sent for Approval">Sent for Approval</MenuItem>
          </Select>
        </FormControl>

        <FormControl variant="outlined" size="small" sx={{ minWidth: FILTER_DROPDOWN_MIN_WIDTH_LG, maxWidth: FILTER_DROPDOWN_MIN_WIDTH_LG, flex: '0 0 auto' }}>
          <InputLabel id="unclassified-conclusion-filter-label">Conclusion</InputLabel>
          <Select
            labelId="unclassified-conclusion-filter-label"
            value={filterConclusion}
            label="Conclusion"
            onChange={(event) => setFilterConclusion(event.target.value)}
          >
            <MenuItem value="all">All</MenuItem>
            {conclusionOptions.map((option) => (
              <MenuItem key={option} value={option}>
                {option}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl variant="outlined" size="small" sx={{ minWidth: FILTER_DROPDOWN_MIN_WIDTH_LG, maxWidth: FILTER_DROPDOWN_MIN_WIDTH_LG, flex: '0 0 auto' }}>
          <InputLabel id="unclassified-unit-filter-label">Unit</InputLabel>
          <Select
            labelId="unclassified-unit-filter-label"
            value={filterUnit}
            label="Unit"
            onChange={(event) => setFilterUnit(event.target.value)}
          >
            <MenuItem value="all">All</MenuItem>
            {unitOptions.map((unit) => (
              <MenuItem key={unit.unitId} value={unit.unitId}>
                {unit.unitName}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
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
        {/* <Box
          sx={{
            px: 3,
            pt: 3,
            pb: 2,
            borderBottom: `1px solid ${theme.palette.divider}`,
          }}
        >
          <Typography variant="h6" sx={{ fontWeight: 700, color: theme.palette.text.primary }}>
             Business Process
          </Typography>
        </Box> */}

        <Box sx={{ width: '100%', overflowX: 'auto' }}>
          <Box sx={{ minWidth: `calc(${SUMMARY_PROCESS_COLUMN_MIN_WIDTH}px + ${SUMMARY_COLUMN_MIN_WIDTH}px * 4)` }}>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: `${SUMMARY_PROCESS_COLUMN_MIN_WIDTH}px repeat(4, minmax(${SUMMARY_COLUMN_MIN_WIDTH}px, 1fr))`,
                borderBottom: `1px solid ${theme.palette.divider}`,
                backgroundColor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.03)' : theme.palette.grey[100],
              }}
            >
              {tableColumns.map((column) => (
                <Box
                  key={column.key}
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
                    {column.label}
                  </Typography>
                </Box>
              ))}
            </Box>

            {loading ? (
              <Box sx={{ px: 3, py: 4 }}>
                <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>
                  Loading unclassified controls...
                </Typography>
              </Box>
            ) : summaryRows.length === 0 ? (
              <Box sx={{ px: 3, py: 4 }}>
                <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>
                  No unclassified controls found.
                </Typography>
              </Box>
            ) : (
              <>
                {summaryRows.map((row, index) => (
                  <Box
                    key={row.businessProcess}
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: `${SUMMARY_PROCESS_COLUMN_MIN_WIDTH}px repeat(4, minmax(${SUMMARY_COLUMN_MIN_WIDTH}px, 1fr))`,
                      borderBottom: `1px solid ${theme.palette.divider}`,
                      backgroundColor: index % 2 === 0
                        ? 'transparent'
                        : theme.palette.mode === 'dark'
                          ? 'rgba(255,255,255,0.02)'
                          : theme.palette.grey[50],
                    }}
                  >
                    {tableColumns.map((column, valueIndex) => {
                      const value = row[column.key]
                      const isClickable = Boolean(column.dialogKey)
                      return (
                      <Box
                        key={`${row.businessProcess}-${column.key}`}
                        component={isClickable ? 'button' : 'div'}
                        type={isClickable ? 'button' : undefined}
                        onClick={isClickable ? () => handleCellClick(row.businessProcess, column.dialogKey, column.label) : undefined}
                        sx={{
                          px: 2,
                          py: 1.75,
                          borderRight: `1px solid ${theme.palette.divider}`,
                          borderTop: 'none',
                          borderLeft: 'none',
                          borderBottom: 'none',
                          background: 'transparent',
                          cursor: isClickable ? 'pointer' : 'default',
                          textAlign: 'left',
                          width: '100%',
                          font: 'inherit',
                          '&:hover': isClickable ? {
                            backgroundColor: theme.palette.mode === 'dark' ? 'rgba(59,130,246,0.10)' : 'rgba(59,130,246,0.06)',
                          } : undefined,
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
                            textDecoration: isClickable ? 'underline' : 'none',
                            textUnderlineOffset: isClickable ? '3px' : undefined,
                          }}
                        >
                          {value}
                        </Typography>
                      </Box>
                      )
                    })}
                  </Box>
                ))}
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: `${SUMMARY_PROCESS_COLUMN_MIN_WIDTH}px repeat(4, minmax(${SUMMARY_COLUMN_MIN_WIDTH}px, 1fr))`,
                    backgroundColor: theme.palette.mode === 'dark'
                      ? 'rgba(255,255,255,0.04)'
                      : theme.palette.grey[100],
                  }}
                >
                  {[
                    { key: 'businessProcess', value: 'Total' },
                    { key: 'totalUnclassifiedControls', value: totalUnclassifiedControls, dialogKey: 'total', label: 'Total Unclassified Controls' },
                    { key: 'keyNonKeyControls', value: summaryRows.reduce((sum, row) => sum + row.keyNonKeyControls, 0), dialogKey: 'key', label: 'Key / Non-Key Controls' },
                    { key: 'preventiveDetectiveControls', value: summaryRows.reduce((sum, row) => sum + row.preventiveDetectiveControls, 0), dialogKey: 'nature', label: 'Preventive / Detective Controls' },
                    { key: 'automatedManualControls', value: summaryRows.reduce((sum, row) => sum + row.automatedManualControls, 0), dialogKey: 'type', label: 'Automated / Manual Controls' },
                  ].map((item, valueIndex) => (
                    <Box
                      key={`total-${item.key}`}
                      component={item.dialogKey ? 'button' : 'div'}
                      type={item.dialogKey ? 'button' : undefined}
                      onClick={item.dialogKey ? () => handleCellClick('Total', item.dialogKey, item.label) : undefined}
                      sx={{
                        px: 2,
                        py: 1.9,
                        borderRight: `1px solid ${theme.palette.divider}`,
                        borderTop: 'none',
                        borderLeft: 'none',
                        borderBottom: 'none',
                        background: 'transparent',
                        cursor: item.dialogKey ? 'pointer' : 'default',
                        textAlign: 'left',
                        width: '100%',
                        font: 'inherit',
                        '&:hover': item.dialogKey ? {
                          backgroundColor: theme.palette.mode === 'dark' ? 'rgba(59,130,246,0.10)' : 'rgba(59,130,246,0.06)',
                        } : undefined,
                        '&:last-of-type': {
                          borderRight: 'none',
                        },
                      }}
                    >
                      <Typography
                        variant="body2"
                        sx={{
                          color: theme.palette.text.primary,
                          fontWeight: 700,
                          whiteSpace: valueIndex === 0 ? 'normal' : 'nowrap',
                          textDecoration: item.dialogKey ? 'underline' : 'none',
                          textUnderlineOffset: item.dialogKey ? '3px' : undefined,
                        }}
                      >
                        {item.value}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              </>
            )}
          </Box>
        </Box>
      </Paper>

      <Dialog
        open={Boolean(selectedDialog)}
        onClose={() => setSelectedDialog(null)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle sx={{ fontWeight: 700 }}>
          {selectedDialog ? `${selectedDialog.dialogTitle} - ${selectedDialog.businessProcess}` : 'Unclassified Controls'}
        </DialogTitle>
        <DialogContent dividers>
          {selectedDialog?.forms?.length ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
              <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>
                Click a control number to open the control form in a new window.
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {selectedDialog.forms.map((form) => {
                  const formId = getFieldValue(form, 'form_id', 'formId')
                  const controlNumber = String(getFieldValue(form, 'control_number', 'controlNumber') || '').trim() || 'Unassigned'

                  return (
                    <Button
                      key={`${String(formId || '')}-${controlNumber}`}
                      variant="outlined"
                      onClick={() => openControlForm(formId)}
                      sx={{ textTransform: 'none' }}
                    >
                      {controlNumber}
                    </Button>
                  )
                })}
              </Box>
              {selectedDialog?.distinctValues ? (
                <Box sx={{ mt: 1.5, display: 'flex', flexDirection: 'column', gap: 1.25 }}>
                  {Object.entries(selectedDialog.distinctValues).map(([categoryKey, values]) => {
                    if (!Array.isArray(values) || values.length === 0) return null
                    const labelByCategory = {
                      key: 'Distinct Key / Non-Key values',
                      nature: 'Distinct Preventive / Detective values',
                      type: 'Distinct Automated / Manual values',
                    }
                    return (
                      <Box key={categoryKey} sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                        <Typography variant="body2" sx={{ color: theme.palette.text.secondary, fontWeight: 600 }}>
                          {labelByCategory[categoryKey] || 'Distinct Values'}
                        </Typography>
                        <Box
                          sx={{
                            display: 'flex',
                            gap: 1,
                            overflowX: 'auto',
                            pb: 0.5,
                            pr: 0.5,
                            '&::-webkit-scrollbar': {
                              height: 8,
                            },
                          }}
                        >
                          {values.map((value) => (
                            <Box
                              key={`${categoryKey}-${value}`}
                              sx={{
                                px: 1.25,
                                py: 0.75,
                                borderRadius: 999,
                                border: `1px solid ${theme.palette.divider}`,
                                backgroundColor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.05)' : theme.palette.grey[100],
                                whiteSpace: 'nowrap',
                                flexShrink: 0,
                              }}
                            >
                              <Typography variant="caption" sx={{ color: theme.palette.text.primary }}>
                                {value}
                              </Typography>
                            </Box>
                          ))}
                        </Box>
                      </Box>
                    )
                  })}
                </Box>
              ) : null}
            </Box>
          ) : (
            <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>
              No unclassified controls found for this selection.
            </Typography>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setSelectedDialog(null)}>
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

export default UnclassifiedControls
