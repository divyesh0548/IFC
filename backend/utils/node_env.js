const ALLOWED_NODE_ENVS = new Set(['development', 'production']);

function normalizeNodeEnv(value = process.env.NODE_ENV) {
  return String(value ?? '').trim().toLowerCase();
}

function assertAllowedNodeEnv() {
  const nodeEnv = normalizeNodeEnv();
  if (!ALLOWED_NODE_ENVS.has(nodeEnv)) {
    const received = String(process.env.NODE_ENV ?? '').trim() === ''
      ? '(empty)'
      : JSON.stringify(process.env.NODE_ENV);
    console.error(`Refusing to start. NODE_ENV must be "development" or "production". Received: ${received}`);
    process.exit(1);
  }

  process.env.NODE_ENV = nodeEnv;
  return nodeEnv;
}

function isDevelopment() {
  return normalizeNodeEnv() === 'development';
}

function isProduction() {
  return normalizeNodeEnv() === 'production';
}

module.exports = {
  ALLOWED_NODE_ENVS,
  assertAllowedNodeEnv,
  isDevelopment,
  isProduction,
};
