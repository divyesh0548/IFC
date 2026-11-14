import Box from '@mui/material/Box'

export default function BrandLogo() {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        flexShrink: 0,
        bgcolor: (theme) => theme.palette.mode === 'dark' ? '#fff' : 'transparent',
        p: (theme) => theme.palette.mode === 'dark' ? 0.75 : 0,
        lineHeight: 0,
        borderRadius: 1,
      }}
    >
      <Box
        component="img"
        src={`${import.meta.env.BASE_URL}website-logo.png`}
        alt="Strata"
        sx={{ display: 'block', width: { xs: 120, sm: 150 }, height: 'auto' }}
      />
    </Box>
  )
}
