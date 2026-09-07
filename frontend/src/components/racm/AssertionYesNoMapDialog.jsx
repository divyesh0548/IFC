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

const YES_NO_OPTIONS = ['Yes', 'No']

function getFieldId(value, index) {
  const normalized = String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return `assertion-yes-no-map-${normalized || index}`
}

export default function AssertionYesNoMapDialog({
  open,
  distinctValues,
  selections,
  loading,
  onCancel,
  onSkip,
  onSelectionsChange,
  onConfirm,
}) {
  const values = Array.isArray(distinctValues) ? distinctValues : []

  const canSubmit = useMemo(
    () =>
      values.length > 0 &&
      values.every((value) => {
        const mapped = String(selections?.[value] || '').trim()
        return mapped === 'Yes' || mapped === 'No'
      }),
    [values, selections]
  )

  const handleConfirm = () => {
    if (!canSubmit) return
    onConfirm({ ...selections })
  }

  return (
    <Dialog open={open} onClose={loading ? undefined : onCancel} maxWidth="md" fullWidth>
      <DialogTitle>Map Assertion Symbols to Yes / No</DialogTitle>
      <DialogContent>
        <Alert severity="warning" sx={{ mt: 1.5, mb: 2 }}>
          Some assertion columns use special Excel symbols (often shown with the Webdings font as
          tick/cross marks). Those symbols are only visual — the real stored letters are usually
          values like O, P, or A.
          <Box component="span" sx={{ display: 'block', mt: 1, fontWeight: 700 }}>
            Before continuing, open the Excel file, check those assertion cells, and note the
            actual letter behind each symbol. Then map those letters to Yes or No below.
          </Box>
        </Alert>

        <Typography sx={{ color: 'text.secondary', mb: 2, lineHeight: 1.65 }}>
          Distinct values found in assertion columns are listed below. Map each one to Yes or No.
          If your file does not use symbol letters (values are already Yes/No or plain text), you
          can skip this step.
        </Typography>

        <Box sx={{ display: 'grid', gap: 2 }}>
          {values.map((value, index) => {
            const fieldId = getFieldId(value, index)
            return (
              <Box
                key={value}
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', md: 'minmax(220px, 0.8fr) minmax(220px, 1fr)' },
                  gap: 2,
                  alignItems: 'center',
                }}
              >
                <Box>
                  <Typography sx={{ fontSize: '0.8rem', fontWeight: 700, color: 'text.secondary', mb: 0.4 }}>
                    Excel letter / value
                  </Typography>
                  <Typography sx={{ fontWeight: 700, wordBreak: 'break-word' }}>{value}</Typography>
                </Box>

                <FormControl fullWidth size="small">
                  <InputLabel id={fieldId}>Map To</InputLabel>
                  <Select
                    labelId={fieldId}
                    value={selections?.[value] || ''}
                    label="Map To"
                    onChange={(event) =>
                      onSelectionsChange({
                        ...(selections || {}),
                        [value]: event.target.value,
                      })
                    }
                  >
                    {YES_NO_OPTIONS.map((option) => (
                      <MenuItem key={option} value={option}>
                        {option}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Box>
            )
          })}
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 3, gap: 1, flexWrap: 'wrap' }}>
        <Button onClick={onCancel} disabled={loading}>
          Cancel
        </Button>
        <Box sx={{ flex: 1 }} />
        <Button onClick={onSkip} disabled={loading} variant="outlined">
          Skip Symbol Mapping
        </Button>
        <Button variant="contained" onClick={handleConfirm} disabled={loading || !canSubmit}>
          Continue Import
        </Button>
      </DialogActions>
    </Dialog>
  )
}
