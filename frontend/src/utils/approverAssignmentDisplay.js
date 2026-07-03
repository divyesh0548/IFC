export function formatApproverAssignmentScopeLabel(scope) {
  const normalizedScope = String(scope || '').trim().toUpperCase()
  if (!normalizedScope) return '-'
  if (normalizedScope === 'BUSINESS_PROCESS') return 'Business Process Level'
  if (normalizedScope === 'RACM') return 'RACM Level'
  if (normalizedScope === 'UNIT') return 'Unit Level'
  return normalizedScope
}

function formatCompanyAdminScopeLabel(scope) {
  switch (String(scope || '').trim().toUpperCase()) {
    case 'UNIT':
      return 'Unit'
    case 'BUSINESS_PROCESS':
      return 'Unit + Business Process'
    case 'RACM':
      return 'Specific RACM'
    default:
      return 'Unassigned'
  }
}

function formatNonRacmAssignmentDetail(assignment) {
  const normalizedScope = String(assignment?.assignment_scope || '').trim().toUpperCase()
  if (normalizedScope === 'BUSINESS_PROCESS') {
    return [assignment?.unit_name || assignment?.unit_id, assignment?.business_process].filter(Boolean).join(' | ') || '-'
  }
  if (normalizedScope === 'UNIT') {
    return assignment?.unit_name || assignment?.unit_id || '-'
  }
  return [assignment?.unit_name || assignment?.unit_id, assignment?.business_process].filter(Boolean).join(' | ') || '-'
}

function getRacmBusinessProcessLabel(assignment) {
  return String(assignment?.business_process || '').trim() || 'Unspecified Business Process'
}

function groupRacmAssignments(assignments) {
  const groups = new Map()

  assignments.forEach((assignment) => {
    const businessProcess = getRacmBusinessProcessLabel(assignment)
    const unitKey = String(assignment?.unit_id || assignment?.unit_name || '').trim()
    const groupKey = `${unitKey}::${businessProcess}`

    if (!groups.has(groupKey)) {
      groups.set(groupKey, {
        businessProcess,
        unitName: assignment?.unit_name || assignment?.unit_id || '',
        count: 0,
      })
    }

    groups.get(groupKey).count += 1
  })

  return Array.from(groups.values())
}

export function buildApproverAssignmentDisplayItems(assignments, { scopeLabelStyle = 'default' } = {}) {
  const list = Array.isArray(assignments) ? assignments : []
  const scopeLabelFn = scopeLabelStyle === 'company_admin' ? formatCompanyAdminScopeLabel : formatApproverAssignmentScopeLabel

  const racmAssignments = []
  const otherAssignments = []

  list.forEach((assignment) => {
    const scope = String(assignment?.assignment_scope || '').trim().toUpperCase()
    if (scope === 'RACM') {
      racmAssignments.push(assignment)
    } else {
      otherAssignments.push(assignment)
    }
  })

  const racmItems = groupRacmAssignments(racmAssignments).map((group) => {
    const racmLabel = group.count === 1 ? 'RACM' : 'RACMs'

    return {
      key: `racm-${group.unitName}-${group.businessProcess}`,
      scopeLabel: scopeLabelFn('RACM'),
      detail: `${group.businessProcess} (${group.count} ${racmLabel})`,
    }
  })

  const otherItems = otherAssignments.map((assignment) => ({
    key: String(assignment.id),
    scopeLabel: scopeLabelFn(assignment.assignment_scope),
    detail: formatNonRacmAssignmentDetail(assignment),
  }))

  return [...racmItems, ...otherItems]
}
