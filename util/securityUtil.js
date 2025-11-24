const ApiError = require("./ApiError");

/**
 * Validates that a database result exists
 * Throws error if resource not found
 *
 * @param {object|null|undefined} resource - Database query result (first row)
 * @param {string} resourceType - Type of resource for error message
 * @throws {ApiError} If resource not found
 */
function validateResourceExists(resource, resourceType = "Resource") {
  if (!resource) {
    throw new ApiError(`${resourceType} not found or access denied`, 404);
  }
}

module.exports = {
  validateResourceExists,
};
