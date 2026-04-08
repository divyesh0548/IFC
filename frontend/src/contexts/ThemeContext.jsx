import React, { createContext, useContext, useState, useEffect } from 'react'
import { createTheme, ThemeProvider as MUIThemeProvider, alpha, darken } from '@mui/material/styles'
import { BLUE_GRADIENTS, BLUE_THEME_TOKENS } from '../theme'

const ThemeContext = createContext()

export const useThemeMode = () => {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useThemeMode must be used within a ThemeProvider')
  }
  return context
}

// Company coordinator dashboard AppBar (DashboardLayout) – defined once, exposed on theme.palette.navbar
const NAVBAR_BG_DARK = '#030303'
const NAVBAR_BG_LIGHT = BLUE_THEME_TOKENS.light.navbarBg

const getTheme = (mode) => {
  const isDark = mode === 'dark'
  const paletteSet = isDark ? BLUE_THEME_TOKENS.dark : BLUE_THEME_TOKENS.light

  return createTheme({
    palette: {
      mode,
      // Use a lighter divider color in dark mode so row separators/borders remain visible.
      divider: paletteSet.divider,
      primary: {
        main: paletteSet.primary,
        light: paletteSet.primarySoft,
        dark: paletteSet.primaryDeep,
        contrastText: isDark ? paletteSet.background : '#ffffff',
      },
      secondary: {
        main: paletteSet.surfaceStrong,
        light: paletteSet.surface,
        dark: paletteSet.primary,
        contrastText: paletteSet.text,
      },
      background: {
        default: paletteSet.background,
        paper: paletteSet.paper,
      },
      text: {
        primary: paletteSet.text,
        secondary: paletteSet.textMuted,
        disabled: isDark ? '#7f8fa1' : '#8a97a6',
      },
      /** Default shell AppBar (e.g. siteadmin wrapper) */
      appBar: {
        bg: isDark ? paletteSet.appBarBg : paletteSet.appBarBg,
        fg: isDark ? paletteSet.appBarFg : paletteSet.appBarFg,
      },
      /** Top bar for company_co dashboard layout */
      navbar: {
        bg: isDark ? NAVBAR_BG_DARK : NAVBAR_BG_LIGHT,
        fg: isDark ? NAVBAR_BG_LIGHT : NAVBAR_BG_DARK,
        /** Bottom edge: dark gray in light mode, light gray in dark mode */
        bottomBorder: paletteSet.navbarBorder,
      },
      gradients: {
        hero: isDark ? BLUE_GRADIENTS.darkHero : BLUE_GRADIENTS.lightHero,
      },
      blueTheme: BLUE_THEME_TOKENS,
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
        color: paletteSet.text,
        fontSize: '2rem',
      },
      h2: {
        fontFamily: '"Aldrich", sans-serif',
        fontWeight: 400,
        color: paletteSet.text,
        fontSize: '2rem',
      },
      h3: {
        fontFamily: '"Aldrich", sans-serif',
        fontWeight: 400,
        color: paletteSet.text,
        fontSize: '2rem',
      },
      h4: {
        fontFamily: '"Lexend", sans-serif',
        fontWeight: 600,
        color: paletteSet.text,
        fontSize: '1.5rem',
      },
      h5: {
        fontFamily: '"Lexend", sans-serif',
        fontWeight: 600,
        color: paletteSet.text,
        fontSize: '1.5rem',
      },
      h6: {
        fontFamily: '"Lexend", sans-serif',
        fontWeight: 600,
        color: paletteSet.text,
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
            backgroundColor: theme.palette.primary.main,
            color:
              theme.palette.mode === 'dark'
                ? theme.palette.background.default
                : theme.palette.common.white,
            '&:hover': {
              backgroundColor:
                theme.palette.mode === 'dark'
                  ? darken(theme.palette.primary.main, 0.12)
                  : darken(theme.palette.primary.main, 0.16),
              color:
                theme.palette.mode === 'dark'
                  ? theme.palette.background.default
                  : theme.palette.common.white,
            },
          }),
          outlinedPrimary: ({ theme }) => ({
            borderColor: alpha(theme.palette.primary.main, 0.35),
            color: theme.palette.text.primary,
            '&:hover': {
              borderColor: theme.palette.primary.main,
              backgroundColor: alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.12 : 0.06),
            },
          }),
          outlinedSecondary: ({ theme }) => ({
            borderColor: alpha(theme.palette.text.primary, 0.18),
            color: theme.palette.text.primary,
            '&:hover': {
              borderColor: alpha(theme.palette.text.primary, 0.28),
              backgroundColor: alpha(theme.palette.text.primary, theme.palette.mode === 'dark' ? 0.08 : 0.04),
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

