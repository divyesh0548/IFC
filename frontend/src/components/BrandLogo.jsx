import Box from '@mui/material/Box'
import { useTheme } from '@mui/material/styles'

export default function BrandLogo() {
  const theme = useTheme()
  const logoFilename = theme.palette.mode === 'dark'
    ? 'website-logo-dark-mode.png'
    : 'website-logo.png'

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        flexShrink: 0,
        lineHeight: 0,
        borderRadius: 1,
      }}
    >
      <Box
        component="img"
        src={`${import.meta.env.BASE_URL}${logoFilename}`}
        alt="Strata"
        sx={{ display: 'block', width: { xs: 120, sm: 150 }, height: 'auto' }}
      />
    </Box>
  )
}
