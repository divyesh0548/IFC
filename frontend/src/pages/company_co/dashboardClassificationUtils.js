const normalizeValue = (value) => String(value || '').trim().toLowerCase()
const normalizeKeyControlToken = (value) =>
  String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')

const normalizeKeyControlWords = (value) =>
  String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

const classifyKeyControlValue = (formOrValue) => {
  if (formOrValue && typeof formOrValue === 'object' && !Array.isArray(formOrValue)) {
    const backendClassification = String(formOrValue.key_control_classification || '').trim()
    const normalizedBackendClassification = normalizeKeyControlToken(backendClassification)
    if (
      backendClassification === 'key' ||
      normalizedBackendClassification === 'key' ||
      normalizedBackendClassification === 'keycontrol' ||
      normalizedBackendClassification === 'keycontrols'
    ) {
      return 'key'
    }
    if (
      backendClassification === 'nonKey' ||
      normalizedBackendClassification === 'nonkey' ||
      normalizedBackendClassification === 'nonkeycontrol' ||
      normalizedBackendClassification === 'nonkeycontrols'
    ) {
      return 'nonKey'
    }

    const rawValue = getFieldValue(formOrValue, 'key_control', 'keyControl')
    const rawClassification = classifyKeyControlValue(rawValue)
    if (rawClassification !== 'unclassified') {
      return rawClassification
    }

    if (backendClassification === 'unclassified' || normalizedBackendClassification === 'unclassified') {
      return 'unclassified'
    }

    return 'unclassified'
  }

  const normalized = normalizeValue(formOrValue)
  const normalizedToken = normalizeKeyControlToken(formOrValue)
  const normalizedWords = normalizeKeyControlWords(formOrValue)
  const wordTokens = normalizedWords ? normalizedWords.split(/\s+/).filter(Boolean) : []

  if (
    normalized === 'no' ||
    wordTokens.includes('non') ||
    normalizedWords.includes('non key') ||
    normalizedToken.startsWith('nonkey')
  ) {
    return 'nonKey'
  }

  if (normalized === 'yes' || normalizedToken === 'keycontrol' || normalizedToken === 'keycontrols') {
    return 'key'
  }

  return 'unclassified'
}

const isKeyControlValue = (valueOrForm) => classifyKeyControlValue(valueOrForm) === 'key'

const isNonKeyControlValue = (valueOrForm) => classifyKeyControlValue(valueOrForm) === 'nonKey'

const isTruthyActiveValue = (value) => {
  const normalized = normalizeValue(value)
  return normalized === 'true' || normalized === '1'
}

const getFieldValue = (form, snakeCaseKey, camelCaseKey = '') => {
  if (form?.[snakeCaseKey] !== undefined && form?.[snakeCaseKey] !== null) {
    return form[snakeCaseKey]
  }

  if (camelCaseKey && form?.[camelCaseKey] !== undefined && form?.[camelCaseKey] !== null) {
    return form[camelCaseKey]
  }

  return ''
}

const classifyNatureOfControl = (value) => {
  const normalized = normalizeValue(value)

  if (normalized === 'preventive' || normalized === 'preventing') {
    return 'preventive'
  }

  if (normalized === 'detective') {
    return 'detective'
  }

  if (normalized.includes('corrective')) {
    return 'corrective'
  }

  return 'unclassified'
}

const classifyControlType = (value) => {
  const normalized = normalizeValue(value)

  if (normalized.includes('semi')) {
    return 'semiAutomated'
  }

  if (normalized === 'manual') {
    return 'manual'
  }

  if (normalized === 'automated' || normalized === 'automative') {
    return 'automated'
  }

  return 'unclassified'
}

const formatProcessName = (value) => {
  const normalized = String(value || '').trim()
  return normalized || 'Unassigned'
}

const matchesDashboardFilters = (form, filters = {}) => {
  const {
    active = 'all',
    businessProcess = 'all',
    financialYear = 'all',
    approvalStatus = 'all',
    unit = 'all',
    conclusion = 'all',
  } = filters

  if (active !== 'all') {
    const isActive = isTruthyActiveValue(form?.active)
    if ((active === 'active' && !isActive) || (active === 'inactive' && isActive)) {
      return false
    }
  }

  if (financialYear !== 'all' && String(form?.financial_year || '').trim() !== financialYear) {
    return false
  }

  if (businessProcess !== 'all') {
    const currentBusinessProcess = String(
      getFieldValue(form, 'business_process', 'businessProcess') || ''
    ).trim()

    if (currentBusinessProcess !== businessProcess) {
      return false
    }
  }

  if (approvalStatus !== 'all') {
    const normalizedStatus = normalizeValue(form?.status)
    if (approvalStatus === 'Pending') {
      if (normalizedStatus && normalizedStatus !== 'sent for approval') {
        return false
      }
    } else if (normalizedStatus !== normalizeValue(approvalStatus)) {
      return false
    }
  }

  if (unit !== 'all' && String(form?.unit_id || '').trim() !== unit) {
    return false
  }

  if (conclusion !== 'all') {
    const normalizedConclusion = String(form?.control_design_conclusion || '').trim()
    const formattedConclusion = normalizedConclusion
      ? normalizedConclusion.charAt(0).toUpperCase() + normalizedConclusion.slice(1).toLowerCase()
      : 'None'

    if (formattedConclusion !== conclusion) {
      return false
    }
  }

  return true
}

const getUnclassifiedFlags = (form) => {
  const keyControl = form
  const natureOfControl = classifyNatureOfControl(getFieldValue(form, 'nature_of_control', 'natureOfControl'))
  const controlType = classifyControlType(getFieldValue(form, 'control_type_ma', 'controlTypeMa'))

  const key = classifyKeyControlValue(keyControl) === 'unclassified'
  const nature = natureOfControl === 'unclassified'
  const type = controlType === 'unclassified'

  return {
    key,
    nature,
    type,
    isUnclassified: key || nature || type,
  }
}

const countUnclassifiedControls = (forms, filters = {}) =>
  (forms || []).reduce((count, form) => {
    if (!matchesDashboardFilters(form, filters)) {
      return count
    }

    return count + (getUnclassifiedFlags(form).isUnclassified ? 1 : 0)
  }, 0)

const createUnclassifiedSummaryRows = (forms, filters = {}) =>
  Array.from(
    (forms || []).reduce((rows, form) => {
      if (!matchesDashboardFilters(form, filters)) {
        return rows
      }

      const flags = getUnclassifiedFlags(form)
      if (!flags.isUnclassified) {
        return rows
      }

      const businessProcess = formatProcessName(getFieldValue(form, 'business_process', 'businessProcess'))
      const row = rows.get(businessProcess) || {
        businessProcess,
        totalUnclassifiedControls: 0,
        keyNonKeyControls: 0,
        preventiveDetectiveControls: 0,
        automatedManualControls: 0,
      }

      row.totalUnclassifiedControls += 1

      if (flags.key) {
        row.keyNonKeyControls += 1
      }

      if (flags.nature) {
        row.preventiveDetectiveControls += 1
      }

      if (flags.type) {
        row.automatedManualControls += 1
      }

      rows.set(businessProcess, row)
      return rows
    }, new Map()).values()
  )

export {
  normalizeValue,
  isTruthyActiveValue,
  getFieldValue,
  classifyNatureOfControl,
  classifyControlType,
  classifyKeyControlValue,
  isKeyControlValue,
  isNonKeyControlValue,
  formatProcessName,
  matchesDashboardFilters,
  getUnclassifiedFlags,
  countUnclassifiedControls,
  createUnclassifiedSummaryRows,
}
