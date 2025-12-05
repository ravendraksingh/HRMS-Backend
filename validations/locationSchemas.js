const { body, param } = require("express-validator");
const { phoneValidator } = require("./commonValidators");

// ============================================
// LOCATION FIELD VALIDATORS
// ============================================

/**
 * Location ID param validator
 */
const locationIdParamValidator = param("id")
  .notEmpty()
  .withMessage("id is required")
  .isInt({ min: 1 })
  .withMessage("id must be a positive integer")
  .toInt();

// ============================================
// LOCATION VALIDATION SCHEMAS
// ============================================

/**
 * Schema for creating a location
 */
const createLocationSchema = [
  body("name")
    .notEmpty()
    .withMessage("name is required")
    .isLength({ max: 150 })
    .withMessage("name must be 150 characters or less")
    .trim(),
  body("address_line1")
    .notEmpty()
    .withMessage("address_line1 is required")
    .isLength({ max: 200 })
    .withMessage("address_line1 must be 200 characters or less")
    .trim(),
  body("address_line2")
    .optional()
    .isLength({ max: 200 })
    .withMessage("address_line2 must be 200 characters or less")
    .trim(),
  body("city")
    .notEmpty()
    .withMessage("city is required")
    .isLength({ max: 100 })
    .withMessage("city must be 100 characters or less")
    .trim(),
  body("state")
    .notEmpty()
    .withMessage("state is required")
    .isLength({ max: 100 })
    .withMessage("state must be 100 characters or less")
    .trim(),
  body("postal_code")
    .notEmpty()
    .withMessage("postal_code is required")
    .isLength({ max: 20 })
    .withMessage("postal_code must be 20 characters or less")
    .trim(),
  body("country")
    .notEmpty()
    .withMessage("country is required")
    .isLength({ max: 100 })
    .withMessage("country must be 100 characters or less")
    .trim(),
  phoneValidator("phone", false), // Optional
];

/**
 * Schema for updating a location
 */
const updateLocationSchema = [
  locationIdParamValidator,
  body("name")
    .optional()
    .notEmpty()
    .withMessage("name cannot be empty if provided")
    .isLength({ max: 150 })
    .withMessage("name must be 150 characters or less")
    .trim(),
  body("address_line1")
    .optional()
    .notEmpty()
    .withMessage("address_line1 cannot be empty if provided")
    .isLength({ max: 200 })
    .withMessage("address_line1 must be 200 characters or less")
    .trim(),
  body("address_line2")
    .optional()
    .isLength({ max: 200 })
    .withMessage("address_line2 must be 200 characters or less")
    .trim(),
  body("city")
    .optional()
    .notEmpty()
    .withMessage("city cannot be empty if provided")
    .isLength({ max: 100 })
    .withMessage("city must be 100 characters or less")
    .trim(),
  body("state")
    .optional()
    .notEmpty()
    .withMessage("state cannot be empty if provided")
    .isLength({ max: 100 })
    .withMessage("state must be 100 characters or less")
    .trim(),
  body("postal_code")
    .optional()
    .notEmpty()
    .withMessage("postal_code cannot be empty if provided")
    .isLength({ max: 20 })
    .withMessage("postal_code must be 20 characters or less")
    .trim(),
  body("country")
    .optional()
    .notEmpty()
    .withMessage("country cannot be empty if provided")
    .isLength({ max: 100 })
    .withMessage("country must be 100 characters or less")
    .trim(),
  phoneValidator("phone", false), // Optional
  // Custom validation: ensure at least one field is provided for update
  body().custom((value, { req }) => {
    const {
      name,
      address_line1,
      address_line2,
      city,
      state,
      postal_code,
      country,
      phone,
    } = req.body;
    if (
      name === undefined &&
      address_line1 === undefined &&
      address_line2 === undefined &&
      city === undefined &&
      state === undefined &&
      postal_code === undefined &&
      country === undefined &&
      phone === undefined
    ) {
      throw new Error("At least one field must be provided for update");
    }
    return true;
  }),
];

/**
 * Schema for getting/deleting a location by ID
 */
const locationIdParamSchema = [locationIdParamValidator];

module.exports = {
  // Individual validators
  locationIdParamValidator,

  // Validation schemas
  createLocationSchema,
  updateLocationSchema,
  locationIdParamSchema,
};

