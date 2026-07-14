import React from 'react'
import { useNavigate } from 'react-router-dom'
import { useTheme } from '@mui/material/styles'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded'
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded'
import {
  DASHBOARD_PAGE_OUTER_SX,
  DASHBOARD_PAPER_SX,
  PAGE_SUBHEADER_TEXT_SX,
  TABLE_HEADER_BG,
  TABLE_ROW_HOVER_BG,
} from '../../uiConstants'

const EMPTY_REPORT = {
  conclusions: {
    effective: 0,
    not_effective: 0,
    accepted_under_deviation: 0,
  },
  approval_statuses: {
    pending: 0,
    sent_for_approval: 0,
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

function MetricCard({ label, value, helper }) {
  return (
    <Paper
      elevation={0}
      sx={{
        p: 2,
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 2,
        minHeight: 108,
        display: 'flex',
        flexDirection: 'column',
        gap: 0.75,
      }}
    >
      <Typography sx={{ fontSize: '0.78rem', fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        {label}
      </Typography>
      <Typography sx={{ fontSize: '1.75rem', fontWeight: 800, lineHeight: 1.15 }}>
        {value}
      </Typography>
      {helper ? (
        <Typography sx={{ fontSize: '0.82rem', color: 'text.secondary' }}>
          {helper}
        </Typography>
      ) : null}
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
          <Section
            title="Design conclusions"
            description="Counts from control design conclusion across scoped RACMs."
          >
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, minmax(0, 1fr))' },
                gap: 1.5,
              }}
            >
              <MetricCard label="Effective" value={report.conclusions?.effective ?? 0} />
              <MetricCard label="Not Effective" value={report.conclusions?.not_effective ?? 0} />
              <MetricCard label="Accepted Under Deviation" value={report.conclusions?.accepted_under_deviation ?? 0} />
            </Box>
          </Section>

          <Section
            title="Approval status"
            description="Pending (not sent), sent for approval, and rejected RACMs."
          >
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, minmax(0, 1fr))' },
                gap: 1.5,
              }}
            >
              <MetricCard label="Pending" value={report.approval_statuses?.pending ?? 0} />
              <MetricCard label="Sent for Approval" value={report.approval_statuses?.sent_for_approval ?? 0} />
              <MetricCard label="Rejected" value={report.approval_statuses?.rejected ?? 0} />
            </Box>
          </Section>

          <Section
            title="Users and RACMs per unit"
            description="Process owners linked via unit memberships, and all RACMs in each unit."
          >
            <TableContainer
              component={Paper}
              elevation={0}
              sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2 }}
            >
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ backgroundColor: TABLE_HEADER_BG }}>
                    <TableCell sx={{ fontWeight: 800 }}>Unit</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 800 }}>Total Users</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 800 }}>Total RACMs</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {units.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3}>
                        <Typography color="text.secondary">No units in scope.</Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    units.map((unit) => (
                      <TableRow
                        key={unit.unit_id || unit.unit_name}
                        sx={{ '&:hover': { backgroundColor: TABLE_ROW_HOVER_BG } }}
                      >
                        <TableCell>
                          <Typography sx={{ fontWeight: 600 }}>
                            {unit.unit_name || unit.unit_id || 'Unknown unit'}
                          </Typography>
                          {unit.unit_id ? (
                            <Typography sx={{ fontSize: '0.78rem', color: 'text.secondary' }}>
                              {unit.unit_id}
                            </Typography>
                          ) : null}
                        </TableCell>
                        <TableCell align="right">{Number(unit.total_users || 0)}</TableCell>
                        <TableCell align="right">{Number(unit.total_racms || 0)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Section>

          <Section
            title="Average user response timing"
            description='Average time between "RACM Assignment" and "Sent RACM for approval" in audit logs (first and second pairs when both exist).'
          >
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, minmax(0, 1fr))' },
                gap: 1.5,
              }}
            >
              <MetricCard
                label="Average duration"
                value={timing.average_label || 'N/A'}
                helper={timing.average_ms != null ? `${timing.average_ms} ms` : 'No paired events found'}
              />
              <MetricCard label="Timed pairs" value={Number(timing.pair_count || 0)} />
              <MetricCard
                label="Forms with pairs"
                value={Number(timing.form_count || 0)}
                helper={loading ? 'Loading latest counts...' : undefined}
              />
            </Box>
            {!loading && Number(timing.pair_count || 0) === 0 ? (
              <Typography sx={{ mt: 1, color: 'text.secondary', fontSize: '0.9rem' }}>
                No matching assignment → sent-for-approval pairs were found in the scoped audit log.
              </Typography>
            ) : null}
          </Section>
        </Box>

        <Typography sx={{ mt: 3, fontSize: '0.78rem', color: theme.palette.text.secondary }}>
          Counts are computed live when you open this page or click Refresh.
        </Typography>
      </Paper>
    </Box>
  )
}

export default IfcReportView
