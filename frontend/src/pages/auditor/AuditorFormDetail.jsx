import React, { useEffect, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { useTheme } from '@mui/material/styles'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Checkbox from '@mui/material/Checkbox'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import Fab from '@mui/material/Fab'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded'
import HistoryRoundedIcon from '@mui/icons-material/HistoryRounded'
import InsertDriveFileRoundedIcon from '@mui/icons-material/InsertDriveFileRounded'
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp'
import * as XLSX from 'xlsx'
import { toast } from 'react-hot-toast'
import { FORM_DETAIL_MAX_WIDTH } from '../../uiConstants'
import { RACM_FIELD_LABELS, orderControlDetailKeys } from '../../racmFormDetailFields'
import { API_BASE_URL } from '../../config/api'
import { useSyncGlobalLoading } from '../../contexts/GlobalLoadingContext'
import { formatRacmUserDocumentSubtitle, normalizeRacmUserDocuments } from '../../lib/racmUserDocuments'
import { RacmTemplateSectionFields } from '../../components/racm/RacmTemplateSectionFields'

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

function formatDate(dateString) {
  if (!dateString) return 'N/A'
  const date = new Date(dateString)
  if (Number.isNaN(date.getTime())) return 'N/A'
  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function formatStatus(status) {
  const value = String(status || '').trim()
  if (!value || value.toLowerCase() === 'null') return '-'
  return value.charAt(0).toUpperCase() + value.slice(1)
}

function getIsActive(value) {
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value !== 0

  const normalizedValue = String(value ?? '').trim().toLowerCase()
  if (!normalizedValue || normalizedValue === '0' || normalizedValue === 'false' || normalizedValue === 'null') {
    return false
  }

  return true
}

function getFileName(filePath) {
  if (!filePath) return ''
  const parts = String(filePath).split(/[/\\]/)
  return parts[parts.length - 1] || String(filePath)
}

function AuditorFormDetail() {
  const theme = useTheme()
  const navigate = useNavigate()
  const location = useLocation()
  const { form_id } = useParams()
  const isCompanyAdminView = location.pathname.startsWith('/company_admin')
  const backPath = isCompanyAdminView ? '/company_admin/racms' : '/auditor/racms'
  const [formData, setFormData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [sampleDocsDialogOpen, setSampleDocsDialogOpen] = useState(false)
  const [userDocsDialogOpen, setUserDocsDialogOpen] = useState(false)
  const [showScrollTop, setShowScrollTop] = useState(false)

  useSyncGlobalLoading(loading)

  useEffect(() => {
    const onScroll = () => {
      setShowScrollTop(window.scrollY > 300)
    }

    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    let cancelled = false

    const fetchFormData = async () => {
      setLoading(true)
      setError(null)
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
          setError(data.message || 'Failed to fetch form data')
        }
      } catch (fetchError) {
        console.error('Auditor form detail error:', fetchError)
        if (!cancelled) {
          setError('Error fetching form data')
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
      const status = response.status
      const contentType = response.headers.get('content-type') || ''

      if (status === 200 && contentType.includes('application/octet-stream')) {
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
      } else {
        let errorMessage = 'Failed to download document'
        try {
          const errorData = await response.json()
          errorMessage = errorData.message || errorData.error || errorMessage
        } catch {
          errorMessage = `Download failed with status ${status}`
        }
        toast.error(errorMessage)
      }
    } catch (downloadError) {
      console.error('Error downloading document:', downloadError)
      toast.error('Error downloading document')
    }
  }

  const getSampleDocs = () => {
    const docs = Array.isArray(formData?.sample_docs) ? formData.sample_docs : []
    const normalizedDocs = docs
      .map((doc, index) => ({
        id: doc.id || `sample-doc-${index}`,
        sample_doc: doc.sample_doc,
        created_at: doc.created_at,
      }))
      .filter((doc) => String(doc.sample_doc || '').trim() !== '')

    if (normalizedDocs.length > 0) return normalizedDocs

    const legacyDoc = String(formData?.sample_doc || '').trim()
    return legacyDoc ? [{ id: 'sample-doc-current', sample_doc: legacyDoc, created_at: null }] : []
  }

  const getUserDocs = () => {
    return normalizeRacmUserDocuments(
      formData?.doc_uploaded_by_user_docs,
      formData?.doc_uploaded_by_user
    )
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

    const worksheetRows = [['Sample Required'], ...rows.map((row) => [row])]
    const worksheet = XLSX.utils.aoa_to_sheet(worksheetRows)
    worksheet['!cols'] = [{ wch: 36 }]
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Sample Required')

    const safeFormId = String(form_id || 'racm').replace(/[^\w-]/g, '_')
    XLSX.writeFile(workbook, `sample_required_${safeFormId}.xlsx`)
  }

  const renderSampleRequiredDownload = () => {
    const hasSampleRequired = getSampleRequiredRows(formData?.sample_required).length > 0

    return (
      <Box>
        <Button
          variant="outlined"
          startIcon={<DownloadRoundedIcon />}
          onClick={handleDownloadSampleRequired}
          disabled={!hasSampleRequired}
          sx={{
            textTransform: 'none',
            fontWeight: 600,
            alignSelf: 'flex-start',
          }}
        >
          {hasSampleRequired ? 'Download Sample Required' : 'No Sample Required File'}
        </Button>
        <Typography
          variant="caption"
          component="p"
          sx={{
            color: 'text.secondary',
            fontStyle: 'italic',
            mt: 0.75,
            fontSize: '0.75rem',
            opacity: 0.8,
          }}
        >
          (If not available, upload documents from the preceding or succeeding dates.)
        </Typography>
      </Box>
    )
  }

  const fieldLabels = { ...RACM_FIELD_LABELS }
  const fieldOrder = [
    'control_number',
    'area',
    'sub_process',
    'risk_description',
    'risk_heat',
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
    'control_design_procs',
    'control_type_fo',
    'control_type_ma',
    'nature_of_control',
    'control_owner',
    'control_frequency',
    'sample_size',
    'sample_required',
    'control_design_conclusion',
    'design_deficiency_desc',
    'doc_uploaded_by_user',
  ]
  const excludedFields = ['id', 'form_id', 'company_identifier', 'created_at', 'active', 'approved_rejected', 'reason_by_approver']
  const groupedApproverFields = ['control_design_procs', 'control_design_conclusion', 'design_deficiency_desc']
  const hasGroupedFieldValue = formData
    ? groupedApproverFields.some((key) => {
        const value = formData[key]
        return value !== null && value !== undefined && value !== '' && String(value).trim() !== ''
      })
    : false

  const sampleDocs = getSampleDocs()
  const sampleDocCount = sampleDocs.length
  const userDocs = getUserDocs()
  const userDocCount = userDocs.length
  const isActive = getIsActive(formData?.active)
  const topSummaryCardSx = {
    p: 2,
    borderRadius: 2,
    border: '1px solid',
    borderColor: 'divider',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'flex-start',
    gap: 1,
    height: '100%',
    minHeight: { xs: 'auto', md: 108 },
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-4rem)]">
        <p className="text-secondary text-lg">Loading form data...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-4rem)]">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md">
          <p className="text-red-600 text-lg text-center">{error}</p>
        </div>
      </div>
    )
  }

  if (!formData) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-4rem)]">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md">
          <p className="text-secondary text-lg text-center">Form not found</p>
        </div>
      </div>
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
        <Box sx={{ width: '100%' }}>
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
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            <CardContent
              sx={{
                px: 3.5,
                pt: 3,
                pb: 4,
                display: 'flex',
                flexDirection: 'column',
                gap: 0,
              }}
            >
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <Box
                  sx={{
                    display: 'flex',
                    flexDirection: { xs: 'column', sm: 'row' },
                    alignItems: { xs: 'stretch', sm: 'center' },
                    justifyContent: 'space-between',
                    gap: 1.5,
                    mb: 0,
                    pb: 2,
                    borderBottom: '1px solid',
                    borderColor: 'divider',
                  }}
                >
                  <Button
                    variant="contained"
                    color="primary"
                    size="medium"
                    startIcon={<HistoryRoundedIcon sx={{ fontSize: '1.2rem !important' }} />}
                    onClick={() => navigate(backPath)}
                    disableElevation
                    sx={{
                      alignSelf: { xs: 'flex-start', sm: 'center' },
                      textTransform: 'none',
                      fontWeight: 700,
                      letterSpacing: '0.02em',
                      borderRadius: 2,
                      px: 1.5,
                      py: 0.875,
                      minHeight: 40,
                      boxShadow: 'none',
                      '&:hover': {
                        boxShadow: 'none',
                      },
                    }}
                  >
                    Back to RACMs
                  </Button>
                  <Box
                    sx={{
                      textAlign: { xs: 'left', sm: 'right' },
                      minWidth: 0,
                    }}
                  >
                    <Typography
                      variant="caption"
                      sx={{
                        display: 'block',
                        color: 'text.secondary',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                      }}
                    >
                      Created At
                    </Typography>
                    <Typography
                      variant="body2"
                      sx={{
                        color: 'text.primary',
                        fontWeight: 600,
                        lineHeight: 1.5,
                      }}
                    >
                      {formatDateTime(formData?.created_at)}
                    </Typography>
                  </Box>
                </Box>

                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: {
                      xs: '1fr',
                      sm: 'repeat(2, 1fr)',
                      md: 'repeat(4, 1fr)',
                    },
                    gap: 2,
                    alignItems: 'stretch',
                  }}
                >
                  {[
                    { label: 'Form Status', value: isActive ? 'Active' : 'Inactive', color: isActive ? '#10b981' : '#ef4444' },
                    { label: 'Business Process', value: formData?.business_process || '-' },
                    { label: 'Financial Year', value: formData?.financial_year || '-' },
                    { label: 'Approval Status', value: formatStatus(formData?.status), color: formData?.status === 'Approved' ? '#10b981' : formData?.status === 'Rejected' ? '#ef4444' : undefined },
                  ].map((item) => (
                    <Box
                      key={item.label}
                      sx={topSummaryCardSx}
                    >
                      <Typography
                        variant="caption"
                        component="label"
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
                      <Typography
                        variant="body2"
                        sx={{
                          color: item.color || 'text.primary',
                          fontWeight: 500,
                          fontSize: '0.9375rem',
                          lineHeight: 1.5,
                        }}
                      >
                        {item.value}
                      </Typography>
                    </Box>
                  ))}
                </Box>

                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' },
                    gap: 2,
                    alignItems: 'stretch',
                  }}
                >
                  <Box sx={topSummaryCardSx}>
                    <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      Reminder Settings
                    </Typography>
                    <Typography variant="body2" sx={{ color: 'text.primary', fontWeight: 500, lineHeight: 1.6 }}>
                      Due: {formatDate(formData?.due_date)}
                    </Typography>
                    <Typography variant="body2" sx={{ color: 'text.primary', fontWeight: 500, lineHeight: 1.6 }}>
                      Frequency: {(formData?.reminder_frequency || '').toString().trim() || '-'}
                    </Typography>
                  </Box>

                  <Box sx={topSummaryCardSx}>
                    <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      RACM Assignment
                    </Typography>
                    <Typography variant="body2" sx={{ color: 'text.primary', fontWeight: 500, lineHeight: 1.6 }}>
                      {(formData?.control_owner_name || formData?.control_owner || '').toString().trim() || '-'}
                    </Typography>
                  </Box>

                  <Box sx={topSummaryCardSx}>
                    <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      Unit Name
                    </Typography>
                    <Typography variant="body2" sx={{ color: 'text.primary', fontWeight: 500, lineHeight: 1.6 }}>
                      {(formData?.unit_name || '').toString().trim() || '-'}
                    </Typography>
                  </Box>

                  <Box sx={topSummaryCardSx}>
                    <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      Control Number
                    </Typography>
                    <Typography variant="body2" sx={{ color: 'text.primary', fontWeight: 500, lineHeight: 1.6 }}>
                      {(formData?.control_number || '').toString().trim() || '-'}
                    </Typography>
                  </Box>
                </Box>

                <Box
                  sx={{
                    mt: 2,
                    pt: 3,
                    borderTop: '2px solid',
                    borderColor: 'divider',
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' },
                    gap: 2,
                  }}
                >
                  <Button
                    onClick={() => setSampleDocsDialogOpen(true)}
                    fullWidth
                    variant="outlined"
                    startIcon={<DownloadRoundedIcon />}
                    sx={{
                      py: 1.5,
                      fontWeight: 600,
                      textTransform: 'none',
                      fontSize: '0.9375rem',
                      borderRadius: 2,
                    }}
                  >
                    Sample Documents ({sampleDocCount})
                  </Button>

                  <Button
                    onClick={() => setUserDocsDialogOpen(true)}
                    fullWidth
                    variant="outlined"
                    startIcon={<DownloadRoundedIcon />}
                    sx={{
                      py: 1.5,
                      fontWeight: 600,
                      textTransform: 'none',
                      fontSize: '0.9375rem',
                      borderRadius: 2,
                    }}
                  >
                    User Documents ({userDocCount})
                  </Button>

                  <Button
                    onClick={() => navigate(backPath)}
                    fullWidth
                    variant="contained"
                    color="secondary"
                    sx={{
                      py: 1.5,
                      fontWeight: 600,
                      textTransform: 'none',
                      fontSize: '0.9375rem',
                      borderRadius: 2,
                    }}
                  >
                    Back
                  </Button>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Box>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
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
              overflow: 'hidden',
            }}
          >
            <CardContent sx={{ p: 4 }}>
              <Typography
                variant="h6"
                component="h3"
                sx={{
                  fontWeight: 700,
                  mb: 3,
                  color: 'text.primary',
                  fontSize: '1.25rem',
                  pb: 2,
                  borderBottom: '2px solid',
                  borderColor: 'divider',
                }}
              >
                Process and Risk
              </Typography>
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: {
                    xs: '1fr',
                    md: 'repeat(2, 1fr)',
                  },
                  gap: 3,
                  mt: 2,
                }}
              >
                {['control_number', 'area', 'sub_process', 'risk_description', 'risk_heat'].map((key) => {
                  if (!Object.prototype.hasOwnProperty.call(formData, key) || excludedFields.includes(key)) return null
                  const label = fieldLabels[key] || key.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())
                  const value = formData[key]
                  const isEmpty = value === null || value === undefined || value === ''

                  return (
                    <Box
                      key={key}
                      sx={{
                        p: 2.5,
                        borderRadius: 2,
                        backgroundColor: theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)',
                        border: '1px solid',
                        borderColor: theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)',
                        transition: 'all 0.2s ease-in-out',
                        '&:hover': {
                          backgroundColor: theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)',
                        },
                      }}
                    >
                      <Typography
                        variant="caption"
                        component="dt"
                        sx={{
                          display: 'block',
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px',
                          mb: 1.5,
                          color: 'text.primary',
                          fontSize: theme.typography.customSizes.small,
                        }}
                      >
                        {label}
                      </Typography>
                      <Typography
                        variant="body2"
                        component="dd"
                        sx={{
                          color: isEmpty ? 'text.disabled' : 'text.secondary',
                          wordBreak: 'break-word',
                          lineHeight: 1.6,
                          fontSize: theme.typography.customSizes.medium,
                        }}
                      >
                        {isEmpty ? '-' : String(value)}
                      </Typography>
                    </Box>
                  )
                })}
                <RacmTemplateSectionFields
                  blendIntoParent
                  sectionKey="process_and_risk"
                  fieldDefinitions={formData.field_definitions}
                  values={formData.dynamic_values || {}}
                />
              </Box>
            </CardContent>
          </Card>

          <RacmTemplateSectionFields
            sectionKey="assertions"
            title="Assertions"
            fieldDefinitions={formData.field_definitions}
            values={formData.dynamic_values || {}}
          />

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
              overflow: 'hidden',
            }}
          >
            <CardContent sx={{ p: 4 }}>
              <Typography
                variant="h6"
                component="h3"
                sx={{
                  fontWeight: 700,
                  mb: 3,
                  color: 'text.primary',
                  fontSize: '1.25rem',
                  pb: 2,
                  borderBottom: '2px solid',
                  borderColor: 'divider',
                }}
              >
                Control Details
              </Typography>
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: {
                    xs: '1fr',
                    md: 'repeat(2, 1fr)',
                  },
                  gap: 3,
                  mt: 2,
                }}
              >
                {orderControlDetailKeys(
                  fieldOrder.filter((key) => {
                    if (groupedApproverFields.includes(key)) return false
                    if (['control_number', 'area', 'sub_process', 'risk_description', 'risk_heat'].includes(key)) {
                      return false
                    }
                    if (['doc_uploaded_by_user', 'remarks_by_user'].includes(key)) {
                      return false
                    }
                    return Object.prototype.hasOwnProperty.call(formData, key) && !excludedFields.includes(key)
                  }),
                  fieldOrder,
                ).map((key) => {
                  const label = fieldLabels[key] || key.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())
                  const value = formData[key]
                  const isEmpty = value === null || value === undefined || value === ''
                  const isTextArea = ['standard_control_description', 'control_objective', 'process_walkthrough', 'audit_evidence_accuracy', 'ipe_reference', 'control_design_procs', 'design_deficiency_desc'].includes(key)

                  return (
                    <Box
                      key={key}
                      sx={{
                        p: 2.5,
                        borderRadius: 2,
                        backgroundColor: theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)',
                        border: '1px solid',
                        borderColor: theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)',
                        gridColumn: isTextArea ? { xs: '1', md: '1 / -1' } : undefined,
                        transition: 'all 0.2s ease-in-out',
                        '&:hover': {
                          backgroundColor: theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)',
                        },
                      }}
                    >
                      <Typography
                        variant="caption"
                        component="dt"
                        sx={{
                          display: 'block',
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px',
                          mb: 1.5,
                          color: 'text.primary',
                          fontSize: theme.typography.customSizes.small,
                        }}
                      >
                        {label}
                      </Typography>
                      {key === 'sample_required' ? (
                        renderSampleRequiredDownload()
                      ) : (
                        <Typography
                          variant="body2"
                          component="dd"
                          sx={{
                            color: isEmpty ? 'text.disabled' : 'text.secondary',
                            wordBreak: 'break-word',
                            lineHeight: 1.6,
                            fontSize: theme.typography.customSizes.medium,
                            whiteSpace: isTextArea ? 'pre-wrap' : 'normal',
                          }}
                        >
                          {isEmpty ? '-' : String(value)}
                        </Typography>
                      )}
                    </Box>
                  )
                })}
                <RacmTemplateSectionFields
                  blendIntoParent
                  sectionKey="control_details"
                  fieldDefinitions={formData.field_definitions}
                  values={formData.dynamic_values || {}}
                />
              </Box>
            </CardContent>
          </Card>

          <RacmTemplateSectionFields
            sectionKey="others"
            title="Others"
            fieldDefinitions={formData.field_definitions}
            values={formData.dynamic_values || {}}
          />

          {hasGroupedFieldValue && (
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
                overflow: 'hidden',
              }}
            >
              <CardContent sx={{ p: 4 }}>
                <Typography
                  variant="h6"
                  component="h3"
                  sx={{
                    fontWeight: 700,
                    mb: 3,
                    color: 'text.primary',
                    fontSize: '1.25rem',
                    pb: 2,
                    borderBottom: '2px solid',
                    borderColor: 'divider',
                  }}
                >
                  Design and Implementation
                </Typography>
                <Box
                  sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 3,
                    mt: 2,
                  }}
                >
                  {groupedApproverFields.map((key) => {
                    const label = fieldLabels[key] || key.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())
                    const value = formData[key]
                    const isEmpty = value === null || value === undefined || value === '' || String(value).trim() === ''

                    return (
                      <Box
                        key={key}
                        sx={{
                          p: 2.5,
                          borderRadius: 2,
                          backgroundColor: theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)',
                          border: '1px solid',
                          borderColor: theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)',
                          transition: 'all 0.2s ease-in-out',
                          '&:hover': {
                            backgroundColor: theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)',
                          },
                        }}
                      >
                        <Typography
                          variant="caption"
                          component="dt"
                          sx={{
                            display: 'block',
                            fontWeight: 700,
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px',
                            mb: 1.5,
                            color: 'text.primary',
                            fontSize: theme.typography.customSizes.small,
                          }}
                        >
                          {label}
                        </Typography>
                        <Typography
                          variant="body2"
                          component="dd"
                          sx={{
                            color: isEmpty ? 'text.disabled' : 'text.secondary',
                            wordBreak: 'break-word',
                            lineHeight: 1.6,
                            fontSize: theme.typography.customSizes.medium,
                            whiteSpace: 'pre-wrap',
                          }}
                        >
                          {isEmpty ? '-' : String(value)}
                        </Typography>
                      </Box>
                    )
                  })}
                </Box>
              </CardContent>
            </Card>
          )}

          {(userDocCount > 0 || formData.remarks_by_user || formData.reason_by_approver) && (
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
                overflow: 'hidden',
              }}
            >
              <CardContent sx={{ p: 4 }}>
                <Typography
                  variant="h6"
                  component="h3"
                  sx={{
                    fontWeight: 700,
                    mb: 3,
                    color: 'text.primary',
                    fontSize: '1.25rem',
                    pb: 2,
                    borderBottom: '2px solid',
                    borderColor: 'divider',
                  }}
                >
                  Approval
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, mt: 2 }}>
                  {(userDocCount > 0 || typeof formData.remarks_by_user !== 'undefined') && (
                    <Box
                      sx={{
                        display: 'grid',
                        gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' },
                        gap: 3,
                      }}
                    >
                      {userDocCount > 0 && (
                        <Box
                          component="button"
                          type="button"
                          onClick={() => setUserDocsDialogOpen(true)}
                          sx={{
                            p: 2.5,
                            borderRadius: 2,
                            backgroundColor: theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)',
                            border: '1px solid',
                            borderColor: theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)',
                            width: '100%',
                            minWidth: 0,
                            textAlign: 'left',
                            cursor: 'pointer',
                            font: 'inherit',
                            transition: 'all 0.2s ease-in-out',
                            '&:hover': {
                              backgroundColor: theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)',
                            },
                          }}
                        >
                          <Typography
                            variant="caption"
                            component="dt"
                            sx={{
                              display: 'block',
                              fontWeight: 700,
                              textTransform: 'uppercase',
                              letterSpacing: '0.5px',
                              mb: 1.5,
                              color: 'text.primary',
                              fontSize: theme.typography.customSizes.small,
                            }}
                          >
                            {fieldLabels.doc_uploaded_by_user}
                          </Typography>
                          <Typography
                            variant="body2"
                            component="dd"
                            sx={{
                              color: 'text.primary',
                              lineHeight: 1.6,
                              fontSize: theme.typography.customSizes.medium,
                              fontWeight: 600,
                            }}
                          >
                            User Uploaded Documents ({userDocCount})
                          </Typography>
                        </Box>
                      )}

                      {typeof formData.remarks_by_user !== 'undefined' && (
                        <Box
                          sx={{
                            p: 2.5,
                            borderRadius: 2,
                            backgroundColor: theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)',
                            border: '1px solid',
                            borderColor: theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)',
                            minWidth: 0,
                            transition: 'all 0.2s ease-in-out',
                            '&:hover': {
                              backgroundColor: theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)',
                            },
                          }}
                        >
                          <Typography
                            variant="caption"
                            component="dt"
                            sx={{
                              display: 'block',
                              fontWeight: 700,
                              textTransform: 'uppercase',
                              letterSpacing: '0.5px',
                              mb: 1.5,
                              color: 'text.primary',
                              fontSize: theme.typography.customSizes.small,
                            }}
                          >
                            Remarks By User
                          </Typography>
                          <Typography
                            variant="body2"
                            component="dd"
                            sx={{
                              color: !formData.remarks_by_user || String(formData.remarks_by_user).trim() === '' ? 'text.disabled' : 'text.secondary',
                              wordBreak: 'break-word',
                              lineHeight: 1.6,
                              fontSize: theme.typography.customSizes.medium,
                            }}
                          >
                            {!formData.remarks_by_user || String(formData.remarks_by_user).trim() === '' ? '-' : String(formData.remarks_by_user)}
                          </Typography>
                        </Box>
                      )}
                    </Box>
                  )}

                  {(() => {
                    const reason = formData?.reason_by_approver
                    const hasReason = typeof reason === 'string' && reason.trim() !== ''
                    if (!hasReason) return null

                    return (
                      <Box
                        sx={{
                          p: 2.5,
                          borderRadius: 2,
                          backgroundColor: theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)',
                          border: '1px solid',
                          borderColor: theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)',
                        }}
                      >
                        <Typography
                          variant="caption"
                          component="dt"
                          sx={{
                            display: 'block',
                            fontWeight: 700,
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px',
                            mb: 1.5,
                            color: 'text.primary',
                            fontSize: theme.typography.customSizes.small,
                          }}
                        >
                          Reason by Approver
                        </Typography>
                        <Typography
                          variant="body2"
                          component="dd"
                          sx={{
                            color: 'text.primary',
                            fontWeight: 500,
                            fontSize: '0.875rem',
                            lineHeight: 1.6,
                            wordBreak: 'break-word',
                          }}
                        >
                          {reason}
                        </Typography>
                      </Box>
                    )
                  })()}
                </Box>
              </CardContent>
            </Card>
          )}
        </Box>
      </Box>

      <Dialog
        open={sampleDocsDialogOpen}
        onClose={() => setSampleDocsDialogOpen(false)}
        aria-labelledby="auditor-sample-documents-dialog-title"
        PaperProps={{
          sx: {
            borderRadius: 2,
            minWidth: { xs: '94%', sm: '640px' },
            maxWidth: '720px',
            boxShadow: theme.palette.mode === 'dark'
              ? '0 8px 32px rgba(0, 0, 0, 0.4)'
              : '0 8px 32px rgba(0, 0, 0, 0.12)',
          },
        }}
      >
        <DialogTitle
          id="auditor-sample-documents-dialog-title"
          sx={{
            pb: 2.5,
            pt: 3,
            px: 3,
            fontWeight: 700,
            fontSize: '1.25rem',
            color: theme.palette.text.primary,
          }}
        >
          Sample Documents ({sampleDocCount})
        </DialogTitle>
        <DialogContent dividers sx={{ px: 3, pt: 2.5, pb: 3 }}>
          {sampleDocs.length > 0 ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
              {sampleDocs.map((doc, index) => (
                <Box
                  key={doc.id || `${doc.sample_doc}-${index}`}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.5,
                    p: 1.5,
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: 1,
                  }}
                >
                  <InsertDriveFileRoundedIcon color="action" />
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.primary', overflowWrap: 'anywhere' }}>
                      {getFileName(doc.sample_doc)}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {doc.created_at ? formatDateTime(doc.created_at) : 'Uploaded document'}
                    </Typography>
                  </Box>
                  <Tooltip title="Download">
                    <span>
                      <IconButton
                        size="small"
                        onClick={() => handleDownloadDocument(doc.sample_doc, 'Sample document downloaded successfully')}
                        aria-label={`Download ${getFileName(doc.sample_doc)}`}
                      >
                        <DownloadRoundedIcon fontSize="small" />
                      </IconButton>
                    </span>
                  </Tooltip>
                </Box>
              ))}
            </Box>
          ) : (
            <Typography variant="body2" color="text.secondary">
              No sample documents uploaded.
            </Typography>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setSampleDocsDialogOpen(false)}>
            Close
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={userDocsDialogOpen}
        onClose={() => setUserDocsDialogOpen(false)}
        aria-labelledby="auditor-user-documents-dialog-title"
        PaperProps={{
          sx: {
            borderRadius: 2,
            minWidth: { xs: '94%', sm: '640px' },
            maxWidth: '720px',
            boxShadow: theme.palette.mode === 'dark'
              ? '0 8px 32px rgba(0, 0, 0, 0.4)'
              : '0 8px 32px rgba(0, 0, 0, 0.12)',
          },
        }}
      >
        <DialogTitle
          id="auditor-user-documents-dialog-title"
          sx={{
            pb: 2.5,
            pt: 3,
            px: 3,
            fontWeight: 700,
            fontSize: '1.25rem',
            color: theme.palette.text.primary,
          }}
        >
          User Uploaded Documents ({userDocCount})
        </DialogTitle>
        <DialogContent dividers sx={{ px: 3, pt: 2.5, pb: 3 }}>
          {userDocs.length > 0 ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
              {userDocs.map((doc, index) => (
                <Box
                  key={doc.id || `${doc.doc_uploaded_by_user}-${index}`}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.5,
                    p: 1.5,
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: 1,
                  }}
                >
                  <InsertDriveFileRoundedIcon color="action" />
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.primary', overflowWrap: 'anywhere' }}>
                      {getFileName(doc.doc_uploaded_by_user)}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {formatRacmUserDocumentSubtitle(doc, formatDateTime)}
                    </Typography>
                  </Box>
                  <Tooltip title="Download">
                    <span>
                      <IconButton
                        size="small"
                        onClick={() => handleDownloadDocument(doc.doc_uploaded_by_user, 'Document downloaded successfully')}
                        aria-label={`Download ${getFileName(doc.doc_uploaded_by_user)}`}
                      >
                        <DownloadRoundedIcon fontSize="small" />
                      </IconButton>
                    </span>
                  </Tooltip>
                </Box>
              ))}
            </Box>
          ) : (
            <Typography variant="body2" color="text.secondary">
              No user uploaded documents available.
            </Typography>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setUserDocsDialogOpen(false)}>
            Close
          </Button>
        </DialogActions>
      </Dialog>

      {showScrollTop && (
        <Fab
          aria-label="scroll to top"
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          sx={{
            position: 'fixed',
            right: { xs: 16, sm: 24 },
            bottom: { xs: 16, sm: 24 },
            zIndex: (t) => t.zIndex.modal + 1,
            backgroundColor: (t) => (t.palette.mode === 'dark' ? '#0b1220' : '#ffffff'),
            color: (t) => (t.palette.mode === 'dark' ? '#ffffff' : '#111827'),
            border: (t) =>
              `1px solid ${t.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.28)' : 'rgba(17, 24, 39, 0.35)'}`,
            boxShadow: (t) =>
              t.palette.mode === 'dark'
                ? '0 8px 24px rgba(0, 0, 0, 0.45)'
                : '0 8px 24px rgba(0, 0, 0, 0.12)',
            '&:hover': {
              backgroundColor: (t) => (t.palette.mode === 'dark' ? '#111827' : '#f9fafb'),
            },
          }}
        >
          <KeyboardArrowUpIcon />
        </Fab>
      )}
    </Box>
  )
}

export default AuditorFormDetail
