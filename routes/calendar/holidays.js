const express = require("express");
const router = express.Router();
const pool = require("../../db");
const ApiError = require("../../errors/ApiError");
const {
  withCache,
  invalidateHolidayCache,
  invalidateCalendarCache,
  CACHE_PREFIXES,
} = require("../../util/cacheUtil");

/**
 * GET /holidays
 * Get all holidays
 * Query params: calendar_id (required), year (optional)
 */
router.get("/", async (req, res, next) => {
  const { calendar_id, year } = req.query;
  try {
    if (!calendar_id) {
      throw new ApiError("calendar_id query parameter is required", 400);
    }

    // Build cache key
    const yearKey = year ? `:year:${year}` : "";
    const cacheKey = `${CACHE_PREFIXES.HOLIDAY}:calendar:${calendar_id}${yearKey}`;

    const result = await withCache(
      async () => {
        // Verify calendar exists
        const [[calendar]] = await pool.query(
          "SELECT id FROM attendance_calendars WHERE id = ?",
          [calendar_id]
        );

        if (!calendar) {
          throw new ApiError("Calendar not found", 404);
        }

        let whereClauses = ["h.calendar_id = ?"];
        let params = [calendar_id];

        if (year) {
          whereClauses.push("YEAR(h.holiday_date) = ?");
          params.push(year);
        }

        const whereSql = `WHERE ${whereClauses.join(" AND ")}`;

        const [holidaysRows] = await pool.query(
          `SELECT 
            h.id,
            h.holiday_name as name,
            DATE_FORMAT(h.holiday_date, '%Y-%m-%d') as holiday_date,
            h.is_optional,
            h.is_override,
            h.description,
            h.calendar_id
          FROM attendance_calendar_holidays h
          ${whereSql} 
          ORDER BY h.holiday_date ASC`,
          params
        );

        return {
          count: holidaysRows.length,
          holidays: holidaysRows,
        };
      },
      cacheKey,
      3600 // 1 hour TTL
    );

    res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /holidays/:id
 * Get holiday by ID
 */
router.get("/:id", async (req, res, next) => {
  try {
    const [[holidayRow]] = await pool.query(
      `SELECT 
        h.id,
        h.holiday_name as name,
        DATE_FORMAT(h.holiday_date, '%Y-%m-%d') as holiday_date,
        h.is_optional,
        h.is_override,
        h.description,
        h.calendar_id
      FROM attendance_calendar_holidays h
      WHERE h.id = ?`,
      [req.params.id]
    );

    if (!holidayRow) {
      throw new ApiError("Holiday not found", 404);
    }

    res.json({ holiday: holidayRow });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /holidays
 * Create a new holiday
 */
router.post("/", async (req, res, next) => {
  const {
    calendar_id,
    name,
    holiday_date,
    is_optional: isOptionalRaw,
    is_override: isOverrideRaw,
    description,
  } = req.body;
  const is_optional = (isOptionalRaw ?? "N").toUpperCase();
  const is_override = (isOverrideRaw ?? "N").toUpperCase();
  
  try {
    if (!calendar_id || !name || !holiday_date) {
      throw new ApiError("calendar_id, name, and holiday_date are required", 400);
    }

    // Validate is_optional value
    if (!["Y", "N"].includes(is_optional)) {
      throw new ApiError("is_optional must be 'Y' or 'N'", 400);
    }

    // Validate is_override value
    if (!["Y", "N"].includes(is_override)) {
      throw new ApiError("is_override must be 'Y' or 'N'", 400);
    }

    // Verify calendar exists
    const [[calendar]] = await pool.query(
      "SELECT id FROM attendance_calendars WHERE id = ?",
      [calendar_id]
    );

    if (!calendar) {
      throw new ApiError("Calendar not found", 404);
    }

    // Check if holiday already exists for this date in this calendar (unique constraint)
    const [[existing]] = await pool.query(
      "SELECT id FROM attendance_calendar_holidays WHERE calendar_id = ? AND holiday_date = ?",
      [calendar_id, holiday_date]
    );

    if (existing) {
      throw new ApiError(
        `Holiday already exists for date '${holiday_date}' in this calendar`,
        400
      );
    }

    // Insert holiday
    const [result] = await pool.query(
      `INSERT INTO attendance_calendar_holidays (calendar_id, holiday_name, holiday_date, is_optional, is_override, description) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        calendar_id,
        name,
        holiday_date,
        is_optional,
        is_override,
        description || null,
      ]
    );

    // Invalidate holiday and calendar caches
    await invalidateHolidayCache(calendar_id);
    await invalidateCalendarCache(calendar_id);

    // Fetch created holiday
    const [[holidayRow]] = await pool.query(
      `SELECT 
        h.id,
        h.holiday_name as name,
        DATE_FORMAT(h.holiday_date, '%Y-%m-%d') as holiday_date,
        h.is_optional,
        h.is_override,
        h.description,
        h.calendar_id
      FROM attendance_calendar_holidays h
      WHERE h.id = ?`,
      [result.insertId]
    );

    res.status(201).json({
      message: "Holiday created successfully",
      holiday: holidayRow,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /holidays/:id
 * Update a holiday
 */
router.patch("/:id", async (req, res, next) => {
  const { id } = req.params;
  const { name, holiday_date, is_optional, is_override, description } = req.body;

  try {
    // Check if holiday exists and get calendar_id
    const [[existing]] = await pool.query(
      "SELECT id, calendar_id FROM attendance_calendar_holidays WHERE id = ?",
      [id]
    );

    if (!existing) {
      throw new ApiError("Holiday not found", 404);
    }

    const calendar_id = existing.calendar_id;

    // Build update query
    const updates = [];
    const params = [];

    if (name !== undefined) {
      updates.push("holiday_name = ?");
      params.push(name);
    }

    if (holiday_date !== undefined) {
      // Check if new date conflicts with existing holiday in the same calendar
      const [[dateConflict]] = await pool.query(
        "SELECT id FROM attendance_calendar_holidays WHERE calendar_id = ? AND holiday_date = ? AND id != ?",
        [calendar_id, holiday_date, id]
      );

      if (dateConflict) {
        throw new ApiError(
          `Holiday already exists for date '${holiday_date}' in this calendar`,
          400
        );
      }

      updates.push("holiday_date = ?");
      params.push(holiday_date);
    }

    if (is_optional !== undefined) {
      if (!["Y", "N"].includes(is_optional.toUpperCase())) {
        throw new ApiError("is_optional must be 'Y' or 'N'", 400);
      }
      updates.push("is_optional = ?");
      params.push(is_optional.toUpperCase());
    }

    if (is_override !== undefined) {
      if (!["Y", "N"].includes(is_override.toUpperCase())) {
        throw new ApiError("is_override must be 'Y' or 'N'", 400);
      }
      updates.push("is_override = ?");
      params.push(is_override.toUpperCase());
    }

    if (description !== undefined) {
      updates.push("description = ?");
      params.push(description || null);
    }

    if (updates.length === 0) {
      throw new ApiError("No fields to update", 400);
    }

    params.push(id);

    const [result] = await pool.query(
      `UPDATE attendance_calendar_holidays SET ${updates.join(", ")} WHERE id = ?`,
      params
    );

    if (result.affectedRows === 0) {
      throw new ApiError("Failed to update holiday", 500);
    }

    // Invalidate holiday and calendar caches
    await invalidateHolidayCache(calendar_id, id);
    await invalidateCalendarCache(calendar_id);

    // Fetch updated holiday
    const [[holidayRow]] = await pool.query(
      `SELECT 
        h.id,
        h.holiday_name as name,
        DATE_FORMAT(h.holiday_date, '%Y-%m-%d') as holiday_date,
        h.is_optional,
        h.is_override,
        h.description,
        h.calendar_id
      FROM attendance_calendar_holidays h
      WHERE h.id = ?`,
      [id]
    );

    res.json({
      message: "Holiday updated successfully",
      holiday: holidayRow,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /holidays/:id
 * Delete a holiday
 */
router.delete("/:id", async (req, res, next) => {
  try {
    // Check if holiday exists and get calendar_id
    const [[existing]] = await pool.query(
      "SELECT id, calendar_id FROM attendance_calendar_holidays WHERE id = ?",
      [req.params.id]
    );

    if (!existing) {
      throw new ApiError("Holiday not found", 404);
    }

    const calendarId = existing.calendar_id;

    const [result] = await pool.query("DELETE FROM attendance_calendar_holidays WHERE id = ?", [
      req.params.id,
    ]);

    if (result.affectedRows === 0) {
      throw new ApiError("Failed to delete holiday", 500);
    }

    // Invalidate holiday and calendar caches
    await invalidateHolidayCache(calendarId, req.params.id);
    await invalidateCalendarCache(calendarId);

    res.json({ message: "Holiday deleted successfully" });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
