import React from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import { useTheme } from '@mui/material/styles'
import AppDialog, { getAppDialogCancelButtonSx } from '../AppDialog'

const COMPANY_ADMIN_SECTIONS = [
  {
    title: 'Unit',
    body: 'The approver is responsible for all RACMs in the selected unit.',
  },
  {
    title: 'Unit + Business Process',
    body: 'The approver is responsible for all RACMs under a specific business process within a unit.',
  },
  {
    title: 'RACM-specific assignment',
    body: 'Available on the coordinator site only. Coordinators can assign an approver to individual RACMs.',
  },
  {
    title: 'Overlapping assignments (precedence)',
    body: 'When assignment scopes overlap, the more specific scope takes precedence. If an approver is assigned to a whole unit and another approver is assigned to a business process within that unit, the unit-level approver loses responsibility for RACMs in that business process. RACM-specific assignments (coordinator only) take precedence over both unit-level and business-process-level assignments for those RACMs.',
  },
]

const COORDINATOR_SECTIONS = [
  {
    title: 'RACM-specific assignment',
    body: 'Assign an approver to one or more individual RACMs. This is the primary assignment type available to coordinators on this page.',
  },
  {
    title: 'Unit and business process assignments',
    body: 'Company admins can assign approvers at unit level or unit + business process level from Approver Management. Those broader assignments still apply unless a more specific assignment exists.',
  },
  {
    title: 'Overlapping assignments (precedence)',
    body: 'RACM-specific assignment has the highest precedence. When you assign an approver to specific RACMs, that approver takes over those RACMs even if another approver was already assigned at unit or business process level for the same scope. The broader assignment continues to apply only to RACMs that do not have a more specific override.',
  },
]

function ApproverAssignmentHelpDialog({ open, onClose, variant = 'company_admin' }) {
  const theme = useTheme()
  const sections = variant === 'coordinator' ? COORDINATOR_SECTIONS : COMPANY_ADMIN_SECTIONS
  const title = variant === 'coordinator' ? 'How Approver Assignment Works' : 'How Approver Assignment Works'

  return (
    <AppDialog
      open={open}
      onClose={onClose}
      title={title}
      titleId="approver-assignment-help-dialog-title"
      fullWidth
      maxWidth="sm"
      showTitleDivider
      contentSx={{ py: 2 }}
      actions={(
        <Button onClick={onClose} variant="outlined" sx={getAppDialogCancelButtonSx(theme)}>
          Close
        </Button>
      )}
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {sections.map((section) => (
          <Box key={section.title}>
            <Typography sx={{ fontWeight: 700, mb: 0.5 }}>{section.title}</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.65 }}>
              {section.body}
            </Typography>
          </Box>
        ))}
      </Box>
    </AppDialog>
  )
}

export default ApproverAssignmentHelpDialog
