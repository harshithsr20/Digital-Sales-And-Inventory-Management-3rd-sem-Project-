// Utility validation functions for authentication and registration

// Indian Goods and Services Tax Identification Number (GSTIN) Regex
// Format: 2 digits (state code) + 5 letters (PAN) + 4 digits + 1 letter + 1 alphanumeric + 'Z' + 1 alphanumeric
const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

// Standard email regex to check proper email format
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Checks if a string is a valid email address
 */
function isValidEmail(email) {
  if (!email || typeof email !== 'string') return false;
  return EMAIL_REGEX.test(email.trim());
}

/**
 * Validates a GSTIN against official Indian tax format
 */
function isValidGSTIN(gstNumber) {
  if (!gstNumber || typeof gstNumber !== 'string') return false;
  return GSTIN_REGEX.test(gstNumber.trim().toUpperCase());
}

/**
 * Validates all required fields for business + admin registration
 * Returns { valid: true } or { valid: false, message: string }
 */
function validateRegisterInput(data) {
  const {
    businessName,
    gstNumber,
    address,
    businessEmail,
    ownerName,
    adminEmail,
    password,
  } = data;

  // 1. Check all required fields are present and non-empty
  if (
    !businessName ||
    !gstNumber ||
    !address ||
    !businessEmail ||
    !ownerName ||
    !adminEmail ||
    !password
  ) {
    return {
      valid: false,
      message:
        'All fields are required: businessName, gstNumber, address, businessEmail, ownerName, adminEmail, password',
    };
  }

  // 2. Validate email formats
  if (!isValidEmail(businessEmail)) {
    return {
      valid: false,
      message: 'Invalid businessEmail format',
    };
  }

  if (!isValidEmail(adminEmail)) {
    return {
      valid: false,
      message: 'Invalid adminEmail format',
    };
  }

  // 3. Validate GSTIN format
  if (!isValidGSTIN(gstNumber)) {
    return {
      valid: false,
      message:
        'Invalid GST number format. Must match standard 15-character GSTIN (e.g. 29ABCDE1234F1Z5)',
    };
  }

  // 4. Validate password length (minimum 8 characters)
  if (typeof password !== 'string' || password.length < 8) {
    return {
      valid: false,
      message: 'Password must be at least 8 characters long',
    };
  }

  return { valid: true };
}

module.exports = {
  isValidEmail,
  isValidGSTIN,
  validateRegisterInput,
};

