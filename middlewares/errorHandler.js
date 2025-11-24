const ApiError = require("../util/ApiError");

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
    user_id: req.user?.id || null,
  };

  if (err.stack) {
    console.error(err.message, {
      ...logContext,
      stack: err.stack,
      error: err,
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
    return res.status(err.status).json({
      error: err.message,
      status: err.status,
      path: req.originalUrl,
      method: req.method,
    });
  }

  // Handle JWT errors
  if (err.name === "JsonWebTokenError" || err.name === "TokenExpiredError") {
    return res.status(401).json({
      error: "Invalid or expired token",
      status: 401,
      path: req.originalUrl,
      method: req.method,
    });
  }

  // Handle validation errors
  if (err.name === "ValidationError") {
    return res.status(400).json({
      error: err.message || "Validation error",
      status: 400,
      path: req.originalUrl,
      method: req.method,
    });
  }

  // Default error response
  const status = err.status || err.statusCode || 500;
  res.status(status).json({
    error: err.message || "Internal server error",
    status: status,
    path: req.originalUrl,
    method: req.method,
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
}

module.exports = { errorHandler };
