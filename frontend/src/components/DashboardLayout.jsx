import React, { memo, useEffect, useState } from 'react'
import { Link as RouterLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { alpha, useTheme } from '@mui/material/styles'
import Box from '@mui/material/Box'
import AppBar from '@mui/material/AppBar'
import Toolbar from '@mui/material/Toolbar'
import Typography from '@mui/material/Typography'
import Tooltip from '@mui/material/Tooltip'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import ListItemIcon from '@mui/material/ListItemIcon'
import Divider from '@mui/material/Divider'
import HomeRoundedIcon from '@mui/icons-material/HomeRounded'
import LogoutIcon from '@mui/icons-material/Logout'
import AccountCircleIcon from '@mui/icons-material/AccountCircle'
import PersonOutlineIcon from '@mui/icons-material/PersonOutline'
import LightModeIcon from '@mui/icons-material/LightMode'
import DarkModeIcon from '@mui/icons-material/DarkMode'
import { useThemeMode } from '../contexts/ThemeContext'
import { toast } from 'react-hot-toast'
import {
  STORAGE_KEYS,
  clearCachedUserProfile,
  clearCompanyFinancialYearOptionsCache,
  clearStoredUserDisplayName,
} from '../storageKeys'
import { MAIN_CONTENT_MAX_WIDTH, DASHBOARD_SECTION_GAP } from '../uiConstants'
import { apiUrl } from '../config/api'
import AppDialog, { APP_DIALOG_PRIMARY_BUTTON_SX, getAppDialogCancelButtonSx } from './AppDialog'

const getHomePath = (pathname) => {
  if (pathname.startsWith('/company_co')) return '/company_co/home'
  if (pathname.startsWith('/company_admin')) return '/company_admin/home'
  if (pathname.startsWith('/siteadmin')) return '/siteadmin/dashboard'
  if (pathname.startsWith('/user')) return '/user/home'
  if (pathname.startsWith('/approver')) return '/approver/home'
  if (pathname.startsWith('/auditor')) return '/auditor/home'
  return '/'
}

const getProfilePath = (pathname) => {
  if (pathname.startsWith('/company_co')) return '/company_co/profile'
  if (pathname.startsWith('/company_admin')) return '/company_admin/profile'
  if (pathname.startsWith('/siteadmin')) return '/siteadmin/profile'
  if (pathname.startsWith('/user')) return '/user/profile'
  if (pathname.startsWith('/approver')) return '/approver/profile'
  if (pathname.startsWith('/auditor')) return '/auditor/profile'
  return '/company_co/profile'
}

function DashboardLayout() {
  const theme = useTheme()
  const navigate = useNavigate()
  const location = useLocation()
  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false)
  const [accountMenuAnchor, setAccountMenuAnchor] = useState(null)
  const accountMenuOpen = Boolean(accountMenuAnchor)
  const profilePath = getProfilePath(location.pathname)
  const { mode, toggleTheme } = useThemeMode()
  const [companyName, setCompanyName] = useState(() => localStorage.getItem(STORAGE_KEYS.companyName) || '')
  const homePath = getHomePath(location.pathname)
  const isAtHome = location.pathname === homePath
  const isSiteadminRoute = location.pathname.startsWith('/siteadmin')
  const isCreateCompanyPage = location.pathname === '/siteadmin/create-company'
  const isFullWidthPage =
    isCreateCompanyPage || location.pathname.startsWith('/company_co/control-creation')
  const boundaryPaddingX = { xs: 3, sm: 4, md: 5 }

  useEffect(() => {
    let cancelled = false
    queueMicrotask(() => {
      if (!cancelled) {
        setCompanyName(localStorage.getItem(STORAGE_KEYS.companyName) || '')
      }
    })
    return () => {
      cancelled = true
    }
  }, [location.pathname])

  useEffect(() => {
    if (isSiteadminRoute) return
    if (companyName && String(companyName).trim() !== '') return

    let cancelled = false
    ;(async () => {
      try {
        const response = await fetch(apiUrl('/api/auth/profile'), {
          method: 'GET',
          credentials: 'include',
        })
        const data = await response.json()
        const name = data?.profile?.company_name
        if (!cancelled && response.ok && data?.success && name && String(name).trim() !== '') {
          const normalizedName = String(name).trim()
          setCompanyName(normalizedName)
          localStorage.setItem(STORAGE_KEYS.companyName, normalizedName)
        }
      } catch (error) {
        console.warn('Failed to fetch company name for navbar:', error)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [companyName, isSiteadminRoute])

  useEffect(() => {
    document.body.classList.add('has-dashboard-navbar')
    return () => {
      document.body.classList.remove('has-dashboard-navbar')
    }
  }, [])

  const handleUnifiedLogout = async () => {
    try {
      const response = await fetch(apiUrl('/api/auth/logout'), {
        method: 'POST',
        credentials: 'include',
      })
      const data = await response.json()
      if (response.ok && data.success) {
        localStorage.removeItem(STORAGE_KEYS.companyName)
        localStorage.removeItem(STORAGE_KEYS.companyIdentifier)
        localStorage.removeItem(STORAGE_KEYS.approverCompanyNames)
        localStorage.removeItem(STORAGE_KEYS.approverFinancialYears)
        clearCompanyFinancialYearOptionsCache()
        clearCachedUserProfile()
        clearStoredUserDisplayName()
        toast.success('Logged out successfully')
        navigate('/login')
      } else {
        console.error('Logout failed:', data.message)
        toast.error(data.message || 'Logout failed')
        clearCompanyFinancialYearOptionsCache()
        clearCachedUserProfile()
        clearStoredUserDisplayName()
        navigate('/login')
      }
    } catch (error) {
      console.error('Logout error:', error)
      toast.error('Error during logout')
      clearCompanyFinancialYearOptionsCache()
      clearCachedUserProfile()
      clearStoredUserDisplayName()
      navigate('/login')
    }
  }

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <AppBar
        position="fixed"
        sx={{
          backgroundColor: theme.palette.navbar.bg,
          color: theme.palette.navbar.fg,
          borderBottom: `1px solid ${theme.palette.navbar.bottomBorder}`,
          boxShadow: 'none',
        }}
      >
        <Toolbar
          disableGutters
          sx={{
            px: 0,
          }}
        >
          <Box
            sx={{
              width: '100%',
              maxWidth: isFullWidthPage ? 'none' : MAIN_CONTENT_MAX_WIDTH,
              mx: isFullWidthPage ? 0 : 'auto',
              px: boundaryPaddingX,
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <Box
              sx={{
                flexGrow: 1,
                minWidth: 0,
              }}
            >
              <Box
                component={RouterLink}
                to={homePath}
                sx={{
                  display: 'inline-flex',
                  flexDirection: 'column',
                  textDecoration: 'none',
                  minWidth: 0,
                }}
              >
                <Typography
                  noWrap
                  sx={{
                    fontWeight: 800,
                    fontSize: '1.2rem',
                    lineHeight: 1.2,
                    letterSpacing: '-0.02em',
                    color: theme.palette.mode === 'dark' ? theme.palette.navbar.fg : theme.palette.text.primary,
                  }}
                >
                  {isSiteadminRoute ? 'Admin' : (companyName || 'Company')}
                </Typography>
                <Typography
                  noWrap
                  sx={{
                    fontWeight: 400,
                    fontSize: '0.95rem',
                    lineHeight: 1.3,
                    color:
                      theme.palette.mode === 'dark'
                        ? 'rgba(238, 238, 238, 0.78)'
                        : alpha(theme.palette.text.primary, 0.78),
                  }}
                >
                  Internal Financial Controls
                </Typography>
              </Box>
            </Box>
            <Tooltip title={mode === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'} arrow>
              <IconButton
                onClick={toggleTheme}
                sx={{
                  color: theme.palette.navbar.fg,
                  marginRight: 1,
                  '&:hover': {
                    backgroundColor: theme.palette.action.hover,
                  },
                }}
              >
                {mode === 'light' ? <DarkModeIcon /> : <LightModeIcon />}
              </IconButton>
            </Tooltip>
            <Tooltip title="Account" arrow>
              <IconButton
                id="dashboard-account-menu-button"
                aria-controls={accountMenuOpen ? 'dashboard-account-menu' : undefined}
                aria-haspopup="true"
                aria-expanded={accountMenuOpen ? 'true' : undefined}
                onClick={(e) => setAccountMenuAnchor(e.currentTarget)}
                sx={{
                  color: theme.palette.navbar.fg,
                  '&:hover': {
                    backgroundColor: theme.palette.action.hover,
                  },
                }}
              >
                <AccountCircleIcon />
              </IconButton>
            </Tooltip>
            <Menu
              id="dashboard-account-menu"
              anchorEl={accountMenuAnchor}
              open={accountMenuOpen}
              onClose={() => setAccountMenuAnchor(null)}
              anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
              transformOrigin={{ vertical: 'top', horizontal: 'right' }}
              slotProps={{
                paper: {
                  elevation: 3,
                  sx: {
                    mt: 1,
                    minWidth: 200,
                    borderRadius: 2,
                  },
                },
              }}
            >
              <MenuItem
                onClick={() => {
                  setAccountMenuAnchor(null)
                  navigate(profilePath)
                }}
              >
                <ListItemIcon sx={{ color: 'inherit' }}>
                  <PersonOutlineIcon fontSize="small" />
                </ListItemIcon>
                Profile
              </MenuItem>
              <Divider />
              <MenuItem
                onClick={() => {
                  setAccountMenuAnchor(null)
                  setLogoutDialogOpen(true)
                }}
              >
                <ListItemIcon sx={{ color: 'inherit' }}>
                  <LogoutIcon fontSize="small" />
                </ListItemIcon>
                Log out
              </MenuItem>
            </Menu>
          </Box>
        </Toolbar>
      </AppBar>

      <AppDialog
        open={logoutDialogOpen}
        onClose={() => setLogoutDialogOpen(false)}
        titleId="logout-dialog-title"
        description="Are you sure you want to log out? You will need to sign in again to access your account."
        descriptionId="logout-dialog-description"
        title={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            {/* <Box
              sx={{
                width: 36,
                height: 36,
                borderRadius: 1.5,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                color: 'secondary.main',
                backgroundColor: alpha(theme.palette.secondary.main, theme.palette.mode === 'dark' ? 0.18 : 0.12),
              }}
            >
              <LogoutIcon fontSize="small" />
            </Box> */}
            <Typography
              component="span"
              sx={{
                fontWeight: 700,
                fontSize: '1.125rem',
                color: 'text.primary',
                lineHeight: 1.3,
              }}
            >
              Confirm Logout
            </Typography>
          </Box>
        }
        titleSx={{
          py: 1.75,
          px: 2.5,
          borderBottom: `1px solid ${theme.palette.divider}`,
        }}
        contentSx={{
          px: 2.5,
          pb: 2,
          '&&': {
            paddingTop: 1.75,
          },
        }}
        actionsSx={{
          px: 2.5,
          pt: 1.5,
          pb: 1.75,
          gap: 1.25,
        }}
        PaperProps={{
          sx: {
            borderRadius: 2,
            minWidth: { xs: '90%', sm: '400px' },
            overflow: 'hidden',
            boxShadow: theme.palette.mode === 'dark'
              ? '0 8px 32px rgba(0, 0, 0, 0.4)'
              : '0 8px 32px rgba(0, 0, 0, 0.12)',
          },
        }}
        actions={
          <>
            <Button
              onClick={() => setLogoutDialogOpen(false)}
              variant="outlined"
              sx={{
                ...getAppDialogCancelButtonSx(theme),
                py: 0.75,
                borderWidth: '1px',
                borderColor: alpha(theme.palette.text.primary, 0.16),
                '&:hover': {
                  borderWidth: '1px',
                  borderColor: alpha(theme.palette.text.primary, 0.28),
                  backgroundColor: alpha(theme.palette.text.primary, theme.palette.mode === 'dark' ? 0.08 : 0.05),
                },
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                setLogoutDialogOpen(false)
                handleUnifiedLogout()
              }}
              variant="contained"
              color="secondary"
              autoFocus
              startIcon={<LogoutIcon />}
              sx={{
                ...APP_DIALOG_PRIMARY_BUTTON_SX,
                py: 0.75,
              }}
            >
              Log out
            </Button>
          </>
        }
      />

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          px: boundaryPaddingX,
          pb: DASHBOARD_SECTION_GAP,
          width: '100%',
          maxWidth: isFullWidthPage ? 'none' : MAIN_CONTENT_MAX_WIDTH,
          mx: isFullWidthPage ? 0 : 'auto',
          backgroundColor: 'transparent',
          minHeight: '100vh',
        }}
      >
        <Toolbar />
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            gap: DASHBOARD_SECTION_GAP,
            pt: DASHBOARD_SECTION_GAP,
            width: '100%',
            minWidth: 0,
            alignItems: 'stretch',
          }}
        >
          {!isAtHome && (
            <Box sx={{ display: 'flex', justifyContent: 'flex-start' }}>
              <Button
                variant="text"
                startIcon={<HomeRoundedIcon />}
                onClick={() => navigate(homePath)}
                sx={{
                  textTransform: 'none',
                  fontWeight: 600,
                  color: theme.palette.text.primary,
                  backgroundColor: theme.palette.background.paper,
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: 2,
                  px: 2,
                  py: 0.75,
                  '&:hover': {
                    backgroundColor:
                      theme.palette.mode === 'dark'
                        ? 'rgba(255, 255, 255, 0.08)'
                        : 'rgba(0, 0, 0, 0.04)',
                  },
                }}
              >
                Back to Home
              </Button>
            </Box>
          )}
          <Outlet />
        </Box>
      </Box>
    </Box>
  )
}

export default memo(DashboardLayout)
