import React, { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useTheme } from '@mui/material/styles'
import Button from '@mui/material/Button'
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import { PAGE_SUBHEADER_TEXT_SX } from '../../uiConstants'
import { useSyncGlobalLoading } from '../../contexts/GlobalLoadingContext'
import { apiUrl } from '../../config/api'
import {
  createUnclassifiedSummaryRows,
  countUnclassifiedControls,
} from './dashboardClassificationUtils'

const SUMMARY_COLUMN_MIN_WIDTH = 160
const SUMMARY_PROCESS_COLUMN_MIN_WIDTH = 260

function UnclassifiedControls() {
  const theme = useTheme()
  const navigate = useNavigate()
  const location = useLocation()
  const [loading, setLoading] = useState(true)
  const [forms, setForms] = useState([])
  useSyncGlobalLoading(loading)

  useEffect(() => {
    let cancelled = false

    const fetchDashboardRacms = async () => {
      setLoading(true)
      try {
        const response = await fetch(apiUrl(`/api/company-co/dashboard/racms${location.search || ''}`), {
          credentials: 'include',
        })
        const data = await response.json()

        if (!response.ok || !data?.success) {
          throw new Error(data?.message || 'Failed to fetch unclassified controls')
        }

        if (!cancelled) {
          setForms(Array.isArray(data.data) ? data.data : [])
        }
      } catch (error) {
        console.error('Error fetching unclassified controls:', error)
        if (!cancelled) {
          setForms([])
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

  const summaryRows = createUnclassifiedSummaryRows(forms)
    .sort((left, right) => left.businessProcess.localeCompare(right.businessProcess))
  const totalUnclassifiedControls = countUnclassifiedControls(forms)

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
            Unclassified Controls
          </Typography>
          <Typography variant="body2" sx={PAGE_SUBHEADER_TEXT_SX}>
            Each count indicates a control that is not classified in that particular category.
          </Typography>
        </Box>
        <Button variant="contained" onClick={() => navigate(`/company_co/dashboard${location.search || ''}`)}>
          Back To Dashboard
        </Button>
      </Box>

      <Paper
        elevation={3}
        sx={{
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
              {[
                'Business Process',
                'Total Unclassified Controls',
                'Key / Non-Key Controls',
                'Preventive / Detective Controls',
                'Automated / Manual Controls',
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
                    {[
                      row.businessProcess,
                      row.totalUnclassifiedControls,
                      row.keyNonKeyControls,
                      row.preventiveDetectiveControls,
                      row.automatedManualControls,
                    ].map((value, valueIndex) => (
                      <Box
                        key={`${row.businessProcess}-${valueIndex}`}
                        sx={{
                          px: 2,
                          py: 1.75,
                          borderRight: `1px solid ${theme.palette.divider}`,
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
                    'Total',
                    totalUnclassifiedControls,
                    summaryRows.reduce((sum, row) => sum + row.keyNonKeyControls, 0),
                    summaryRows.reduce((sum, row) => sum + row.preventiveDetectiveControls, 0),
                    summaryRows.reduce((sum, row) => sum + row.automatedManualControls, 0),
                  ].map((value, valueIndex) => (
                    <Box
                      key={`total-${valueIndex}`}
                      sx={{
                        px: 2,
                        py: 1.9,
                        borderRight: `1px solid ${theme.palette.divider}`,
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
                        }}
                      >
                        {value}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              </>
            )}
          </Box>
        </Box>
      </Paper>
    </Box>
  )
}

export default UnclassifiedControls
