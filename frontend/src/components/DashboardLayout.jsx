import React, { memo, useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useTheme } from '@mui/material/styles'
import Box from '@mui/material/Box'
import AppBar from '@mui/material/AppBar'
import Toolbar from '@mui/material/Toolbar'
import Typography from '@mui/material/Typography'
import Tooltip from '@mui/material/Tooltip'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogContentText from '@mui/material/DialogContentText'
import DialogActions from '@mui/material/DialogActions'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import HomeRoundedIcon from '@mui/icons-material/HomeRounded'
import LogoutIcon from '@mui/icons-material/Logout'
import LightModeIcon from '@mui/icons-material/LightMode'
import DarkModeIcon from '@mui/icons-material/DarkMode'
import { useThemeMode } from '../contexts/ThemeContext'
import { toast } from 'react-hot-toast'

const getHomePath = (pathname) => {
  if (pathname.startsWith('/company_co')) return '/company_co/home'
  if (pathname.startsWith('/siteadmin')) return '/siteadmin/dashboard'
  if (pathname.startsWith('/user')) return '/user/dashboard'
  if (pathname.startsWith('/approver')) return '/approver/dashboard'
  if (pathname.startsWith('/auditor')) return '/auditor/dashboard'
  return '/'
}

function DashboardLayout() {
  const theme = useTheme()
  const navigate = useNavigate()
  const location = useLocation()
  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false)
  const { mode, toggleTheme } = useThemeMode()
  const homePath = getHomePath(location.pathname)
  const isAtHome = location.pathname === homePath
  const contentPaddingX = { xs: 2, sm: 3, md: 4 }
  const contentInnerInsetX = { xs: 1, sm: 2, md: 2 }
  const navbarPaddingX = { xs: 3, sm: 5, md: 6 }

  const handleUnifiedLogout = async () => {
    try {
      const response = await fetch('http://localhost:3000/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      })
      const data = await response.json()
      if (response.ok && data.success) {
        toast.success('Logged out successfully')
        navigate('/login')
      } else {
        console.error('Logout failed:', data.message)
        toast.error(data.message || 'Logout failed')
        navigate('/login')
      }
    } catch (error) {
      console.error('Logout error:', error)
      toast.error('Error during logout')
      navigate('/login')
    }
  }

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <AppBar
        position="fixed"
        sx={{
          backgroundColor: theme.palette.background.paper,
          color: theme.palette.text.primary,
          boxShadow:
            theme.palette.mode === 'dark'
              ? '0 2px 8px rgba(0, 0, 0, 0.3)'
              : '0 2px 8px rgba(0, 0, 0, 0.1)',
        }}
      >
        <Toolbar
          disableGutters
          sx={{
            px: navbarPaddingX,
          }}
        >
          <Typography
            variant="h6"
            noWrap
            component="div"
            sx={{
              flexGrow: 1,
              fontWeight: 700,
              color: theme.palette.text.primary,
            }}
          >
            Internal Financial Control
          </Typography>
          <Tooltip title={mode === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'} arrow>
            <IconButton
              onClick={toggleTheme}
              sx={{
                color: theme.palette.text.primary,
                marginRight: 1,
                '&:hover': {
                  backgroundColor:
                    theme.palette.mode === 'dark'
                      ? 'rgba(255, 255, 255, 0.08)'
                      : 'rgba(0, 0, 0, 0.04)',
                },
              }}
            >
              {mode === 'light' ? <DarkModeIcon /> : <LightModeIcon />}
            </IconButton>
          </Tooltip>
          <Tooltip title="Logout" arrow>
            <IconButton
              onClick={() => setLogoutDialogOpen(true)}
              sx={{
                color: theme.palette.text.primary,
                '&:hover': {
                  backgroundColor:
                    theme.palette.mode === 'dark'
                      ? 'rgba(255, 255, 255, 0.08)'
                      : 'rgba(0, 0, 0, 0.04)',
                },
              }}
            >
              <LogoutIcon />
            </IconButton>
          </Tooltip>
        </Toolbar>
      </AppBar>

      <Dialog
        open={logoutDialogOpen}
        onClose={() => setLogoutDialogOpen(false)}
        aria-labelledby="logout-dialog-title"
        aria-describedby="logout-dialog-description"
        PaperProps={{
          sx: {
            borderRadius: 2,
            minWidth: { xs: '90%', sm: '400px' },
            boxShadow:
              theme.palette.mode === 'dark'
                ? '0 8px 32px rgba(0, 0, 0, 0.4)'
                : '0 8px 32px rgba(0, 0, 0, 0.12)',
          },
        }}
      >
        <DialogTitle
          id="logout-dialog-title"
          sx={{
            pb: 2.5,
            pt: 3,
            px: 3,
            fontWeight: 600,
            fontSize: '1.25rem',
            color: theme.palette.text.primary,
          }}
        >
          Confirm Logout
        </DialogTitle>
        <DialogContent sx={{ px: 3, pt: 3, pb: 3 }}>
          <DialogContentText
            id="logout-dialog-description"
            sx={{
              color: theme.palette.text.secondary,
              fontSize: '0.9375rem',
              lineHeight: 1.5,
              m: 0,
            }}
          >
            Are you sure you want to log out? You will need to log in again to access your account.
          </DialogContentText>
        </DialogContent>
        <DialogActions
          sx={{
            px: 3,
            pb: 3,
            pt: 2.5,
            gap: 1.5,
            borderTop: '1px solid',
            borderColor: 'divider',
          }}
        >
          <Button
            onClick={() => setLogoutDialogOpen(false)}
            variant="outlined"
            sx={{
              textTransform: 'none',
              px: 3,
              py: 1,
              minWidth: '100px',
              borderColor:
                theme.palette.mode === 'dark'
                  ? 'rgba(255, 255, 255, 0.23)'
                  : 'rgba(0, 0, 0, 0.23)',
              color: theme.palette.text.primary,
              '&:hover': {
                borderColor:
                  theme.palette.mode === 'dark'
                    ? 'rgba(255, 255, 255, 0.3)'
                    : 'rgba(0, 0, 0, 0.3)',
                backgroundColor:
                  theme.palette.mode === 'dark'
                    ? 'rgba(255, 255, 255, 0.05)'
                    : 'rgba(0, 0, 0, 0.04)',
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
              px: 3,
              py: 1,
              minWidth: '100px',
              fontWeight: 600,
              boxShadow:
                theme.palette.mode === 'dark'
                  ? '0 4px 12px rgba(3, 105, 161, 0.3)'
                  : '0 4px 12px rgba(3, 105, 161, 0.2)',
              '&:hover': {
                boxShadow:
                  theme.palette.mode === 'dark'
                    ? '0 6px 16px rgba(3, 105, 161, 0.4)'
                    : '0 6px 16px rgba(3, 105, 161, 0.3)',
              },
            }}
          >
            Log out
          </Button>
        </DialogActions>
      </Dialog>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          px: contentPaddingX,
          py: 3,
          width: '100%',
          backgroundColor: theme.palette.background.default,
          minHeight: '100vh',
        }}
      >
        <Toolbar />
        {!isAtHome && (
          <Box sx={{ display: 'flex', justifyContent: 'flex-start', mb: 2, pl: contentInnerInsetX }}>
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
  )
}

export default memo(DashboardLayout)
