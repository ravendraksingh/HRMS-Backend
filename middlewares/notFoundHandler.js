const ApiError = require("../errors/ApiError");
/**
 * 404 Not Found Handler
 * 
 * This middleware catches all requests that don't match any defined routes.
 * It should be placed AFTER all route definitions but BEFORE the error handler.
 * 
 * Best practices followed:
 * - Returns consistent error format matching ApiError structure
 * - Includes helpful information (method, path)
 * - Provides clear error message
 * - Uses 404 status code (standard for resource not found)
 * 
 * Inspired by:
 * - GitHub API: Returns "Not Found" with documentation_url
 * - Stripe API: Returns structured error with type and message
 * - RESTful standards: Clear, consistent error responses
 */
function notFoundHandler(req, res, next) {
  // Create ApiError for 404
  const error = new ApiError(
    `Route ${req.method} ${req.originalUrl} not found`,
    404
  );

  // Pass to error handler
  next(error);
}

module.exports = { notFoundHandler };

