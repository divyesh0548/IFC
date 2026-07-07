import React, { useMemo } from 'react'
import { alpha, useTheme } from '@mui/material/styles'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import CircularProgress from '@mui/material/CircularProgress'
import Paper from '@mui/material/Paper'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Typography from '@mui/material/Typography'
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded'
import { DASHBOARD_PAGE_OUTER_SX, DASHBOARD_PAPER_SX, TABLE_HEADER_BG, TABLE_ROW_HOVER_BG } from '../../uiConstants'

function DetailRow({ label, value, multiline = false }) {
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: '1fr',
        gap: 0.45,
        py: 1.35,
        alignItems: multiline ? 'start' : 'center',
      }}
    >
      <Typography
        sx={{
          fontSize: '0.70rem',
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.02em',
          color: 'text.secondary',
        }}
      >
        {label}
      </Typography>
      <Typography
        sx={{
          fontSize: '1rem',
          fontWeight: 600,
          color: 'text.primary',
          lineHeight: multiline ? 1.7 : 1.5,
          whiteSpace: multiline ? 'pre-wrap' : 'normal',
          wordBreak: 'break-word',
        }}
      >
        {String(value || '').trim() || '-'}
      </Typography>
    </Box>
  )
}

function CompanyDetailsView({
  companyName,
  companyIdentifier,
  companyDetails = {},
  units = [],
  linkedUnitIds = [],
  showLinkedUnitLegend = false,
  loading = false,
  error = '',
}) {
  const theme = useTheme()
  const linkedUnitIdSet = useMemo(
    () => new Set(linkedUnitIds.map((value) => String(value || '').trim()).filter(Boolean)),
    [linkedUnitIds]
  )

  const detailItems = useMemo(() => ([
    ['Company Name', companyName || companyDetails?.company_name],
    ['Company Identifier', companyIdentifier],
    ['Registered Email', companyDetails?.registered_email],
    ['Unique Identification Number', companyDetails?.unique_identification_number],
    ['GST', companyDetails?.gst],
    ['PAN', companyDetails?.pan],
    ['Number of Corporate Offices', companyDetails?.number_of_corporate_offices],
    ['Number of Factory Units', companyDetails?.number_of_factory_units],
    ['Registered Address', companyDetails?.registered_address, true],
  ]), [companyDetails, companyIdentifier, companyName])

  const tableBorderColor = alpha(theme.palette.text.primary, theme.palette.mode === 'light' ? 0.14 : 0.18)
  const bodyCellSx = {
    py: 1.5,
    px: 2.25,
    borderBottom: `1px solid ${tableBorderColor}`,
    verticalAlign: 'middle',
    fontSize: '0.95rem',
  }
  const headCellSx = {
    ...bodyCellSx,
    py: 1.6,
    fontSize: '0.8rem',
    fontWeight: 800,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    color: 'text.secondary',
    backgroundColor: TABLE_HEADER_BG,
  }

  return (
    <Box sx={DASHBOARD_PAGE_OUTER_SX}>
      <Paper elevation={0} sx={{ ...DASHBOARD_PAPER_SX, p: 0, overflow: 'hidden' }}>
        <Box
          sx={{
            px: { xs: 2.5, sm: 3 },
            py: 2.5,
            borderBottom: '1px solid',
            borderColor: 'divider',
            background: `linear-gradient(180deg, ${alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.1 : 0.05)} 0%, transparent 100%)`,
          }}
        >
          <Typography component="h1" sx={{ fontSize: { xs: '1.45rem', sm: '1.7rem' }, fontWeight: 850, lineHeight: 1.15 }}>
            Company Details
          </Typography>
          <Typography sx={{ mt: 0.75, color: 'text.secondary', lineHeight: 1.7, maxWidth: 720 }}>
            Review company registration details and the current unit master from one place.
          </Typography>
        </Box>

        {error ? <Alert severity="error" sx={{ m: 2.5 }}>{error}</Alert> : null}

        {loading ? (
          <Box sx={{ px: 3, py: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1.5 }}>
            <CircularProgress size={24} />
            <Typography color="text.secondary">Loading company details...</Typography>
          </Box>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            <Box sx={{ px: { xs: 2.5, sm: 3 }, py: 3 }}>
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' },
                  columnGap: { xs: 2, md: 5 },
                  rowGap: 0,
                }}
              >
                {detailItems.map(([label, value, multiline]) => (
                  <Box
                    key={label}
                    sx={{
                      borderBottom: '1px solid',
                      borderColor: 'divider',
                      gridColumn: multiline ? '1 / -1' : 'auto',
                    }}
                  >
                    <DetailRow label={label} value={value} multiline={Boolean(multiline)} />
                  </Box>
                ))}
              </Box>
            </Box>

            <Box sx={{ px: { xs: 2.5, sm: 3 }, pb: 3 }}>
              <Box
                sx={{
                  display: 'flex',
                  alignItems: { xs: 'flex-start', sm: 'center' },
                  justifyContent: 'space-between',
                  flexDirection: { xs: 'column', sm: 'row' },
                  gap: 1.25,
                  mb: 2,
                }}
              >
                <Typography sx={{ fontSize: '1.02rem', fontWeight: 800, color: 'text.primary' }}>
                  Units
                </Typography>
                {showLinkedUnitLegend ? (
                  <Box
                    sx={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 0.75,
                      px: 1.25,
                      py: 0.65,
                      borderRadius: 999,
                      border: '1px solid',
                      borderColor: alpha(theme.palette.success.main, 0.28),
                      backgroundColor: alpha(theme.palette.success.main, theme.palette.mode === 'dark' ? 0.12 : 0.08),
                    }}
                  >
                    <CheckCircleRoundedIcon sx={{ fontSize: 18, color: 'success.main' }} />
                    <Typography sx={{ fontSize: '0.82rem', fontWeight: 600, color: 'text.secondary' }}>
                     Icon indicates the unit linked to your account.
                    </Typography>
                  </Box>
                ) : null}
              </Box>

              {units.length === 0 ? (
                <Box sx={{ py: 1 }}>
                  <Typography color="text.secondary">No units found for this company.</Typography>
                </Box>
              ) : (
                <TableContainer
                  component={Paper}
                  elevation={0}
                  sx={{
                    overflow: 'hidden',
                    borderRadius: 2,
                  }}
                >
                  <Table sx={{ minWidth: 720 }}>
                    <TableHead>
                      <TableRow>
                        {showLinkedUnitLegend ? (
                          <TableCell sx={{ ...headCellSx, width: 56, textAlign: 'center' }} aria-label="Linked unit" />
                        ) : null}
                        <TableCell sx={{ ...headCellSx, width: 80 }}>#</TableCell>
                        <TableCell sx={headCellSx}>Unit ID</TableCell>
                        <TableCell sx={headCellSx}>Unit Name</TableCell>
                        <TableCell sx={headCellSx}>Unit Address</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {units.map((unit, index) => {
                        const unitId = String(unit.unit_id || '').trim()
                        const isLinked = unitId && linkedUnitIdSet.has(unitId)

                        return (
                          <TableRow
                            key={unit.unit_id || unit.id || index}
                            sx={{
                              backgroundColor: isLinked
                                ? alpha(theme.palette.success.main, theme.palette.mode === 'dark' ? 0.08 : 0.05)
                                : 'transparent',
                              '&:hover': {
                                backgroundColor: isLinked
                                  ? alpha(theme.palette.success.main, theme.palette.mode === 'dark' ? 0.12 : 0.08)
                                  : TABLE_ROW_HOVER_BG,
                              },
                              '&:last-of-type td': {
                                borderBottom: 0,
                              },
                            }}
                          >
                            {showLinkedUnitLegend ? (
                              <TableCell sx={{ ...bodyCellSx, textAlign: 'center' }}>
                                {isLinked ? (
                                  <CheckCircleRoundedIcon
                                    sx={{ fontSize: 20, color: 'success.main' }}
                                    aria-label={`Linked unit: ${unit.unit_name || unitId}`}
                                  />
                                ) : null}
                              </TableCell>
                            ) : null}
                            <TableCell sx={bodyCellSx}>{index + 1}</TableCell>
                            <TableCell sx={bodyCellSx}>{unit.unit_id || '-'}</TableCell>
                            <TableCell sx={{ ...bodyCellSx, fontWeight: isLinked ? 700 : 600 }}>
                              {unit.unit_name || '-'}
                            </TableCell>
                            <TableCell sx={{ ...bodyCellSx, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                              {String(unit.unit_address || '').trim() || '-'}
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </Box>
          </Box>
        )}
      </Paper>
    </Box>
  )
}

export default CompanyDetailsView
