const RACM_REQUIRED_FIELDS = Object.freeze({
  business_process: 'Business Process',
  financial_year: 'Financial Year',
  unit_id: 'Unit ID',
});

function isBlank(value) {
  return value === null || value === undefined || String(value).trim() === '';
}

function getMissingRacmRequiredFields(values = {}) {
  return Object.entries(RACM_REQUIRED_FIELDS)
    .filter(([field]) => isBlank(values[field]))
    .map(([field, label]) => ({ field, label }));
}

function formatMissingRacmRequiredFields(missingFields) {
  const labels = (missingFields || []).map((item) => item.label).filter(Boolean);
  if (labels.length === 0) return '';
  return `Missing required field(s): ${labels.join(', ')}`;
}

module.exports = {
  RACM_REQUIRED_FIELDS,
  getMissingRacmRequiredFields,
  formatMissingRacmRequiredFields,
};
