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

function buildRiskAnalysisPrompt({ companyIdentifier, businessProcess, control, candidateSubProcesses }) {
  return [
    `You are reviewing one RACM for company_identifier=${companyIdentifier}.`,
    `The business process cycle is "${businessProcess}".`,
    'Your job has two steps:',
    '1. Select the most appropriate candidate sub-process from the provided list by comparing it with the control sub-process.',
    '2. Compare the control risk coverage against the risks listed for the selected candidate sub-process.',
    'Use only the control data and candidate list provided below.',
    'Do not invent risks, sub-processes, or control details that are not present in the input.',
    'Return strictly valid JSON matching the schema below.',
    'If the control does not test a listed risk, include that risk in missingRisks and add one concise pointer in missingRiskPointers.',
    'Use short, factual pointers that explain what aspect is not being tested by the RACM.',
    'Rephrase every pointer into simple business language. Do not copy exact sentences, exact phrases, or long wording from the input control or candidate risks.',
    'Each pointer must describe a distinct gap. Do not repeat the same point with small wording changes.',
    'STRICT WARNING: missingRiskPointers must not contain duplicate or near-duplicate pointers. If two risks lead to the same gap, combine them into one clear pointer instead of repeating it.',
    'Keep each pointer specific, plain, and easy to read.',
    'Do not return the input control number, control sub-process, covered risks, or general notes.',
    '',
    `Schema: ${JSON.stringify(riskAnalysisResponseSchema)}`,
    '',
    `Input control: ${JSON.stringify(control)}`,
    `Candidate sub-processes: ${JSON.stringify(candidateSubProcesses)}`,
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

async function requestRiskAnalysis({ companyIdentifier, businessProcess, control, candidateSubProcesses }) {
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
        content: 'You are an internal controls risk specialist. Return only valid JSON matching the schema. Rewrite findings in simple language and never return duplicate or near-duplicate pointers.',
      },
      {
        role: 'user',
        content: buildRiskAnalysisPrompt({ companyIdentifier, businessProcess, control, candidateSubProcesses }),
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
    return parseRiskAnalysisResponse(content);
  } catch (error) {
    throw createOllamaError(error.message, 'OLLAMA_INVALID_STRUCTURED_RESPONSE');
  }
}

module.exports = {
  OLLAMA_MODEL,
  OLLAMA_MODEL_OPTIONS,
  requestRiskAnalysis,
};
