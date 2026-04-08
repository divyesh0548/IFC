import { alpha, createTheme } from '@mui/material/styles'

export const BLUE_THEME_TOKENS = {
  light: {
    background: '#eef4fb',
    backgroundAlt: '#e3edf8',
    paper: '#ffffff',
    surface: '#d7e6f5',
    surfaceStrong: '#bfd5eb',
    primary: '#123458',
    primarySoft: '#315f8a',
    primaryDeep: '#0b2239',
    accent: '#4f86c6',
    text: '#183b63',
    textMuted: '#45627f',
    divider: '#c9d9ea',
    navbarBg: '#ffffff',
    navbarFg: '#0b2239',
    appBarBg: '#bfd5eb',
    appBarFg: '#0b2239',
    navbarBorder: '#c9d9ea',
    heroGradientStart: '#dcecff',
    heroGradientEnd: '#edf5ff',
    heroGlow: '#60a5fa',
    boxTint: '#eaf3fd',
  },
  dark: {
    background: '#0b1420',
    backgroundAlt: '#0f1c2c',
    paper: '#132235',
    surface: '#18304a',
    surfaceStrong: '#20405f',
    primary: '#8bb8e8',
    primarySoft: '#5f93cb',
    primaryDeep: '#d6e8fb',
    accent: '#60a5fa',
    text: '#edf4fb',
    textMuted: '#b8cbe0',
    divider: 'rgba(173, 203, 232, 0.18)',
    navbarBg: '#030303',
    navbarFg: '#eef4fb',
    appBarBg: '#18304a',
    appBarFg: '#edf4fb',
    navbarBorder: 'rgba(173, 203, 232, 0.22)',
    heroGradientStart: '#16314d',
    heroGradientEnd: '#0f1b2d',
    heroGlow: '#60a5fa',
    boxTint: '#11253a',
  },
}

export const BLUE_GRADIENTS = {
  lightHero: `linear-gradient(145deg, ${alpha(BLUE_THEME_TOKENS.light.heroGradientStart, 0.9)} 0%, ${alpha(BLUE_THEME_TOKENS.light.paper, 0.98)} 48%, ${alpha(BLUE_THEME_TOKENS.light.heroGradientEnd, 0.9)} 100%)`,
  darkHero: `linear-gradient(145deg, ${alpha(BLUE_THEME_TOKENS.dark.heroGradientStart, 0.9)} 0%, ${alpha(BLUE_THEME_TOKENS.dark.paper, 0.94)} 52%, ${alpha(BLUE_THEME_TOKENS.dark.heroGradientEnd, 0.96)} 100%)`,
}

const preview = BLUE_THEME_TOKENS.light

const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: preview.primary,
      light: preview.primarySoft,
      dark: preview.primaryDeep,
      contrastText: '#ffffff',
    },
    secondary: {
      main: preview.surfaceStrong,
      light: preview.surface,
      dark: preview.primary,
      contrastText: preview.text,
    },
    background: {
      default: preview.background,
      paper: preview.paper,
    },
    text: {
      primary: preview.text,
      secondary: preview.textMuted,
      disabled: '#8a97a6',
    },
    divider: preview.divider,
    blueTheme: BLUE_THEME_TOKENS,
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
          backgroundColor: preview.primary,
          color: '#ffffff',
          '&:hover': {
            backgroundColor: preview.primaryDeep,
          },
        },
        containedSecondary: {
          backgroundColor: preview.primary,
          color: '#ffffff',
          '&:hover': {
            backgroundColor: preview.primaryDeep,
            color: '#ffffff',
          },
        },
        outlinedPrimary: {
          borderColor: alpha(preview.primary, 0.35),
          color: preview.text,
          '&:hover': {
            borderColor: preview.primary,
            backgroundColor: alpha(preview.primary, 0.06),
          },
        },
        outlinedSecondary: {
          borderColor: alpha(preview.text, 0.18),
          color: preview.text,
          '&:hover': {
            borderColor: alpha(preview.text, 0.28),
            backgroundColor: alpha(preview.text, 0.04),
          },
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: preview.navbarBg,
          color: preview.navbarFg,
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundColor: preview.paper,
        },
      },
    },
  },
})

export default theme

