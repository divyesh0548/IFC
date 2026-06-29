import React from 'react'
import Box from '@mui/material/Box'

export default function CustomColumnDot({ size = 8 }) {
  return (
    <Box
      component="span"
      sx={{
        display: 'inline-block',
        width: size,
        height: size,
        borderRadius: '50%',
        backgroundColor: '#f59e0b',
        flexShrink: 0,
      }}
    />
  )
}
