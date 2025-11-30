const { body, param } = require("express-validator");
const {
  isActiveValidator,
  urlValidator,
  dateValidator,
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
  body("financial_year")
    .notEmpty()
    .withMessage("financial_year is required")
    .matches(/^\d{4}(-\d{2})?$/)
    .withMessage(
      "financial_year must be in format YYYY or YYYY-YY (e.g., 2024 or 2024-25)"
    )
    .trim(),
  dateValidator("fy_start_date", true), // Required
  dateValidator("fy_end_date", true), // Required
  // Custom validation: ensure fy_end_date is after fy_start_date
  body().custom((value, { req }) => {
    const { fy_start_date, fy_end_date } = req.body;
    if (fy_start_date && fy_end_date) {
      const startDate = new Date(fy_start_date);
      const endDate = new Date(fy_end_date);
      if (endDate <= startDate) {
        throw new Error("fy_end_date must be after fy_start_date");
      }
    }
    return true;
  }),
];

module.exports = {
  // Individual validators
  orgidValidator,
  orgidParamValidator,

  // Complete schemas
  updateOrganizationSchema,
};
