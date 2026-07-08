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
  Divider,
  FormControl,
  InputLabel,
  List,
  ListItemButton,
  ListItemText,
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
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined'
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

function buildGroupedFieldsFromDetails(details, extras = null) {
  const sectionLabels = details?.section_labels || {}
  const fixed = Array.isArray(details?.fixed_fields) ? details.fixed_fields : []
  const extraSource = extras ?? (Array.isArray(details?.extra_fields) ? details.extra_fields : [])
  return SECTION_OPTIONS.map((section) => ({
    key: section.key,
    label: sectionLabels[section.key] || section.label,
    fixed: fixed
      .filter((field) => field.section_key === section.key)
      .sort((a, b) => Number(a.display_order || 0) - Number(b.display_order || 0)),
    extras: extraSource
      .filter((field) => field.section_key === section.key)
      .sort((a, b) => Number(a.display_order || 0) - Number(b.display_order || 0))
      .map((field) => ({
        ...field,
        clientId: field.clientId || field.field_key,
      })),
  }))
}

function CustomColumnEditorDialog({
  open,
  mode,
  label,
  sectionKey,
  fromCatalog,
  canEditSection,
  canEditLabel = true,
  saveRequiresNewVersion = false,
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
      <DialogTitle sx={{ px: 3, pt: 2.5, pb: 2, fontWeight: 700 }}>
        {isEditing ? 'Edit custom column' : 'Custom column'}
      </DialogTitle>
      <DialogContent sx={{ px: 3, mt: 1.5 }}>
        {isEditing ? (
          <Stack spacing={2}>
            <TextField
              label="Column label"
              value={label}
              onChange={(e) => onLabelChange(e.target.value)}
              fullWidth
              autoFocus
              disabled={!canEditLabel}
              helperText={
                saveRequiresNewVersion
                  ? 'You can edit here; saving template changes will require a new version or new template.'
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
          <Stack spacing={1}>
            <Typography variant="body1" sx={{ fontWeight: 600 }}>
              {String(label || '').trim() || 'New column'}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Section: {getSectionLabel(sectionKey)}
            </Typography>
          </Stack>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pt: 1, pb: 2.5 }}>
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

function TemplateColumnListing({ groupedFields, canEditExtras, onColumnClick }) {
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
                const displayLabel = String(field.label || '').trim() || (field.isDraft ? 'New custom column' : field.label)

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
                        {displayLabel}
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

function mapEditableFieldForComparison(field) {
  if (field.isDraft) {
    const label = String(field.label || '').trim()
    if (!label) return null
    const sectionKey = field.draft_section_key ?? field.section_key ?? 'others'
    return {
      field_key: slugifyFieldKey(field.field_key) || slugifyFieldKey(label),
      label,
      section_key: sectionKey,
      display_order: Number(field.display_order || 0),
    }
  }

  return {
    field_key: slugifyFieldKey(field.field_key) || slugifyFieldKey(field.label),
    label: String(field.label || '').trim(),
    section_key: field.section_key || 'others',
    display_order: Number(field.display_order || 0),
  }
}

function finalizeEditableExtraFields(fields) {
  return fields
    .map((item) => {
      if (!item.isDraft) return item

      const label = String(item.label || '').trim()
      if (!label) return null

      const sectionKey = item.draft_section_key ?? item.section_key ?? 'others'
      return {
        ...item,
        label,
        section_key: sectionKey,
        isDraft: false,
        draft_section_key: undefined,
        excel_keywords: item.fromCatalog ? item.excel_keywords : deriveKeywordsFromLabel(label),
      }
    })
    .filter(Boolean)
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
  const [importListDialogOpen, setImportListDialogOpen] = useState(false)
  const [importCatalogUnits, setImportCatalogUnits] = useState([])
  const [importPreviewDialogOpen, setImportPreviewDialogOpen] = useState(false)
  const [importSourceMeta, setImportSourceMeta] = useState(null)
  const [importPreviewDetails, setImportPreviewDetails] = useState(null)
  const [importTemplateName, setImportTemplateName] = useState('')
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
    return buildGroupedFieldsFromDetails(templateDetails, editableExtraFields)
  }, [templateDetails, editableExtraFields])

  const importPreviewGroupedFields = useMemo(
    () => buildGroupedFieldsFromDetails(importPreviewDetails),
    [importPreviewDetails]
  )

  const importableCatalogUnits = useMemo(() => {
    const currentUnitId = String(selectedUnitId || '').trim()
    return importCatalogUnits
      .filter((unit) => String(unit.unit_id) !== currentUnitId)
      .map((unit) => ({
        ...unit,
        templates: Array.isArray(unit.templates) ? unit.templates : [],
      }))
      .filter((unit) => unit.templates.length > 0)
  }, [importCatalogUnits, selectedUnitId])

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
      .map(mapEditableFieldForComparison)
      .filter((field) => field && field.label)
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

  const handleOpenColumnEditor = (clientId, { startInEditMode = false } = {}) => {
    const field = editableExtraFields.find((item) => item.clientId === clientId)
    if (!field) return
    const sectionKey = field.draft_section_key ?? field.section_key ?? 'others'
    setColumnEditor({
      open: true,
      mode: startInEditMode ? 'edit' : 'view',
      clientId,
      label: field.label || '',
      sectionKey,
      fromCatalog: Boolean(field.fromCatalog),
      isNew: Boolean(field.isNew),
      canEditSection: !field.fromCatalog && sectionKey !== 'assertions',
    })
  }

  const resetColumnEditor = () => {
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

  const handleDialogClose = () => {
    if (columnEditor.mode === 'edit') {
      handleCancelColumnEdit()
      return
    }
    resetColumnEditor()
  }

  const handleEnterColumnEditMode = () => {
    setColumnEditor((prev) => ({ ...prev, mode: 'edit' }))
  }

  const handleCancelColumnEdit = () => {
    const field = editableExtraFields.find((item) => item.clientId === columnEditor.clientId)
    if (!field || field.isDraft) {
      resetColumnEditor()
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
    const label = String(columnEditor.label || '').trim()
    if (!label) {
      toast.error('Column label is required')
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
          isDraft: false,
        }
        if (!item.fromCatalog) {
          next.excel_keywords = deriveKeywordsFromLabel(label)
        }
        return next
      })
    )
    resetColumnEditor()
  }

  const handleColumnEditorDelete = () => {
    const { clientId, label } = columnEditor
    const field = editableExtraFields.find((item) => item.clientId === clientId)
    resetColumnEditor()
    if (field?.isDraft || field?.isNew) {
      handleRemoveExtraField(clientId)
      return
    }
    handleRequestRemoveExtraField(clientId, label)
  }

  const appendDraftField = (sectionKey) => {
    if (columnEditor.open) {
      toast.error('Close the column editor first')
      return
    }
    if (editableExtraFields.some((field) => field.isDraft)) {
      toast.error('Finish or delete the new column before adding another')
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
    setColumnEditor({
      open: true,
      mode: 'edit',
      clientId,
      label: '',
      sectionKey: sectionKey,
      fromCatalog: false,
      isNew: true,
      canEditSection: sectionKey !== 'assertions',
    })
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

  const handleAddExtraField = () => {
    appendDraftField('others')
  }

  const handleRemoveExtraField = (clientId) => {
    setEditableExtraFields((prev) => prev.filter((item) => item.clientId !== clientId))
  }

  const handleRequestRemoveExtraField = (clientId, label) => {
    setRemoveConfirm({
      open: true,
      clientId,
      label: String(label || '').trim() || 'this column',
    })
  }

  const handleConfirmRemoveExtraField = () => {
    if (removeConfirm.clientId) {
      if (columnEditor.clientId === removeConfirm.clientId) {
        resetColumnEditor()
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
    if (columnEditor.open) {
      toast.error('Close the column editor first')
      return
    }
    const hasIncompleteDraft = editableExtraFields.some(
      (field) => field.isDraft && !String(field.label || '').trim()
    )
    if (hasIncompleteDraft) {
      toast.error('Enter a label for each new column before saving')
      return
    }
    if (!hasStructuralChanges) {
      toast.error('No structural changes to save')
      return
    }
    setSaveMode(requiresVersionedSave ? 'update_version' : 'update_in_place')
    setNewTemplateName('')
    setSaveDialogOpen(true)
  }

  const handleOpenImportListDialog = async () => {
    if (!selectedUnitId) {
      toast.error('Select a unit first')
      return
    }

    setLoading(true)
    try {
      const response = await fetch(apiUrl('/api/company-co/racm-templates/import-catalog'), {
        credentials: 'include',
      })
      const data = await response.json()
      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Failed to load templates for import')
      }
      setImportCatalogUnits(Array.isArray(data.data?.units) ? data.data.units : [])
      setImportListDialogOpen(true)
    } catch (error) {
      console.error('Failed to load import catalog:', error)
      toast.error(error.message || 'Failed to load templates for import')
    } finally {
      setLoading(false)
    }
  }

  const handleCloseImportListDialog = () => {
    setImportListDialogOpen(false)
  }

  const handleCloseImportPreviewDialog = () => {
    setImportPreviewDialogOpen(false)
    setImportSourceMeta(null)
    setImportPreviewDetails(null)
    setImportTemplateName('')
  }

  const handleOpenImportPreview = async (unitMeta, templateMeta) => {
    setLoading(true)
    try {
      const response = await fetch(
        apiUrl(`/api/company-co/racm-templates/import-catalog/${encodeURIComponent(templateMeta.id)}`),
        { credentials: 'include' }
      )
      const data = await response.json()
      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Failed to load template preview')
      }
      setImportSourceMeta({
        unit_id: unitMeta.unit_id,
        unit_name: unitMeta.unit_name,
        template_id: templateMeta.id,
        template_name: templateMeta.template_name,
        version: templateMeta.version,
        status: templateMeta.status,
      })
      setImportPreviewDetails(data.data)
      setImportTemplateName('')
      setImportListDialogOpen(false)
      setImportPreviewDialogOpen(true)
    } catch (error) {
      console.error('Failed to load import preview:', error)
      toast.error(error.message || 'Failed to load template preview')
    } finally {
      setLoading(false)
    }
  }

  const handleImportTemplate = async () => {
    const name = String(importTemplateName || '').trim()
    if (!name) {
      toast.error('Template name is required')
      return
    }
    if (!selectedUnitId || !importSourceMeta?.template_id) {
      toast.error('Select a template to import')
      return
    }

    setLoading(true)
    try {
      const response = await fetch(apiUrl('/api/company-co/racm-templates/import'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          target_unit_id: selectedUnitId,
          source_template_id: importSourceMeta.template_id,
          template_name: name,
        }),
      })
      const data = await response.json()
      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Failed to import template')
      }
      toast.success(data.message || 'Template imported successfully')
      handleCloseImportPreviewDialog()
      await fetchVersions(selectedUnitId)
      const importedId = data.data?.template?.id
      if (importedId) {
        setSelectedTemplateId(importedId)
        await fetchTemplateById(importedId, selectedUnitId)
      }
    } catch (error) {
      console.error('Failed to import template:', error)
      toast.error(error.message || 'Failed to import template')
    } finally {
      setLoading(false)
    }
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
    const committedFields = finalizeEditableExtraFields(editableExtraFields)
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
      const savedTemplateId = data.data?.template?.id
      if (savedTemplateId && !data.data?.updated_in_place) {
        setSelectedTemplateId(savedTemplateId)
        await fetchTemplateById(savedTemplateId, selectedUnitId)
      } else if (selectedTemplateId) {
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
      resetColumnEditor()
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
      resetColumnEditor()
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
            <Stack direction="row" spacing={1.5} sx={{ flexShrink: 0, alignSelf: { xs: 'stretch', sm: 'flex-start' } }}>
              <Button
                startIcon={<FileDownloadOutlinedIcon />}
                variant="outlined"
                onClick={handleOpenImportListDialog}
                disabled={!selectedUnitId}
              >
                Import
              </Button>
              <Button
                startIcon={<AddRoundedIcon />}
                variant="contained"
                onClick={() => setCreateTemplateDialogOpen(true)}
                disabled={!selectedUnitId}
              >
                Create new template
              </Button>
            </Stack>
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
                        ? 'Active template — you can edit labels and remove columns here; saving requires a new version or new template.'
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
                        RACMs use this template version. You can edit labels and remove columns, but saving changes requires a new version or new template.
                      </Alert>
                    </Collapse>
                  ) : null}
                </Box>

                <TemplateColumnListing
                  groupedFields={groupedFields}
                  canEditExtras={canEditExtras}
                  onColumnClick={handleOpenColumnEditor}
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
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3, mt: 1.5 }}>
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
                {requiresVersionedSave ? 'Update Version (Recommended)' : 'Update Version'}
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
        canEditLabel
        saveRequiresNewVersion={requiresVersionedSave}
        canDelete={editableExtraFields.some((field) => field.clientId === columnEditor.clientId)}
        onClose={handleDialogClose}
        onEdit={handleEnterColumnEditMode}
        onSave={handleColumnEditorSave}
        onDelete={handleColumnEditorDelete}
        onCancelEdit={handleCancelColumnEdit}
        onLabelChange={(value) => setColumnEditor((prev) => ({ ...prev, label: value }))}
        onSectionChange={(value) => setColumnEditor((prev) => ({ ...prev, sectionKey: value }))}
      />

      <Dialog
        open={importListDialogOpen}
        onClose={handleCloseImportListDialog}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ px: 3, py:2, fontWeight: 700 }}>
          Import template from another unit
        </DialogTitle>
        <DialogContent sx={{ px: 3, pt: 2.5, pb: 1 }}>
          <Typography variant="body2" color="text.secondary" sx={{ my: 1 }}>
            Select a template from any unit in your company. It will be copied with all custom columns into{' '}
            {units.find((unit) => String(unit.unit_id) === String(selectedUnitId))?.unit_name || 'the selected unit'}.
          </Typography>
          {importableCatalogUnits.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              No templates are available to import from other units.
            </Typography>
          ) : (
            <List disablePadding>
              {importableCatalogUnits.map((unit, unitIndex) => (
                <Box key={unit.unit_id}>
                  {unitIndex > 0 ? <Divider sx={{ my: 1 }} /> : null}
                  <Typography
                    variant="subtitle2"
                    sx={{
                      px: 1,
                      py: 1,
                      fontWeight: 800,
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                      color: 'text.secondary',
                    }}
                  >
                    {unit.unit_name || unit.unit_id}
                  </Typography>
                  {unit.templates.map((template) => (
                    <ListItemButton
                      key={template.id}
                      onClick={() => handleOpenImportPreview(unit, template)}
                      sx={{ borderRadius: 1.5, mb: 0.5 }}
                    >
                      <ListItemText
                        primary={`${template.template_name} (v${template.version})`}
                        secondary={[
                          template.status,
                          template.linked_racm_count ? `${template.linked_racm_count} RACM(s)` : null,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      />
                    </ListItemButton>
                  ))}
                </Box>
              ))}
            </List>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pt: 1, pb: 2.5 }}>
          <Button onClick={handleCloseImportListDialog}>Close</Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={importPreviewDialogOpen}
        onClose={handleCloseImportPreviewDialog}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle sx={{ px: 3, pt: 2.5, mb: 1, fontWeight: 700 }}>
          Import template preview
        </DialogTitle>
        <DialogContent sx={{ px: 3, mt: 1.5 }}>
          {importPreviewDetails ? (
            <Stack spacing={2}>
              <Box>
                <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                  {importSourceMeta?.template_name} (v{importSourceMeta?.version})
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Source unit: {importSourceMeta?.unit_name || importSourceMeta?.unit_id}
                  {importSourceMeta?.status ? ` · ${importSourceMeta.status}` : ''}
                </Typography>
              </Box>
              <Box
                sx={{
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: 2,
                  p: { xs: 2, sm: 2.5 },
                }}
              >
                <TemplateColumnListing
                  groupedFields={importPreviewGroupedFields}
                  canEditExtras={false}
                  onColumnClick={() => {}}
                  onExtraFieldChange={() => {}}
                  onSaveInline={() => {}}
                  onCancelInline={() => {}}
                />
              </Box>
              <TextField
                label="New template name"
                fullWidth
                autoFocus
                value={importTemplateName}
                onChange={(e) => setImportTemplateName(e.target.value)}
                helperText="This name will be used for the imported template in the current unit."
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    handleImportTemplate()
                  }
                }}
              />
            </Stack>
          ) : null}
        </DialogContent>
        <DialogActions sx={{ px: 3, pt: 1, pb: 2.5 }}>
          <Button onClick={handleCloseImportPreviewDialog}>Cancel</Button>
          <Button variant="contained" onClick={handleImportTemplate} disabled={!importPreviewDetails}>
            Import
          </Button>
        </DialogActions>
      </Dialog>

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
