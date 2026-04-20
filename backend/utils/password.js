const bcrypt = require('bcryptjs');

const BCRYPT_HASH_PREFIXES = ['$2a$', '$2b$', '$2y$'];
const DEFAULT_BCRYPT_ROUNDS = 12;

function getPasswordPepper() {
  const pepper = String(process.env.PASSWORD_HASH_PEPPER || '').trim();

  if (!pepper) {
    throw new Error('PASSWORD_HASH_PEPPER is not configured');
  }

  return pepper;
}

function getBcryptRounds() {
  const parsed = Number.parseInt(String(process.env.BCRYPT_ROUNDS || DEFAULT_BCRYPT_ROUNDS), 10);
  if (Number.isNaN(parsed) || parsed < 8 || parsed > 15) {
    return DEFAULT_BCRYPT_ROUNDS;
  }
  return parsed;
}

function applyPepper(password) {
  return `${String(password)}${getPasswordPepper()}`;
}

function isPasswordHash(passwordValue) {
  return BCRYPT_HASH_PREFIXES.some((prefix) => String(passwordValue || '').startsWith(prefix));
}

async function hashPassword(password) {
  return bcrypt.hash(applyPepper(password), getBcryptRounds());
}

async function verifyPassword(password, storedPassword) {
  if (!storedPassword) {
    return false;
  }

  if (isPasswordHash(storedPassword)) {
    return bcrypt.compare(applyPepper(password), storedPassword);
  }

  return String(password) === String(storedPassword);
}

module.exports = {
  getPasswordPepper,
  hashPassword,
  verifyPassword,
  isPasswordHash,
};
