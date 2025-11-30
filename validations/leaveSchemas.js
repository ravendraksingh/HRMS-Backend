const { body, param, query } = require("express-validator");
const { dateValidator } = require("./commonValidators");

// ============================================
// LEAVE FIELD VALIDATORS
// ============================================

/**
 * Employee ID param validator
 */
const empidParamValidator = param("empid")
  .notEmpty()
  .withMessage("empid is required")
  .trim();

/**
 * Start date validator (for body)
 */
const startDateValidator = (required = true) => {
  const validator = body("start_date")
    .optional({ checkFalsy: !required })
    .isISO8601()
    .withMessage("start_date must be a valid ISO 8601 date (YYYY-MM-DD)")
    .toDate();
  if (required) {
    return validator.notEmpty().withMessage("start_date is required");
  }
  return validator;
};

/**
 * End date validator (for body)
 */
const endDateValidator = (required = true) => {
  const validator = body("end_date")
    .optional({ checkFalsy: !required })
    .isISO8601()
    .withMessage("end_date must be a valid ISO 8601 date (YYYY-MM-DD)")
    .toDate();
  if (required) {
    return validator.notEmpty().withMessage("end_date is required");
  }
  return validator;
};

/**
 * Start date query validator (optional)
 */
const startDateQueryValidator = query("start_date")
  .optional()
  .matches(/^\d{4}-\d{2}-\d{2}$/)
  .withMessage(
    "Invalid start_date format. Expected YYYY-MM-DD (e.g., 2024-03-15)"
  )
  .custom((value) => {
    if (value) {
      const date = new Date(value);
      if (isNaN(date.getTime())) {
        throw new Error("Invalid start_date. Please provide a valid date");
      }
    }
    return true;
  });

/**
 * End date query validator (optional)
 */
const endDateQueryValidator = query("end_date")
  .optional()
  .matches(/^\d{4}-\d{2}-\d{2}$/)
  .withMessage(
    "Invalid end_date format. Expected YYYY-MM-DD (e.g., 2024-03-15)"
  )
  .custom((value) => {
    if (value) {
      const date = new Date(value);
      if (isNaN(date.getTime())) {
        throw new Error("Invalid end_date. Please provide a valid date");
      }
    }
    return true;
  })
  .custom((value, { req }) => {
    const startDate = req.query.start_date;
    if (startDate && value) {
      const start = new Date(startDate);
      const end = new Date(value);
      if (end < start) {
        throw new Error("end_date cannot be less than start_date");
      }
    }
    return true;
  });

/**
 * Leave type ID validator
 */
const leavetypeIdValidator = body("leavetype_id")
  .notEmpty()
  .withMessage("leavetype_id is required")
  .isLength({ min: 1, max: 3 })
  .withMessage("leavetype_id must be 3 characters or less")
  .trim()
  .toUpperCase();

/**
 * Reason validator
 */
const reasonValidator = body("reason")
  .optional()
  .isLength({ max: 500 })
  .withMessage("reason must be 500 characters or less")
  .trim();

/**
 * Medical certificate URL validator
 */
const medicalCertificateUrlValidator = body("medical_certificate_url")
  .optional()
  .isURL()
  .withMessage("medical_certificate_url must be a valid URL")
  .isLength({ max: 500 })
  .withMessage("medical_certificate_url must be 500 characters or less")
  .trim();

/**
 * Status query validator
 */
const statusQueryValidator = query("status")
  .optional()
  .isIn(["PENDING", "APPROVED", "REJECTED", "CANCELLED"])
  .withMessage("status must be one of: PENDING, APPROVED, REJECTED, CANCELLED");

/**
 * Date range validation (custom validator for body)
 */
const dateRangeValidator = body().custom((value, { req }) => {
  const { start_date, end_date } = req.body;
  if (start_date && end_date) {
    const start = new Date(start_date);
    const end = new Date(end_date);
    if (end < start) {
      throw new Error("end_date cannot be less than start_date");
    }
  }
  return true;
});

// ============================================
// LEAVE VALIDATION SCHEMAS
// ============================================

/**
 * Schema for getting leaves (query params)
 */
const getLeavesQuerySchema = [
  empidParamValidator,
  startDateQueryValidator,
  endDateQueryValidator,
  statusQueryValidator,
];

/**
 * Schema for creating a leave
 */
const createLeaveSchema = [
  empidParamValidator,
  startDateValidator(true),
  endDateValidator(true),
  leavetypeIdValidator,
  reasonValidator,
  medicalCertificateUrlValidator,
  dateRangeValidator,
];

/**
 * Schema for updating a leave (PATCH)
 */
const updateLeaveSchema = [
  empidParamValidator,
  startDateValidator(false),
  endDateValidator(false),
  leavetypeIdValidator.optional(),
  reasonValidator,
  medicalCertificateUrlValidator,
  dateRangeValidator,
  // Custom validation: ensure at least one field is provided for update
  body().custom((value, { req }) => {
    const {
      start_date,
      end_date,
      leavetype_id,
      reason,
      medical_certificate_url,
    } = req.body;
    if (
      start_date === undefined &&
      end_date === undefined &&
      leavetype_id === undefined &&
      reason === undefined &&
      medical_certificate_url === undefined
    ) {
      throw new Error("At least one field must be provided for update");
    }
    return true;
  }),
];

module.exports = {
  // Individual validators
  empidParamValidator,
  startDateValidator,
  endDateValidator,
  startDateQueryValidator,
  endDateQueryValidator,
  leavetypeIdValidator,
  reasonValidator,
  medicalCertificateUrlValidator,
  statusQueryValidator,

  // Validation schemas
  getLeavesQuerySchema,
  createLeaveSchema,
  updateLeaveSchema,
};
