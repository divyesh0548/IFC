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

const getTheme = (mode) => {
  const isDark = mode === 'dark'
  
  return createTheme({
    palette: {
      mode: mode,
      primary: {
        main: isDark ? '#38bdf8' : '#0ea5e9', // Lighter sky blue for dark mode, original for light
        light: isDark ? '#7dd3fc' : '#7dd3fc', // Light sky blue
        dark: isDark ? '#0ea5e9' : '#0284c7', // Original sky blue for dark mode hover, darker for light
        contrastText: '#ffffff', // White text
      },
      secondary: {
        main: isDark ? '#0ea5e9' : '#0369a1', // Sky blue for dark mode, deep sky blue for light
        light: isDark ? '#38bdf8' : '#0ea5e9', // Lighter blue for dark mode, sky blue for light
        dark: isDark ? '#0284c7' : '#075985', // Darker sky blue for dark mode, dark blue for light
        contrastText: '#ffffff', // White text
      },
      background: {
        default: isDark ? '#121212' : '#f0f9ff', // Dark gray for dark mode, light blue for light
        paper: isDark ? '#1e1e1e' : '#ffffff', // Dark gray for dark mode, white for light
      },
      text: {
        primary: isDark ? '#ffffff' : '#000000', // White for dark, black for light
        secondary: isDark ? '#b0b0b0' : '#6b7280', // Light gray for dark, gray for light
        disabled: isDark ? '#666666' : '#9ca3af', // Medium gray for dark, gray for light
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
        color: isDark ? '#0ea5e9' : '#0369a1', // Lighter blue for dark mode, original for light
        fontSize: '2rem',
      },
      h2: {
        fontFamily: '"Aldrich", sans-serif',
        fontWeight: 400,
        color: isDark ? '#0ea5e9' : '#0369a1',
        fontSize: '2rem',
      },
      h3: {
        fontFamily: '"Aldrich", sans-serif',
        fontWeight: 400,
        color: isDark ? '#0ea5e9' : '#0369a1',
        fontSize: '2rem',
      },
      h4: {
        fontFamily: '"Lexend", sans-serif',
        fontWeight: 600,
        color: isDark ? '#0ea5e9' : '#0369a1',
        fontSize: '1.5rem',
      },
      h5: {
        fontFamily: '"Lexend", sans-serif',
        fontWeight: 600,
        color: isDark ? '#0ea5e9' : '#0369a1',
        fontSize: '1.5rem',
      },
      h6: {
        fontFamily: '"Lexend", sans-serif',
        fontWeight: 600,
        color: isDark ? '#0ea5e9' : '#0369a1',
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
      MuiButton: {
        styleOverrides: {
          root: {
            textTransform: 'none',
            borderRadius: 8,
          },
          containedPrimary: {
            backgroundColor: isDark ? '#38bdf8' : '#0ea5e9',
            color: '#ffffff',
            '&:hover': {
              backgroundColor: isDark ? '#0ea5e9' : '#0284c7',
            },
          },
          containedSecondary: {
            backgroundColor: isDark ? '#0ea5e9' : '#0369a1',
            color: '#ffffff',
            '&:hover': {
              backgroundColor: isDark ? '#0284c7' : '#075985',
            },
          },
        },
      },
      MuiAppBar: {
        styleOverrides: {
          root: {
            backgroundColor: isDark ? '#1e1e1e' : '#ffffff',
            color: isDark ? '#ffffff' : '#000000',
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundColor: isDark ? '#1e1e1e' : '#ffffff',
          },
        },
      },
      MuiDrawer: {
        styleOverrides: {
          paper: {
            backgroundColor: isDark ? '#1e1e1e' : '#ffffff',
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

