import React, { createContext, useContext, useState, useEffect } from 'react'
import { createTheme, ThemeProvider as MUIThemeProvider, darken } from '@mui/material/styles'

const ThemeContext = createContext()

export const useThemeMode = () => {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useThemeMode must be used within a ThemeProvider')
  }
  return context
}

// Light-mode palette (Color Hunt): https://colorhunt.co/palette/27374d526d829db2bfdde6ed
const LIGHT_PRIMARY_DARK = '#27374D'
const LIGHT_PRIMARY_MEDIUM = '#526D82'
const LIGHT_PRIMARY_SOFT = '#9DB2BF'
const LIGHT_PRIMARY_LIGHT = '#DDE6ED'

// Dark-mode palette (Color Hunt): https://colorhunt.co/palette/22283131363f76abaeeeeeee
const DARK_BG_DARKEST = '#222831'
const DARK_BG_DARK = '#31363F'
const DARK_ACCENT = '#76ABAE'
const DARK_TEXT_LIGHT = '#EEEEEE'

// Company coordinator dashboard AppBar (DashboardLayout) – defined once, exposed on theme.palette.navbar
const NAVBAR_BG_DARK = '#030303'
const NAVBAR_BG_LIGHT = '#F1EFEC'

const getTheme = (mode) => {
  const isDark = mode === 'dark'

  return createTheme({
    palette: {
      mode,
      // Use a lighter divider color in dark mode so row separators/borders remain visible.
      divider: isDark ? 'rgba(255, 255, 255, 0.14)' : '#e0e0e0',
      primary: isDark
        ? {
            main: DARK_ACCENT,
            light: '#9ed2d5',
            dark: '#4f8184',
            contrastText: DARK_TEXT_LIGHT,
          }
        : {
            main: LIGHT_PRIMARY_DARK,
            light: LIGHT_PRIMARY_MEDIUM,
            dark: LIGHT_PRIMARY_DARK,
            contrastText: '#ffffff',
          },
      secondary: isDark
        ? {
            main: DARK_BG_DARK,
            light: '#4a505a',
            dark: '#1a1f26',
            contrastText: DARK_TEXT_LIGHT,
          }
        : {
            main: LIGHT_PRIMARY_MEDIUM,
            light: LIGHT_PRIMARY_SOFT,
            dark: LIGHT_PRIMARY_DARK,
            contrastText: '#ffffff',
          },
      background: isDark
        ? {
            default: DARK_BG_DARKEST,
            paper: DARK_BG_DARK,
          }
        : {
            default: LIGHT_PRIMARY_LIGHT,
            paper: '#ffffff',
          },
      text: isDark
        ? {
            primary: DARK_TEXT_LIGHT,
            secondary: '#c8d0d6',
            disabled: '#777b81',
          }
        : {
            primary: LIGHT_PRIMARY_DARK,
            secondary: LIGHT_PRIMARY_MEDIUM,
            disabled: '#9ca3af',
          },
      /** Default shell AppBar (e.g. siteadmin wrapper) */
      appBar: {
        bg: isDark ? DARK_BG_DARK : LIGHT_PRIMARY_MEDIUM,
        fg: isDark ? DARK_TEXT_LIGHT : LIGHT_PRIMARY_LIGHT,
      },
      /** Top bar for company_co dashboard layout */
      navbar: {
        bg: isDark ? NAVBAR_BG_DARK : NAVBAR_BG_LIGHT,
        fg: isDark ? NAVBAR_BG_LIGHT : NAVBAR_BG_DARK,
        /** Bottom edge: dark gray in light mode, light gray in dark mode */
        bottomBorder: isDark
          ? 'rgba(241, 239, 236, 0.35)'
          : LIGHT_PRIMARY_MEDIUM,
      },
    },
    typography: {
      fontFamily: [
        '"Lexend"',
        '-apple-system',
        'BlinkMacSystemFont',
        '"Segoe UI"',
        'Roboto',
        '"Helvetica Neue"',
        'Arial',
        'sans-serif',
      ].join(','),
      fontWeightRegular: 500,
      fontWeightMedium: 600,
      fontWeightBold: 800,
      customSizes: {
        bigHeader: '2rem',
        header: '1.5rem',
        medium: '1rem',
        small: '0.75rem',
      },
      h1: {
        fontFamily: '"Aldrich", sans-serif',
        fontWeight: 400,
        color: isDark ? DARK_TEXT_LIGHT : LIGHT_PRIMARY_DARK,
        fontSize: '2rem',
      },
      h2: {
        fontFamily: '"Aldrich", sans-serif',
        fontWeight: 400,
        color: isDark ? DARK_TEXT_LIGHT : LIGHT_PRIMARY_DARK,
        fontSize: '2rem',
      },
      h3: {
        fontFamily: '"Aldrich", sans-serif',
        fontWeight: 400,
        color: isDark ? DARK_TEXT_LIGHT : LIGHT_PRIMARY_DARK,
        fontSize: '2rem',
      },
      h4: {
        fontFamily: '"Lexend", sans-serif',
        fontWeight: 600,
        color: isDark ? DARK_TEXT_LIGHT : LIGHT_PRIMARY_DARK,
        fontSize: '1.5rem',
      },
      h5: {
        fontFamily: '"Lexend", sans-serif',
        fontWeight: 600,
        color: isDark ? DARK_TEXT_LIGHT : LIGHT_PRIMARY_DARK,
        fontSize: '1.5rem',
      },
      h6: {
        fontFamily: '"Lexend", sans-serif',
        fontWeight: 600,
        color: isDark ? DARK_TEXT_LIGHT : LIGHT_PRIMARY_DARK,
        fontSize: '1.5rem',
      },
      body1: {
        fontSize: '1rem',
        fontWeight: 500,
        letterSpacing: '-0.005em',
        lineHeight: 1.8,
      },
      body2: {
        fontSize: '0.9375rem',
        fontWeight: 500,
        letterSpacing: '-0.005em',
        lineHeight: 1.75,
      },
      caption: {
        fontSize: '0.75rem',
      },
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: ({ theme }) => ({
            backgroundColor: theme.palette.background.default,
          }),
        },
      },
      MuiButton: {
        styleOverrides: {
          root: {
            textTransform: 'none',
            borderRadius: 8,
          },
          containedPrimary: ({ theme }) => ({
            backgroundColor: theme.palette.primary.main,
            color:
              theme.palette.mode === 'dark'
                ? theme.palette.background.default
                : theme.palette.primary.contrastText,
            '&:hover': {
              backgroundColor:
                theme.palette.mode === 'dark'
                  ? darken(theme.palette.primary.main, 0.12)
                  : darken(theme.palette.primary.main, 0.2),
              color:
                theme.palette.mode === 'dark'
                  ? theme.palette.background.default
                  : theme.palette.primary.contrastText,
            },
          }),
          containedSecondary: ({ theme }) => ({
            backgroundColor: theme.palette.text.primary,
            color:
              theme.palette.mode === 'dark'
                ? theme.palette.background.default
                : theme.palette.common.white,
            '&:hover': {
              backgroundColor:
                theme.palette.mode === 'dark'
                  ? theme.palette.grey[300]
                  : darken(theme.palette.text.primary, 0.15),
              color:
                theme.palette.mode === 'dark'
                  ? theme.palette.background.default
                  : theme.palette.common.white,
            },
          }),
        },
      },
      MuiAppBar: {
        styleOverrides: {
          root: ({ theme }) => ({
            backgroundColor: theme.palette.appBar.bg,
            color: theme.palette.appBar.fg,
          }),
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: ({ theme }) => ({
            backgroundColor: theme.palette.background.paper,
          }),
        },
      },
      MuiDrawer: {
        styleOverrides: {
          paper: ({ theme }) => ({
            backgroundColor: theme.palette.background.default,
            borderRight: `1px solid ${theme.palette.divider}`,
          }),
        },
      },
    },
  })
}

export const ThemeProvider = ({ children }) => {
  const [mode, setMode] = useState(() => {
    // Get theme from localStorage or default to 'light'
    const savedMode = localStorage.getItem('themeMode')
    return savedMode || 'light'
  })

  useEffect(() => {
    // Save theme preference to localStorage
    localStorage.setItem('themeMode', mode)
  }, [mode])

  const toggleTheme = () => {
    setMode((prevMode) => (prevMode === 'light' ? 'dark' : 'light'))
  }

  const theme = getTheme(mode)

  return (
    <ThemeContext.Provider value={{ mode, toggleTheme }}>
      <MUIThemeProvider theme={theme}>
        {children}
      </MUIThemeProvider>
    </ThemeContext.Provider>
  )
}

