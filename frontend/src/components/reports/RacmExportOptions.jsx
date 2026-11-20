import React, { useEffect, useState } from 'react'
import * as XLSX from 'xlsx'
import {
  Alert,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Select,
  Switch,
  Typography,
} from '@mui/material'
import FileDownloadRoundedIcon from '@mui/icons-material/FileDownloadRounded'
import { toast } from 'react-hot-toast'
import { apiUrl } from '../../config/api'

function formatColumnLabel(value) {
  const words = String(value || '')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .trim()
    .split(/\s+/)
  return words.map((word) => {
    const upper = word.toUpperCase()
    if (['ID', 'IPE', 'RACM', 'UTC', 'FY'].includes(upper)) return upper
    return word.charAt(0).toUpperCase() + word.slice(1)
  }).join(' ')
}

function reserveHeader(label, usedHeaders, context = '') {
  const base = String(label || '').trim() || 'Custom Field'
  let candidate = base
  if (usedHeaders.has(candidate.toLowerCase()) && context) {
    candidate = `${base} (${context})`
  }
  let suffix = 2
  while (usedHeaders.has(candidate.toLowerCase())) {
    candidate = `${base} (${context || 'Custom Field'} ${suffix})`
    suffix += 1
  }
  usedHeaders.add(candidate.toLowerCase())
  return candidate
}

function buildExportRows(records, columns, customFields) {
  const usedHeaders = new Set()
  const fixedColumns = columns.map((column) => ({
    key: column.key,
    header: reserveHeader(column.label || formatColumnLabel(column.key), usedHeaders),
  }))
  const dynamicColumns = customFields.map((field) => {
    const context = [field.unit_name, field.template_name].filter(Boolean).join(' - ')
    return {
      fieldId: String(field.field_id),
      header: reserveHeader(field.label || field.field_key, usedHeaders, context),
    }
  })

  return {
    headers: [...fixedColumns, ...dynamicColumns].map((column) => column.header),
    rows: records.map((record) => {
      const row = {}
      for (const column of fixedColumns) {
        row[column.header] = record[column.key] ?? ''
      }
      for (const column of dynamicColumns) {
        row[column.header] = record.custom_values?.[column.fieldId] ?? ''
      }
      return row
    }),
  }
}

function getUnitKey(unit) {
  return JSON.stringify([unit.company_identifier || '', unit.unit_id || ''])
}

