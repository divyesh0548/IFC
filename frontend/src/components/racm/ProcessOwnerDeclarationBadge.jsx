import React, { useState } from 'react'
import Badge from '@mui/material/Badge'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import Typography from '@mui/material/Typography'

function ProcessOwnerDeclarationBadge({ declaration, formattedTimestamp = '-', containerSx }) {
  const [open, setOpen] = useState(false)

  if (!declaration?.no_furthure_submission) {
    return null
  }

  return (
    <>
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', width: '100%', ...containerSx }}>
        <Badge
          color="error"
          variant="dot"
          overlap="rectangular"
          anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
          sx={{
            '& .MuiBadge-badge': {
              top: 0,
              right: 0,
              transform: 'translate(50%, -50%)',
            },
          }}
        >
          <Button
            variant="outlined"
            color="inherit"
            onClick={() => setOpen(true)}
            sx={{
              textTransform: 'none',
              fontWeight: 600,
              borderRadius: 2,
              px: 1.75,
              py: 0.625,
              minHeight: 32,
              boxShadow: 'none',
              whiteSpace: 'nowrap',
              borderColor: 'divider',
              color: 'text.primary',
              backgroundColor: 'transparent',
              '&:hover': {
                boxShadow: 'none',
                borderColor: 'divider',
                backgroundColor: 'action.hover',
              },
            }}
          >
            No Submission Declaration
          </Button>
        </Badge>
      </Box>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle sx={{ px: 3, py: 2 }}>No Submission Declaration</DialogTitle>
        <DialogContent>
          <Typography
            variant="caption"
            sx={{
              display: 'block',
              color: 'text.secondary',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              mt: 2,
              mb: 0.75,
            }}
          >
            Declared By
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.primary', lineHeight: 1.6, mb: 2 }}>
            {String(declaration?.declared_by || declaration?.process_owner_email || '-').trim() || '-'}
          </Typography>
          <Typography
            variant="caption"
            sx={{
              display: 'block',
              color: 'text.secondary',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              mb: 0.75,
            }}
          >
            Timestamp
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.primary', lineHeight: 1.6, mb: 2 }}>
            {formattedTimestamp}
          </Typography>
          <Typography
            variant="caption"
            sx={{
              display: 'block',
              color: 'text.secondary',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              mb: 0.75,
            }}
          >
            Comment
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.primary', whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>
            {String(declaration?.owner_comment || '').trim()}
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2, mt: 0 }}>
          <Button onClick={() => setOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </>
  )
}

export default ProcessOwnerDeclarationBadge
