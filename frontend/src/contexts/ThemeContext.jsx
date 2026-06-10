import React, { createContext, useContext, useState, useEffect } from 'react'
import { ThemeProvider as MUIThemeProvider } from '@mui/material/styles'
import { createAppTheme } from '../theme'

const ThemeContext = createContext()

export const useThemeMode = () => {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useThemeMode must be used within a ThemeProvider')
  }
  return context
}

export const ThemeProvider = ({ children }) => {
  const [mode, setMode] = useState(() => {
    const savedMode = localStorage.getItem('themeMode')
    return savedMode || 'light'
  })

  useEffect(() => {
    localStorage.setItem('themeMode', mode)
  }, [mode])

  const toggleTheme = () => {
    setMode((prevMode) => (prevMode === 'light' ? 'dark' : 'light'))
  }

  const theme = createAppTheme(mode)

  return (
    <ThemeContext.Provider value={{ mode, toggleTheme }}>
      <MUIThemeProvider theme={theme}>
        {children}
      </MUIThemeProvider>
    </ThemeContext.Provider>
  )
}
