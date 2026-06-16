const rationalisationSummarySchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    controlNumber: { type: 'string' },
    rationalisationOpportunity: { type: 'string' },
  },
  required: ['controlNumber', 'rationalisationOpportunity'],
};

function parseStructuredSummary(rawContent) {
  const parsed = JSON.parse(rawContent);

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Ollama response is not a JSON object.');
  }

  const controlNumber = String(parsed?.controlNumber || '').trim();
  const rationalisationOpportunity = String(parsed?.rationalisationOpportunity || '').trim();

  if (!controlNumber || !rationalisationOpportunity) {
    throw new Error('Ollama response is missing required control fields.');
  }

  return {
    controlNumber,
    rationalisationOpportunity,
  };
}

module.exports = {
  rationalisationSummarySchema,
  parseStructuredSummary,
};
