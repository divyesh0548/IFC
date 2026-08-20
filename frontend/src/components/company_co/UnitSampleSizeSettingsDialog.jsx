import React, { useCallback, useEffect, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material'
import SettingsRoundedIcon from '@mui/icons-material/SettingsRounded'
import { toast } from 'react-hot-toast'
import { apiUrl } from '../../config/api'
import { useSyncGlobalLoading } from '../../contexts/GlobalLoadingContext'

function serializeSampleSizeSettings(rows) {
  return JSON.stringify(
    rows
      .map((row) => ({
        frequency_key: row.frequency_key,
        effective_sample_size: Number.parseInt(String(row.effective_sample_size ?? '').trim(), 10),
      }))
      .sort((a, b) => a.frequency_key.localeCompare(b.frequency_key))
  )
}

function UnitSampleSizeSettingsDialog({ open, onClose, unitOptions = [], initialUnitId = '' }) {
  const [unitId, setUnitId] = useState(initialUnitId || '')
  const [settings, setSettings] = useState([])
  const [savedSettingsSnapshot, setSavedSettingsSnapshot] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  useSyncGlobalLoading(loading || saving)

  const fetchSettings = useCallback(async (selectedUnitId) => {
    const normalizedUnitId = String(selectedUnitId || '').trim()
    if (!normalizedUnitId) {
      setSettings([])
      setSavedSettingsSnapshot('')
      return
    }

    setLoading(true)
    try {
      const response = await fetch(
        apiUrl(`/api/company-co/unit-sample-size-config?unit_id=${encodeURIComponent(normalizedUnitId)}`),
        { credentials: 'include' }
      )
      const data = await response.json()
      if (!response.ok || !data.success) {
        toast.error(data.message || 'Failed to load sample size settings')
        setSettings([])
        setSavedSettingsSnapshot('')
        return
      }
      const nextSettings = Array.isArray(data.data?.settings) ? data.data.settings : []
      setSettings(nextSettings)
      setSavedSettingsSnapshot(serializeSampleSizeSettings(nextSettings))
    } catch (error) {
      console.error('Error loading sample size settings:', error)
      toast.error('Failed to load sample size settings')
      setSettings([])
      setSavedSettingsSnapshot('')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!open) return
    const nextUnitId = String(initialUnitId || unitOptions[0]?.unit_id || '').trim()
    setUnitId(nextUnitId)
  }, [open, initialUnitId, unitOptions])

  useEffect(() => {
    if (!open || !unitId) return
    fetchSettings(unitId)
  }, [open, unitId, fetchSettings])

  const handleSettingChange = (frequencyKey, value) => {
    setSettings((current) =>
      current.map((row) =>
        row.frequency_key === frequencyKey
          ? { ...row, effective_sample_size: value }
          : row
      )
    )
  }

  const handleSave = async () => {
    if (!unitId) {
      toast.error('Please select a unit')
      return
    }

    for (const row of settings) {
      const minimum = Number(row.minimum_sample_size)
      const maximum = row.maximum_sample_size != null ? Number(row.maximum_sample_size) : null
      const nextValue = Number.parseInt(String(row.effective_sample_size ?? '').trim(), 10)
      if (!Number.isFinite(nextValue) || nextValue < minimum) {
        toast.error(`${row.frequency_label}: sample size must be at least ${minimum}`)
        return
      }
      if (maximum != null && nextValue > maximum) {
        toast.error(`${row.frequency_label}: sample size cannot exceed ${maximum}`)
        return
      }
    }

    setSaving(true)
    try {
      const response = await fetch(apiUrl('/api/company-co/unit-sample-size-config'), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          unit_id: unitId,
          settings: settings.map((row) => ({
            frequency_key: row.frequency_key,
            sample_size: Number.parseInt(String(row.effective_sample_size).trim(), 10),
          })),
        }),
      })
      const data = await response.json()
      if (!response.ok || !data.success) {
        toast.error(data.message || 'Failed to save sample size settings')
        return
      }
      toast.success(data.message || 'Sample size settings saved')
      const nextSettings = Array.isArray(data.data?.settings) ? data.data.settings : settings
      setSettings(nextSettings)
      setSavedSettingsSnapshot(serializeSampleSizeSettings(nextSettings))
      onClose?.()
    } catch (error) {
      console.error('Error saving sample size settings:', error)
      toast.error('Failed to save sample size settings')
    } finally {
      setSaving(false)
    }
  }

  const hasSampleSizeChanges =
    settings.length > 0 &&
    serializeSampleSizeSettings(settings) !== savedSettingsSnapshot

  return (
    <Dialog open={open} onClose={saving ? undefined : onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>Sample Size Settings</DialogTitle>
      <DialogContent dividers>
        <Alert severity="info" sx={{ mb: 2.5 }}>
          Review the sample size for each control frequency before creating RACMs. Minimum and maximum values are fixed by the program; you can only adjust within that range per unit.
        </Alert>

        <FormControl fullWidth sx={{ mb: 2.5 }}>
          <InputLabel id="sample-size-unit-label">Unit</InputLabel>
          <Select
            labelId="sample-size-unit-label"
            label="Unit"
            value={unitId}
            onChange={(event) => setUnitId(event.target.value)}
            disabled={saving || loading}
          >
            {unitOptions.map((unit) => (
              <MenuItem key={unit.unit_id} value={unit.unit_id}>
                {unit.unit_name ? `${unit.unit_name} (${unit.unit_id})` : unit.unit_id}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress size={28} />
          </Box>
        ) : (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 700 }}>Control Frequency</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Minimum</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Maximum</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Unit Sample Size</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {settings.map((row) => (
                <TableRow key={row.frequency_key}>
                  <TableCell>{row.frequency_label}</TableCell>
                  <TableCell>{row.minimum_sample_size}</TableCell>
                  <TableCell>{row.maximum_sample_size ?? '—'}</TableCell>
                  <TableCell>
                    <TextField
                      type="number"
                      size="small"
                      value={row.effective_sample_size ?? ''}
                      onChange={(event) => handleSettingChange(row.frequency_key, event.target.value)}
                      inputProps={{
                        min: row.minimum_sample_size,
                        max: row.maximum_sample_size ?? undefined,
                        step: 1,
                      }}
                      disabled={saving}
                      sx={{ maxWidth: 140 }}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {!loading && settings.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
            Select a unit to configure sample sizes.
          </Typography>
        ) : null}
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={saving || loading || !unitId || !hasSampleSizeChanges}
        >
          {saving ? 'Saving...' : 'Save Changes'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export function SampleSizeSettingsButton({ unitOptions, selectedUnitId, disabled = false, sx }) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button
        type="button"
        variant="outlined"
        startIcon={<SettingsRoundedIcon />}
        onClick={() => setOpen(true)}
        disabled={disabled}
        sx={{ textTransform: 'none', fontWeight: 700, ...sx }}
      >
        Sample Size Settings
      </Button>
      <UnitSampleSizeSettingsDialog
        open={open}
        onClose={() => setOpen(false)}
        unitOptions={unitOptions}
        initialUnitId={selectedUnitId}
      />
    </>
  )
}

export default UnitSampleSizeSettingsDialog
