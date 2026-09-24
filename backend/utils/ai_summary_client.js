/**
 * HTTP client for AI-Summary-API-Backend (Flask).
 * Env:
 *   AI_SUMMARY_API_URL  e.g. http://127.0.0.1:5001
 *   AI_SUMMARY_API_KEY  shared Bearer / X-API-Key
 */

const DEFAULT_TIMEOUT_MS = 3 * 60 * 1000;
const HEALTH_TIMEOUT_MS = 5000;
const HEALTH_RETRY_COUNT = 3;
const HEALTH_RETRY_DELAY_MS = 400;

function normalizeAiSummaryBaseUrl(rawUrl) {
  let baseUrl = String(rawUrl || 'http://127.0.0.1:5001')
    .trim()
    .replace(/\/$/, '');
  // Avoid intermittent IPv6 (::1) failures when Flask listens on 127.0.0.1 only.
  try {
    const parsed = new URL(baseUrl);
    if (parsed.hostname === 'localhost') {
      parsed.hostname = '127.0.0.1';
      baseUrl = parsed.toString().replace(/\/$/, '');
    }
  } catch {
    // keep as-is
  }
  return baseUrl;
}

function getAiSummaryConfig() {
  const baseUrl = normalizeAiSummaryBaseUrl(process.env.AI_SUMMARY_API_URL);
  const apiKey = String(process.env.AI_SUMMARY_API_KEY || '').trim();
  return { baseUrl, apiKey };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithTimeout(url, { method = 'GET', headers, body, timeoutMs } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      method,
      headers,
      body,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

async function callAiSummaryApi(path, { method = 'GET', body = null, timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  const { baseUrl, apiKey } = getAiSummaryConfig();
  if (!apiKey) {
    const error = new Error('AI_SUMMARY_API_KEY is not configured on the Node backend');
    error.code = 'AI_SUMMARY_MISCONFIGURED';
    error.statusCode = 503;
    throw error;
  }

  try {
    const response = await fetchWithTimeout(`${baseUrl}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: body == null ? undefined : JSON.stringify(body),
      timeoutMs,
    });

    const text = await response.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = { raw: text };
    }

    if (!response.ok) {
      const error = new Error(
        data?.message || data?.error || `AI Summary API HTTP ${response.status}`
      );
      error.code = data?.error || 'AI_SUMMARY_HTTP_ERROR';
      error.statusCode = response.status;
      error.payload = data;
      throw error;
    }

    return data;
  } catch (error) {
    if (error.name === 'AbortError') {
      const timeoutError = new Error('AI Summary API request timed out');
      timeoutError.code = 'AI_SUMMARY_TIMEOUT';
      timeoutError.statusCode = 504;
      throw timeoutError;
    }
    if (error.code === 'AI_SUMMARY_MISCONFIGURED' || error.statusCode) {
      throw error;
    }
    const unreachable = new Error(
      `AI Summary API unreachable at ${baseUrl}: ${error.message || error}`
    );
    unreachable.code = 'AI_SUMMARY_UNREACHABLE';
    unreachable.statusCode = 503;
    throw unreachable;
  }
}

async function analyzeDesignGapControl(control, { dryRun = false } = {}) {
  return callAiSummaryApi('/v1/design-gap/analyze', {
    method: 'POST',
    body: { control, dry_run: Boolean(dryRun) },
  });
}

async function probeAiSummaryHealthOnce(baseUrl) {
  const response = await fetchWithTimeout(`${baseUrl}/health`, {
    method: 'GET',
    timeoutMs: HEALTH_TIMEOUT_MS,
  });
  return response.ok;
}

async function checkAiSummaryHealth() {
  const { baseUrl } = getAiSummaryConfig();
  let lastError = null;
  for (let attempt = 1; attempt <= HEALTH_RETRY_COUNT; attempt += 1) {
    try {
      const ok = await probeAiSummaryHealthOnce(baseUrl);
      if (ok) return true;
      lastError = new Error(`HTTP health check failed (attempt ${attempt})`);
    } catch (error) {
      lastError = error;
    }
    if (attempt < HEALTH_RETRY_COUNT) {
      await sleep(HEALTH_RETRY_DELAY_MS * attempt);
    }
  }
  if (lastError) {
    console.warn(
      `AI Summary API health check failed for ${baseUrl}:`,
      lastError.message || lastError
    );
  }
  return false;
}

module.exports = {
  getAiSummaryConfig,
  callAiSummaryApi,
  analyzeDesignGapControl,
  checkAiSummaryHealth,
};
