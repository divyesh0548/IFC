/**
 * Single source for classified-field allowed values (shared with design-gap AI).
 * Edit: backend/config/control_classification_allowed_values.json
 */
import CONTROL_CLASSIFICATION_ALLOWED_VALUES from '@backend-config/control_classification_allowed_values.json'

export { CONTROL_CLASSIFICATION_ALLOWED_VALUES }

export const SHARED_CLASSIFICATION_FIELDS = Object.freeze(
  Object.keys(CONTROL_CLASSIFICATION_ALLOWED_VALUES)
)

export function normalizeClassificationToken(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
}

export function getAllowedClassificationValues(fieldKey) {
  const values = CONTROL_CLASSIFICATION_ALLOWED_VALUES[fieldKey]
  return Array.isArray(values) ? values : []
}

export function isAllowedClassificationValue(fieldKey, rawValue) {
  const allowed = getAllowedClassificationValues(fieldKey)
  if (!allowed.length) return false
  const token = normalizeClassificationToken(rawValue)
  if (!token) return false
  return allowed.some((item) => normalizeClassificationToken(item) === token)
}
