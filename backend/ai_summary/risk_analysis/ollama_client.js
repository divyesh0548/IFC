const http = require('http');
const https = require('https');
const { URL } = require('url');
const { riskAnalysisResponseSchema, parseRiskAnalysisResponse } = require('./risk_analysis_schema');

const OLLAMA_URL = process.env.OLLAMA_CHAT_URL;
const OLLAMA_MODEL = process.env.OLLAMA_MODEL;
const DEFAULT_OLLAMA_TIMEOUT_MS = 10 * 60 * 1000;
const parsedOllamaTimeoutMs = Number.parseInt(
  process.env.OLLAMA_REQUEST_TIMEOUT_MS || `${DEFAULT_OLLAMA_TIMEOUT_MS}`,
  10
);
const OLLAMA_REQUEST_TIMEOUT_MS = Number.isFinite(parsedOllamaTimeoutMs) && parsedOllamaTimeoutMs > 0
  ? parsedOllamaTimeoutMs
  : DEFAULT_OLLAMA_TIMEOUT_MS;
const OLLAMA_THINK = resolveOllamaThinkSetting(process.env.OLLAMA_THINK, OLLAMA_MODEL);
const OLLAMA_MODEL_OPTIONS = {
  temperature: 0,
  num_predict: 180,
  top_p: 0.9,
};

function normalizeSubProcessName(value) {
  return String(value || '').trim().toLowerCase();
}

function resolveMatchedCandidate(matchedSubProcess, candidateSubProcesses) {
  const normalizedMatchedSubProcess = normalizeSubProcessName(matchedSubProcess);
  const matchedCandidate = (Array.isArray(candidateSubProcesses) ? candidateSubProcesses : []).find(
    (candidate) => normalizeSubProcessName(candidate?.subProcess) === normalizedMatchedSubProcess
  );

  if (!matchedCandidate) {
    const error = createOllamaError(
      'Ollama returned a matched sub-process that is not present in the risk analysis master file.',
      'OLLAMA_INVALID_CANDIDATE_SUB_PROCESS'
    );
    error.statusCode = 502;
    throw error;
  }

  return matchedCandidate;
}

const RISK_COMPARE_STOPWORDS = new Set([
  'about', 'after', 'also', 'been', 'being', 'from', 'have', 'into', 'that', 'this',
  'they', 'them', 'their', 'with', 'without', 'will', 'shall', 'such', 'than', 'then',
  'when', 'where', 'which', 'while', 'would', 'could', 'should', 'may', 'might',
  'result', 'results', 'resulting', 'lead', 'leads', 'leading', 'ensure', 'ensures',
  'process', 'does', 'not', 'and', 'the', 'for', 'are', 'was', 'were',
]);

function normalizeRiskCompareText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function tokenizeRiskCompareText(value) {
  return normalizeRiskCompareText(value)
    .split(/\s+/)
    .map((token) => {
      if (token.endsWith('ies') && token.length > 5) return `${token.slice(0, -3)}y`;
      if (token.endsWith('s') && !token.endsWith('ss') && token.length > 4) return token.slice(0, -1);
      return token;
    })
    .filter((token) => token.length > 3 && !RISK_COMPARE_STOPWORDS.has(token));
}

function riskTokenOverlapRatio(riskText, sourceText) {
  const riskTokens = tokenizeRiskCompareText(riskText);
  const sourceTokens = new Set(tokenizeRiskCompareText(sourceText));
  if (riskTokens.length === 0 || sourceTokens.size === 0) return 0;
  const hits = riskTokens.filter((token) => sourceTokens.has(token)).length;
  return hits / riskTokens.length;
}

function findExactCandidateRisk(riskText, candidateRisks) {
  const normalizedRisk = normalizeRiskCompareText(riskText);
  if (!normalizedRisk) return '';
  return (Array.isArray(candidateRisks) ? candidateRisks : []).find(
    (candidateRisk) => normalizeRiskCompareText(candidateRisk) === normalizedRisk
  ) || '';
}

