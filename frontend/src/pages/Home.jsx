import React from 'react'
import { Link } from 'react-router-dom'
import { Box, Container, Typography, Button } from '@mui/material'

function Home() {
  return (
    <Box
      sx={{
        minHeight: '100vh',
        backgroundColor: 'background.default',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        px: 2,
      }}
    >
      <Container maxWidth="sm">
        <Box sx={{ textAlign: 'center' }}>
          <Typography
            variant="h2"
            component="h1"
            sx={{
              fontWeight: 700,
              mb: 4,
              color: 'secondary.main',
            }}
          >
            IFC
          </Typography>
          <Typography
            variant="h5"
            component="p"
            sx={{
              mb: 6,
              color: 'text.secondary',
            }}
          >
            Welcome to IFC Platform
          </Typography>
          
          <Box
            sx={{
              display: 'flex',
              flexDirection: { xs: 'column', sm: 'row' },
              gap: 2,
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            <Button
              component={Link}
              to="/user/login"
              variant="contained"
              color="secondary"
              sx={{
                minWidth: '200px',
                py: 1.5,
                textTransform: 'none',
                fontWeight: 600,
              }}
            >
              User Login
            </Button>
            
            <Button
              component={Link}
              to="/siteadmin/login"
              variant="contained"
              color="secondary"
              sx={{
                minWidth: '200px',
                py: 1.5,
                textTransform: 'none',
                fontWeight: 600,
              }}
            >
              Site Admin Login
            </Button>
            
            <Button
              component={Link}
              to="/auditor/login"
              variant="contained"
              color="secondary"
              sx={{
                minWidth: '200px',
                py: 1.5,
                textTransform: 'none',
                fontWeight: 600,
              }}
            >
              Auditor Login
            </Button>
          </Box>
        </Box>
      </Container>
    </Box>
  )
}

export default Home
