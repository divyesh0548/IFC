import React from 'react'
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import {
  DASHBOARD_PAGE_OUTER_SX,
  MANAGEMENT_PAGE_ACTIONS_SX,
  MANAGEMENT_PAGE_HEADER_SX,
  MANAGEMENT_PAGE_SHELL_SX,
  MANAGEMENT_PAGE_SUBTITLE_SX,
  MANAGEMENT_PAGE_TITLE_SX,
} from '../uiConstants'

/**
 * Standard management-page chrome (aligned with company_admin/user-management):
 * transparent shell, divider header (title + subtitle + actions), then children.
 */
function ManagementPageHeader({
  title,
  subtitle,
  actions = null,
  children,
  outerSx,
  headerSx,
}) {
  return (
    <Box sx={{ ...DASHBOARD_PAGE_OUTER_SX, ...outerSx }}>
      <Paper elevation={0} sx={MANAGEMENT_PAGE_SHELL_SX}>
        <Box sx={{ ...MANAGEMENT_PAGE_HEADER_SX, ...headerSx }}>
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography component="h1" sx={MANAGEMENT_PAGE_TITLE_SX}>
              {title}
            </Typography>
            {subtitle ? (
              <Typography sx={MANAGEMENT_PAGE_SUBTITLE_SX}>
                {subtitle}
              </Typography>
            ) : null}
          </Box>
          {actions ? (
            <Box sx={MANAGEMENT_PAGE_ACTIONS_SX}>
              {actions}
            </Box>
          ) : null}
        </Box>
        {children}
      </Paper>
    </Box>
  )
}

export default ManagementPageHeader
