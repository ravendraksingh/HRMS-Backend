const express = require("express");
const router = express.Router();
const pool = require("../../db");
const ApiError = require("../../util/ApiError");
const Attendance = require("../../models/Attendance");

/**
 * GET /attendance/daily
 * Get daily attendance report for a specific date
 * Query params: work_date or date (YYYY-MM-DD)
 */
router.get("/attendance/daily", async (req, res, next) => {
  const { attendance_date } = req.query;

  try {
    if (!attendance_date) {
      throw new ApiError("attendance_date query parameter is required", 400);
    }

    const [rows] = await pool.query(
      `SELECT 
        ar.id,
        ar.empid,
        DATE_FORMAT(ar.attendance_date, '%Y-%m-%d') as attendance_date,
        ar.shiftid,
        DATE_FORMAT(ar.check_in_time, '%Y-%m-%d %H:%i:%s') as check_in_time,
        DATE_FORMAT(ar.check_out_time, '%Y-%m-%d %H:%i:%s') as check_out_time,
        DATE_FORMAT(ar.break_start_time, '%Y-%m-%d %H:%i:%s') as break_start_time,
        DATE_FORMAT(ar.break_end_time, '%Y-%m-%d %H:%i:%s') as break_end_time,
        ar.total_work_hours,
        ar.status,
        ar.is_late,
        ar.is_early_leave,
        ar.late_minutes,
        ar.early_leave_minutes,
        ar.remarks
      FROM attendance_records ar
      WHERE ar.attendance_date = ?
      ORDER BY ar.empid ASC`,
      [attendance_date]
    );

    // Convert database rows to Attendance class instances
    const attendanceRecords = Attendance.fromDatabaseRows(rows);

    res.json({
      attendance_date: attendance_date,
      count: attendanceRecords.length,
      attendance: attendanceRecords.map((att) => att.toJSON()),
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /attendance/monthly
 * Get monthly attendance report with aggregated statistics
 * Query params: month (YYYY-MM), empid (required)
 * Returns: Aggregated statistics for the month
 */
router.get("/attendance/monthly", async (req, res, next) => {
  const { month, empid } = req.query; // month: YYYY-MM
  try {
    if (!month || !empid) {
      throw new ApiError(
        "month and empid query parameters are required (format: YYYY-MM and empid)",
        400
      );
    }

    // Parse month to get year and month for calculations
    const [year, monthNum] = month.split("-").map(Number);
    if (!year || !monthNum || monthNum < 1 || monthNum > 12) {
      throw new ApiError("Invalid month format. Use YYYY-MM", 400);
    }

    // Calculate total days in the month
    const totalDays = new Date(year, monthNum, 0).getDate();

    // Build WHERE clause
    const whereClause = `DATE_FORMAT(ar.attendance_date, '%Y-%m') = ? AND ar.empid = ?`;
    const params = [month, empid];

    // Query to get aggregated statistics
    const statsQuery = `
      SELECT 
        COUNT(*) as total_days,
        COUNT(CASE WHEN ar.status = 'PRESENT' OR ar.status LIKE '%PRESENT%' THEN 1 END) as present_days,
        COUNT(CASE WHEN ar.status = 'ABSENT' THEN 1 END) as absent_days,
        COUNT(CASE WHEN ar.is_late = 'Y' THEN 1 END) as late_arrivals,
        COUNT(CASE WHEN ar.is_early_leave = 'Y' THEN 1 END) as early_departures,
        COALESCE(SUM(ar.total_work_hours), 0) as total_working_hours,
        COALESCE(SUM(
          CASE 
            WHEN ar.break_start_time IS NOT NULL AND ar.break_end_time IS NOT NULL 
            THEN TIMESTAMPDIFF(MINUTE, ar.break_start_time, ar.break_end_time) / 60.0
            ELSE 0 
          END
        ), 0) as total_break_hours
      FROM attendance_records ar
      WHERE ${whereClause}
    `;

    const [statsRows] = await pool.query(statsQuery, params);
    const stats = statsRows[0] || {};

    // Get overtime hours for the month
    const overtimeQuery = `
      SELECT COALESCE(SUM(total_hours), 0) as overtime_hours
      FROM attendance_overtime
      WHERE DATE_FORMAT(overtime_date, '%Y-%m') = ? 
        AND empid = ?
        AND status = 'APPROVED'
    `;

    const [overtimeRows] = await pool.query(overtimeQuery, params);
    const overtimeHours = overtimeRows[0]?.overtime_hours || 0;

    // Calculate percentages
    const presentDays = stats.present_days || 0;
    const lateArrivals = stats.late_arrivals || 0;
    const onTimeDays = presentDays - lateArrivals;

    const onTimePercentage =
      presentDays > 0 ? ((onTimeDays / presentDays) * 100).toFixed(2) : 0;

    const latePercentage =
      presentDays > 0 ? ((lateArrivals / presentDays) * 100).toFixed(2) : 0;

    // Calculate absent days (total days in month - present days)
    const absentDays = totalDays - presentDays;

    // Format response
    const response = {
      on_time_percentage: parseFloat(onTimePercentage) || 0,
      late_percentage: parseFloat(latePercentage) || 0,
      total_break_hours: parseFloat(stats.total_break_hours || 0),
      total_working_hours: parseFloat(stats.total_working_hours || 0),
      total_days: totalDays,
      present_days: presentDays,
      absent_days: absentDays > 0 ? absentDays : 0,
      late_arrivals: lateArrivals,
      early_departures: stats.early_departures || 0,
      overtime_hours: parseFloat(overtimeHours),
    };

    res.json(response);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
