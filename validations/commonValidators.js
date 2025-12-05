const { body, param } = require("express-validator");

/**
 * Common reusable validators used across different schemas
 */

/**
 * Active status validator (Y/N)
 */
const isActiveValidator = (field = "is_active", optional = true) => {
  const validator = body(field)
    .optional({ checkFalsy: optional })
    .isIn(["Y", "N"])
    .withMessage(`${field} must be 'Y' or 'N'`)
    .toUpperCase();
  if (!optional) {
    return validator.notEmpty().withMessage(`${field} is required`);
  }
  return validator.default("N");
};

/**
 * Date validator
 */
const dateValidator = (field, required = true) => {
  if (required) {
    return body(field)
      .notEmpty()
      .withMessage(`${field} is required`)
      .isISO8601()
      .withMessage(`${field} must be a valid ISO 8601 date (YYYY-MM-DD)`)
      .toDate();
  } else {
    return body(field)
      .optional({ checkFalsy: true })
      .isISO8601()
      .withMessage(`${field} must be a valid ISO 8601 date (YYYY-MM-DD)`)
      .toDate();
  }
};

/**
 * Email validator
 */
const emailValidator = (field = "email", required = false) => {
  const validator = body(field)
    .optional({ checkFalsy: !required })
    .isEmail()
    .withMessage(`${field} must be a valid email address`)
    .normalizeEmail();
  if (required) {
    return validator.notEmpty().withMessage(`${field} is required`);
  }
  return validator;
};

/**
 * Username validator (for body)
 */
const usernameValidator = (field = "username", required = true) => {
  const validator = body(field)
    .optional({ checkFalsy: !required })
    .trim()
    .isLength({ min: 3, max: 30 })
    .withMessage(`${field} must be between 3 and 30 characters`);
  // .matches(/^[a-zA-Z0-9_-]+$/)
  // .withMessage(
  //   `${field} can only contain letters, numbers, underscores, and hyphens`
  // )
  if (required) {
    return validator.notEmpty().withMessage(`${field} is required`);
  }
  return validator;
};

/**
 * Username param validator (for URL parameters)
 */
const usernameParamValidator = (field = "username") => {
  return param(field)
    .notEmpty()
    .withMessage(`${field} is required`)
    .trim()
    .isLength({ min: 3, max: 30 })
    .withMessage(`${field} must be between 3 and 30 characters`);
};

/**
 * Phone number validator
 */
const phoneValidator = (field = "phone", required = false) => {
  const validator = body(field).optional({ checkFalsy: !required }).trim();
  if (required) {
    return validator.notEmpty().withMessage(`${field} is required`);
  }
  return validator;
};

/**
 * Gender validator
 */
const genderValidator = (field = "gender", required = false) => {
  const validator = body(field)
    .optional({ checkFalsy: !required })
    .isIn(["Male", "Female", "Other", "M", "F", "O"])
    .withMessage(`${field} must be Male/Female/Other or M/F/O`)
    .trim();
  if (required) {
    return validator.notEmpty().withMessage(`${field} is required`);
  }
  return validator;
};

/**
 * Yes/No validator
 */
const yesNoValidator = (field, required = false) => {
  const validator = body(field)
    .optional({ checkFalsy: !required })
    .isIn(["Y", "N", "y", "n"])
    .withMessage(`${field} must be 'Y' or 'N'`)
    .toUpperCase();
  if (required) {
    return validator.notEmpty().withMessage(`${field} is required`);
  }
  return validator.default("N");
};

/**
 * URL validator
 */
const urlValidator = (field = "url", required = false) => {
  const validator = body(field)
    .optional({ checkFalsy: !required })
    .isURL()
    .withMessage(`${field} must be a valid URL`);
  if (required) {
    return validator.notEmpty().withMessage(`${field} is required`);
  }
  return validator;
};

/**
 * Integer ID validator
 */
const integerIdValidator = (field, required = false) => {
  const validator = body(field)
    .optional({ checkFalsy: !required })
    .isInt({ min: 1 })
    .withMessage(`${field} must be a positive integer`)
    .toInt();
  if (required) {
    return validator.notEmpty().withMessage(`${field} is required`);
  }
  return validator;
};

module.exports = {
  isActiveValidator,
  dateValidator,
  emailValidator,
  usernameValidator,
  usernameParamValidator,
  phoneValidator,
  genderValidator,
  yesNoValidator,
  urlValidator,
  integerIdValidator,
};
