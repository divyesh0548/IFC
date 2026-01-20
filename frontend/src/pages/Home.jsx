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
          
          <Button
            component={Link}
            to="/login"
            variant="contained"
            color="secondary"
            sx={{
              minWidth: '200px',
              py: 1.5,
              textTransform: 'none',
              fontWeight: 600,
            }}
          >
            Login
          </Button>
        </Box>
      </Container>
    </Box>
  )
}

export default Home
