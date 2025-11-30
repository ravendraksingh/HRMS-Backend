// routes/leaves/leaveTypes.js
// Leave Types Management APIs (HR Managers and Admins only)
const express = require("express");
const router = express.Router();
const pool = require("../../db");
const ApiError = require("../../errors/ApiError");
const LeaveType = require("../../models/LeaveType");

/**
 * POST /leave-types
 * Create a new leave type
 * Body: leavetype_id, name, description, max_leaves_per_year, carry_forward, etc.
 * Requires: HR Manager or Admin role
 */
router.post("/", async (req, res, next) => {
  const {
    leavetype_id,
    name,
    description,
    max_leaves_per_year,
    carry_forward = "N",
    max_carry_forward = 0,
    requires_approval = "Y",
    requires_medical_certificate = "N",
    is_active = "Y",
  } = req.body;

  try {
    // Check if leavetype_id already exists
    const [[existing]] = await pool.query(
      "SELECT leavetype_id FROM leave_types WHERE leavetype_id = ?",
      [leavetype_id.toUpperCase()]
    );

    if (existing) {
      throw new ApiError(
        `Leave type with id '${leavetype_id}' already exists`,
        400
      );
    }

    // Check if name already exists (unique constraint)
    const [[existingName]] = await pool.query(
      "SELECT leavetype_id FROM leave_types WHERE name = ?",
      [name]
    );

    if (existingName) {
      throw new ApiError(`Leave type with name '${name}' already exists`, 400);
    }

    // Insert leave type
    await pool.query(
      `INSERT INTO leave_types (
        leavetype_id, name, description, max_leaves_per_year, 
        carry_forward, max_carry_forward, requires_approval, 
        requires_medical_certificate, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        leavetype_id,
        name,
        description || null,
        max_leaves_per_year || null,
        carry_forward,
        max_carry_forward || 0,
        requires_approval,
        requires_medical_certificate,
        is_active,
      ]
    );

    // Fetch created leave type
    const [[leaveTypeRow]] = await pool.query(
      `SELECT 
        leavetype_id,
        name,
        description,
        max_leaves_per_year,
        carry_forward,
        max_carry_forward,
        requires_approval,
        requires_medical_certificate,
        is_active
      FROM leave_types WHERE leavetype_id = ?`,
      [leavetype_id]
    );

    // Convert database row to LeaveType class instance
    const leaveType = LeaveType.fromDatabaseRow(leaveTypeRow);

    res.status(201).json({
      message: "Leave type created successfully",
      leave_type: leaveType.toJSON(),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /leave-types
 * Get all leave types
 * Query params: is_active
 */
router.get("/", async (req, res, next) => {
  const { is_active } = req.query;

  try {
    let whereClauses = [];
    let params = [];

    if (is_active !== undefined) {
      const activeValue =
        is_active === "true" || is_active === "1" || is_active === "Y"
          ? "Y"
          : "N";
      whereClauses.push("lt.is_active = ?");
      params.push(activeValue);
    }

    const whereSql =
      whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

    const [leaveTypesRows] = await pool.query(
      `SELECT 
        lt.leavetype_id,
        lt.name,
        lt.description,
        lt.max_leaves_per_year,
        lt.carry_forward,
        lt.max_carry_forward,
        lt.requires_approval,
        lt.requires_medical_certificate,
        lt.is_active
      FROM leave_types lt ${whereSql} ORDER BY lt.name`,
      params
    );

    // Convert database rows to LeaveType class instances
    const leaveTypes = LeaveType.fromDatabaseRows(leaveTypesRows);

    res.json({
      count: leaveTypes.length,
      leave_types: leaveTypes.map((lt) => lt.toJSON()),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /leave-types/available
 * Get available (active) leave types
 * Since scope/region/gender filtering is removed, this just returns active leave types
 */
router.get("/available", async (req, res, next) => {
  try {
    const [leaveTypesRows] = await pool.query(
      `SELECT 
        leavetype_id,
        name,
        description,
        max_leaves_per_year,
        carry_forward,
        max_carry_forward,
        requires_approval,
        requires_medical_certificate,
        is_active
      FROM leave_types WHERE is_active = 'Y' ORDER BY name`
    );

    // Convert database rows to LeaveType class instances
    const leaveTypes = LeaveType.fromDatabaseRows(leaveTypesRows);

    res.json({
      count: leaveTypes.length,
      available_leave_types: leaveTypes.map((lt) => lt.toJSON()),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /leave-types/:id
 * Get a specific leave type by leavetype_id
 */
router.get(
  "/:id",
  async (req, res, next) => {
    try {
      const [[leaveTypeRow]] = await pool.query(
        `SELECT 
        leavetype_id,
        name,
        description,
        max_leaves_per_year,
        carry_forward,
        max_carry_forward,
        requires_approval,
        requires_medical_certificate,
        is_active
      FROM leave_types WHERE leavetype_id = ?`,
        [req.params.id]
      );

      if (!leaveTypeRow) {
        throw new ApiError("Leave type not found", 404);
      }

      // Convert database row to LeaveType class instance
      const leaveType = LeaveType.fromDatabaseRow(leaveTypeRow);
      res.json({ leave_type: leaveType.toJSON() });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PATCH /leave-types/:id
 * Update a leave type by leavetype_id
 * Requires: HR Manager or Admin role
 */
router.patch("/:id", async (req, res, next) => {
  const {
    name,
    description,
    max_leaves_per_year,
    carry_forward,
    max_carry_forward,
    requires_approval,
    requires_medical_certificate,
    is_active,
  } = req.body;

  try {
    // Check if leave type exists
    const [[existing]] = await pool.query(
      "SELECT leavetype_id FROM leave_types WHERE leavetype_id = ?",
      [req.params.id]
    );

    if (!existing) {
      throw new ApiError("Leave type not found", 404);
    }

    // Build update query
    const updates = [];
    const params = [];

    if (name !== undefined) {
      // Check if new name conflicts with existing name
      const [[nameConflict]] = await pool.query(
        "SELECT leavetype_id FROM leave_types WHERE name = ? AND leavetype_id != ?",
        [name, req.params.id]
      );

      if (nameConflict) {
        throw new ApiError(
          `Leave type with name '${name}' already exists`,
          400
        );
      }

      updates.push("name = ?");
      params.push(name);
    }

    if (description !== undefined) {
      updates.push("description = ?");
      params.push(description);
    }

    if (max_leaves_per_year !== undefined) {
      updates.push("max_leaves_per_year = ?");
      params.push(max_leaves_per_year || null);
    }

    if (carry_forward !== undefined) {
      updates.push("carry_forward = ?");
      params.push(carry_forward);
    }

    if (max_carry_forward !== undefined) {
      updates.push("max_carry_forward = ?");
      params.push(max_carry_forward || 0);
    }

    if (requires_approval !== undefined) {
      updates.push("requires_approval = ?");
      params.push(requires_approval);
    }

    if (requires_medical_certificate !== undefined) {
      updates.push("requires_medical_certificate = ?");
      params.push(requires_medical_certificate);
    }

    if (is_active !== undefined) {
      updates.push("is_active = ?");
      params.push(is_active);
    }

    params.push(req.params.id);

    const [result] = await pool.query(
      `UPDATE leave_types 
      SET ${updates.join(", ")} 
      WHERE leavetype_id = ?`,
      params
    );

    if (result.affectedRows === 0) {
      throw new ApiError("Failed to update leave type", 500);
    }

    // Fetch updated leave type
    const [[leaveTypeRow]] = await pool.query(
      `SELECT 
        leavetype_id,
        name,
        description,
        max_leaves_per_year,
        carry_forward,
        max_carry_forward,
        requires_approval,
        requires_medical_certificate,
        is_active
      FROM leave_types WHERE leavetype_id = ?`,
      [req.params.id]
    );

    // Convert database row to LeaveType class instance
    const leaveType = LeaveType.fromDatabaseRow(leaveTypeRow);

    res.json({
      message: "Leave type updated successfully",
      leave_type: leaveType.toJSON(),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /leave-types/:id
 * Delete a leave type (soft delete by setting is_active = 'N')
 * Note: We don't hard delete to maintain referential integrity
 * Requires: HR Manager or Admin role
 */
router.delete("/:id", async (req, res, next) => {
  try {
    // Check if leave type exists
    const [[existing]] = await pool.query(
      "SELECT leavetype_id FROM leave_types WHERE leavetype_id = ?",
      [req.params.id]
    );

    if (!existing) {
      throw new ApiError("Leave type not found", 404);
    }

    // Check if leave type is being used
    const [[inUse]] = await pool.query(
      "SELECT COUNT(*) as count FROM leaves WHERE leavetype_id = ?",
      [req.params.id]
    );

    if (inUse.count > 0) {
      // Soft delete instead
      await pool.query(
        "UPDATE leave_types SET is_active = 'N' WHERE leavetype_id = ?",
        [req.params.id]
      );

      return res.json({
        message:
          "Leave type is in use and has been deactivated instead of deleted",
        leavetype_id: req.params.id,
      });
    }

    // Hard delete if not in use
    const [result] = await pool.query(
      "DELETE FROM leave_types WHERE leavetype_id = ?",
      [req.params.id]
    );

    if (result.affectedRows === 0) {
      throw new ApiError("Failed to delete leave type", 500);
    }

    res.json({ message: "Leave type deleted successfully" });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
