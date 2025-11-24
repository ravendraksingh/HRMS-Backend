// routes/attendance/attendance-calendar.js
// Attendance Calendar API - Generate comprehensive monthly attendance calendar for an employee
// Combines calendar (working days, holidays, weekly offs), attendance records, and leaves
const express = require("express");
const router = express.Router();
const pool = require("../../db");
const ApiError = require("../../util/ApiError");
const { getMonthlyCalendar } = require("../../util/calendarUtil");

/**
 * GET /attendance-calendar
 * Generate comprehensive attendance calendar for an employee for a given month and year
 * Query params: empid (required), month (required, 1-12), year (required)
 * Returns: Monthly calendar combining:
 *   - Calendar data (working days, holidays, weekly offs, date overrides)
 *   - Attendance records for each day
 *   - Leave records for each day
 */
router.get("/", async (req, res, next) => {
  const { empid, month, year } = req.query;

  try {
    // Validation
    if (!empid || !month || !year) {
      throw new ApiError("empid, month, and year query parameters are required", 400);
    }

    const monthNum = parseInt(month);
    const yearNum = parseInt(year);

    // Validate month range
    if (isNaN(monthNum) || monthNum < 1 || monthNum > 12) {
      throw new ApiError("month must be a number between 1 and 12", 400);
    }

    // Validate year
    if (isNaN(yearNum) || yearNum < 2000 || yearNum > 2100) {
      throw new ApiError("year must be a valid year (2000-2100)", 400);
    }

    // Validate employee exists
    const [[employee]] = await pool.query(
      "SELECT empid, name FROM employees WHERE empid = ?",
      [empid]
    );

    if (!employee) {
      throw new ApiError("Employee not found", 404);
    }

    // Calculate date range for the month
    const startDateStr = `${yearNum}-${String(monthNum).padStart(2, "0")}-01`;
    const lastDay = new Date(yearNum, monthNum, 0).getDate();
    const endDateStr = `${yearNum}-${String(monthNum).padStart(2, "0")}-${String(
      lastDay
    ).padStart(2, "0")}`;

    // 1. Get monthly calendar (working days, holidays, weekly offs)
    const calendar = await getMonthlyCalendar(empid, yearNum, monthNum);

    // 2. Get attendance records for the month
    const [attendanceRecords] = await pool.query(
      `SELECT 
        ar.id,
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
      WHERE ar.empid = ? 
        AND ar.attendance_date >= ? 
        AND ar.attendance_date <= ?
      ORDER BY ar.attendance_date ASC`,
      [empid, startDateStr, endDateStr]
    );

    // 3. Get leaves for the month (leaves that overlap with the month)
    const [leaves] = await pool.query(
      `SELECT 
        l.id,
        l.leavetype_id,
        DATE_FORMAT(l.start_date, '%Y-%m-%d') as start_date,
        DATE_FORMAT(l.end_date, '%Y-%m-%d') as end_date,
        l.total_days,
        l.reason,
        l.status,
        l.approved_by,
        DATE_FORMAT(l.approved_at, '%Y-%m-%d %H:%i:%s') as approved_at,
        l.rejection_reason,
        lt.name as leave_type_name
      FROM leaves l
      LEFT JOIN leave_types lt ON l.leavetype_id = lt.leavetype_id
      WHERE l.empid = ?
        AND l.start_date <= ?
        AND l.end_date >= ?
      ORDER BY l.start_date ASC`,
      [empid, endDateStr, startDateStr]
    );

    // Create maps for quick lookup
    const attendanceMap = new Map();
    attendanceRecords.forEach((record) => {
      attendanceMap.set(record.attendance_date, record);
    });

    // Create a map of leaves by date (a leave can span multiple days)
    const leavesMap = new Map();
    leaves.forEach((leave) => {
      const startDate = new Date(leave.start_date);
      const endDate = new Date(leave.end_date);
      const currentDate = new Date(startDate);

      while (currentDate <= endDate) {
        const dateStr = currentDate.toISOString().split("T")[0];
        // Only include dates within the requested month
        if (dateStr >= startDateStr && dateStr <= endDateStr) {
          if (!leavesMap.has(dateStr)) {
            leavesMap.set(dateStr, []);
          }
          leavesMap.get(dateStr).push({
            id: leave.id,
            leavetype_id: leave.leavetype_id,
            leave_type_name: leave.leave_type_name,
            start_date: leave.start_date,
            end_date: leave.end_date,
            total_days: leave.total_days,
            reason: leave.reason,
            status: leave.status,
            approved_by: leave.approved_by,
            approved_at: leave.approved_at,
            rejection_reason: leave.rejection_reason,
          });
        }
        currentDate.setDate(currentDate.getDate() + 1);
      }
    });

    // Combine calendar, attendance, and leave data for each day
    const comprehensiveCalendar = calendar.calendar.map((day) => {
      const dateStr = day.date;
      const attendance = attendanceMap.get(dateStr) || null;
      const dayLeaves = leavesMap.get(dateStr) || [];

      return {
        date: dateStr,
        // Calendar information
        is_working_day: day.is_working_day,
        calendar_reason: day.reason,
        calendar_type: day.type,
        // Attendance information
        attendance: attendance
          ? {
              id: attendance.id,
              shiftid: attendance.shiftid,
              check_in_time: attendance.check_in_time,
              check_out_time: attendance.check_out_time,
              break_start_time: attendance.break_start_time,
              break_end_time: attendance.break_end_time,
              total_work_hours: attendance.total_work_hours,
              status: attendance.status,
              is_late: attendance.is_late,
              is_early_leave: attendance.is_early_leave,
              late_minutes: attendance.late_minutes,
              early_leave_minutes: attendance.early_leave_minutes,
              remarks: attendance.remarks,
            }
          : null,
        // Leave information
        leaves: dayLeaves,
        // Combined status
        day_status: attendance
          ? attendance.status
          : dayLeaves.length > 0
          ? dayLeaves[0].status === "APPROVED"
            ? "ON_LEAVE"
            : dayLeaves[0].status === "PENDING"
            ? "LEAVE_PENDING"
            : null
          : day.is_working_day
          ? "EXPECTED"
          : "NON_WORKING",
      };
    });

    // Calculate comprehensive summary
    const summary = {
      ...calendar.summary,
      attendance: {
        present: comprehensiveCalendar.filter(
          (d) => d.attendance && d.attendance.status === "PRESENT"
        ).length,
        absent: comprehensiveCalendar.filter(
          (d) => d.attendance && d.attendance.status === "ABSENT"
        ).length,
        late_arrivals: comprehensiveCalendar.filter(
          (d) => d.attendance && d.attendance.is_late === "Y"
        ).length,
        early_departures: comprehensiveCalendar.filter(
          (d) => d.attendance && d.attendance.is_early_leave === "Y"
        ).length,
        total_work_hours: comprehensiveCalendar.reduce(
          (sum, d) => sum + (parseFloat(d.attendance?.total_work_hours) || 0),
          0
        ),
      },
      leaves: {
        approved: comprehensiveCalendar.filter(
          (d) => d.leaves.some((l) => l.status === "APPROVED")
        ).length,
        pending: comprehensiveCalendar.filter(
          (d) => d.leaves.some((l) => l.status === "PENDING")
        ).length,
        rejected: comprehensiveCalendar.filter(
          (d) => d.leaves.some((l) => l.status === "REJECTED")
        ).length,
      },
    };

    res.json({
      message: "Attendance calendar generated successfully",
      empid: empid,
      employee_name: employee.name,
      year: yearNum,
      month: monthNum,
      calendar: comprehensiveCalendar,
      summary: summary,
      source_calendars: calendar.source_calendars,
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
