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

const AUTOMATION_FIELD_LABELS = [
  'Control number',
  'Current manual activity',
  'Automation opportunity',
  'Proposed solution',
  'Benefit',
  'Dependency',
  'Residual risk or limitation',
]

function parseAutomationOpportunity(text) {
  const raw = String(text || '').replace(/\r\n/g, '\n').trim()
  const hasKnownOpening = AUTOMATION_FIELD_LABELS.some((label) => raw.startsWith(`${label}\n`))
  if (!hasKnownOpening) return null
  const labelPattern = AUTOMATION_FIELD_LABELS
    .map((label) => label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('|')
  return raw
    .split(new RegExp(`\\n(?=(?:${labelPattern})\\n)`))
    .map((part) => {
      const newline = part.indexOf('\n')
      if (newline === -1) return null
      const label = part.slice(0, newline).trim()
      const value = part.slice(newline + 1).trim()
      if (!AUTOMATION_FIELD_LABELS.includes(label) || !value) return null
      return { label, value }
    })
    .filter(Boolean)
}

function uniqueJoined(controls, field) {
  return [...new Set((controls || []).map((row) => safeText(row?.[field])).filter(Boolean))].join(', ') || '—'
}

function fileStamp() {
  return new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')
}

function filePart(value, fallback) {
  return safeText(value || fallback).replace(/[^\w.-]+/g, '_')
}

function createReportDocument() {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 16
  return {
    doc,
    pageWidth,
    pageHeight,
    margin,
    contentWidth: pageWidth - margin * 2,
    y: 20,
  }
}

function drawReportHeader(state, {
  title,
  companyName,
  unitName,
  businessProcess,
  financialYear,
  controlsReviewed,
  controlsLabel = 'Controls reviewed',
}) {
  const { doc, margin, contentWidth, pageWidth } = state
  let { y } = state

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.setTextColor(...COLORS.black)
  doc.text(title, margin, y)
  y += 8

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
  y = addWrapped(
    doc,
    `Financial year: ${financialYear}   ·   ${controlsLabel}: ${controlsReviewed}`,
    margin,
    y + 1,
    contentWidth,
    4.5,
  )
  y += 3
  doc.setDrawColor(...COLORS.line)
  doc.setLineWidth(0.35)
  doc.line(margin, y, pageWidth - margin, y)
  y += 8
  state.y = y
}

function drawSummaryRow(state, items) {
  const { doc, margin } = state
  let { y } = state
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(...COLORS.black)
  doc.text('Summary', margin, y)
  y += 7

  let x = margin
  items.forEach((item, index) => {
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

    if (index < items.length - 1) {
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(...COLORS.muted)
      const sep = '     '
      doc.text(sep, x, y)
      x += doc.getTextWidth(sep)
    }
  })
  state.y = y + 10
}

function drawSectionTitle(state, title) {
  const { doc, margin, pageWidth } = state
  let { y } = state
  y = ensureSpace(doc, y, 12)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.setTextColor(...COLORS.black)
  doc.text(title, margin, y)
  y += 2
  doc.setDrawColor(...COLORS.line)
  doc.setLineWidth(0.3)
  doc.line(margin, y, pageWidth - margin, y)
  state.y = y + 6
}

function drawEmpty(state) {
  const { doc, margin } = state
  doc.setFont('helvetica', 'italic')
  doc.setFontSize(9)
  doc.setTextColor(...COLORS.muted)
  doc.text('None', margin, state.y)
  doc.setTextColor(...COLORS.text)
  state.y += 7
}

function drawFooter(state, title) {
  const { doc, margin, pageWidth, pageHeight } = state
  const pageCount = doc.getNumberOfPages()
  for (let i = 1; i <= pageCount; i += 1) {
    doc.setPage(i)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(...COLORS.lightGray)
    doc.text(title, margin, pageHeight - 7)
    doc.text(`Page ${i} of ${pageCount}`, pageWidth - margin, pageHeight - 7, { align: 'right' })
  }
}

function headerFromReport(reportData) {
  const meta = reportData?.meta || {}
  const controls = Array.isArray(reportData?.controls) ? reportData.controls : []
  return {
    companyName: safeText(meta.company_name) || '—',
    unitName: safeText(meta.unit_name) || '—',
    businessProcess: safeText(meta.business_process || uniqueJoined(controls, 'business_process')),
    financialYear: safeText(meta.financial_year || uniqueJoined(controls, 'financial_year')),
    controls,
    unitPart: filePart(meta.unit_id || meta.unit_name, 'unit'),
    bpPart: filePart(meta.business_process || uniqueJoined(controls, 'business_process'), 'bp'),
  }
}

export function downloadKeyManualReportPdf(reportData) {
  const state = createReportDocument()
  const { doc, margin, contentWidth } = state
  const header = headerFromReport(reportData)
  const controls = header.controls

  drawReportHeader(state, {
    title: 'Key + Manual Report',
    companyName: header.companyName,
    unitName: header.unitName,
    businessProcess: header.businessProcess,
    financialYear: header.financialYear,
    controlsReviewed: Number(reportData?.meta?.controls_reviewed ?? controls.length),
  })
  drawSummaryRow(state, [
    { label: 'Controls reviewed', value: controls.length, tone: 'neutral' },
  ])

  drawSectionTitle(state, 'Automation opportunities')
  if (controls.length === 0) {
    drawEmpty(state)
  } else {
    controls.forEach((control) => {
      state.y = ensureSpace(doc, state.y, 16)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(10)
      doc.setTextColor(...COLORS.black)
      state.y = addWrapped(doc, String(control.control_number || control.form_id || 'Control'), margin, state.y, contentWidth, 4.5)

      const sections = parseAutomationOpportunity(control.rationalisation_opportunity)
      if (!sections || sections.length === 0) {
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(9)
        doc.setTextColor(...COLORS.text)
        const raw = safeText(control.rationalisation_opportunity) || 'Summary is empty.'
        state.y = addWrapped(doc, raw, margin, state.y + 1, contentWidth, 4)
      } else {
        sections.forEach((section) => {
          state.y = ensureSpace(doc, state.y, 12)
          doc.setFont('helvetica', 'bold')
          doc.setFontSize(9)
          doc.setTextColor(...COLORS.text)
          state.y = addWrapped(doc, section.label, margin + 3, state.y + 2, contentWidth - 3, 4)
          doc.setFont('helvetica', 'normal')
          state.y = addWrapped(doc, section.value, margin + 3, state.y + 0.5, contentWidth - 3, 4)
        })
      }
      state.y += 5
    })
  }

  drawFooter(state, 'Key + Manual Report')
  doc.save(`key_manual_report_${header.unitPart}_${header.bpPart}_${fileStamp()}.pdf`)
}

function pointerComparison(response, risk) {
  const comparisons = response?.riskComparisons
  if (!comparisons || typeof comparisons !== 'object') return null
  const wanted = safeText(risk).toLowerCase()
  if (!wanted) return null
  const direct = comparisons[risk] || comparisons[safeText(risk)]
  if (direct?.addressedStatus) return direct
  const match = Object.entries(comparisons).find(([key]) => safeText(key).toLowerCase() === wanted)
  return match?.[1]?.addressedStatus ? match[1] : null
}

export function downloadRiskAnalysisReportPdf(reportData) {
  const state = createReportDocument()
  const { doc, margin, contentWidth } = state
  const header = headerFromReport(reportData)
  const controls = header.controls
  const withMissing = controls.filter((control) => {
    const pointers = control?.response_json?.missingRiskPointers
    return Array.isArray(pointers) && pointers.length > 0
  })

  drawReportHeader(state, {
    title: 'Risk Analysis Report',
    companyName: header.companyName,
    unitName: header.unitName,
    businessProcess: header.businessProcess,
    financialYear: header.financialYear,
    controlsReviewed: Number(reportData?.meta?.controls_reviewed ?? controls.length),
  })
  drawSummaryRow(state, [
    { label: 'With missing risks', value: withMissing.length, tone: withMissing.length > 0 ? 'bad' : 'neutral' },
    { label: 'No missing risks', value: controls.length - withMissing.length, tone: 'good' },
  ])

  drawSectionTitle(state, 'Controls')
  if (controls.length === 0) {
    drawEmpty(state)
  } else {
    controls.forEach((control) => {
      const response = control.response_json && typeof control.response_json === 'object'
        ? control.response_json
        : {}
      const storedRisks = Array.isArray(response.risks) ? response.risks : null
      const pointers = Array.isArray(response.missingRiskPointers) ? response.missingRiskPointers : []
      state.y = ensureSpace(doc, state.y, 16)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(10)
      doc.setTextColor(...COLORS.black)
      state.y = addWrapped(doc, String(control.control_number || control.form_id || 'Control'), margin, state.y, contentWidth, 4.5)

      if (storedRisks) {
        const groups = [
          ['Missing / partially covered risks', storedRisks.filter((item) => item?.status !== 'Addressed Risk')],
        ]
        groups.forEach(([title, items]) => {
          state.y = ensureSpace(doc, state.y, 12)
          doc.setFont('helvetica', 'bold')
          doc.setFontSize(9)
          doc.setTextColor(...COLORS.text)
          state.y = addWrapped(doc, String(title), margin, state.y + 1.5, contentWidth, 4)
          if (!items.length) {
            doc.setFont('helvetica', 'italic')
            doc.setTextColor(...COLORS.muted)
            state.y = addWrapped(doc, 'None', margin + 3, state.y + 0.5, contentWidth - 3, 4)
            doc.setTextColor(...COLORS.text)
            return
          }
          items.forEach((item, index) => {
            const controlsLabel = (Array.isArray(item.addressedBy) ? item.addressedBy : []).map((value) => safeText(value)).filter(Boolean).join(', ')
            const pointer = safeText(item.pointer)
            const risk = safeText(item.risk)
            state.y = ensureSpace(doc, state.y, 12)
            doc.setFont('helvetica', 'bold')
            doc.setFontSize(9)
            doc.setTextColor(...COLORS.text)
            state.y = addWrapped(doc, `${index + 1}.`, margin + 3, state.y + 1.5, contentWidth - 3, 4)
            doc.setFont('helvetica', 'normal')
            state.y = addWrapped(doc, risk || pointer || '—', margin + 6, state.y + 0.5, contentWidth - 6, 4)
            const detailRows = [
              ['Partially covered by', controlsLabel],
              ['Sub-process', item.subProcess || item.sub_process],
            ]
              .map(([label, value]) => [label, safeText(value)])
              .filter(([, value]) => value)
            detailRows.forEach(([label, value]) => {
              doc.setFont('helvetica', 'normal')
              doc.setTextColor(...COLORS.muted)
              state.y = addWrapped(
                doc,
                `${label}: ${value}`,
                margin + 6,
                state.y + 0.5,
                contentWidth - 6,
                4,
              )
              doc.setTextColor(...COLORS.text)
            })
          })
        })
        state.y += 5
        return
      }

      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      doc.setTextColor(...COLORS.muted)
      const matched = safeText(response.matchedSubProcess || control.matched_sub_process) || 'N/A'
      const confidence = safeText(response.matchConfidence || control.match_confidence) || 'N/A'
      state.y = addWrapped(doc, `Matched sub-process: ${matched}`, margin, state.y + 0.5, contentWidth, 4)
      state.y = addWrapped(doc, `Confidence: ${confidence}`, margin, state.y + 0.5, contentWidth, 4)

      if (pointers.length === 0) {
        doc.setFont('helvetica', 'italic')
        doc.setTextColor(...COLORS.muted)
        state.y = addWrapped(doc, 'No missing-risk pointers returned.', margin + 3, state.y + 1.5, contentWidth - 3, 4)
        doc.setTextColor(...COLORS.text)
      } else {
        pointers.forEach((item, index) => {
          const risk = safeText(item?.risk)
          const pointer = safeText(item?.pointer) || '—'
          const comparison = pointerComparison(response, risk)
          const addressedBy = Array.isArray(comparison?.addressedBy)
            ? comparison.addressedBy.map((value) => safeText(value)).filter(Boolean)
            : []
          state.y = ensureSpace(doc, state.y, 14)
          doc.setFont('helvetica', 'bold')
          doc.setFontSize(9)
          doc.setTextColor(...COLORS.text)
          state.y = addWrapped(doc, `${index + 1}. ${pointer}`, margin + 3, state.y + 2, contentWidth - 3, 4)
          if (comparison?.addressedStatus) {
            doc.setFont('helvetica', 'normal')
            if (comparison.addressedStatus === 'Not addressed') doc.setTextColor(...COLORS.red)
            else doc.setTextColor(...COLORS.green)
            state.y = addWrapped(doc, comparison.addressedStatus, margin + 6, state.y + 0.5, contentWidth - 6, 4)
            doc.setTextColor(...COLORS.text)
            const reason = safeText(comparison.reason)
            const coverage = addressedBy.length > 0 ? ` Addressed by ${addressedBy.join(', ')}.` : ''
            if (reason || coverage) {
              state.y = addWrapped(doc, `${reason}${coverage}`.trim(), margin + 6, state.y + 0.5, contentWidth - 6, 4)
            }
          }
        })
      }
      state.y += 5
    })
  }

  drawFooter(state, 'Risk Analysis Report')
  doc.save(`risk_analysis_report_${header.unitPart}_${header.bpPart}_${fileStamp()}.pdf`)
}

export function downloadOverallMissingRisksReportPdf(reportData) {
  const state = createReportDocument()
  const { doc, margin, contentWidth } = state
  const header = headerFromReport(reportData)
  const risks = Array.isArray(reportData?.risks)
    ? reportData.risks
    : Array.isArray(reportData?.response_json?.risks)
      ? reportData.response_json.risks
      : []
  const riskCount = risks.length
  const reviewedCount = Number(reportData?.meta?.risks_reviewed ?? reportData?.source_risk_count ?? 0)

  drawReportHeader(state, {
    title: 'Overall Missing Risks Report',
    companyName: header.companyName,
    unitName: header.unitName,
    businessProcess: header.businessProcess,
    financialYear: header.financialYear,
    controlsReviewed: reviewedCount || riskCount,
    controlsLabel: 'RACM risks reviewed',
  })
  drawSummaryRow(state, [
    { label: 'Missing risks', value: riskCount, tone: riskCount > 0 ? 'bad' : 'good' },
    { label: 'Generated model', value: safeText(reportData?.meta?.model_name || reportData?.model_name) || '—', tone: 'neutral' },
  ])

  drawSectionTitle(state, 'Overall missing risks')
  if (riskCount === 0) {
    drawEmpty(state)
  } else {
    risks.forEach((item, index) => {
      const risk = safeText(item?.risk || item?.pointer)
      const subProcess = safeText(item?.subProcess || item?.sub_process)
      state.y = ensureSpace(doc, state.y, 16)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9)
      doc.setTextColor(...COLORS.text)
      state.y = addWrapped(doc, `${index + 1}.`, margin + 3, state.y + 1.5, contentWidth - 3, 4)
      doc.setFont('helvetica', 'normal')
      state.y = addWrapped(doc, risk || '—', margin + 6, state.y + 0.5, contentWidth - 6, 4)
      if (subProcess) {
        doc.setTextColor(...COLORS.muted)
        state.y = addWrapped(doc, `Sub-process: ${subProcess}`, margin + 6, state.y + 0.5, contentWidth - 6, 4)
        doc.setTextColor(...COLORS.text)
      }
      state.y += 2
    })
  }

  drawFooter(state, 'Overall Missing Risks Report')
  doc.save(`overall_missing_risks_${header.unitPart}_${header.bpPart}_${fileStamp()}.pdf`)
}
