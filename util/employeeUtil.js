const pool = require("../db");
const ApiError = require("./ApiError");

/**
 * Validates that an HR manager is assigned to an employee's department
 * @param {number} hrManagerId - HR Manager employee ID
 * @param {number} departmentId - Department ID
 * @param {number} organizationId - Organization ID
 * @returns {Promise<boolean>} - True if HR manager is valid for department
 */
async function validateHrManagerForDepartment(hrManagerId, departmentId) {
  if (!hrManagerId || !departmentId) {
    return false;
  }

  const [[assignment]] = await pool.query(
    `SELECT id FROM department_hr_managers 
     WHERE hr_manager_id = ? 
     AND department_id = ?`,
    [hrManagerId, departmentId]
  );

  return !!assignment;
}

/**
 * Gets available HR managers for a department
 * @param {number} departmentId - Department ID
 * @param {number} organizationId - Organization ID
 * @returns {Promise<Array>} - Array of HR manager employees
 */
async function getHrManagersForDepartment(departmentId) {
  const [hrManagers] = await pool.query(
    `SELECT 
      e.id,
      e.employee_code,
      e.name,
      e.email
    FROM department_hr_managers dhm
    INNER JOIN employees e ON dhm.hr_manager_id = e.id
    WHERE dhm.department_id = ?
    ORDER BY e.name`,
    [departmentId]
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
async function autoAssignHrManager(employeeId, departmentId) {
  const hrManagers = await getHrManagersForDepartment(departmentId);

  if (hrManagers.length === 1) {
    // Auto-assign if only one HR manager
    if (employeeId) {
      await pool.query("UPDATE employees SET hr_manager_id = ? WHERE id = ?", [
        hrManagers[0].id,
        employeeId,
      ]);
    }
    return hrManagers[0].id;
  }

  return null;
}

module.exports = {
  validateHrManagerForDepartment,
  getHrManagersForDepartment,
  autoAssignHrManager,
};
