import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { alpha, useTheme } from '@mui/material/styles'
import Box from '@mui/material/Box'
import CircularProgress from '@mui/material/CircularProgress'
import Typography from '@mui/material/Typography'
import Select from 'react-select'
import { APP_SHAPE } from '../../theme'
import {
  UNIT_USER_SEARCH_DEBOUNCE_MS,
  UNIT_USER_SEARCH_INITIAL_LIMIT,
  UNIT_USER_SEARCH_LIMIT,
  excludeUnitUsers,
  fetchUnitUsers,
  getUnitUserOptionLabel,
  getUnitUserDisplayLabel,
  isSameUnitUserOption,
} from './unitUserSearch'

const EMPTY_EXCLUDE_EMAILS = Object.freeze([])

function getExcludeEmailsKey(excludeEmails) {
  return (Array.isArray(excludeEmails) ? excludeEmails : EMPTY_EXCLUDE_EMAILS)
    .map((email) => String(email || '').trim().toLowerCase())
    .filter(Boolean)
    .sort()
    .join('\n')
}

function mergeSelectedUserIntoOptions(options, selectedUser) {
  if (!selectedUser?.email_id) return options
  if (options.some((user) => isSameUnitUserOption(user, selectedUser))) {
    return options
  }
  return [selectedUser, ...options]
}

function UserOptionContent({ option }) {
  return (
    <Typography variant="body2" sx={{ color: 'text.primary', lineHeight: 1.4 }}>
      {getUnitUserDisplayLabel(option)}
    </Typography>
  )
}

function UserSingleValue({ data }) {
  const label = getUnitUserDisplayLabel(data)
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

function UnitUserSearchAutocomplete({
  unitId,
  value = null,
  onChange,
  excludeEmails = [],
  label = 'Search Username',
  placeholder = '',
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

  const normalizedUnitId = String(unitId || '').trim()
  const resolvedValue = value?.email_id ? value : null
  const inputId = textFieldProps?.id || `${String(label || 'user-search').toLowerCase().replace(/\s+/g, '-')}-select`
  const excludeEmailsKey = getExcludeEmailsKey(excludeEmails)
  const resolvedPlaceholder = placeholder || label || 'Search by name or email...'

  const loadUsers = useCallback(
    async ({ q = '', limit = UNIT_USER_SEARCH_INITIAL_LIMIT } = {}) => {
      if (!normalizedUnitId) {
        setOptions([])
        setLoading(false)
        return
      }

      const requestId = requestIdRef.current + 1
      requestIdRef.current = requestId
      setLoading(true)

      try {
        const users = await fetchUnitUsers({
          unitId: normalizedUnitId,
          q,
          limit,
        })

        if (requestIdRef.current !== requestId) return
        const excludedEmails = excludeEmailsKey ? excludeEmailsKey.split('\n') : []
        setOptions(excludeUnitUsers(users, excludedEmails))
      } catch (error) {
        console.error('Error loading unit users:', error)
        if (requestIdRef.current === requestId) {
          setOptions([])
        }
      } finally {
        if (requestIdRef.current === requestId) {
          setLoading(false)
        }
      }
    },
    [excludeEmailsKey, normalizedUnitId]
  )

  useEffect(() => {
    if (!resolvedValue?.email_id) {
      setInputValue('')
    }
  }, [resolvedValue])

  useEffect(() => {
    setOptions([])
    setMenuOpen(false)
    setLoading(false)
    if (!normalizedUnitId) {
      setInputValue('')
    }
  }, [normalizedUnitId])

  useEffect(() => {
    if (!prefetch || !normalizedUnitId) return
    loadUsers({ q: '', limit: UNIT_USER_SEARCH_INITIAL_LIMIT })
  }, [prefetch, normalizedUnitId, loadUsers])

  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
    }
  }, [])

  const displayedOptions = useMemo(
    () => mergeSelectedUserIntoOptions(options, resolvedValue),
    [options, resolvedValue]
  )

  const handleMenuOpen = () => {
    if (disabled || !normalizedUnitId) return
    setMenuOpen(true)
    loadUsers({
      q: inputValue.trim(),
      limit: inputValue.trim() ? UNIT_USER_SEARCH_LIMIT : UNIT_USER_SEARCH_INITIAL_LIMIT,
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

    if (resolvedValue && newInputValue !== getUnitUserOptionLabel(resolvedValue)) {
      onChange?.(null)
    }

    if (!normalizedUnitId) {
      setOptions([])
      return newInputValue
    }

    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }

    debounceRef.current = setTimeout(() => {
      const trimmedInput = newInputValue.trim()
      loadUsers({
        q: trimmedInput,
        limit: trimmedInput ? UNIT_USER_SEARCH_LIMIT : UNIT_USER_SEARCH_INITIAL_LIMIT,
      })
    }, UNIT_USER_SEARCH_DEBOUNCE_MS)

    return newInputValue
  }

  const handleSelectUser = (user) => {
    onChange?.(user)
    setInputValue('')
    setMenuOpen(false)
  }

  const controlBackgroundColor =
    theme.palette.mode === 'dark' ? 'transparent' : theme.palette.background.paper
  const inputBorderRadius = APP_SHAPE.input
  const menuBorderRadius = APP_SHAPE.surface

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
      maxHeight: 280,
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

  const formatOptionLabel = (option) => <UserOptionContent option={option} />

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75, width: '100%' }}>
      <Select
        inputId={inputId}
        options={displayedOptions}
        value={resolvedValue}
        inputValue={inputValue}
        isDisabled={disabled || !normalizedUnitId}
        isClearable
        isSearchable
        menuIsOpen={menuOpen && !disabled && Boolean(normalizedUnitId)}
        onMenuOpen={handleMenuOpen}
        onMenuClose={() => setMenuOpen(false)}
        onInputChange={handleInputChange}
        onChange={(newValue) => handleSelectUser(newValue || null)}
        getOptionLabel={getUnitUserOptionLabel}
        getOptionValue={(option) => String(option?.email_id || '').trim().toLowerCase()}
        formatOptionLabel={formatOptionLabel}
        placeholder={resolvedPlaceholder}
        styles={controlStyles}
        menuPortalTarget={typeof document !== 'undefined' ? document.body : null}
        menuPosition="fixed"
        noOptionsMessage={() =>
          !normalizedUnitId ? 'Unit is required to load users' : 'No users found for this unit'
        }
        loadingMessage={() => 'Loading users...'}
        isLoading={loading}
        components={{
          LoadingIndicator: () => <CircularProgress size={18} />,
          SingleValue: UserSingleValue,
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

export default UnitUserSearchAutocomplete
