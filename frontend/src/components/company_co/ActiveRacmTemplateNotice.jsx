import React, { useEffect, useMemo, useState } from 'react'
import { Alert, Collapse } from '@mui/material'
import { apiUrl } from '../../config/api'
import { LIGHT_MODE_ALERT_SX } from '../../uiConstants'

function buildNoticeMessage(variant, summary) {
  const templateLabel = summary
    ? ` (${summary.templateName}${summary.version != null ? ` v${summary.version}` : ''})`
    : ''

  if (variant === 'manual') {
    return `Manual RACM creation uses the active RACM template for the selected unit${templateLabel}. The form fields below follow that template, including any custom or assertion columns.${
      summary?.extraFieldCount === 0
        ? ' This template has no extra columns yet — only fixed fields are shown unless you add columns in RACM Templates.'
        : ''
    }`
  }

  return `Bulk import uses the active RACM template for the selected unit${templateLabel}. Standard columns are matched from Excel headers automatically; custom and assertion columns defined on that template are detected using template keywords during automatic or manual column mapping. Imported RACMs are linked to this template version.${
    summary?.extraFieldCount === 0
      ? ' This template has no extra columns yet — only fixed fields will be imported unless you add columns in RACM Templates.'
      : ''
  }`
}

/**
 * Dismissible info alert for the active unit RACM template.
 * Re-opens when unitId changes so coordinators see which template applies.
 */
export default function ActiveRacmTemplateNotice({
  unitId,
  variant = 'bulk',
  templateSummary = null,
  useParentSummary = false,
  onLoadingChange,
  sx,
}) {
  const [open, setOpen] = useState(Boolean(unitId))
  const [fetchedSummary, setFetchedSummary] = useState(null)
  const [loading, setLoading] = useState(false)

  const normalizedUnitId = String(unitId || '').trim()

  useEffect(() => {
    if (normalizedUnitId) {
      setOpen(true)
    }
  }, [normalizedUnitId])

  useEffect(() => {
    if (useParentSummary) {
      onLoadingChange?.(false)
      return undefined
    }

    if (!normalizedUnitId) {
      setFetchedSummary(null)
      setLoading(false)
      onLoadingChange?.(false)
      return undefined
    }

    let cancelled = false
    setLoading(true)
    onLoadingChange?.(true)
    ;(async () => {
      try {
        const response = await fetch(
          apiUrl(`/api/company-co/racm-templates?unit_id=${encodeURIComponent(normalizedUnitId)}`),
          { credentials: 'include' }
        )
        const data = await response.json()
        if (cancelled) return
        if (response.ok && data.success) {
          const template = data.data?.template || {}
          const extraFields = Array.isArray(data.data?.extra_fields) ? data.data.extra_fields : []
          setFetchedSummary({
            templateName: template.template_name || 'Default',
            version: template.version,
            extraFieldCount: extraFields.length,
          })
        } else {
          setFetchedSummary(null)
        }
      } catch (error) {
        if (!cancelled) {
          console.error('Failed to load active template notice:', error)
          setFetchedSummary(null)
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
          onLoadingChange?.(false)
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [normalizedUnitId, useParentSummary, onLoadingChange])

  const summary = useMemo(() => {
    if (useParentSummary) {
      if (!templateSummary) return null
      return {
        templateName: templateSummary.templateName || templateSummary.template_name || 'Default',
        version: templateSummary.version,
        extraFieldCount: Number(
          templateSummary.extraFieldCount ?? templateSummary.extra_field_count ?? 0
        ),
      }
    }
    return fetchedSummary
  }, [useParentSummary, templateSummary, fetchedSummary])

  if (!normalizedUnitId) return null

  return (
    <Collapse in={open} sx={sx}>
      <Alert
        severity="info"
        onClose={() => setOpen(false)}
        sx={{
          borderRadius: 2,
          boxShadow: '0 8px 24px rgba(15, 23, 42, 0.08)',
          ...LIGHT_MODE_ALERT_SX.info,
        }}
      >
        {loading && !summary
          ? (variant === 'manual'
            ? 'Loading active RACM template for the selected unit…'
            : 'Loading active RACM template for the selected unit…')
          : buildNoticeMessage(variant, summary)}
      </Alert>
    </Collapse>
  )
}
