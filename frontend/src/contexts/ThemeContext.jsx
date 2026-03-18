import React, { createContext, useContext, useState, useEffect } from 'react'
import { createTheme, ThemeProvider as MUIThemeProvider } from '@mui/material/styles'

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

const getTheme = (mode) => {
  const isDark = mode === 'dark'

  return createTheme({
    palette: {
      mode,
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
      },
      body2: {
        fontSize: '0.9375rem',
      },
      caption: {
        fontSize: '0.75rem',
      },
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: {
            // Page background (outside containers)
            backgroundColor: isDark ? DARK_BG_DARKEST : LIGHT_PRIMARY_LIGHT,
          },
        },
      },
      MuiButton: {
        styleOverrides: {
          root: {
            textTransform: 'none',
            borderRadius: 8,
          },
          containedPrimary: {
            backgroundColor: isDark ? DARK_ACCENT : LIGHT_PRIMARY_DARK,
            color: isDark ? DARK_BG_DARKEST : '#ffffff',
            '&:hover': {
              backgroundColor: isDark
                ? '#5d9497' // slightly darker in dark mode
                : '#1c2838', // gentle darken of LIGHT_PRIMARY_DARK in light mode
            },
          },
          containedSecondary: {
            // In dark mode, use the accent color directly so it’s clearly visible.
            backgroundColor: isDark ? DARK_ACCENT : LIGHT_PRIMARY_SOFT,
            color: isDark ? DARK_BG_DARKEST : LIGHT_PRIMARY_DARK,
            '&:hover': {
              backgroundColor: isDark
                ? '#5d9497' // slightly darker than DARK_ACCENT
                : '#8a9dac', // gentle darken of LIGHT_PRIMARY_SOFT
            },
          },
        },
      },
      MuiAppBar: {
        styleOverrides: {
          root: {
            // Navbar: solid color from respective palettes
            backgroundColor: isDark ? DARK_BG_DARK : LIGHT_PRIMARY_MEDIUM,
            color: isDark ? DARK_TEXT_LIGHT : LIGHT_PRIMARY_LIGHT,
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundColor: isDark ? DARK_BG_DARK : '#ffffff',
          },
        },
      },
      MuiDrawer: {
        styleOverrides: {
          paper: {
            backgroundColor: isDark ? DARK_BG_DARKEST : '#ffffff',
            borderRight: `1px solid ${isDark ? '#333333' : '#e0e0e0'}`,
          },
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

