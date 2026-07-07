import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { alpha, useTheme } from '@mui/material/styles'
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import ApartmentRoundedIcon from '@mui/icons-material/ApartmentRounded'
import PeopleAltRoundedIcon from '@mui/icons-material/PeopleAltRounded'
import AccountBalanceRoundedIcon from '@mui/icons-material/AccountBalanceRounded'
import FactCheckRoundedIcon from '@mui/icons-material/FactCheckRounded'
import ManageAccountsRoundedIcon from '@mui/icons-material/ManageAccountsRounded'
import AccountTreeRoundedIcon from '@mui/icons-material/AccountTreeRounded'
import ArrowOutwardRoundedIcon from '@mui/icons-material/ArrowOutwardRounded'
import { apiUrl } from '../../config/api'
import { formatDisplayName } from '../../utils/displayName'
import DashboardGreeting from '../../components/DashboardGreeting'
import HomeHelpSupport from '../../components/help/HomeHelpSupport'
import { readStoredUserDisplayName, writeStoredUserDisplayName } from '../../storageKeys'

function CompanyAdminHome() {
  const theme = useTheme()
  const navigate = useNavigate()
  const [stats, setStats] = useState({
    adminName: '',
    totalUsers: 0,
    totalRacms: 0,
    approvedRacms: 0,
    rejectedRacms: 0,
  })
  const storedDisplayName = readStoredUserDisplayName()

  useEffect(() => {
    let cancelled = false

    const fetchStats = async () => {
      try {
        const response = await fetch(apiUrl('/api/company-admin/home-stats'), {
          credentials: 'include',
        })
        const result = await response.json()

        if (!cancelled && response.ok && result?.success) {
          const nextAdminName = formatDisplayName(result.data?.adminName, 'Admin')
          writeStoredUserDisplayName(nextAdminName, 'Admin')
          setStats({
            adminName: nextAdminName,
            totalUsers: Number(result.data?.totalUsers || 0),
            totalRacms: Number(result.data?.totalRacms || 0),
            approvedRacms: Number(result.data?.approvedRacms || 0),
            rejectedRacms: Number(result.data?.rejectedRacms || 0),
          })
        }
      } catch (error) {
        console.error('Company admin home stats error:', error)
      }
    }

    fetchStats()
    return () => {
      cancelled = true
    }
  }, [])

  const tiles = [
    {
      eyebrow: 'Company',
      title: 'Company Details',
      description: 'Review the registered company profile and core identifiers.',
      path: '/company_admin/company-details',
      icon: <AccountBalanceRoundedIcon sx={{ fontSize: 38 }} />,
    },
    {
      eyebrow: 'Units',
      title: 'Unit Management',
      description: 'Create units and manage coordinator or approver assignment by unit.',
      path: '/company_admin/unit-management',
      icon: <ApartmentRoundedIcon sx={{ fontSize: 38 }} />,
    },
    {
      eyebrow: 'Users',
      title: 'User Management',
      description: 'Create users, coordinators, and approvers, then manage bulk onboarding.',
      path: '/company_admin/user-management',
      icon: <PeopleAltRoundedIcon sx={{ fontSize: 38 }} />,
    },
    {
      eyebrow: 'Approvers',
      title: 'Approver Management',
      description: 'Search approvers, review assignment status, and update unit or process scope.',
      path: '/company_admin/approver-management',
      icon: <ManageAccountsRoundedIcon sx={{ fontSize: 38 }} />,
    },
    {
      eyebrow: 'Process Master',
      title: 'Business Process Management',
      description: 'Add company specific business processes and maintain the process master used across company workflows.',
      path: '/company_admin/business-processes',
      icon: <AccountTreeRoundedIcon sx={{ fontSize: 38 }} />,
    },
    {
      eyebrow: 'RACM',
      title: 'RACM Dashboard',
      description: 'Open the company RACM list with filters and view form details in read-only mode.',
      path: '/company_admin/racms',
      icon: <FactCheckRoundedIcon sx={{ fontSize: 38 }} />,
    },
  ]

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, py: 2 }}>
      <Box
        sx={{
          position: 'relative',
          overflow: 'hidden',
          borderRadius: 4,
          border: '1px solid',
          borderColor:
            theme.palette.mode === 'dark'
              ? alpha(theme.palette.common.white, 0.08)
              : alpha(theme.palette.primary.main, 0.12),
          background: theme.palette.gradients?.hero,
          boxShadow: theme.palette.mode === 'dark'
            ? '0 20px 48px rgba(0, 0, 0, 0.32)'
            : '0 20px 48px rgba(15, 23, 42, 0.08)',
        }}
      >
        <Box
          sx={{
            position: 'relative',
            p: { xs: 2.5, sm: 3.5, md: 4 },
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1.55fr) minmax(280px, 0.9fr)' },
            gap: 3,
            alignItems: 'stretch',
          }}
        >
          <Box>
            <Box
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 1,
                px: 1.4,
                py: 0.7,
                borderRadius: 999,
                mb: 2,
                backgroundColor: alpha(theme.palette.background.paper, theme.palette.mode === 'dark' ? 0.12 : 0.72),
                border: `1px solid ${alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.24 : 0.16)}`,
              }}
            >
              <Box
                sx={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  backgroundColor: theme.palette.success.main,
                  boxShadow: `0 0 0 4px ${alpha(theme.palette.success.main, 0.16)}`,
                }}
              />
              <Typography sx={{ fontSize: '0.82rem', fontWeight: 700, color: theme.palette.text.secondary }}>
                Admin workspace
              </Typography>
            </Box>
            <DashboardGreeting
              displayName={storedDisplayName || stats.adminName || 'Admin'}
              primarySx={{ fontSize: { xs: '1.85rem', sm: '2.3rem', md: '2.6rem' }, fontWeight: 900, lineHeight: 1.08, letterSpacing: '-0.03em' }}
            />
            <Typography sx={{ mt: 1.3, color: theme.palette.text.secondary, maxWidth: 700, lineHeight: 1.7 }}>
              Manage company structure, onboarding, unit ownership, and read-only RACM visibility from one workspace.
            </Typography>
          </Box>

          <Paper
            elevation={0}
            sx={{
              p: 2.4,
              borderRadius: 3,
              border: '1px solid',
              borderColor:
                theme.palette.mode === 'dark'
                  ? alpha(theme.palette.common.white, 0.08)
                  : alpha(theme.palette.divider, 1),
              backgroundColor: alpha(theme.palette.background.paper, theme.palette.mode === 'dark' ? 0.5 : 0.82),
              backdropFilter: 'blur(8px)',
              display: 'grid',
              gap: 1.3,
            }}
          >
            <Typography sx={{ fontSize: '0.84rem', fontWeight: 700, color: theme.palette.text.secondary }}>
              Reporting Snapshot
            </Typography>
            {[
              { label: 'Total Users', value: stats.totalUsers, color: theme.palette.primary.main },
              { label: 'Total RACMs', value: stats.totalRacms, color: theme.palette.info.main },
              { label: 'Approved RACMs', value: stats.approvedRacms, color: theme.palette.success.main },
              { label: 'Rejected RACMs', value: stats.rejectedRacms, color: theme.palette.error.main },
            ].map((item) => (
              <Box key={item.label} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', py: 1, borderBottom: `1px solid ${alpha(theme.palette.divider, 0.75)}`, '&:last-of-type': { borderBottom: 'none', pb: 0 } }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.1 }}>
                  <Box sx={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: item.color }} />
                  <Typography sx={{ fontSize: '0.92rem', fontWeight: 700, color: theme.palette.text.secondary }}>
                    {item.label}
                  </Typography>
                </Box>
                <Typography sx={{ fontSize: '1rem', fontWeight: 900 }}>
                  {item.value}
                </Typography>
              </Box>
            ))}
          </Paper>
        </Box>
        <HomeHelpSupport />
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' }, gap: 2.5 }}>
        {tiles.map((tile) => (
          <Paper
            key={tile.title}
            onClick={() => navigate(tile.path)}
            elevation={0}
            sx={{
              p: 0,
              minHeight: 158,
              borderRadius: 3,
              cursor: 'pointer',
              overflow: 'hidden',
              transition: 'box-shadow 220ms ease-out, border-color 220ms ease-out, background-color 220ms ease-out',
              backgroundColor: alpha(theme.palette.background.paper, 0.92),
              border: `1px solid ${theme.palette.mode === 'dark' ? alpha(theme.palette.primary.main, 0.12) : alpha(theme.palette.divider, 0.9)}`,
              boxShadow: theme.palette.mode === 'dark'
                ? '0 10px 24px rgba(0, 0, 0, 0.18)'
                : '0 10px 24px rgba(15, 23, 42, 0.05)',
              '&:hover': {
                borderColor: alpha(theme.palette.primary.main, 0.4),
                boxShadow: theme.palette.mode === 'dark'
                  ? '0 18px 36px rgba(0, 0, 0, 0.24)'
                  : '0 18px 36px rgba(15, 23, 42, 0.08)',
              },
            }}
          >
            <Box sx={{ width: '100%', p: 2.75, display: 'flex', flexDirection: 'column', gap: 2.2, minHeight: 158, background: `linear-gradient(180deg, ${alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.18 : 0.08)} 0%, transparent 100%)` }}>
              <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1.5 }}>
                <Box sx={{ width: 56, height: 56, borderRadius: '16px', display: 'grid', placeItems: 'center', color: alpha(theme.palette.primary.main, 0.92), backgroundColor: alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.18 : 0.12), border: `1px solid ${alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.18 : 0.16)}` }}>
                  {tile.icon}
                </Box>
                <Box sx={{ px: 1.1, py: 0.65, borderRadius: 999, backgroundColor: alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.14 : 0.1), color: theme.palette.primary.main }}>
                  <Typography sx={{ fontSize: '0.72rem', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                    {tile.eyebrow}
                  </Typography>
                </Box>
              </Box>
              <Box sx={{ display: 'grid', gap: 0.9 }}>
                <Typography sx={{ fontWeight: 800, fontSize: '1.08rem', lineHeight: 1.3 }}>
                  {tile.title}
                </Typography>
                <Typography sx={{ color: alpha(theme.palette.text.secondary, 0.92), fontSize: '0.92rem', lineHeight: 1.6 }}>
                  {tile.description}
                </Typography>
              </Box>
              <Box sx={{ mt: 'auto', display: 'flex', alignItems: 'center', gap: 0.8, color: theme.palette.primary.main }}>
                <Typography sx={{ fontSize: '0.88rem', fontWeight: 800 }}>
                  Open module
                </Typography>
                <ArrowOutwardRoundedIcon sx={{ fontSize: 18 }} />
              </Box>
            </Box>
          </Paper>
        ))}
      </Box>
    </Box>
  )
}

export default CompanyAdminHome
