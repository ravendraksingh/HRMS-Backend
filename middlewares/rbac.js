/**
 * Role-Based Access Control (RBAC) Middleware
 *
 * Controls access to employee records based on user roles:
 * - USER: Can only access their own records
 * - MANAGER: Can access their own records + employees reporting to them
 * - HRMANAGER/ADMIN: Can access all records
 */

const pool = require("../db");
const ApiError = require("../errors/ApiError");
const { SELECT_EMPLOYEE_EXISTS } = require("../queries/employees");

/**
 * Check if a user has permission to access an employee's records
 * @param {string} userEmpId - The employee ID of the requesting user
 * @param {string[]} userRoles - Array of role IDs for the user
 * @param {string} targetEmpId - The employee ID being accessed
 * @returns {Promise<boolean>} True if access is allowed, false otherwise
 */
async function checkEmployeeAccess(userEmpId, userRoles, targetEmpId) {
  // If user is accessing their own record, always allow
  if (userEmpId === targetEmpId) {
    return true;
  }

  // HRMANAGER and ADMIN can access all records
  if (userRoles.includes("HRMANAGER") || userRoles.includes("ADMIN")) {
    return true;
  }

  // USER role can only access their own records (already checked above)
  if (userRoles.includes("USER") && !userRoles.includes("MANAGER")) {
    return false;
  }

  // MANAGER role can access their own records + direct reports
  if (userRoles.includes("MANAGER")) {
    // Check if target employee reports to this manager
    const [[employee]] = await pool.query(
      "SELECT empid, manager_id FROM employees WHERE empid = ?",
      [targetEmpId]
    );

    if (!employee) {
      return false; // Employee doesn't exist
    }

    // Check if the target employee's manager_id matches the user's empid
    if (employee.manager_id === userEmpId) {
      return true;
    }
  }

  // Default: deny access
  return false;
}

/**
 * RBAC Middleware Factory
 * Creates a middleware function that checks employee access based on role
 *
 * @param {object} options - Configuration options
 * @param {string} options.employeeIdSource - Where to get employee ID from: 'params', 'query', 'body', or 'custom'
 * @param {string} options.employeeIdParam - Parameter name to look for (default: 'empid')
 * @param {function} options.getEmployeeId - Custom function to extract employee ID from request
 * @returns {function} Express middleware function
 */
