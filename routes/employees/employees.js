// routes/employees.js
const express = require("express");
const router = express.Router();
const pool = require("../../db");
const ApiError = require("../../util/ApiError");
const {
  resolveEmployeeNumericId,
  resolveDepartmentNumericId,
  validateHrManagerForDepartment,
  getHrManagersForDepartment,
} = require("../../util/employeeUtil");

// Get all employees (with optional filters)
router.get("/", async (req, res, next) => {
  const { department, manager_id, location_id, name } = req.query;
  const organization_id = req.organizationId;

  try {
    let whereClauses = [];
    let params = [];
    // Always filter by organization_id from header
    whereClauses.push("organization_id = ?");
    params.push(organization_id);
    if (department) {
      whereClauses.push("department_id = ?");
      params.push(department);
    }

    const whereSql = whereClauses.length
      ? `WHERE ${whereClauses.join(" AND ")}`
      : "";

    const query = `SELECT * FROM employees ${whereSql} ORDER BY id`;
    const [employees] = await pool.query(query, params);
    res.json({ employees });
  } catch (error) {
    next(error);
  }
});

// Create employee
router.post("/", async (req, res, next) => {
  const { employee_code, name, email, manager_id, department, location_id } =
    req.body;
  const organization_id = req.organizationId;

  try {
    if (!employee_code || !name || !email) {
      throw new ApiError("employee_code, name, and email are required", 400);
    }

    // Check if employee_code already exists in organization
    const [[existingEmployee]] = await pool.query(
      "SELECT id FROM employees WHERE organization_id = ? AND employee_code = ?",
      [organization_id, employee_code]
    );
    if (existingEmployee) {
      throw new ApiError(
        "Employee code already exists in this organization",
        409
      );
    }

    // Validate department if provided
    if (department) {
      const [[dept]] = await pool.query(
        "SELECT id FROM departments WHERE id = ? AND organization_id = ?",
        [department, organization_id]
      );
      if (!dept)
        throw new ApiError(
          "Department not found or doesn't belong to organization",
          404
        );
    }

    // Validate location if provided
    if (location_id) {
      const [[loc]] = await pool.query(
        "SELECT id FROM office_locations WHERE id = ? AND organization_id = ?",
        [location_id, organization_id]
      );
      if (!loc)
        throw new ApiError(
          "Location not found or doesn't belong to organization",
          404
        );
    }

    // Validate manager if provided
    if (manager_id) {
      const [[mgr]] = await pool.query(
        "SELECT id FROM employees WHERE id = ? AND organization_id = ?",
        [manager_id, organization_id]
      );
      if (!mgr)
        throw new ApiError(
          "Manager not found or doesn't belong to organization",
          404
        );
    }

    // Insert employee
    const [result] = await pool.query(
      "INSERT INTO employees (organization_id, employee_code, name, email, manager_id, department_id, location_id) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [
        organization_id,
        employee_code,
        name,
        email,
        manager_id || null,
        department || null,
        location_id || null,
      ]
    );

    // Fetch created employee
    const [[newEmployee]] = await pool.query(
      "SELECT * FROM employees WHERE id = ?",
      [result.insertId]
    );

    res.status(201).json(newEmployee);
  } catch (error) {
    next(error);
  }
});

router.get("/:id", async (req, res, next) => {
  const employeeId = req.params.id;
  const organization_id = req.organizationId;

  try {
    const query = `SELECT 
      e.*,
      hr.name as hr_manager_name,
      hr.employee_code as hr_manager_employee_code,
      hr.email as hr_manager_email
    FROM employees e
    LEFT JOIN employees hr ON e.hr_manager_id = hr.id
    WHERE e.id = ? AND e.organization_id = ?`;
    const [[employee]] = await pool.query(query, [employeeId, organization_id]);
    if (!employee) throw new ApiError("Employee not found", 404);

    res.json(employee);
  } catch (error) {
    next(error);
  }
});

