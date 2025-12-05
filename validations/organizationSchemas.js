const { body, param } = require("express-validator");
const {
  isActiveValidator,
  urlValidator,
  dateValidator,
  phoneValidator,
} = require("./commonValidators");

// ============================================
// ORGANIZATION FIELD VALIDATORS
// ============================================

/**
 * Organization ID validator (for body)
 */
const orgidValidator = body("orgid")
  .notEmpty()
  .withMessage("orgid is required")
  .isLength({ max: 10 })
  .withMessage("orgid must be 10 characters or less")
  .trim()
  .toUpperCase();

/**
 * Organization ID param validator
 */
const orgidParamValidator = param("orgid")
  .notEmpty()
  .withMessage("orgid is required")
  .trim()
  .toUpperCase();

// ============================================
// ORGANIZATION VALIDATION SCHEMAS
// ============================================

/**
 * Schema for updating an organization
 */
const updateOrganizationSchema = [
  orgidParamValidator,
  body("name")
    .notEmpty()
    .withMessage("name is required")
    .isLength({ max: 200 })
    .withMessage("name must be 200 characters or less")
    .trim(),
  body("short_name")
    .notEmpty()
    .withMessage("short_name is required")
    .isLength({ max: 50 })
    .withMessage("short_name must be 50 characters or less")
    .trim(),
  body("logo_url")
    .optional()
    .isURL()
    .withMessage("logo_url must be a valid URL"),
  body("is_active")
    .notEmpty()
    .withMessage("is_active is required")
    .isIn(["Y", "N", "y", "n"])
    .withMessage("is_active must be 'Y' or 'N'")
    .toUpperCase(),
];

module.exports = {
  // Individual validators
  orgidValidator,
  orgidParamValidator,

  // Complete schemas
  updateOrganizationSchema,
};
