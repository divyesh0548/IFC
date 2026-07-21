import React from 'react'
import { useNavigate } from 'react-router-dom'
import { useTheme } from '@mui/material/styles'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import Stack from '@mui/material/Stack'
import Divider from '@mui/material/Divider'
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded'
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded'
import {
  DASHBOARD_PAGE_OUTER_SX,
  DASHBOARD_PAPER_SX,
  PAGE_SUBHEADER_TEXT_SX,
} from '../../uiConstants'

const EMPTY_REPORT = {
  conclusions: {
    effective: 0,
    not_effective: 0,
    accepted_under_deviation: 0,
  },
  approval_statuses: {
    pending: 0,
    approved: 0,
    rejected: 0,
  },
  units: [],
  response_timing: {
    average_ms: null,
    average_label: 'N/A',
    pair_count: 0,
    form_count: 0,
  },
}

function CompactStatRow({ items }) {
  return (
    <Paper
      elevation={0}
      sx={{
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 2,
        overflow: 'hidden',
      }}
    >
      <Stack divider={<Divider flexItem />} sx={{ width: '100%' }}>
        {items.map((item) => (
          <Box
            key={item.label}
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 2,
              px: 2,
              py: 1.5,
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, minWidth: 0 }}>
              <Box
                sx={{
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                  flexShrink: 0,
                  backgroundColor: item.color,
                }}
              />
              <Typography sx={{ fontWeight: 700, minWidth: 0 }}>
                {item.label}
              </Typography>
            </Box>
            <Typography sx={{ fontSize: '1.35rem', fontWeight: 800, lineHeight: 1 }}>
              {item.value}
            </Typography>
          </Box>
        ))}
      </Stack>
    </Paper>
  )
}

function Section({ title, description, children }) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <Box>
        <Typography sx={{ fontSize: '1.05rem', fontWeight: 800 }}>
          {title}
        </Typography>
        {description ? (
          <Typography sx={{ ...PAGE_SUBHEADER_TEXT_SX, mt: 0.5, mb: 0 }}>
            {description}
          </Typography>
        ) : null}
      </Box>
      {children}
    </Box>
  )
}

