import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { alpha, useTheme } from '@mui/material/styles'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Paper from '@mui/material/Paper'
import DomainRoundedIcon from '@mui/icons-material/DomainRounded'
import GroupRoundedIcon from '@mui/icons-material/GroupRounded'
import FactCheckRoundedIcon from '@mui/icons-material/FactCheckRounded'
import ThumbUpAltRoundedIcon from '@mui/icons-material/ThumbUpAltRounded'
import HighlightOffRoundedIcon from '@mui/icons-material/HighlightOffRounded'
import PendingActionsRoundedIcon from '@mui/icons-material/PendingActionsRounded'
import DashboardRoundedIcon from '@mui/icons-material/DashboardRounded'

function ApproverHome() {
  const theme = useTheme()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    approver_name: '',
    total_companies: 0,
    total_users: 0,
    total_active_racms: 0,
    total_approved_racms: 0,
    total_rejected_racms: 0,
    total_pending_racms: 0,
  })

  useEffect(() => {
    const fetchHomeStats = async () => {
      try {
        const response = await fetch('http://localhost:3000/api/approver/home-stats', {
          method: 'GET',
          credentials: 'include',
        })

        const data = await response.json()

        if (response.ok && data.success) {
          setStats(data.data)
        }
      } catch (error) {
        console.error('Failed to fetch approver home stats:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchHomeStats()
  }, [])

  const displayName = stats.approver_name?.trim() || 'Approver'
  const statCards = [
    {
      title: 'Total Company',
      value: stats.total_companies,
      icon: <DomainRoundedIcon sx={{ fontSize: 34 }} />,
    },
    {
      title: 'Total Users',
      value: stats.total_users,
      icon: <GroupRoundedIcon sx={{ fontSize: 34 }} />,
    },
    {
      title: 'Total RACMs Active',
      value: stats.total_active_racms,
      icon: <FactCheckRoundedIcon sx={{ fontSize: 34 }} />,
    },
    {
      title: 'Approved',
      value: stats.total_approved_racms,
      icon: <ThumbUpAltRoundedIcon sx={{ fontSize: 34 }} />,
    },
    {
      title: 'Rejected',
      value: stats.total_rejected_racms,
      icon: <HighlightOffRoundedIcon sx={{ fontSize: 34 }} />,
    },
    {
      title: 'Pending',
      value: stats.total_pending_racms,
      icon: <PendingActionsRoundedIcon sx={{ fontSize: 34 }} />,
    },
  ]

  return (
    <Box
      sx={{
        px: 0,
        py: 2,
        minHeight: 'calc(100vh - 64px)',
      }}
    >
      <Paper
        elevation={0}
        sx={{
          p: { xs: 2.5, sm: 3.5 },
          mb: 3,
          borderRadius: 3,
          backgroundColor: theme.palette.background.paper,
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
          Welcome, {displayName}
        </Typography>
        <Typography
          sx={{
            mt: 1,
            color: theme.palette.text.secondary,
            fontSize: '1rem',
          }}
        >
          Review IFC activity across companies and move to the approver dashboard when needed.
        </Typography>
      </Paper>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
          gap: 2.5,
          mb: 3,
          [theme.breakpoints.down('lg')]: {
            gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
          },
          [theme.breakpoints.down('sm')]: {
            gridTemplateColumns: '1fr',
          },
        }}
      >
        {statCards.map((card) => (
          <Paper
            key={card.title}
            elevation={0}
            sx={{
              p: 3,
              borderRadius: 3,
              backgroundColor: alpha(theme.palette.background.paper, 0.92),
            }}
          >
            <Box
              sx={{
                width: 58,
                height: 58,
                borderRadius: '14px',
                display: 'grid',
                placeItems: 'center',
                color:
                  theme.palette.mode === 'dark'
                    ? theme.palette.primary.light
                    : theme.palette.secondary.main,
                backgroundColor:
                  theme.palette.mode === 'dark'
                    ? alpha(theme.palette.primary.light, 0.2)
                    : alpha(theme.palette.secondary.main, 0.12),
                mb: 2,
              }}
            >
              {card.icon}
            </Box>
            <Typography
              sx={{
                color: theme.palette.text.secondary,
                fontSize: '0.95rem',
                mb: 0.75,
              }}
            >
              {card.title}
            </Typography>
            <Typography
              sx={{
                fontWeight: 800,
                color: theme.palette.text.primary,
                fontSize: '2rem',
                lineHeight: 1,
              }}
            >
              {loading ? '--' : card.value}
            </Typography>
          </Paper>
        ))}
      </Box>

      <Paper
        onClick={() => navigate('/approver/dashboard')}
        elevation={0}
        sx={{
          p: 3,
          width: '100%',
          minHeight: 150,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-start',
          gap: 2,
          borderRadius: 3,
          cursor: 'pointer',
          transition: 'transform 200ms ease-out, background-color 200ms ease-out',
          backgroundColor: alpha(theme.palette.background.paper, 0.9),
          '&:hover': {
            backgroundColor: alpha(theme.palette.background.paper, 1),
            transform: 'translateY(-3px)',
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
            color:
              theme.palette.mode === 'dark'
                ? theme.palette.primary.light
                : theme.palette.secondary.main,
            backgroundColor:
              theme.palette.mode === 'dark'
                ? alpha(theme.palette.primary.light, 0.2)
                : alpha(theme.palette.secondary.main, 0.12),
            flexShrink: 0,
          }}
        >
          <DashboardRoundedIcon sx={{ fontSize: 38 }} />
        </Box>
        <Box>
          <Typography
            sx={{
              fontWeight: 700,
              color: theme.palette.text.primary,
              fontSize: '1.2rem',
              textAlign: 'left',
            }}
          >
            Approver Dashboard
          </Typography>
          <Typography
            sx={{
              mt: 0.75,
              color: theme.palette.text.secondary,
              fontSize: '0.95rem',
            }}
          >
            Open the RACM approval dashboard to filter, review, and process submissions.
          </Typography>
        </Box>
      </Paper>
    </Box>
  )
}

export default ApproverHome
