import React from 'react'
import { useTheme } from '@mui/material/styles'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import Typography from '@mui/material/Typography'
import Alert from '@mui/material/Alert'
import Tooltip from '@mui/material/Tooltip'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import CircularProgress from '@mui/material/CircularProgress'

/** True if string is an ISO instant (JSON often adds Z = UTC while DB stored IST wall clock). */
function isUtcOrOffsetIsoString(str) {
  const s = str.trim()
  return /Z$/i.test(s) || /[+-]\d{2}:\d{2}$/.test(s) || /[+-]\d{4}$/.test(s)
}

/** Audit DB timestamps are Indian time; API may send UTC (…Z). Always show Asia/Kolkata. */
export function formatRacmAuditDateDisplay(value) {
  if (value == null || value === '') return '—'

  const formatInstantInKolkata = (d) => {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(d)
    const get = (t) => parts.find((p) => p.type === t)?.value ?? ''
    return `${get('day')}/${get('month')}/${get('year')} ${get('hour')}:${get('minute')}`
  }

  if (typeof value === 'string') {
    const str = value.trim()
    if (str) {
      if (isUtcOrOffsetIsoString(str)) {
        const d = new Date(str)
        if (!Number.isNaN(d.getTime())) return formatInstantInKolkata(d)
        return '—'
      }
      const withTime = str.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/)
      if (withTime) {
        return `${withTime[3]}/${withTime[2]}/${withTime[1]} ${withTime[4]}:${withTime[5]}`
      }
      const dateOnly = str.match(/^(\d{4})-(\d{2})-(\d{2})$/)
      if (dateOnly) {
        return `${dateOnly[3]}/${dateOnly[2]}/${dateOnly[1]} 00:00`
      }
    }
  }

  const d = value instanceof Date ? value : new Date(value)
  if (!Number.isNaN(d.getTime())) return formatInstantInKolkata(d)
  return '—'
}

const RACM_MODIFICATION_ACTION = 'RACM Modification'

function racmModDisplayValue(v) {
  if (v == null || v === '') return '—'
  return String(v)
}

function parseRacmModificationRef(refData) {
  const str = typeof refData === 'string' ? refData : String(refData)
  const trimmed = str.trim()
  if (!trimmed.startsWith('[')) {
    return {
      preview: str.length > 88 ? `${str.slice(0, 88)}…` : str,
      entries: null,
      fallbackText: str,
    }
  }
  try {
    const parsed = JSON.parse(trimmed)
    if (Array.isArray(parsed) && parsed.length > 0) {
      const c = parsed[0]
      const name = c.column_name != null ? String(c.column_name) : 'field'
      const ov = c.old_value != null ? String(c.old_value) : '—'
      const nv = c.new_value != null ? String(c.new_value) : '—'
      let preview = `${name}: ${ov} → ${nv}`
      const extra = parsed.length - 1
      if (extra > 0) {
        preview += ` (+${extra} more ${extra === 1 ? 'change' : 'changes'})`
      }
      return { preview, entries: parsed, fallbackText: null }
    }
    return {
      preview: trimmed.length > 88 ? `${trimmed.slice(0, 88)}…` : trimmed,
      entries: null,
      fallbackText: trimmed,
    }
  } catch {
    return {
      preview: str.length > 88 ? `${str.slice(0, 88)}…` : str,
      entries: null,
      fallbackText: str,
    }
  }
}

