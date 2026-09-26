import { jsPDF } from 'jspdf'

function safeText(value) {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Convert snake_case / kebab-case ids to Title Case labels. */
export function humanizeCheckLabel(value) {
  const raw = String(value || '').trim()
  if (!raw) return '—'
  return raw
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

function formatFieldIssue(raw) {
  const text = String(raw || '').trim()
  const emptyMatch = text.match(/^([a-z0-9_.*]+) is empty$/i)
  if (emptyMatch) {
    return `${humanizeCheckLabel(emptyMatch[1])} field is empty`
  }
  const notAllowed = text.match(/^([a-z0-9_]+)=(.+?) not in allowed/i)
  if (notAllowed) {
    return `${humanizeCheckLabel(notAllowed[1])} value ${notAllowed[2].trim()} is not allowed`
  }
  return text.replace(/_/g, ' ')
}

/** Report line for an insufficient-data check, without raw field keys or tags. */
export function formatInsufficientCheckLine(result) {
  const title = humanizeCheckLabel(result?.check_id)
  const evidence = Array.isArray(result?.evidence) ? result.evidence : []
  const details = evidence.map(formatFieldIssue).filter(Boolean)
  if (details.length) return `${title} : ${details.join('; ')}`
  const note = String(result?.alignment_rationale || result?.inconsistency || '').trim()
  if (note) return `${title} : ${note.replace(/_/g, ' ')}`
  return title
}

function getControlStatusCounts(reportData) {
  const fromSummary = reportData?.summary?.control_design_status_counts || {}
  const controls = Array.isArray(reportData?.controls) ? reportData.controls : []
  if (Object.keys(fromSummary).length > 0) {
    return {
      withoutGaps: Number(fromSummary.good_design || 0),
      gaps: Number(fromSummary.has_gaps || 0),
      insufficientData: Number(fromSummary.insufficient_data || 0),
      reviewed: Number(reportData?.summary?.controls_reviewed ?? controls.length),
    }
  }
  let withoutGaps = 0
  let gaps = 0
  let insufficientData = 0
  for (const c of controls) {
    const status = String(c.control_design_status || '').toLowerCase()
    if (status === 'good_design') withoutGaps += 1
    else if (status === 'has_gaps') gaps += 1
    else if (status === 'insufficient_data') insufficientData += 1
  }
  return {
    withoutGaps,
    gaps,
    insufficientData,
    reviewed: controls.length,
  }
}

export function getDesignGapSummaryCounts(reportData) {
  return getControlStatusCounts(reportData)
}

function addWrapped(doc, text, x, y, maxWidth, lineHeight = 5) {
  const lines = doc.splitTextToSize(safeText(text), maxWidth)
  doc.text(lines, x, y)
  return y + lines.length * lineHeight
}

function ensureSpace(doc, y, needed = 20, marginBottom = 18) {
  const pageHeight = doc.internal.pageSize.getHeight()
  if (y + needed > pageHeight - marginBottom) {
    doc.addPage()
    return 18
  }
  return y
}

const COLORS = {
  black: [17, 17, 17],
  text: [33, 33, 33],
  muted: [100, 100, 100],
  lightGray: [160, 160, 160],
  line: [210, 210, 210],
  green: [22, 163, 74],
  red: [185, 28, 28],
}

/**
 * Build and download a Design Gap report PDF from API report payload.
 */
export function downloadDesignGapReportPdf(reportData) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 16
  const contentWidth = pageWidth - margin * 2
  let y = 20

  const meta = reportData?.meta || {}
  const controls = Array.isArray(reportData?.controls) ? reportData.controls : []
  const counts = getControlStatusCounts(reportData)

  const companyName = safeText(meta.company_name) || '—'
  const unitName = safeText(meta.unit_name) || '—'
  const businessProcess = safeText(meta.business_process || '—')
  const financialYear = safeText(meta.financial_year || '—')

  // Title
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.setTextColor(...COLORS.black)
  doc.text('Design Gap Report', margin, y)
  y += 8

  // Company | Unit, and Business process in header area
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(...COLORS.text)
  y = addWrapped(doc, `${companyName}  |  ${unitName}`, margin, y, contentWidth, 5)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  y = addWrapped(doc, businessProcess, margin, y + 1, contentWidth, 5)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...COLORS.muted)
  y = addWrapped(doc, `Financial year: ${financialYear}   ·   Controls reviewed: ${counts.reviewed}`, margin, y + 1, contentWidth, 4.5)
  y += 3
  doc.setDrawColor(...COLORS.line)
  doc.setLineWidth(0.35)
  doc.line(margin, y, pageWidth - margin, y)
  y += 8

  // Summary — one row, label and value kept close
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(...COLORS.black)
  doc.text('Summary', margin, y)
  y += 7

  const summaryItems = [
    { label: 'No Design Gap', value: counts.withoutGaps, tone: 'good' },
    { label: 'Gaps', value: counts.gaps, tone: 'bad' },
    { label: 'Insufficient data', value: counts.insufficientData, tone: 'neutral' },
  ]
  let x = margin
  for (let i = 0; i < summaryItems.length; i += 1) {
    const item = summaryItems[i]
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.setTextColor(...COLORS.text)
    const labelPart = `${item.label}: `
    doc.text(labelPart, x, y)
    x += doc.getTextWidth(labelPart)

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    if (item.tone === 'good') doc.setTextColor(...COLORS.green)
    else if (item.tone === 'bad') doc.setTextColor(...COLORS.red)
    else doc.setTextColor(...COLORS.black)
    const valuePart = String(item.value)
    doc.text(valuePart, x, y)
    x += doc.getTextWidth(valuePart)

    if (i < summaryItems.length - 1) {
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(...COLORS.muted)
      const sep = '     '
      doc.text(sep, x, y)
      x += doc.getTextWidth(sep)
    }
  }
  y += 10

  const drawSectionTitle = (title) => {
    y = ensureSpace(doc, y, 12)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(12)
    doc.setTextColor(...COLORS.black)
    doc.text(title, margin, y)
    y += 2
    doc.setDrawColor(...COLORS.line)
    doc.setLineWidth(0.3)
    doc.line(margin, y, pageWidth - margin, y)
    y += 6
  }

  const drawEmpty = () => {
    doc.setFont('helvetica', 'italic')
    doc.setFontSize(9)
    doc.setTextColor(...COLORS.muted)
    doc.text('None', margin, y)
    doc.setTextColor(...COLORS.text)
    y += 7
  }

  // Gaps
  drawSectionTitle('Gaps')
  const gaps = controls.filter((c) => (c.results || []).some((r) => r.status === 'flagged'))
  if (gaps.length === 0) {
    drawEmpty()
  } else {
    for (const c of gaps) {
      const flagged = (c.results || []).filter((r) => r.status === 'flagged')
      y = ensureSpace(doc, y, 16)

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(10)
      doc.setTextColor(...COLORS.black)
      y = addWrapped(doc, String(c.control_number || c.form_id || 'Control'), margin, y, contentWidth, 4.5)

      if (c.summary) {
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(9)
        doc.setTextColor(...COLORS.muted)
        y = addWrapped(doc, `Summary: ${c.summary}`, margin, y + 0.5, contentWidth, 4)
      }

      for (const r of flagged) {
        y = ensureSpace(doc, y, 14)
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(9)
        doc.setTextColor(...COLORS.text)
        y = addWrapped(doc, humanizeCheckLabel(r.check_id), margin + 3, y + 2, contentWidth - 3, 4)
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(9)
        if (r.alignment) {
          doc.setTextColor(...COLORS.text)
          y = addWrapped(doc, `Alignment: ${r.alignment}`, margin + 3, y + 0.5, contentWidth - 3, 4)
        }
        const rationale = r.alignment_rationale || r.inconsistency
        if (rationale) {
          doc.setTextColor(...COLORS.text)
          y = addWrapped(doc, rationale, margin + 3, y + 0.5, contentWidth - 3, 4)
        }
        const solution = r.proposed_solution || r.recommendation
        if (solution) {
          doc.setTextColor(...COLORS.muted)
          y = addWrapped(doc, `Proposed solution: ${solution}`, margin + 3, y + 0.5, contentWidth - 3, 4)
          doc.setTextColor(...COLORS.text)
        }
      }
      y += 5
    }
  }

  // Insufficient data
  drawSectionTitle('Insufficient data')
  const insufControls = controls.filter((c) =>
    (c.results || []).some((r) => r.status === 'insufficient_data')
  )
  if (insufControls.length === 0) {
    drawEmpty()
  } else {
    for (const c of insufControls) {
      const insuf = (c.results || []).filter((r) => r.status === 'insufficient_data')
      y = ensureSpace(doc, y, 14)

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(10)
      doc.setTextColor(...COLORS.black)
      y = addWrapped(doc, String(c.control_number || c.form_id || 'Control'), margin, y, contentWidth, 4.5)

      for (const r of insuf) {
        y = ensureSpace(doc, y, 12)
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(9)
        doc.setTextColor(...COLORS.text)
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(9)
        doc.setTextColor(...COLORS.text)
        y = addWrapped(doc, formatInsufficientCheckLine(r), margin + 3, y + 2, contentWidth - 3, 4)
      }
      y += 5
    }
  }

  // Footer
  const pageCount = doc.getNumberOfPages()
  for (let i = 1; i <= pageCount; i += 1) {
    doc.setPage(i)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(...COLORS.lightGray)
    doc.text('Design Gap Report', margin, pageHeight - 7)
    doc.text(`Page ${i} of ${pageCount}`, pageWidth - margin, pageHeight - 7, { align: 'right' })
  }

  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')
  const unitPart = safeText(meta.unit_id || 'unit').replace(/[^\w.-]+/g, '_')
  const bpPart = safeText(meta.business_process || 'bp').replace(/[^\w.-]+/g, '_')
  doc.save(`design_gap_report_${unitPart}_${bpPart}_${stamp}.pdf`)
}
