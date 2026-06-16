require('dotenv').config();

const { isPasswordHash } = require('./utils/password');
const { decryptIfcUserTempPassword } = require('./utils/ifc_user_password');

/**
 * Decrypt a password value stored in ifc_users.
 *
 * Use the value from `temp_password_encrypted` (AES-256-GCM via ENCRYPTION_KEY).
 * The `password` column stores a bcrypt hash with PASSWORD_HASH_PEPPER and cannot be reversed.
 */
function decryptStoredPassword(encryptedPassword) {
  const value = String(encryptedPassword || '').trim();

  if (!value) {
    throw new Error('Encrypted password value is required');
  }

  if (isPasswordHash(value)) {
    throw new Error(
      'This looks like a bcrypt hash from the password column. Bcrypt is one-way and cannot be decrypted. Use temp_password_encrypted from the database instead.'
    );
  }

  return decryptIfcUserTempPassword(value);
}

function main() {
  const encryptedPassword = process.argv[2];

  if (!encryptedPassword) {
    console.error('Usage: node decrypt_pass.js "<temp_password_encrypted-from-db>"');
    process.exit(1);
  }

  try {
    console.log(decryptStoredPassword(encryptedPassword));
  } catch (error) {
    console.error(error.message || 'Failed to decrypt password');
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  decryptStoredPassword,
};
