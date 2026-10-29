import React, { useState } from 'react'
import Button from '@mui/material/Button'
import Checkbox from '@mui/material/Checkbox'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogContentText from '@mui/material/DialogContentText'
import Box from '@mui/material/Box'
import DialogTitle from '@mui/material/DialogTitle'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import { toast } from 'react-hot-toast'
import { API_BASE_URL } from '../../config/api'
import { useSyncGlobalLoading } from '../../contexts/GlobalLoadingContext'

export function ProcessOwnerDeclarationAction({
  canDeclare = false,
  formId,
  onDeclared,
  buttonSx,
  declarationType = 'no_further_submission',
  buttonLabel = 'Declare No Submission',
  dialogTitle = 'Declare No Further Submission',
  dialogText = 'This sends the control to the approver. The control cycle closes after the approver records a conclusion.',
  tickLabel = 'I declare that further submission is not possible for this control.',
}) {
  const [open, setOpen] = useState(false)
  const [comment, setComment] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  useSyncGlobalLoading(submitting)

  if (!canDeclare) {
    return null
  }

  const handleClose = () => {
    if (submitting) return
    setOpen(false)
    setConfirmed(false)
  }

  const handleSubmit = async () => {
    const trimmedComment = String(comment || '').trim()

    if (!confirmed) {
      toast.error('Confirm the declaration before submitting')
      return
    }

    setSubmitting(true)

    try {
      const response = await fetch(`${API_BASE_URL}/api/control-forms/${formId}/process-owner-declaration`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          no_furthure_submission: true,
          declaration_type: declarationType,
          declaration_confirmed: true,
          owner_comment: trimmedComment,
        }),
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        toast.error(data.message || 'Failed to declare no further submission')
        return
      }

      onDeclared?.({
        processOwnerDeclaration: data.data?.process_owner_declaration || null,
        deficiencyActionStatus: data.data?.deficiency_action_status,
        status: data.data?.status || 'sent for approval',
      })
      setOpen(false)
      setComment('')
      setConfirmed(false)
      toast.success(data.message || 'Declaration sent for approval')
    } catch (error) {
      console.error('Error declaring no further submission:', error)
      toast.error('Failed to declare no further submission')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        variant="contained"
        sx={[
          { textTransform: 'none', fontWeight: 600, whiteSpace: 'nowrap' },
          ...(Array.isArray(buttonSx) ? buttonSx : [buttonSx]),
        ]}
      >
        {buttonLabel}
      </Button>

      <Dialog
        open={open}
        onClose={handleClose}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle sx={{ fontWeight: 700 }}>{dialogTitle}</DialogTitle>
        <DialogContent sx={{ px: 3, pb: 3 }}>
          <DialogContentText sx={{ mb: 2, color: 'text.secondary' }}>
            {dialogText}
          </DialogContentText>
          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, mb: 2 }}>
            <Checkbox
              checked={confirmed}
              onChange={(event) => setConfirmed(event.target.checked)}
              sx={{ p: 0, mt: '2px', flexShrink: 0 }}
            />
            <Typography variant="body2" sx={{ lineHeight: 1.5, color: 'text.primary' }}>
              {tickLabel}
            </Typography>
          </Box>
          <TextField
            label="Comment (optional)"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            fullWidth
            multiline
            rows={4}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3, gap: 1.5, borderTop: '1px solid', borderColor: 'divider' }}>
          <Button onClick={handleClose} disabled={submitting}>
            Cancel
          </Button>
          <Button variant="contained" color="error" onClick={handleSubmit} disabled={submitting}>
            {submitting ? 'Declaring...' : 'Confirm'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}

export default ProcessOwnerDeclarationAction