export default function RacmExportOptions({ endpoint, unitsEndpoint = `${endpoint}-units` }) {
  const [includeAll, setIncludeAll] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [units, setUnits] = useState([])
  const [unitsLoading, setUnitsLoading] = useState(false)
  const [unitsError, setUnitsError] = useState('')
  const [selectedUnitKey, setSelectedUnitKey] = useState('')

  useEffect(() => {
    if (!dialogOpen) return undefined

    let active = true
    setUnitsLoading(true)
    setUnitsError('')
    fetch(apiUrl(unitsEndpoint), {
      method: 'GET',
      credentials: 'include',
    })
      .then(async (response) => {
        const result = await response.json()
        if (!response.ok || !result?.success) {
          throw new Error(result?.message || 'Failed to load units')
        }
        return Array.isArray(result.data?.units) ? result.data.units : []
      })
      .then((availableUnits) => {
        if (!active) return
        setUnits(availableUnits)
        setSelectedUnitKey(availableUnits[0] ? getUnitKey(availableUnits[0]) : '')
      })
      .catch((error) => {
        if (!active) return
        console.error('RACM export units error:', error)
        setUnits([])
        setSelectedUnitKey('')
        setUnitsError(error.message || 'Failed to load units')
      })
      .finally(() => {
        if (active) setUnitsLoading(false)
      })

    return () => {
      active = false
    }
  }, [dialogOpen, unitsEndpoint])

  const handleExport = async () => {
    const selectedUnit = units.find((unit) => getUnitKey(unit) === selectedUnitKey)
    if (!selectedUnit) return

    setExporting(true)
    try {
      const params = new URLSearchParams({
        unit_id: selectedUnit.unit_id,
      })
      if (selectedUnit.company_identifier) {
        params.set('company_identifier', selectedUnit.company_identifier)
      }
      if (includeAll) params.set('include_all', 'true')
      const query = `?${params.toString()}`
      const response = await fetch(apiUrl(`${endpoint}${query}`), {
        method: 'GET',
        credentials: 'include',
      })
      const result = await response.json()
      if (!response.ok || !result?.success) {
        throw new Error(result?.message || 'Failed to export RACMs')
      }

      const records = Array.isArray(result.data?.records) ? result.data.records : []
      const columns = Array.isArray(result.data?.columns) ? result.data.columns : []
      const customFields = Array.isArray(result.data?.customFields) ? result.data.customFields : []
      if (records.length === 0) {
        toast.error(includeAll
          ? 'No RACMs are available for this unit.'
          : 'No closed RACMs are available for this unit.')
        return
      }

      const { headers, rows } = buildExportRows(records, columns, customFields)
      const worksheet = XLSX.utils.json_to_sheet(rows, { header: headers })
      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, worksheet, 'RACMs')
      const date = new Date().toISOString().slice(0, 10)
      XLSX.writeFile(
        workbook,
        `racms_${includeAll ? 'all' : 'closed'}_${date}.xlsx`
      )
      setDialogOpen(false)
      toast.success(`Exported ${records.length} RACM(s).`)
    } catch (error) {
      console.error('RACM Excel export error:', error)
      toast.error(error.message || 'Failed to export RACMs')
    } finally {
      setExporting(false)
    }
  }

  return (
    <>
      <Button
        variant="outlined"
        startIcon={<FileDownloadRoundedIcon />}
        onClick={() => setDialogOpen(true)}
      >
        Export
      </Button>
      <Dialog
        open={dialogOpen}
        onClose={() => {
          if (!exporting) setDialogOpen(false)
        }}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>Export RACMs</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
            By default, the Excel file contains approved RACMs (closed cycles), including custom template columns.
          </Typography>
          {unitsError ? (
            <Alert severity="error" sx={{ mb: 1.5 }}>
              {unitsError}
            </Alert>
          ) : null}
          <FormControl fullWidth size="small" sx={{ mb: 1.5 }}>
            <InputLabel id="racm-export-unit-label">Unit</InputLabel>
            <Select
              labelId="racm-export-unit-label"
              value={selectedUnitKey}
              label="Unit"
              onChange={(event) => setSelectedUnitKey(event.target.value)}
              disabled={unitsLoading || exporting || units.length === 0}
            >
              {units.map((unit) => (
                <MenuItem key={getUnitKey(unit)} value={getUnitKey(unit)}>
                  {[
                    unit.company_name,
                    unit.unit_name || unit.unit_id,
                  ].filter(Boolean).join(' — ')}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          {unitsLoading ? (
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
              Loading available units...
            </Typography>
          ) : null}
          {!unitsLoading && !unitsError && units.length === 0 ? (
            <Alert severity="info" sx={{ mb: 1.5 }}>
              No assigned units are available to export.
            </Alert>
          ) : null}
          <FormControlLabel
            control={(
              <Switch
                checked={includeAll}
                onChange={(event) => setIncludeAll(event.target.checked)}
                disabled={exporting}
              />
            )}
            label="Export all RACMs"
          />
          {includeAll ? (
            <Alert severity="info" sx={{ mt: 1 }}>
              Includes RACMs in every approval status, including pending and rejected.
            </Alert>
          ) : null}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button
            onClick={() => setDialogOpen(false)}
            disabled={exporting}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            startIcon={exporting ? <CircularProgress size={18} color="inherit" /> : null}
            onClick={handleExport}
            disabled={exporting || unitsLoading || units.length === 0 || !selectedUnitKey}
          >
            Export
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}
