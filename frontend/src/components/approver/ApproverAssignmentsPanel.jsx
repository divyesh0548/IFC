import React, { useEffect, useMemo, useState } from 'react'
import Box from '@mui/material/Box'
import Tab from '@mui/material/Tab'
import Tabs from '@mui/material/Tabs'
import Typography from '@mui/material/Typography'
import { alpha, useTheme } from '@mui/material/styles'
import { buildApproverAssignmentDisplayModel } from '../../utils/approverAssignmentDisplay'

export const APPROVER_ASSIGNMENTS_LIST_MAX_HEIGHT = 320

function assignmentCardSx(theme) {
  return {
    px: 1.5,
    py: 1.2,
    borderRadius: 2,
    border: '1px solid',
    borderColor: 'divider',
    backgroundColor: alpha(theme.palette.background.default, 0.35),
  }
}

function RacmUnitAssignmentList({ group }) {
  if (!group) return null

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
      {group.businessProcessGroups.map((bpGroup) => {
        const racmLabel = bpGroup.count === 1 ? 'RACM' : 'RACMs'
        return (
          <Typography
            key={`${group.unitId}-${bpGroup.businessProcess}`}
            variant="body2"
            color="text.secondary"
          >
            {bpGroup.businessProcess} ({bpGroup.count} {racmLabel})
          </Typography>
        )
      })}
    </Box>
  )
}

function ApproverAssignmentsPanel({
  assignments,
  scopeLabelStyle = 'default',
  emptyMessage = 'No assignments found for this approver.',
  listMaxHeight = APPROVER_ASSIGNMENTS_LIST_MAX_HEIGHT,
}) {
  const theme = useTheme()
  const [activeUnitTab, setActiveUnitTab] = useState(0)
  const { otherItems, racmUnitGroups, racmScopeLabel } = useMemo(
    () => buildApproverAssignmentDisplayModel(assignments, { scopeLabelStyle }),
    [assignments, scopeLabelStyle]
  )

  useEffect(() => {
    setActiveUnitTab(0)
  }, [assignments, racmUnitGroups.length])

  const hasContent = otherItems.length > 0 || racmUnitGroups.length > 0
  const cardSx = assignmentCardSx(theme)
  const activeUnitGroup = racmUnitGroups[activeUnitTab] || null

  if (!hasContent) {
    return <Typography color="text.secondary">{emptyMessage}</Typography>
  }

  return (
    <Box
      sx={{
        maxHeight: listMaxHeight,
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: 1,
        pr: 0.5,
      }}
    >
      {otherItems.map((item) => (
        <Box key={item.key} sx={cardSx}>
          <Typography sx={{ fontWeight: 700 }}>{item.scopeLabel}</Typography>
          <Typography variant="body2" color="text.secondary">
            {item.detail}
          </Typography>
        </Box>
      ))}

      {racmUnitGroups.length > 0 && (
        <Box sx={{ ...cardSx, display: 'flex', flexDirection: 'column', gap: 1.25 }}>
          <Typography sx={{ fontWeight: 700 }}>{racmScopeLabel}</Typography>

          {racmUnitGroups.length > 1 ? (
            <>
              <Tabs
                value={activeUnitTab}
                onChange={(_, value) => setActiveUnitTab(value)}
                variant="scrollable"
                scrollButtons="auto"
                sx={{
                  minHeight: 36,
                  borderBottom: `1px solid ${theme.palette.divider}`,
                  '& .MuiTab-root': {
                    minHeight: 36,
                    py: 0.5,
                    px: 1.5,
                    textTransform: 'none',
                    fontWeight: 600,
                  },
                }}
              >
                {racmUnitGroups.map((group) => (
                  <Tab
                    key={group.key}
                    label={`${group.unitName} (${group.totalCount})`}
                  />
                ))}
              </Tabs>
              <RacmUnitAssignmentList group={activeUnitGroup} />
            </>
          ) : (
            <>
              <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.secondary' }}>
                Unit: {racmUnitGroups[0].unitName}
              </Typography>
              <RacmUnitAssignmentList group={racmUnitGroups[0]} />
            </>
          )}
        </Box>
      )}
    </Box>
  )
}

export default ApproverAssignmentsPanel
