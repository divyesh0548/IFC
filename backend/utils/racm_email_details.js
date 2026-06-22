function formatFieldLine(label, value) {
  const text = String(value || '').trim();
  if (!text) return '';
  return `- ${label}: ${text}`;
}

function formatRequiredFieldLine(label, value) {
  const text = String(value || '').trim() || 'N/A';
  return `- ${label}: ${text}`;
}

function buildRacmDetailsSection(formLike, extraFields = [], heading = 'RACM Details:') {
  const lines = [heading];

  const primaryFields = [
    ['Business Process', formLike?.business_process ?? formLike?.businessProcess],
    ['Standard Control Description', formLike?.standard_control_description ?? formLike?.standardControlDescription],
    ['Financial Year', formLike?.financial_year ?? formLike?.financialYear],
  ];

  for (const [label, value] of primaryFields) {
    lines.push(formatRequiredFieldLine(label, value));
  }

  for (const [label, value] of extraFields) {
    const line = formatFieldLine(label, value);
    if (line) {
      lines.push(line);
    }
  }

  return lines.join('\n');
}

module.exports = {
  buildRacmDetailsSection,
};
