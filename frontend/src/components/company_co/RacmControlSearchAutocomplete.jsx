import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { alpha, useTheme } from '@mui/material/styles'
import Box from '@mui/material/Box'
import CircularProgress from '@mui/material/CircularProgress'
import Typography from '@mui/material/Typography'
import Select from 'react-select'
import { APP_SHAPE } from '../../theme'
import {
  RACM_CONTROL_SEARCH_DEBOUNCE_MS,
  RACM_CONTROL_SEARCH_INITIAL_LIMIT,
  RACM_CONTROL_SEARCH_LIMIT,
  RACM_CONTROL_SEARCH_VISIBLE_OPTION_COUNT,
  fetchRacmControlsForCc,
  getRacmControlDisplayLabel,
  getRacmControlOptionLabel,
  isSameRacmControlOption,
} from './racmControlSearch'

function mergeSelectedControlIntoOptions(options, selectedControl) {
  if (!selectedControl?.form_id) return options
  if (options.some((option) => isSameRacmControlOption(option, selectedControl))) {
    return options
  }
  return [selectedControl, ...options]
}

function ControlOptionContent({ option }) {
  return (
    <Typography variant="body2" sx={{ color: 'text.primary', lineHeight: 1.4 }}>
      {getRacmControlDisplayLabel(option)}
    </Typography>
  )
}

function ControlSingleValue({ data }) {
  const label = getRacmControlDisplayLabel(data)
  if (!label || label === '-') return null

  return (
    <Box
      component="span"
      sx={{
        display: 'block',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        maxWidth: '100%',
        fontSize: '1rem',
        lineHeight: '23px',
        color: 'text.primary',
      }}
    >
      {label}
    </Box>
  )
}

