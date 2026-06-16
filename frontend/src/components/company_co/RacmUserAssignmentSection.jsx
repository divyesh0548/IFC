import React, { useEffect, useState } from 'react'
import { useTheme } from '@mui/material/styles'
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import PersonOutlineRoundedIcon from '@mui/icons-material/PersonOutlineRounded'
import LabeledUnitUserSearchField from './LabeledUnitUserSearchField'

function emailToUserOption(email) {
  const trimmedEmail = String(email || '').trim()
  if (!trimmedEmail) return null
  return { email_id: trimmedEmail, emp_name: '' }
}

function RacmUserAssignmentSection({
  unitId,
  controlOwner = '',
  controlPerformer = '',
  onControlOwnerChange,
  onControlPerformerChange,
  disabled = false,
  loading = false,
}) {
  const theme = useTheme()
  const fieldDisabled = disabled || loading || !unitId
  const [ownerUser, setOwnerUser] = useState(() => emailToUserOption(controlOwner))
  const [performerUser, setPerformerUser] = useState(() => emailToUserOption(controlPerformer))

  useEffect(() => {
    setOwnerUser((current) => {
      const nextEmail = String(controlOwner || '').trim().toLowerCase()
      const currentEmail = String(current?.email_id || '').trim().toLowerCase()
      if (!nextEmail) return null
      if (currentEmail === nextEmail) return current
      return emailToUserOption(controlOwner)
    })
  }, [controlOwner])

  useEffect(() => {
    setPerformerUser((current) => {
      const nextEmail = String(controlPerformer || '').trim().toLowerCase()
      const currentEmail = String(current?.email_id || '').trim().toLowerCase()
      if (!nextEmail) return null
      if (currentEmail === nextEmail) return current
      return emailToUserOption(controlPerformer)
    })
  }, [controlPerformer])

  return (
    <Paper
      elevation={0}
      sx={{
        p: { xs: 2, sm: 2.2 },
        mb: 3,
        borderRadius: 2,
        border: '1px solid',
        borderColor:
          theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.07)' : theme.palette.divider,
        backgroundColor:
          theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.025)' : '#f8fafc',
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.1,
          mb: 1.8,
        }}
      >
        <PersonOutlineRoundedIcon sx={{ fontSize: 20, color: theme.palette.text.secondary }} />
        <Typography sx={{ fontSize: '1rem', fontWeight: 800, color: theme.palette.text.primary }}>
          Process Owner &amp; Control Performer
        </Typography>
      </Box>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' },
          gap: 2,
        }}
      >
        <LabeledUnitUserSearchField
          label="Process Owner"
          id="control_owner"
          unitId={unitId}
          value={ownerUser}
          onChange={(user) => {
            setOwnerUser(user)
            onControlOwnerChange?.(user?.email_id?.trim() || '')
          }}
          prefetch={Boolean(unitId)}
          inDialog={false}
          disabled={fieldDisabled}
        />

        <LabeledUnitUserSearchField
          label="Control Performer"
          id="control_performer"
          unitId={unitId}
          value={performerUser}
          onChange={(user) => {
            setPerformerUser(user)
            onControlPerformerChange?.(user?.email_id?.trim() || '')
          }}
          prefetch={Boolean(unitId)}
          inDialog={false}
          disabled={fieldDisabled}
        />
      </Box>
    </Paper>
  )
}

export default RacmUserAssignmentSection
