const { body, param } = require("express-validator");
const {
  usernameValidator,
  usernameParamValidator,
  isActiveValidator,
} = require("./commonValidators");

// ============================================
// USER VALIDATION SCHEMAS
// ============================================

/**
 * Schema for creating a user (POST /users)
 */
const createUserSchema = [
  body("empid")
    .notEmpty()
    .withMessage("empid is required")
    .trim()
    .isLength({ min: 1, max: 10 })
    .withMessage("empid must be between 1 and 10 characters"),
  usernameValidator("username", true),
  body("password")
    .notEmpty()
    .withMessage("password is required")
    .isLength({ min: 8 })
    .withMessage("password must be at least 8 characters long"),
  isActiveValidator("is_active", true),
  body("roleids")
    .optional()
    .isArray()
    .withMessage("roleids must be an array")
    .custom((value) => {
      if (value && value.length > 0) {
        const allStrings = value.every(
          (roleid) => typeof roleid === "string" && roleid.trim().length > 0
        );
        if (!allStrings) {
          throw new Error("All roleids must be non-empty strings");
        }
      }
      return true;
    }),
];

/**
 * Schema for updating a user (PATCH /users/:username)
 */
const updateUserSchema = [
  usernameParamValidator("username"),
  usernameValidator("username", false), // Optional in body for updating
  body("password")
    .optional()
    .notEmpty()
    .withMessage("password cannot be empty if provided")
    .isLength({ min: 8 })
    .withMessage("password must be at least 8 characters long"),
  isActiveValidator("is_active", true),
  body("roleids")
    .optional()
    .isArray()
    .withMessage("roleids must be an array")
    .custom((value) => {
      if (value && value.length > 0) {
        const allStrings = value.every(
          (roleid) => typeof roleid === "string" && roleid.trim().length > 0
        );
        if (!allStrings) {
          throw new Error("All roleids must be non-empty strings");
        }
      }
      return true;
    }),
];

/**
 * Schema for deleting a user (DELETE /users/:username)
 * Only needs username param validation
 */
const deleteUserSchema = [usernameParamValidator("username")];

/**
 * Schema for changing password (PATCH /users/:username/change-password)
 */
const changePasswordSchema = [
  usernameParamValidator("username"),
  body("current_password")
    .notEmpty()
    .withMessage("current_password is required")
    .isLength({ min: 1 })
    .withMessage("current_password cannot be empty"),
  body("new_password")
    .notEmpty()
    .withMessage("new_password is required")
    .isLength({ min: 8 })
    .withMessage("new_password must be at least 8 characters long")
    .custom((value, { req }) => {
      if (value === req.body.current_password) {
        throw new Error("new_password must be different from current_password");
      }
      return true;
    }),
];

module.exports = {
  createUserSchema,
  updateUserSchema,
  deleteUserSchema,
  changePasswordSchema,
};

