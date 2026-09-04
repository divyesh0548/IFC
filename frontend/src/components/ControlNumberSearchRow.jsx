import React from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import FormControlLabel from '@mui/material/FormControlLabel'
import Switch from '@mui/material/Switch'
import TextField from '@mui/material/TextField'
import Tooltip from '@mui/material/Tooltip'
import SearchRoundedIcon from '@mui/icons-material/SearchRounded'
import {
  CONTROL_NUMBER_SEARCH_FIELD_SX,
} from '../uiConstants'

const WORD_WRAP_LABEL_SX = {
  mr: 0,
  flexShrink: 0,
  userSelect: 'none',
  '& .MuiFormControlLabel-label': {
    fontSize: '0.8125rem',
    color: 'text.secondary',
  },
}

/**
 * Control-number search + word-wrap on one row.
 * Enter and the search button both submit the form.
 */
export default function ControlNumberSearchRow({
  value,
  onChange,
  onSubmit,
  onClear,
  showClear = false,
  disabled = false,
  cellWordWrap,
  onCellWordWrapChange,
  wordWrapDisabled = false,
  fieldSx,
  sx,
  leadingContent = null,
}) {
  return (
    <Box
      component="form"
      onSubmit={onSubmit}
      sx={{
        display: 'flex',
        flexDirection: { xs: 'column', sm: 'row' },
        alignItems: { xs: 'stretch', sm: 'flex-end' },
        justifyContent: 'space-between',
        gap: { xs: 1.5, sm: 2 },
        flexWrap: 'wrap',
        ...sx,
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'flex-end',
          gap: 1,
          flex: '1 1 auto',
          minWidth: 0,
          width: { xs: '100%', sm: 'auto' },
        }}
      >
        <TextField
          label="Control Number"
          value={value}
          onChange={onChange}
          disabled={disabled}
          size="small"
          variant="standard"
          sx={{ ...CONTROL_NUMBER_SEARCH_FIELD_SX, ...fieldSx }}
        />
        <Tooltip title="Search">
          <span>
            <Button
              type="submit"
              variant="contained"
              color="primary"
              disabled={disabled}
              aria-label="Search control number"
              sx={{
                minWidth: 40,
                px: 1.25,
                py: 0.75,
                flexShrink: 0,
              }}
            >
              <SearchRoundedIcon fontSize="small" />
            </Button>
          </span>
        </Tooltip>
        {showClear ? (
          <Button
            type="button"
            variant="outlined"
            size="small"
            onClick={onClear}
            disabled={disabled}
            sx={{ textTransform: 'none', flexShrink: 0 }}
          >
            Clear
          </Button>
        ) : null}
      </Box>

      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: { xs: 'flex-start', sm: 'flex-end' },
          gap: 1.5,
          flexShrink: 0,
        }}
      >
        {leadingContent}
        <FormControlLabel
          control={
            <Switch
              checked={Boolean(cellWordWrap)}
              onChange={onCellWordWrapChange}
              size="small"
              color="primary"
              disabled={wordWrapDisabled || disabled}
            />
          }
          label="Word wrap"
          sx={WORD_WRAP_LABEL_SX}
        />
      </Box>
    </Box>
  )
}
