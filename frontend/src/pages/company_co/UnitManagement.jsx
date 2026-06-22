import React from 'react'
import { alpha, useTheme } from '@mui/material/styles'
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'

function UnitManagement() {
  const theme = useTheme()

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, py: 2 }}>
      <Paper
        elevation={0}
        sx={{
          p: { xs: 2.5, sm: 3 },
          borderRadius: 3,
          border: '1px solid',
          borderColor: theme.palette.mode === 'light'
            ? alpha(theme.palette.divider, 0.9)
            : alpha('#0f172a', 0.72),
          backgroundColor: alpha(theme.palette.background.paper, 0.96),
          boxShadow: theme.palette.mode === 'dark'
            ? '0 10px 24px rgba(0, 0, 0, 0.16)'
            : '0 10px 24px rgba(15, 23, 42, 0.05)',
        }}
      >
        <Typography
          component="h1"
          sx={{
            fontSize: { xs: '1.45rem', sm: '1.7rem' },
            fontWeight: 850,
            color: 'text.primary',
            lineHeight: 1.15,
          }}
        >
          Unit Management
        </Typography>
        <Typography
          sx={{
            mt: 1.25,
            color: 'text.secondary',
            fontSize: '1rem',
            lineHeight: 1.7,
          }}
        >
          Coordinator do not have rights for Unit Management
        </Typography>
      </Paper>
    </Box>
  )
}

export default UnitManagement
