const { body, param } = require("express-validator");
const { yesNoValidator, isActiveValidator } = require("./commonValidators");

// ============================================
// LEAVE TYPE FIELD VALIDATORS
// ============================================

/**
 * Leave Type ID validator (for body)
 */
const leavetypeIdValidator = body("leavetype_id")
  .notEmpty()
  .withMessage("leavetype_id is required")
  .isLength({ min: 1, max: 3 })
  .withMessage("leavetype_id must be 3 characters or less")
  .trim()
  .toUpperCase();

/**
 * Leave Type ID param validator
 */
const leavetypeIdParamValidator = param("id")
  .notEmpty()
  .withMessage("id is required")
  .trim()
  .toUpperCase();

/**
 * Leave Type name validator
 */
const leaveTypeNameValidator = (required = true) => {
  const validator = body("name")
    .optional({ checkFalsy: !required })
    .trim();
  if (required) {
    return validator.notEmpty().withMessage("name is required");
  }
  return validator.notEmpty().withMessage("name cannot be empty if provided");
};

/**
 * Description validator
 */
const descriptionValidator = body("description")
  .optional()
  .trim();

/**
 * Max leaves per year validator
 */
const maxLeavesPerYearValidator = body("max_leaves_per_year")
  .optional()
  .isInt({ min: 0 })
  .withMessage("max_leaves_per_year must be a non-negative integer")
  .toInt();

/**
 * Max carry forward validator
 */
const maxCarryForwardValidator = body("max_carry_forward")
  .optional()
  .isInt({ min: 0 })
  .withMessage("max_carry_forward must be a non-negative integer")
  .toInt();

// ============================================
// LEAVE TYPE VALIDATION SCHEMAS
// ============================================

/**
 * Schema for creating a leave type
 */
const createLeaveTypeSchema = [
  leavetypeIdValidator,
  leaveTypeNameValidator(true),
  descriptionValidator,
  maxLeavesPerYearValidator,
  yesNoValidator("carry_forward", false),
  maxCarryForwardValidator,
  yesNoValidator("requires_approval", false),
  yesNoValidator("requires_medical_certificate", false),
  isActiveValidator("is_active", false),
];

/**
 * Schema for updating a leave type
 */
const updateLeaveTypeSchema = [
  leavetypeIdParamValidator,
  leaveTypeNameValidator(false),
  descriptionValidator,
  maxLeavesPerYearValidator,
  yesNoValidator("carry_forward", false),
  maxCarryForwardValidator,
  yesNoValidator("requires_approval", false),
  yesNoValidator("requires_medical_certificate", false),
  isActiveValidator("is_active", false),
  // Custom validation: ensure at least one field is provided for update
  body().custom((value, { req }) => {
    const {
      name,
      description,
      max_leaves_per_year,
      carry_forward,
      max_carry_forward,
      requires_approval,
      requires_medical_certificate,
      is_active,
    } = req.body;
    if (
      name === undefined &&
      description === undefined &&
      max_leaves_per_year === undefined &&
      carry_forward === undefined &&
      max_carry_forward === undefined &&
      requires_approval === undefined &&
      requires_medical_certificate === undefined &&
      is_active === undefined
    ) {
      throw new Error(
        "At least one field must be provided for update"
      );
    }
    return true;
  }),
];

/**
 * Schema for getting/updating/deleting a leave type by ID
 */
const leaveTypeIdParamSchema = [leavetypeIdParamValidator];

module.exports = {
  // Individual validators
  leavetypeIdValidator,
  leavetypeIdParamValidator,
  leaveTypeNameValidator,

  // Validation schemas
  createLeaveTypeSchema,
  updateLeaveTypeSchema,
  leaveTypeIdParamSchema,
};