router.patch("/:id", async (req, res, next) => {
  const employeeId = req.params.id;
  const organization_id = req.organizationId;
  const { name, email, manager_id, hr_manager_id, department, location_id } =
    req.body;

  try {
    // Step 1: Find if employee exists and get current values
    const [[employee]] = await pool.query(
      "SELECT id, department_id, hr_manager_id FROM employees WHERE id = ? AND organization_id = ?",
      [employeeId, organization_id]
    );

    if (!employee) throw new ApiError("Employee not found", 404);

    // Step 2: Prepare fields to update
    const updates = [];
    const params = [];

    if (name !== undefined) {
      updates.push("name = ?");
      params.push(name);
    }
    if (email !== undefined) {
      updates.push("email = ?");
      params.push(email);
    }
    if (manager_id !== undefined) {
      updates.push("manager_id = ?");
      params.push(manager_id);
    }

    // Handle department update first (needed for HR manager validation)
    let newDeptId = employee.department_id;
    if (department !== undefined) {
      newDeptId = await resolveDepartmentNumericId(department, organization_id);

      // Validate department exists
      const [[dept]] = await pool.query(
        "SELECT id FROM departments WHERE id = ? AND organization_id = ?",
        [newDeptId, organization_id]
      );
      if (!dept) {
        throw new ApiError("Department not found", 404);
      }

      updates.push("department_id = ?");
      params.push(newDeptId);
    }

    // Handle HR manager update with validation
    if (hr_manager_id !== undefined) {
      if (hr_manager_id === null) {
        updates.push("hr_manager_id = NULL");
      } else {
        // Validate HR manager exists
        const [[hrMgr]] = await pool.query(
          "SELECT id FROM employees WHERE id = ? AND organization_id = ?",
          [hr_manager_id, organization_id]
        );
        if (!hrMgr) {
          throw new ApiError("HR Manager not found", 404);
        }

        // Ensure employee has a department
        if (!newDeptId) {
          throw new ApiError(
            "Employee must have a department assigned before assigning HR manager",
            400
          );
        }

        // Validate HR manager belongs to employee's department
        const isValid = await validateHrManagerForDepartment(
          hr_manager_id,
          newDeptId,
          organization_id
        );

        if (!isValid) {
          throw new ApiError(
            "HR Manager must be assigned to the employee's department. Use /departments/:id/hr-managers to assign HR managers to departments.",
            400
          );
        }

        updates.push("hr_manager_id = ?");
        params.push(hr_manager_id);
      }
    }

    // If department changed, validate/update HR manager
    if (department !== undefined && employee.department_id !== newDeptId) {
      // If employee has an HR manager, check if it's still valid for new department
      if (employee.hr_manager_id && hr_manager_id === undefined) {
        const isValid = await validateHrManagerForDepartment(
          employee.hr_manager_id,
          newDeptId,
          organization_id
        );

        if (!isValid) {
          // Try to auto-assign if only one HR manager in new department
          const hrManagers = await getHrManagersForDepartment(
            newDeptId,
            organization_id
          );
          if (hrManagers.length === 1) {
            // Auto-assign if only one HR manager
            updates.push("hr_manager_id = ?");
            params.push(hrManagers[0].id);
          } else {
            // Clear if multiple or none
            updates.push("hr_manager_id = NULL");
          }
        }
      }
    }

    if (location_id !== undefined) {
      if (location_id === null) {
        updates.push("location_id = NULL");
      } else {
        // Validate location
        const [[loc]] = await pool.query(
          "SELECT id FROM office_locations WHERE id = ? AND organization_id = ?",
          [location_id, organization_id]
        );
        if (!loc) {
          throw new ApiError("Location not found", 404);
        }
        updates.push("location_id = ?");
        params.push(location_id);
      }
    }

    if (updates.length > 0) {
      // Update only supplied fields
      const updateQuery = `UPDATE employees SET ${updates.join(
        ", "
      )} WHERE id = ? AND organization_id = ?`;
      params.push(employeeId, organization_id);
      await pool.query(updateQuery, params);
    }

    // Step 3: Return updated employee with HR manager info
    const [[updatedEmployee]] = await pool.query(
      `SELECT 
        e.*,
        hr.name as hr_manager_name,
        hr.employee_code as hr_manager_employee_code,
        hr.email as hr_manager_email
      FROM employees e
      LEFT JOIN employees hr ON e.hr_manager_id = hr.id
      WHERE e.id = ? AND e.organization_id = ?`,
      [employeeId, organization_id]
    );

    res.json(updatedEmployee);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /employees/:id/available-hr-managers
 * Get available HR managers for an employee's department
 */
router.get("/:id/available-hr-managers", async (req, res, next) => {
  const employeeId = req.params.id;
  const organization_id = req.organizationId;

  try {
    // Get employee's department
    const [[employee]] = await pool.query(
      "SELECT department_id FROM employees WHERE id = ? AND organization_id = ?",
      [employeeId, organization_id]
    );

    if (!employee) {
      throw new ApiError("Employee not found", 404);
    }

    if (!employee.department_id) {
      throw new ApiError("Employee must have a department assigned", 400);
    }

    // Get HR managers for the department
    const hrManagers = await getHrManagersForDepartment(
      employee.department_id,
      organization_id
    );

    res.json({ hr_managers: hrManagers });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /employees/:id
 * Delete an employee by ID
 */
router.delete("/:id", async (req, res, next) => {
  const employeeIdParam = req.params.id;
  const organization_id = req.organizationId;

  try {
    // Resolve employee ID (supports both numeric ID and employee_code)
    const employeeNumericId = await resolveEmployeeNumericId(
      employeeIdParam,
      organization_id
    );

    // Check if employee exists and belongs to organization
    const [[employee]] = await pool.query(
      "SELECT id FROM employees WHERE id = ? AND organization_id = ?",
      [employeeNumericId, organization_id]
    );

    if (!employee) {
      throw new ApiError("Employee not found or access denied", 404);
    }

    // SECURITY: Include organization_id in DELETE to prevent cross-organization deletion
    const [result] = await pool.query(
      "DELETE FROM employees WHERE id = ? AND organization_id = ?",
      [employeeNumericId, organization_id]
    );

    if (result.affectedRows === 0) {
      throw new ApiError("Employee not found or access denied", 404);
    }
    
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

module.exports = router;
