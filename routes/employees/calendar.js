// routes/employees/calendar.js
// Employee Calendar APIs
// All employee-specific calendar queries (moved from /calendars/ namespace)
const express = require("express");
const router = express.Router();
const pool = require("../../db");
const ApiError = require("../../errors/ApiError");
const { SELECT_EMPLOYEE_EXISTS } = require("../../queries/employees");
const {
  resolveEmployeeCalendar,
  getMonthlyCalendar,
  isWorkingDay,
  getWorkingDays,
} = require("../../util/calendarUtil");
const { empidParamValidator } = require("../../validations/employeeSchemas");
const { handleValidationErrors } = require("../../util/validation");
const { query } = require("express-validator");

/**
 * GET /employees/:empid/calendar/resolve
 * Resolve calendar for an employee (shows inheritance hierarchy)
 * Query params: financial_year (optional, format: YYYY-YY, e.g., 2025-26)
 *              If not provided, defaults to financial_year from organization table
 */
router.get(
  "/:empid/calendar/resolve",
  [empidParamValidator],
  handleValidationErrors,
  async (req, res, next) => {
    const { empid } = req.params;
    const { financial_year } = req.query;

    let financialYearToUse = financial_year;
    if (!financialYearToUse) {
      const [[organization]] = await pool.query(
        "SELECT financial_year FROM organization LIMIT 1"
      );
      financialYearToUse = organization.financial_year;
    }

    const financialYearRegex = /^\d{4}-\d{2}$/;
    if (!financialYearRegex.test(financialYearToUse)) {
      throw new ApiError(
        "financial_year must be in format YYYY-YY (e.g., 2025-26)",
        400
      );
    }

    try {
      // Validate employee exists
      const [[employee]] = await pool.query(
        SELECT_EMPLOYEE_EXISTS,
        [empid]
      );

      if (!employee) {
        throw new ApiError("Employee not found", 404);
      }

      const calendar = await resolveEmployeeCalendar(empid, financialYearToUse);

      res.json({
        message: "Calendar resolved successfully",
        empid,
        financial_year: financialYearToUse,
        calendar,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /employees/:empid/calendar/monthly
 * Get monthly calendar view for an employee
 * Query params: month (required, YYYY-MM format, e.g., 2024-12)
 */
router.get(
  "/:empid/calendar/monthly",
  [
    empidParamValidator,
    query("month")
      .notEmpty()
      .withMessage("month query parameter is required (format: YYYY-MM)")
      .matches(/^\d{4}-\d{2}$/)
      .withMessage("month must be in format YYYY-MM (e.g., 2024-12)"),
  ],
  handleValidationErrors,
  async (req, res, next) => {
    const { empid } = req.params;
    const { month } = req.query;

    try {
      // Validate employee exists
      const [[employee]] = await pool.query(
        SELECT_EMPLOYEE_EXISTS,
        [empid]
      );

      if (!employee) {
        throw new ApiError("Employee not found", 404);
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

      const calendar = await getMonthlyCalendar(empid, year, monthNum);

      res.json({
        message: "Monthly calendar retrieved successfully",
        empid,
        month: month,
        year: year,
        month_number: monthNum,
        ...calendar,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /employees/:empid/calendar/working-day
 * Check if a specific date is a working day for an employee
 * Query params: date (required, YYYY-MM-DD)
 */
router.get(
  "/:empid/calendar/working-day",
  [
    empidParamValidator,
    query("date")
      .notEmpty()
      .withMessage("date query parameter is required (YYYY-MM-DD)")
      .matches(/^\d{4}-\d{2}-\d{2}$/)
      .withMessage("date must be in format YYYY-MM-DD"),
  ],
  handleValidationErrors,
  async (req, res, next) => {
    const { empid } = req.params;
    const { date } = req.query;

    try {
      // Validate employee exists
      const [[employee]] = await pool.query(
        SELECT_EMPLOYEE_EXISTS,
        [empid]
      );

      if (!employee) {
        throw new ApiError("Employee not found", 404);
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
  }
);

/**
 * GET /employees/:empid/calendar/working-days
 * Get working days for a date range
 * Query params: start_date (required, YYYY-MM-DD), end_date (required, YYYY-MM-DD)
 */
router.get(
  "/:empid/calendar/working-days",
  [
    empidParamValidator,
    query("start_date")
      .notEmpty()
      .withMessage("start_date query parameter is required (YYYY-MM-DD)")
      .matches(/^\d{4}-\d{2}-\d{2}$/)
      .withMessage("start_date must be in format YYYY-MM-DD"),
    query("end_date")
      .notEmpty()
      .withMessage("end_date query parameter is required (YYYY-MM-DD)")
      .matches(/^\d{4}-\d{2}-\d{2}$/)
      .withMessage("end_date must be in format YYYY-MM-DD"),
  ],
  handleValidationErrors,
  async (req, res, next) => {
    const { empid } = req.params;
    const { start_date, end_date } = req.query;

    try {
      // Validate employee exists
      const [[employee]] = await pool.query(
        SELECT_EMPLOYEE_EXISTS,
        [empid]
      );

      if (!employee) {
        throw new ApiError("Employee not found", 404);
      }

      // Validate date range
      const startDate = new Date(start_date + "T00:00:00");
      const endDate = new Date(end_date + "T00:00:00");

      if (endDate < startDate) {
        throw new ApiError("end_date cannot be less than start_date", 400);
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
  }
);

module.exports = router;

