// routes/departments.js
const express = require("express");
const router = express.Router();
const pool = require("../../db");
const ApiError = require("../../util/ApiError");
const { resolveEmployeeNumericId } = require("../../util/employeeUtil");

// Get all departments for the organization
router.get("/", async (req, res, next) => {
  const organization_id = req.organizationId;

  try {
    const [rows] = await pool.query(
      `SELECT 
        d.id, 
        d.department_code, 
        d.name, 
        d.department_head,
        e.name as department_head_name,
        e.employee_code as department_head_employee_code,
        d.created_at, 
        d.updated_at 
      FROM departments d
      LEFT JOIN employees e ON d.department_head = e.id
      WHERE d.organization_id = ? 
      ORDER BY d.name`,
      [organization_id]
    );

    res.json({ departments: rows });
  } catch (error) {
    next(error);
  }
});

// Get department by ID or department_code
router.get("/:identifier", async (req, res, next) => {
  const identifier = req.params.identifier;
  const organization_id = req.organizationId;

  try {
    let department = null;

    // Check if identifier is numeric (id) or VARCHAR (department_code)
    if (/^\d+$/.test(identifier)) {
      // It's numeric, query by id
      const [[dept]] = await pool.query(
        `SELECT 
          d.id, 
          d.department_code, 
          d.name, 
          d.department_head,
          e.name as department_head_name,
          e.employee_code as department_head_employee_code,
          d.created_at, 
          d.updated_at 
        FROM departments d
        LEFT JOIN employees e ON d.department_head = e.id
        WHERE d.id = ? AND d.organization_id = ?`,
        [identifier, organization_id]
      );
      department = dept;
    } else {
      // It's VARCHAR department_code, query by code
      const [[dept]] = await pool.query(
        `SELECT 
          d.id, 
          d.department_code, 
          d.name, 
          d.department_head,
          e.name as department_head_name,
          e.employee_code as department_head_employee_code,
          d.created_at, 
          d.updated_at 
        FROM departments d
        LEFT JOIN employees e ON d.department_head = e.id
        WHERE d.department_code = ? AND d.organization_id = ?`,
        [identifier, organization_id]
      );
      department = dept;
    }

    if (!department) {
      throw new ApiError("Department not found", 404);
    }

    res.json(department);
  } catch (error) {
    next(error);
  }
});

// Create department
router.post("/", async (req, res, next) => {
  const { department_code, name } = req.body;
  const organization_id = req.organizationId;

  try {
    if (!department_code || !name) {
      throw new ApiError("department_code and name are required", 400);
    }

    // Check if department_code already exists in organization
    const [[existing]] = await pool.query(
      "SELECT id FROM departments WHERE organization_id = ? AND department_code = ?",
      [organization_id, department_code]
    );

    if (existing) {
      throw new ApiError(
        "Department code already exists in this organization",
        409
      );
    }

    // Insert department (id is auto-generated)
    const [result] = await pool.query(
      "INSERT INTO departments (organization_id, department_code, name) VALUES (?, ?, ?)",
      [organization_id, department_code, name]
    );

    // Fetch created department
    const [[department]] = await pool.query(
      `SELECT 
        d.id, 
        d.department_code, 
        d.name, 
        d.department_head,
        e.name as department_head_name,
        e.employee_code as department_head_employee_code,
        d.created_at, 
        d.updated_at 
      FROM departments d
      LEFT JOIN employees e ON d.department_head = e.id
      WHERE d.id = ?`,
      [result.insertId]
    );

    res.status(201).json(department);
  } catch (error) {
    next(error);
  }
});

// Update department by ID
router.patch("/:id", async (req, res, next) => {
  const departmentId = req.params.id;
  const { department_code, name, department_head } = req.body;
  const organization_id = req.organizationId;

  try {
    // Validate department ID is numeric
    const id = parseInt(departmentId, 10);
    if (isNaN(id) || id <= 0) {
      throw new ApiError("Invalid department ID", 400);
    }

    // Check if department exists
    const [[dept]] = await pool.query(
      "SELECT id FROM departments WHERE id = ? AND organization_id = ?",
      [id, organization_id]
    );
    if (!dept) {
      throw new ApiError("Department not found", 404);
    }

    // Check if new department_code conflicts with existing one
    if (department_code) {
      const [[existing]] = await pool.query(
        "SELECT id FROM departments WHERE organization_id = ? AND department_code = ? AND id != ?",
        [organization_id, department_code, id]
      );
      if (existing) {
        throw new ApiError(
          "Department code already exists in this organization",
          409
        );
      }
    }

    // Build update query
    const updates = [];
    const params = [];

    if (department_code !== undefined) {
      updates.push("department_code = ?");
      params.push(department_code);
    }
    if (name !== undefined) {
      updates.push("name = ?");
      params.push(name);
    }

    // Handle department_head update
    if (department_head !== undefined) {
      if (department_head === null || department_head === "") {
        // Clear department head
        updates.push("department_head = NULL");
      } else {
        // Resolve employee ID (supports both numeric ID and employee_code)
        const headEmployeeId = await resolveEmployeeNumericId(
          department_head,
          organization_id
        );

        // Validate employee exists and belongs to organization
        const [[employee]] = await pool.query(
          "SELECT id, department_id FROM employees WHERE id = ? AND organization_id = ?",
          [headEmployeeId, organization_id]
        );
        if (!employee) {
          throw new ApiError(
            "Employee not found or doesn't belong to organization",
            404
          );
        }

        // Optional: Validate employee belongs to this department
        // Uncomment if you want to enforce that department head must be in the department
        // if (employee.department_id !== id) {
        //   throw new ApiError(
        //     "Department head must be an employee of this department",
        //     400
        //   );
        // }

        updates.push("department_head = ?");
        params.push(headEmployeeId);
      }
    }

    if (updates.length > 0) {
      params.push(id, organization_id);
      await pool.query(
        `UPDATE departments SET ${updates.join(", ")} WHERE id = ? AND organization_id = ?`,
        params
      );
    }

    // Fetch updated department
    const [[department]] = await pool.query(
      `SELECT 
        d.id, 
        d.department_code, 
        d.name, 
        d.department_head,
        e.name as department_head_name,
        e.employee_code as department_head_employee_code,
        d.created_at, 
        d.updated_at 
      FROM departments d
      LEFT JOIN employees e ON d.department_head = e.id
      WHERE d.id = ? AND d.organization_id = ?`,
      [id, organization_id]
    );

    res.json(department);
  } catch (error) {
    next(error);
  }
});

// Delete department by ID
router.delete("/:id", async (req, res, next) => {
  const departmentId = req.params.id;
  const organization_id = req.organizationId;

  try {
    // Validate department ID is numeric
    const id = parseInt(departmentId, 10);
    if (isNaN(id) || id <= 0) {
      throw new ApiError("Invalid department ID", 400);
    }

    // Check if department exists and belongs to organization
    const [[dept]] = await pool.query(
      "SELECT id FROM departments WHERE id = ? AND organization_id = ?",
      [id, organization_id]
    );
    if (!dept) {
      throw new ApiError("Department not found or access denied", 404);
    }

    // SECURITY: Include organization_id in DELETE to prevent cross-organization deletion
    const [result] = await pool.query(
      "DELETE FROM departments WHERE id = ? AND organization_id = ?",
      [id, organization_id]
    );

    if (result.affectedRows === 0) {
      throw new ApiError("Department not found or access denied", 404);
    }

    res.json({ deleted: true });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
