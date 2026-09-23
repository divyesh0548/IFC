/**
 * Single source for classified-field allowed values.
 * Edit: backend/config/control_classification_allowed_values.json
 * Used by: design-gap AI (Python), unclassified-controls page, and any Node callers.
 */
const path = require('path');
const fs = require('fs');

const CONFIG_PATH = path.join(
  __dirname,
  '..',
  'config',
  'control_classification_allowed_values.json'
);

const CONTROL_CLASSIFICATION_ALLOWED_VALUES = Object.freeze(
  JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'))
);

const SHARED_CLASSIFICATION_FIELDS = Object.freeze(
  Object.keys(CONTROL_CLASSIFICATION_ALLOWED_VALUES)
);

function normalizeClassificationToken(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

function getAllowedClassificationValues(fieldKey) {
  const values = CONTROL_CLASSIFICATION_ALLOWED_VALUES[fieldKey];
  return Array.isArray(values) ? values : [];
}

function isAllowedClassificationValue(fieldKey, rawValue) {
  const allowed = getAllowedClassificationValues(fieldKey);
  if (!allowed.length) return false;
  const token = normalizeClassificationToken(rawValue);
  if (!token) return false;
  return allowed.some(
    (item) => normalizeClassificationToken(item) === token
  );
}

module.exports = {
  CONFIG_PATH,
  CONTROL_CLASSIFICATION_ALLOWED_VALUES,
  SHARED_CLASSIFICATION_FIELDS,
  normalizeClassificationToken,
  getAllowedClassificationValues,
  isAllowedClassificationValue,
};