function isCandidateRiskCoveredByControl(riskText, control) {
  const riskDescription = String(control?.riskDescription || '').trim();
  const controlDetails = [
    control?.riskDescription,
    control?.controlObjective,
    control?.standardControlDescription,
  ].filter(Boolean).join(' ');

  if (riskDescription && riskTokenOverlapRatio(riskText, riskDescription) >= 0.45) {
    return true;
  }
  return riskTokenOverlapRatio(riskText, controlDetails) >= 0.5;
}

function sanitizeRiskAnalysisResult(parsed, matchedCandidate, control) {
  const candidateRisks = Array.isArray(matchedCandidate?.risks) ? matchedCandidate.risks : [];
  const allowedMissingRisks = [];

  for (const riskText of Array.isArray(parsed.missingRisks) ? parsed.missingRisks : []) {
    const exactCandidateRisk = findExactCandidateRisk(riskText, candidateRisks);
    const canonicalRisk = exactCandidateRisk || riskText;
    if (isCandidateRiskCoveredByControl(canonicalRisk, control)) continue;
    if (exactCandidateRisk && !allowedMissingRisks.includes(exactCandidateRisk)) {
      allowedMissingRisks.push(exactCandidateRisk);
    }
  }

  const missingRiskPointers = (Array.isArray(parsed.missingRiskPointers) ? parsed.missingRiskPointers : [])
    .map((item) => {
      const exactCandidateRisk = findExactCandidateRisk(item.risk, candidateRisks)
        || findExactCandidateRisk(item.risk, allowedMissingRisks);
      const canonicalRisk = exactCandidateRisk || item.risk;
      if (isCandidateRiskCoveredByControl(canonicalRisk, control)) return null;
      if (!exactCandidateRisk && !allowedMissingRisks.includes(canonicalRisk)) return null;
      return {
        risk: exactCandidateRisk || canonicalRisk,
        pointer: item.pointer,
      };
    })
    .filter(Boolean);

  const missingRisks = allowedMissingRisks.length > 0
    ? allowedMissingRisks
    : [...new Set(missingRiskPointers.map((item) => item.risk))];

  return {
    ...parsed,
    matchedSubProcess: String(matchedCandidate?.subProcess || parsed.matchedSubProcess || '').trim(),
    missingRisks,
    missingRiskPointers: missingRiskPointers.filter((item) => missingRisks.includes(item.risk)),
    coverageStatus: missingRisks.length === 0 ? 'Covered' : parsed.coverageStatus,
  };
}

