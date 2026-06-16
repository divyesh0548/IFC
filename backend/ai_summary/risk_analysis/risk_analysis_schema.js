const riskAnalysisResponseSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    matchedSubProcess: { type: 'string' },
    matchConfidence: { type: 'string' },
    coverageStatus: { type: 'string' },
    missingRisks: {
      type: 'array',
      items: { type: 'string' },
    },
    missingRiskPointers: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          risk: { type: 'string' },
          pointer: { type: 'string' },
        },
        required: ['risk', 'pointer'],
      },
    },
  },
  required: [
    'matchedSubProcess',
    'matchConfidence',
    'coverageStatus',
    'missingRisks',
    'missingRiskPointers',
  ],
};

function parseRiskAnalysisResponse(rawContent) {
  const parsed = JSON.parse(rawContent);

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Ollama risk analysis response is not a JSON object.');
  }

  const matchedSubProcess = String(parsed?.matchedSubProcess || '').trim();
  const matchConfidence = String(parsed?.matchConfidence || '').trim();
  const coverageStatus = String(parsed?.coverageStatus || '').trim();
  const missingRisks = Array.isArray(parsed?.missingRisks)
    ? parsed.missingRisks.map((item) => String(item || '').trim()).filter(Boolean)
    : [];
  const missingRiskPointers = Array.isArray(parsed?.missingRiskPointers)
    ? parsed.missingRiskPointers
      .map((item) => ({
        risk: String(item?.risk || '').trim(),
        pointer: String(item?.pointer || '').trim(),
      }))
      .filter((item) => item.risk && item.pointer)
    : [];

  if (!matchedSubProcess || !matchConfidence || !coverageStatus) {
    throw new Error('Ollama risk analysis response is missing required fields.');
  }

  return {
    matchedSubProcess,
    matchConfidence,
    coverageStatus,
    missingRisks,
    missingRiskPointers,
  };
}

module.exports = {
  riskAnalysisResponseSchema,
  parseRiskAnalysisResponse,
};
