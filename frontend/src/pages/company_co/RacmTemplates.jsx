import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import AddRoundedIcon from '@mui/icons-material/AddRounded'
import SaveRoundedIcon from '@mui/icons-material/SaveRounded'
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded'
import LightbulbOutlinedIcon from '@mui/icons-material/LightbulbOutlined'
import { toast } from 'react-hot-toast'
import { apiUrl } from '../../config/api'
import { useSyncGlobalLoading } from '../../contexts/GlobalLoadingContext'
import { DASHBOARD_PAGE_OUTER_SX, DASHBOARD_PAPER_SX } from '../../uiConstants'
import { deriveKeywordsFromLabel, findDuplicateColumnLabel, resolveExtraFieldKeywords } from '../../utils/racmTemplateKeywords'
import { RACM_ASSERTION_CATALOG } from '../../utils/racmAssertionCatalog'
import AppDialog, { APP_DIALOG_PRIMARY_BUTTON_SX, getAppDialogCancelButtonSx } from '../../components/AppDialog'
import { useTheme } from '@mui/material/styles'

const SECTION_OPTIONS = [
  { key: 'process_and_risk', label: 'Process and Risk' },
  { key: 'assertions', label: 'Assertions' },
  { key: 'control_details', label: 'Control Details' },
  { key: 'others', label: 'Others' },
]

const ASSERTION_COLUMNS_INFO =
  'Assertion columns are optional and vary by RACM. For the Assertions section, you can add columns from the predefined standard set (Completeness, Existence & Occurrence, and so on) or create your own custom text columns. Not every template needs assertion columns.'

const columnGridSx = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(500px, 1fr))',
  gap: 1.5,
  width: '100%',
}

const columnCellSx = {
  minWidth: 0,
  width: '100%',
  minHeight: 44,
  display: 'flex',
  alignItems: 'center',
  px: 1.5,
  py: 1,
  borderRadius: 1.5,
  border: '1px solid',
  borderColor: 'divider',
  backgroundColor: 'action.hover',
}

function getSectionLabel(sectionKey) {
  return SECTION_OPTIONS.find((option) => option.key === sectionKey)?.label || 'Others'
}

