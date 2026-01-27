import React, { useState, useEffect, memo } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useTheme } from '@mui/material/styles'
import Box from '@mui/material/Box'
import Drawer from '@mui/material/Drawer'
import AppBar from '@mui/material/AppBar'
import Toolbar from '@mui/material/Toolbar'
import List from '@mui/material/List'
import Typography from '@mui/material/Typography'
import Divider from '@mui/material/Divider'
import IconButton from '@mui/material/IconButton'
import ListItem from '@mui/material/ListItem'
import ListItemButton from '@mui/material/ListItemButton'
import ListItemIcon from '@mui/material/ListItemIcon'
import ListItemText from '@mui/material/ListItemText'
import Tooltip from '@mui/material/Tooltip'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogContentText from '@mui/material/DialogContentText'
import DialogActions from '@mui/material/DialogActions'
import Button from '@mui/material/Button'
import MenuIcon from '@mui/icons-material/Menu'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import LogoutIcon from '@mui/icons-material/Logout'
import LightModeIcon from '@mui/icons-material/LightMode'
import DarkModeIcon from '@mui/icons-material/DarkMode'
import DashboardIcon from '@mui/icons-material/Dashboard'
import PersonAddIcon from '@mui/icons-material/PersonAdd'
import UploadFileIcon from '@mui/icons-material/UploadFile'
import PostAddIcon from '@mui/icons-material/PostAdd'
import BusinessIcon from '@mui/icons-material/Business'
import { useThemeMode } from '../contexts/ThemeContext'
import { toast } from 'react-hot-toast'

const DRAWER_WIDTH = 240

// Navigation structures for different roles
const getNavigationForRole = (role) => {
  const baseNav = []
  
  switch (role) {
    case 'siteadmin':
      baseNav.push(
        {
          path: '/siteadmin/dashboard',
          title: 'Dashboard',
          icon: <DashboardIcon />,
        },
        {
          path: '/siteadmin/create-company',
          title: 'Create Company',
          icon: <BusinessIcon />,
        }
      )
      break
    
    case 'company_co':
      baseNav.push(
        {
          path: '/company_co/dashboard',
          title: 'Dashboard',
          icon: <DashboardIcon />,
        },
        {
          path: '/company_co/create-user',
          title: 'Create User',
          icon: <PersonAddIcon />,
        },
        {
          path: '/company_co/create-form',
          title: 'Create Form',
          icon: <PostAddIcon />,
        },
        {
          path: '/company_co/upload-excel',
          title: 'Upload Excel',
          icon: <UploadFileIcon />,
        }
      )
      break
    
    case 'user':
      baseNav.push(
        {
          path: '/user/dashboard',
          title: 'Dashboard',
          icon: <DashboardIcon />,
        }
      )
      break
    
    case 'approver':
      baseNav.push(
        {
          path: '/approver/dashboard',
          title: 'Dashboard',
          icon: <DashboardIcon />,
        }
      )
      break
    
    case 'auditor':
      baseNav.push(
        {
          path: '/auditor/dashboard',
          title: 'Dashboard',
          icon: <DashboardIcon />,
        }
      )
      break
    
    default:
      break
  }
  
  return baseNav
}

// Get user role from pathname
const getUserRoleFromPath = (pathname) => {
  if (pathname.startsWith('/siteadmin')) return 'siteadmin'
  if (pathname.startsWith('/company_co')) return 'company_co'
  if (pathname.startsWith('/user')) return 'user'
  if (pathname.startsWith('/approver')) return 'approver'
  if (pathname.startsWith('/auditor')) return 'auditor'
  return null
}

