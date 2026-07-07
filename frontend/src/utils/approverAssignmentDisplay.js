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

function getRacmUnitLabel(assignment) {
  return String(assignment?.unit_name || assignment?.unit_id || '').trim() || 'Unassigned Unit'
}

function groupRacmAssignmentsByUnit(assignments) {
  const units = new Map()

  assignments.forEach((assignment) => {
    const unitId = String(assignment?.unit_id || '').trim() || `name:${getRacmUnitLabel(assignment)}`
    const unitName = getRacmUnitLabel(assignment)
    const businessProcess = getRacmBusinessProcessLabel(assignment)

    if (!units.has(unitId)) {
      units.set(unitId, {
        key: `unit-${unitId}`,
        unitId,
        unitName,
        businessProcessGroups: new Map(),
      })
    }

    const unitGroup = units.get(unitId)
    if (!unitGroup.businessProcessGroups.has(businessProcess)) {
      unitGroup.businessProcessGroups.set(businessProcess, {
        businessProcess,
        count: 0,
      })
    }

    unitGroup.businessProcessGroups.get(businessProcess).count += 1
  })

  return Array.from(units.values())
    .map((unitGroup) => {
      const businessProcessGroups = Array.from(unitGroup.businessProcessGroups.values())
        .sort((a, b) => a.businessProcess.localeCompare(b.businessProcess))
      const totalCount = businessProcessGroups.reduce((sum, group) => sum + group.count, 0)

      return {
        key: unitGroup.key,
        unitId: unitGroup.unitId,
        unitName: unitGroup.unitName,
        businessProcessGroups,
        totalCount,
      }
    })
    .sort((a, b) => a.unitName.localeCompare(b.unitName))
}

export function buildApproverAssignmentDisplayModel(assignments, { scopeLabelStyle = 'default' } = {}) {
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

  const otherItems = otherAssignments.map((assignment) => ({
    key: String(assignment.id),
    scopeLabel: scopeLabelFn(assignment.assignment_scope),
    detail: formatNonRacmAssignmentDetail(assignment),
  }))

  return {
    otherItems,
    racmUnitGroups: groupRacmAssignmentsByUnit(racmAssignments),
    racmScopeLabel: scopeLabelFn('RACM'),
  }
}

/** @deprecated Use buildApproverAssignmentDisplayModel for pop-up rendering */
export function buildApproverAssignmentDisplayItems(assignments, options = {}) {
  const { otherItems, racmUnitGroups, racmScopeLabel } = buildApproverAssignmentDisplayModel(assignments, options)

  const racmItems = racmUnitGroups.flatMap((unitGroup) =>
    unitGroup.businessProcessGroups.map((group) => {
      const racmLabel = group.count === 1 ? 'RACM' : 'RACMs'
      return {
        key: `racm-${unitGroup.unitId}-${group.businessProcess}`,
        scopeLabel: racmScopeLabel,
        detail: `${unitGroup.unitName} | ${group.businessProcess} (${group.count} ${racmLabel})`,
      }
    })
  )

  return [...racmItems, ...otherItems]
}

export function findConflictingApproverScopeAssignment(
  assignments,
  { approverEmail, assignmentScope, unitId, businessProcess }
) {
  const normalizedApprover = String(approverEmail || '').trim().toLowerCase()
  const normalizedUnitId = String(unitId || '').trim()
  const normalizedScope = String(assignmentScope || '').trim().toUpperCase()
  const normalizedBusinessProcess = String(businessProcess || '').trim().toLowerCase()

  if (!normalizedUnitId || !['UNIT', 'BUSINESS_PROCESS'].includes(normalizedScope)) {
    return null
  }
  if (normalizedScope === 'BUSINESS_PROCESS' && !normalizedBusinessProcess) {
    return null
  }

  const list = Array.isArray(assignments) ? assignments : []

  return (
    list.find((item) => {
      const itemScope = String(item?.assignment_scope || '').trim().toUpperCase()
      const itemUnitId = String(item?.unit_id || '').trim()
      const itemApprover = String(item?.approver_email_id || '').trim().toLowerCase()

      if (!itemApprover || itemApprover === normalizedApprover) return false
      if (itemUnitId !== normalizedUnitId) return false

      if (normalizedScope === 'UNIT') {
        return itemScope === 'UNIT'
      }

      return itemScope === 'BUSINESS_PROCESS'
        && String(item?.business_process || '').trim().toLowerCase() === normalizedBusinessProcess
    }) || null
  )
}

export function buildConflictingApproverAssignmentWarning(conflictingAssignment) {
  if (!conflictingAssignment) return ''

  const displacedLabel = String(
    conflictingAssignment.approver_display_name
    || conflictingAssignment.approver_email_id
    || 'the current approver'
  ).trim()

  return `Assignment already exists. This action will remove ${displacedLabel} as approver for this scope.`
}

export function findDuplicateApproverScopeAssignment(
  assignments,
  { approverEmail, assignmentScope, unitId, businessProcess }
) {
  const normalizedApprover = String(approverEmail || '').trim().toLowerCase()
  const normalizedUnitId = String(unitId || '').trim()
  const normalizedScope = String(assignmentScope || '').trim().toUpperCase()
  const normalizedBusinessProcess = String(businessProcess || '').trim().toLowerCase()

  if (!normalizedApprover || !normalizedUnitId || !['UNIT', 'BUSINESS_PROCESS'].includes(normalizedScope)) {
    return null
  }
  if (normalizedScope === 'BUSINESS_PROCESS' && !normalizedBusinessProcess) {
    return null
  }

  const list = Array.isArray(assignments) ? assignments : []

  return (
    list.find((item) => {
      const itemScope = String(item?.assignment_scope || '').trim().toUpperCase()
      const itemUnitId = String(item?.unit_id || '').trim()
      const itemApprover = String(item?.approver_email_id || '').trim().toLowerCase()

      if (itemApprover !== normalizedApprover) return false
      if (itemUnitId !== normalizedUnitId) return false

      if (normalizedScope === 'UNIT') {
        return itemScope === 'UNIT'
      }

      return itemScope === 'BUSINESS_PROCESS'
        && String(item?.business_process || '').trim().toLowerCase() === normalizedBusinessProcess
    }) || null
  )
}

export function buildDuplicateApproverAssignmentBlockMessage(assignmentScope, { unitName, businessProcess } = {}) {
  const scope = String(assignmentScope || '').trim().toUpperCase()

  if (scope === 'UNIT') {
    return unitName
      ? `This approver is already assigned at unit level for ${unitName}.`
      : 'This approver is already assigned at unit level for the selected unit.'
  }

  if (businessProcess && unitName) {
    return `This approver is already assigned to ${businessProcess} in ${unitName}.`
  }
  if (businessProcess) {
    return `This approver is already assigned to ${businessProcess}.`
  }

  return 'This approver is already assigned to the selected unit and business process.'
}
