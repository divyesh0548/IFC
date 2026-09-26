function uniqueSorted(values) {
  return [...new Set(values.map((value) => String(value || '').trim()).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b)
  )
}

export function normalizeScopeRows(rows) {
  return (Array.isArray(rows) ? rows : [])
    .map((row) => ({
      unit_id: String(row?.unit_id || row?.unitId || '').trim(),
      business_process: String(row?.business_process || row?.businessProcess || '').trim(),
      financial_year: String(row?.financial_year || row?.financialYear || '').trim(),
    }))
    .filter((row) => row.unit_id)
}

export function businessProcessesForUnits(scopeRows, unitIds) {
  const selected = new Set((unitIds || []).map((id) => String(id)))
  if (selected.size === 0) return []
  return uniqueSorted(
    scopeRows.filter((row) => selected.has(row.unit_id)).map((row) => row.business_process)
  )
}

export function financialYearsForScope(scopeRows, unitIds, businessProcesses) {
  const units = new Set((unitIds || []).map((id) => String(id)))
  const processes = new Set((businessProcesses || []).map((id) => String(id)))
  if (units.size === 0 || processes.size === 0) return []
  return uniqueSorted(
    scopeRows
      .filter((row) => units.has(row.unit_id) && processes.has(row.business_process))
      .map((row) => row.financial_year)
  )
}

export function keepAllowed(selected, allowed) {
  const allowedSet = new Set(allowed)
  return (selected || []).filter((value) => allowedSet.has(value))
}
