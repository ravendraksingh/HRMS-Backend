/**
 * Legacy schemas.js file - Re-exports from separated schema files
 * This file is kept for backward compatibility
 *
 * @deprecated Use specific schema files instead:
 * - validations/organizationSchemas.js for organization schemas
 * - validations/employeeSchemas.js for employee schemas
 * - validations/commonValidators.js for common validators
 */

// Re-export organization schemas
const orgSchemas = require("./organizationSchemas");

// Re-export employee schemas
const empSchemas = require("./employeeSchemas");

// Re-export common validators
const commonValidators = require("./commonValidators");

module.exports = {
  // Common validators
  ...commonValidators,

  // Organization validators and schemas
  ...orgSchemas,

  // Employee validators and schemas
  ...empSchemas,
};
