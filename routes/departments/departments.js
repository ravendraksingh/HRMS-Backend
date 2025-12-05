// routes/departments.js
const express = require("express");
const router = express.Router();
const pool = require("../../db");
const ApiError = require("../../errors/ApiError");
const {
  createDepartmentSchema,
  updateDepartmentSchema,
  deptidParamSchema,
} = require("../../validations/departmentSchemas");
const { handleValidationErrors } = require("../../util/validation");
const {
  SELECT_ALL_DEPARTMENTS,
  SELECT_DEPARTMENT_BY_DEPTID,
  SELECT_DEPARTMENT_EXISTS,
  SELECT_DEPARTMENT_BY_NAME,
  SELECT_DEPARTMENT_NAME_CONFLICT,
} = require("../../queries/departments");
const { SELECT_EMPLOYEE_EXISTS } = require("../../queries/employees");
const { requireHRManagerOrAdmin } = require("../../middlewares/rbac");
const {
  withCache,
  invalidateDepartmentCache,
  CACHE_PREFIXES,
} = require("../../util/cacheUtil");
const { cacheHeaders } = require("../../middlewares/cacheHeaders");

// Get all departments
router.get("/", cacheHeaders.longCache, async (req, res, next) => {
  try {
    const cacheKey = `${CACHE_PREFIXES.DEPARTMENT}:all`;

    const departments = await withCache(
      async () => {
        const [rows] = await pool.query(SELECT_ALL_DEPARTMENTS);
        return rows;
      },
      cacheKey,
      3600 // 1 hour TTL
    );

    res.json({ departments });
  } catch (error) {
    next(error);
  }
});

router.get(
  "/:deptid",
  cacheHeaders.longCache,
  deptidParamSchema,
  handleValidationErrors,
  async (req, res, next) => {
    const deptid = req.params.deptid;
    if (!deptid) {
      throw new ApiError("Department ID is required", 400);
    }
    try {
      const cacheKey = `${CACHE_PREFIXES.DEPARTMENT}:${deptid.toUpperCase()}`;

      const department = await withCache(
        async () => {
          const [rows] = await pool.query(SELECT_DEPARTMENT_BY_DEPTID, [deptid]);

          if (rows.length === 0) {
            throw new ApiError("Department not found", 404);
          }

          return rows[0];
        },
        cacheKey,
        3600 // 1 hour TTL
      );

      res.json(department);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /departments
 * Create a new department
 * Requires HRMANAGER or ADMIN role
 */
router.post(
  "/",
  createDepartmentSchema,
  handleValidationErrors,
  requireHRManagerOrAdmin,
  async (req, res, next) => {
    const { deptid, name, short_name, department_head_empid } = req.body;

    try {
      // Check if deptid already exists
      const [[existing]] = await pool.query(SELECT_DEPARTMENT_EXISTS, [
        deptid.toUpperCase(),
      ]);

      if (existing) {
        throw new ApiError("Department ID already exists", 409);
      }

      // Check if name already exists (unique constraint)
      const [[existingName]] = await pool.query(SELECT_DEPARTMENT_BY_NAME, [
        name,
      ]);

      if (existingName) {
        throw new ApiError(
          `Department with name '${name}' already exists`,
          409
        );
      }

      // Validate department_head_empid if provided
      if (department_head_empid) {
        const [[employee]] = await pool.query(SELECT_EMPLOYEE_EXISTS, [
          department_head_empid,
        ]);
        if (!employee) {
          throw new ApiError("Department head employee not found", 404);
        }
      }

      // Insert department
      await pool.query(
        "INSERT INTO departments (deptid, name, short_name, department_head_empid) VALUES (?, ?, ?, ?)",
        [
          deptid.toUpperCase(),
          name,
          short_name || null,
          department_head_empid || null,
        ]
      );

      // Invalidate department cache
      await invalidateDepartmentCache();

      // Fetch created department
      const [rows] = await pool.query(SELECT_DEPARTMENT_BY_DEPTID, [
        deptid.toUpperCase(),
      ]);

      res.status(201).json(rows[0]);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PATCH /departments/:deptid
 * Update a department
 * Requires HRMANAGER or ADMIN role
 */
router.patch(
  "/:deptid",
  updateDepartmentSchema,
  handleValidationErrors,
  requireHRManagerOrAdmin,
  async (req, res, next) => {
    const deptid = req.params.deptid.toUpperCase();
    const { name, short_name, department_head_empid } = req.body;

    try {
      // Check if department exists
      const [[dept]] = await pool.query(SELECT_DEPARTMENT_EXISTS, [deptid]);
      if (!dept) {
        throw new ApiError("Department not found", 404);
      }

      // Build update query
      const updates = [];
      const params = [];

      if (name !== undefined) {
        // Check if new name conflicts with existing name
        const [[nameConflict]] = await pool.query(
          SELECT_DEPARTMENT_NAME_CONFLICT,
          [name, deptid]
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
          const [[employee]] = await pool.query(SELECT_EMPLOYEE_EXISTS, [
            department_head_empid,
          ]);
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

      params.push(deptid);
      await pool.query(
        `UPDATE departments SET ${updates.join(", ")} WHERE deptid = ?`,
        params
      );

      // Invalidate department cache
      await invalidateDepartmentCache(deptid);

      // Fetch updated department
      const [rows] = await pool.query(SELECT_DEPARTMENT_BY_DEPTID, [deptid]);

      res.json(rows[0]);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /departments/:deptid
 * Delete a department
 * Note: Check if department is in use before deleting
 * Requires HRMANAGER or ADMIN role
 */
router.delete("/:deptid", requireHRManagerOrAdmin, async (req, res, next) => {
  const deptid = req.params.deptid;

  try {
    // Check if department exists
    const [[dept]] = await pool.query(SELECT_DEPARTMENT_EXISTS, [deptid]);
    if (!dept) {
      throw new ApiError("Department not found", 404);
    }

    // Check if department is assigned to any employees
    const [[inUse]] = await pool.query(
      "SELECT COUNT(*) as count FROM employees WHERE department_id = ?",
      [deptid]
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
      [deptid]
    );

    if (result.affectedRows === 0) {
      throw new ApiError("Failed to delete department", 500);
    }

    // Invalidate department cache
    await invalidateDepartmentCache(deptid);

    res.json({ message: "Department deleted successfully" });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