function buildRiskAnalysisPrompt({ businessProcess, control, candidateSubProcesses }) {
  const candidateSubProcessNames = (Array.isArray(candidateSubProcesses) ? candidateSubProcesses : [])
    .map((candidate) => String(candidate?.subProcess || '').trim())
    .filter(Boolean);

  return [
    [
      'You are reviewing one RACM control for risk coverage analysis.',
      `The business process cycle is "${businessProcess}".`,
      
      '',
      'Your task has two steps:',
      '1. Match the input control to the most appropriate candidate sub-process.',
      '2. For the matched candidate sub-process, compare each listed candidate risk category with the input control details and identify only those listed risks that are not addressed by the control.',
      
      '',
      'Use only the information provided in the input control and candidate sub-process list.',
      'Do not use external knowledge, assumptions, industry examples, or inferred control details that are not supported by the input control fields.',
      'Do not invent risks, sub-processes, control activities, or evidence requirements.',
      
      '',
      'Sub-process matching rules:',
      'matchedSubProcess must be copied exactly from one of the Candidate sub-process names.',
      'Select the candidate sub-process that is closest in meaning to the control sub-process and control description.',
      'Do not return the input control sub-process as matchedSubProcess unless it exactly exists in Candidate sub-process names.',
      'If multiple candidate sub-processes appear similar, select the one whose listed risks are most closely connected to the input control.',
      'Do not create, rename, shorten, expand, or paraphrase the candidate sub-process name.',
      
      '',
      'Risk coverage comparison rules:',
      'After selecting matchedSubProcess, review only the risks listed under that matched candidate sub-process. Those listed items are the risk categories for that sub-process.',
      'For each listed candidate risk, ask: does this RACM already address that risk category?',
      'Read riskDescription, controlObjective, and standardControlDescription together. These are the control details.',
      'riskDescription is the risk this RACM is written to address. If a candidate risk has the same meaning as riskDescription, that candidate risk is COVERED by this control. Do not list it as missing.',
      'controlObjective and standardControlDescription describe what the control does. If they already mitigate, review, approve, test, or select against the same issue as a candidate risk, that candidate risk is COVERED.',
      'Match on meaning and risk theme, not exact wording.',
      'A candidate risk is MISSING only when the control details do not address that risk category at all.',
      'Do not invert the control details into a missing risk.',
      'Do not create a new missing-risk sentence from the control text. Use only candidate risk wording, and only when that candidate risk is truly not addressed.',
      'Do not flag a risk as missing merely because the control uses different words, a shorter description, or a more specific activity.',
      'Do not mark a risk as covered merely because it belongs to the same business process or sub-process. Coverage must come from the control details.',
      'If every listed candidate risk that relates to this control is already addressed, return missingRisks as an empty array.',
      
      '',
      'missingRisks rules:',
      'missingRisks must contain only risks copied exactly from the selected candidate sub-process list, and only those not addressed by the input control details.',
      'Copy missingRisks exactly as written in the candidate sub-process risk list.',
      'Do not add new risks to missingRisks.',
      'Do not paraphrase, shorten, invert, or rewrite candidate risks.',
      'Do not include risks from other candidate sub-processes.',
      'Do not include a listed candidate risk in missingRisks if riskDescription, controlObjective, or standardControlDescription already covers that risk category.',
      
      '',
      'missingRiskPointers rules:',
      'For every meaningful missing risk area, add one concise pointer explaining what aspect is not addressed by the RACM.',
      'Use short, factual pointers in simple business language.',
      'Each pointer should explain the practical coverage gap, not repeat the risk sentence.',
      'Rephrase every pointer. Do not copy exact sentences, exact phrases, or long wording from the input control or candidate risks.',
      'Each pointer must describe a distinct gap.',
      'Do not repeat the same point with small wording changes.',
      'If two or more missing risks lead to the same practical gap, combine them into one clear pointer.',
      'STRICT WARNING: missingRiskPointers must not contain duplicate or near-duplicate pointers.',
      'Keep each pointer specific, plain, and easy to read.',
      'Do not include generic statements such as "control is inadequate" unless the specific missing aspect is also stated.',
      
      '',
      'Output restrictions:',
      'Return strictly valid JSON matching the schema below.',
      'Do not include markdown, comments, explanation, or extra text outside JSON.',
      'Do not return the input control number, control sub-process, covered risks, or general notes.',
      'Do not include fields that are not present in the schema.',
      'Ensure all JSON arrays are valid arrays, even when empty.',
      
      '',
      `Schema: ${JSON.stringify(riskAnalysisResponseSchema)}`,
      `Candidate sub-process names: ${JSON.stringify(candidateSubProcessNames)}`,
      
      '',
      `Input control: ${JSON.stringify(control)}`,
      `Candidate sub-processes: ${JSON.stringify(candidateSubProcesses)}`
      ]
      
  ].join('\n');
}

function createOllamaError(message, code) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function getOllamaUrl() {
  if (!OLLAMA_URL) {
    throw new Error('OLLAMA_CHAT_URL is not configured.');
  }

  try {
    return new URL(OLLAMA_URL);
  } catch (error) {
    throw new Error(`OLLAMA_CHAT_URL is invalid: ${error.message}`);
  }
}

