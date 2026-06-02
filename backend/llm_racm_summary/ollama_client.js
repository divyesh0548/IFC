const http = require('http');
const https = require('https');
const { URL } = require('url');
const { rationalisationSummarySchema, parseStructuredSummary } = require('./summary_schema');

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
// Previous Ollama options kept for reference:
// const OLLAMA_MODEL_OPTIONS = {
//   temperature: 0,
//   max_tokens: 1000,
//   top_p: 0.9,
// };
const OLLAMA_MODEL_OPTIONS = {
  temperature: 0,
  num_predict: 180,
  top_p: 0.9,
};

function buildSingleControlPrompt({ companyIdentifier, businessProcess, control }) {
  return [
    `You are reviewing one RACM for company_identifier=${companyIdentifier}.`,
    `The business process cycle is "${businessProcess}".`,
    'Only use the RACM row provided below.',
    'Do not invent any controls or fields that are not present in the input.',
    'Generate one concise Rationalisation Opportunity for this control.',
    'For each control, provide:',
    '1. A short, actionable summary of the rationalisation opportunity.',
    '2. Highlight risks if not rationalised.',
    '3. Suggest alternative approaches or improvements where applicable.',
    '4. Use varied sentence structures — avoid repetitive phrasing like "Consider implementing/automating". Make the summaries natural, professional, and credible.',
    '5. Output strictly in JSON, structured as:',
    '',
    `Schema: ${JSON.stringify(rationalisationSummarySchema)}`,
    '',
    'Use the exact input controlNumber value in the output.',
    `Input control: ${JSON.stringify(control)}`,
  ].join('\n');
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

function getOllamaReachabilityUrl() {
  const ollamaUrl = getOllamaUrl();
  return new URL('/api/tags', ollamaUrl);
}

function resolveOllamaThinkSetting(rawValue, modelName) {
  const normalized = String(rawValue || '').trim().toLowerCase();
  if (normalized === 'true') return true;
  if (normalized === 'false') return false;

  // qwen3.5 exposes a thinking mode that adds large latency for this endpoint.
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

function requestText(url, options = {}) {
  const client = url.protocol === 'https:' ? https : http;
  const timeoutMs = Number.isFinite(options.timeoutMs) && options.timeoutMs > 0
    ? options.timeoutMs
    : 5000;

  return new Promise((resolve, reject) => {
    const request = client.request(
      url,
      {
        method: 'GET',
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

    request.setTimeout(timeoutMs, () => {
      request.destroy(new Error(`Ollama reachability check timed out after ${timeoutMs}ms.`));
    });

    request.on('error', (error) => {
      reject(error);
    });

    request.end();
  });
}

async function isOllamaReachable() {
  try {
    const response = await requestText(getOllamaReachabilityUrl(), { timeoutMs: 5000 });
    return response.ok;
  } catch (error) {
    return false;
  }
}

async function requestControlSummary({ companyIdentifier, businessProcess, control }) {
  if (!OLLAMA_MODEL) {
    throw new Error('OLLAMA_MODEL is not configured.');
  }

  const payload = {
    model: OLLAMA_MODEL,
    stream: false,
    format: rationalisationSummarySchema,
    options: OLLAMA_MODEL_OPTIONS,
    // Previous payload behavior kept for reference:
    // qwen3.5 was previously called without a `think` flag, which allowed
    // the model to enter its reasoning mode and caused very slow responses.
    messages: [
      {
        role: 'system',
        content: 'You are an internal controls specialist. Return only valid JSON matching the schema.',
      },
      {
        role: 'user',
        content: buildSingleControlPrompt({ companyIdentifier, businessProcess, control }),
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
    throw new Error(`Ollama returned invalid JSON response: ${error.message}`);
  }
  const content = String(data?.message?.content || '').trim();

  if (!content) {
    throw new Error('Ollama response content is empty.');
  }

  return parseStructuredSummary(content);
}

module.exports = {
  OLLAMA_MODEL,
  OLLAMA_MODEL_OPTIONS,
  isOllamaReachable,
  requestControlSummary,
};
