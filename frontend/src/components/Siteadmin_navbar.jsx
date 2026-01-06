import React from 'react'
import { useTheme } from '@mui/material/styles'
import AppBar from '@mui/material/AppBar'
import Toolbar from '@mui/material/Toolbar'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Box from '@mui/material/Box'

function Navbar({ onLogout, header = 'Site Admin' }) {
  const theme = useTheme()
  
  return (
    <AppBar 
      position="static"
      elevation={0}
      sx={{
        backgroundColor: '#ffffff', // White background
        color: theme.palette.text.primary,
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
      }}
    >
      <Toolbar sx={{ maxWidth: '1280px', width: '100%', mx: 'auto', px: { xs: 2, sm: 3, lg: 4 } }}>
        <Box sx={{ flexGrow: 1, display: 'flex', alignItems: 'center' }}>
          <Typography 
            variant="h6" 
            component="h1"
            sx={{ 
              fontWeight: 700,
              color: 'text.primary',
            }}
          >
            {header}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <Button
            onClick={onLogout}
            variant="contained"
            color="secondary"
            sx={{
              backgroundColor: theme.palette.secondary.main,
              color: theme.palette.secondary.contrastText,
              '&:hover': {
                backgroundColor: theme.palette.secondary.dark,
              },
            }}
          >
            Logout
          </Button>
        </Box>
      </Toolbar>
    </AppBar>
  )
}

export default Navbar

