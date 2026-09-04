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
import AccountCircleIcon from '@mui/icons-material/AccountCircle'
import PersonOutlineIcon from '@mui/icons-material/PersonOutline'
import LogoutIcon from '@mui/icons-material/Logout'
import CloseRoundedIcon from '@mui/icons-material/CloseRounded'
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
import { useAuth } from '../contexts/AuthContext'
import Dialog from '@mui/material/Dialog'
import DialogContent from '@mui/material/DialogContent'
import AppBreadcrumbs from './AppBreadcrumbs'
import { getDashboardBreadcrumbItems } from '../utils/dashboardBreadcrumbs'

const getHomePath = (pathname) => {
  if (pathname.startsWith('/company-co')) return '/company-co/home'
  if (pathname.startsWith('/company_admin')) return '/company_admin/home'
  if (pathname.startsWith('/siteadmin')) return '/siteadmin/dashboard'
  if (pathname.startsWith('/user')) return '/user/home'
  if (pathname.startsWith('/approver')) return '/approver/home'
  if (pathname.startsWith('/auditor')) return '/auditor/home'
  return '/'
}

const getProfilePath = (pathname) => {
  if (pathname.startsWith('/company-co')) return '/company-co/profile'
  if (pathname.startsWith('/company_admin')) return '/company_admin/profile'
  if (pathname.startsWith('/siteadmin')) return '/siteadmin/profile'
  if (pathname.startsWith('/user')) return '/user/profile'
  if (pathname.startsWith('/approver')) return '/approver/profile'
  if (pathname.startsWith('/auditor')) return '/auditor/profile'
  return '/company-co/profile'
}

