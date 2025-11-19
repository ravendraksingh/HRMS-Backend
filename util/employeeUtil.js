const pool = require("../db");
const ApiError = require("./ApiError");

/**
 * Resolves employee numeric ID from either numeric ID or VARCHAR employee_code
 * @param {string|number} employeeIdParam - Either numeric ID or VARCHAR employee_code
 * @param {number} organizationId - Organization ID
 * @returns {Promise<number>} - Numeric employee ID
 */
async function resolveEmployeeNumericId(employeeIdParam, organizationId) {
  // Check if employeeIdParam is numeric (id) or VARCHAR (employee_code)
  if (/^\d+$/.test(employeeIdParam.toString())) {
    // It's numeric, use it directly
    return parseInt(employeeIdParam, 10);
  } else {
    // It's VARCHAR employee_code, look up the numeric id
    const [[employee]] = await pool.query(
      "SELECT id FROM employees WHERE organization_id = ? AND employee_code = ?",
      [organizationId, employeeIdParam]
    );
    if (!employee) {
      throw new ApiError("Employee not found", 404);
    }
    return employee.id;
  }
}

/**
 * Resolves department numeric ID from either numeric ID or VARCHAR department_code
 * @param {string|number} departmentParam - Either numeric ID or VARCHAR department_code
 * @param {number} organizationId - Organization ID
 * @returns {Promise<number>} - Numeric department ID
 */
async function resolveDepartmentNumericId(departmentParam, organizationId) {
  // Check if departmentParam is numeric (id) or VARCHAR (department_code)
  if (/^\d+$/.test(departmentParam.toString())) {
    // It's numeric, validate it exists and belongs to organization
    const [[dept]] = await pool.query(
      "SELECT id FROM departments WHERE id = ? AND organization_id = ?",
      [departmentParam, organizationId]
    );
    if (!dept) {
      throw new ApiError("Department not found", 404);
    }
    return parseInt(departmentParam, 10);
  } else {
    // It's VARCHAR department_code, look up the numeric id
    const [[dept]] = await pool.query(
      "SELECT id FROM departments WHERE department_code = ? AND organization_id = ?",
      [departmentParam, organizationId]
    );
    if (!dept) {
      throw new ApiError("Department not found", 404);
    }
    return dept.id;
  }
}

/**
 * Validates that an HR manager is assigned to an employee's department
 * @param {number} hrManagerId - HR Manager employee ID
 * @param {number} departmentId - Department ID
 * @param {number} organizationId - Organization ID
 * @returns {Promise<boolean>} - True if HR manager is valid for department
 */
async function validateHrManagerForDepartment(hrManagerId, departmentId, organizationId) {
  if (!hrManagerId || !departmentId) {
    return false;
  }
  
  const [[assignment]] = await pool.query(
    `SELECT id FROM department_hr_managers 
     WHERE hr_manager_id = ? 
     AND department_id = ? 
     AND organization_id = ?`,
    [hrManagerId, departmentId, organizationId]
  );
  
  return !!assignment;
}

/**
 * Gets available HR managers for a department
 * @param {number} departmentId - Department ID
 * @param {number} organizationId - Organization ID
 * @returns {Promise<Array>} - Array of HR manager employees
 */
async function getHrManagersForDepartment(departmentId, organizationId) {
  const [hrManagers] = await pool.query(
    `SELECT 
      e.id,
      e.employee_code,
      e.name,
      e.email
    FROM department_hr_managers dhm
    INNER JOIN employees e ON dhm.hr_manager_id = e.id
    WHERE dhm.department_id = ? AND dhm.organization_id = ?
    ORDER BY e.name`,
    [departmentId, organizationId]
  );
  
  return hrManagers;
}

/**
 * Auto-assigns an HR manager to an employee if department has exactly one HR manager
 * @param {number} employeeId - Employee ID (can be null for new employees)
 * @param {number} departmentId - Department ID
 * @param {number} organizationId - Organization ID
 * @returns {Promise<number|null>} - Assigned HR manager ID or null
 */
async function autoAssignHrManager(employeeId, departmentId, organizationId) {
  const hrManagers = await getHrManagersForDepartment(departmentId, organizationId);
  
  if (hrManagers.length === 1) {
    // Auto-assign if only one HR manager
    if (employeeId) {
      await pool.query(
        "UPDATE employees SET hr_manager_id = ? WHERE id = ? AND organization_id = ?",
        [hrManagers[0].id, employeeId, organizationId]
      );
    }
    return hrManagers[0].id;
  }
  
  return null;
}

module.exports = { 
  resolveEmployeeNumericId, 
  resolveDepartmentNumericId,
  validateHrManagerForDepartment,
  getHrManagersForDepartment,
  autoAssignHrManager
};

