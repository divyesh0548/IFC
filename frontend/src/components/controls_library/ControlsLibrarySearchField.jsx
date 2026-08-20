import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { alpha, useTheme } from '@mui/material/styles'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import CircularProgress from '@mui/material/CircularProgress'
import InputAdornment from '@mui/material/InputAdornment'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import SearchRoundedIcon from '@mui/icons-material/SearchRounded'
import { apiUrl } from '../../config/api'
import AppDialog, {
  APP_DIALOG_PRIMARY_BUTTON_SX,
  getAppDialogCancelButtonSx,
} from '../AppDialog'

const SUGGESTION_DEBOUNCE_MS = 300
const VISIBLE_SUGGESTION_COUNT = 7
const SUGGESTION_ROW_HEIGHT = 48

const ANCHOR_FIELDS = ['sub_process', 'risk_description']

function normalizeLibraryIds(ids) {
  const seen = new Set()
  const result = []
  ;(Array.isArray(ids) ? ids : [ids]).forEach((id) => {
    const numericId = Number(id)
    if (!Number.isFinite(numericId) || numericId <= 0 || seen.has(numericId)) return
    seen.add(numericId)
    result.push(numericId)
  })
  return result
}

function suggestionValueKey(value) {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ')
}

function ControlsLibrarySearchField({
  businessProcess,
  field,
  label,
  value = '',
  onChange,
  onLibraryPick,
  multiline = false,
  disabled = false,
  prioritizeSubProcess = false,
  prioritizeRisk = false,
  subProcess = '',
  librarySubProcessId = null,
  librarySubProcessIds = [],
  libraryRiskIds = [],
  gridColumn,
}) {
  const theme = useTheme()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [options, setOptions] = useState([])
  const [loading, setLoading] = useState(false)
  const [draftValue, setDraftValue] = useState(value || '')
  const [pendingLibraryId, setPendingLibraryId] = useState(null)
  const [pendingLibraryIds, setPendingLibraryIds] = useState([])
  const [pendingSelectedValue, setPendingSelectedValue] = useState('')
  const debounceRef = useRef(null)
  const requestIdRef = useRef(0)

  const isDisabled = disabled || !String(businessProcess || '').trim()
  const displayValue = String(value || '')

  const fetchSuggestions = useCallback(async (searchText) => {
    const bp = String(businessProcess || '').trim()
    if (!bp || !field) {
      setOptions([])
      return
    }

    const requestId = requestIdRef.current + 1
    requestIdRef.current = requestId
    setLoading(true)

    try {
      const params = new URLSearchParams({
        business_process: bp,
        field,
        q: String(searchText || '').trim(),
      })

      if (prioritizeSubProcess) {
        params.set('prioritize_sub_process', 'true')
        if (subProcess) params.set('sub_process', subProcess)
        if (librarySubProcessId) params.set('library_sub_process_id', String(librarySubProcessId))
        if (librarySubProcessIds.length > 0) {
          params.set('library_sub_process_ids', librarySubProcessIds.join(','))
        }
      }

      if (prioritizeRisk && libraryRiskIds.length > 0) {
        params.set('prioritize_risk', 'true')
        params.set('library_risk_ids', libraryRiskIds.join(','))
      }

      const response = await fetch(apiUrl(`/api/controls-library/suggestions?${params.toString()}`), {
        credentials: 'include',
      })
      const data = await response.json()

      if (requestIdRef.current !== requestId) return

      if (response.ok && data.success) {
        setOptions(Array.isArray(data.data?.suggestions) ? data.data.suggestions : [])
      } else {
        setOptions([])
      }
    } catch (error) {
      console.error('Controls library suggestions error:', error)
      if (requestIdRef.current === requestId) {
        setOptions([])
      }
    } finally {
      if (requestIdRef.current === requestId) {
        setLoading(false)
      }
    }
  }, [
    businessProcess,
    field,
    prioritizeSubProcess,
    prioritizeRisk,
    subProcess,
    librarySubProcessId,
    librarySubProcessIds,
    libraryRiskIds,
  ])

  const scheduleSuggestionFetch = useCallback((searchText) => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }

    debounceRef.current = setTimeout(() => {
      fetchSuggestions(searchText)
    }, SUGGESTION_DEBOUNCE_MS)
  }, [fetchSuggestions])

  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
    }
  }, [])

  const openDialog = () => {
    if (isDisabled) return
    setDraftValue(displayValue)
    if (field === 'sub_process') {
      const ids = normalizeLibraryIds(
        librarySubProcessIds.length > 0
          ? librarySubProcessIds
          : (librarySubProcessId ? [librarySubProcessId] : [])
      )
      setPendingLibraryId(ids[0] ?? librarySubProcessId ?? null)
      setPendingLibraryIds(ids)
    } else if (field === 'risk_description') {
      const ids = normalizeLibraryIds(libraryRiskIds)
      setPendingLibraryId(ids[0] ?? null)
      setPendingLibraryIds(ids)
    } else {
      setPendingLibraryId(null)
      setPendingLibraryIds([])
    }
    setPendingSelectedValue(displayValue)
    setDialogOpen(true)
    fetchSuggestions(displayValue)
  }

  const closeDialog = () => {
    setDialogOpen(false)
  }

  const handleCancel = () => {
    closeDialog()
  }

  const handleConfirm = () => {
    const nextValue = String(draftValue || '')
    onChange(nextValue)

    if (ANCHOR_FIELDS.includes(field)) {
      const trimmedDraft = nextValue.trim()
      const ids = trimmedDraft ? normalizeLibraryIds(pendingLibraryIds) : []
      if (ids.length > 0) {
        onLibraryPick?.({
          libraryId: ids[0],
          libraryIds: ids,
        })
      } else {
        onLibraryPick?.({
          libraryId: null,
          libraryIds: [],
        })
      }
    }

    closeDialog()
  }

  const handleDraftChange = (nextValue) => {
    setDraftValue(nextValue)
    scheduleSuggestionFetch(nextValue)
  }

  const handleSuggestionSelect = (suggestion) => {
    const nextValue = String(suggestion?.value || '')
    const subProcessMatchedIds = normalizeLibraryIds(suggestion?.matchedSubProcessLibraryIds)
    const matchedIds = normalizeLibraryIds(suggestion?.matchedLibraryIds)
    const allIds = normalizeLibraryIds(suggestion?.libraryIds)
    const ids = field === 'risk_description'
      ? (subProcessMatchedIds.length
        ? subProcessMatchedIds
        : (matchedIds.length ? matchedIds : allIds))
      : (allIds.length ? allIds : matchedIds)

    setDraftValue(nextValue)
    setPendingSelectedValue(nextValue)
    setPendingLibraryId(ids[0] ?? null)
    setPendingLibraryIds(ids)
    scheduleSuggestionFetch(nextValue)
  }

  const groupedSuggestions = useMemo(() => {
    const riskMatched = []
    const subProcessMatched = []
    const other = []
    const seenKeys = new Set()

    options.forEach((option) => {
      const valueKey = suggestionValueKey(option?.value)
      if (!valueKey || seenKeys.has(valueKey)) return
      if (prioritizeRisk && option.matchedRisk) {
        riskMatched.push(option)
        seenKeys.add(valueKey)
      }
    })

    options.forEach((option) => {
      const valueKey = suggestionValueKey(option?.value)
      if (!valueKey || seenKeys.has(valueKey)) return
      if (prioritizeSubProcess && option.matchedSubProcess) {
        subProcessMatched.push(option)
        seenKeys.add(valueKey)
      }
    })

    options.forEach((option) => {
      const valueKey = suggestionValueKey(option?.value)
      if (!valueKey || seenKeys.has(valueKey)) return
      other.push(option)
      seenKeys.add(valueKey)
    })

    return { riskMatched, subProcessMatched, other }
  }, [options, prioritizeRisk, prioritizeSubProcess])

  const renderSuggestionItem = (suggestion) => {
    const valueText = String(suggestion?.value || '').trim()
    const isSelected = valueText === String(draftValue || '').trim()
    const isRiskMatched = Boolean(suggestion.matchedRisk)
    const isSubProcessMatched = Boolean(suggestion.matchedSubProcess || suggestion.matched)

    return (
      <Box
        key={`${valueText}-${suggestion.libraryIds?.[0] || 'row'}`}
        component="button"
        type="button"
        onClick={() => handleSuggestionSelect(suggestion)}
        sx={{
          display: 'block',
          width: '100%',
          textAlign: 'left',
          border: 'none',
          borderBottom: '1px solid',
          borderColor: 'divider',
          backgroundColor: isSelected
            ? alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.18 : 0.08)
            : 'transparent',
          cursor: 'pointer',
          px: 2,
          py: 1.25,
          '&:hover': {
            backgroundColor: alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.14 : 0.06),
          },
        }}
      >
        <Typography
          variant="body2"
          sx={{
            fontWeight: isRiskMatched || isSubProcessMatched ? 600 : 400,
            whiteSpace: 'normal',
            wordBreak: 'break-word',
            lineHeight: 1.45,
            color: 'text.primary',
          }}
        >
          {valueText}
        </Typography>
        {isRiskMatched ? (
          <Typography
            variant="caption"
            sx={{ display: 'block', mt: 0.25, color: 'text.secondary', fontWeight: 500 }}
          >
            (based on selected risk)
          </Typography>
        ) : null}
      </Box>
    )
  }

  const renderSuggestionList = () => {
    if (loading && options.length === 0) {
      return (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
          <CircularProgress size={24} />
        </Box>
      )
    }

    if (!loading && options.length === 0) {
      return (
        <Typography variant="body2" color="text.secondary" sx={{ py: 2, px: 2 }}>
          No suggestions found for this business process.
        </Typography>
      )
    }

    return (
      <Box
        sx={{
          maxHeight: VISIBLE_SUGGESTION_COUNT * SUGGESTION_ROW_HEIGHT,
          overflowY: 'auto',
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 1.5,
        }}
      >
        {prioritizeRisk && groupedSuggestions.riskMatched.length > 0 ? (
          <Box>
            <Typography
              variant="caption"
              sx={{
                display: 'block',
                position: 'sticky',
                top: 0,
                zIndex: 1,
                px: 2,
                py: 1,
                fontWeight: 700,
                color: 'text.secondary',
                backgroundColor: `color-mix(in srgb, ${theme.palette.primary.main} 22%, ${theme.palette.background.paper})`,
              }}
            >
              Based on selected risk
            </Typography>
            {groupedSuggestions.riskMatched.map(renderSuggestionItem)}
          </Box>
        ) : null}

        {prioritizeSubProcess && groupedSuggestions.subProcessMatched.length > 0 ? (
          <Box>
            <Typography
              variant="caption"
              sx={{
                display: 'block',
                position: 'sticky',
                top: 0,
                zIndex: 1,
                px: 2,
                py: 1,
                fontWeight: 700,
                color: 'text.secondary',
                backgroundColor: `color-mix(in srgb, ${theme.palette.primary.main} 12%, ${theme.palette.background.paper})`,
              }}
            >
              Based on selected sub-process
            </Typography>
            {groupedSuggestions.subProcessMatched.map(renderSuggestionItem)}
          </Box>
        ) : null}

        {(prioritizeSubProcess || prioritizeRisk) && groupedSuggestions.other.length > 0 ? (
          <Box>
            <Typography
              variant="caption"
              sx={{
                display: 'block',
                position: 'sticky',
                top: 0,
                zIndex: 1,
                px: 2,
                py: 1,
                fontWeight: 700,
                color: 'text.secondary',
                backgroundColor: theme.palette.background.paper,
              }}
            >
              Based on selected business process
            </Typography>
            {groupedSuggestions.other.map(renderSuggestionItem)}
          </Box>
        ) : null}

        {!prioritizeSubProcess && !prioritizeRisk ? options.map(renderSuggestionItem) : null}
      </Box>
    )
  }

  return (
    <Box sx={{ gridColumn, width: '100%' }}>
      <Box
        onClick={openDialog}
        sx={{
          cursor: isDisabled ? 'default' : 'pointer',
          '& .MuiTextField-root': {
            pointerEvents: 'none',
          },
        }}
      >
        <TextField
          fullWidth
          label={label}
          value={displayValue}
          variant="outlined"
          disabled
          multiline={multiline}
          minRows={multiline ? 3 : undefined}
          placeholder={isDisabled ? undefined : 'Click to browse library'}
          helperText={
            isDisabled
              ? 'Select a business process to browse controls library'
              : 'Click to browse controls library suggestions'
          }
          InputProps={{
            endAdornment: (
              <InputAdornment position="end">
                <SearchRoundedIcon color={isDisabled ? 'disabled' : 'action'} />
              </InputAdornment>
            ),
          }}
          sx={{
            '& .MuiInputBase-input.Mui-disabled': {
              WebkitTextFillColor: theme.palette.text.primary,
              color: theme.palette.text.primary,
              opacity: displayValue ? 1 : 0.55,
            },
            '& .MuiFormLabel-root.Mui-disabled': {
              color: theme.palette.text.secondary,
            },
            '& .MuiOutlinedInput-root.Mui-disabled .MuiOutlinedInput-notchedOutline': {
              borderColor: theme.palette.mode === 'dark'
                ? 'rgba(255, 255, 255, 0.23)'
                : 'rgba(0, 0, 0, 0.23)',
            },
          }}
        />
      </Box>

      <AppDialog
        open={dialogOpen}
        onClose={handleCancel}
        title={`Browse controls library — ${label}`}
        titleId={`controls-library-dialog-${field}`}
        description="Search, pick a suggestion, or edit the text. Confirm to apply this value to the form."
        descriptionId={`controls-library-dialog-desc-${field}`}
        maxWidth="md"
        fullWidth
        showTitleDivider
        actions={
          <>
            <Button
              onClick={handleCancel}
              variant="outlined"
              sx={getAppDialogCancelButtonSx(theme)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirm}
              variant="contained"
              sx={APP_DIALOG_PRIMARY_BUTTON_SX}
            >
              Confirm
            </Button>
          </>
        }
      >
        <TextField
          fullWidth
          label="Search or enter value"
          value={draftValue}
          onChange={(event) => handleDraftChange(event.target.value)}
          multiline={multiline}
          minRows={multiline ? 3 : 1}
          variant="outlined"
          InputProps={{
            endAdornment: loading ? (
              <InputAdornment position="end">
                <CircularProgress size={18} />
              </InputAdornment>
            ) : undefined,
          }}
        />

        <Box>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
            Suggestions
          </Typography>
          {renderSuggestionList()}
        </Box>
      </AppDialog>
    </Box>
  )
}

export default ControlsLibrarySearchField
