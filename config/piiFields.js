// config/piiFields.js
// Configuration for PII fields that need encryption
// Currently: PAN, Aadhaar, Passport, and Driving License numbers only

/**
 * PII fields that require encryption
 * Organized by table for easy reference
 */
const PII_FIELDS = {
  employee_personal_details: [
    'pan_number',
    'aadhaar_number',
    'passport_number',
    'driving_license_number',
  ],
  employee_family_dependents: [
    'aadhaar_number',
    'pan_number',
    'passport_number',
  ],
};

module.exports = { PII_FIELDS };

