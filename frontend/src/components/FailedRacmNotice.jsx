import Alert from '@mui/material/Alert'

export default function FailedRacmNotice({ failed }) {
  return failed ? (
    <Alert severity="error" sx={{ mb: 2 }}>
      Failed: no submission or declaration was received within the grace period after the final reminder.
      This RACM is read-only. Late submission and reopening are not available.
    </Alert>
  ) : null
}
