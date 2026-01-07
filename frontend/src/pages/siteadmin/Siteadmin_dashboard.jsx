import React from 'react'
import { Link } from 'react-router-dom'
import { useTheme } from '@mui/material/styles'
import Navbar from '../../components/Siteadmin_navbar'
import { useSiteadminLogout } from '../../hooks/useSiteadminLogout'
import Button from '@mui/material/Button'
import Box from '@mui/material/Box'

function Siteadmin_dashboard() {
  const theme = useTheme()
  const handleLogout = useSiteadminLogout()

  return (
    <div className="min-h-screen bg-primary">
      <Navbar onLogout={handleLogout} />

      {/* Dashboard Content */}
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: 'calc(100vh - 4rem)',
          px: 2,
        }}
      >
        <h1 className="text-4xl font-bold text-secondary mb-8">Siteadmin Dashboard</h1>
        
        <Button
          component={Link}
          to="/siteadmin/create-company"
          variant="contained"
          color="secondary"
          sx={{
            px: 4,
            py: 1.5,
            fontSize: theme.typography.customSizes.medium,
            fontWeight: 600,
            textTransform: 'none',
          }}
        >
          Create Company
        </Button>
      </Box>
    </div>
  )
}

export default Siteadmin_dashboard