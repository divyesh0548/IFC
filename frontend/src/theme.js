import { createTheme } from '@mui/material/styles';

// Sky Blue Theme with White Text
const theme = createTheme({
  palette: {
    primary: {
      main: '#0ea5e9', // Sky blue
      light: '#7dd3fc', // Light sky blue
      dark: '#0284c7', // Darker sky blue
      contrastText: '#ffffff', // White text
    },
    secondary: {
      main: '#0369a1', // Deep sky blue
      light: '#0ea5e9', // Sky blue
      dark: '#075985', // Dark blue
      contrastText: '#ffffff', // White text
    },
    background: {
      default: '#f0f9ff', // Very light sky blue
      paper: '#ffffff', // White
    },
    text: {
      primary: '#000000', // Black for primary text
      secondary: '#000000', // Black for secondary text
      disabled: '#9ca3af', // Gray for disabled text
    },
  },
  typography: {
    fontFamily: [
      '-apple-system',
      'BlinkMacSystemFont',
      '"Segoe UI"',
      'Roboto',
      '"Helvetica Neue"',
      'Arial',
      'sans-serif',
    ].join(','),
    h1: {
      fontWeight: 700,
      color: '#0369a1',
    },
    h2: {
      fontWeight: 700,
      color: '#0369a1',
    },
    h3: {
      fontWeight: 600,
      color: '#0369a1',
    },
    h4: {
      fontWeight: 600,
      color: '#0369a1',
    },
    h5: {
      fontWeight: 600,
      color: '#0369a1',
    },
    h6: {
      fontWeight: 600,
      color: '#0369a1',
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
          backgroundColor: '#0ea5e9',
          color: '#ffffff',
          '&:hover': {
            backgroundColor: '#0284c7',
          },
        },
        containedSecondary: {
          backgroundColor: '#0369a1',
          color: '#ffffff',
          '&:hover': {
            backgroundColor: '#075985',
          },
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: '#ffffff', // White background
          color: '#000000', // Black text
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundColor: '#ffffff',
        },
      },
    },
  },
});

export default theme;

