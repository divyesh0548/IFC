import { alpha, createTheme, darken } from '@mui/material/styles'

/**
 * Global corner radius — edit only here to update the whole app.
 * - `unit` drives MUI `sx` numbers (e.g. borderRadius: 2 → unit × 2 px).
 * - Named keys are used for component overrides (buttons, inputs, surfaces).
 */
export const APP_SHAPE = {
  unit: 2,
  button: 3,
  input: 3,
  surface: 4,
  dialog: 4,
}

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

const NAVBAR_BG_DARK = '#030303'
const NAVBAR_BG_LIGHT = BLUE_THEME_TOKENS.light.navbarBg

const radiusComponentOverrides = {
  MuiButton: {
    styleOverrides: {
      root: {
        textTransform: 'none',
        borderRadius: APP_SHAPE.button,
      },
    },
  },
  MuiPaper: {
    styleOverrides: {
      root: {
        borderRadius: APP_SHAPE.surface,
      },
      rounded: {
        borderRadius: APP_SHAPE.surface,
      },
    },
  },
  MuiCard: {
    styleOverrides: {
      root: {
        borderRadius: APP_SHAPE.surface,
      },
    },
  },
  MuiDialog: {
    styleOverrides: {
      paper: ({ theme }) => ({
        borderRadius: APP_SHAPE.dialog,
        border: `1px solid ${alpha(theme.palette.divider, theme.palette.mode === 'dark' ? 0.75 : 0.95)}`,
        boxShadow:
          theme.palette.mode === 'dark'
            ? '0 20px 48px rgba(0, 0, 0, 0.36)'
            : '0 20px 48px rgba(15, 23, 42, 0.14)',
        overflow: 'hidden',
      }),
    },
  },
  MuiDialogTitle: {
    styleOverrides: {
      root: ({ theme }) => ({
        paddingTop: theme.spacing(3),
        paddingRight: theme.spacing(3),
        paddingBottom: theme.spacing(2.5),
        paddingLeft: theme.spacing(3),
        borderBottom: `1px solid ${theme.palette.divider}`,
        fontSize: '1.18rem',
        fontWeight: 700,
        lineHeight: 1.3,
        color: theme.palette.text.primary,
      }),
    },
  },
  MuiDialogContent: {
    styleOverrides: {
      root: ({ theme }) => ({
        paddingTop: theme.spacing(3),
        paddingRight: theme.spacing(3),
        paddingBottom: theme.spacing(3),
        paddingLeft: theme.spacing(3),
      }),
      dividers: ({ theme }) => ({
        paddingTop: theme.spacing(3),
        paddingRight: theme.spacing(3),
        paddingBottom: theme.spacing(3),
        paddingLeft: theme.spacing(3),
        borderTop: 0,
        borderBottom: 0,
      }),
    },
  },
  MuiDialogActions: {
    styleOverrides: {
      root: ({ theme }) => ({
        paddingTop: theme.spacing(2.5),
        paddingRight: theme.spacing(3),
        paddingBottom: theme.spacing(3),
        paddingLeft: theme.spacing(3),
        gap: theme.spacing(1.5),
        borderTop: `1px solid ${theme.palette.divider}`,
      }),
    },
  },
  MuiAlert: {
    styleOverrides: {
      root: {
        borderRadius: APP_SHAPE.surface,
      },
    },
  },
  MuiOutlinedInput: {
    styleOverrides: {
      root: {
        borderRadius: APP_SHAPE.input,
      },
    },
  },
  MuiTextField: {
    defaultProps: {
      slotProps: {
        input: {
          sx: { borderRadius: APP_SHAPE.input },
        },
      },
    },
  },
  MuiChip: {
    styleOverrides: {
      root: {
        borderRadius: APP_SHAPE.input,
      },
    },
  },
  MuiMenu: {
    styleOverrides: {
      paper: {
        borderRadius: APP_SHAPE.surface,
      },
    },
  },
  MuiPopover: {
    styleOverrides: {
      paper: {
        borderRadius: APP_SHAPE.surface,
      },
    },
  },
  MuiAutocomplete: {
    styleOverrides: {
      paper: {
        borderRadius: APP_SHAPE.surface,
      },
      listbox: {
        borderRadius: APP_SHAPE.surface,
      },
    },
  },
}

export function createAppTheme(mode = 'light') {
  const isDark = mode === 'dark'
  const paletteSet = isDark ? BLUE_THEME_TOKENS.dark : BLUE_THEME_TOKENS.light

  return createTheme({
    shape: {
      borderRadius: APP_SHAPE.unit,
    },
    palette: {
      mode,
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
      appBar: {
        bg: paletteSet.appBarBg,
        fg: paletteSet.appBarFg,
      },
      navbar: {
        bg: isDark ? NAVBAR_BG_DARK : NAVBAR_BG_LIGHT,
        fg: isDark ? NAVBAR_BG_LIGHT : NAVBAR_BG_DARK,
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
      ...radiusComponentOverrides,
      MuiCssBaseline: {
        styleOverrides: {
          body: ({ theme }) => ({
            backgroundColor: theme.palette.background.default,
          }),
        },
      },
      MuiButton: {
        styleOverrides: {
          ...radiusComponentOverrides.MuiButton.styleOverrides,
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
          ...radiusComponentOverrides.MuiPaper.styleOverrides,
          root: ({ theme }) => ({
            backgroundColor: theme.palette.background.paper,
            borderRadius: APP_SHAPE.surface,
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

export default createAppTheme('light')
