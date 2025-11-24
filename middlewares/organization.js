const ApiError = require("../util/ApiError");

/**
 * Middleware to extract organization_id from authenticated user's JWT token
 * Attaches organization_id to req.organizationId for use in routes
 *
 * Note: This middleware must be used AFTER authenticateJWT middleware
 * which sets req.user with the decoded JWT token containing organization_id
 */
function extractOrganizationId(req, res, next) {
  // Get organization_id from authenticated user (from JWT token)
  // authenticateJWT middleware must run before this to set req.user
  if (!req.user || !req.user.organization_id) {
    return next(
      new ApiError(
        "User organization not found in token. Ensure authenticateJWT middleware runs before this.",
        401
      )
    );
  }

  // Parse and validate organization_id
  const organizationId = parseInt(req.user. 10);
  if (isNaN(organizationId) || organizationId <= 0) {
    return next(
      new ApiError(
        "Invalid organization_id in token. Must be a positive integer",
        401
      )
    );
  }

  // Attach to request object (for backward compatibility with existing routes)
  req.organizationId = organizationId;
  next();
}

module.exports = { extractOrganizationId };
