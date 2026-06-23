import React, { useMemo } from 'react'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import Box from '@mui/material/Box'
import FormControl from '@mui/material/FormControl'
import InputLabel from '@mui/material/InputLabel'
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import Alert from '@mui/material/Alert'

function getOptionLabel(option) {
  const sampleSize = option?.sampleSize
  return sampleSize == null ? option.value : `${option.value} (sample size ${sampleSize})`
}

function getFieldId(value, index) {
  const normalized = String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return `frequency-map-${normalized || index}`
}

export default function ControlFrequencyValueMapDialog({
  open,
  invalidValues,
  options,
  selections,
  loading,
  onCancel,
  onSelectionsChange,
  onConfirm,
}) {
  const canSubmit = useMemo(
    () =>
      Array.isArray(invalidValues) &&
      invalidValues.length > 0 &&
      invalidValues.every((value) => String(selections?.[value] || '').trim() !== ''),
    [invalidValues, selections]
  )

  const handleConfirm = () => {
    if (!canSubmit) return
    onConfirm({ ...selections })
  }

  return (
    <Dialog open={open} onClose={loading ? undefined : onCancel} maxWidth="md" fullWidth>
      <DialogTitle>Map Unsupported Control Frequency Values</DialogTitle>
      <DialogContent>
        <Typography sx={{ color: 'text.secondary', mt: 1.5,mb:1.5 }}>
          Some Control Frequency values do not match the supported sampling categories. Map each
          distinct Excel value to one of the allowed categories before import starts.
        </Typography>

        <Alert severity="warning" sx={{ mb: 2 }}>
          These mappings will be used to derive sample required and sample size during RACM creation.
        </Alert>

        <Box sx={{ display: 'grid', gap: 2 }}>
          {(invalidValues || []).map((value, index) => {
            const fieldId = getFieldId(value, index)
            return (
            <Box
              key={value}
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', md: 'minmax(220px, 0.8fr) minmax(260px, 1fr)' },
                gap: 2,
                alignItems: 'center',
              }}
            >
              <Box>
                <Typography sx={{ fontSize: '0.8rem', fontWeight: 700, color: 'text.secondary', mb: 0.4 }}>
                  Excel value
                </Typography>
                <Typography sx={{ fontWeight: 700, wordBreak: 'break-word' }}>{value}</Typography>
              </Box>

              <FormControl fullWidth size="small">
                <InputLabel id={fieldId}>Map To Category</InputLabel>
                <Select
                  labelId={fieldId}
                  value={selections[value] || ''}
                  label="Map To Category"
                  onChange={(event) =>
                    onSelectionsChange({
                      ...(selections || {}),
                      [value]: event.target.value,
                    })
                  }
                >
                  {options.map((option) => (
                    <MenuItem key={option.value} value={option.value}>
                      {getOptionLabel(option)}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>
            )
          })}
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 3 }}>
        <Button onClick={onCancel} disabled={loading}>
          Cancel
        </Button>
        <Button variant="contained" onClick={handleConfirm} disabled={loading || !canSubmit}>
          Continue Import
        </Button>
      </DialogActions>
    </Dialog>
  )
}
