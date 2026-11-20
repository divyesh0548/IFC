import React from 'react'
import { useNavigate } from 'react-router-dom'
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded'
import { Box, Button, Paper, Typography } from '@mui/material'
import RacmExportOptions from '../../components/reports/RacmExportOptions'
import {
  DASHBOARD_PAGE_OUTER_SX,
  DASHBOARD_PAPER_SX,
  PAGE_SUBHEADER_TEXT_SX,
} from '../../uiConstants'

export default function ApproverIfcReport() {
  const navigate = useNavigate()

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
              RACM Export
            </Typography>
            <Typography sx={PAGE_SUBHEADER_TEXT_SX}>
              Export RACMs assigned to you as an approver. Closed cycles are approved by default.
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <RacmExportOptions
              endpoint="/api/approver/ifc-report/export"
              unitsEndpoint="/api/approver/ifc-report/export-units"
            />
            <Button
              variant="outlined"
              startIcon={<ArrowBackRoundedIcon />}
              onClick={() => navigate('/approver/dashboard')}
            >
              Back
            </Button>
          </Box>
        </Box>
      </Paper>
    </Box>
  )
}
