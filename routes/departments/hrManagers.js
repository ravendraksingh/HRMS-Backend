// routes/departments/hrManagers.js
const express = require("express");
const router = express.Router();
const pool = require("../../db");
const ApiError = require("../../util/ApiError");
const { resolveEmployeeNumericId, resolveDepartmentNumericId } = require("../../util/employeeUtil");

/**
 * GET /departments/:identifier/hr-managers
 * Get all HR managers for a department
 */
router.get("/:identifier/hr-managers", async (req, res, next) => {
  const identifier = req.params.identifier;
  const organization_id = req.organizationId;

  try {
    // Resolve department ID
    const departmentId = await resolveDepartmentNumericId(identifier, organization_id);

    // Fetch HR managers for the department
    const [hrManagers] = await pool.query(
      `SELECT 
        dhm.id,
        dhm.department_id,
        dhm.hr_manager_id,
        dhm.created_at,
        e.employee_code,
        e.name as hr_manager_name,
        e.email as hr_manager_email
      FROM department_hr_managers dhm
      INNER JOIN employees e ON dhm.hr_manager_id = e.id
      WHERE dhm.department_id = ? AND dhm.organization_id = ?
      ORDER BY e.name`,
      [departmentId, organization_id]
    );

    res.json({ hr_managers: hrManagers });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /departments/:identifier/hr-managers
 * Add an HR manager to a department
 */
router.post("/:identifier/hr-managers", async (req, res, next) => {
  const identifier = req.params.identifier;
  const { hr_manager } = req.body; // Can be numeric ID or employee_code
  const organization_id = req.organizationId;

  try {
    if (!hr_manager) {
      throw new ApiError("hr_manager is required", 400);
    }

    // Resolve department ID
    const departmentId = await resolveDepartmentNumericId(identifier, organization_id);

    // Resolve HR manager ID
    const hrManagerId = await resolveEmployeeNumericId(hr_manager, organization_id);

    // Validate HR manager exists and belongs to organization
    const [[hrMgr]] = await pool.query(
      "SELECT id FROM employees WHERE id = ? AND organization_id = ?",
      [hrManagerId, organization_id]
    );
    if (!hrMgr) {
      throw new ApiError(
        "HR Manager not found or doesn't belong to organization",
        404
      );
    }

    // Check if HR manager is already assigned to this department
    const [[existing]] = await pool.query(
      "SELECT id FROM department_hr_managers WHERE department_id = ? AND hr_manager_id = ? AND organization_id = ?",
      [departmentId, hrManagerId, organization_id]
    );
    if (existing) {
      throw new ApiError(
        "HR Manager is already assigned to this department",
        409
      );
    }

    // Insert HR manager assignment
    const [result] = await pool.query(
      "INSERT INTO department_hr_managers (organization_id, department_id, hr_manager_id) VALUES (?, ?, ?)",
      [organization_id, departmentId, hrManagerId]
    );

    // Fetch created assignment with employee details
    const [[assignment]] = await pool.query(
      `SELECT 
        dhm.id,
        dhm.department_id,
        dhm.hr_manager_id,
        dhm.created_at,
        e.employee_code,
        e.name as hr_manager_name,
        e.email as hr_manager_email
      FROM department_hr_managers dhm
      INNER JOIN employees e ON dhm.hr_manager_id = e.id
      WHERE dhm.id = ?`,
      [result.insertId]
    );

    res.status(201).json(assignment);
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /departments/:identifier/hr-managers/:hr_manager_id
 * Remove an HR manager from a department
 */
router.delete("/:identifier/hr-managers/:hr_manager_id", async (req, res, next) => {
  const identifier = req.params.identifier;
  const hrManagerIdParam = req.params.hr_manager_id;
  const organization_id = req.organizationId;

  try {
    // Resolve department ID
    const departmentId = await resolveDepartmentNumericId(identifier, organization_id);

    // Resolve HR manager ID
    const hrManagerId = await resolveEmployeeNumericId(hrManagerIdParam, organization_id);

    // Delete the assignment
    const [result] = await pool.query(
      "DELETE FROM department_hr_managers WHERE department_id = ? AND hr_manager_id = ? AND organization_id = ?",
      [departmentId, hrManagerId, organization_id]
    );

    if (result.affectedRows === 0) {
      throw new ApiError("HR Manager assignment not found", 404);
    }

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

module.exports = router;