function authorizeEmployeeAccess(options = {}) {
  const {
    employeeIdSource = "params", // 'params', 'query', 'body', or 'custom'
    employeeIdParam = "empid",
    getEmployeeId = null, // Custom function: (req) => string
  } = options;

  return async (req, res, next) => {
    try {
      // Ensure user is authenticated (should be set by authenticateJWT middleware)
      if (!req.user || !req.user.empid) {
        throw ApiError.unauthorized("User not authenticated");
      }

      const userEmpId = req.user.empid;
      const userRoles = req.user.roles || [];

      // Extract target employee ID based on configuration
      let targetEmpId = null;

      if (getEmployeeId && typeof getEmployeeId === "function") {
        // Use custom function
        targetEmpId = getEmployeeId(req);
      } else if (employeeIdSource === "params") {
        targetEmpId = req.params[employeeIdParam];
      } else if (employeeIdSource === "query") {
        targetEmpId = req.query[employeeIdParam];
      } else if (employeeIdSource === "body") {
        targetEmpId = req.body[employeeIdParam];
      }

      // If no target employee ID found, skip authorization (might be a list endpoint)
      if (!targetEmpId) {
        // For list endpoints, we might want to filter results instead
        // For now, we'll allow it and let the route handler decide
        return next();
      }

      // Check if user has access to this employee
      const hasAccess = await checkEmployeeAccess(
        userEmpId,
        userRoles,
        targetEmpId
      );

      if (!hasAccess) {
        throw ApiError.forbidden(
          "You do not have permission to access this employee's records"
        );
      }

      // Access granted, continue to next middleware/route handler
      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Default RBAC middleware for employee routes
 * Checks req.params.empid by default
 */
const authorizeEmployee = authorizeEmployeeAccess({
  employeeIdSource: "params",
  employeeIdParam: "empid",
});

/**
 * RBAC middleware for query parameter-based employee access
 * Useful for routes like GET /employees?empid=EMP001
 */
const authorizeEmployeeQuery = authorizeEmployeeAccess({
  employeeIdSource: "query",
  employeeIdParam: "empid",
});

/**
 * RBAC middleware for body parameter-based employee access
 * Useful for POST/PUT requests where empid is in the request body
 */
const authorizeEmployeeBody = authorizeEmployeeAccess({
  employeeIdSource: "body",
  employeeIdParam: "empid",
});

/**
 * Middleware to require specific roles
 * @param {string[]} allowedRoles - Array of role IDs that are allowed
 * @param {string} errorMessage - Custom error message (optional)
 * @returns {function} Express middleware function
 */
function requireRoles(allowedRoles, errorMessage = null) {
  return (req, res, next) => {
    try {
      // Ensure user is authenticated (should be set by authenticateJWT middleware)
      if (!req.user || !req.user.roles) {
        throw ApiError.unauthorized("User not authenticated");
      }

      const userRoles = req.user.roles || [];

      // Check if user has at least one of the required roles
      const hasRequiredRole = allowedRoles.some((role) =>
        userRoles.includes(role)
      );

      if (!hasRequiredRole) {
        const message =
          errorMessage ||
          `Access denied. Required roles: ${allowedRoles.join(", ")}`;
        throw ApiError.forbidden(message);
      }

      // User has required role, continue
      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Middleware to require HRMANAGER or ADMIN role
 * Useful for organization and sensitive operations
 */
const requireHRManagerOrAdmin = requireRoles(
  ["HRMANAGER", "ADMIN"],
  "Access denied. HR Manager or Admin role required"
);

/**
 * Middleware to require ADMIN role only
 */
const requireAdmin = requireRoles(
  ["ADMIN"],
  "Access denied. Admin role required"
);

/**
 * Get SQL WHERE clause to filter employees based on user role
 * Useful for list endpoints where you need to filter results
 *
 * @param {string} userEmpId - The employee ID of the requesting user
 * @param {string[]} userRoles - Array of role IDs for the user
 * @param {string} tableAlias - Table alias to use in SQL (default: 'e')
 * @returns {object} Object with { whereClause, params } for SQL query
 */
function getEmployeeFilterClause(userEmpId, userRoles, tableAlias = "e") {
  // HRMANAGER and ADMIN can see all employees
  if (userRoles.includes("HRMANAGER") || userRoles.includes("ADMIN")) {
    return {
      whereClause: "", // No filter needed
      params: [],
    };
  }

  // USER role can only see themselves
  if (userRoles.includes("USER") && !userRoles.includes("MANAGER")) {
    return {
      whereClause: `${tableAlias}.empid = ?`,
      params: [userEmpId],
    };
  }

  // MANAGER role can see themselves + direct reports
  if (userRoles.includes("MANAGER")) {
    return {
      whereClause: `${tableAlias}.empid = ? OR ${tableAlias}.manager_id = ?`,
      params: [userEmpId, userEmpId],
    };
  }

  // Default: only own records (shouldn't reach here if roles are properly assigned)
  return {
    whereClause: `${tableAlias}.empid = ?`,
    params: [userEmpId],
  };
}

module.exports = {
  authorizeEmployeeAccess,
  authorizeEmployee,
  authorizeEmployeeQuery,
  authorizeEmployeeBody,
  checkEmployeeAccess, // Export for use in route handlers if needed
  getEmployeeFilterClause, // Export for filtering employee lists
  requireRoles, // Generic role requirement middleware
  requireHRManagerOrAdmin, // Middleware for HRMANAGER or ADMIN
  requireAdmin, // Middleware for ADMIN only
};
