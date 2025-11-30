// routes/employees/holidays.js
// Employee Holidays APIs
const express = require("express");
const router = express.Router();
const pool = require("../../db");
const ApiError = require("../../errors/ApiError");
const Holiday = require("../../models/Holiday");
const { resolveEmployeeCalendar } = require("../../util/calendarUtil");
const { empidParamValidator } = require("../../validations/employeeSchemas");
const { handleValidationErrors } = require("../../util/validation");
const { query } = require("express-validator");

/**
 * GET /employees/:empid/holidays
 * Get holidays applicable to an employee
 * Query params: financial_year (optional, format: YYYY-YY, e.g., 2025-26)
 *              If not provided, defaults to financial_year from organization table
 * Returns: List of holidays resolved from employee, department, location, and organization calendars
 *          Employee level overrides location level, location level overrides organization level
 */
router.get("/:empid/holidays", async (req, res, next) => {
  const { empid } = req.params;
  const { financial_year } = req.query;

  try {
    // Validate employee exists
    const [[employee]] = await pool.query(
      "SELECT empid FROM employees WHERE empid = ?",
      [empid]
    );

    if (!employee) {
      throw new ApiError("Employee not found", 404);
    }

    // Determine financial_year to use
    let financialYearToUse = financial_year;

    // If not provided, fetch from organization table
    if (!financialYearToUse) {
      const [[organization]] = await pool.query(
        "SELECT financial_year FROM organization LIMIT 1"
      );
      financialYearToUse = organization.financial_year;
    }

    // Validate financial_year format (YYYY-YY)
    const financialYearRegex = /^\d{4}-\d{2}$/;
    if (!financialYearRegex.test(financialYearToUse)) {
      throw new ApiError(
        "financial_year must be in format YYYY-YY (e.g., 2025-26)",
        400
      );
    }

    // Resolve employee calendar (this handles the hierarchy: employee -> department -> location -> organization)
    const calendar = await resolveEmployeeCalendar(empid, financialYearToUse);

    // Get holidays from resolved calendar
    let holidays = calendar.holidays || [];

    // Extract start year from financial_year (e.g., "2025-26" -> 2025) for filtering
    const startYear = parseInt(financialYearToUse.split("-")[0]);
    const endYear = startYear + 1;

    // Filter holidays that fall within the financial year range
    holidays = holidays.filter((holiday) => {
      const holidayYear = new Date(
        holiday.holiday_date + "T00:00:00"
      ).getFullYear();
      // Financial year spans from startYear to endYear
      return holidayYear === startYear || holidayYear === endYear;
    });

    // Convert to Holiday model instances for consistent formatting
    const holidayInstances = holidays.map((h) => {
      return Holiday.fromDatabaseRow({
        id: h.id,
        name: h.holiday_name || h.name,
        holiday_date: h.holiday_date,
        is_optional: h.is_optional,
        is_override: h.is_override,
        description: h.description,
        calendar_id: h.calendar_id || null,
      });
    });

    res.json({
      empid,
      financial_year: financialYearToUse,
      count: holidayInstances.length,
      holidays: holidayInstances.map((holiday) => holiday.toJSON()),
      source_calendars: calendar.source_calendars || [],
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
