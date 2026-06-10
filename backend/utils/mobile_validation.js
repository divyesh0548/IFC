const MOBILE_DIGIT_REGEX = /^[0-9]{10}$/;

const EXPLICIT_REJECTED_MOBILES = new Set([
  '0000000000',
  '0123456789',
  '1111111111',
  '1234567890',
  '9876543210',
  '9999999999',
]);

function normalizeMobileDigits(value) {
  return String(value || '').replace(/\D/g, '').slice(0, 10);
}

function isRepeatedDigitMobile(digits) {
  return /^(\d)\1{9}$/.test(digits);
}

function isWrappedSequentialMobile(digits, direction) {
  for (let i = 1; i < digits.length; i += 1) {
    const prev = Number(digits[i - 1]);
    const curr = Number(digits[i]);
    const expected =
      direction === 'asc'
        ? (prev === 9 ? 0 : prev + 1)
        : (prev === 0 ? 9 : prev - 1);

    if (curr !== expected) {
      return false;
    }
  }

  return true;
}

function isDummyMobile(digits) {
  return (
    EXPLICIT_REJECTED_MOBILES.has(digits) ||
    isRepeatedDigitMobile(digits) ||
    isWrappedSequentialMobile(digits, 'asc') ||
    isWrappedSequentialMobile(digits, 'desc')
  );
}

function getMobileValidationError(value) {
  const digits = normalizeMobileDigits(value);
  if (!digits) {
    return null;
  }

  if (!MOBILE_DIGIT_REGEX.test(digits)) {
    return 'Mobile number must be 10 digits';
  }

  if (isDummyMobile(digits)) {
    return 'Please enter a valid mobile number';
  }

  return null;
}

function isValidOptionalMobile(value) {
  return getMobileValidationError(value) === null;
}

module.exports = {
  normalizeMobileDigits,
  getMobileValidationError,
  isValidOptionalMobile,
};
