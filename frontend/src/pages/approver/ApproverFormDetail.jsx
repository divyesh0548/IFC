import React, { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { alpha, useTheme } from '@mui/material/styles'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Chip from '@mui/material/Chip'
import Divider from '@mui/material/Divider'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded'
import DescriptionRoundedIcon from '@mui/icons-material/DescriptionRounded'
import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded'
import FolderRoundedIcon from '@mui/icons-material/FolderRounded'
import InfoRoundedIcon from '@mui/icons-material/InfoRounded'
import * as XLSX from 'xlsx'
import { toast } from 'react-hot-toast'
import { FORM_DETAIL_MAX_WIDTH, getActivityBadgeSolidColors, getApprovalStatusBadgeSolidColors } from '../../uiConstants'
import { RACM_FIELD_LABELS, orderControlDetailKeys } from '../../racmFormDetailFields'
import { API_BASE_URL } from '../../config/api'
import { useSyncGlobalLoading } from '../../contexts/GlobalLoadingContext'

function formatDate(dateString) {
  if (!dateString) return 'N/A'
  const date = new Date(dateString)
  if (Number.isNaN(date.getTime())) return 'N/A'

  return date.toLocaleDateString('en-IN', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  })
}

function formatDateTime(dateString) {
  if (!dateString) return 'N/A'
  const date = new Date(dateString)
  if (Number.isNaN(date.getTime())) return 'N/A'

  return date.toLocaleString('en-IN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZone: 'Asia/Kolkata',
  })
}

function formatApprovalStatus(status) {
  const value = String(status || '').trim()

  if (!value || value.toLowerCase() === 'null' || value.toLowerCase() === 'sent for approval') {
    return 'Pending'
  }

  return value.charAt(0).toUpperCase() + value.slice(1)
}

function getIsActive(value) {
  return value != null && String(value).trim() !== '' && String(value).trim() !== '0'
}

function getFileName(filePath) {
  if (!filePath) return ''
  const parts = String(filePath).split(/[/\\]/)
  return parts[parts.length - 1] || String(filePath)
}

function DetailRow({ label, value, multiline = false }) {
  const theme = useTheme()

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', md: '220px minmax(0, 1fr)' },
        gap: { xs: 0.4, md: 2 },
        py: 1.2,
        borderBottom: `1px solid ${alpha(theme.palette.divider, 0.8)}`,
        '&:last-of-type': {
          borderBottom: 'none',
        },
      }}
    >
      <Typography sx={{ fontSize: '0.82rem', fontWeight: 800, color: theme.palette.text.secondary }}>
        {label}
      </Typography>
      <Typography
        sx={{
          fontSize: '0.95rem',
          fontWeight: 600,
          color: theme.palette.text.primary,
          whiteSpace: multiline ? 'pre-wrap' : 'normal',
          wordBreak: 'break-word',
          lineHeight: 1.7,
        }}
      >
        {value || 'N/A'}
      </Typography>
    </Box>
  )
}

function SectionCard({ title, subtitle, children, icon }) {
  const theme = useTheme()

  return (
    <Card
      sx={{
        borderRadius: 3,
        boxShadow: theme.palette.mode === 'dark'
          ? '0 4px 20px rgba(0, 0, 0, 0.3)'
          : '0 2px 12px rgba(0, 0, 0, 0.08)',
        border: '1px solid',
        borderColor: theme.palette.mode === 'dark'
          ? 'rgba(255, 255, 255, 0.12)'
          : 'rgba(0, 0, 0, 0.08)',
      }}
    >
      <CardContent sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.2, mb: 2.25 }}>
          <Box
            sx={{
              width: 40,
              height: 40,
              borderRadius: 2,
              display: 'grid',
              placeItems: 'center',
              color: theme.palette.primary.contrastText,
              background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
              flexShrink: 0,
            }}
          >
            {icon}
          </Box>
          <Box>
            <Typography sx={{ fontSize: '1.05rem', fontWeight: 800, color: theme.palette.text.primary }}>
              {title}
            </Typography>
            {subtitle ? (
              <Typography sx={{ mt: 0.35, fontSize: '0.86rem', color: theme.palette.text.secondary }}>
                {subtitle}
              </Typography>
            ) : null}
          </Box>
        </Box>
        {children}
      </CardContent>
    </Card>
  )
}