function resolveOllamaThinkSetting(rawValue, modelName) {
  const normalized = String(rawValue || '').trim().toLowerCase();
  if (normalized === 'true') return true;
  if (normalized === 'false') return false;

  if (/^qwen3\.5(?::|$)/i.test(String(modelName || '').trim())) {
    return false;
  }

  return null;
}

function postJson(url, payload) {
  const client = url.protocol === 'https:' ? https : http;
  const body = JSON.stringify(payload);

  return new Promise((resolve, reject) => {
    const request = client.request(
      url,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
        },
      },
      (response) => {
        const chunks = [];

        response.on('data', (chunk) => {
          chunks.push(chunk);
        });

        response.on('end', () => {
          const rawBody = Buffer.concat(chunks).toString('utf8');
          resolve({
            ok: response.statusCode >= 200 && response.statusCode < 300,
            status: response.statusCode || 0,
            text: rawBody,
          });
        });
      }
    );

    request.setTimeout(OLLAMA_REQUEST_TIMEOUT_MS, () => {
      request.destroy(
        new Error(
          `Ollama request timed out after ${OLLAMA_REQUEST_TIMEOUT_MS}ms. ` +
          'Increase OLLAMA_REQUEST_TIMEOUT_MS or use a faster/smaller model.'
        )
      );
    });

    request.on('error', (error) => {
      reject(error);
    });

    request.write(body);
    request.end();
  });
}

async function requestRiskAnalysis({ businessProcess, control, candidateSubProcesses }) {
  if (!OLLAMA_MODEL) {
    throw new Error('OLLAMA_MODEL is not configured.');
  }

  const payload = {
    model: OLLAMA_MODEL,
    stream: false,
    format: riskAnalysisResponseSchema,
    options: {
      ...OLLAMA_MODEL_OPTIONS,
      num_predict: 500,
    },
    messages: [
      {
        role: 'system',
        content: 'You are an internal controls risk specialist. List missing risks only when a candidate sub-process risk is not already addressed by riskDescription, controlObjective, or standardControlDescription. If the control already covers a candidate risk, omit it. Never invert control wording into a missing risk. Copy missingRisks exactly from the candidate list. Return only valid JSON matching the schema.',
      },
      {
        role: 'user',
        content: buildRiskAnalysisPrompt({ businessProcess, control, candidateSubProcesses }),
      },
    ],
  };

  if (OLLAMA_THINK !== null) {
    payload.think = OLLAMA_THINK;
  }

  const ollamaUrl = getOllamaUrl();
  const response = await postJson(ollamaUrl, payload);

  if (!response.ok) {
    throw new Error(`Ollama request failed with ${response.status}: ${response.text}`);
  }

  let data;
  try {
    data = JSON.parse(response.text);
  } catch (error) {
    throw createOllamaError(`Ollama returned invalid JSON response: ${error.message}`, 'OLLAMA_INVALID_JSON_RESPONSE');
  }

  const content = String(data?.message?.content || '').trim();
  if (!content) {
    throw createOllamaError('Ollama response content is empty.', 'OLLAMA_EMPTY_RESPONSE');
  }

  try {
    const parsed = parseRiskAnalysisResponse(content);
    const matchedCandidate = resolveMatchedCandidate(parsed.matchedSubProcess, candidateSubProcesses);
    return sanitizeRiskAnalysisResult(parsed, matchedCandidate, control);
  } catch (error) {
    if (error?.code === 'OLLAMA_INVALID_CANDIDATE_SUB_PROCESS') {
      throw error;
    }
    throw createOllamaError(error.message, 'OLLAMA_INVALID_STRUCTURED_RESPONSE');
  }
}

module.exports = {
  OLLAMA_MODEL,
  OLLAMA_MODEL_OPTIONS,
  requestRiskAnalysis,
};
