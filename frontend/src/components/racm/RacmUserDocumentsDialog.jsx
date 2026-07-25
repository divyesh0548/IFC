import React from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded'
import InsertDriveFileRoundedIcon from '@mui/icons-material/InsertDriveFileRounded'
import { formatIndianDateTime } from '../../lib/dateTime'
import { formatRacmUserDocumentSubtitle, normalizeRacmUserDocuments } from '../../lib/racmUserDocuments'

function getFileName(filePath) {
  const raw = String(filePath || '').trim()
  if (!raw) return 'Document'
  const withoutQuery = raw.split('?')[0]
  const segments = withoutQuery.split('/')
  return segments[segments.length - 1] || 'Document'
}

function RacmUserDocumentsDialog({ form, onClose, onDownload, formatProcessOwner }) {
  const docs = normalizeRacmUserDocuments(form?.doc_uploaded_by_user_docs, form?.doc_uploaded_by_user)
  const open = Boolean(form)

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md" aria-labelledby="racm-user-documents-dialog-title">
      <DialogTitle id="racm-user-documents-dialog-title" sx={{ fontWeight: 700 }}>
        User Documents ({docs.length})
      </DialogTitle>
      <DialogContent dividers>
        {form ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mb: 2 }}>
            <Typography variant="body2" color="text.secondary">
              <strong>Control Number:</strong> {form.control_number || form.form_id || 'N/A'}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              <strong>Business Process:</strong> {form.business_process || 'N/A'}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              <strong>Process Owner:</strong> {formatProcessOwner?.(form) || form.control_owner_name || form.control_owner || 'N/A'}
            </Typography>
          </Box>
        ) : null}

        {docs.length > 0 ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
            {docs.map((doc, index) => {
              const filePath = doc.doc_uploaded_by_user
              return (
                <Box
                  key={doc.id || `${filePath}-${index}`}
                  sx={{ display: 'flex', alignItems: 'center', gap: 1.5, p: 1.5, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}
                >
                  <InsertDriveFileRoundedIcon color="action" />
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.primary', overflowWrap: 'anywhere' }}>
                      {getFileName(filePath)}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {formatRacmUserDocumentSubtitle(doc, (value) => formatIndianDateTime(value, 'Uploaded document'))}
                    </Typography>
                  </Box>
                  <Tooltip title="Download">
                    <IconButton size="small" onClick={() => onDownload?.(filePath)} aria-label={`Download ${getFileName(filePath)}`}>
                      <DownloadRoundedIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Box>
              )
            })}
          </Box>
        ) : (
          <Typography variant="body2" color="text.secondary">No user uploaded documents available.</Typography>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  )
}

export default RacmUserDocumentsDialog
