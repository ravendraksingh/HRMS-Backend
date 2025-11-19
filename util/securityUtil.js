const ApiError = require("./ApiError");

/**
 * Validates that a resource belongs to the user's organization
 * Throws error if validation fails
 * 
 * @param {number} resourceOrgId - The organization_id of the resource being accessed
 * @param {number} userOrgId - The organization_id from the authenticated user's token
 * @param {string} resourceType - Type of resource for error message (e.g., "Location", "Employee")
 * @throws {ApiError} If resource doesn't belong to user's organization
 */
function validateOrganizationAccess(resourceOrgId, userOrgId, resourceType = "Resource") {
  if (resourceOrgId !== userOrgId) {
    throw new ApiError(
      `${resourceType} not found or access denied`,
      404 // Use 404 to avoid information leakage about other organizations
    );
  }
}

/**
 * Ensures organization_id from request body is ignored/removed
 * Always use req.organizationId from token instead to prevent tampering
 * 
 * @param {object} body - Request body object
 * @returns {object} Sanitized body without organization_id fields
 */
function sanitizeOrganizationId(body) {
  if (!body || typeof body !== "object") {
    return body;
  }
  
  const sanitized = { ...body };
  delete sanitized.organization_id;
  delete sanitized.org_id;
  delete sanitized.organizationId;
  delete sanitized.orgId;
  
  return sanitized;
}

/**
 * Validates that a database result belongs to the user's organization
 * Throws error if resource not found or doesn't belong to organization
 * 
 * @param {object|null|undefined} resource - Database query result (first row)
 * @param {number} userOrgId - The organization_id from the authenticated user's token
 * @param {string} resourceType - Type of resource for error message
 * @throws {ApiError} If resource not found or doesn't belong to organization
 */
function validateResourceExists(resource, userOrgId, resourceType = "Resource") {
  if (!resource) {
    throw new ApiError(`${resourceType} not found or access denied`, 404);
  }
  
  if (resource.organization_id && resource.organization_id !== userOrgId) {
    throw new ApiError(`${resourceType} not found or access denied`, 404);
  }
}

module.exports = {
  validateOrganizationAccess,
  sanitizeOrganizationId,
  validateResourceExists
};

