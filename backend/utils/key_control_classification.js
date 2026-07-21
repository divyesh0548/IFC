function normalizeValue(value) {
  return String(value || '').trim().toLowerCase();
}

function normalizeKeyControlToken(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

function normalizeKeyControlWords(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function classifyKeyControlValue(value) {
  const normalized = normalizeValue(value);
  const normalizedToken = normalizeKeyControlToken(value);
  const normalizedWords = normalizeKeyControlWords(value);
  const wordTokens = normalizedWords ? normalizedWords.split(/\s+/).filter(Boolean) : [];

  if (
    normalized === 'no' ||
    wordTokens.includes('non') ||
    normalizedWords.includes('non key') ||
    normalizedToken.startsWith('nonkey')
  ) {
    return 'nonKey';
  }

  if (
    normalized === 'yes' ||
    normalizedToken === 'keycontrol' ||
    normalizedToken === 'keycontrols'
  ) {
    return 'key';
  }

  return 'unclassified';
}

function isKeyControlValue(value) {
  return classifyKeyControlValue(value) === 'key';
}

function isNonKeyControlValue(value) {
  return classifyKeyControlValue(value) === 'nonKey';
}

function isUnclassifiedKeyControlValue(value) {
  return classifyKeyControlValue(value) === 'unclassified';
}

module.exports = {
  normalizeKeyControlToken,
  normalizeKeyControlWords,
  classifyKeyControlValue,
  isKeyControlValue,
  isNonKeyControlValue,
  isUnclassifiedKeyControlValue,
};
