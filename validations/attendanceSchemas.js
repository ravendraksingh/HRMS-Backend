const { body, param, query } = require("express-validator");
const { empidParamValidator } = require("./employeeSchemas");
const { dateValidator, integerIdValidator } = require("./commonValidators");

// ============================================
// ATTENDANCE CORRECTION REQUEST FIELD VALIDATORS
// ============================================

/**
 * Correction date validator (for body)
 */
const correctionDateValidator = body("correction_date")
  .notEmpty()
  .withMessage("correction_date is required")
  .isISO8601()
  .withMessage("correction_date must be a valid ISO 8601 date (YYYY-MM-DD)");

/**
 * Attendance record ID validator (optional)
 * Uses the common integerIdValidator pattern
 */
const attendanceRecordIdValidator = integerIdValidator(
  "attendance_record_id",
  false
);

/**
 * Requested check-in time validator (optional)
 */
const requestedCheckInValidator = body("requested_check_in")
  .optional()
  .isISO8601()
  .withMessage("requested_check_in must be a valid ISO 8601 datetime");

/**
 * Requested check-out time validator (optional)
 */
const requestedCheckOutValidator = body("requested_check_out")
  .optional()
  .isISO8601()
  .withMessage("requested_check_out must be a valid ISO 8601 datetime");

/**
 * Reason validator (required for correction requests)
 */
const correctionReasonValidator = body("reason")
  .notEmpty()
  .withMessage("reason is required")
  .trim()
  .isLength({ min: 1, max: 500 })
  .withMessage("reason must be between 1 and 500 characters");

/**
 * Status query validator for correction requests
 */
const correctionStatusQueryValidator = query("status")
  .optional()
  .isIn(["PENDING", "APPROVED", "REJECTED"])
  .withMessage("status must be one of: PENDING, APPROVED, REJECTED");

/**
 * Date range query validators for correction requests
 */
const correctionFromDateQueryValidator = query("from_date")
  .optional()
  .isISO8601()
  .withMessage("from_date must be a valid ISO 8601 date (YYYY-MM-DD)");

const correctionToDateQueryValidator = query("to_date")
  .optional()
  .isISO8601()
  .withMessage("to_date must be a valid ISO 8601 date (YYYY-MM-DD)")
  .custom((value, { req }) => {
    const fromDate = req.query.from_date;
    if (fromDate && value) {
      const from = new Date(fromDate);
      const to = new Date(value);
      if (to < from) {
        throw new Error("to_date cannot be less than from_date");
      }
    }
    return true;
  });

// ============================================
// ATTENDANCE CORRECTION REQUEST VALIDATION SCHEMAS
// ============================================

/**
 * Schema for creating a correction request
 */
const createCorrectionRequestSchema = [
  empidParamValidator,
  correctionDateValidator,
  attendanceRecordIdValidator,
  requestedCheckInValidator,
  requestedCheckOutValidator,
  correctionReasonValidator,
];

/**
 * Schema for getting correction requests (query params)
 */
const getCorrectionRequestsQuerySchema = [
  empidParamValidator,
  correctionStatusQueryValidator,
  correctionFromDateQueryValidator,
  correctionToDateQueryValidator,
];

module.exports = {
  // Individual validators
  correctionDateValidator,
  attendanceRecordIdValidator,
  requestedCheckInValidator,
  requestedCheckOutValidator,
  correctionReasonValidator,
  correctionStatusQueryValidator,
  correctionFromDateQueryValidator,
  correctionToDateQueryValidator,

  // Validation schemas
  createCorrectionRequestSchema,
  getCorrectionRequestsQuerySchema,
};
