import { jsPDF } from 'jspdf'

function safeText(value) {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim()
}

function addWrapped(doc, text, x, y, maxWidth, lineHeight = 5) {
  const lines = doc.splitTextToSize(safeText(text), maxWidth)
  doc.text(lines, x, y)
  return y + lines.length * lineHeight
}

function ensureSpace(doc, y, needed = 20, marginBottom = 20) {
  const pageHeight = doc.internal.pageSize.getHeight()
  if (y + needed > pageHeight - marginBottom) {
    doc.addPage()
    return 20
  }
  return y
}

/**
 * Build and download a Design Gap report PDF from API report payload.
 */
export function downloadDesignGapReportPdf(reportData) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const margin = 16
  const maxWidth = pageWidth - margin * 2
  let y = 20

  const meta = reportData?.meta || {}
  const summary = reportData?.summary || {}
  const controls = Array.isArray(reportData?.controls) ? reportData.controls : []

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.text('Design Gap Report', margin, y)
  y += 8

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  y = addWrapped(
    doc,
    `Unit: ${meta.unit_name || meta.unit_id || '—'}  |  BP: ${meta.business_process || '—'}  |  FY: ${meta.financial_year || '—'}`,
    margin,
    y,
    maxWidth
  )
  y += 2
  y = addWrapped(
    doc,
    `Company: ${meta.company_identifier || '—'}  |  Controls reviewed: ${summary.controls_reviewed ?? controls.length}`,
    margin,
    y,
    maxWidth
  )
  y += 2
  y = addWrapped(
    doc,
    `Control status counts: ${JSON.stringify(summary.control_design_status_counts || {})}`,
    margin,
    y,
    maxWidth
  )
  y = addWrapped(
    doc,
    `Check status counts: ${JSON.stringify(summary.status_counts || {})}`,
    margin,
    y,
    maxWidth
  )
  const tokens = summary.token_usage || {}
  y = addWrapped(
    doc,
    `Tokens — prompt: ${tokens.prompt_tokens ?? 0}, completion: ${tokens.completion_tokens ?? 0}, total: ${tokens.total_tokens ?? 0}`,
    margin,
    y,
    maxWidth
  )
  y += 6

  const writeSectionTitle = (title) => {
    y = ensureSpace(doc, y, 12)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(12)
    doc.text(title, margin, y)
    y += 6
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
  }

  // Good design
  writeSectionTitle('Good design (no gaps)')
  const good = controls.filter((c) => c.control_design_status === 'good_design')
  if (good.length === 0) {
    y = addWrapped(doc, 'None', margin, y, maxWidth)
    y += 3
  } else {
    for (const c of good) {
      y = ensureSpace(doc, y, 10)
      y = addWrapped(doc, `• ${c.control_number || c.form_id}: ${c.summary || ''}`, margin, y, maxWidth)
      y += 1
    }
    y += 3
  }

  // Has gaps
  writeSectionTitle('Flagged (has gaps)')
  const gaps = controls.filter((c) => c.control_design_status === 'has_gaps')
  if (gaps.length === 0) {
    y = addWrapped(doc, 'None', margin, y, maxWidth)
    y += 3
  } else {
    for (const c of gaps) {
      y = ensureSpace(doc, y, 16)
      doc.setFont('helvetica', 'bold')
      y = addWrapped(doc, `${c.control_number || c.form_id}`, margin, y, maxWidth)
      doc.setFont('helvetica', 'normal')
      y = addWrapped(doc, `Overall: ${c.summary || ''}`, margin, y, maxWidth)
      const flagged = (c.results || []).filter((r) => r.status === 'flagged')
      for (const r of flagged) {
        y = ensureSpace(doc, y, 18)
        y = addWrapped(doc, `- ${r.check_id}: ${r.inconsistency || ''}`, margin + 2, y, maxWidth - 2)
        if (Array.isArray(r.evidence) && r.evidence.length) {
          y = addWrapped(doc, `  Evidence: ${r.evidence.join(' | ')}`, margin + 4, y, maxWidth - 4)
        }
        if (r.recommendation) {
          y = addWrapped(doc, `  Recommendation: ${r.recommendation}`, margin + 4, y, maxWidth - 4)
        }
        y += 1
      }
      y += 3
    }
  }

  // Insufficient data
  writeSectionTitle('Insufficient data')
  let insufAny = false
  for (const c of controls) {
    const insuf = (c.results || []).filter((r) => r.status === 'insufficient_data')
    if (!insuf.length) continue
    insufAny = true
    y = ensureSpace(doc, y, 14)
    doc.setFont('helvetica', 'bold')
    y = addWrapped(doc, `${c.control_number || c.form_id}`, margin, y, maxWidth)
    doc.setFont('helvetica', 'normal')
    for (const r of insuf) {
      y = ensureSpace(doc, y, 12)
      const evidence = Array.isArray(r.evidence) && r.evidence.length ? ` — ${r.evidence.join('; ')}` : ''
      y = addWrapped(
        doc,
        `- ${r.check_id} (${r.source || ''}): ${r.inconsistency || ''}${evidence}`,
        margin + 2,
        y,
        maxWidth - 2
      )
    }
    y += 2
  }
  if (!insufAny) {
    y = addWrapped(doc, 'None', margin, y, maxWidth)
  }

  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')
  const unitPart = safeText(meta.unit_id || 'unit').replace(/[^\w.-]+/g, '_')
  const bpPart = safeText(meta.business_process || 'bp').replace(/[^\w.-]+/g, '_')
  doc.save(`design_gap_report_${unitPart}_${bpPart}_${stamp}.pdf`)
}