function CustomColumnEditorDialog({
  open,
  mode,
  label,
  sectionKey,
  fromCatalog,
  canEditSection,
  canEditLabel = true,
  canDelete,
  onClose,
  onEdit,
  onSave,
  onDelete,
  onCancelEdit,
  onLabelChange,
  onSectionChange,
}) {
  const isEditing = mode === 'edit'
  const showSectionPicker = isEditing && canEditSection

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>{isEditing ? 'Edit custom column' : 'Custom column'}</DialogTitle>
      <DialogContent>
        {isEditing ? (
          <Stack spacing={2} sx={{ pt: 2.5 }}>
            <TextField
              label="Column label"
              value={label}
              onChange={(e) => onLabelChange(e.target.value)}
              fullWidth
              autoFocus
              disabled={!canEditLabel}
              helperText={
                !canEditLabel
                  ? 'Renaming is blocked while RACMs are linked. Create a new template version instead.'
                  : undefined
              }
            />
            {showSectionPicker ? (
              <FormControl fullWidth>
                <InputLabel>Section</InputLabel>
                <Select value={sectionKey} label="Section" onChange={(e) => onSectionChange(e.target.value)}>
                  {SECTION_OPTIONS.map((option) => (
                    <MenuItem key={option.key} value={option.key}>
                      {option.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            ) : null}
          </Stack>
        ) : (
          <Stack spacing={1} sx={{ pt: 0.5 }}>
            <Typography variant="body1" sx={{ fontWeight: 600 }}>
              {String(label || '').trim() || 'New column'}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Section: {getSectionLabel(sectionKey)}
            </Typography>
          </Stack>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        {isEditing ? (
          <Stack direction="row" spacing={1} sx={{ width: '100%', justifyContent: 'flex-end' }}>
            <Button onClick={onCancelEdit}>Cancel</Button>
            <Button variant="contained" onClick={onSave}>
              Save
            </Button>
          </Stack>
        ) : (
          <Stack direction="row" spacing={1} sx={{ width: '100%', justifyContent: 'flex-end' }}>
            {canDelete ? (
              <Button color="error" onClick={onDelete}>
                Delete
              </Button>
            ) : null}
            {canEditLabel || canEditSection ? (
              <Button variant="contained" onClick={onEdit}>
                Edit
              </Button>
            ) : null}
          </Stack>
        )}
      </DialogActions>
    </Dialog>
  )
}

function TemplateColumnListing({
  groupedFields,
  canEditExtras,
  onColumnClick,
  onExtraFieldChange,
  onSaveInline,
  onCancelInline,
}) {
  return (
    <Stack spacing={2.5} divider={<Box sx={{ borderBottom: '1px solid', borderColor: 'divider' }} />}>
      {groupedFields.map((section) => {
        const hasFields = section.fixed.length > 0 || section.extras.length > 0
        if (!hasFields) return null

        return (
          <Box key={section.key}>
            <Typography
              variant="subtitle2"
              sx={{
                fontWeight: 800,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                color: 'text.secondary',
                mb: 1.25,
              }}
            >
              {section.label}
            </Typography>

            <Box sx={columnGridSx}>
              {section.fixed.map((field) => (
                <Box key={field.id} sx={columnCellSx}>
                  <Typography variant="body2" sx={{ width: '100%', minWidth: 0 }}>
                    {field.label}
                  </Typography>
                </Box>
              ))}

              {section.extras.map((field) => {
                const clientId = field.clientId || field.field_key
                const isDraft = Boolean(field.isDraft)

                if (isDraft && canEditExtras) {
                  return (
                    <Box
                      key={clientId}
                      sx={{
                        ...columnCellSx,
                        alignItems: 'stretch',
                        flexDirection: 'column',
                        gap: 1.25,
                        minHeight: 88,
                        py: 1.5,
                      }}
                    >
                      <Stack direction="row" alignItems="center" spacing={1}>
                        <CustomColumnDot />
                        <TextField
                          size="small"
                          label="Column label"
                          value={field.label || ''}
                          onChange={(e) => onExtraFieldChange(clientId, 'label', e.target.value)}
                          fullWidth
                          autoFocus
                        />
                      </Stack>
                      {isDraft && !field.fromCatalog && field.section_key !== 'assertions' ? (
                        <FormControl size="small" fullWidth>
                          <InputLabel>Section</InputLabel>
                          <Select
                            value={field.draft_section_key ?? field.section_key ?? 'others'}
                            label="Section"
                            onChange={(e) => onExtraFieldChange(clientId, 'section_key', e.target.value)}
                          >
                            {SECTION_OPTIONS.map((option) => (
                              <MenuItem key={option.key} value={option.key}>
                                {option.label}
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                      ) : null}
                      <Stack direction="row" spacing={1} flexWrap="wrap">
                        <Button size="small" variant="contained" onClick={() => onSaveInline(clientId)}>
                          Save
                        </Button>
                        <Button size="small" variant="outlined" onClick={() => onCancelInline(clientId)}>
                          Cancel
                        </Button>
                      </Stack>
                    </Box>
                  )
                }

                return (
                  <Box
                    key={clientId}
                    role={canEditExtras ? 'button' : undefined}
                    tabIndex={canEditExtras ? 0 : undefined}
                    onClick={canEditExtras ? () => onColumnClick(clientId) : undefined}
                    onKeyDown={
                      canEditExtras
                        ? (e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault()
                              onColumnClick(clientId)
                            }
                          }
                        : undefined
                    }
                    sx={{
                      ...columnCellSx,
                      cursor: canEditExtras ? 'pointer' : 'default',
                      ...(canEditExtras
                        ? {
                            '&:hover': {
                              borderColor: 'primary.main',
                              backgroundColor: 'action.selected',
                            },
                          }
                        : {}),
                    }}
                  >
                    <Stack direction="row" alignItems="center" spacing={1} sx={{ width: '100%', minWidth: 0 }}>
                      <CustomColumnDot />
                      <Typography variant="body2" sx={{ flex: 1, minWidth: 0 }}>
                        {field.label}
                      </Typography>
                    </Stack>
                  </Box>
                )
              })}
            </Box>
          </Box>
        )
      })}
    </Stack>
  )
}

function slugifyFieldKey(input) {
  return String(input || '')
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
}

function CustomColumnDot({ size = 8 }) {
  return (
    <Box
      sx={{
        width: size,
        height: size,
        borderRadius: '50%',
        backgroundColor: '#f59e0b',
        flexShrink: 0,
      }}
    />
  )
}

function buildNormalizedExtraFields(fields) {
  const used = new Set()

  return fields.map((field, index) => {
    const explicitKey = slugifyFieldKey(field.field_key)
    const baseFromLabel = slugifyFieldKey(field.label) || `extra_field_${index + 1}`
    const base = explicitKey || baseFromLabel
    let next = base
    let counter = 2
    while (used.has(next)) {
      next = `${base}_${counter}`
      counter += 1
    }
    used.add(next)
    return {
      field_key: next,
      label: String(field.label || '').trim(),
      section_key: field.section_key || 'others',
      display_order: Number(field.display_order || index + 1),
      excel_keywords: deriveKeywordsFromLabel(field.label),
    }
  })
}

function RacmTemplates() {
  const theme = useTheme()
  const [searchParams] = useSearchParams()
  const [units, setUnits] = useState([])
  const [selectedUnitId, setSelectedUnitId] = useState('')
  const [versions, setVersions] = useState([])
  const [selectedTemplateId, setSelectedTemplateId] = useState(null)
  const [templateDetails, setTemplateDetails] = useState(null)
  const [editableExtraFields, setEditableExtraFields] = useState([])
  const [loading, setLoading] = useState(false)
  const [saveDialogOpen, setSaveDialogOpen] = useState(false)
  const [saveMode, setSaveMode] = useState('update_version')
  const [newTemplateName, setNewTemplateName] = useState('')
  const [removeConfirm, setRemoveConfirm] = useState({ open: false, clientId: null, label: '' })
  const [deleteTemplateConfirmOpen, setDeleteTemplateConfirmOpen] = useState(false)
  const [createTemplateDialogOpen, setCreateTemplateDialogOpen] = useState(false)
  const [freshTemplateName, setFreshTemplateName] = useState('')
  const [versionedSaveNoticeOpen, setVersionedSaveNoticeOpen] = useState(true)
  const [assertionInfoDialogOpen, setAssertionInfoDialogOpen] = useState(false)
  const [columnEditor, setColumnEditor] = useState({
    open: false,
    mode: 'view',
    clientId: null,
    label: '',
    sectionKey: 'others',
    fromCatalog: false,
    isNew: false,
    canEditSection: false,
  })
  const assertionWarningShownRef = useRef(null)
  useSyncGlobalLoading(loading)

  const fixedTemplateFields = useMemo(
    () => (Array.isArray(templateDetails?.fixed_fields) ? templateDetails.fixed_fields : []),
    [templateDetails]
  )

  const assertUniqueColumnLabel = (label, { excludeClientId = null, fields = editableExtraFields } = {}) => {
    const duplicate = findDuplicateColumnLabel(label, {
      extraFields: fields,
      fixedFields: fixedTemplateFields,
      excludeClientId,
    })
    if (duplicate) {
      toast.error(`A column with a similar label already exists: "${duplicate}"`)
      return false
    }
    return true
  }

  const assertNoDuplicateLabelsInCommittedFields = (fields) => {
    for (const field of fields) {
      const label = String(field.label || '').trim()
      if (!label) continue
      if (!assertUniqueColumnLabel(label, { excludeClientId: field.clientId, fields })) {
        return false
      }
    }
    return true
  }

  const fetchUnits = async () => {
    setLoading(true)
    try {
      const response = await fetch(apiUrl('/api/company-co/assigned-units'), {
        credentials: 'include',
      })
      const data = await response.json()
      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Failed to load units')
      }
      const list = Array.isArray(data.units) ? data.units : []
      setUnits(list)
      const urlUnitId = String(searchParams.get('unit_id') || '').trim()
      const matchedUnitId = urlUnitId && list.some((unit) => String(unit.unit_id) === urlUnitId)
        ? urlUnitId
        : ''
      if (matchedUnitId) {
        setSelectedUnitId(matchedUnitId)
      } else if (!selectedUnitId && list.length > 0) {
        setSelectedUnitId(String(list[0].unit_id || ''))
      }
    } catch (error) {
      console.error('Failed to fetch units:', error)
      toast.error('Failed to load units')
    } finally {
      setLoading(false)
    }
  }

  const fetchVersions = async (unitId) => {
    const response = await fetch(
      apiUrl(`/api/company-co/racm-templates/versions?unit_id=${encodeURIComponent(unitId)}`),
      { credentials: 'include' }
    )
    const data = await response.json()
    if (!response.ok || !data.success) {
      throw new Error(data.message || 'Failed to load template versions')
    }
    const list = Array.isArray(data.data?.versions) ? data.data.versions : []
    setVersions(list)
    const active = list.find((item) => item.status === 'active')
    if (active) {
      setSelectedTemplateId(active.id)
    } else if (list.length > 0) {
      setSelectedTemplateId(list[0].id)
    } else {
      setSelectedTemplateId(null)
    }
  }

  const fetchTemplateById = async (templateId, unitId) => {
    const response = await fetch(
      apiUrl(`/api/company-co/racm-templates/${encodeURIComponent(templateId)}?unit_id=${encodeURIComponent(unitId)}`),
      { credentials: 'include' }
    )
    const data = await response.json()
    if (!response.ok || !data.success) {
      throw new Error(data.message || 'Failed to load template')
    }
    setTemplateDetails(data.data)
    setColumnEditor({
      open: false,
      mode: 'view',
      clientId: null,
      label: '',
      sectionKey: 'others',
      fromCatalog: false,
      isNew: false,
      canEditSection: false,
    })
    setEditableExtraFields(
      (Array.isArray(data.data?.extra_fields) ? data.data.extra_fields : []).map((field) => ({
        clientId: field.field_key,
        field_key: field.field_key,
        label: field.label,
        section_key: field.section_key || 'others',
        display_order: Number(field.display_order || 0),
        excel_keywords: Array.isArray(field.excel_keywords) ? field.excel_keywords : [],
        isNew: false,
      }))
    )
  }

  useEffect(() => {
    fetchUnits()
  }, [])

  useEffect(() => {
    if (!selectedUnitId) return
    let cancelled = false
    ;(async () => {
      setLoading(true)
      try {
        await fetchVersions(selectedUnitId)
      } catch (error) {
        if (!cancelled) {
          console.error('Failed to fetch versions:', error)
          toast.error(error.message || 'Failed to load template versions')
          setVersions([])
          setTemplateDetails(null)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [selectedUnitId])

  useEffect(() => {
    if (!selectedTemplateId || !selectedUnitId) return
    let cancelled = false
    ;(async () => {
      setLoading(true)
      try {
        await fetchTemplateById(selectedTemplateId, selectedUnitId)
      } catch (error) {
        if (!cancelled) {
          console.error('Failed to fetch template details:', error)
          toast.error(error.message || 'Failed to load template details')
          setTemplateDetails(null)
          setEditableExtraFields([])
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [selectedTemplateId, selectedUnitId])

  const groupedFields = useMemo(() => {
    const sectionLabels = templateDetails?.section_labels || {}
    const fixed = Array.isArray(templateDetails?.fixed_fields) ? templateDetails.fixed_fields : []
    const extras = editableExtraFields
    const result = SECTION_OPTIONS.map((section) => ({
      key: section.key,
      label: sectionLabels[section.key] || section.label,
      fixed: fixed
        .filter((field) => field.section_key === section.key)
        .sort((a, b) => Number(a.display_order || 0) - Number(b.display_order || 0)),
      extras: extras
        .filter((field) => field.section_key === section.key)
        .sort((a, b) => Number(a.display_order || 0) - Number(b.display_order || 0)),
    }))
    return result
  }, [templateDetails, editableExtraFields])

  const hasStructuralChanges = useMemo(() => {
    const original = (Array.isArray(templateDetails?.extra_fields) ? templateDetails.extra_fields : [])
      .map((field) => ({
        field_key: field.field_key,
        label: field.label,
        section_key: field.section_key || 'others',
        display_order: Number(field.display_order || 0),
      }))
      .sort((a, b) => a.field_key.localeCompare(b.field_key))
    const current = [...editableExtraFields]
      .filter((field) => !field.isDraft)
      .map((field) => ({
        field_key: slugifyFieldKey(field.field_key) || slugifyFieldKey(field.label),
        label: String(field.label || '').trim(),
        section_key: field.section_key || 'others',
        display_order: Number(field.display_order || 0),
      }))
      .filter((field) => field.label)
      .sort((a, b) => a.field_key.localeCompare(b.field_key))
    return JSON.stringify(original) !== JSON.stringify(current)
  }, [editableExtraFields, templateDetails])

  const activeTemplate = versions.find((item) => item.status === 'active') || null
  const isSelectedActiveTemplate = activeTemplate?.id === selectedTemplateId
  const canEditExtras = Boolean(isSelectedActiveTemplate && templateDetails)
  const hasExtraColumns = editableExtraFields.length > 0
  const linkedRacmCount = Number(templateDetails?.template?.linked_racm_count || 0)
  const requiresVersionedSave = linkedRacmCount > 0
  const canDeleteTemplateVersion =
    Boolean(templateDetails) &&
    !isSelectedActiveTemplate &&
    linkedRacmCount === 0 &&
    versions.length > 1
  const hasOpenDraft = editableExtraFields.some((field) => field.isDraft)

  const availableCatalogAssertions = useMemo(() => {
    const usedKeys = new Set(editableExtraFields.map((field) => field.field_key).filter(Boolean))
    return RACM_ASSERTION_CATALOG.filter((item) => !usedKeys.has(item.field_key))
  }, [editableExtraFields])

  const allCatalogAssertionsAdded = availableCatalogAssertions.length === 0

  const hasAssertionColumns = useMemo(
    () => editableExtraFields.some(
      (field) => field.section_key === 'assertions' && String(field.label || '').trim()
    ),
    [editableExtraFields]
  )

  useEffect(() => {
    if (!canEditExtras || !templateDetails || !selectedTemplateId) return
    if (hasAssertionColumns) {
      assertionWarningShownRef.current = null
      return
    }
    if (assertionWarningShownRef.current === selectedTemplateId) return
    assertionWarningShownRef.current = selectedTemplateId
    toast(
      'This template has no assertion columns. Add standard or custom columns as per requirements',
      { icon: '⚠️' }
    )
  }, [canEditExtras, templateDetails, selectedTemplateId, hasAssertionColumns])

  useEffect(() => {
    if (requiresVersionedSave) {
      setVersionedSaveNoticeOpen(true)
    }
  }, [selectedTemplateId, requiresVersionedSave])

  const structuralChangeKind = useMemo(() => {
    const original = Array.isArray(templateDetails?.extra_fields) ? templateDetails.extra_fields : []
    const originalKeys = new Set(original.map((field) => field.field_key))
    const originalByKey = new Map(original.map((field) => [field.field_key, field]))
    const currentSavedKeys = new Set(
      editableExtraFields
        .filter((field) => !field.isNew && !field.isDraft && String(field.label || '').trim())
        .map((field) => field.field_key)
    )
    const hasAdditions = editableExtraFields.some(
      (field) => (field.isNew || field.isDraft) && String(field.label || '').trim()
    ) || [...currentSavedKeys].some((key) => !originalKeys.has(key))
    const hasRemovals = [...originalKeys].some((key) => !currentSavedKeys.has(key))
    const hasLabelChanges = editableExtraFields.some((field) => {
      if (field.isNew || field.isDraft) return false
      const existing = originalByKey.get(field.field_key)
      if (!existing) return false
      return String(existing.label || '').trim() !== String(field.label || '').trim()
    })
    const isRenameOnly = hasStructuralChanges && !hasRemovals && !hasAdditions && hasLabelChanges
    return { hasRemovals, hasAdditions, hasLabelChanges, isRenameOnly }
  }, [editableExtraFields, templateDetails, hasStructuralChanges])

  const handleOpenColumnEditor = (clientId) => {
    const field = editableExtraFields.find((item) => item.clientId === clientId)
    if (!field || field.isDraft) return
    setColumnEditor({
      open: true,
      mode: 'view',
      clientId,
      label: field.label || '',
      sectionKey: field.section_key || 'others',
      fromCatalog: Boolean(field.fromCatalog),
      isNew: Boolean(field.isNew),
      canEditSection: !field.fromCatalog && field.section_key !== 'assertions',
    })
  }

  const handleCloseColumnEditor = () => {
    setColumnEditor({
      open: false,
      mode: 'view',
      clientId: null,
      label: '',
      sectionKey: 'others',
      fromCatalog: false,
      isNew: false,
      canEditSection: false,
    })
  }

  const handleEnterColumnEditMode = () => {
    setColumnEditor((prev) => ({ ...prev, mode: 'edit' }))
  }

  const handleCancelColumnEdit = () => {
    const field = editableExtraFields.find((item) => item.clientId === columnEditor.clientId)
    if (!field) {
      handleCloseColumnEditor()
      return
    }
    setColumnEditor((prev) => ({
      ...prev,
      mode: 'view',
      label: field.label || '',
      sectionKey: field.section_key || 'others',
    }))
  }

  const handleColumnEditorSave = () => {
    const field = editableExtraFields.find((item) => item.clientId === columnEditor.clientId)
    const label = String(columnEditor.label || '').trim()
    if (!label) {
      toast.error('Column label is required')
      return
    }
    if (
      requiresVersionedSave &&
      field &&
      !field.isNew &&
      String(field.label || '').trim() !== label
    ) {
      toast.error('Cannot rename custom columns while RACMs are linked to this template.')
      return
    }
    if (!assertUniqueColumnLabel(label, { excludeClientId: columnEditor.clientId })) {
      return
    }
    setEditableExtraFields((prev) =>
      prev.map((item) => {
        if (item.clientId !== columnEditor.clientId) return item
        const next = {
          ...item,
          label,
          section_key: columnEditor.sectionKey,
          draft_section_key: undefined,
        }
        if (!item.fromCatalog) {
          next.excel_keywords = deriveKeywordsFromLabel(label)
        }
        return next
      })
    )
    handleCloseColumnEditor()
  }

  const handleColumnEditorDelete = () => {
    const { clientId, label } = columnEditor
    handleCloseColumnEditor()
    handleRequestRemoveExtraField(clientId, label)
  }

  const handleSaveInline = (clientId) => {
    const field = editableExtraFields.find((item) => item.clientId === clientId)
    const label = String(field?.label || '').trim()
    if (!label) {
      toast.error('Column label is required')
      return
    }
    if (!assertUniqueColumnLabel(label, { excludeClientId: clientId })) {
      return
    }
    setEditableExtraFields((prev) =>
      prev.map((item) => {
        if (item.clientId !== clientId) return item
        const sectionKey = item.draft_section_key ?? item.section_key ?? 'others'
        const next = {
          ...item,
          label,
          section_key: sectionKey,
          isDraft: false,
          draft_section_key: undefined,
        }
        if (!item.fromCatalog) {
          next.excel_keywords = deriveKeywordsFromLabel(label)
        }
        return next
      })
    )
  }

  const handleCancelInline = (clientId) => {
    setEditableExtraFields((prev) => prev.filter((item) => item.clientId !== clientId))
  }

  const appendDraftField = (sectionKey) => {
    if (hasOpenDraft || columnEditor.open) {
      toast.error('Save or cancel the column you are editing first')
      return
    }
    const clientId = `new-${Date.now()}-${editableExtraFields.length}`
    setEditableExtraFields((prev) => [
      ...prev,
      {
        clientId,
        field_key: '',
        label: '',
        section_key: sectionKey,
        display_order: prev.length + 1,
        excel_keywords: [],
        isNew: true,
        isDraft: true,
      },
    ])
  }

  const handleAddCatalogAssertion = (catalogItem) => {
    const exists = editableExtraFields.some((field) => field.field_key === catalogItem.field_key)
    if (exists) {
      toast.error(`${catalogItem.label} is already on this template`)
      return
    }
    if (!assertUniqueColumnLabel(catalogItem.label)) {
      return
    }
    const clientId = `catalog-${catalogItem.field_key}-${Date.now()}`
    setEditableExtraFields((prev) => [
      ...prev,
      {
        clientId,
        field_key: catalogItem.field_key,
        label: catalogItem.label,
        section_key: 'assertions',
        display_order: prev.length + 1,
        excel_keywords: catalogItem.excel_keywords,
        isNew: true,
        fromCatalog: true,
      },
    ])
    toast.success(`Added ${catalogItem.label}`)
  }

  const handleAddAssertionCustomField = () => {
    appendDraftField('assertions')
  }

  const handleAddExtraField = () => {
    appendDraftField('others')
  }

  const handleExtraFieldChange = (clientId, field, value) => {
    setEditableExtraFields((prev) =>
      prev.map((item) => {
        if (item.clientId !== clientId) return item
        if (field === 'section_key') {
          return { ...item, draft_section_key: value }
        }
        const next = { ...item, [field]: value }
        if (field === 'label') {
          next.excel_keywords = deriveKeywordsFromLabel(value)
        }
        return next
      })
    )
  }

  const handleRemoveExtraField = (clientId) => {
    setEditableExtraFields((prev) => prev.filter((item) => item.clientId !== clientId))
  }

  const handleRequestRemoveExtraField = (clientId, label) => {
    const field = editableExtraFields.find((item) => item.clientId === clientId)
    if (requiresVersionedSave && field && !field.isNew) {
      toast.error('Cannot remove custom columns while RACMs are linked to this template.')
      return
    }
    setRemoveConfirm({
      open: true,
      clientId,
      label: String(label || '').trim() || 'this column',
    })
  }

  const handleConfirmRemoveExtraField = () => {
    if (removeConfirm.clientId) {
      if (columnEditor.clientId === removeConfirm.clientId) {
        handleCloseColumnEditor()
      }
      handleRemoveExtraField(removeConfirm.clientId)
    }
    setRemoveConfirm({ open: false, clientId: null, label: '' })
  }

  const handleOpenSaveDialog = () => {
    if (!canEditExtras) {
      toast.error('Only the active template can be edited')
      return
    }
    if (hasOpenDraft || columnEditor.open) {
      toast.error('Save or cancel the column you are editing first')
      return
    }
    if (!hasStructuralChanges) {
      toast.error('No structural changes to save')
      return
    }
    if (structuralChangeKind.hasRemovals && requiresVersionedSave) {
      toast.error('Cannot remove custom columns while RACMs are linked to this template.')
      return
    }
    if (structuralChangeKind.hasLabelChanges && requiresVersionedSave) {
      toast.error('Cannot rename custom columns while RACMs are linked to this template.')
      return
    }
    setSaveMode(requiresVersionedSave ? 'update_version' : 'update_in_place')
    setNewTemplateName('')
    setSaveDialogOpen(true)
  }

  const handleActivateTemplate = async () => {
    if (!selectedTemplateId || !selectedUnitId || !templateDetails) return
    if (templateDetails.template?.status === 'active') {
      toast.error('This template is already active')
      return
    }

    setLoading(true)
    try {
      const response = await fetch(
        apiUrl(`/api/company-co/racm-templates/${encodeURIComponent(selectedTemplateId)}/activate`),
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ unit_id: selectedUnitId }),
        }
      )
      const data = await response.json()
      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Failed to activate template')
      }
      toast.success(data.message || 'Template activated.')
      await fetchVersions(selectedUnitId)
      const activatedId = data.data?.template?.id || selectedTemplateId
      setSelectedTemplateId(activatedId)
      await fetchTemplateById(activatedId, selectedUnitId)
    } catch (error) {
      console.error('Failed to activate template:', error)
      toast.error(error.message || 'Failed to activate template')
    } finally {
      setLoading(false)
    }
  }

  const handleSaveStructure = async (modeOverride) => {
    const committedFields = editableExtraFields.filter((field) => !field.isDraft)
    if (!assertNoDuplicateLabelsInCommittedFields(committedFields)) {
      return
    }
    const normalized = buildNormalizedExtraFields(committedFields)
    const effectiveSaveMode = modeOverride || saveMode

    if (normalized.some((field) => !field.label)) {
      toast.error('Each extra field needs a label')
      return
    }
    if (effectiveSaveMode === 'save_as_new_template' && !String(newTemplateName || '').trim()) {
      toast.error('Please enter new template name')
      return
    }
    if (requiresVersionedSave && effectiveSaveMode === 'update_in_place') {
      toast.error('Linked RACMs require saving as a new version for this change')
      return
    }

    setLoading(true)
    try {
      const response = await fetch(apiUrl('/api/company-co/racm-templates/structural-save'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          unit_id: selectedUnitId,
          save_mode: effectiveSaveMode,
          template_name: effectiveSaveMode === 'save_as_new_template' ? newTemplateName.trim() : undefined,
          extra_fields: normalized,
        }),
      })
      const data = await response.json()
      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Failed to save template changes')
      }
      toast.success(data.message || 'Template changes saved.')
      setSaveDialogOpen(false)
      await fetchVersions(selectedUnitId)
      if (selectedTemplateId) {
        await fetchTemplateById(selectedTemplateId, selectedUnitId)
      }
    } catch (error) {
      console.error('Failed to save template structure:', error)
      toast.error(error.message || 'Failed to save template changes')
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteTemplateVersion = async () => {
    if (!selectedTemplateId || !canDeleteTemplateVersion) return

    setLoading(true)
    try {
      const response = await fetch(
        apiUrl(`/api/company-co/racm-templates/${encodeURIComponent(selectedTemplateId)}`),
        {
          method: 'DELETE',
          credentials: 'include',
        }
      )
      const data = await response.json()
      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Failed to delete template version')
      }
      toast.success(data.message || 'Template version deleted')
      setDeleteTemplateConfirmOpen(false)
      handleCloseColumnEditor()
      await fetchVersions(selectedUnitId)
    } catch (error) {
      console.error('Failed to delete template version:', error)
      toast.error(error.message || 'Failed to delete template version')
    } finally {
      setLoading(false)
    }
  }

  const handleCreateFreshTemplate = async () => {
    const name = freshTemplateName.trim()
    if (!name) {
      toast.error('Template name is required')
      return
    }
    if (!selectedUnitId) {
      toast.error('Select a unit first')
      return
    }

    setLoading(true)
    try {
      const response = await fetch(apiUrl('/api/company-co/racm-templates/create-fresh'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          unit_id: selectedUnitId,
          template_name: name,
        }),
      })
      const data = await response.json()
      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Failed to create template')
      }
      toast.success(data.message || 'Template created')
      setCreateTemplateDialogOpen(false)
      setFreshTemplateName('')
      handleCloseColumnEditor()
      await fetchVersions(selectedUnitId)
      const newId = data.data?.template?.id
      if (newId) {
        setSelectedTemplateId(newId)
      }
    } catch (error) {
      console.error('Failed to create template:', error)
      toast.error(error.message || 'Failed to create template')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Box sx={DASHBOARD_PAGE_OUTER_SX}>
      <Card sx={DASHBOARD_PAPER_SX}>
        <CardContent sx={{ p: { xs: 3, sm: 4 }, '&:last-child': { pb: { xs: 3, sm: 4 } } }}>
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            justifyContent="space-between"
            alignItems={{ xs: 'stretch', sm: 'flex-start' }}
            spacing={2}
            sx={{ mb: 3 }}
          >
            <Box>
              <Typography variant="h5" sx={{ fontWeight: 800, mb: 1 }}>
                RACM Templates
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Select a unit, review template versions, and define extra text columns by section.
              </Typography>
            </Box>
            <Button
              startIcon={<AddRoundedIcon />}
              variant="contained"
              onClick={() => setCreateTemplateDialogOpen(true)}
              disabled={!selectedUnitId}
              sx={{ flexShrink: 0, alignSelf: { xs: 'stretch', sm: 'flex-start' } }}
            >
              Create new template
            </Button>
          </Stack>

          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ mb: 3 }}>
            <FormControl fullWidth sx={{ flex: 1 }}>
              <InputLabel id="racm-template-unit-label">Unit</InputLabel>
              <Select
                labelId="racm-template-unit-label"
                value={selectedUnitId}
                label="Unit"
                onChange={(e) => setSelectedUnitId(e.target.value)}
              >
                {units.map((unit) => (
                  <MenuItem key={unit.unit_id} value={unit.unit_id}>
                    {unit.unit_name || unit.unit_id}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth sx={{ flex: 1 }} disabled={versions.length === 0}>
              <InputLabel id="racm-template-version-label">Available Templates</InputLabel>
              <Select
                labelId="racm-template-version-label"
                value={selectedTemplateId ?? ''}
                label="Available Templates"
                onChange={(e) => setSelectedTemplateId(e.target.value)}
              >
                {versions.map((version) => (
                  <MenuItem key={version.id} value={version.id}>
                    {version.template_name} (v{version.version}) — {version.status}
                    {version.linked_racm_count ? ` · ${version.linked_racm_count} RACM(s)` : ''}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Stack>

          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 1.5 }}>
            <Button
              size="small"
              variant="text"
              startIcon={<LightbulbOutlinedIcon fontSize="small" />}
              onClick={() => setAssertionInfoDialogOpen(true)}
              sx={{
                textTransform: 'none',
                fontWeight: 600,
                color: 'text.secondary',
                px: 1,
              }}
            >
              Assertion
            </Button>
          </Box>

          <Box
            sx={{
              width: '100%',
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 2,
              p: { xs: 2.5, sm: 3 },
            }}
          >
            {templateDetails ? (
              <Stack spacing={2.5}>
                <Box sx={{ position: 'relative' }}>
                  <Stack
                    direction="row"
                    alignItems="center"
                    spacing={1}
                    sx={{
                      position: 'absolute',
                      top: 0,
                      right: 0,
                    }}
                  >
                    {!isSelectedActiveTemplate ? (
                      <Button variant="contained" size="small" onClick={handleActivateTemplate}>
                        Make Active
                      </Button>
                    ) : null}
                    {canDeleteTemplateVersion ? (
                      <Button
                        variant="outlined"
                        size="small"
                        color="error"
                        startIcon={<DeleteOutlineRoundedIcon />}
                        onClick={() => setDeleteTemplateConfirmOpen(true)}
                      >
                        Delete version
                      </Button>
                    ) : null}
                    {hasExtraColumns && isSelectedActiveTemplate ? (
                      <Stack direction="row" alignItems="center" spacing={0.75}>
                        <CustomColumnDot />
                        <Typography variant="caption" color="text.secondary">
                          Custom column
                        </Typography>
                      </Stack>
                    ) : null}
                  </Stack>
                  <Typography
                    variant="h6"
                    sx={{
                      fontWeight: 800,
                      pr: !isSelectedActiveTemplate ? 14 : hasExtraColumns ? 14 : 0,
                    }}
                  >
                    {templateDetails.template?.template_name} (v{templateDetails.template?.version})
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                    {isSelectedActiveTemplate
                      ? requiresVersionedSave
                        ? 'Active template — renaming, adding, or removing custom columns requires a new version.'
                        : 'Active template — no RACMs are linked yet. You may update in place or create a new version.'
                      : 'Archived template — read-only view.'}
                  </Typography>
                  {requiresVersionedSave ? (
                    <Collapse in={versionedSaveNoticeOpen}>
                      <Alert
                        severity="warning"
                        onClose={() => setVersionedSaveNoticeOpen(false)}
                        sx={{ mt: 1, alignItems: 'flex-start' }}
                      >
                        RACMs use this template version. Renaming, adding, or removing custom columns requires a new version.
                      </Alert>
                    </Collapse>
                  ) : null}
                </Box>

                <TemplateColumnListing
                  groupedFields={groupedFields}
                  canEditExtras={canEditExtras}
                  onColumnClick={handleOpenColumnEditor}
                  onExtraFieldChange={handleExtraFieldChange}
                  onSaveInline={handleSaveInline}
                  onCancelInline={handleCancelInline}
                />

                {canEditExtras ? (
                  <Stack direction="row" spacing={1.5} sx={{ pt: 0.5, flexWrap: 'wrap', gap: 1.5 }}>
                    {availableCatalogAssertions.length > 0 ? (
                      <FormControl size="small" sx={{ minWidth: 240 }}>
                        <InputLabel id="add-standard-assertion-label">Add standard assertion</InputLabel>
                        <Select
                          labelId="add-standard-assertion-label"
                          label="Add standard assertion"
                          value=""
                          onChange={(e) => {
                            const item = RACM_ASSERTION_CATALOG.find(
                              (entry) => entry.field_key === e.target.value
                            )
                            if (item) handleAddCatalogAssertion(item)
                          }}
                        >
                          {availableCatalogAssertions.map((item) => (
                            <MenuItem key={item.field_key} value={item.field_key}>
                              {item.label}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    ) : null}
                    {!allCatalogAssertionsAdded ? (
                      <Button
                        startIcon={<AddRoundedIcon />}
                        variant="outlined"
                        onClick={handleAddAssertionCustomField}
                      >
                        Add custom assertion column
                      </Button>
                    ) : null}
                    <Button
                      startIcon={<AddRoundedIcon />}
                      variant="outlined"
                      onClick={handleAddExtraField}
                    >
                      Add custom column (Others)
                    </Button>
                    <Button
                      startIcon={<SaveRoundedIcon />}
                      variant="contained"
                      onClick={handleOpenSaveDialog}
                      disabled={!hasStructuralChanges}
                    >
                      Save Changes
                    </Button>
                  </Stack>
                ) : null}
              </Stack>
            ) : (
              <Typography variant="body2" color="text.secondary">
                {versions.length === 0 ? 'No templates available for this unit.' : 'Select a template to view details.'}
              </Typography>
            )}
          </Box>
        </CardContent>
      </Card>

      <Dialog open={saveDialogOpen} onClose={() => setSaveDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Save Template Changes</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {requiresVersionedSave
              ? 'Existing RACMs keep their current template version (linked via control_forms.template_id). Choose how to save structural changes.'
              : 'No RACMs are linked to this template yet. You can update the current template or create a new version if you prefer.'}
          </Typography>
          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel id="save-mode-label">Save option</InputLabel>
            <Select
              labelId="save-mode-label"
              value={saveMode}
              label="Save option"
              onChange={(e) => setSaveMode(e.target.value)}
            >
              {!requiresVersionedSave ? (
                <MenuItem value="update_in_place">Update Current Template (Recommended)</MenuItem>
              ) : null}
              <MenuItem value="update_version">
                {requiresVersionedSave ? 'Update Version (Recommended)' : 'Create New Version'}
              </MenuItem>
              <MenuItem value="save_as_new_template">Create New Template</MenuItem>
            </Select>
          </FormControl>
          {saveMode === 'save_as_new_template' ? (
            <TextField
              label="New template name"
              fullWidth
              value={newTemplateName}
              onChange={(e) => setNewTemplateName(e.target.value)}
            />
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSaveDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={() => handleSaveStructure()}>
            Save
          </Button>
        </DialogActions>
      </Dialog>

      <CustomColumnEditorDialog
        open={columnEditor.open}
        mode={columnEditor.mode}
        label={columnEditor.label}
        sectionKey={columnEditor.sectionKey}
        fromCatalog={columnEditor.fromCatalog}
        canEditSection={columnEditor.canEditSection}
        canEditLabel={!requiresVersionedSave || columnEditor.isNew}
        canDelete={
          columnEditor.isNew ||
          (!requiresVersionedSave &&
            editableExtraFields.some((field) => field.clientId === columnEditor.clientId && !field.isNew))
        }
        onClose={handleCloseColumnEditor}
        onEdit={handleEnterColumnEditMode}
        onSave={handleColumnEditorSave}
        onDelete={handleColumnEditorDelete}
        onCancelEdit={handleCancelColumnEdit}
        onLabelChange={(value) => setColumnEditor((prev) => ({ ...prev, label: value }))}
        onSectionChange={(value) => setColumnEditor((prev) => ({ ...prev, sectionKey: value }))}
      />

      <Dialog
        open={createTemplateDialogOpen}
        onClose={() => {
          setCreateTemplateDialogOpen(false)
          setFreshTemplateName('')
        }}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Create new template</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2, pt: 0.5 }}>
            Creates a template with fixed columns only. Make it active to add custom columns.
          </Typography>
          <TextField
            label="Template name"
            fullWidth
            autoFocus
            value={freshTemplateName}
            onChange={(e) => setFreshTemplateName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                handleCreateFreshTemplate()
              }
            }}
          />
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setCreateTemplateDialogOpen(false)
              setFreshTemplateName('')
            }}
          >
            Cancel
          </Button>
          <Button variant="contained" onClick={handleCreateFreshTemplate}>
            Create
          </Button>
        </DialogActions>
      </Dialog>

      <AppDialog
        open={assertionInfoDialogOpen}
        onClose={() => setAssertionInfoDialogOpen(false)}
        title="Assertion columns"
        description={ASSERTION_COLUMNS_INFO}
        actions={
          <Button
            variant="contained"
            onClick={() => setAssertionInfoDialogOpen(false)}
            sx={APP_DIALOG_PRIMARY_BUTTON_SX}
          >
            Close
          </Button>
        }
      />

      <AppDialog
        open={deleteTemplateConfirmOpen}
        onClose={() => setDeleteTemplateConfirmOpen(false)}
        title="Delete template version?"
        description={`Delete ${templateDetails?.template?.template_name} (v${templateDetails?.template?.version})? This cannot be undone. Only versions with no linked RACMs can be removed.`}
        actions={
          <>
            <Button
              variant="outlined"
              onClick={() => setDeleteTemplateConfirmOpen(false)}
              sx={getAppDialogCancelButtonSx(theme)}
            >
              Cancel
            </Button>
            <Button
              variant="contained"
              color="error"
              onClick={handleDeleteTemplateVersion}
              sx={APP_DIALOG_PRIMARY_BUTTON_SX}
            >
              Delete version
            </Button>
          </>
        }
      />

      <AppDialog
        open={removeConfirm.open}
        onClose={() => setRemoveConfirm({ open: false, clientId: null, label: '' })}
        title="Remove custom column?"
        description={`Remove "${removeConfirm.label}" from this template? You must save changes for this to take effect.`}
        actions={
          <>
            <Button
              variant="outlined"
              onClick={() => setRemoveConfirm({ open: false, clientId: null, label: '' })}
              sx={getAppDialogCancelButtonSx(theme)}
            >
              Cancel
            </Button>
            <Button
              variant="contained"
              color="error"
              onClick={handleConfirmRemoveExtraField}
              sx={APP_DIALOG_PRIMARY_BUTTON_SX}
            >
              Remove
            </Button>
          </>
        }
      />
    </Box>
  )
}

export default RacmTemplates
