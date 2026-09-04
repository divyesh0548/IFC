import React from 'react'
import { Link as RouterLink } from 'react-router-dom'
import Breadcrumbs from '@mui/material/Breadcrumbs'
import Link from '@mui/material/Link'
import Typography from '@mui/material/Typography'
import NavigateNextIcon from '@mui/icons-material/NavigateNext'

/**
 * Lightweight MUI breadcrumbs for selected pages (trial UI).
 * items: [{ label, to? }] — last item is current page (muted, no link).
 */
function AppBreadcrumbs({ items = [], sx }) {
  if (!Array.isArray(items) || items.length === 0) return null

  return (
    <Breadcrumbs
      aria-label="breadcrumb"
      separator={<NavigateNextIcon fontSize="small" sx={{ color: 'text.disabled' }} />}
      sx={{
        mb: 1.5,
        '& .MuiBreadcrumbs-ol': { flexWrap: 'wrap' },
        ...sx,
      }}
    >
      {items.map((item, index) => {
        const isLast = index === items.length - 1
        const label = item?.label || ''
        if (!isLast && item?.to) {
          return (
            <Link
              key={`${label}-${item.to}`}
              component={RouterLink}
              to={item.to}
              underline="hover"
              color="text.primary"
              sx={{ fontSize: '0.875rem', fontWeight: 700 }}
            >
              {label}
            </Link>
          )
        }
        return (
          <Typography
            key={`${label}-current`}
            color="text.secondary"
            sx={{ fontSize: '0.875rem', fontWeight: 500 }}
          >
            {label}
          </Typography>
        )
      })}
    </Breadcrumbs>
  )
}

export default AppBreadcrumbs
