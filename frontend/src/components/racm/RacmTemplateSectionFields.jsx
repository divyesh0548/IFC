import React from 'react'
import { Box, Card, CardContent, TextField, Typography } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import EditNoteIcon from '@mui/icons-material/EditNote'
import CustomColumnDot from './CustomColumnDot'

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

function getFieldLabelSx(theme) {
  return {
    display: 'flex',
    alignItems: 'center',
    gap: 0.75,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    mb: 1.5,
    color: 'text.primary',
    fontSize: theme.typography.customSizes?.small || '0.75rem',
  }
}

const requestChangeTextFieldSx = {
  '& .MuiOutlinedInput-root': {
    backgroundColor: 'transparent',
  },
}

function IncludedForChangeBadge() {
  return (
    <Box
      sx={{
        mt: 1,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.75,
        px: 1,
        py: 0.5,
        borderRadius: 999,
        backgroundColor: 'warning.light',
        color: 'warning.contrastText',
      }}
    >
      <EditNoteIcon sx={{ fontSize: 16 }} />
      <Typography variant="caption" sx={{ color: 'inherit', fontWeight: 700 }}>
        Included for change
      </Typography>
    </Box>
  )
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
  showCustomColumnIndicator = false,
  requestChangeMode = false,
  isFieldChanged,
}) {
  const theme = useTheme()
  const fields = getSectionFields(fieldDefinitions, sectionKey)
  if (fields.length === 0) return null

  const fieldCells = fields.map((field) => {
    const value = values?.[field.field_key] ?? ''
    const isEmpty = value === null || value === undefined || String(value).trim() === ''

    if (isEditMode && onChange) {
      if (requestChangeMode) {
        const isChanged = typeof isFieldChanged === 'function' && isFieldChanged(field.field_key)

        return (
          <Box key={field.field_key} sx={getFieldCellSx(theme)}>
            <Typography variant="caption" component="dt" sx={getFieldLabelSx(theme)}>
              {showCustomColumnIndicator ? <CustomColumnDot size={7} /> : null}
              {field.label}
            </Typography>
            <TextField
              variant="outlined"
              value={value}
              onChange={(e) => onChange(field.field_key, e.target.value)}
              fullWidth
              multiline
              rows={4}
              placeholder={field.label}
              disabled={disabled}
              sx={requestChangeTextFieldSx}
            />
            {isChanged ? <IncludedForChangeBadge /> : null}
          </Box>
        )
      }

      return (
        <TextField
          key={field.field_key}
          name={field.field_key}
          label={
            showCustomColumnIndicator ? (
              <Box
                component="span"
                sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75 }}
              >
                <CustomColumnDot size={7} />
                {field.label}
              </Box>
            ) : (
              field.label
            )
          }
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
          sx={getFieldLabelSx(theme)}
        >
          {showCustomColumnIndicator ? <CustomColumnDot size={7} /> : null}
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
