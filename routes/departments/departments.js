// routes/departments.js
const express = require("express");
const router = express.Router();
const pool = require("../../db");
const ApiError = require("../../util/ApiError");

// Get all departments
router.get("/", async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT 
        d.deptid, 
        d.short_name,
        d.name, 
        e.name as department_head_name,
        e.empid as department_head_empid
      FROM departments d
      LEFT JOIN employees e ON d.department_head_empid = e.empid
      ORDER BY d.name`
    );

    res.json({ departments: rows });
  } catch (error) {
    next(error);
  }
});

router.get("/:deptid", async (req, res, next) => {
  const deptid = req.params.deptid;
  if (!deptid) {
    throw new ApiError("Department ID is required", 400);
  }
  try {
    const [[department]] = await pool.query(
      `SELECT 
          d.deptid, 
          d.name,
          d.short_name,
          d.department_head_empid,
          e.name as department_head_name,
          e.empid as department_head_empid,
          d.created_at, 
          d.updated_at 
        FROM departments d
        LEFT JOIN employees e ON d.department_head_empid = e.empid
        WHERE d.deptid = ?`,
      [deptid]
    );

    if (!department) {
      throw new ApiError("Department not found", 404);
    }

    res.json(department);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /departments
 * Create a new department
 */
router.post("/", async (req, res, next) => {
  const { deptid, name, short_name, department_head_empid } = req.body;

  try {
    if (!deptid || !name) {
      throw new ApiError("deptid and name are required", 400);
    }

    // Validate deptid length (VARCHAR(10))
    if (deptid.length > 10) {
      throw new ApiError("deptid must be 10 characters or less", 400);
    }

    // Check if deptid already exists
    const [[existing]] = await pool.query(
      "SELECT deptid FROM departments WHERE deptid = ?",
      [deptid.toUpperCase()]
    );

    if (existing) {
      throw new ApiError("Department ID already exists", 409);
    }

    // Check if name already exists (unique constraint)
    const [[existingName]] = await pool.query(
      "SELECT deptid FROM departments WHERE name = ?",
      [name]
    );

    if (existingName) {
      throw new ApiError(
        `Department with name '${name}' already exists`,
        409
      );
    }

    // Validate department_head_id if provided
    if (department_head_empid) {
      const [[employee]] = await pool.query(
        "SELECT empid FROM employees WHERE empid = ?",
        [department_head_empid]
      );
      if (!employee) {
        throw new ApiError("Department head employee not found", 404);
      }
    }

    // Insert department
    await pool.query(
      "INSERT INTO departments (deptid, name, short_name, department_head_empid) VALUES (?, ?, ?, ?)",
      [deptid.toUpperCase(), name, short_name || null, department_head_empid || null]
    );

    // Fetch created department
    const [[department]] = await pool.query(
      `SELECT 
        d.deptid, 
        d.name,
        d.short_name,
        d.department_head_empid,
        e.name as department_head_name,
        e.empid as department_head_empid
      FROM departments d
      LEFT JOIN employees e ON d.department_head_empid = e.empid
      WHERE d.deptid = ?`,
      [deptid.toUpperCase()]
    );

    res.status(201).json({
      message: "Department created successfully",
      department,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /departments/:deptid
 * Update a department
 */
router.patch("/:deptid", async (req, res, next) => {
  const deptid = req.params.deptid;
  const { name, short_name, department_head_empid } = req.body;

  try {
    // Check if department exists
    const [[dept]] = await pool.query(
      "SELECT deptid FROM departments WHERE deptid = ?",
      [deptid.toUpperCase()]
    );
    if (!dept) {
      throw new ApiError("Department not found", 404);
    }

    // Build update query
    const updates = [];
    const params = [];

    if (name !== undefined) {
      // Check if new name conflicts with existing name
      const [[nameConflict]] = await pool.query(
        "SELECT deptid FROM departments WHERE name = ? AND deptid != ?",
        [name, deptid.toUpperCase()]
      );

      if (nameConflict) {
        throw new ApiError(
          `Department with name '${name}' already exists`,
          409
        );
      }

      updates.push("name = ?");
      params.push(name);
    }

    if (short_name !== undefined) {
      updates.push("short_name = ?");
      params.push(short_name || null);
    }

    // Handle department_head_id update
    if (department_head_empid !== undefined) {
      if (department_head_empid === null) {
        // Clear department head
        updates.push("department_head_empid = NULL");
      } else {
        // Validate employee exists
        const [[employee]] = await pool.query(
          "SELECT empid FROM employees WHERE empid = ?",
          [department_head_empid]
        );
        if (!employee) {
          throw new ApiError("Employee not found", 404);
        }

        updates.push("department_head_empid = ?");
        params.push(department_head_empid);
      }
    }

    if (updates.length === 0) {
      throw new ApiError("No fields to update", 400);
    }

    params.push(deptid.toUpperCase());
    await pool.query(
      `UPDATE departments SET ${updates.join(", ")} WHERE deptid = ?`,
      params
    );

    // Fetch updated department
    const [[department]] = await pool.query(
      `SELECT 
        d.deptid, 
        d.name,
        d.short_name,
        d.department_head_empid,
        e.name as department_head_name,
        e.empid as department_head_empid,
        d.created_at, 
        d.updated_at 
      FROM departments d
      LEFT JOIN employees e ON d.department_head_empid = e.empid
      WHERE d.deptid = ?`,
      [deptid.toUpperCase()]
    );

    res.json({
      message: "Department updated successfully",
      department,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /departments/:deptid
 * Delete a department
 * Note: Check if department is in use before deleting
 */
router.delete("/:deptid", async (req, res, next) => {
  const deptid = req.params.deptid;

  try {
    // Check if department exists
    const [[dept]] = await pool.query(
      "SELECT deptid FROM departments WHERE deptid = ?",
      [deptid.toUpperCase()]
    );
    if (!dept) {
      throw new ApiError("Department not found", 404);
    }

    // Check if department is assigned to any employees
    const [[inUse]] = await pool.query(
    "SELECT COUNT(*) as count FROM employees WHERE department_id = ?",
      [deptid.toUpperCase()]
    );

    if (inUse.count > 0) {
      throw new ApiError(
        `Cannot delete department. It is assigned to ${inUse.count} employee(s). Please reassign employees first.`,
        400
      );
    }

    // Delete department
    const [result] = await pool.query(
      "DELETE FROM departments WHERE deptid = ?",
      [deptid.toUpperCase()]
    );

    if (result.affectedRows === 0) {
      throw new ApiError("Failed to delete department", 500);
    }

    res.json({ message: "Department deleted successfully" });
  } catch (error) {
    next(error);
  }
});

module.exports = router;

