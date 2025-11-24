// routes/leaves/leaveTypes.js
// Leave Types Management APIs (HR Managers and Admins only)
const express = require("express");
const router = express.Router();
const pool = require("../../db");
const ApiError = require("../../util/ApiError");
const { requireHrManagerOrAdmin } = require("../../util/authUtil");
const LeaveType = require("../../models/LeaveType");

// Apply HR Manager or Admin requirement to all routes
router.use(requireHrManagerOrAdmin);

/**
 * POST /leave-types
 * Create a new leave type
 * Body: leavetype_id, name, description, max_leaves_per_year, carry_forward, etc.
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
    // Validate required fields
    if (!leavetype_id || !name) {
      throw new ApiError("leavetype_id and name are required", 400);
    }

    // Validate leavetype_id length (VARCHAR(3))
    if (leavetype_id.length > 3) {
      throw new ApiError("leavetype_id must be 3 characters or less", 400);
    }

    // Validate carry_forward value
    if (!["Y", "N"].includes(carry_forward.toUpperCase())) {
      throw new ApiError("carry_forward must be 'Y' or 'N'", 400);
    }

    // Validate requires_approval value
    if (!["Y", "N"].includes(requires_approval.toUpperCase())) {
      throw new ApiError("requires_approval must be 'Y' or 'N'", 400);
    }

    // Validate requires_medical_certificate value
    if (!["Y", "N"].includes(requires_medical_certificate.toUpperCase())) {
      throw new ApiError("requires_medical_certificate must be 'Y' or 'N'", 400);
    }

    // Validate is_active value
    if (!["Y", "N"].includes(is_active.toUpperCase())) {
      throw new ApiError("is_active must be 'Y' or 'N'", 400);
    }

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
      throw new ApiError(
        `Leave type with name '${name}' already exists`,
        400
      );
    }

    // Insert leave type
    await pool.query(
      `INSERT INTO leave_types (
        leavetype_id, name, description, max_leaves_per_year, 
        carry_forward, max_carry_forward, requires_approval, 
        requires_medical_certificate, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        leavetype_id.toUpperCase(),
        name,
        description || null,
        max_leaves_per_year || null,
        carry_forward.toUpperCase(),
        max_carry_forward || 0,
        requires_approval.toUpperCase(),
        requires_medical_certificate.toUpperCase(),
        is_active.toUpperCase(),
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
      [leavetype_id.toUpperCase()]
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
      const activeValue = is_active === "true" || is_active === "1" || is_active === "Y" ? "Y" : "N";
      whereClauses.push("lt.is_active = ?");
      params.push(activeValue);
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

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
router.get("/:id", async (req, res, next) => {
  const { id } = req.params;

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
      [id.toUpperCase()]
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
});

/**
 * PATCH /leave-types/:id
 * Update a leave type by leavetype_id
 */
router.patch("/:id", async (req, res, next) => {
  const { id } = req.params;
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
      [id.toUpperCase()]
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
        [name, id.toUpperCase()]
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
      if (!["Y", "N"].includes(carry_forward.toUpperCase())) {
        throw new ApiError("carry_forward must be 'Y' or 'N'", 400);
      }
      updates.push("carry_forward = ?");
      params.push(carry_forward.toUpperCase());
    }

    if (max_carry_forward !== undefined) {
      updates.push("max_carry_forward = ?");
      params.push(max_carry_forward || 0);
    }

    if (requires_approval !== undefined) {
      if (!["Y", "N"].includes(requires_approval.toUpperCase())) {
        throw new ApiError("requires_approval must be 'Y' or 'N'", 400);
      }
      updates.push("requires_approval = ?");
      params.push(requires_approval.toUpperCase());
    }

    if (requires_medical_certificate !== undefined) {
      if (!["Y", "N"].includes(requires_medical_certificate.toUpperCase())) {
        throw new ApiError("requires_medical_certificate must be 'Y' or 'N'", 400);
      }
      updates.push("requires_medical_certificate = ?");
      params.push(requires_medical_certificate.toUpperCase());
    }

    if (is_active !== undefined) {
      if (!["Y", "N"].includes(is_active.toUpperCase())) {
        throw new ApiError("is_active must be 'Y' or 'N'", 400);
      }
      updates.push("is_active = ?");
      params.push(is_active.toUpperCase());
    }

    if (updates.length === 0) {
      throw new ApiError("No fields to update", 400);
    }

    params.push(id.toUpperCase());

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
      [id.toUpperCase()]
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
 */
router.delete("/:id", async (req, res, next) => {
  const { id } = req.params;

  try {
    // Check if leave type exists
    const [[existing]] = await pool.query(
      "SELECT leavetype_id FROM leave_types WHERE leavetype_id = ?",
      [id.toUpperCase()]
    );

    if (!existing) {
      throw new ApiError("Leave type not found", 404);
    }

    // Check if leave type is being used
    const [[inUse]] = await pool.query(
      "SELECT COUNT(*) as count FROM leaves WHERE leavetype_id = ?",
      [id.toUpperCase()]
    );

    if (inUse.count > 0) {
      // Soft delete instead
      await pool.query(
        "UPDATE leave_types SET is_active = 'N' WHERE leavetype_id = ?",
        [id.toUpperCase()]
      );

      return res.json({
        message:
          "Leave type is in use and has been deactivated instead of deleted",
        leavetype_id: id.toUpperCase(),
      });
    }

    // Hard delete if not in use
    const [result] = await pool.query(
      "DELETE FROM leave_types WHERE leavetype_id = ?",
      [id.toUpperCase()]
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