function RacmModificationTooltipContent({ entries, fallbackText }) {
  if (entries && entries.length > 0) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.75, py: 0.25 }}>
        {entries.map((c, i) => (
          <Box
            key={i}
            sx={{
              pb: 1.5,
              borderBottom: '1px solid',
              borderColor: 'divider',
              '&:last-of-type': { borderBottom: 'none', pb: 0 },
            }}
          >
            <Typography variant="subtitle2" sx={{ fontWeight: 700, fontSize: '0.8125rem', mb: 0.75, lineHeight: 1.35 }}>
              {racmModDisplayValue(c.column_name)}
            </Typography>
            <Typography
              variant="body2"
              sx={{
                color: 'text.primary',
                fontWeight: 600,
                fontSize: '0.8125rem',
                mb: 0.35,
                lineHeight: 1.45,
              }}
            >
              New value → {racmModDisplayValue(c.new_value)}
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary', fontWeight: 400, fontSize: '0.75rem', lineHeight: 1.45 }}>
              Old value → {racmModDisplayValue(c.old_value)}
            </Typography>
          </Box>
        ))}
      </Box>
    )
  }
  return (
    <Typography variant="body2" sx={{ fontSize: '0.75rem', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
      {fallbackText || '—'}
    </Typography>
  )
}

function AuditLogReferenceCell({ action, refData }) {
  const theme = useTheme()
  if (refData == null || refData === '') {
    return (
      <Typography component="span" variant="body2" color="text.secondary" sx={{ fontSize: '0.8125rem' }}>
        —
      </Typography>
    )
  }

  const raw = String(refData)
  const isMod = action === RACM_MODIFICATION_ACTION

  const tooltipPaperSx = {
    maxWidth: { xs: 'min(92vw, 520px)', sm: 520 },
    maxHeight: 420,
    overflow: 'auto',
    bgcolor: theme.palette.mode === 'dark' ? theme.palette.grey[900] : theme.palette.grey[50],
    color: theme.palette.text.primary,
    border: 1,
    borderColor: 'divider',
    p: 1.5,
  }

  if (isMod) {
    const { preview, entries, fallbackText } = parseRacmModificationRef(refData)
    return (
      <Tooltip
        title={<RacmModificationTooltipContent entries={entries} fallbackText={fallbackText} />}
        placement="left-start"
        enterDelay={280}
        leaveDelay={120}
        slotProps={{ tooltip: { sx: tooltipPaperSx } }}
      >
        <Typography
          component="span"
          variant="body2"
          sx={{
            color: 'text.secondary',
            fontSize: '0.8125rem',
            cursor: 'help',
            display: 'block',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {preview}
        </Typography>
      </Tooltip>
    )
  }

  if (raw.length <= 88) {
    return (
      <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.8125rem', wordBreak: 'break-word' }}>
        {raw}
      </Typography>
    )
  }

  return (
    <Tooltip
      title={<Box sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: '0.75rem' }}>{raw}</Box>}
      placement="left-start"
      enterDelay={280}
      leaveDelay={120}
      slotProps={{ tooltip: { sx: tooltipPaperSx } }}
    >
      <Typography
        component="span"
        variant="body2"
        sx={{
          color: 'text.secondary',
          fontSize: '0.8125rem',
          cursor: 'help',
          display: 'block',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {`${raw.slice(0, 88)}…`}
      </Typography>
    </Tooltip>
  )
}

/**
 * RACM audit_logs_racm table viewer (shared by approver and company coordinator form detail).
 */
export function RacmAuditLogsDialog({ open, onClose, loading, error, rows }) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="lg"
      aria-labelledby="racm-audit-logs-title"
      PaperProps={{
        sx: {
          borderRadius: 2,
          maxHeight: '90vh',
        },
      }}
    >
      <DialogTitle
        id="racm-audit-logs-title"
        sx={{
          pb: 1,
          pt: 2.5,
          px: 3,
          fontWeight: 600,
          fontSize: '1.1rem',
        }}
      >
        Audit logs
      </DialogTitle>
      <DialogContent sx={{ px: 3, pt: 0, pb: 2, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress size={32} />
          </Box>
        ) : error ? (
          <Alert severity="error" sx={{ mb: 1 }}>
            {error}
          </Alert>
        ) : rows.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
            No audit entries for this RACM.
          </Typography>
        ) : (
          <TableContainer
            sx={{
              maxHeight: 'min(420px, 58vh)',
              overflow: 'auto',
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 1,
            }}
          >
            <Table size="small" stickyHeader sx={{ tableLayout: 'fixed', width: '100%' }}>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 600, width: '14%', whiteSpace: 'nowrap' }}>Date & time</TableCell>
                  <TableCell sx={{ fontWeight: 600, width: '28%' }}>User</TableCell>
                  <TableCell sx={{ fontWeight: 600, width: '26%' }}>Action</TableCell>
                  <TableCell sx={{ fontWeight: 600, width: '32%' }}>Reference</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id ?? `${row.timestamp}-${row.action}`}>
                    <TableCell sx={{ verticalAlign: 'top', whiteSpace: 'nowrap' }}>
                      {formatRacmAuditDateDisplay(row.timestamp)}
                    </TableCell>
                    <TableCell sx={{ verticalAlign: 'top', wordBreak: 'break-word' }}>
                      {row.user_email_id || '—'}
                    </TableCell>
                    <TableCell sx={{ verticalAlign: 'top', wordBreak: 'break-word' }}>
                      {row.action ?? '—'}
                    </TableCell>
                    <TableCell sx={{ verticalAlign: 'top', maxWidth: 0 }}>
                      <AuditLogReferenceCell action={row.action} refData={row.ref_data} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
        {!loading && rows.length > 0 ? (
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
            {rows.length} entr{rows.length === 1 ? 'y' : 'ies'} — newest at bottom. Scroll the table for long lists.
          </Typography>
        ) : null}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} variant="outlined" size="small" sx={{ textTransform: 'none' }}>
          Close
        </Button>
      </DialogActions>
    </Dialog>
  )
}
