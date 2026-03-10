import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { alpha, useTheme } from '@mui/material/styles'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Paper from '@mui/material/Paper'
import PeopleAltRoundedIcon from '@mui/icons-material/PeopleAltRounded'
import FactCheckRoundedIcon from '@mui/icons-material/FactCheckRounded'
import UploadFileRoundedIcon from '@mui/icons-material/UploadFileRounded'
import AssignmentTurnedInRoundedIcon from '@mui/icons-material/AssignmentTurnedInRounded'
import AssessmentRoundedIcon from '@mui/icons-material/AssessmentRounded'

function Company_co_home() {
  const theme = useTheme()
  const navigate = useNavigate()
  const [username, setUsername] = useState('')

  const tiles = [
    {
      title: 'User Management',
      path: '/company_co/user-management',
      icon: <PeopleAltRoundedIcon sx={{ fontSize: 38 }} />,
    },
    {
      title: 'RACM Management',
      path: '/company_co/create-form',
      icon: <FactCheckRoundedIcon sx={{ fontSize: 38 }} />,
    },
    {
      title: 'RACM Upload',
      path: '/company_co/upload-excel',
      icon: <UploadFileRoundedIcon sx={{ fontSize: 38 }} />,
    },
    {
      title: 'RACM Assignment Management',
      path: '/company_co/racm-assignment',
      icon: <AssignmentTurnedInRoundedIcon sx={{ fontSize: 38 }} />,
    },
    {
      title: 'Reports',
      path: '/company_co/dashboard',
      icon: <AssessmentRoundedIcon sx={{ fontSize: 38 }} />,
    },
  ]

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const response = await fetch('http://localhost:3000/api/auth/verify', {
          method: 'GET',
          credentials: 'include',
        })
        const data = await response.json()
        if (response.ok && data.success && data.user) {
          setUsername(data.user.emp_name || data.user.name || data.user.email_id || 'User')
        } else {
          setUsername('User')
        }
      } catch (error) {
        console.error('Failed to fetch user details:', error)
        setUsername('User')
      }
    }

    fetchUser()
  }, [])

  return (
    <Box
      sx={{
        px: { xs: 1, sm: 2 },
        py: 2,
        minHeight: 'calc(100vh - 64px)',
        background: `linear-gradient(135deg, ${alpha(theme.palette.secondary.main, 0.1)} 0%, ${alpha(theme.palette.background.default, 0.95)} 45%, ${alpha(theme.palette.primary.main, 0.06)} 100%)`,
        borderRadius: 2,
      }}
    >
      <Paper
        elevation={0}
        sx={{
          p: { xs: 2.5, sm: 3.5 },
          mb: 3,
          borderRadius: 3,
          background: `linear-gradient(120deg, ${alpha(theme.palette.secondary.main, 0.16)} 0%, ${alpha(theme.palette.background.paper, 0.9)} 70%)`,
          backdropFilter: 'blur(2px)',
        }}
      >
        <Typography
          sx={{
            fontSize: { xs: '1.8rem', sm: '2.2rem' },
            fontWeight: 800,
            color: theme.palette.text.primary,
            lineHeight: 1.2,
          }}
        >
          Welcome, {username}
        </Typography>
        <Typography
          sx={{
            mt: 1,
            color: theme.palette.text.secondary,
            fontSize: '1rem',
          }}
        >
          Navigate through below links to manage IFC cycle.
        </Typography>
      </Paper>

      <Box
        sx={{
          width: '100%',
          display: 'grid',
          gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
          gap: 2.5,
          [theme.breakpoints.down('md')]: {
            gridTemplateColumns: '1fr',
          },
        }}
      >
        {tiles.map((tile) => (
          <Paper
            key={tile.title}
            onClick={() => navigate(tile.path)}
            elevation={0}
            sx={{
              p: 3,
              width: '100%',
              height: 190,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-start',
              gap: 2,
              borderRadius: 3,
              cursor: 'pointer',
              transition: 'all 0.25s ease',
              backgroundColor: alpha(theme.palette.background.paper, 0.9),
              boxShadow: `0 10px 20px ${alpha(theme.palette.common.black, 0.06)}`,
              '&:hover': {
                transform: 'translateY(-4px)',
                boxShadow: `0 14px 28px ${alpha(theme.palette.secondary.main, 0.2)}`,
              },
            }}
          >
            <Box
              sx={{
                width: 62,
                height: 62,
                borderRadius: '14px',
                display: 'grid',
                placeItems: 'center',
                color: theme.palette.secondary.main,
                backgroundColor: alpha(theme.palette.secondary.main, 0.12),
                flexShrink: 0,
              }}
            >
              {tile.icon}
            </Box>
            <Typography
              sx={{
                fontWeight: 700,
                color: theme.palette.text.primary,
                fontSize: '1.2rem',
                textAlign: 'left',
              }}
            >
              {tile.title}
            </Typography>
          </Paper>
        ))}
      </Box>
    </Box>
  )
}

export default Company_co_home
