import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogContentText from '@mui/material/DialogContentText'
import DialogTitle from '@mui/material/DialogTitle'
import TextField from '@mui/material/TextField'

function SaveColumnMappingDialog({
  open,
  name,
  error,
  submitting,
  overwrite,
  onNameChange,
  onSave,
  onDismiss,
}) {
  return (
    <Dialog
      open={open}
      disableEscapeKeyDown
      onClose={(_event, reason) => {
        if (reason === 'backdropClick' || reason === 'escapeKeyDown') return
      }}
      fullWidth
      maxWidth="sm"
      aria-labelledby="save-column-mapping-title"
      slotProps={{
        backdrop: {
          sx: {
            backgroundColor: 'rgba(0, 0, 0, 0.82)',
          },
        },
      }}
      PaperProps={{
        sx: {
          boxShadow: '0 24px 64px rgba(0, 0, 0, 0.55)',
        },
      }}
    >
      <DialogTitle id="save-column-mapping-title">Save this column mapping</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <DialogContentText>
          The controls were imported. This mapping is not saved yet. Name it and save it so the next upload for this template can reuse it, or dismiss this window.
        </DialogContentText>
        <TextField
          autoFocus
          fullWidth
          label="Mapping name"
          value={name}
          onChange={(event) => onNameChange(event.target.value)}
          disabled={submitting}
          error={Boolean(error)}
          helperText={error || 'Use a clear name, e.g. P2P vendor export'}
        />
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
        <Button onClick={onDismiss} disabled={submitting} sx={{ textTransform: 'none' }}>
          Don&apos;t save
        </Button>
        {overwrite ? (
          <Button
            variant="contained"
            color="warning"
            disabled={submitting}
            onClick={() => onSave({ overwrite: true })}
            sx={{ textTransform: 'none' }}
          >
            {submitting ? 'Saving…' : 'Overwrite'}
          </Button>
        ) : (
          <Button
            variant="contained"
            disabled={submitting}
            onClick={() => onSave({ overwrite: false })}
            sx={{ textTransform: 'none' }}
          >
            {submitting ? 'Saving…' : 'Save'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  )
}

export default SaveColumnMappingDialog
