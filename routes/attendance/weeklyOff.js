const express = require("express");
const router = express.Router();
const pool = require("../../db");
const ApiError = require("../../errors/ApiError");
/**
 * GET /attendance/weekly-off
 * Get weekly off configurations
 * Query params: month (optional, YYYY-MM format, e.g., 2024-12), employee_id (optional), department_id (optional)
 */
router.get("/", async (req, res, next) => {
  const { month, employee_id, department_id } = req.query;

  try {
    const where = [];
    const params = [];

    // Parse month if provided
    if (month) {
      // Validate month format (YYYY-MM)
      const monthRegex = /^\d{4}-\d{2}$/;
      if (!monthRegex.test(month)) {
        throw new ApiError(
          "month must be in format YYYY-MM (e.g., 2024-12)",
          400
        );
      }

      // Parse year and month from YYYY-MM format
      const [yearStr, monthStr] = month.split("-");
      const year = parseInt(yearStr);
      const monthNum = parseInt(monthStr);

      // Validate month range
      if (isNaN(monthNum) || monthNum < 1 || monthNum > 12) {
        throw new ApiError("month must be between 01 and 12", 400);
      }

      // Validate year range
      if (isNaN(year) || year < 2000 || year > 2100) {
        throw new ApiError("year must be between 2000 and 2100", 400);
      }

      where.push("year = ?");
      params.push(year);
      where.push("month = ?");
      params.push(monthNum);
    }

    // Filter by employee_id if provided
    if (employee_id) {
      const employeeNumericId = employee_id;
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

    // Parse JSON fields and add month string in YYYY-MM format
    const weeklyOffs = rows.map((row) => ({
      ...row,
      month_string: `${row.year}-${String(row.month).padStart(2, "0")}`,
      days_of_week: JSON.parse(row.days_of_week),
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
  const { id } = req.params;

  try {
    const [[weeklyOff]] = await pool.query(
      `SELECT 
        id,
        year,
        month,
        employee_id,
        department_id,
        days_of_week,
        created_at,
        updated_at
      FROM attendance_weekly_off 
      WHERE id = ?`,
      [id]
    );

    if (!weeklyOff) {
      throw new ApiError("Weekly off configuration not found", 404);
    }

    weeklyOff.days_of_week = JSON.parse(weeklyOff.days_of_week);
    weeklyOff.month_string = `${weeklyOff.year}-${String(
      weeklyOff.month
    ).padStart(2, "0")}`;
    res.json(weeklyOff);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /attendance/weekly-off
 * Create a new weekly off configuration
 * Body: { month (required, YYYY-MM format, e.g., 2024-12), employee_id (optional), department_id (optional), days_of_week: [0,6] }
 */
router.post("/", async (req, res, next) => {
  const { month, employee_id, department_id, days_of_week } = req.body;

  try {
    // Validation
    if (!month || !days_of_week) {
      throw new ApiError("month and days_of_week are required", 400);
    }

    if (!Array.isArray(days_of_week) || days_of_week.length === 0) {
      throw new ApiError("days_of_week must be a non-empty array", 400);
    }

    // Validate day numbers (0-6)
    const validDays = days_of_week.every(
      (day) => Number.isInteger(day) && day >= 0 && day <= 6
    );
    if (!validDays) {
      throw new ApiError(
        "days_of_week must contain integers between 0 (Sunday) and 6 (Saturday)",
        400
      );
    }

    // Validate month format (YYYY-MM)
    const monthRegex = /^\d{4}-\d{2}$/;
    if (!monthRegex.test(month)) {
      throw new ApiError(
        "month must be in format YYYY-MM (e.g., 2024-12)",
        400
      );
    }

    // Parse year and month from YYYY-MM format
    const [yearStr, monthStr] = month.split("-");
    const year = parseInt(yearStr);
    const monthNum = parseInt(monthStr);

    // Validate month range
    if (isNaN(monthNum) || monthNum < 1 || monthNum > 12) {
      throw new ApiError("month must be between 01 and 12", 400);
    }

    // Validate year range
    if (isNaN(year) || year < 2000 || year > 2100) {
      throw new ApiError("year must be between 2000 and 2100", 400);
    }

    // Validate scope: either employee_id OR department_id OR neither (org-wide), but not both
    if (employee_id && department_id) {
      throw new ApiError(
        "Cannot specify both employee_id and department_id. Use one or neither for organization-wide",
        400
      );
    }

    let employeeNumericId = null;
    if (employee_id) {
      employeeNumericId = employee_id;
    }

    // Check if configuration already exists
    const [[existing]] = await pool.query(
      `SELECT id FROM attendance_weekly_off 
       WHERE year = ? 
       AND month = ? 
       AND COALESCE(employee_id, 0) = COALESCE(?, 0)
       AND COALESCE(department_id, 0) = COALESCE(?, 0)`,
      [
        year,
        monthNum,
        employeeNumericId,
        department_id ? parseInt(department_id) : null,
      ]
    );

    if (existing) {
      throw new ApiError(
        "Weekly off configuration already exists for this month and scope",
        409
      );
    }

    // Insert new configuration
    const [result] = await pool.query(
      `INSERT INTO attendance_weekly_off 
       ( year, month, employee_id, department_id, days_of_week) 
       VALUES (?, ?, ?, ?, ?)`,
      [
        year,
        monthNum,
        employeeNumericId,
        department_id ? parseInt(department_id) : null,
        JSON.stringify(days_of_week),
      ]
    );

    res.status(201).json({
      id: result.insertId,
      month: month,
      year: year,
      month_number: monthNum,
      message: "Weekly off configuration created successfully",
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
    const validDays = days_of_week.every(
      (day) => Number.isInteger(day) && day >= 0 && day <= 6
    );
    if (!validDays) {
      throw new ApiError(
        "days_of_week must contain integers between 0 (Sunday) and 6 (Saturday)",
        400
      );
    }

    // Check if configuration exists
    const [[existing]] = await pool.query(
      "SELECT id FROM attendance_weekly_off WHERE id = ?",
      [id]
    );

    if (!existing) {
      throw new ApiError("Weekly off configuration not found", 404);
    }

    // Update configuration
    const [result] = await pool.query(
      "UPDATE attendance_weekly_off SET days_of_week = ?, updated_at = NOW() WHERE id = ?",
      [JSON.stringify(days_of_week), id]
    );

    if (result.affectedRows === 0) {
      throw new ApiError("Weekly off configuration not found", 404);
    }

    res.json({
      updated: true,
      message: "Weekly off configuration updated successfully",
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
  const { id } = req.params;

  try {
    const [result] = await pool.query(
      "DELETE FROM attendance_weekly_off WHERE id = ?",
      [id]
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
