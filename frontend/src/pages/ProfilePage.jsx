import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTheme } from '@mui/material/styles'
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import Alert from '@mui/material/Alert'
import TextField from '@mui/material/TextField'
import Button from '@mui/material/Button'
import { toast } from 'react-hot-toast'
import { MAIN_CONTENT_MAX_WIDTH, PAGE_SUBHEADER_TEXT_SX } from '../uiConstants'
import { useSyncGlobalLoading } from '../contexts/GlobalLoadingContext'
import {
  readCachedUserProfile,
  writeCachedUserProfile,
  writeStoredUserDisplayName,
} from '../storageKeys'
import { apiUrl } from '../config/api'
import { getMobileValidationError, normalizeMobileDigits } from '../utils/mobileValidation'

const FIELDS = [
  { key: 'emp_name', label: 'Employee name' },
  { key: 'email_id', label: 'Email' },
  { key: 'phone', label: 'Phone' },
  { key: 'company_name', label: 'Company name' },
  { key: 'department', label: 'Department' },
  { key: 'designation', label: 'Designation' },
]

function displayValue(value) {
  if (value === null || value === undefined) return '—'
  const s = String(value).trim()
  return s.length > 0 ? s : '—'
}

function ProfilePage() {
  const theme = useTheme()
  const navigate = useNavigate()
  const [profile, setProfile] = useState(() => readCachedUserProfile())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [isEditing, setIsEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editForm, setEditForm] = useState({
    emp_name: '',
    designation: '',
    department: '',
    mobile: '',
  })

  useSyncGlobalLoading(loading || saving)

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      const hadCache = Boolean(readCachedUserProfile())
      setLoading(true)
      setError('')
      try {
        const response = await fetch(apiUrl('/api/auth/profile'), {
          method: 'GET',
          credentials: 'include',
        })
        const data = await response.json()
        if (cancelled) return
        if (response.ok && data.success && data.profile) {
          setProfile(data.profile)
          writeCachedUserProfile(data.profile)
          writeStoredUserDisplayName(data.profile)
          setError('')
        } else {
          setError(data.message || 'Failed to load profile')
          if (!hadCache) {
            setProfile(null)
          }
        }
      } catch (e) {
        console.error(e)
        if (!cancelled) {
          setError('Network error while loading profile')
          if (!readCachedUserProfile()) {
            setProfile(null)
          }
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }
    run()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!profile) return
    setEditForm({
      emp_name: profile.emp_name ?? '',
      designation: profile.designation ?? '',
      department: profile.department ?? '',
      mobile: profile.phone ?? '',
    })
  }, [profile])

  const handleEditChange = (key, value) => {
    setEditForm((prev) => ({ ...prev, [key]: value }))
  }

  const mobileValidationError = editForm.mobile.trim()
    ? getMobileValidationError(editForm.mobile)
    : null

  const handleSave = async () => {
    const mobileError = editForm.mobile.trim() ? getMobileValidationError(editForm.mobile) : null
    if (mobileError) {
      toast.error(mobileError)
      return
    }

    setSaving(true)
    try {
      const response = await fetch(apiUrl('/api/auth/profile'), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          emp_name: editForm.emp_name,
          designation: editForm.designation,
          department: editForm.department,
          mobile: normalizeMobileDigits(editForm.mobile) || null,
        }),
      })
      const data = await response.json()
      if (response.ok && data.success && data.profile) {
        setProfile(data.profile)
        writeCachedUserProfile(data.profile)
        writeStoredUserDisplayName(data.profile)
        setIsEditing(false)
        toast.success('Profile updated successfully')
      } else {
        toast.error(data.message || 'Failed to update profile')
      }
    } catch (e) {
      console.error(e)
      toast.error('Network error while updating profile')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Box
      sx={{
        maxWidth: MAIN_CONTENT_MAX_WIDTH,
        mx: 0,
        width: '100%',
      }}
    >
      <Typography
        variant="h4"
        component="h1"
        sx={{
          fontWeight: 800,
          letterSpacing: '-0.02em',
          color: 'text.primary',
          mb: 0.75,
        }}
      >
        Profile
      </Typography>
      <Typography variant="body1" sx={{ ...PAGE_SUBHEADER_TEXT_SX, mb: 3 }}>
        Your account details as stored in IFC.
      </Typography>

      {!loading && error ? (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      ) : null}
      {profile ? (
        <Paper
          elevation={0}
          sx={{
            maxWidth: 760,
            borderRadius: 2,
            border: '1px solid',
            borderColor: 'divider',
            overflow: 'hidden',
          }}
        >
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', px: { xs: 2, sm: 3 }, py: 1.5, borderBottom: '1px solid', borderColor: 'divider' }}>
            {!isEditing ? (
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                <Button
                  variant="text"
                  size="small"
                  onClick={() => navigate('/update-password')}
                >
                  Update Password
                </Button>
                <Button variant="outlined" size="small" onClick={() => { setIsEditing(true) }}>
                  Update Details
                </Button>
              </Box>
            ) : (
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button
                  variant="outlined"
                  size="small"
                  disabled={saving}
                  onClick={() => {
                    setIsEditing(false)
                    setEditForm({
                      emp_name: profile.emp_name ?? '',
                      designation: profile.designation ?? '',
                      department: profile.department ?? '',
                      mobile: profile.phone ?? '',
                    })
                  }}
                >
                  Cancel
                </Button>
                <Button variant="contained" size="small" disabled={saving} onClick={handleSave}>
                  {saving ? 'Saving...' : 'Save'}
                </Button>
              </Box>
            )}
          </Box>
          {FIELDS.map((field, index) => (
            <Box
              key={field.key}
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: 'minmax(140px, 0.35fr) 1fr' },
                gap: { xs: 0.5, sm: 2 },
                px: { xs: 2, sm: 3 },
                py: 2,
                borderBottom:
                  index < FIELDS.length - 1 ? '1px solid' : 'none',
                borderColor: 'divider',
                backgroundColor:
                  index % 2 === 0
                    ? theme.palette.mode === 'dark'
                      ? 'rgba(255, 255, 255, 0.02)'
                      : 'rgba(0, 0, 0, 0.02)'
                    : 'transparent',
              }}
            >
              <Typography
                variant="body2"
                sx={{ fontWeight: 600, color: 'text.secondary' }}
              >
                {field.label}
              </Typography>
              {isEditing && ['emp_name', 'designation', 'department', 'phone'].includes(field.key) ? (
                <TextField
                  size="small"
                  fullWidth
                  type={field.key === 'phone' ? 'tel' : 'text'}
                  value={field.key === 'phone' ? editForm.mobile : editForm[field.key]}
                  onChange={(e) => handleEditChange(field.key === 'phone' ? 'mobile' : field.key, e.target.value)}
                  disabled={saving}
                  error={field.key === 'phone' && !!mobileValidationError}
                  helperText={
                    field.key === 'phone'
                      ? mobileValidationError || 'Optional. Enter a valid 10-digit mobile number.'
                      : undefined
                  }
                  inputProps={field.key === 'phone' ? { maxLength: 10 } : undefined}
                />
              ) : (
                <Typography variant="body2" sx={{ fontWeight: 500, color: 'text.primary', wordBreak: 'break-word' }}>
                  {displayValue(profile[field.key])}
                </Typography>
              )}
            </Box>
          ))}
        </Paper>
      ) : !loading && !error ? (
        <Typography variant="body2" color="text.secondary">
          No profile data available.
        </Typography>
      ) : null}
    </Box>
  )
}

export default ProfilePage
