import React from 'react'
import FormControl from '@mui/material/FormControl'
import InputLabel from '@mui/material/InputLabel'
import UnitUserSearchAutocomplete from './UnitUserSearchAutocomplete'

function LabeledUnitUserSearchField({
  label,
  id,
  required = false,
  disabled = false,
  placeholder = '',
  helperText = '',
  ...autocompleteProps
}) {
  const fieldId =
    id ||
    `${String(label || 'user-search')
      .toLowerCase()
      .replace(/\s+/g, '-')}-field`

  return (
    <FormControl fullWidth required={required} disabled={disabled}>
      <InputLabel
        htmlFor={fieldId}
        shrink
        sx={{
          position: 'static',
          transform: 'none',
          mb: 0.75,
          fontSize: '0.875rem',
          fontWeight: 500,
          color: 'text.secondary',
          '&.Mui-focused': {
            color: 'text.secondary',
          },
        }}
      >
        {label}
      </InputLabel>
      <UnitUserSearchAutocomplete
        {...autocompleteProps}
        disabled={disabled}
        helperText={helperText}
        placeholder={placeholder || 'Search by name or email...'}
        textFieldProps={{ id: fieldId, ...(autocompleteProps.textFieldProps || {}) }}
      />
    </FormControl>
  )
}

export default LabeledUnitUserSearchField