function DashboardLayout() {
  const theme = useTheme()
  const location = useLocation()
  const navigate = useNavigate()
  const [open, setOpen] = useState(true)
  const [userRole, setUserRole] = useState(null)
  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false)
  const { mode, toggleTheme } = useThemeMode()
  
  // Determine role from pathname
  useEffect(() => {
    const role = getUserRoleFromPath(location.pathname)
    setUserRole(role)
  }, [location.pathname])
  
  // Unified logout handler
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
      // Still navigate to login even if logout request fails
      navigate('/login')
    }
  }
  
  const handleDrawerOpen = () => {
    setOpen(true)
  }

  const handleDrawerClose = () => {
    setOpen(false)
  }

  const handleNavigation = (path) => {
    navigate(path)
  }

  const handleLogoutClick = () => {
    setLogoutDialogOpen(true)
  }

  const handleLogoutConfirm = () => {
    setLogoutDialogOpen(false)
    handleUnifiedLogout()
  }

  const handleLogoutCancel = () => {
    setLogoutDialogOpen(false)
  }

  const navigation = getNavigationForRole(userRole)

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      {/* AppBar */}
      <AppBar
        position="fixed"
        sx={{
          zIndex: (theme) => theme.zIndex.drawer + 1,
          backgroundColor: theme.palette.background.paper,
          color: theme.palette.text.primary,
          boxShadow: theme.palette.mode === 'dark' 
            ? '0 2px 8px rgba(0, 0, 0, 0.3)' 
            : '0 2px 8px rgba(0, 0, 0, 0.1)',
          width: { sm: open ? `calc(100% - ${DRAWER_WIDTH}px)` : '100%' },
          ml: { sm: open ? `${DRAWER_WIDTH}px` : 0 },
          transition: theme.transitions.create(['width', 'margin'], {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.enteringScreen,
          }),
        }}
      >
        <Toolbar>
          <IconButton
            color="inherit"
            aria-label="toggle drawer"
            onClick={open ? handleDrawerClose : handleDrawerOpen}
            edge="start"
            sx={{
              marginRight: 2,
            }}
          >
            {open ? <ChevronLeftIcon /> : <MenuIcon />}
          </IconButton>
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
            IFC
          </Typography>
          <Tooltip title={mode === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'} arrow>
            <IconButton
              onClick={toggleTheme}
              sx={{
                color: theme.palette.text.primary,
                marginRight: 1,
                '&:hover': {
                  backgroundColor: theme.palette.mode === 'dark' 
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
              onClick={handleLogoutClick}
              sx={{
                color: theme.palette.text.primary,
                '&:hover': {
                  backgroundColor: theme.palette.mode === 'dark' 
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

      {/* Logout Confirmation Dialog */}
      <Dialog
        open={logoutDialogOpen}
        onClose={handleLogoutCancel}
        aria-labelledby="logout-dialog-title"
        aria-describedby="logout-dialog-description"
        PaperProps={{
          sx: {
            borderRadius: 2,
            minWidth: { xs: '90%', sm: '400px' },
            boxShadow: theme.palette.mode === 'dark'
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
            onClick={handleLogoutCancel} 
            variant="outlined"
            sx={{
              textTransform: 'none',
              px: 3,
              py: 1,
              minWidth: '100px',
              borderColor: theme.palette.mode === 'dark' 
                ? 'rgba(255, 255, 255, 0.23)' 
                : 'rgba(0, 0, 0, 0.23)',
              color: theme.palette.text.primary,
              '&:hover': {
                borderColor: theme.palette.mode === 'dark' 
                  ? 'rgba(255, 255, 255, 0.3)' 
                  : 'rgba(0, 0, 0, 0.3)',
                backgroundColor: theme.palette.mode === 'dark'
                  ? 'rgba(255, 255, 255, 0.05)'
                  : 'rgba(0, 0, 0, 0.04)',
              },
            }}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleLogoutConfirm} 
            variant="contained" 
            color="secondary"
            autoFocus
            sx={{
              textTransform: 'none',
              px: 3,
              py: 1,
              minWidth: '100px',
              fontWeight: 600,
              boxShadow: theme.palette.mode === 'dark'
                ? '0 4px 12px rgba(3, 105, 161, 0.3)'
                : '0 4px 12px rgba(3, 105, 161, 0.2)',
              '&:hover': {
                boxShadow: theme.palette.mode === 'dark'
                  ? '0 6px 16px rgba(3, 105, 161, 0.4)'
                  : '0 6px 16px rgba(3, 105, 161, 0.3)',
              },
            }}
          >
            Log out
          </Button>
        </DialogActions>
      </Dialog>

      {/* Drawer */}
      <Drawer
        variant="persistent"
        open={open}
        sx={{
          width: open ? DRAWER_WIDTH : 0,
          flexShrink: 0,
          transition: theme.transitions.create('width', {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.enteringScreen,
          }),
          '& .MuiDrawer-paper': {
            width: DRAWER_WIDTH,
            boxSizing: 'border-box',
            borderRight: '1px solid',
            borderColor: 'divider',
            overflowX: 'hidden',
            transition: theme.transitions.create('width', {
              easing: theme.transitions.easing.sharp,
              duration: theme.transitions.duration.enteringScreen,
            }),
          },
        }}
      >
        <Toolbar
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            px: [1],
            minHeight: '64px !important', // Match AppBar height
          }}
        >
          {/* Spacer to maintain alignment with AppBar */}
        </Toolbar>
        <Divider />
        <List>
          {navigation.map((item) => {
            const isActive = location.pathname === item.path || 
                           (item.path !== '/siteadmin/dashboard' && 
                            item.path !== '/company_co/dashboard' && 
                            item.path !== '/user/dashboard' && 
                            item.path !== '/approver/dashboard' && 
                            item.path !== '/auditor/dashboard' &&
                            location.pathname.startsWith(item.path))
            
            return (
              <ListItem key={item.path} disablePadding>
                <ListItemButton
                  selected={isActive}
                  onClick={() => handleNavigation(item.path)}
                  sx={{
                    '&.Mui-selected': {
                      backgroundColor: theme.palette.secondary.main + '15',
                      borderLeft: `3px solid ${theme.palette.secondary.main}`,
                      '&:hover': {
                        backgroundColor: theme.palette.secondary.main + '25',
                      },
                    },
                    '&:hover': {
                      backgroundColor: 'rgba(0, 0, 0, 0.04)',
                    },
                  }}
                >
                  <ListItemIcon
                    sx={{
                      color: isActive ? theme.palette.secondary.main : 'inherit',
                      minWidth: 40,
                    }}
                  >
                    {item.icon}
                  </ListItemIcon>
                  <ListItemText 
                    primary={item.title}
                    primaryTypographyProps={{
                      fontWeight: isActive ? 600 : 400,
                      color: isActive ? theme.palette.secondary.main : 'inherit',
                    }}
                  />
                </ListItemButton>
              </ListItem>
            )
          })}
        </List>
      </Drawer>

      {/* Main Content */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 3,
          width: { sm: open ? `calc(100% - ${DRAWER_WIDTH}px)` : '100%' },
          transition: theme.transitions.create(['width', 'margin'], {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.enteringScreen,
          }),
          backgroundColor: theme.palette.background.default,
          minHeight: '100vh',
        }}
      >
        <Toolbar /> {/* Spacer for AppBar */}
        <Outlet /> {/* This renders the child route components */}
      </Box>
    </Box>
  )
}

export default memo(DashboardLayout)

