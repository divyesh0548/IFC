const dotenv = require('dotenv');

dotenv.config();

const { decryptToken } = require('../utils/auth_utility');

function readInput() {
  const value = process.argv[2];

  if (!value) {
    console.error('Usage: node scripts/decrypt_password_hash.js "<encrypted-hash>"');
    process.exit(1);
  }

  return String(value);
}

function main() {
  const encryptedHash = readInput();

  try {
    const decryptedValue = decryptToken(encryptedHash);
    console.log(decryptedValue);
  } catch (error) {
    console.error(error.message || 'Failed to decrypt value');
    process.exit(1);
  }
}

main();
