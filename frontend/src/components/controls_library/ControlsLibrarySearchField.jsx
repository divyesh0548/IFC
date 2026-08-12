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
  subProcess = '',
  librarySubProcessId = null,
  gridColumn,
}) {
  const theme = useTheme()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [options, setOptions] = useState([])
  const [loading, setLoading] = useState(false)
  const [draftValue, setDraftValue] = useState(value || '')
  const [pendingLibraryId, setPendingLibraryId] = useState(null)
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
  }, [businessProcess, field, prioritizeSubProcess, subProcess, librarySubProcessId])

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
    setPendingLibraryId(field === 'sub_process' ? librarySubProcessId : null)
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

    if (field === 'sub_process') {
      const trimmedDraft = nextValue.trim()
      const trimmedPending = String(pendingSelectedValue || '').trim()
      if (pendingLibraryId && trimmedDraft && trimmedDraft === trimmedPending) {
        onLibraryPick?.(pendingLibraryId)
      } else {
        onLibraryPick?.(null)
      }
    }

    closeDialog()
  }

  const handleDraftChange = (nextValue) => {
    setDraftValue(nextValue)
    scheduleSuggestionFetch(nextValue)

    const trimmedNext = String(nextValue || '').trim()
    const trimmedPending = String(pendingSelectedValue || '').trim()
    if (!trimmedPending || trimmedNext !== trimmedPending) {
      setPendingLibraryId(null)
    }
  }

  const handleSuggestionSelect = (suggestion) => {
    const nextValue = String(suggestion?.value || '')
    setDraftValue(nextValue)
    setPendingSelectedValue(nextValue)
    setPendingLibraryId(suggestion?.libraryIds?.[0] ?? null)
    scheduleSuggestionFetch(nextValue)
  }

  const groupedSuggestions = useMemo(() => {
    const matched = []
    const other = []

    options.forEach((option) => {
      const valueText = String(option?.value || '').trim()
      if (!valueText) return
      if (prioritizeSubProcess && option.matched) {
        matched.push(option)
      } else {
        other.push(option)
      }
    })

    return { matched, other }
  }, [options, prioritizeSubProcess])

  const renderSuggestionItem = (suggestion) => {
    const valueText = String(suggestion?.value || '').trim()
    const isSelected = valueText === String(draftValue || '').trim()
    const isMatched = Boolean(suggestion.matched)

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
            fontWeight: isMatched ? 700 : 400,
            whiteSpace: 'normal',
            wordBreak: 'break-word',
            lineHeight: 1.45,
            color: 'text.primary',
          }}
        >
          {valueText}
        </Typography>
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
        {prioritizeSubProcess && groupedSuggestions.matched.length > 0 ? (
          <Box>
            <Typography
              variant="caption"
              sx={{
                display: 'block',
                px: 2,
                py: 1,
                fontWeight: 700,
                color: 'text.secondary',
                backgroundColor: alpha(theme.palette.primary.main, 0.06),
              }}
            >
              Suggested for selected sub-process
            </Typography>
            {groupedSuggestions.matched.map(renderSuggestionItem)}
          </Box>
        ) : null}

        {prioritizeSubProcess && groupedSuggestions.other.length > 0 ? (
          <Box>
            <Typography
              variant="caption"
              sx={{
                display: 'block',
                px: 2,
                py: 1,
                fontWeight: 700,
                color: 'text.secondary',
                backgroundColor: alpha(theme.palette.action.hover, 0.4),
              }}
            >
              Other options in this business process
            </Typography>
            {groupedSuggestions.other.map(renderSuggestionItem)}
          </Box>
        ) : null}

        {!prioritizeSubProcess ? options.map(renderSuggestionItem) : null}
      </Box>
    )
  }

  return (
    <Box sx={{ gridColumn, width: '100%' }}>
      <TextField
        fullWidth
        label={label}
        value={displayValue}
        variant="outlined"
        disabled={isDisabled}
        multiline={multiline}
        minRows={multiline ? 3 : undefined}
        helperText={
          isDisabled
            ? 'Select a business process to browse controls library'
            : 'Click to browse controls library suggestions'
        }
        onClick={openDialog}
        InputProps={{
          readOnly: true,
          endAdornment: (
            <InputAdornment position="end">
              <SearchRoundedIcon color={isDisabled ? 'disabled' : 'action'} />
            </InputAdornment>
          ),
          sx: { cursor: isDisabled ? 'default' : 'pointer' },
        }}
        sx={{
          '& .MuiInputBase-root': {
            cursor: isDisabled ? 'default' : 'pointer',
          },
        }}
      />

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
