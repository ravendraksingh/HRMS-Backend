const { body, param } = require("express-validator");

// ============================================
// DEPARTMENT FIELD VALIDATORS
// ============================================

/**
 * Department ID validator (for body)
 */
const deptidValidator = body("deptid")
  .notEmpty()
  .withMessage("deptid is required")
  .isLength({ max: 10 })
  .withMessage("deptid must be 10 characters or less")
  .trim()
  .toUpperCase();

/**
 * Department ID param validator
 */
const deptidParamValidator = param("deptid")
  .notEmpty()
  .withMessage("deptid is required")
  .trim()
  .toUpperCase();

// ============================================
// DEPARTMENT VALIDATION SCHEMAS
// ============================================

/**
 * Schema for creating a department
 */
const createDepartmentSchema = [
  deptidValidator,
  body("name")
    .notEmpty()
    .withMessage("name is required")
    .isLength({ max: 150 })
    .withMessage("name must be 150 characters or less")
    .trim(),
  body("short_name")
    .optional()
    .isLength({ max: 50 })
    .withMessage("short_name must be 50 characters or less")
    .trim(),
  body("department_head_empid")
    .optional()
    .isLength({ max: 10 })
    .withMessage("department_head_empid must be 10 characters or less")
    .trim()
    .toUpperCase(),
];

/**
 * Schema for updating a department
 */
const updateDepartmentSchema = [
  deptidParamValidator,
  body("name")
    .optional()
    .notEmpty()
    .withMessage("name cannot be empty if provided")
    .isLength({ max: 150 })
    .withMessage("name must be 150 characters or less")
    .trim(),
  body("short_name")
    .optional()
    .isLength({ max: 50 })
    .withMessage("short_name must be 50 characters or less")
    .trim(),
  body("department_head_empid")
    .optional({ checkFalsy: false, nullable: true })
    .custom((value) => {
      // Allow null or empty string to clear department head
      if (value === null || value === "" || value === undefined) {
        return true;
      }
      // If provided, validate length
      if (typeof value === "string" && value.length > 10) {
        throw new Error("department_head_empid must be 10 characters or less");
      }
      return true;
    })
    .customSanitizer((value) => {
      // Only trim and uppercase if value is provided
      if (value && typeof value === "string") {
        return value.trim().toUpperCase();
      }
      return value;
    }),
  // Custom validation: ensure at least one field is provided for update
  body().custom((value, { req }) => {
    const { name, short_name, department_head_empid } = req.body;
    if (
      name === undefined &&
      short_name === undefined &&
      department_head_empid === undefined
    ) {
      throw new Error("At least one field must be provided for update");
    }
    return true;
  }),
];

/**
 * Schema for getting/deleting a department by ID
 */
const deptidParamSchema = [deptidParamValidator];

module.exports = {
  // Individual validators
  deptidValidator,
  deptidParamValidator,

  // Validation schemas
  createDepartmentSchema,
  updateDepartmentSchema,
  deptidParamSchema,
};

