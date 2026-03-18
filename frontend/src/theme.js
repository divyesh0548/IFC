import { createTheme } from '@mui/material/styles';

// Color Hunt palette: https://colorhunt.co/palette/f1efecd4c9be123458030303
const LIGHT_BACKGROUND = '#F1EFEC'; // very light background
const LIGHT_SURFACE = '#D4C9BE';    // card / subtle surface
const ACCENT_DARK = '#123458';      // primary accent
const ACCENT_DARKEST = '#030303';   // near-black

const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: ACCENT_DARK,
      light: LIGHT_SURFACE,
      dark: ACCENT_DARKEST,
      contrastText: LIGHT_BACKGROUND,
    },
    secondary: {
      main: LIGHT_SURFACE,
      light: LIGHT_BACKGROUND,
      dark: ACCENT_DARK,
      contrastText: ACCENT_DARKEST,
    },
    background: {
      default: LIGHT_BACKGROUND,
      paper: '#ffffff',
    },
    text: {
      primary: ACCENT_DARKEST,
      secondary: ACCENT_DARK,
      disabled: '#9e9e9e',
    },
    divider: '#e0d7cd',
  },
  typography: {
    fontFamily: [
      '"Archivo"',
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
      fontFamily: '"Roboto", sans-serif',
      fontWeight: 400,
      color: ACCENT_DARK,
      fontSize: '2rem',
    },
    h2: {
      fontFamily: '"Roboto", sans-serif',
      fontWeight: 400,
      color: ACCENT_DARK,
      fontSize: '2rem',
    },
    h3: {
      fontFamily: '"Roboto", sans-serif',
      fontWeight: 400,
      color: ACCENT_DARK,
      fontSize: '2rem',
    },
    h4: {
      fontFamily: '"Roboto", sans-serif',
      fontWeight: 600,
      color: ACCENT_DARK,
      fontSize: '1.5rem',
    },
    h5: {
      fontFamily: '"Roboto", sans-serif',
      fontWeight: 600,
      color: ACCENT_DARK,
      fontSize: '1.5rem',
    },
    h6: {
      fontFamily: '"Roboto", sans-serif',
      fontWeight: 600,
      color: ACCENT_DARK,
      fontSize: '1.5rem',
    },
    body1: {
      fontSize: '1rem',
      color: ACCENT_DARKEST,
    },
    body2: {
      fontSize: '0.9375rem',
      color: ACCENT_DARKEST,
    },
    caption: {
      fontSize: '0.75rem',
      color: ACCENT_DARK,
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
          backgroundColor: ACCENT_DARK,
          color: LIGHT_BACKGROUND,
          '&:hover': {
            backgroundColor: ACCENT_DARKEST,
          },
        },
        containedSecondary: {
          backgroundColor: LIGHT_SURFACE,
          color: ACCENT_DARKEST,
          '&:hover': {
            backgroundColor: ACCENT_DARK,
            color: LIGHT_BACKGROUND,
          },
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: LIGHT_BACKGROUND,
          color: ACCENT_DARKEST,
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

