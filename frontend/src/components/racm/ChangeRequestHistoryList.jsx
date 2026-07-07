import React, { useState } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import {
  formatChangeRequestOutcome,
  formatChangeRequestDisplayValue,
  getChangeRequestOutcomeSx,
} from '../../lib/changeRequestHistory'

function DetailRow({ label, children }) {
  return (
    <Typography variant="body2" sx={{ color: 'text.primary' }}>
      <Box component="span" sx={{ fontWeight: 700 }}>
        {label}
      </Box>
      {children}
    </Typography>
  )
}

function ChangeRequestHistoryList({ requests, formatDateTime, formatNameWithEmail }) {
  const [expandedRequestIds, setExpandedRequestIds] = useState({})

  const handleToggleRequest = (requestId) => {
    setExpandedRequestIds((prev) => ({
      ...prev,
      [requestId]: !prev[requestId],
    }))
  }

  if (!Array.isArray(requests) || requests.length === 0) {
    return (
      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
        No change request history found.
      </Typography>
    )
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {requests.map((request) => {
        const isExpanded = Boolean(expandedRequestIds[request.request_id])
        const outcome = formatChangeRequestOutcome(request.status)
        const items = Array.isArray(request.items) ? request.items : []

        return (
          <Box
            key={request.request_id}
            sx={{
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 2,
              overflow: 'hidden',
              backgroundColor: 'background.paper',
            }}
          >
            <Button
              fullWidth
              onClick={() => handleToggleRequest(request.request_id)}
              sx={{
                justifyContent: 'space-between',
                textTransform: 'none',
                px: 2,
                py: 1.75,
                color: 'text.primary',
                borderRadius: 0,
                '&:hover': {
                  backgroundColor: 'action.hover',
                },
              }}
            >
              <Box sx={{ textAlign: 'left' }}>
                <Typography variant="body2" sx={{ color: 'text.primary' }}>
                  <Box component="span" sx={{ fontWeight: 700 }}>
                    Request ID:{' '}
                  </Box>
                  {request.request_id}
                </Typography>
                <Typography variant="body2" sx={{ mt: 0.5, color: 'text.primary' }}>
                  <Box component="span" sx={{ fontWeight: 700 }}>
                    Outcome:{' '}
                  </Box>
                  <Box component="span" sx={getChangeRequestOutcomeSx(request.status)}>
                    {outcome}
                  </Box>
                </Typography>
              </Box>
              <Typography variant="body2" sx={{ color: 'text.secondary', flexShrink: 0, ml: 2, fontWeight: 600 }}>
                {isExpanded ? 'Hide' : 'View'}
              </Typography>
            </Button>

            {isExpanded ? (
              <Box
                sx={{
                  px: 2,
                  pb: 2,
                  pt: 2,
                  borderTop: '1px solid',
                  borderColor: 'divider',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 2,
                }}
              >
                <Box
                  sx={{
                    mt: 0.5,
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: 1.5,
                    p: 1.75,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 0.75,
                    backgroundColor: 'action.hover',
                  }}
                >
                  <DetailRow label="Requested by: ">
                    {formatNameWithEmail(request.requested_by_display, request.requested_by_email)}
                  </DetailRow>
                  <DetailRow label="Requested on: ">
                    {request.requested_at ? formatDateTime(request.requested_at) : '-'}
                  </DetailRow>
                  <DetailRow label="Reviewed by: ">
                    {formatNameWithEmail(request.reviewed_by_display, request.reviewed_by_email)}
                  </DetailRow>
                  <DetailRow label="Reviewed on: ">
                    {request.reviewed_at ? formatDateTime(request.reviewed_at) : '-'}
                  </DetailRow>
                </Box>

                {String(request.request_reason || '').trim() ? (
                  <Box
                    sx={{
                      border: '1px solid',
                      borderColor: 'divider',
                      borderRadius: 1.5,
                      p: 1.75,
                    }}
                  >
                    <Typography sx={{ fontWeight: 700, color: 'text.primary', mb: 0.75 }}>
                      Reason for Change
                    </Typography>
                    <Typography variant="body2" sx={{ color: 'text.primary', whiteSpace: 'pre-wrap' }}>
                      {request.request_reason}
                    </Typography>
                  </Box>
                ) : null}

                {items.length > 0 ? (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                    <Typography sx={{ fontWeight: 700, color: 'text.primary' }}>
                      Field Changes
                    </Typography>
                    {items.map((item) => (
                      <Box
                        key={item.id}
                        sx={{
                          border: '1px solid',
                          borderColor: 'divider',
                          borderRadius: 1.5,
                          p: 1.75,
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 1.25,
                        }}
                      >
                        <Typography sx={{ fontWeight: 700, color: 'text.primary' }}>
                          {item.field_label || item.field_db_name}
                        </Typography>
                        <Box
                          sx={{
                            display: 'grid',
                            gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
                            gap: 1.5,
                          }}
                        >
                          <Box>
                            <Typography variant="body2" sx={{ fontWeight: 700, color: 'text.primary', mb: 0.5 }}>
                              Old Value
                            </Typography>
                            <Typography variant="body2" sx={{ color: 'text.primary', whiteSpace: 'pre-wrap' }}>
                              {formatChangeRequestDisplayValue(item.field_db_name, item.old_value_text)}
                            </Typography>
                          </Box>
                          <Box>
                            <Typography variant="body2" sx={{ fontWeight: 700, color: 'text.primary', mb: 0.5 }}>
                              New Value
                            </Typography>
                            <Typography variant="body2" sx={{ color: 'text.primary', whiteSpace: 'pre-wrap' }}>
                              {formatChangeRequestDisplayValue(item.field_db_name, item.new_value_text)}
                            </Typography>
                          </Box>
                        </Box>
                        <DetailRow label="Status: ">
                          {String(item.status || '').trim() || '-'}
                        </DetailRow>
                        {String(item.rejection_reason || '').trim() ? (
                          <Box
                            sx={{
                              border: '1px solid',
                              borderColor: 'divider',
                              borderRadius: 1,
                              p: 1.25,
                            }}
                          >
                            <Typography variant="body2" sx={{ fontWeight: 700, color: 'text.primary', mb: 0.5 }}>
                              Rejection Reason
                            </Typography>
                            <Typography variant="body2" sx={{ color: 'text.primary', whiteSpace: 'pre-wrap' }}>
                              {item.rejection_reason}
                            </Typography>
                          </Box>
                        ) : null}
                      </Box>
                    ))}
                  </Box>
                ) : null}
              </Box>
            ) : null}
          </Box>
        )
      })}
    </Box>
  )
}

export default ChangeRequestHistoryList