function RacmControlSearchAutocomplete({
  businessProcess,
  unitId,
  value = null,
  onChange,
  label = 'Control Number',
  placeholder = 'Search control number...',
  disabled = false,
  prefetch = false,
  helperText = '',
  textFieldProps = {},
  inDialog = true,
}) {
  const theme = useTheme()
  const debounceRef = useRef(null)
  const requestIdRef = useRef(0)
  const [options, setOptions] = useState([])
  const [inputValue, setInputValue] = useState('')
  const [loading, setLoading] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  const normalizedBusinessProcess = String(businessProcess || '').trim()
  const normalizedUnitId = String(unitId || '').trim()
  const canSearch = Boolean(normalizedBusinessProcess && normalizedUnitId)
  const resolvedValue = value?.form_id ? value : null
  const inputId =
    textFieldProps?.id ||
    `${String(label || 'control-search').toLowerCase().replace(/\s+/g, '-')}-select`
  const resolvedPlaceholder = placeholder || label || 'Search control number...'

  const loadControls = useCallback(
    async ({ q = '', limit = RACM_CONTROL_SEARCH_INITIAL_LIMIT } = {}) => {
      if (!canSearch) {
        setOptions([])
        setLoading(false)
        return
      }

      const requestId = requestIdRef.current + 1
      requestIdRef.current = requestId
      setLoading(true)

      try {
        const controls = await fetchRacmControlsForCc({
          businessProcess: normalizedBusinessProcess,
          unitId: normalizedUnitId,
          q,
          limit,
        })

        if (requestIdRef.current !== requestId) return
        setOptions(controls)
      } catch (error) {
        console.error('Error loading RACM controls:', error)
        if (requestIdRef.current === requestId) {
          setOptions([])
        }
      } finally {
        if (requestIdRef.current === requestId) {
          setLoading(false)
        }
      }
    },
    [canSearch, normalizedBusinessProcess, normalizedUnitId]
  )

  useEffect(() => {
    if (!resolvedValue?.form_id) {
      setInputValue('')
    }
  }, [resolvedValue])

  useEffect(() => {
    setOptions([])
    setMenuOpen(false)
    setLoading(false)
    if (!canSearch) {
      setInputValue('')
    }
  }, [canSearch, normalizedBusinessProcess, normalizedUnitId])

  useEffect(() => {
    if (!prefetch || !canSearch) return
    loadControls({ q: '', limit: RACM_CONTROL_SEARCH_INITIAL_LIMIT })
  }, [prefetch, canSearch, loadControls])

  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
    }
  }, [])

  const displayedOptions = useMemo(
    () => mergeSelectedControlIntoOptions(options, resolvedValue),
    [options, resolvedValue]
  )

  const handleMenuOpen = () => {
    if (disabled || !canSearch) return
    setMenuOpen(true)
    loadControls({
      q: inputValue.trim(),
      limit: inputValue.trim() ? RACM_CONTROL_SEARCH_LIMIT : RACM_CONTROL_SEARCH_INITIAL_LIMIT,
    })
  }

  const handleInputChange = (newInputValue, meta) => {
    if (meta.action === 'set-value' || meta.action === 'menu-close' || meta.action === 'clear') {
      setInputValue('')
      return ''
    }

    if (meta.action !== 'input-change') {
      return inputValue
    }

    setInputValue(newInputValue)
    setMenuOpen(true)

    if (resolvedValue && newInputValue !== getRacmControlOptionLabel(resolvedValue)) {
      onChange?.(null)
    }

    if (!canSearch) {
      setOptions([])
      return newInputValue
    }

    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }

    debounceRef.current = setTimeout(() => {
      const trimmedInput = newInputValue.trim()
      loadControls({
        q: trimmedInput,
        limit: trimmedInput ? RACM_CONTROL_SEARCH_LIMIT : RACM_CONTROL_SEARCH_INITIAL_LIMIT,
      })
    }, RACM_CONTROL_SEARCH_DEBOUNCE_MS)

    return newInputValue
  }

  const handleSelectControl = (control) => {
    onChange?.(control)
    setInputValue('')
    setMenuOpen(false)
  }

  const controlBackgroundColor =
    theme.palette.mode === 'dark' ? 'transparent' : theme.palette.background.paper
  const inputBorderRadius = APP_SHAPE.input
  const menuBorderRadius = APP_SHAPE.surface
  const optionHeightPx = 44
  const menuMaxHeight = RACM_CONTROL_SEARCH_VISIBLE_OPTION_COUNT * optionHeightPx

  const controlStyles = {
    control: (base, state) => ({
      ...base,
      minHeight: 56,
      height: 56,
      borderRadius: inputBorderRadius,
      borderColor: state.isFocused
        ? theme.palette.primary.main
        : theme.palette.mode === 'dark'
          ? 'rgba(255,255,255,0.23)'
          : '#d1d5db',
      boxShadow: state.isFocused ? `0 0 0 1px ${theme.palette.primary.main}` : 'none',
      backgroundColor: controlBackgroundColor,
      '&:hover': {
        borderColor: state.isFocused
          ? theme.palette.primary.main
          : theme.palette.mode === 'dark'
            ? 'rgba(255,255,255,0.3)'
            : '#9ca3af',
      },
    }),
    valueContainer: (base) => ({
      ...base,
      padding: '0 14px',
      height: 54,
      display: 'flex',
      alignItems: 'center',
    }),
    input: (base) => ({
      ...base,
      color: theme.palette.text.primary,
      margin: 0,
      padding: 0,
    }),
    placeholder: (base) => ({
      ...base,
      color: theme.palette.text.secondary,
    }),
    singleValue: (base) => ({
      ...base,
      position: 'static',
      top: 'auto',
      transform: 'none',
      maxWidth: 'calc(100% - 8px)',
      margin: 0,
      color: theme.palette.text.primary,
    }),
    indicatorsContainer: (base) => ({
      ...base,
      height: 54,
      alignSelf: 'stretch',
    }),
    menuPortal: (base) => ({
      ...base,
      zIndex: inDialog ? theme.zIndex.modal + 2 : theme.zIndex.modal,
    }),
    menu: (base) => ({
      ...base,
      borderRadius: menuBorderRadius,
      overflow: 'hidden',
      border: `1px solid ${theme.palette.divider}`,
      boxShadow: theme.shadows[8],
      backgroundColor: theme.palette.background.paper,
    }),
    menuList: (base) => ({
      ...base,
      paddingTop: 0,
      paddingBottom: 0,
      maxHeight: menuMaxHeight,
    }),
    option: (base, state) => ({
      ...base,
      backgroundColor: state.isSelected
        ? alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.26 : 0.14)
        : state.isFocused
          ? alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.14 : 0.08)
          : theme.palette.background.paper,
      color: theme.palette.text.primary,
      cursor: 'pointer',
      padding: '10px 14px',
    }),
    noOptionsMessage: (base) => ({
      ...base,
      color: theme.palette.text.secondary,
    }),
    loadingMessage: (base) => ({
      ...base,
      color: theme.palette.text.secondary,
    }),
    indicatorSeparator: () => ({
      display: 'none',
    }),
    dropdownIndicator: (base, state) => ({
      ...base,
      color: state.isFocused ? theme.palette.primary.main : theme.palette.text.secondary,
      '&:hover': {
        color: theme.palette.primary.main,
      },
    }),
    clearIndicator: (base) => ({
      ...base,
      color: theme.palette.text.secondary,
      '&:hover': {
        color: theme.palette.text.primary,
      },
    }),
  }

  const formatOptionLabel = (option) => <ControlOptionContent option={option} />

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75, width: '100%' }}>
      <Typography
        component="label"
        htmlFor={inputId}
        sx={{ fontSize: '0.875rem', fontWeight: 600, color: 'text.secondary' }}
      >
        {label}
      </Typography>
      <Select
        inputId={inputId}
        options={displayedOptions}
        value={resolvedValue}
        inputValue={inputValue}
        isDisabled={disabled || !canSearch}
        isClearable
        isSearchable
        menuIsOpen={menuOpen && !disabled && canSearch}
        onMenuOpen={handleMenuOpen}
        onMenuClose={() => setMenuOpen(false)}
        onInputChange={handleInputChange}
        onChange={(newValue) => handleSelectControl(newValue || null)}
        getOptionLabel={getRacmControlOptionLabel}
        getOptionValue={(option) => String(option?.form_id || '').trim()}
        formatOptionLabel={formatOptionLabel}
        placeholder={resolvedPlaceholder}
        styles={controlStyles}
        menuPortalTarget={typeof document !== 'undefined' ? document.body : null}
        menuPosition="fixed"
        filterOption={() => true}
        noOptionsMessage={() =>
          !normalizedBusinessProcess
            ? 'Select a Business Process first'
            : !normalizedUnitId
              ? 'Select a Unit first'
              : 'No controls found for this business process and unit'
        }
        loadingMessage={() => 'Loading controls...'}
        isLoading={loading}
        components={{
          LoadingIndicator: () => <CircularProgress size={18} />,
          SingleValue: ControlSingleValue,
        }}
      />

      {helperText ? (
        <Typography variant="caption" color="text.secondary">
          {helperText}
        </Typography>
      ) : null}
    </Box>
  )
}

export default RacmControlSearchAutocomplete
