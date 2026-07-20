import React, { useState } from 'react'
import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogContentText from '@mui/material/DialogContentText'
import DialogTitle from '@mui/material/DialogTitle'
import TextField from '@mui/material/TextField'
import { toast } from 'react-hot-toast'
import { API_BASE_URL } from '../../config/api'
import { useSyncGlobalLoading } from '../../contexts/GlobalLoadingContext'

export function ProcessOwnerDeclarationAction({
  canDeclare = false,
  formId,
  onDeclared,
  buttonSx,
}) {
  const [open, setOpen] = useState(false)
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useSyncGlobalLoading(submitting)

  if (!canDeclare) {
    return null
  }

  const handleClose = () => {
    if (submitting) return
    setOpen(false)
  }

  const handleSubmit = async () => {
    const trimmedComment = String(comment || '').trim()

    if (!trimmedComment) {
      toast.error('Comment is required')
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
      })
      setOpen(false)
      setComment('')
      toast.success('No further submission declared successfully')
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
        Declare No Submission
      </Button>

      <Dialog
        open={open}
        onClose={handleClose}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle sx={{ fontWeight: 700 }}>Declare No Further Submission</DialogTitle>
        <DialogContent sx={{ px: 3, pt: 3, pb: 3 }}>
          <DialogContentText sx={{ my: 2, color: 'text.secondary' }}>
            This is an irreversible action. It will close the control approval cycle. Choose this option only if you do not have furthure submission or mitigation plan.
          </DialogContentText>
          <TextField
            label="Comment"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            fullWidth
            multiline
            rows={4}
            required
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
