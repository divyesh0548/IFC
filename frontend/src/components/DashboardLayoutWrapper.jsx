import React, { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
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
import MenuIcon from '@mui/icons-material/Menu'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import LogoutIcon from '@mui/icons-material/Logout'
import DashboardIcon from '@mui/icons-material/Dashboard'
import PersonAddIcon from '@mui/icons-material/PersonAdd'
import UploadFileIcon from '@mui/icons-material/UploadFile'
import BusinessIcon from '@mui/icons-material/Business'

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
          path: '/company_co/user-management',
          title: 'User Management',
          icon: <PersonAddIcon />,
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

function DashboardLayoutWrapper({ children, userRole, onLogout }) {
  const theme = useTheme()
  const location = useLocation()
  const navigate = useNavigate()
  const [open, setOpen] = useState(true)
  
  const navigation = getNavigationForRole(userRole)
  
  const handleDrawerOpen = () => {
    setOpen(true)
  }

  const handleDrawerClose = () => {
    setOpen(false)
  }

  const handleNavigation = (path) => {
    navigate(path)
  }

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      {/* AppBar */}
      <AppBar
        position="fixed"
        sx={{
          zIndex: (theme) => theme.zIndex.drawer + 1,
          backgroundColor: '#ffffff',
          color: theme.palette.text.primary,
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
        }}
      >
        <Toolbar>
          <IconButton
            color="inherit"
            aria-label="open drawer"
            onClick={handleDrawerOpen}
            edge="start"
            sx={{
              marginRight: 2,
              ...(open && { display: 'none' }),
            }}
          >
            <MenuIcon />
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
          <Tooltip title="Logout" arrow>
            <IconButton
              onClick={onLogout}
              sx={{
                color: theme.palette.text.primary,
                '&:hover': {
                  backgroundColor: 'rgba(0, 0, 0, 0.04)',
                },
              }}
            >
              <LogoutIcon />
            </IconButton>
          </Tooltip>
        </Toolbar>
      </AppBar>

      {/* Drawer */}
      <Drawer
        variant="persistent"
        open={open}
        sx={{
          width: DRAWER_WIDTH,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: DRAWER_WIDTH,
            boxSizing: 'border-box',
            borderRight: '1px solid',
            borderColor: 'divider',
          },
        }}
      >
        <Toolbar
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            px: [1],
          }}
        >
          <IconButton onClick={handleDrawerClose}>
            <ChevronLeftIcon />
          </IconButton>
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
          width: { sm: `calc(100% - ${open ? DRAWER_WIDTH : 0}px)` },
          transition: theme.transitions.create(['width', 'margin'], {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.enteringScreen,
          }),
          backgroundColor: '#f8f9fa',
          minHeight: '100vh',
        }}
      >
        <Toolbar /> {/* Spacer for AppBar */}
        {children}
      </Box>
    </Box>
  )
}

export default DashboardLayoutWrapper
