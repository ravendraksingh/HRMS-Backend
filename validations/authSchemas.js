const { body } = require("express-validator");

// ============================================
// AUTH VALIDATION SCHEMAS
// ============================================

/**
 * Schema for login
 */
const loginSchema = [
  body("username")
    .notEmpty()
    .withMessage("username is required")
    .trim(),
  body("password")
    .notEmpty()
    .withMessage("password is required")
    .isLength({ min: 3 })
    .withMessage("password must be at least 3 characters long"),
];

/**
 * Schema for user registration
 */
const registerSchema = [
  body("empid")
    .notEmpty()
    .withMessage("empid is required")
    .trim(),
  body("username")
    .notEmpty()
    .withMessage("username is required")
    .isLength({ min: 3, max: 50 })
    .withMessage("username must be between 3 and 50 characters")
    .trim(),
  body("password")
    .notEmpty()
    .withMessage("password is required")
    .isLength({ min: 8 })
    .withMessage("password must be at least 8 characters long"),
  body("is_active")
    .optional()
    .isIn(["Y", "N"])
    .withMessage("is_active must be 'Y' or 'N'")
    .toUpperCase()
    .default("N"),
];

/**
 * Schema for updating password
 */
const updatePasswordSchema = [
  body("username")
    .notEmpty()
    .withMessage("username is required")
    .trim(),
  body("password")
    .notEmpty()
    .withMessage("password is required")
    .isLength({ min: 8 })
    .withMessage("password must be at least 8 characters long"),
];

/**
 * Schema for refresh token
 */
const refreshTokenSchema = [
  body("refresh_token")
    .optional()
    .notEmpty()
    .withMessage("refresh_token cannot be empty if provided")
    .trim(),
  // Note: refresh_token can also come from cookies, so it's optional in body
];

/**
 * Schema for logout
 */
const logoutSchema = [
  body("refresh_token")
    .optional()
    .notEmpty()
    .withMessage("refresh_token cannot be empty if provided")
    .trim(),
  // Note: refresh_token can also come from cookies, so it's optional in body
];

module.exports = {
  loginSchema,
  registerSchema,
  updatePasswordSchema,
  refreshTokenSchema,
  logoutSchema,
};

