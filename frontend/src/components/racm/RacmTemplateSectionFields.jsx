import React from 'react'
import { Box, Card, CardContent, TextField, Typography } from '@mui/material'
import { useTheme } from '@mui/material/styles'

function getSectionFields(fieldDefinitions, sectionKey) {
  return (Array.isArray(fieldDefinitions) ? fieldDefinitions : [])
    .filter((field) => !field.is_fixed && (field.section_key || 'others') === sectionKey)
    .sort((a, b) => Number(a.display_order || 0) - Number(b.display_order || 0))
}

function getFieldCellSx(theme) {
  return {
    p: 2.5,
    borderRadius: 2,
    backgroundColor: theme.palette.mode === 'dark'
      ? 'rgba(255, 255, 255, 0.03)'
      : 'rgba(0, 0, 0, 0.02)',
    border: '1px solid',
    borderColor: theme.palette.mode === 'dark'
      ? 'rgba(255, 255, 255, 0.08)'
      : 'rgba(0, 0, 0, 0.06)',
    transition: 'all 0.2s ease-in-out',
    '&:hover': {
      backgroundColor: theme.palette.mode === 'dark'
        ? 'rgba(255, 255, 255, 0.05)'
        : 'rgba(0, 0, 0, 0.04)',
    },
  }
}

export function RacmTemplateSectionFields({
  sectionKey,
  title,
  fieldDefinitions,
  values,
  isEditMode = false,
  onChange,
  disabled = false,
  asCard = true,
  showTitle = true,
  blendIntoParent = false,
}) {
  const theme = useTheme()
  const fields = getSectionFields(fieldDefinitions, sectionKey)
  if (fields.length === 0) return null

  const fieldCells = fields.map((field) => {
    const value = values?.[field.field_key] ?? ''
    const isEmpty = value === null || value === undefined || String(value).trim() === ''

    if (isEditMode && onChange) {
      return (
        <TextField
          key={field.field_key}
          label={field.label}
          value={value}
          onChange={(e) => onChange(field.field_key, e.target.value)}
          fullWidth
          multiline
          rows={3}
          variant="outlined"
          disabled={disabled}
        />
      )
    }

    return (
      <Box key={field.field_key} sx={getFieldCellSx(theme)}>
        <Typography
          variant="caption"
          component="dt"
          sx={{
            display: 'block',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            mb: 1.5,
            color: 'text.primary',
            fontSize: theme.typography.customSizes?.small || '0.75rem',
          }}
        >
          {field.label}
        </Typography>
        <Typography
          variant="body2"
          component="dd"
          sx={{
            color: isEmpty ? 'text.disabled' : 'text.secondary',
            wordBreak: 'break-word',
            lineHeight: 1.6,
            fontSize: theme.typography.customSizes?.medium,
          }}
        >
          {isEmpty ? '-' : String(value)}
        </Typography>
      </Box>
    )
  })

  if (blendIntoParent) {
    return <>{fieldCells}</>
  }

  const content = (
    <>
      {showTitle ? (
        <Typography
          variant="h6"
          component="h3"
          sx={{
            fontWeight: 700,
            mb: 3,
            color: 'text.primary',
            fontSize: asCard ? '1.25rem' : '1.125rem',
            pb: asCard ? 2 : 0,
            borderBottom: asCard ? '2px solid' : 'none',
            borderColor: 'divider',
          }}
        >
          {title}
        </Typography>
      ) : null}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: '1fr',
            md: 'repeat(2, 1fr)',
          },
          gap: 3,
          mt: showTitle && asCard ? 2 : 0,
        }}
      >
        {fieldCells}
      </Box>
    </>
  )

  if (!asCard) {
    return <Box sx={{ mt: 0 }}>{content}</Box>
  }

  return (
    <Card
      sx={{
        borderRadius: 3,
        boxShadow: theme.palette.mode === 'dark'
          ? '0 4px 20px rgba(0, 0, 0, 0.3)'
          : '0 2px 12px rgba(0, 0, 0, 0.08)',
        border: '1px solid',
        borderColor: theme.palette.mode === 'dark'
          ? 'rgba(255, 255, 255, 0.12)'
          : 'rgba(0, 0, 0, 0.08)',
        overflow: 'hidden',
      }}
    >
      <CardContent sx={{ p: 4 }}>{content}</CardContent>
    </Card>
  )
}

export function getTemplateExtraFieldsBySection(fieldDefinitions) {
  const groups = {}
  ;(Array.isArray(fieldDefinitions) ? fieldDefinitions : [])
    .filter((field) => !field.is_fixed)
    .forEach((field) => {
      const sectionKey = field.section_key || 'others'
      if (!groups[sectionKey]) groups[sectionKey] = []
      groups[sectionKey].push(field)
    })
  Object.values(groups).forEach((fields) => {
    fields.sort((a, b) => Number(a.display_order || 0) - Number(b.display_order || 0))
  })
  return groups
}