function DashboardLayout() {
  const theme = useTheme()
  const navigate = useNavigate()
  const location = useLocation()
  const { clearAuth } = useAuth()
  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false)
  const [accountMenuAnchor, setAccountMenuAnchor] = useState(null)
  const accountMenuOpen = Boolean(accountMenuAnchor)
  const profilePath = getProfilePath(location.pathname)
  const { mode, toggleTheme } = useThemeMode()
  const [companyName, setCompanyName] = useState(() => localStorage.getItem(STORAGE_KEYS.companyName) || '')
  const homePath = getHomePath(location.pathname)
  const breadcrumbItems = getDashboardBreadcrumbItems(location.pathname)
  const isSiteadminRoute = location.pathname.startsWith('/siteadmin')
  const isCreateCompanyPage = location.pathname === '/siteadmin/create-company'
  const isFullWidthPage =
    isCreateCompanyPage || location.pathname.startsWith('/company-co/control-creation')
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
      localStorage.removeItem(STORAGE_KEYS.companyName)
      localStorage.removeItem(STORAGE_KEYS.companyIdentifier)
      localStorage.removeItem(STORAGE_KEYS.approverCompanyNames)
      localStorage.removeItem(STORAGE_KEYS.approverFinancialYears)
      clearCompanyFinancialYearOptionsCache()
      clearCachedUserProfile()
      clearStoredUserDisplayName()
      clearAuth()
      if (response.ok && data.success) {
        toast.success('Logged out successfully')
      } else {
        console.error('Logout failed:', data.message)
        toast.error(data.message || 'Logout failed')
      }
      navigate('/login')
    } catch (error) {
      console.error('Logout error:', error)
      toast.error('Error during logout')
      clearCompanyFinancialYearOptionsCache()
      clearCachedUserProfile()
      clearStoredUserDisplayName()
      clearAuth()
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
                    width: 200,
                    minWidth: 200,
                    borderRadius: 2,
                    overflow: 'hidden',
                  },
                },
                list: {
                  sx: {
                    py: 0,
                    '& .MuiMenuItem-root': {
                      py: 1.25,
                      px: 2,
                      minHeight: 44,
                    },
                    '& .MuiDivider-root': {
                      my: 0,
                    },
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

      <Dialog
        open={logoutDialogOpen}
        onClose={() => setLogoutDialogOpen(false)}
        aria-labelledby="logout-dialog-title"
        aria-describedby="logout-dialog-description"
        maxWidth={false}
        slotProps={{
          backdrop: {
            sx: {
              backgroundColor: alpha(theme.palette.common.black, theme.palette.mode === 'dark' ? 0.62 : 0.42),
              backdropFilter: 'blur(6px)',
            },
          },
        }}
        PaperProps={{
          sx: {
            position: 'relative',
            borderRadius: 5,
            width: { xs: 'calc(100% - 48px)', sm: 400 },
            maxWidth: 400,
            mx: 3,
            p: 0,
            overflow: 'hidden',
            border: '1px solid',
            borderColor:
              theme.palette.mode === 'dark'
                ? alpha(theme.palette.common.white, 0.1)
                : alpha(theme.palette.divider, 0.9),
            backgroundColor: theme.palette.background.paper,
            boxShadow:
              theme.palette.mode === 'dark'
                ? '0 28px 64px rgba(0, 0, 0, 0.55)'
                : '0 28px 64px rgba(15, 23, 42, 0.16)',
          },
        }}
      >
        <IconButton
          aria-label="Close"
          onClick={() => setLogoutDialogOpen(false)}
          size="small"
          sx={{
            position: 'absolute',
            top: 12,
            right: 12,
            color: 'text.secondary',
            zIndex: 1,
            '&:hover': {
              backgroundColor: alpha(theme.palette.text.primary, theme.palette.mode === 'dark' ? 0.08 : 0.05),
            },
          }}
        >
          <CloseRoundedIcon fontSize="small" />
        </IconButton>

        <DialogContent
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
            px: { xs: 3, sm: 3.5 },
            pb: { xs: 3, sm: 3.25 },
            '&&': {
              paddingTop: theme.spacing(3.5),
            },
          }}
        >
          <Box
            sx={{
              width: 72,
              height: 72,
              borderRadius: '50%',
              display: 'grid',
              placeItems: 'center',
              mb: 2.25,
              color: theme.palette.mode === 'dark' ? '#ffffff' : theme.palette.secondary.main,
              backgroundColor: alpha(theme.palette.secondary.main, theme.palette.mode === 'dark' ? 0.18 : 0.12),
              border: `1px solid ${alpha(theme.palette.secondary.main, theme.palette.mode === 'dark' ? 0.28 : 0.18)}`,
            }}
          >
            <LogoutIcon sx={{ fontSize: 32 }} />
          </Box>

          <Typography
            id="logout-dialog-title"
            component="h2"
            sx={{
              fontWeight: 800,
              fontSize: { xs: '1.28rem', sm: '1.4rem' },
              lineHeight: 1.25,
              letterSpacing: '-0.02em',
              color: 'text.primary',
              maxWidth: 320,
            }}
          >
            Log out of your account?
          </Typography>
          <Typography
            id="logout-dialog-description"
            sx={{
              mt: 1,
              mb: 0,
              color: 'text.secondary',
              fontSize: '0.92rem',
              lineHeight: 1.55,
              maxWidth: 300,
            }}
          >
            You will need to sign in again to continue.
          </Typography>

          <Box
            sx={{
              mt: 3,
              width: '100%',
              display: 'flex',
              justifyContent: 'center',
              gap: 1.25,
            }}
          >
            <Button
              onClick={() => setLogoutDialogOpen(false)}
              variant="outlined"
              sx={{
                textTransform: 'none',
                fontWeight: 600,
                fontSize: '0.9rem',
                py: 1,
                px: 2.5,
                minWidth: 104,
                borderRadius: 2.5,
                borderColor: alpha(theme.palette.text.primary, theme.palette.mode === 'dark' ? 0.28 : 0.16),
                color: 'text.primary',
                '&:hover': {
                  borderColor: alpha(theme.palette.text.primary, theme.palette.mode === 'dark' ? 0.4 : 0.28),
                  backgroundColor: alpha(theme.palette.text.primary, theme.palette.mode === 'dark' ? 0.06 : 0.04),
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
              sx={{
                textTransform: 'none',
                fontWeight: 700,
                fontSize: '0.9rem',
                py: 1,
                px: 2.5,
                minWidth: 104,
                borderRadius: 2.5,
                boxShadow: 'none',
                '&:hover': {
                  boxShadow: 'none',
                },
              }}
            >
              Log out
            </Button>
          </Box>
        </DialogContent>
      </Dialog>

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
            gap: breadcrumbItems ? 2 : DASHBOARD_SECTION_GAP,
            pt: breadcrumbItems ? 2 : DASHBOARD_SECTION_GAP,
            width: '100%',
            minWidth: 0,
            alignItems: 'stretch',
          }}
        >
          {breadcrumbItems ? (
            <AppBreadcrumbs items={breadcrumbItems} sx={{ my: 0, mb: 0 }} />
          ) : null}
          <Outlet />
        </Box>
      </Box>
    </Box>
  )
}

export default memo(DashboardLayout)
