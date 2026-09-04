import { alpha, createTheme, darken } from '@mui/material/styles'
import colorPalettes from './theme/colorPalettes.json'

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

/** Switch themes by changing `activePaletteId` in `src/theme/colorPalettes.json`. */
export const COLOR_PALETTE_CATALOG = colorPalettes
export const ACTIVE_COLOR_PALETTE_ID = colorPalettes.activePaletteId || 'original'

function resolvePalette(paletteId = ACTIVE_COLOR_PALETTE_ID) {
  const palette = colorPalettes.palettes?.[paletteId] || colorPalettes.palettes?.original
  if (!palette?.light || !palette?.dark) {
    throw new Error(`Color palette "${paletteId}" is missing light/dark tokens.`)
  }
  return palette
}

const activePalette = resolvePalette(ACTIVE_COLOR_PALETTE_ID)

/** Active light/dark token sets used by createAppTheme (and legacy blueTheme consumers). */
export const BLUE_THEME_TOKENS = {
  light: activePalette.light,
  dark: activePalette.dark,
}

export function getColorPaletteIds() {
  return Object.keys(colorPalettes.palettes || {})
}

export function getColorPaletteMeta(paletteId = ACTIVE_COLOR_PALETTE_ID) {
  const palette = resolvePalette(paletteId)
  return {
    id: palette.id,
    label: palette.label,
    description: palette.description,
    source: palette.source || null,
    swatches: palette.swatches || null,
  }
}

function buildHeroGradient(tokens) {
  return `linear-gradient(145deg, ${alpha(tokens.heroGradientStart, 0.9)} 0%, ${alpha(tokens.paper, 0.94)} 52%, ${alpha(tokens.heroGradientEnd, 0.96)} 100%)`
}

export const BLUE_GRADIENTS = {
  lightHero: buildHeroGradient(BLUE_THEME_TOKENS.light),
  darkHero: buildHeroGradient(BLUE_THEME_TOKENS.dark),
}

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

export function createAppTheme(mode = 'light', paletteId = ACTIVE_COLOR_PALETTE_ID) {
  const isDark = mode === 'dark'
  const paletteDef = resolvePalette(paletteId)
  const paletteSet = isDark ? paletteDef.dark : paletteDef.light
  const heroGradient = buildHeroGradient(paletteSet)

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
        contrastText: isDark ? paletteSet.text : '#ffffff',
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
        bg: paletteSet.navbarBg,
        fg: paletteSet.navbarFg,
        bottomBorder: paletteSet.navbarBorder,
      },
      gradients: {
        hero: heroGradient,
      },
      blueTheme: {
        light: paletteDef.light,
        dark: paletteDef.dark,
      },
      colorPalette: {
        id: paletteDef.id,
        label: paletteDef.label,
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
          containedPrimary: ({ theme }) => {
            const isDark = theme.palette.mode === 'dark'
            const tokens = theme.palette.blueTheme?.[isDark ? 'dark' : 'light']
            const bg = isDark ? (tokens?.buttonBg || '#0F4C75') : theme.palette.primary.main
            const bgHover = isDark
              ? (tokens?.buttonBgHover || darken(bg, 0.12))
              : darken(theme.palette.primary.main, 0.2)
            const fg = isDark ? '#ffffff' : theme.palette.primary.contrastText
            return {
              backgroundColor: bg,
              color: fg,
              '&:hover': {
                backgroundColor: bgHover,
                color: fg,
              },
            }
          },
          containedSecondary: ({ theme }) => {
            const isDark = theme.palette.mode === 'dark'
            const tokens = theme.palette.blueTheme?.[isDark ? 'dark' : 'light']
            const bg = isDark ? (tokens?.buttonBg || '#0F4C75') : theme.palette.primary.main
            const bgHover = isDark
              ? (tokens?.buttonBgHover || darken(bg, 0.12))
              : darken(theme.palette.primary.main, 0.16)
            const fg = isDark ? '#ffffff' : theme.palette.common.white
            return {
              backgroundColor: bg,
              color: fg,
              '&:hover': {
                backgroundColor: bgHover,
                color: fg,
              },
            }
          },
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
