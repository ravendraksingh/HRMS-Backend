// routes/calendar/calendars.js
// Calendar Management APIs (Workday-style hierarchical calendar system)
// Supports ORGANIZATION, LOCATION, DEPARTMENT, EMPLOYEE calendars (single org system - no orgid required)
const express = require("express");
const router = express.Router();
const pool = require("../../db");
const ApiError = require("../../errors/ApiError");
const {
  getMonthlyCalendarForLevel,
  getCalendarForLevel,
  getFinancialYear,
} = require("../../util/calendarUtil");

/**
 * GET /calendars/monthly/organization
 * Get monthly calendar view for organization
 * Query params: month (required, YYYY-MM format, e.g., 2024-12)
 */
router.get("/monthly/organization", async (req, res, next) => {
  const { month } = req.query;

  try {
    if (!month) {
      throw new ApiError(
        "month query parameter is required (format: YYYY-MM)",
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

    // Convert year and month to financial year (YYYY-YY format)
    // Use the first day of the month to determine financial year
    const dateForFinancialYear = `${year}-${String(monthNum).padStart(2, "0")}-01`;
    const financialYear = getFinancialYear(dateForFinancialYear);

    const calendar = await getCalendarForLevel(
      "ORGANIZATION",
      financialYear,
      null,
      null,
      null
    );

    if (!calendar) {
      throw new ApiError(
        `Organization calendar not found for financial year ${financialYear}`,
        404
      );
    }

    const monthlyCalendar = getMonthlyCalendarForLevel(
      calendar,
      year,
      monthNum
    );

    res.json({
      message: "Organization monthly calendar retrieved successfully",
      month: month,
      year: year,
      month_number: monthNum,
      calendar_name: calendar.calendar_name,
      ...monthlyCalendar,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /calendars/monthly/location/:location_id
 * Get monthly calendar view for a location
 * Query params: month (required, YYYY-MM format, e.g., 2024-12)
 */
router.get("/monthly/location/:location_id", async (req, res, next) => {
  const { location_id } = req.params;
  const { month } = req.query;

  try {
    if (!month) {
      throw new ApiError(
        "month query parameter is required (format: YYYY-MM)",
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

    // Convert year and month to financial year (YYYY-YY format)
    // Use the first day of the month to determine financial year
    const dateForFinancialYear = `${year}-${String(monthNum).padStart(2, "0")}-01`;
    const financialYear = getFinancialYear(dateForFinancialYear);

    const calendar = await getCalendarForLevel(
      "LOCATION",
      financialYear,
      parseInt(location_id),
      null,
      null
    );

    if (!calendar) {
      throw new ApiError(
        `Location calendar not found for location_id ${location_id} and financial year ${financialYear}`,
        404
      );
    }

    const monthlyCalendar = getMonthlyCalendarForLevel(
      calendar,
      year,
      monthNum
    );

    res.json({
      message: "Location monthly calendar retrieved successfully",
      location_id: parseInt(location_id),
      month: month,
      year: year,
      month_number: monthNum,
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
 * Query params: month (required, YYYY-MM format, e.g., 2024-12)
 */
router.get("/monthly/department/:department_id", async (req, res, next) => {
  const { department_id } = req.params;
  const { month } = req.query;

  try {
    if (!month) {
      throw new ApiError(
        "month query parameter is required (format: YYYY-MM)",
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

    // Convert year and month to financial year (YYYY-YY format)
    // Use the first day of the month to determine financial year
    const dateForFinancialYear = `${year}-${String(monthNum).padStart(2, "0")}-01`;
    const financialYear = getFinancialYear(dateForFinancialYear);

    const calendar = await getCalendarForLevel(
      "DEPARTMENT",
      financialYear,
      null,
      department_id,
      null
    );

    if (!calendar) {
      throw new ApiError(
        `Department calendar not found for department_id ${department_id} and financial year ${financialYear}`,
        404
      );
    }

    const monthlyCalendar = getMonthlyCalendarForLevel(
      calendar,
      year,
      monthNum
    );

    res.json({
      message: "Department monthly calendar retrieved successfully",
      department_id,
      month: month,
      year: year,
      month_number: monthNum,
      calendar_name: calendar.calendar_name,
      ...monthlyCalendar,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /calendars
 * Get calendars by level
 * Query params: calendar_type (ORGANIZATION, LOCATION, DEPARTMENT, EMPLOYEE),
 *               financial_year, location_id, department_id, empid
 */
router.get("/", async (req, res, next) => {
  const { calendar_type, financial_year, location_id, department_id, empid } =
    req.query;

  try {
    if (!calendar_type || !financial_year) {
      throw new ApiError(
        "calendar_type and financial_year query parameters are required",
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

    let whereClause = "calendar_type = ? AND is_active = 'Y'";
    const params = [calendar_type];

    if (financial_year) {
      whereClause += " AND financial_year = ?";
      params.push(financial_year);
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
        financial_year,
        is_active,
        description,
        created_by,
        created_at,
        updated_at
      FROM attendance_calendars
      WHERE ${whereClause}
      ORDER BY financial_year DESC, calendar_name ASC`,
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
        financial_year,
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
