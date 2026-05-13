import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Alert from '@mui/material/Alert'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import FormControl from '@mui/material/FormControl'
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import { toast } from 'react-hot-toast'
import {
  RACM_BULK_IMPORT_MAPPABLE_FIELDS,
  RACM_FIELD_LABELS,
  RACM_BULK_IMPORT_SESSION_KEY,
} from '../../racmFormDetailFields'
import { useSyncGlobalLoading } from '../../contexts/GlobalLoadingContext'
import { PAGE_SUBHEADER_TEXT_SX } from '../../uiConstants'
import { useUnsavedChangesWarning } from '../../utils/useUnsavedChangesWarning'
import { apiUrl } from '../../config/api'
import { validateControlFrequencyColumnValues } from '../../utils/controlFrequencyValidation'

const AUTO = '__auto__'
const SKIP = '__skip__'
const MAPPABLE_SET = new Set(RACM_BULK_IMPORT_MAPPABLE_FIELDS)
const DUPLICATE_CONTROL_NUMBER_MESSAGE = 'Duplicate Control Number already exists for this company'
const DUPLICATE_CONTROL_NUMBER_NOTICE =
  'Change the control number and re-upload the excel or do not import control number'

function normalizeHeader(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function hasKeywordMatch(normalizedHeader, keyword) {
  const tokens = normalizedHeader.split(' ').filter(Boolean)
  const k = keyword.toLowerCase()
  if (k.length <= 2) return tokens.some((t) => t === k)
  return tokens.some((t) => t === k || t.startsWith(k))
}

function getHeaderWords(normalizedHeader) {
  return new Set(
    String(normalizedHeader || '')
      .split(' ')
      .map((word) => word.trim().toLowerCase())
      .filter(Boolean)
  )
}

function detectDbColumnFromHeader(excelHeader, mappingConfig) {
  if (!excelHeader) return null
  if (!mappingConfig?.simpleColumnMapping || !Array.isArray(mappingConfig?.columnPatterns)) return null
  const simpleColumnMapping = mappingConfig.simpleColumnMapping
  const columnPatterns = mappingConfig.columnPatterns
  const normalized = String(excelHeader)
    .trim()
    .toLowerCase()
    .replace(/[\/()&-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  const requiredFrequencyWords = ['frequency', 'control', 'of']
  if (requiredFrequencyWords.every((word) => hasKeywordMatch(normalized, word))) {
    return 'control_frequency'
  }

  if (simpleColumnMapping[normalized]) return simpleColumnMapping[normalized]

  const withUnderscores = normalized.replace(/\s+/g, '_')
  if (simpleColumnMapping[withUnderscores]) return simpleColumnMapping[withUnderscores]

  let bestMatch = null
  let bestScore = 0
  const headerWords = getHeaderWords(normalized)
  for (const pattern of columnPatterns) {
    const keywordSets = Array.isArray(pattern.keywordGroups) && pattern.keywordGroups.length > 0
      ? pattern.keywordGroups
      : [pattern.keywords || []]

    let patternBestScore = 0
    for (const keywords of keywordSets) {
      if (!Array.isArray(keywords) || keywords.length === 0) continue

      if (Array.isArray(pattern.keywordGroups) && pattern.keywordGroups.length > 0) {
        const hasAllGroupWords = keywords.every((keyword) => headerWords.has(String(keyword).toLowerCase()))
        if (!hasAllGroupWords) continue
        patternBestScore = Math.max(patternBestScore, pattern.priority || 1)
        continue
      }

      let matchCount = 0
      for (const keyword of keywords) {
        if (hasKeywordMatch(normalized, keyword)) matchCount++
      }
      if (matchCount > 0) {
        if (pattern.requireAllKeywords && matchCount !== keywords.length) continue
        const score = (matchCount / keywords.length) * pattern.priority
        if (score > patternBestScore) {
          patternBestScore = score
        }
      }
    }
    if (patternBestScore > bestScore) {
      bestScore = patternBestScore
      bestMatch = pattern.dbColumn
    }
  }
  if (bestMatch && bestScore >= 0.5) return bestMatch

  if (hasKeywordMatch(normalized, 'risk') && !hasKeywordMatch(normalized, 'heat')) {
    return 'risk_description'
  }

  return normalized.replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '') || null
}

function collectHeaders(rows) {
  const set = new Set()
    ; (rows || []).forEach((row) => {
      Object.keys(row || {}).forEach((k) => set.add(k))
    })
  return [...set]
}

function buildUniqueAutoDetectedByHeader(headers, mappingConfig) {
  const usedFields = new Set()
  const out = {}
  headers.forEach((header) => {
    const detected = detectDbColumnFromHeader(header, mappingConfig)
    const resolved = detected && MAPPABLE_SET.has(detected) ? detected : null
    if (resolved && !usedFields.has(resolved)) {
      out[header] = resolved
      usedFields.add(resolved)
    } else {
      out[header] = null
    }
  })
  return out
}

/**
 * Effective RACM DB field for an Excel header after submit (skip / explicit / auto-detect).
 * Aligns with how bulk-import applies column_mapping + auto rules.
 */
function getEffectiveMappedField(excelHeader, selections, autoDetectedByHeader, mappingConfig) {
  const v = selections[excelHeader]
  if (v === SKIP) return null
  if (v && v !== AUTO) {
    return MAPPABLE_SET.has(v) ? v : null
  }
  const detected = autoDetectedByHeader[excelHeader]
  if (detected && MAPPABLE_SET.has(detected)) return detected
  const fallback = detectDbColumnFromHeader(excelHeader, mappingConfig)
  return fallback && MAPPABLE_SET.has(fallback) ? fallback : null
}

/**
 * @returns {{ ok: true } | { ok: false, fieldLabel: string, excelHeaders: string[] }}
 */
function findDuplicateFieldMappings(headers, selections, autoDetectedByHeader, mappingConfig) {
  const byField = new Map()
  for (const h of headers) {
    const field = getEffectiveMappedField(h, selections, autoDetectedByHeader, mappingConfig)
    if (!field) continue
    if (!byField.has(field)) byField.set(field, [])
    byField.get(field).push(h)
  }
  for (const [fieldKey, excelHeaders] of byField) {
    if (excelHeaders.length > 1) {
      const fieldLabel = RACM_FIELD_LABELS[fieldKey] || fieldKey.replace(/_/g, ' ')
      return { ok: false, fieldLabel, excelHeaders }
    }
  }
  return { ok: true }
}

/** Excel column that supplies process owner emails after mapping. */
function resolveProcessOwnerHeader(headers, selections) {
  for (const h of headers) {
    if (selections[h] === 'control_owner') return h
  }
  for (const h of headers) {
    const sel = selections[h]
    if (sel === SKIP) continue
    if (sel !== AUTO && sel && sel !== 'control_owner') continue
    if (normalizeHeader(h) === 'process owner') return h
  }
  return null
}

function validateProcessOwnerEmails(rows, processOwnerHeader) {
  if (!processOwnerHeader) return { ok: true }
  const nonEmpty = [
    ...new Set(
      rows
        .map((r) => String(r[processOwnerHeader] ?? '').trim())
        .filter((v) => v !== '')
    ),
  ]
  if (nonEmpty.length === 0) {
    return { ok: true, warnEmpty: true }
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  const invalid = nonEmpty.filter((v) => !emailRegex.test(v))
  if (invalid.length > 0) {
    return { ok: false, error: 'Process Owner / mapped owner column must contain valid email addresses.' }
  }
  return { ok: true }
}

function buildColumnMapping(headers, selections) {
  const out = {}
  for (const h of headers) {
    const v = selections[h]
    if (v === SKIP) {
      out[h] = null
    } else if (v && v !== AUTO) {
      out[h] = v
    }
  }
  return out
}

function ExcelColumnMap() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [initializing, setInitializing] = useState(true)
  const [payload, setPayload] = useState(null)
  const [selections, setSelections] = useState(null)
  const [mappingConfig, setMappingConfig] = useState(null)
  const [duplicateControlNumberNotice, setDuplicateControlNumberNotice] = useState('')
  const initialSelectionsRef = useRef(null)
  useSyncGlobalLoading(initializing || loading)
  const headers = useMemo(() => (payload ? collectHeaders(payload.rows) : []), [payload])

  const hasAnyProgress = useMemo(() => {
    if (!selections) return false
    const initial = initialSelectionsRef.current
    if (!initial) return false
    return headers.some((h) => selections[h] !== initial[h])
  }, [selections, headers])

  useUnsavedChangesWarning(
    hasAnyProgress,
    'Your progress will be lost on this column mapping page. Do you want to continue?'
  )

  useEffect(() => {
    const loadMappingConfig = async () => {
      try {
        const response = await fetch(apiUrl('/api/control-forms/column-mapping-config'), {
          credentials: 'include',
        })
        const data = await response.json()
        if (!response.ok || !data?.success || !data?.data) {
          throw new Error('Failed to load mapping config')
        }
        if (!data.data.simpleColumnMapping || !Array.isArray(data.data.columnPatterns)) {
          throw new Error('Invalid mapping config response')
        }
        setMappingConfig({
          simpleColumnMapping: data.data.simpleColumnMapping,
          columnPatterns: data.data.columnPatterns,
        })
      } catch (error) {
        console.error(error)
        toast.error('Could not load column mapping config. Please try again.')
        navigate('/company_co/upload-excel', { replace: true })
        setInitializing(false)
      }
    }
    loadMappingConfig()
  }, [navigate])

  useEffect(() => {
    try {
      if (selections) return
      if (!mappingConfig) return
      const raw = sessionStorage.getItem(RACM_BULK_IMPORT_SESSION_KEY)
      if (!raw) {
        toast.error('No import data found. Start again from the upload page.')
        navigate('/company_co/upload-excel', { replace: true })
        return
      }
      const data = JSON.parse(raw)
      if (!data?.rows?.length || !data.businessProcess || !data.financialYear || !data.unitId) {
        toast.error('Invalid import session.')
        sessionStorage.removeItem(RACM_BULK_IMPORT_SESSION_KEY)
        navigate('/company_co/upload-excel', { replace: true })
        return
      }
      setPayload(data)
      const hdrs = collectHeaders(data.rows)
      const uniqueAutoDetected = buildUniqueAutoDetectedByHeader(hdrs, mappingConfig)
      const init = {}
      hdrs.forEach((h) => {
        init[h] = uniqueAutoDetected[h] ? AUTO : SKIP
      })
      initialSelectionsRef.current = init
      setSelections(init)
    } catch (e) {
      console.error(e)
      toast.error('Could not load import session.')
      navigate('/company_co/upload-excel', { replace: true })
    } finally {
      setInitializing(false)
    }
  }, [navigate, mappingConfig, selections])

  const rowCountLabel = useMemo(
    () => (payload?.rows?.length ? payload.rows.length.toLocaleString() : '0'),
    [payload]
  )

  const fieldOptions = useMemo(
    () =>
      RACM_BULK_IMPORT_MAPPABLE_FIELDS.map((key) => ({
        value: key,
        label: RACM_FIELD_LABELS[key] || key.replace(/_/g, ' '),
      })),
    []
  )
  const fieldOptionMap = useMemo(
    () => new Map(fieldOptions.map((opt) => [opt.value, opt.label])),
    [fieldOptions]
  )
  const autoDetectedByHeader = useMemo(() => {
    return buildUniqueAutoDetectedByHeader(headers, mappingConfig)
  }, [headers, mappingConfig])
  const mappedFieldByHeader = useMemo(() => {
    if (!selections) return {}
    const out = {}
    headers.forEach((header) => {
      out[header] = getEffectiveMappedField(header, selections, autoDetectedByHeader, mappingConfig)
    })
    return out
  }, [headers, selections, autoDetectedByHeader, mappingConfig])
  const isFieldUsedByAnotherHeader = (field, currentHeader) =>
    headers.some((header) => header !== currentHeader && mappedFieldByHeader[header] === field)

  const handleBack = () => {
    sessionStorage.removeItem(RACM_BULK_IMPORT_SESSION_KEY)
    navigate('/company_co/upload-excel')
  }

  const handleSubmit = async () => {
    if (!payload || !selections) return

    const dup = findDuplicateFieldMappings(headers, selections, autoDetectedByHeader, mappingConfig)
    if (!dup.ok) {
      const cols = dup.excelHeaders.map((c) => `"${c}"`).join(', ')
      toast.error(`${dup.fieldLabel} cannot map to more than one Excel column (${cols}).`)
      return
    }

    const poHeader = resolveProcessOwnerHeader(headers, selections)
    const poCheck = validateProcessOwnerEmails(payload.rows, poHeader)
    if (!poCheck.ok) {
      toast.error(poCheck.error || 'Invalid Process Owner data.')
      return
    }
    if (poCheck.warnEmpty) {
      toast('Process Owner column is empty.', { icon: '⚠️' })
    }

    const controlFrequencyHeader = headers.find(
      (header) => mappedFieldByHeader[header] === 'control_frequency'
    )
    if (!controlFrequencyHeader) {
      toast.error('Map one Excel column to Control Frequency before importing.')
      return
    }

    const controlFrequencyValidation = validateControlFrequencyColumnValues(
      payload.rows,
      controlFrequencyHeader
    )
    if (!controlFrequencyValidation.ok) {
      toast.error(controlFrequencyValidation.message)
      return
    }

    const column_mapping = buildColumnMapping(headers, selections)
    const body = {
      businessProcess: payload.businessProcess,
      financialYear: payload.financialYear,
      unit_id: payload.unitId,
      rows: payload.rows,
      column_mapping,
    }
    if (payload.due_date && payload.reminder_frequency) {
      body.due_date = payload.due_date
      body.reminder_frequency = payload.reminder_frequency
    }

    setLoading(true)
    setDuplicateControlNumberNotice('')
    try {
      const response = await fetch(apiUrl('/api/control-forms/bulk-import-rows'), {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await response.json()

      if (response.ok && data.success) {
        const inserted = data.data?.insertedCount ?? 0
        const skipped = data.data?.skippedCount ?? 0
        const dups = data.data?.duplicateCount ?? 0
        const errs = data.data?.errorCount ?? 0
        const extra =
          skipped + dups + errs > 0
            ? ` (${skipped} skipped, ${dups} duplicates, ${errs} errors)`
            : ''
        toast.success(
          typeof data.message === 'string' && data.message.trim() !== ''
            ? data.message
            : `Created ${inserted} RACM(s)${extra}.`
        )
        sessionStorage.removeItem(RACM_BULK_IMPORT_SESSION_KEY)
        navigate('/company_co/upload-excel', { replace: true })
      } else {
        if (String(data?.message || '').includes(DUPLICATE_CONTROL_NUMBER_MESSAGE)) {
          setDuplicateControlNumberNotice(DUPLICATE_CONTROL_NUMBER_NOTICE)
        }
        toast.error(data.message || 'Failed to import RACMs')
      }
    } catch (err) {
      console.error(err)
      toast.error('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (!payload) {
    return (
      <Box sx={{ py: 4 }}>
        <Typography color="text.secondary">Loading…</Typography>
      </Box>
    )
  }

  if (!selections) {
    return (
      <Box sx={{ py: 4 }}>
        <Typography color="text.secondary">Loading…</Typography>
      </Box>
    )
  }

  return (
    <Box sx={{ width: '100%', px: 0, py: 2 }}>
      <Paper
        elevation={0}
        sx={{
          p: { xs: 2, sm: 3 },
          mb: 2,
          borderRadius: 2,
          border: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Typography variant="h5" sx={{ fontWeight: 800 }}>
          Map Excel columns
        </Typography>
        <Typography sx={{ ...PAGE_SUBHEADER_TEXT_SX, mt: 1 }}>
          Match each column from <strong>{payload.fileName || 'your file'}</strong> to a RACM field, or
          choose Auto-detect when a field is suggested. Columns with no match default to{' '}
          <strong>Skip — do not import</strong>. Financial year is taken from the upload step, not from the
          sheet.
        </Typography>

        {duplicateControlNumberNotice ? (
          <Alert severity="warning" sx={{ mt: 2 }}>
            {duplicateControlNumberNotice}
          </Alert>
        ) : null}

        <Box
          sx={{
            mt: 2,
            display: 'flex',
            flexDirection: 'column',
            gap: 1,
          }}
        >
          {[
            'Review the detected Excel columns on the left.',
            'Choose the correct RACM field for each column.',
            'Skip header mapping for the column that should not be imported.',
          ].map((item, index) => (
            <Box
              key={item}
              sx={{
                p: 1.25,
                borderRadius: 2,
                bgcolor: 'action.hover',
                display: 'flex',
                alignItems: 'center',
                gap: 1,
              }}
            >
              <Typography
                sx={{
                  minWidth: 24,
                  height: 24,
                  borderRadius: '50%',
                  bgcolor: 'primary.main',
                  color: 'primary.contrastText',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  display: 'grid',
                  placeItems: 'center',
                }}
              >
                {index + 1}
              </Typography>
              <Typography
                sx={{
                  color: 'text.secondary',
                  fontSize: '0.92rem',
                  fontWeight: 600,
                }}
              >
                {item}
              </Typography>
            </Box>
          ))}
        </Box>
      </Paper>

      <Box
        sx={{
          mb: 2,
          display: 'grid',
          columnGap: 1.5,
          rowGap: 1.5,
          gridTemplateColumns: { xs: '1fr', md: 'repeat(3, minmax(0, 1fr))' },
        }}
      >
        <Box
          sx={{
            px: 1.5,
            py: 1.25,
            borderRadius: 2,
            bgcolor: (theme) =>
              theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.04)' : 'grey.50',
            border: '1px solid',
            borderColor: (theme) =>
              theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.08)' : 'divider',
            minHeight: { md: 84 },
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
          }}
        >
          <Typography
            sx={{
              color: 'text.secondary',
              fontSize: '0.74rem',
              fontWeight: 700,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              mb: 0.4,
            }}
          >
            Business process
          </Typography>
          <Typography
            sx={{
              color: 'text.primary',
              fontWeight: 700,
              lineHeight: 1.3,
              wordBreak: 'break-word',
              fontSize: { xs: '1.05rem', sm: '1.15rem' },
            }}
          >
            {payload.businessProcess}
          </Typography>
        </Box>

        <Box
          sx={{
            px: 1.5,
            py: 1.25,
            borderRadius: 2,
            bgcolor: (theme) =>
              theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.04)' : 'grey.50',
            border: '1px solid',
            borderColor: (theme) =>
              theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.08)' : 'divider',
            minHeight: { md: 84 },
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
          }}
        >
          <Typography
            sx={{
              color: 'text.secondary',
              fontSize: '0.74rem',
              fontWeight: 700,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              mb: 0.4,
            }}
          >
            Financial year
          </Typography>
          <Typography
            sx={{
              color: 'text.primary',
              fontWeight: 700,
              lineHeight: 1.2,
              fontSize: { xs: '1.2rem', sm: '1.3rem' },
            }}
          >
            {payload.financialYear}
          </Typography>
        </Box>

        <Box
          sx={{
            px: 1.5,
            py: 1.25,
            borderRadius: 2,
            bgcolor: (theme) =>
              theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.04)' : 'grey.50',
            border: '1px solid',
            borderColor: (theme) =>
              theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.08)' : 'divider',
            minHeight: { md: 84 },
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
          }}
        >
          <Typography
            sx={{
              color: 'text.secondary',
              fontSize: '0.74rem',
              fontWeight: 700,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              mb: 0.4,
            }}
          >
            Rows detected
          </Typography>
          <Typography
            sx={{
              color: 'text.primary',
              fontWeight: 700,
              lineHeight: 1.2,
              fontSize: { xs: '1.2rem', sm: '1.3rem' },
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {rowCountLabel}
          </Typography>
          <Typography sx={{ mt: 0.2, color: 'text.secondary', fontSize: '0.82rem' }}>
            Ready for column mapping
          </Typography>
        </Box>
      </Box>

      <TableContainer
        component={Paper}
        elevation={0}
        sx={{
          borderRadius: 2,
          border: '1px solid',
          borderColor: 'divider',
          mb: 2,
        }}
      >
        <Table size="small" sx={{ minWidth: 650, tableLayout: 'fixed' }}>
          <TableHead>
            <TableRow sx={{ bgcolor: 'action.hover' }}>
              <TableCell
                sx={{
                  fontWeight: 700,
                  width: '50%',
                  borderBottom: '1px solid',
                  borderBottomColor: 'divider',
                }}
              >
                Excel column (detected)
              </TableCell>
              <TableCell
                sx={{
                  fontWeight: 700,
                  width: '50%',
                  borderBottom: '1px solid',
                  borderBottomColor: 'divider',
                }}
              >
                Target RACM field
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {headers.map((header) => (
              <TableRow
                key={header}
                hover
                sx={{
                  '&:last-child td': {
                    borderBottom: 'none',
                  },
                }}
              >
                <TableCell
                  sx={{
                    verticalAlign: 'middle',
                    width: '50%',
                    borderBottom: '1px solid',
                    borderBottomColor: 'divider',
                  }}
                >
                  <Typography sx={{ fontWeight: 600, wordBreak: 'break-word' }}>{header}</Typography>
                </TableCell>
                <TableCell
                  sx={{
                    width: '50%',
                    borderBottom: '1px solid',
                    borderBottomColor: 'divider',
                  }}
                >
                  <FormControl fullWidth size="small" disabled={loading}>
                    <Select
                      displayEmpty
                      value={selections[header]}
                      renderValue={(value) => {
                        if (value === AUTO) {
                          const detected = autoDetectedByHeader[header]
                          if (detected) return fieldOptionMap.get(detected) || detected
                          return 'Select a RACM field'
                        }
                        if (value === SKIP) return 'Skip — do not import'
                        return fieldOptionMap.get(value) || value
                      }}
                      onChange={(e) =>
                        setSelections((prev) => ({ ...prev, [header]: e.target.value }))
                      }
                    >
                      <MenuItem value={AUTO}>
                        {autoDetectedByHeader[header]
                          ? `Auto-detect: ${fieldOptionMap.get(autoDetectedByHeader[header]) || autoDetectedByHeader[header]}`
                          : 'Auto-detect: Select a RACM field'}
                      </MenuItem>
                      <MenuItem value={SKIP}>Skip — do not import</MenuItem>
                      {fieldOptions.map((opt) => (
                        <MenuItem
                          key={opt.value}
                          value={opt.value}
                          disabled={isFieldUsedByAnotherHeader(opt.value, header)}
                        >
                          {opt.label}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5 }}>
        <Button variant="contained" color="secondary" disabled={loading} onClick={handleSubmit}>
          {loading ? 'Importing…' : 'Submit import'}
        </Button>
        <Button variant="outlined" disabled={loading} onClick={handleBack}>
          Cancel
        </Button>
      </Box>
    </Box>
  )
}

export default ExcelColumnMap
