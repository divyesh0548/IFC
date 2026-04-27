const { encryptToken, decryptToken } = require('./auth_utility');

function normalizePasswordValue(passwordValue) {
  return String(passwordValue || '');
}

function encryptIfcUserTempPassword(tempPassword) {
  return encryptToken(normalizePasswordValue(tempPassword));
}

function decryptIfcUserTempPassword(encryptedTempPassword) {
  const encryptedValue = normalizePasswordValue(encryptedTempPassword).trim();
  if (!encryptedValue) {
    return '';
  }

  return decryptToken(encryptedValue);
}

function decryptPasswordStoredInIfcUsers(userRowOrEncryptedValue) {
  const encryptedValue =
    userRowOrEncryptedValue && typeof userRowOrEncryptedValue === 'object'
      ? userRowOrEncryptedValue.temp_password_encrypted
      : userRowOrEncryptedValue;

  return decryptIfcUserTempPassword(encryptedValue);
}

module.exports = {
  encryptIfcUserTempPassword,
  decryptIfcUserTempPassword,
  decryptPasswordStoredInIfcUsers,
};
