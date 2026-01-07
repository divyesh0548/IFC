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
      secondary: '#6b7280', // Gray for secondary text (form data)
      disabled: '#9ca3af', // Gray for disabled text
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
    // Custom text size variables for consistent sizing across the website
    customSizes: {
      bigHeader: '2rem',      // For h1, h2, h3 - large headings
      header: '1.5rem',       // For h4, h5, h6 - medium headings
      medium: '1rem',         // For body text, buttons, standard content
      small: '0.75rem',       // For captions, labels, small text
    },
    h1: {
      fontFamily: '"Aldrich", sans-serif',
      fontWeight: 400,
      color: '#0369a1',
      fontSize: '2rem', // Uses customSizes.bigHeader
    },
    h2: {
      fontFamily: '"Aldrich", sans-serif',
      fontWeight: 400,
      color: '#0369a1',
      fontSize: '2rem', // Uses customSizes.bigHeader
    },
    h3: {
      fontFamily: '"Aldrich", sans-serif',
      fontWeight: 400,
      color: '#0369a1',
      fontSize: '2rem', // Uses customSizes.bigHeader
    },
    h4: {
      fontFamily: '"Lexend", sans-serif',
      fontWeight: 600,
      color: '#0369a1',
      fontSize: '1.5rem', // Uses customSizes.header
    },
    h5: {
      fontFamily: '"Lexend", sans-serif',
      fontWeight: 600,
      color: '#0369a1',
      fontSize: '1.5rem', // Uses customSizes.header
    },
    h6: {
      fontFamily: '"Lexend", sans-serif',
      fontWeight: 600,
      color: '#0369a1',
      fontSize: '1.5rem', // Uses customSizes.header
    },
    body1: {
      fontSize: '1rem', // Uses customSizes.medium
    },
    body2: {
      fontSize: '0.9375rem', // Slightly smaller than medium for secondary text
    },
    caption: {
      fontSize: '0.75rem', // Uses customSizes.small
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

