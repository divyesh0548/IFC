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
  USER_SEARCH_VISIBLE_OPTION_COUNT,
  excludeUnitUsers,
  fetchCompanyUsers,
  getUnitUserOptionLabel,
  getUnitUserDisplayLabel,
  isSameUnitUserOption,
} from './companyUserSearch'

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

function CompanyUserSearchAutocomplete({
  role,
  value = null,
  onChange,
  excludeEmails = [],
  label = 'Search User',
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

  const normalizedRole = String(role || '').trim()
  const resolvedValue = value?.email_id ? value : null
  const inputId = textFieldProps?.id || `${String(label || 'user-search').toLowerCase().replace(/\s+/g, '-')}-select`
  const excludeEmailsKey = getExcludeEmailsKey(excludeEmails)
  const resolvedPlaceholder = placeholder || label || 'Search by name or email...'

  const loadUsers = useCallback(
    async ({ q = '', limit = UNIT_USER_SEARCH_INITIAL_LIMIT } = {}) => {
      if (!normalizedRole) {
        setOptions([])
        setLoading(false)
        return
      }

      const requestId = requestIdRef.current + 1
      requestIdRef.current = requestId
      setLoading(true)

      try {
        const users = await fetchCompanyUsers({
          role: normalizedRole,
          q,
          limit,
        })

        if (requestIdRef.current !== requestId) return
        const excludedEmails = excludeEmailsKey ? excludeEmailsKey.split('\n') : []
        setOptions(excludeUnitUsers(users, excludedEmails))
      } catch (error) {
        console.error('Error loading company users:', error)
        if (requestIdRef.current === requestId) {
          setOptions([])
        }
      } finally {
        if (requestIdRef.current === requestId) {
          setLoading(false)
        }
      }
    },
    [excludeEmailsKey, normalizedRole]
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
    if (!normalizedRole) {
      setInputValue('')
    }
  }, [normalizedRole])

  useEffect(() => {
    if (!prefetch || !normalizedRole) return
    loadUsers({ q: '', limit: UNIT_USER_SEARCH_INITIAL_LIMIT })
  }, [prefetch, normalizedRole, loadUsers])

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
    if (disabled || !normalizedRole) return
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

    if (!normalizedRole) {
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
  const optionHeightPx = 44
  const menuMaxHeight = USER_SEARCH_VISIBLE_OPTION_COUNT * optionHeightPx

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
      color: theme.palette.text.primary,
      maxWidth: 'calc(100% - 8px)',
      margin: 0,
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
      backgroundColor: theme.palette.background.paper,
      boxShadow:
        theme.palette.mode === 'dark'
          ? '0 20px 45px rgba(0,0,0,0.45)'
          : '0 20px 45px rgba(15, 23, 42, 0.16)',
      border: `1px solid ${alpha(theme.palette.divider, theme.palette.mode === 'dark' ? 0.7 : 0.9)}`,
    }),
    menuList: (base) => ({
      ...base,
      maxHeight: menuMaxHeight,
      paddingTop: 0,
      paddingBottom: 0,
    }),
    option: (base, state) => ({
      ...base,
      cursor: 'pointer',
      padding: '12px 14px',
      backgroundColor: state.isFocused
        ? alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.18 : 0.08)
        : 'transparent',
      color: theme.palette.text.primary,
    }),
    indicatorSeparator: () => ({
      display: 'none',
    }),
    dropdownIndicator: (base) => ({
      ...base,
      color: theme.palette.text.secondary,
      paddingRight: 10,
    }),
    clearIndicator: (base) => ({
      ...base,
      color: theme.palette.text.secondary,
    }),
    noOptionsMessage: (base) => ({
      ...base,
      color: theme.palette.text.secondary,
      padding: '12px 14px',
    }),
    loadingMessage: (base) => ({
      ...base,
      color: theme.palette.text.secondary,
      padding: '12px 14px',
    }),
  }

  return (
    <Box sx={{ width: '100%' }}>
      <Typography
        component="label"
        htmlFor={inputId}
        sx={{
          display: 'block',
          mb: 0.75,
          fontSize: '0.8125rem',
          fontWeight: 600,
          color: theme.palette.text.secondary,
        }}
      >
        {label}
      </Typography>
      <Select
        inputId={inputId}
        options={displayedOptions}
        value={resolvedValue}
        onChange={handleSelectUser}
        onInputChange={handleInputChange}
        onMenuOpen={handleMenuOpen}
        onMenuClose={() => setMenuOpen(false)}
        menuIsOpen={menuOpen}
        isDisabled={disabled}
        isClearable
        isSearchable
        backspaceRemovesValue
        escapeClearsValue
        placeholder={resolvedPlaceholder}
        getOptionValue={(option) => String(option?.email_id || '').trim().toLowerCase()}
        getOptionLabel={getUnitUserOptionLabel}
        menuPortalTarget={typeof document !== 'undefined' ? document.body : null}
        menuPosition="fixed"
        components={{
          Option: ({ data, innerProps, innerRef, isFocused }) => (
            <Box
              ref={innerRef}
              {...innerProps}
              sx={{
                px: 1.75,
                py: 1.25,
                cursor: 'pointer',
                backgroundColor: isFocused
                  ? alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.18 : 0.08)
                  : 'transparent',
              }}
            >
              <UserOptionContent option={data} />
            </Box>
          ),
          SingleValue: UserSingleValue,
          LoadingIndicator: () => (loading ? <CircularProgress size={18} thickness={5} /> : null),
        }}
        styles={controlStyles}
        noOptionsMessage={() => (loading ? 'Loading...' : 'No users found')}
      />
      {helperText ? (
        <Typography
          variant="caption"
          sx={{
            display: 'block',
            mt: 0.75,
            color: theme.palette.text.secondary,
          }}
        >
          {helperText}
        </Typography>
      ) : null}
    </Box>
  )
}

export default CompanyUserSearchAutocomplete
