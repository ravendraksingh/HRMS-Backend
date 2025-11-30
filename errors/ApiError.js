/**
 * ApiError class for handling API errors
 * Provides detailed error information for consistent error responses
 *
 * @class ApiError
 * @extends Error
 */
class ApiError extends Error {
  /**
   * Creates an instance of ApiError
   *
   * @param {string} message - Human-readable error message
   * @param {number} status - HTTP status code (default: 500)
   * @param {string} code - Error code for programmatic handling (e.g., 'VALIDATION_ERROR', 'NOT_FOUND')
   * @param {object} details - Additional error details (e.g., validation errors, field-specific errors)
   * @param {Error} originalError - Original error that caused this ApiError (for debugging)
   */
  constructor(
    message,
    status = 500,
    code = null,
    details = null,
    originalError = null
  ) {
    super(message);

    // Set error name for better error identification
    this.name = "ApiError";

    // HTTP status code
    this.status = status;
    this.statusCode = status; // Alias for compatibility

    // Error code for programmatic handling
    this.code = code || this._getDefaultErrorCode(status);

    // Additional error details (useful for validation errors, field-specific errors, etc.)
    this.details = details;

    // Store original error for debugging
    this.originalError = originalError;

    // Timestamp when error was created
    this.timestamp = new Date().toISOString();

    // Maintain proper stack trace for where our error was thrown (only if available)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ApiError);
    }
  }

  /**
   * Get default error code based on HTTP status
   * @private
   */
  _getDefaultErrorCode(status) {
    const statusCodeMap = {
      400: "BAD_REQUEST",
      401: "UNAUTHORIZED",
      403: "FORBIDDEN",
      404: "NOT_FOUND",
      409: "CONFLICT",
      422: "UNPROCESSABLE_ENTITY",
      429: "TOO_MANY_REQUESTS",
      500: "INTERNAL_SERVER_ERROR",
      502: "BAD_GATEWAY",
      503: "SERVICE_UNAVAILABLE",
    };
    return statusCodeMap[status] || "INTERNAL_SERVER_ERROR";
  }

  /**
   * Convert error to JSON format for API response
   * @returns {object} Error object ready for JSON serialization
   */
  toJSON() {
    const errorObj = {
      error: {
        message: this.message,
        code: this.code,
        status: this.status,
        // timestamp: this.timestamp,
      },
    };

    // Add details if present
    if (this.details) {
      errorObj.error.details = this.details;
    }

    // Add stack trace in development mode
    if (process.env.NODE_ENV === "development" && this.stack) {
      errorObj.error.stack = this.stack;
    }

    // Add original error info in development mode
    if (process.env.NODE_ENV === "development" && this.originalError) {
      errorObj.error.originalError = {
        message: this.originalError.message,
        name: this.originalError.name,
      };
    }

    return errorObj;
  }

  /**
   * Static factory methods for common error types
   */
  static badRequest(message, details = null) {
    return new ApiError(message, 400, "BAD_REQUEST", details);
  }

  static unauthorized(message = "Unauthorized", details = null) {
    return new ApiError(message, 401, "UNAUTHORIZED", details);
  }

  static forbidden(message = "Forbidden", details = null) {
    return new ApiError(message, 403, "FORBIDDEN", details);
  }

  static notFound(message = "Resource not found", details = null) {
    return new ApiError(message, 404, "NOT_FOUND", details);
  }

  static conflict(message, details = null) {
    return new ApiError(message, 409, "CONFLICT", details);
  }

  static unprocessableEntity(message, details = null) {
    return new ApiError(message, 422, "UNPROCESSABLE_ENTITY", details);
  }

  static internalServerError(
    message = "Internal server error",
    originalError = null
  ) {
    return new ApiError(
      message,
      500,
      "INTERNAL_SERVER_ERROR",
      null,
      originalError
    );
  }

  static validationError(message, validationErrors = null) {
    return new ApiError(message, 400, "VALIDATION_ERROR", validationErrors);
  }
}

module.exports = ApiError;
