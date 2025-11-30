const { validationResult } = require("express-validator");
const ApiError = require("../errors/ApiError");

/**
 * Middleware to handle express-validator errors
 * Converts validation errors to ApiError format
 */
function handleValidationErrors(req, res, next) {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    // Format errors for ApiError
    const formattedErrors = errors.array().map((err) => ({
      field: err.path || err.param || err.location,
      message: err.msg,
      //value: err.value,
      //location: err.location, // body, query, params, etc.
    }));

    return next(ApiError.validationError("Validation failed", formattedErrors));
  }

  next();
}

module.exports = { handleValidationErrors };
