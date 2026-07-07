import React, { useState } from 'react'
import { alpha, useTheme } from '@mui/material/styles'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import TextField from '@mui/material/TextField'
import MenuItem from '@mui/material/MenuItem'
import HelpOutlineRoundedIcon from '@mui/icons-material/HelpOutlineRounded'
import { toast } from 'react-hot-toast'
import { apiUrl } from '../../config/api'
import { useSyncGlobalLoading } from '../../contexts/GlobalLoadingContext'

const QUERY_TYPE_OPTIONS = [
  { value: 'Website Issue', label: 'Website Issue' },
  { value: 'Suggestion', label: 'Suggestion' },
]

function HomeHelpSupport({ disabled = false }) {
  const theme = useTheme()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [typeOfQuery, setTypeOfQuery] = useState('Website Issue')
  const [explanation, setExplanation] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useSyncGlobalLoading(submitting)

  const handleOpen = () => {
    setTypeOfQuery('Website Issue')
    setExplanation('')
    setDialogOpen(true)
  }

  const handleClose = () => {
    if (submitting) return
    setDialogOpen(false)
  }

  const handleSubmit = async () => {
    const trimmedExplanation = String(explanation || '').trim()
    if (!trimmedExplanation) {
      toast.error('Please describe your issue or suggestion')
      return
    }

    setSubmitting(true)
    try {
      const response = await fetch(apiUrl('/api/user-queries'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          type_of_query: typeOfQuery,
          explanation: trimmedExplanation,
        }),
      })
      const data = await response.json()

      if (response.ok && data.success) {
        toast.success(data.message || 'Your query has been submitted successfully')
        setDialogOpen(false)
        setExplanation('')
      } else {
        toast.error(data.message || 'Failed to submit your query')
      }
    } catch (error) {
      console.error('Submit user query error:', error)
      toast.error('Failed to submit your query')
    } finally {
      setSubmitting(false)
    }
  }

  if (disabled) return null

  return (
    <>
      <Box
        sx={{
          position: 'absolute',
          left: { xs: 16, sm: 24, md: 28 },
          bottom: { xs: 16, sm: 20, md: 24 },
          zIndex: 2,
        }}
      >
        <Button
          onClick={handleOpen}
          variant="outlined"
          size="small"
          startIcon={<HelpOutlineRoundedIcon />}
          sx={{
            textTransform: 'none',
            fontWeight: 700,
            borderRadius: 999,
            borderColor: alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.35 : 0.28),
            color: theme.palette.primary.main,
            backgroundColor: alpha(theme.palette.background.paper, theme.palette.mode === 'dark' ? 0.72 : 0.9),
            boxShadow: theme.palette.mode === 'dark'
              ? '0 8px 20px rgba(0, 0, 0, 0.24)'
              : '0 8px 20px rgba(15, 23, 42, 0.08)',
            '&:hover': {
              borderColor: theme.palette.primary.main,
              backgroundColor: alpha(theme.palette.background.paper, theme.palette.mode === 'dark' ? 0.88 : 1),
            },
          }}
        >
          Help
        </Button>
      </Box>

      <Dialog open={dialogOpen} onClose={handleClose} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ fontWeight: 800 }}>Submit a Query</DialogTitle>
        <DialogContent dividers sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
          <TextField
            select
            label="Type of Query"
            value={typeOfQuery}
            onChange={(event) => setTypeOfQuery(event.target.value)}
            fullWidth
          >
            {QUERY_TYPE_OPTIONS.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label="Describe your issue or suggestion"
            value={explanation}
            onChange={(event) => setExplanation(event.target.value)}
            fullWidth
            multiline
            minRows={5}
            placeholder="Please share as much detail as possible."
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={handleClose} disabled={submitting} sx={{ textTransform: 'none' }}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            variant="contained"
            color="secondary"
            disabled={submitting}
            sx={{ textTransform: 'none', fontWeight: 700 }}
          >
            {submitting ? 'Submitting...' : 'Submit'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}

export default HomeHelpSupport
