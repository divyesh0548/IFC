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
      fontWeight: 800,
      letterSpacing: '-0.03em',
      lineHeight: 1.05,
      fontSize: 'clamp(2.2rem, 4vw, 3.3rem)',
    },
    h2: {
      fontWeight: 800,
      letterSpacing: '-0.03em',
      lineHeight: 1.12,
      fontSize: 'clamp(1.9rem, 3.2vw, 2.6rem)',
    },
    h3: {
      fontWeight: 800,
      letterSpacing: '-0.025em',
      lineHeight: 1.18,
      fontSize: 'clamp(1.6rem, 2.6vw, 2.1rem)',
    },
    h4: {
      fontWeight: 800,
      letterSpacing: '-0.02em',
      lineHeight: 1.22,
      fontSize: '1.55rem',
    },
    h5: {
      fontWeight: 800,
      letterSpacing: '-0.01em',
      lineHeight: 1.28,
      fontSize: '1.25rem',
    },
    h6: {
      fontWeight: 800,
      letterSpacing: '-0.005em',
      lineHeight: 1.32,
      fontSize: '1.1rem',
    },
    body1: {
      fontSize: '1rem',
      lineHeight: 1.9,
      fontWeight: 500,
      letterSpacing: '-0.005em',
    },
    body2: {
      fontSize: '0.9375rem',
      lineHeight: 1.8,
      fontWeight: 500,
      letterSpacing: '-0.005em',
    },
    caption: {
      fontSize: '0.75rem',
      letterSpacing: '0.02em',
    },
    subtitle1: {
      fontWeight: 700,
      letterSpacing: '-0.01em',
      lineHeight: 1.5,
    },
    subtitle2: {
      fontWeight: 700,
      letterSpacing: '0.06em',
      textTransform: 'uppercase',
      fontSize: '0.8rem',
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
          backgroundColor: ACCENT_DARK,
          color: '#ffffff',
          '&:hover': {
            backgroundColor: ACCENT_DARKEST,
            color: '#ffffff',
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