function IfcReportView({
  title = 'IFC Report',
  subtitle = 'Live aggregates for conclusions, approval status, unit totals, and average process-owner response timing.',
  backPath,
  data,
  loading = false,
  error = '',
  onRefresh,
}) {
  const theme = useTheme()
  const navigate = useNavigate()
  const report = data || EMPTY_REPORT
  const units = Array.isArray(report.units) ? report.units : []
  const timing = report.response_timing || EMPTY_REPORT.response_timing
  const conclusionItems = [
    {
      label: 'Effective',
      value: Number(report.conclusions?.effective ?? 0),
      color: theme.palette.success.main,
    },
    {
      label: 'Accepted Under Deviation',
      value: Number(report.conclusions?.accepted_under_deviation ?? 0),
      color: theme.palette.warning.main,
    },
    {
      label: 'Not Effective',
      value: Number(report.conclusions?.not_effective ?? 0),
      color: theme.palette.error.main,
    },
  ]
  const approvalItems = [
    {
      label: 'Pending',
      value: Number(report.approval_statuses?.pending ?? 0),
      color: theme.palette.warning.main,
    },
    {
      label: 'Approved',
      value: Number(report.approval_statuses?.approved ?? 0),
      color: theme.palette.success.main,
    },
    {
      label: 'Rejected',
      value: Number(report.approval_statuses?.rejected ?? 0),
      color: theme.palette.error.main,
    },
  ]

  return (
    <Box sx={DASHBOARD_PAGE_OUTER_SX}>
      <Paper elevation={3} sx={{ ...DASHBOARD_PAPER_SX, p: { xs: 2.5, sm: 3 } }}>
        <Box
          sx={{
            display: 'flex',
            alignItems: { xs: 'stretch', sm: 'flex-start' },
            justifyContent: 'space-between',
            flexDirection: { xs: 'column', sm: 'row' },
            gap: 1.5,
            mb: 3,
          }}
        >
          <Box>
            <Typography variant="h5" component="h1" sx={{ fontWeight: 800, mb: 0.5 }}>
              {title}
            </Typography>
            <Typography sx={PAGE_SUBHEADER_TEXT_SX}>
              {subtitle}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            {backPath ? (
              <Button
                variant="outlined"
                startIcon={<ArrowBackRoundedIcon />}
                onClick={() => navigate(backPath)}
                disabled={loading}
              >
                Back
              </Button>
            ) : null}
            <Button
              variant="contained"
              color="secondary"
              startIcon={<RefreshRoundedIcon />}
              onClick={onRefresh}
              disabled={loading || !onRefresh}
            >
              {loading ? 'Refreshing...' : 'Refresh'}
            </Button>
          </Box>
        </Box>

        {error ? (
          <Alert severity="error" sx={{ mb: 2.5 }}>
            {error}
          </Alert>
        ) : null}

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3.5 }}>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', lg: 'repeat(2, minmax(0, 1fr))' },
              gap: 2,
            }}
          >
            <Section
              title="Design conclusions"
              // description="Counts from control design conclusion across scoped RACMs."
            >
              <CompactStatRow items={conclusionItems} />
            </Section>

            <Section
              title="Approval status"
              // description="Pending includes RACMs not sent and sent for approval."
            >
              <CompactStatRow items={approvalItems} />
            </Section>
          </Box>

                     {/* Average Response Time */}
                     <Section
            title="Average Response Time"
          >
            <Box
              sx={{
                display: 'inline-flex',
                alignItems: 'baseline',
                gap: 0.75,
                width: 'fit-content',
                maxWidth: '100%',
                py: 0.8,
                borderBottom: '1px solid',
                borderBottomColor: 'divider',
                flexWrap: 'wrap',
              }}
            >
              <Typography component="span" sx={{ fontSize: '0.98rem', fontWeight: 600, color: 'text.primary' }}>
                Average duration
              </Typography>
              <Typography component="span" sx={{ fontSize: '1.18rem', fontWeight: 850, color: 'text.primary', lineHeight: 1.1 }}>
                {timing.average_label || 'N/A'}
              </Typography>
              <Typography component="span" sx={{ fontSize: '0.92rem', color: 'text.secondary' }}>
                across
              </Typography>
              <Typography component="span" sx={{ fontSize: '1.18rem', fontWeight: 850, color: 'text.primary', lineHeight: 1.1 }}>
                {Number(timing.pair_count || 0)}
              </Typography>
              <Typography component="span" sx={{ fontSize: '0.92rem', color: 'text.secondary' }}>
                controls
              </Typography>
            </Box>
            {!loading && Number(timing.pair_count || 0) === 0 ? (
              <Typography sx={{ color: 'text.secondary', fontSize: '0.9rem' }}>
                No matching assignment → sent-for-approval pairs were found in the scoped audit log.
              </Typography>
            ) : null}
          </Section>

          {/* Users/RACMs Count */}
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: '1fr',
              gap: 2,
              alignItems: 'start',
            }}
          >
            <Section
              title="Users/RACMs Count"
            >
              {units.length === 0 ? (
                <Typography color="text.secondary">No units in scope.</Typography>
              ) : (
                <Stack
                  component="ul"
                  spacing={0.75}
                  sx={{
                    listStyle: 'none',
                    m: 0,
                    p: 0,
                    alignItems: 'flex-start',
                  }}
                >
                  {units.map((unit) => (
                    <Box
                      component="li"
                      key={unit.unit_id || unit.unit_name}
                      sx={{
                        display: 'inline-flex',
                        alignItems: 'baseline',
                        gap: 0.75,
                        maxWidth: '100%',
                        py: 0.8,
                        borderBottom: '1px solid',
                        borderColor: 'divider',
                        flexWrap: 'wrap',
                      }}
                    >
                      <Typography component="span" sx={{ fontSize: '0.98rem', fontWeight: 600, color: 'text.primary' }}>
                        {unit.unit_name || unit.unit_id || 'Unknown unit'} :
                      </Typography>
                      <Typography component="span" sx={{ fontSize: '0.94rem', color: 'text.secondary' }}>
                        <Box component="span" sx={{ fontSize: '1.14rem', fontWeight: 850, color: 'text.primary', mr: 0.35 }}>
                          {Number(unit.total_users || 0)}
                        </Box>
                        users
                      </Typography>
                      <Typography component="span" sx={{ color: 'divider' }}>
                        /
                      </Typography>
                      <Typography component="span" sx={{ fontSize: '0.94rem', color: 'text.secondary' }}>
                        <Box component="span" sx={{ fontSize: '1.14rem', fontWeight: 850, color: 'text.primary', mr: 0.35 }}>
                          {Number(unit.total_racms || 0)}
                        </Box>
                        RACMs
                      </Typography>
                    </Box>
                  ))}
                </Stack>
              )}
            </Section>
          </Box>

        </Box>
      </Paper>
    </Box>
  )
}

export default IfcReportView
