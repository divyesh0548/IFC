/**
 * HTTP client for AI-Summary-API-Backend (Flask).
 * Env:
 *   AI_SUMMARY_API_URL  e.g. http://127.0.0.1:5001
 *   AI_SUMMARY_API_KEY  shared Bearer / X-API-Key
 */

const DEFAULT_TIMEOUT_MS = 3 * 60 * 1000;

function getAiSummaryConfig() {
  const baseUrl = String(process.env.AI_SUMMARY_API_URL || 'http://127.0.0.1:5001')
    .trim()
    .replace(/\/$/, '');
  const apiKey = String(process.env.AI_SUMMARY_API_KEY || '').trim();
  return { baseUrl, apiKey };
}

async function callAiSummaryApi(path, { method = 'GET', body = null, timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  const { baseUrl, apiKey } = getAiSummaryConfig();
  if (!apiKey) {
    const error = new Error('AI_SUMMARY_API_KEY is not configured on the Node backend');
    error.code = 'AI_SUMMARY_MISCONFIGURED';
    error.statusCode = 503;
    throw error;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: body == null ? undefined : JSON.stringify(body),
      signal: controller.signal,
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
  } finally {
    clearTimeout(timer);
  }
}

async function analyzeDesignGapControl(control, { dryRun = false } = {}) {
  return callAiSummaryApi('/v1/design-gap/analyze', {
    method: 'POST',
    body: { control, dry_run: Boolean(dryRun) },
  });
}

async function checkAiSummaryHealth() {
  const { baseUrl } = getAiSummaryConfig();
  try {
    const response = await fetch(`${baseUrl}/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

module.exports = {
  getAiSummaryConfig,
  callAiSummaryApi,
  analyzeDesignGapControl,
  checkAiSummaryHealth,
};
