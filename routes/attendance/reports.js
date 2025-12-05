const express = require("express");
const router = express.Router();
const pool = require("../../db");
const ApiError = require("../../errors/ApiError");

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

    res.json({
      attendance_date: attendance_date,
      count: rows.length,
      attendance: rows,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /attendance/monthly
 * DEPRECATED: This route has been moved to GET /employees/:empid/attendance/monthly
 * Use the employee-specific route instead for better RESTful design
 */

module.exports = router;
