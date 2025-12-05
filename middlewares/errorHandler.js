const ApiError = require("../errors/ApiError");

/**
 * Error handler middleware
 * Handles all errors thrown in the application
 */
function errorHandler(err, req, res, next) {
  // Log error with context
  const logContext = {
    method: req.method,
    path: req.originalUrl,
    status: err.status || err.statusCode || 500,
    username: req.user?.username || null,
    empid: req.user?.empid || null,
  };

  // Include validation details if present
  if (err instanceof ApiError && err.details) {
    logContext.details = err.details;
  } else if (err.details) {
    logContext.details = err.details;
  }

  // For validation errors, log details separately for better visibility
  if (
    err instanceof ApiError &&
    err.code === "VALIDATION_ERROR" &&
    err.details
  ) {
    console.error("Validation failed");
    console.error("Validation errors:", JSON.stringify(err.details, null, 2));
  }

  if (err.stack) {
    console.error(err.message, {
      ...logContext,
      stack: err.stack,
    });
  } else {
    console.error(err.message, logContext);
  }

  // If response already sent, delegate to Express default error handler
  if (res.headersSent) {
    return next(err);
  }

  // Handle ApiError instances
  if (err instanceof ApiError) {
    const errorResponse = err.toJSON();
    // Add request context to error response
    // errorResponse.error.path = req.originalUrl;
    // errorResponse.error.method = req.method;
    console.log("errorResponse", errorResponse);
    return res.status(err.status).json(errorResponse);
  }

  // Handle JWT errors - convert to ApiError format
  if (err.name === "JsonWebTokenError" || err.name === "TokenExpiredError") {
    const apiError = ApiError.unauthorized(
      err.name === "TokenExpiredError" ? "Token expired" : "Invalid token",
      { tokenError: err.name }
    );
    const errorResponse = apiError.toJSON();
    errorResponse.path = req.originalUrl;
    errorResponse.method = req.method;
    return res.status(401).json(errorResponse);
  }

  // Handle validation errors - convert to ApiError format
  if (err.name === "ValidationError") {
    const apiError = ApiError.validationError(
      err.message || "Validation error",
      err.errors || null
    );
    const errorResponse = apiError.toJSON();
    // errorResponse.error.path = req.originalUrl;
    // errorResponse.method = req.method;
    return res.status(400).json(errorResponse);
  }

  // Default error response - wrap in ApiError format
  const status = err.status || err.statusCode || 500;
  const apiError = ApiError.internalServerError(
    err.message || "Internal server error",
    err
  );
  const errorResponse = apiError.toJSON();
  errorResponse.path = req.originalUrl;
  errorResponse.method = req.method;
  //   console.log("errorResponse", errorResponse);
  res.status(status).json(errorResponse);
}

module.exports = { errorHandler };