function ApproverFormDetail() {
  const theme = useTheme()
  const navigate = useNavigate()
  const { form_id } = useParams()
  const [formData, setFormData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useSyncGlobalLoading(loading)

  useEffect(() => {
    let cancelled = false

    const fetchFormData = async () => {
      setLoading(true)
      setError('')

      try {
        const response = await fetch(`${API_BASE_URL}/api/control-forms/${form_id}`, {
          method: 'GET',
          credentials: 'include',
        })
        const data = await response.json()

        if (cancelled) return

        if (response.ok && data.success) {
          setFormData(data.data)
        } else {
          setError(data.message || 'Failed to fetch RACM')
        }
      } catch (fetchError) {
        console.error('Approver form detail error:', fetchError)
        if (!cancelled) {
          setError('Error fetching RACM')
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    fetchFormData()

    return () => {
      cancelled = true
    }
  }, [form_id])

  const handleDownloadDocument = async (filePath, successMessage) => {
    if (!filePath) return

    try {
      const fileName = getFileName(filePath)
      const response = await fetch(`${API_BASE_URL}/api/control-forms/download-document?path=${encodeURIComponent(filePath)}`, {
        method: 'GET',
        credentials: 'include',
      })
      const contentType = response.headers.get('content-type') || ''

      if (response.ok && contentType.includes('application/octet-stream')) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const anchor = document.createElement('a')
        anchor.href = url
        anchor.download = fileName
        document.body.appendChild(anchor)
        anchor.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(anchor)
        toast.success(successMessage)
        return
      }

      let errorMessage = 'Failed to download document'
      try {
        const errorData = await response.json()
        errorMessage = errorData.message || errorData.error || errorMessage
      } catch {
        errorMessage = 'Failed to download document'
      }
      toast.error(errorMessage)
    } catch (downloadError) {
      console.error('Download error:', downloadError)
      toast.error('Error downloading document')
    }
  }

  const getSampleRequiredRows = (value) => {
    return String(value || '')
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean)
  }

  const handleDownloadSampleRequired = () => {
    const rows = getSampleRequiredRows(formData?.sample_required)

    if (rows.length === 0) {
      toast.error('No sample required data available')
      return
    }

    const worksheetRows = [
      ['Sample Required'],
      ...rows.map((row) => [row]),
    ]

    const worksheet = XLSX.utils.aoa_to_sheet(worksheetRows)
    worksheet['!cols'] = [{ wch: 36 }]

    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Sample Required')
    XLSX.writeFile(workbook, `sample_required_${String(form_id || 'racm').replace(/[^\w-]/g, '_')}.xlsx`)
  }

  const sampleDocs = Array.isArray(formData?.sample_docs) ? formData.sample_docs.filter((doc) => String(doc.sample_doc || '').trim() !== '') : []
  const uploadedDocs = Array.isArray(formData?.doc_uploaded_by_user_docs) ? formData.doc_uploaded_by_user_docs.filter((doc) => String(doc.doc_uploaded_by_user || '').trim() !== '') : []

  const overviewRows = [
    { label: 'Company', value: formData?.company_name },
    { label: 'Unit', value: formData?.unit_name },
    { label: 'Business Process', value: formData?.business_process },
    { label: 'Sub Process', value: formData?.sub_process },
    { label: 'Financial Year', value: formData?.financial_year },
    { label: 'Due Date', value: formatDate(formData?.due_date) },
    { label: 'Reminder Frequency', value: formData?.reminder_frequency },
    { label: 'Created At', value: formatDateTime(formData?.created_at) },
  ]

  const controlKeys = orderControlDetailKeys([
    'control_number',
    'area',
    'risk_heat',
    'risk_description',
    'standard_control_description',
    'control_objective',
    'whether_fraud_risks_exist',
    'process_walkthrough',
    'control_relies_on_ipe',
    'audit_evidence_accuracy',
    'ipe_reference',
    'key_control',
    'application_name',
    'control_performer',
    'control_owner',
    'control_type_fo',
    'control_type_ma',
    'nature_of_control',
    'control_frequency',
    'sample_size',
    'sample_required',
  ])

  const assertionKeys = [
    'completeness',
    'existence_occurrence',
    'rights_and_obligation',
    'valuation_and_allocation',
    'presentation_and_disclosure',
  ]

  const designKeys = [
    'control_design_procs',
    'control_design_conclusion',
    'design_deficiency_desc',
  ]

  const statusLabel = formatApprovalStatus(formData?.status)
  const statusColors = getApprovalStatusBadgeSolidColors(statusLabel)
  const activityColors = getActivityBadgeSolidColors(getIsActive(formData?.active))

  if (loading) {
    return (
      <Box sx={{ py: 6, textAlign: 'center' }}>
        <Typography color="text.secondary">Loading RACM...</Typography>
      </Box>
    )
  }

  if (error) {
    return (
      <Box sx={{ py: 4 }}>
        <Alert severity="error" sx={{ borderRadius: 2 }}>
          {error}
        </Alert>
      </Box>
    )
  }

  if (!formData) {
    return (
      <Box sx={{ py: 4 }}>
        <Alert severity="info" sx={{ borderRadius: 2 }}>
          RACM not found.
        </Alert>
      </Box>
    )
  }

  return (
    <Box
      sx={{
        width: '100%',
        maxWidth: FORM_DETAIL_MAX_WIDTH,
        mx: 'auto',
        px: 0,
        py: 0,
      }}
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        <Box
          sx={{
            display: 'flex',
            flexDirection: { xs: 'column', sm: 'row' },
            alignItems: { xs: 'flex-start', sm: 'center' },
            justifyContent: 'space-between',
            gap: 2,
          }}
        >
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 800, color: theme.palette.text.primary }}>
              RACM Detail
            </Typography>
            <Typography variant="body2" sx={{ mt: 0.75, color: theme.palette.text.secondary }}>
              Company coordinator style detail view with read-only access for approvers.
            </Typography>
          </Box>

          <Button
            onClick={() => navigate('/approver/dashboard')}
            startIcon={<ArrowBackRoundedIcon />}
            variant="outlined"
            sx={{ textTransform: 'none', borderRadius: 999 }}
          >
            Back to Dashboard
          </Button>
        </Box>

        <Card
          sx={{
            borderRadius: 3,
            boxShadow: theme.palette.mode === 'dark'
              ? '0 4px 20px rgba(0, 0, 0, 0.3)'
              : '0 2px 12px rgba(0, 0, 0, 0.08)',
            border: '1px solid',
            borderColor: theme.palette.mode === 'dark'
              ? 'rgba(255, 255, 255, 0.12)'
              : 'rgba(0, 0, 0, 0.08)',
          }}
        >
          <CardContent sx={{ p: 3 }}>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(4, 1fr)' },
                gap: 2,
              }}
            >
              {[
                { label: 'Status', value: statusLabel, chip: true, chipStyles: statusColors },
                { label: 'Activity', value: getIsActive(formData.active) ? 'Active' : 'Inactive', chip: true, chipStyles: activityColors },
                { label: 'Company', value: formData.company_name || 'N/A' },
                { label: 'Due Date', value: formatDate(formData.due_date) },
              ].map((item) => (
                <Box
                  key={item.label}
                  sx={{
                    p: 2,
                    borderRadius: 2,
                    border: '1px solid',
                    borderColor: 'divider',
                  }}
                >
                  <Typography
                    variant="caption"
                    sx={{
                      display: 'block',
                      fontWeight: 600,
                      mb: 1,
                      color: 'text.secondary',
                      fontSize: '0.75rem',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                    }}
                  >
                    {item.label}
                  </Typography>

                  {item.chip ? (
                    <Chip
                      label={item.value}
                      size="small"
                      sx={{
                        height: 'auto',
                        py: 0.5,
                        borderRadius: '9999px',
                        backgroundColor: item.chipStyles.backgroundColor,
                        color: item.chipStyles.color,
                        fontWeight: 700,
                        '& .MuiChip-label': { px: 1 },
                      }}
                    />
                  ) : (
                    <Typography sx={{ fontWeight: 700, color: 'text.primary', wordBreak: 'break-word' }}>
                      {item.value}
                    </Typography>
                  )}
                </Box>
              ))}
            </Box>
          </CardContent>
        </Card>

        <SectionCard title="Overview" subtitle="Context and workflow details" icon={<InfoRoundedIcon />}>
          <Stack divider={<Divider />} sx={{ width: '100%' }}>
            {overviewRows.map((row) => (
              <DetailRow key={row.label} label={row.label} value={row.value} />
            ))}
          </Stack>
        </SectionCard>

        <SectionCard title="Control Details" subtitle="Risk, control, ownership, and sample information" icon={<DescriptionRoundedIcon />}>
          <Stack divider={<Divider />} sx={{ width: '100%' }}>
            {controlKeys.map((key) => (
              <DetailRow
                key={key}
                label={RACM_FIELD_LABELS[key] || key}
                value={formData[key]}
                multiline
              />
            ))}
          </Stack>
          <Box sx={{ mt: 2 }}>
            <Button
              variant="outlined"
              startIcon={<DownloadRoundedIcon />}
              onClick={handleDownloadSampleRequired}
              disabled={getSampleRequiredRows(formData?.sample_required).length === 0}
              sx={{ textTransform: 'none', fontWeight: 600 }}
            >
              Download Sample Required
            </Button>
            <Typography sx={{ mt: 0.75, fontSize: '0.78rem', color: theme.palette.text.secondary, fontStyle: 'italic' }}>
              If not available, upload documents from the preceding or succeeding dates.
            </Typography>
          </Box>
        </SectionCard>

        <SectionCard title="Assertions" subtitle="Relevant assertion coverage for this RACM" icon={<InfoRoundedIcon />}>
          <Stack divider={<Divider />} sx={{ width: '100%' }}>
            {assertionKeys.map((key) => (
              <DetailRow key={key} label={RACM_FIELD_LABELS[key] || key} value={formData[key]} multiline />
            ))}
          </Stack>
        </SectionCard>

        <SectionCard title="Design & Implementation" subtitle="Recorded design review fields and remarks" icon={<InfoRoundedIcon />}>
          <Stack divider={<Divider />} sx={{ width: '100%' }}>
            {designKeys.map((key) => (
              <DetailRow key={key} label={RACM_FIELD_LABELS[key] || key} value={formData[key]} multiline />
            ))}
            <DetailRow label={RACM_FIELD_LABELS.remarks_by_user} value={formData.remarks_by_user} multiline />
            <DetailRow label={RACM_FIELD_LABELS.reason_by_approver} value={formData.reason_by_approver} multiline />
          </Stack>
        </SectionCard>

        <SectionCard title="Documents" subtitle="Download sample evidence and user-uploaded support files" icon={<FolderRoundedIcon />}>
          <Stack spacing={3}>
            <Paper variant="outlined" sx={{ p: 2.25, borderRadius: 2.5 }}>
              <Typography sx={{ fontSize: '0.98rem', fontWeight: 800, color: theme.palette.text.primary, mb: 1.5 }}>
                Sample Documents
              </Typography>
              {sampleDocs.length === 0 ? (
                <Typography sx={{ color: theme.palette.text.secondary }}>
                  No sample documents available.
                </Typography>
              ) : (
                <Stack spacing={1.25}>
                  {sampleDocs.map((doc, index) => (
                    <Box
                      key={doc.id || `${doc.sample_doc}-${index}`}
                      sx={{
                        display: 'flex',
                        alignItems: { xs: 'flex-start', sm: 'center' },
                        justifyContent: 'space-between',
                        gap: 1.5,
                        flexDirection: { xs: 'column', sm: 'row' },
                        p: 1.5,
                        borderRadius: 2,
                        backgroundColor: alpha(theme.palette.background.default, theme.palette.mode === 'dark' ? 0.28 : 0.68),
                      }}
                    >
                      <Box sx={{ minWidth: 0 }}>
                        <Typography sx={{ fontWeight: 700, color: theme.palette.text.primary, wordBreak: 'break-word' }}>
                          {getFileName(doc.sample_doc)}
                        </Typography>
                        <Typography sx={{ mt: 0.35, fontSize: '0.8rem', color: theme.palette.text.secondary }}>
                          Added {formatDateTime(doc.created_at)}
                        </Typography>
                      </Box>
                      <Button
                        variant="outlined"
                        size="small"
                        startIcon={<DownloadRoundedIcon />}
                        onClick={() => handleDownloadDocument(doc.sample_doc, 'Sample document downloaded successfully')}
                        sx={{ textTransform: 'none', fontWeight: 600 }}
                      >
                        Download
                      </Button>
                    </Box>
                  ))}
                </Stack>
              )}
            </Paper>

            <Paper variant="outlined" sx={{ p: 2.25, borderRadius: 2.5 }}>
              <Typography sx={{ fontSize: '0.98rem', fontWeight: 800, color: theme.palette.text.primary, mb: 1.5 }}>
                User Uploaded Documents
              </Typography>
              {uploadedDocs.length === 0 ? (
                <Typography sx={{ color: theme.palette.text.secondary }}>
                  No user uploaded documents available.
                </Typography>
              ) : (
                <Stack spacing={1.25}>
                  {uploadedDocs.map((doc, index) => (
                    <Box
                      key={doc.id || `${doc.doc_uploaded_by_user}-${index}`}
                      sx={{
                        display: 'flex',
                        alignItems: { xs: 'flex-start', sm: 'center' },
                        justifyContent: 'space-between',
                        gap: 1.5,
                        flexDirection: { xs: 'column', sm: 'row' },
                        p: 1.5,
                        borderRadius: 2,
                        backgroundColor: alpha(theme.palette.background.default, theme.palette.mode === 'dark' ? 0.28 : 0.68),
                      }}
                    >
                      <Box sx={{ minWidth: 0 }}>
                        <Typography sx={{ fontWeight: 700, color: theme.palette.text.primary, wordBreak: 'break-word' }}>
                          {getFileName(doc.doc_uploaded_by_user)}
                        </Typography>
                        <Typography sx={{ mt: 0.35, fontSize: '0.8rem', color: theme.palette.text.secondary }}>
                          Added {formatDateTime(doc.created_at)}
                        </Typography>
                      </Box>
                      <Button
                        variant="outlined"
                        size="small"
                        startIcon={<DownloadRoundedIcon />}
                        onClick={() => handleDownloadDocument(doc.doc_uploaded_by_user, 'Document downloaded successfully')}
                        sx={{ textTransform: 'none', fontWeight: 600 }}
                      >
                        Download
                      </Button>
                    </Box>
                  ))}
                </Stack>
              )}
            </Paper>
          </Stack>
        </SectionCard>
      </Box>
    </Box>
  )
}

export default ApproverFormDetail
