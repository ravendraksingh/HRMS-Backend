// routes/calendar/calendars.js
// Calendar Management APIs (Workday-style hierarchical calendar system)
// Supports ORGANIZATION, LOCATION, DEPARTMENT, EMPLOYEE calendars (single org system - no orgid required)
const express = require("express");
const router = express.Router();
const pool = require("../../db");
const ApiError = require("../../util/ApiError");
const {
  resolveEmployeeCalendar,
  getMonthlyCalendar,
  getMonthlyCalendarForLevel,
  getCalendarForLevel,
  isWorkingDay,
  getWorkingDays,
} = require("../../util/calendarUtil");

/**
 * GET /calendars/resolve/:empid
 * Resolve calendar for an employee (shows inheritance hierarchy)
 * Query params: year
 */
router.get("/resolve/:empid", async (req, res, next) => {
  const { empid } = req.params;
  const { year } = req.query;

  try {
    if (!year) {
      throw new ApiError("year query parameter is required", 400);
    }

    const calendar = await resolveEmployeeCalendar(empid, parseInt(year));

    res.json({
      message: "Calendar resolved successfully",
      calendar,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /calendars/monthly/organization
 * Get monthly calendar view for organization
 * Query params: year, month
 */
router.get("/monthly/organization", async (req, res, next) => {
  const { year, month } = req.query;

  try {
    if (!year || !month) {
      throw new ApiError("year and month query parameters are required", 400);
    }

    const calendar = await getCalendarForLevel(
      "ORGANIZATION",
      parseInt(year),
      null,
      null,
      null
    );

    if (!calendar) {
      throw new ApiError(
        `Organization calendar not found for year ${year}`,
        404
      );
    }

    const monthlyCalendar = getMonthlyCalendarForLevel(
      calendar,
      parseInt(year),
      parseInt(month)
    );

    res.json({
      message: "Organization monthly calendar retrieved successfully",
      year: parseInt(year),
      month: parseInt(month),
      calendar_name: calendar.calendar_name,
      ...monthlyCalendar,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /calendars/monthly/employee/:empid
 * Get monthly calendar view for an employee
 * Query params: year, month
 */
router.get("/monthly/employee/:empid", async (req, res, next) => {
  const { empid } = req.params;
  const { year, month } = req.query;

  try {
    if (!year || !month) {
      throw new ApiError("year and month query parameters are required", 400);
    }

    const calendar = await getMonthlyCalendar(
      empid,
      parseInt(year),
      parseInt(month)
    );

    res.json({
      message: "Monthly calendar retrieved successfully",
      ...calendar,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /calendars/monthly/location/:location_id
 * Get monthly calendar view for a location
 * Query params: year, month
 */
router.get("/monthly/location/:location_id", async (req, res, next) => {
  const { location_id } = req.params;
  const { year, month } = req.query;

  try {
    if (!year || !month) {
      throw new ApiError("year and month query parameters are required", 400);
    }

    const calendar = await getCalendarForLevel(
      "LOCATION",
      parseInt(year),
      parseInt(location_id),
      null,
      null
    );

    if (!calendar) {
      throw new ApiError(
        `Location calendar not found for location_id ${location_id} and year ${year}`,
        404
      );
    }

    const monthlyCalendar = getMonthlyCalendarForLevel(
      calendar,
      parseInt(year),
      parseInt(month)
    );

    res.json({
      message: "Location monthly calendar retrieved successfully",
      location_id: parseInt(location_id),
      year: parseInt(year),
      month: parseInt(month),
      calendar_name: calendar.calendar_name,
      ...monthlyCalendar,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /calendars/monthly/department/:department_id
 * Get monthly calendar view for a department
 * Query params: year, month
 */
router.get("/monthly/department/:department_id", async (req, res, next) => {
  const { department_id } = req.params;
  const { year, month } = req.query;

  try {
    if (!year || !month) {
      throw new ApiError("year and month query parameters are required", 400);
    }

    const calendar = await getCalendarForLevel(
      "DEPARTMENT",
      parseInt(year),
      null,
      department_id,
      null
    );

    if (!calendar) {
      throw new ApiError(
        `Department calendar not found for department_id ${department_id} and year ${year}`,
        404
      );
    }

    const monthlyCalendar = getMonthlyCalendarForLevel(
      calendar,
      parseInt(year),
      parseInt(month)
    );

    res.json({
      message: "Department monthly calendar retrieved successfully",
      department_id,
      year: parseInt(year),
      month: parseInt(month),
      calendar_name: calendar.calendar_name,
      ...monthlyCalendar,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /calendars/working-day/:empid
 * Check if a specific date is a working day for an employee
 * Query params: date (YYYY-MM-DD)
 */
router.get("/working-day/:empid", async (req, res, next) => {
  const { empid } = req.params;
  const { date } = req.query;

  try {
    if (!date) {
      throw new ApiError("date query parameter is required (YYYY-MM-DD)", 400);
    }

    const status = await isWorkingDay(empid, date);

    res.json({
      empid,
      date,
      ...status,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /calendars/working-days/:empid
 * Get working days for a date range
 * Query params: start_date, end_date (YYYY-MM-DD)
 */
router.get("/working-days/:empid", async (req, res, next) => {
  const { empid } = req.params;
  const { start_date, end_date } = req.query;

  try {
    if (!start_date || !end_date) {
      throw new ApiError(
        "start_date and end_date query parameters are required (YYYY-MM-DD)",
        400
      );
    }

    const workingDays = await getWorkingDays(empid, start_date, end_date);

    const summary = {
      total_days: workingDays.length,
      working_days: workingDays.filter((d) => d.is_working_day).length,
      non_working_days: workingDays.filter((d) => !d.is_working_day).length,
      holidays: workingDays.filter((d) => d.type === "HOLIDAY").length,
      optional_holidays: workingDays.filter(
        (d) => d.type === "OPTIONAL_HOLIDAY"
      ).length,
      weekly_offs: workingDays.filter((d) => d.type === "WEEKLY_OFF").length,
    };

    res.json({
      empid,
      start_date,
      end_date,
      calendar: workingDays,
      summary,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /calendars
 * Get calendars by level
 * Query params: calendar_type (ORGANIZATION, LOCATION, DEPARTMENT, EMPLOYEE),
 *               year, location_id, department_id, empid
 */
router.get("/", async (req, res, next) => {
  const { calendar_type, year, location_id, department_id, empid } = req.query;

  try {
    if (!calendar_type) {
      throw new ApiError("calendar_type query parameter is required", 400);
    }

    if (
      !["ORGANIZATION", "LOCATION", "DEPARTMENT", "EMPLOYEE"].includes(
        calendar_type
      )
    ) {
      throw new ApiError(
        "calendar_type must be one of: ORGANIZATION, LOCATION, DEPARTMENT, EMPLOYEE",
        400
      );
    }

    let whereClause = "calendar_type = ? AND is_active = 'Y'";
    const params = [calendar_type];

    if (year) {
      whereClause += " AND year = ?";
      params.push(parseInt(year));
    }

    if (calendar_type === "ORGANIZATION") {
      // No additional filter needed for organization (single org system)
    } else if (calendar_type === "LOCATION" && location_id) {
      whereClause += " AND location_id = ?";
      params.push(parseInt(location_id));
    } else if (calendar_type === "DEPARTMENT" && department_id) {
      whereClause += " AND department_id = ?";
      params.push(department_id);
    } else if (calendar_type === "EMPLOYEE" && empid) {
      whereClause += " AND empid = ?";
      params.push(empid);
    }

    const [calendars] = await pool.query(
      `SELECT 
        id,
        calendar_name,
        calendar_type,
        location_id,
        department_id,
        empid,
        year,
        is_active,
        description,
        created_by,
        created_at,
        updated_at
      FROM attendance_calendars
      WHERE ${whereClause}
      ORDER BY year DESC, calendar_name ASC`,
      params
    );

    res.json({
      count: calendars.length,
      calendars,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /calendars/:id
 * Get a specific calendar by ID with all details
 */
router.get("/:id", async (req, res, next) => {
  const { id } = req.params;

  try {
    const [[calendar]] = await pool.query(
      `SELECT 
        id,
        calendar_name,
        calendar_type,
        location_id,
        department_id,
        empid,
        year,
        is_active,
        description,
        created_by
      FROM attendance_calendars
      WHERE id = ?`,
      [id]
    );

    if (!calendar) {
      throw new ApiError("Calendar not found", 404);
    }

    // Get holidays
    const [holidays] = await pool.query(
      `SELECT 
        id,
        DATE_FORMAT(holiday_date, '%Y-%m-%d') as holiday_date,
        holiday_name,
        is_optional,
        is_override,
        description
      FROM attendance_calendar_holidays
      WHERE calendar_id = ?
      ORDER BY holiday_date ASC`,
      [id]
    );

    console.log("holidays", holidays);

    // Get weekly offs
    const [weeklyOffs] = await pool.query(
      `SELECT 
        id,
        day_of_week,
        is_override
      FROM attendance_calendar_weekly_offs
      WHERE calendar_id = ?
      ORDER BY day_of_week ASC`,
      [id]
    );

    // Get date overrides
    const [dateOverrides] = await pool.query(
      `SELECT 
        id,
        override_date,
        is_working_day,
        reason
      FROM attendance_calendar_date_overrides
      WHERE calendar_id = ?
      ORDER BY override_date ASC`,
      [id]
    );

    res.json({
      calendar: {
        ...calendar,
        holidays: holidays.map((h) => ({
          ...h,
          holiday_date: h.holiday_date,
        })),
        weekly_offs: weeklyOffs,
        date_overrides: dateOverrides.map((do_) => ({
          ...do_,
          override_date: do_.override_date,
        })),
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /calendars
 * Create a new calendar
 * Body: { calendar_name, calendar_type, year, location_id?, department_id?, empid?, description?, created_by? }
 */
router.post("/", async (req, res, next) => {
  const {
    calendar_name,
    calendar_type,
    year,
    location_id,
    department_id,
    empid,
    description,
    created_by,
  } = req.body;

  try {
    // Validation
    if (!calendar_name || !calendar_type || !year) {
      throw new ApiError(
        "calendar_name, calendar_type, and year are required",
        400
      );
    }

    if (
      !["ORGANIZATION", "LOCATION", "DEPARTMENT", "EMPLOYEE"].includes(
        calendar_type
      )
    ) {
      throw new ApiError(
        "calendar_type must be one of: ORGANIZATION, LOCATION, DEPARTMENT, EMPLOYEE",
        400
      );
    }

    // Validate based on calendar type
    if (calendar_type === "ORGANIZATION") {
      // No additional fields required for organization (single org system)
    } else if (calendar_type === "LOCATION" && !location_id) {
      throw new ApiError("location_id is required for LOCATION calendar", 400);
    } else if (calendar_type === "DEPARTMENT" && !department_id) {
      throw new ApiError(
        "department_id is required for DEPARTMENT calendar",
        400
      );
    } else if (calendar_type === "EMPLOYEE" && !empid) {
      throw new ApiError("empid is required for EMPLOYEE calendar", 400);
    }

    // Check if calendar already exists
    let checkQuery = "calendar_type = ? AND year = ?";
    const checkParams = [calendar_type, parseInt(year)];

    if (calendar_type === "ORGANIZATION") {
      // Only one organization calendar per year (single org system)
    } else if (calendar_type === "LOCATION") {
      checkQuery += " AND location_id = ?";
      checkParams.push(parseInt(location_id));
    } else if (calendar_type === "DEPARTMENT") {
      checkQuery += " AND department_id = ?";
      checkParams.push(department_id);
    } else if (calendar_type === "EMPLOYEE") {
      checkQuery += " AND empid = ?";
      checkParams.push(empid);
    }

    const [[existing]] = await pool.query(
      `SELECT id FROM attendance_calendars WHERE ${checkQuery}`,
      checkParams
    );

    if (existing) {
      throw new ApiError(
        `Calendar already exists for this ${calendar_type.toLowerCase()} and year`,
        409
      );
    }

    // Create calendar
    const [result] = await pool.query(
      `INSERT INTO attendance_calendars (
        calendar_name, calendar_type, location_id, 
        department_id, empid, year, description, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        calendar_name,
        calendar_type,
        location_id ? parseInt(location_id) : null,
        department_id || null,
        empid || null,
        parseInt(year),
        description || null,
        created_by || null,
      ]
    );

    // Fetch created calendar
    const [[newCalendar]] = await pool.query(
      `SELECT 
        id,
        calendar_name,
        calendar_type,
        location_id,
        department_id,
        empid,
        year,
        is_active,
        description,
        created_by,
        created_at,
        updated_at
      FROM attendance_calendars
      WHERE id = ?`,
      [result.insertId]
    );

    res.status(201).json({
      message: "Calendar created successfully",
      calendar: newCalendar,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /calendars/:id/holidays
 * Add holidays to a calendar
 * Body: { holidays: [{ holiday_date, holiday_name, is_optional?, is_override?, description? }] }
 */
router.post("/:id/holidays", async (req, res, next) => {
  const { id } = req.params;
  const { holidays } = req.body;

  try {
    if (!holidays || !Array.isArray(holidays) || holidays.length === 0) {
      throw new ApiError(
        "holidays array is required and must not be empty",
        400
      );
    }

    // Check if calendar exists
    const [[calendar]] = await pool.query(
      "SELECT id FROM attendance_calendars WHERE id = ?",
      [id]
    );

    if (!calendar) {
      throw new ApiError("Calendar not found", 404);
    }

    // Insert holidays
    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      const insertedHolidays = [];

      for (const holiday of holidays) {
        if (!holiday.holiday_date || !holiday.holiday_name) {
          throw new ApiError(
            "Each holiday must have holiday_date and holiday_name",
            400
          );
        }

        const [result] = await connection.query(
          `INSERT INTO attendance_calendar_holidays (
            calendar_id, holiday_date, holiday_name, is_optional, is_override, description
          ) VALUES (?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            holiday_name = VALUES(holiday_name),
            is_optional = VALUES(is_optional),
            is_override = VALUES(is_override),
            description = VALUES(description),
            updated_at = NOW()`,
          [
            id,
            holiday.holiday_date,
            holiday.holiday_name,
            (holiday.is_optional || "N").toUpperCase(),
            (holiday.is_override || "N").toUpperCase(),
            holiday.description || null,
          ]
        );

        insertedHolidays.push({
          holiday_date: holiday.holiday_date,
          holiday_name: holiday.holiday_name,
        });
      }

      await connection.commit();

      res.status(201).json({
        message: "Holidays added successfully",
        holidays: insertedHolidays,
      });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    next(error);
  }
});

/**
 * POST /calendars/:id/weekly-offs
 * Add weekly offs to a calendar
 * Body: { weekly_offs: [{ day_of_week, is_override? }] }
 */
router.post("/:id/weekly-offs", async (req, res, next) => {
  const { id } = req.params;
  const { weekly_offs } = req.body;

  try {
    if (
      !weekly_offs ||
      !Array.isArray(weekly_offs) ||
      weekly_offs.length === 0
    ) {
      throw new ApiError(
        "weekly_offs array is required and must not be empty",
        400
      );
    }

    // Check if calendar exists
    const [[calendar]] = await pool.query(
      "SELECT id FROM attendance_calendars WHERE id = ?",
      [id]
    );

    if (!calendar) {
      throw new ApiError("Calendar not found", 404);
    }

    // Insert weekly offs
    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      const insertedWeeklyOffs = [];

      for (const wo of weekly_offs) {
        if (
          wo.day_of_week === undefined ||
          wo.day_of_week < 1 ||
          wo.day_of_week > 7
        ) {
          throw new ApiError(
            "Each weekly off must have day_of_week between 1 (Monday) and 7 (Sunday)",
            400
          );
        }

        await connection.query(
          `INSERT INTO attendance_calendar_weekly_offs (
            calendar_id, day_of_week, is_override
          ) VALUES (?, ?, ?)
          ON DUPLICATE KEY UPDATE
            is_override = VALUES(is_override),
            updated_at = NOW()`,
          [id, wo.day_of_week, (wo.is_override || "N").toUpperCase()]
        );

        insertedWeeklyOffs.push({
          day_of_week: wo.day_of_week,
        });
      }

      await connection.commit();

      res.status(201).json({
        message: "Weekly offs added successfully",
        weekly_offs: insertedWeeklyOffs,
      });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /calendars/:id
 * Update a calendar
 */
router.patch("/:id", async (req, res, next) => {
  const { id } = req.params;
  const { calendar_name, description, is_active } = req.body;

  try {
    // Check if calendar exists
    const [[existing]] = await pool.query(
      "SELECT id FROM attendance_calendars WHERE id = ?",
      [id]
    );

    if (!existing) {
      throw new ApiError("Calendar not found", 404);
    }

    const updates = [];
    const params = [];

    if (calendar_name !== undefined) {
      updates.push("calendar_name = ?");
      params.push(calendar_name);
    }

    if (description !== undefined) {
      updates.push("description = ?");
      params.push(description || null);
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

    params.push(id);

    await pool.query(
      `UPDATE attendance_calendars SET ${updates.join(
        ", "
      )}, updated_at = NOW() WHERE id = ?`,
      params
    );

    // Fetch updated calendar
    const [[updatedCalendar]] = await pool.query(
      `SELECT 
        id,
        calendar_name,
        calendar_type,
        location_id,
        department_id,
        empid,
        year,
        is_active,
        description,
        created_by,
        created_at,
        updated_at
      FROM attendance_calendars
      WHERE id = ?`,
      [id]
    );

    res.json({
      message: "Calendar updated successfully",
      calendar: updatedCalendar,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /calendars/:id
 * Delete a calendar (cascades to holidays, weekly offs, and date overrides)
 */
router.delete("/:id", async (req, res, next) => {
  const { id } = req.params;

  try {
    // Check if calendar exists
    const [[existing]] = await pool.query(
      "SELECT id FROM attendance_calendars WHERE id = ?",
      [id]
    );

    if (!existing) {
      throw new ApiError("Calendar not found", 404);
    }

    await pool.query("DELETE FROM attendance_calendars WHERE id = ?", [id]);

    res.json({ message: "Calendar deleted successfully" });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
