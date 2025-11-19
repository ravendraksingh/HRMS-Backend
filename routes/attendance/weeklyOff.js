const express = require("express");
const router = express.Router();
const pool = require("../../db");
const ApiError = require("../../util/ApiError");
const { resolveEmployeeNumericId } = require("../../util/employeeUtil");

/**
 * GET /attendance/weekly-off
 * Get weekly off configurations
 * Query params: year, month, employee_id, department_id
 */
router.get("/", async (req, res, next) => {
  const organization_id = req.organizationId;
  const { year, month, employee_id, department_id } = req.query;

  try {
    const where = ["organization_id = ?"];
    const params = [organization_id];

    if (year) {
      where.push("year = ?");
      params.push(parseInt(year));
    }
    if (month) {
      where.push("month = ?");
      params.push(parseInt(month));
    }
    
    // Filter by employee_id if provided
    if (employee_id) {
      const employeeNumericId = await resolveEmployeeNumericId(employee_id, organization_id);
      where.push("employee_id = ?");
      params.push(employeeNumericId);
    }
    
    // Filter by department_id if provided
    if (department_id) {
      where.push("department_id = ?");
      params.push(parseInt(department_id));
    }

    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
    const [rows] = await pool.query(
      `SELECT 
        id,
        organization_id,
        year,
        month,
        employee_id,
        department_id,
        days_of_week,
        created_at,
        updated_at
      FROM attendance_weekly_off 
      ${whereSql} 
      ORDER BY year DESC, month DESC, employee_id, department_id`,
      params
    );

    // Parse JSON fields
    const weeklyOffs = rows.map(row => ({
      ...row,
      days_of_week: JSON.parse(row.days_of_week)
    }));

    res.json({ weekly_offs: weeklyOffs });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /attendance/weekly-off/:id
 * Get a specific weekly off configuration by ID
 */
router.get("/:id", async (req, res, next) => {
  const organization_id = req.organizationId;
  const { id } = req.params;

  try {
    const [[weeklyOff]] = await pool.query(
      `SELECT 
        id,
        organization_id,
        year,
        month,
        employee_id,
        department_id,
        days_of_week,
        created_at,
        updated_at
      FROM attendance_weekly_off 
      WHERE id = ? AND organization_id = ?`,
      [id, organization_id]
    );

    if (!weeklyOff) {
      throw new ApiError("Weekly off configuration not found", 404);
    }

    weeklyOff.days_of_week = JSON.parse(weeklyOff.days_of_week);
    res.json(weeklyOff);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /attendance/weekly-off
 * Create a new weekly off configuration
 * Body: { year, month, employee_id (optional), department_id (optional), days_of_week: [0,6] }
 */
router.post("/", async (req, res, next) => {
  const organization_id = req.organizationId;
  const { year, month, employee_id, department_id, days_of_week } = req.body;

  try {
    // Validation
    if (!year || !month || !days_of_week) {
      throw new ApiError("year, month, and days_of_week are required", 400);
    }

    if (!Array.isArray(days_of_week) || days_of_week.length === 0) {
      throw new ApiError("days_of_week must be a non-empty array", 400);
    }

    // Validate day numbers (0-6)
    const validDays = days_of_week.every(day => Number.isInteger(day) && day >= 0 && day <= 6);
    if (!validDays) {
      throw new ApiError("days_of_week must contain integers between 0 (Sunday) and 6 (Saturday)", 400);
    }

    // Validate month (1-12)
    const monthNum = parseInt(month);
    if (monthNum < 1 || monthNum > 12) {
      throw new ApiError("month must be between 1 and 12", 400);
    }

    // Validate year
    const yearNum = parseInt(year);
    if (yearNum < 2000 || yearNum > 2100) {
      throw new ApiError("year must be between 2000 and 2100", 400);
    }

    // Validate scope: either employee_id OR department_id OR neither (org-wide), but not both
    if (employee_id && department_id) {
      throw new ApiError("Cannot specify both employee_id and department_id. Use one or neither for organization-wide", 400);
    }

    let employeeNumericId = null;
    if (employee_id) {
      employeeNumericId = await resolveEmployeeNumericId(employee_id, organization_id);
    }

    // Check if configuration already exists
    const [[existing]] = await pool.query(
      `SELECT id FROM attendance_weekly_off 
       WHERE organization_id = ? 
       AND year = ? 
       AND month = ? 
       AND COALESCE(employee_id, 0) = COALESCE(?, 0)
       AND COALESCE(department_id, 0) = COALESCE(?, 0)`,
      [organization_id, yearNum, monthNum, employeeNumericId, department_id ? parseInt(department_id) : null]
    );

    if (existing) {
      throw new ApiError("Weekly off configuration already exists for this month and scope", 409);
    }

    // Insert new configuration
    const [result] = await pool.query(
      `INSERT INTO attendance_weekly_off 
       (organization_id, year, month, employee_id, department_id, days_of_week) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        organization_id,
        yearNum,
        monthNum,
        employeeNumericId,
        department_id ? parseInt(department_id) : null,
        JSON.stringify(days_of_week)
      ]
    );

    res.status(201).json({ 
      id: result.insertId,
      message: "Weekly off configuration created successfully"
    });
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /attendance/weekly-off/:id
 * Update an existing weekly off configuration
 * Body: { days_of_week: [0,6] } (other fields cannot be updated)
 */
router.patch("/:id", async (req, res, next) => {
  const organization_id = req.organizationId;
  const { id } = req.params;
  const { days_of_week } = req.body;

  try {
    if (!days_of_week) {
      throw new ApiError("days_of_week is required", 400);
    }

    if (!Array.isArray(days_of_week) || days_of_week.length === 0) {
      throw new ApiError("days_of_week must be a non-empty array", 400);
    }

    // Validate day numbers (0-6)
    const validDays = days_of_week.every(day => Number.isInteger(day) && day >= 0 && day <= 6);
    if (!validDays) {
      throw new ApiError("days_of_week must contain integers between 0 (Sunday) and 6 (Saturday)", 400);
    }

    // Check if configuration exists
    const [[existing]] = await pool.query(
      "SELECT id FROM attendance_weekly_off WHERE id = ? AND organization_id = ?",
      [id, organization_id]
    );

    if (!existing) {
      throw new ApiError("Weekly off configuration not found", 404);
    }

    // Update configuration
    const [result] = await pool.query(
      "UPDATE attendance_weekly_off SET days_of_week = ?, updated_at = NOW() WHERE id = ? AND organization_id = ?",
      [JSON.stringify(days_of_week), id, organization_id]
    );

    if (result.affectedRows === 0) {
      throw new ApiError("Weekly off configuration not found", 404);
    }

    res.json({ 
      updated: true,
      message: "Weekly off configuration updated successfully"
    });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /attendance/weekly-off/:id
 * Delete a weekly off configuration
 */
router.delete("/:id", async (req, res, next) => {
  const organization_id = req.organizationId;
  const { id } = req.params;

  try {
    const [result] = await pool.query(
      "DELETE FROM attendance_weekly_off WHERE id = ? AND organization_id = ?",
      [id, organization_id]
    );

    if (result.affectedRows === 0) {
      throw new ApiError("Weekly off configuration not found", 404);
    }

    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

module.exports = router;

