// routes/departments/hrManagers.js
const express = require("express");
const router = express.Router();
const pool = require("../../db");
const ApiError = require("../../util/ApiError");

/**
 * GET /departments/:deptid/hr-managers
 * Get all HR managers for a department
 * Query params: is_active, effective_date (to filter by active status and date)
 */
router.get("/:deptid/hr-managers", async (req, res, next) => {
  const { deptid } = req.params;
  const { is_active, effective_date } = req.query;

  try {
    // Validate department exists
    const [[department]] = await pool.query(
      "SELECT deptid FROM departments WHERE deptid = ?",
      [deptid.toUpperCase()]
    );

    if (!department) {
      throw new ApiError("Department not found", 404);
    }

    // Build query
    let whereClauses = ["dhm.department_id = ?"];
    let params = [deptid.toUpperCase()];

    if (is_active !== undefined) {
      const activeValue =
        is_active === "true" || is_active === "1" || is_active === "Y"
          ? "Y"
          : "N";
      whereClauses.push("dhm.is_active = ?");
      params.push(activeValue);
    }

    if (effective_date) {
      whereClauses.push(
        "(dhm.effective_from <= ? AND (dhm.effective_to IS NULL OR dhm.effective_to >= ?))"
      );
      params.push(effective_date, effective_date);
    }

    // Fetch HR managers for the department
    const [hrManagers] = await pool.query(
      `SELECT 
        dhm.id,
        dhm.department_id,
        dhm.hr_manager_empid,
        dhm.effective_from,
        dhm.effective_to,
        dhm.is_active,
        dhm.assigned_by,
        dhm.remarks,
        dhm.created_at,
        dhm.updated_at,
        e.empid,
        e.name as hr_manager_name,
        e.email as hr_manager_email,
        assigner.name as assigned_by_name,
        assigner.empid as assigned_by_empid
      FROM department_hr_managers dhm
      INNER JOIN employees e ON dhm.hr_manager_empid = e.empid
      LEFT JOIN employees assigner ON dhm.assigned_by = assigner.empid
      WHERE ${whereClauses.join(" AND ")}
      ORDER BY dhm.effective_from DESC, e.name`,
      params
    );

    res.json({ hr_managers: hrManagers });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /departments/:deptid/hr-managers
 * Add an HR manager to a department
 */
router.post("/:deptid/hr-managers", async (req, res, next) => {
  const { deptid } = req.params;
  const {
    hr_manager_empid,
    effective_from,
    effective_to,
    is_active = "Y",
    assigned_by,
    remarks,
  } = req.body;

  try {
    if (!hr_manager_empid) {
      throw new ApiError("hr_manager_empid is required", 400);
    }

    if (!effective_from) {
      throw new ApiError("effective_from is required", 400);
    }

    // Validate is_active value
    if (!["Y", "N"].includes(is_active.toUpperCase())) {
      throw new ApiError("is_active must be 'Y' or 'N'", 400);
    }

    // Validate department exists
    const [[department]] = await pool.query(
      "SELECT deptid FROM departments WHERE deptid = ?",
      [deptid.toUpperCase()]
    );

    if (!department) {
      throw new ApiError("Department not found", 404);
    }

    // Validate HR manager exists
    const [[hrManager]] = await pool.query(
      "SELECT empid FROM employees WHERE empid = ?",
      [hr_manager_empid]
    );

    if (!hrManager) {
      throw new ApiError("HR Manager not found", 404);
    }

    // Validate assigned_by if provided
    if (assigned_by) {
      const [[assigner]] = await pool.query(
        "SELECT empid FROM employees WHERE empid = ?",
        [assigned_by]
      );
      if (!assigner) {
        throw new ApiError("Assigned by employee not found", 404);
      }
    }

    // Validate date range
    if (effective_to && effective_to < effective_from) {
      throw new ApiError("effective_to must be after effective_from", 400);
    }

    // Check if HR manager is already assigned to this department with overlapping dates
    const [[existing]] = await pool.query(
      `SELECT id FROM department_hr_managers 
       WHERE department_id = ? 
       AND hr_manager_empid = ? 
       AND is_active = 'Y'
       AND (
         (effective_from <= ? AND (effective_to IS NULL OR effective_to >= ?))
         OR (effective_to IS NULL AND effective_from <= ?)
       )`,
      [
        deptid.toUpperCase(),
        hr_manager_empid,
        effective_from,
        effective_from,
        effective_from,
      ]
    );

    if (existing) {
      throw new ApiError(
        "HR Manager is already assigned to this department with overlapping effective dates",
        409
      );
    }

    // Insert HR manager assignment
    const [result] = await pool.query(
      `INSERT INTO department_hr_managers 
       (department_id, hr_manager_empid, effective_from, effective_to, is_active, assigned_by, remarks) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        deptid.toUpperCase(),
        hr_manager_empid,
        effective_from,
        effective_to || null,
        is_active.toUpperCase(),
        assigned_by || null,
        remarks || null,
      ]
    );

    // Fetch created assignment with employee details
    const [[assignment]] = await pool.query(
      `SELECT 
        dhm.id,
        dhm.department_id,
        dhm.hr_manager_empid,
        dhm.effective_from,
        dhm.effective_to,
        dhm.is_active,
        dhm.assigned_by,
        dhm.remarks,
        dhm.created_at,
        dhm.updated_at,
        e.empid,
        e.name as hr_manager_name,
        e.email as hr_manager_email,
        assigner.name as assigned_by_name,
        assigner.empid as assigned_by_empid
      FROM department_hr_managers dhm
      INNER JOIN employees e ON dhm.hr_manager_empid = e.empid
      LEFT JOIN employees assigner ON dhm.assigned_by = assigner.empid
      WHERE dhm.id = ?`,
      [result.insertId]
    );

    res.status(201).json({
      message: "HR Manager assigned to department successfully",
      assignment,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /departments/:deptid/hr-managers/:id
 * Update an HR manager assignment
 */
router.patch("/:deptid/hr-managers/:id", async (req, res, next) => {
  const { deptid, id } = req.params;
  const { effective_from, effective_to, is_active, remarks } = req.body;

  try {
    // Check if assignment exists
    const [[existing]] = await pool.query(
      "SELECT id FROM department_hr_managers WHERE id = ? AND department_id = ?",
      [id, deptid.toUpperCase()]
    );

    if (!existing) {
      throw new ApiError("HR Manager assignment not found", 404);
    }

    // Build update query
    const updates = [];
    const params = [];

    if (effective_from !== undefined) {
      updates.push("effective_from = ?");
      params.push(effective_from);
    }

    if (effective_to !== undefined) {
      updates.push("effective_to = ?");
      params.push(effective_to || null);
    }

    if (is_active !== undefined) {
      if (!["Y", "N"].includes(is_active.toUpperCase())) {
        throw new ApiError("is_active must be 'Y' or 'N'", 400);
      }
      updates.push("is_active = ?");
      params.push(is_active.toUpperCase());
    }

    if (remarks !== undefined) {
      updates.push("remarks = ?");
      params.push(remarks || null);
    }

    if (updates.length === 0) {
      throw new ApiError("No fields to update", 400);
    }

    // Validate date range if both dates are being updated
    if (effective_from !== undefined && effective_to !== undefined) {
      const finalFrom = effective_from;
      const finalTo = effective_to || null;
      if (finalTo && finalTo < finalFrom) {
        throw new ApiError("effective_to must be after effective_from", 400);
      }
    }

    params.push(id, deptid.toUpperCase());

    const [result] = await pool.query(
      `UPDATE department_hr_managers SET ${updates.join(
        ", "
      )} WHERE id = ? AND department_id = ?`,
      params
    );

    if (result.affectedRows === 0) {
      throw new ApiError("Failed to update assignment", 500);
    }

    // Fetch updated assignment
    const [[assignment]] = await pool.query(
      `SELECT 
        dhm.id,
        dhm.department_id,
        dhm.hr_manager_empid,
        dhm.effective_from,
        dhm.effective_to,
        dhm.is_active,
        dhm.assigned_by,
        dhm.remarks,
        dhm.created_at,
        dhm.updated_at,
        e.empid,
        e.name as hr_manager_name,
        e.email as hr_manager_email
      FROM department_hr_managers dhm
      INNER JOIN employees e ON dhm.hr_manager_empid = e.empid
      WHERE dhm.id = ?`,
      [id]
    );

    res.json({
      message: "HR Manager assignment updated successfully",
      assignment,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /departments/:deptid/hr-managers/:id
 * Remove an HR manager from a department (soft delete by setting is_active = 'N')
 */
router.delete("/:deptid/hr-managers/:id", async (req, res, next) => {
  const { deptid, id } = req.params;

  try {
    // Check if assignment exists
    const [[existing]] = await pool.query(
      "SELECT id FROM department_hr_managers WHERE id = ? AND department_id = ?",
      [id, deptid.toUpperCase()]
    );

    if (!existing) {
      throw new ApiError("HR Manager assignment not found", 404);
    }

    // Soft delete by setting is_active = 'N' and effective_to = today
    const [result] = await pool.query(
      `UPDATE department_hr_managers 
       SET is_active = 'N', effective_to = CURDATE() 
       WHERE id = ? AND department_id = ?`,
      [id, deptid.toUpperCase()]
    );

    if (result.affectedRows === 0) {
      throw new ApiError("Failed to remove assignment", 500);
    }

    res.json({ message: "HR Manager assignment removed successfully" });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
