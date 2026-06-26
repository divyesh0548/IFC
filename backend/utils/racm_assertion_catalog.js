/**
 * Optional standard assertion columns for RACM templates.
 * Not fixed on control_forms — coordinators add these (or custom columns) per template.
 */
const RACM_ASSERTION_CATALOG = [
  {
    field_key: 'completeness',
    label: 'Completeness',
    section_key: 'assertions',
    excel_keywords: ['completeness'],
  },
  {
    field_key: 'existence_occurrence',
    label: 'Existence & Occurrence',
    section_key: 'assertions',
    excel_keywords: ['existence', 'occurrence'],
  },
  {
    field_key: 'valuation_and_allocation',
    label: 'Valuation & Allocation',
    section_key: 'assertions',
    excel_keywords: ['valuation', 'allocation'],
  },
  {
    field_key: 'rights_and_obligation',
    label: 'Rights and Obligation',
    section_key: 'assertions',
    excel_keywords: ['rights', 'obligation'],
  },
  {
    field_key: 'presentation_and_disclosure',
    label: 'Presentation and Disclosure',
    section_key: 'assertions',
    excel_keywords: ['presentation', 'disclosure'],
  },
];

const RACM_ASSERTION_FIELD_KEYS = new Set(
  RACM_ASSERTION_CATALOG.map((item) => item.field_key)
);

function getAssertionCatalogItem(fieldKey) {
  return RACM_ASSERTION_CATALOG.find((item) => item.field_key === fieldKey) || null;
}

module.exports = {
  RACM_ASSERTION_CATALOG,
  RACM_ASSERTION_FIELD_KEYS,
  getAssertionCatalogItem,
};
