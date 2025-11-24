// routes/attendance.js
const express = require("express");
const router = express.Router();
const pool = require("../../db");
const ApiError = require("../../util/ApiError");
const Attendance = require("../../models/Attendance");
const { calculateAttendanceStatus } = require("../../util/attendanceUtil");
const { isWorkingDay } = require("../../util/calendarUtil");

/**
 * Calculate total work hours from check-in, check-out, and break times
 * @param {string|Date} checkInTime - Check-in timestamp
 * @param {string|Date} checkOutTime - Check-out timestamp
 * @param {string|Date|null} breakStartTime - Break start timestamp (optional)
 * @param {string|Date|null} breakEndTime - Break end timestamp (optional)
 * @returns {number|null} Total work hours in decimal format, or null if calculation not possible
 */
function calculateTotalWorkHours(
  checkInTime,
  checkOutTime,
  breakStartTime = null,
  breakEndTime = null
) {
  if (!checkInTime || !checkOutTime) {
    return null;
  }

  const checkIn = new Date(checkInTime);
  const checkOut = new Date(checkOutTime);

  if (isNaN(checkIn.getTime()) || isNaN(checkOut.getTime())) {
    return null;
  }

  // Calculate total time difference in milliseconds
  const totalTimeMs = checkOut - checkIn;

  // Calculate break time if both break start and end are provided
  let breakTimeMs = 0;
  if (breakStartTime && breakEndTime) {
    const breakStart = new Date(breakStartTime);
    const breakEnd = new Date(breakEndTime);
    if (!isNaN(breakStart.getTime()) && !isNaN(breakEnd.getTime())) {
      breakTimeMs = breakEnd - breakStart;
      if (breakTimeMs < 0) {
        breakTimeMs = 0; // Invalid break time
      }
    }
  }

  // Calculate work hours: (check_out - check_in) - break_time
  const workTimeMs = totalTimeMs - breakTimeMs;
  if (workTimeMs < 0) {
    return 0; // Invalid time calculation
  }

  // Convert milliseconds to hours (with 2 decimal places)
  const workHours = workTimeMs / (1000 * 60 * 60);
  return Math.round(workHours * 100) / 100; // Round to 2 decimal places
}

router.post("/clockin", async (req, res, next) => {
  const { empid, attendance_date, check_in_time, shiftid = null } = req.body;

  try {
    if (!empid || !attendance_date || !check_in_time) {
      throw new ApiError(
        "empid, attendance_date, and check_in_time are required",
        400
      );
    }

    // Check if it's a working day (optional check - can be configured to allow/disallow)
    try {
      const workingDayStatus = await isWorkingDay(empid, attendance_date);
      if (!workingDayStatus.is_working_day && workingDayStatus.type !== "OPTIONAL_HOLIDAY") {
        // Allow clock-in but mark as non-working day
        // You can change this to throw an error if you want to prevent clock-in on non-working days
        console.log(
          `Warning: Employee ${empid} clocking in on non-working day: ${workingDayStatus.reason}`
        );
      }
    } catch (calendarError) {
      // If calendar check fails, continue with clock-in (graceful degradation)
      console.error("Calendar check failed:", calendarError);
    }

    // Calculate late status
    const attendanceStatus = await calculateAttendanceStatus(
      empid,
      attendance_date,
      check_in_time,
      null, // check_out_time
      shiftid
    );

    // Check if attendance record already exists for this date
    const [[existing]] = await pool.query(
      "SELECT id, check_out_time FROM attendance_records WHERE empid = ? AND attendance_date = ?",
      [empid, attendance_date]
    );

    if (existing) {
      // If check_out_time exists, recalculate early leave status as well
      let finalStatus = attendanceStatus;
      if (existing.check_out_time) {
        finalStatus = await calculateAttendanceStatus(
          empid,
          attendance_date,
          check_in_time,
          existing.check_out_time,
          shiftid
        );
      }

      // Update existing record with late status
      await pool.query(
        "UPDATE attendance_records SET check_in_time = ?, shiftid = ?, is_late = ?, late_minutes = ?, is_early_leave = ?, early_leave_minutes = ?, updated_at = NOW() WHERE id = ?",
        [
          check_in_time,
          shiftid,
          finalStatus.is_late,
          finalStatus.late_minutes,
          finalStatus.is_early_leave,
          finalStatus.early_leave_minutes,
          existing.id,
        ]
      );
      res.status(200).json({
        message: "Check-in updated successfully",
        id: existing.id,
        is_late: finalStatus.is_late,
        late_minutes: finalStatus.late_minutes,
      });
    } else {
      // Create new record with late status
      const [result] = await pool.query(
        "INSERT INTO attendance_records (empid, attendance_date, check_in_time, shiftid, status, is_late, late_minutes) VALUES (?, ?, ?, ?, 'PRESENT', ?, ?)",
        [
          empid,
          attendance_date,
          check_in_time,
          shiftid,
          attendanceStatus.is_late,
          attendanceStatus.late_minutes,
        ]
      );
      res.status(201).json({
        message: "Check-in recorded successfully",
        id: result.insertId,
        is_late: attendanceStatus.is_late,
        late_minutes: attendanceStatus.late_minutes,
      });
    }
  } catch (error) {
    next(error);
  }
});

router.post("/clockout", async (req, res, next) => {
  const { empid, attendance_date, check_out_time } = req.body;

  try {
    if (!empid || !attendance_date || !check_out_time) {
      throw new ApiError(
        "empid, attendance_date, and check_out_time are required",
        400
      );
    }

    // Get existing record to calculate total_work_hours and get shiftid
    const [existingRecords] = await pool.query(
      "SELECT check_in_time, break_start_time, break_end_time, shiftid FROM attendance_records WHERE empid = ? AND attendance_date = ?",
      [empid, attendance_date]
    );

    if (existingRecords.length === 0) {
      throw new ApiError("No attendance record found for the date", 404);
    }

    const existing = existingRecords[0];

    // Calculate total_work_hours if check_in_time exists
    let totalWorkHours = null;
    if (existing.check_in_time) {
      totalWorkHours = calculateTotalWorkHours(
        existing.check_in_time,
        check_out_time,
        existing.break_start_time,
        existing.break_end_time
      );
    }

    // Calculate attendance status (both late and early leave)
    const attendanceStatus = await calculateAttendanceStatus(
      empid,
      attendance_date,
      existing.check_in_time,
      check_out_time,
      existing.shiftid
    );

    // Update with check_out_time, calculated total_work_hours, and early leave status
    const updateQuery =
      totalWorkHours !== null
        ? "UPDATE attendance_records SET check_out_time = ?, total_work_hours = ?, is_late = ?, late_minutes = ?, is_early_leave = ?, early_leave_minutes = ?, updated_at = NOW() WHERE empid = ? AND attendance_date = ?"
        : "UPDATE attendance_records SET check_out_time = ?, is_late = ?, late_minutes = ?, is_early_leave = ?, early_leave_minutes = ?, updated_at = NOW() WHERE empid = ? AND attendance_date = ?";

    const updateParams =
      totalWorkHours !== null
        ? [
            check_out_time,
            totalWorkHours,
            attendanceStatus.is_late,
            attendanceStatus.late_minutes,
            attendanceStatus.is_early_leave,
            attendanceStatus.early_leave_minutes,
            empid,
            attendance_date,
          ]
        : [
            check_out_time,
            attendanceStatus.is_late,
            attendanceStatus.late_minutes,
            attendanceStatus.is_early_leave,
            attendanceStatus.early_leave_minutes,
            empid,
            attendance_date,
          ];

    const [result] = await pool.query(updateQuery, updateParams);

    res.status(200).json({
      message: "Check-out recorded successfully",
      total_work_hours: totalWorkHours,
      is_early_leave: attendanceStatus.is_early_leave,
      early_leave_minutes: attendanceStatus.early_leave_minutes,
      is_late: attendanceStatus.is_late,
      late_minutes: attendanceStatus.late_minutes,
    });
  } catch (error) {
    next(error);
  }
});

router.get("/", async (req, res, next) => {
  const { attendance_date, empid, manager_id, status } = req.query;
  const queryDate = attendance_date;
  // Validate that empid and manager_id are not both provided
  if (empid && manager_id) {
    throw new ApiError(
      "Cannot use both empid and manager_id. Use one or the other.",
      400
    );
  }

  try {
    let whereClauses = [];
    let params = [];

    if (queryDate) {
      whereClauses.push("ar.attendance_date = ?");
      params.push(queryDate);
    }

    if (manager_id) {
      // Get all employees reporting to this manager
      const [teamMembers] = await pool.query(
        "SELECT empid FROM employees WHERE manager_id = ?",
        [manager_id]
      );

      if (teamMembers.length === 0) {
        return res.status(200).json({ attendance: [], count: 0 });
      }

      const teamMemberIds = teamMembers.map((e) => e.empid);
      whereClauses.push("ar.empid IN (?)");
      params.push(teamMemberIds);
    } else if (empid) {
      whereClauses.push("ar.empid = ?");
      params.push(empid);
    }

    if (status) {
      whereClauses.push("ar.status = ?");
      params.push(status);
    }

    // Combine WHERE clauses
    const whereSql = whereClauses.length
      ? `WHERE ${whereClauses.join(" AND ")}`
      : "";

    // Fetch attendance records (only from attendance_records table)
    const dataQuery = `
      SELECT 
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
      ${whereSql}
      ORDER BY ar.attendance_date DESC, ar.empid ASC
    `;
    const [items] = await pool.query(dataQuery, params);

    // Convert database rows to Attendance class instances
    const attendanceRecords = Attendance.fromDatabaseRows(items);

    res.status(200).json({
      count: attendanceRecords.length,
      attendance: attendanceRecords.map((att) => att.toJSON()),
    });
  } catch (error) {
    next(error);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const [[record]] = await pool.query(
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
      WHERE ar.id = ?`,
      [req.params.id]
    );

    if (!record) throw new ApiError("Attendance record not found", 404);

    // Convert database row to Attendance class instance
    const attendanceRecord = Attendance.fromDatabaseRow(record);
    res.json(attendanceRecord.toJSON());
  } catch (error) {
    next(error);
  }
});

router.patch("/:id", async (req, res, next) => {
  const {
    status,
    check_in_time,
    check_out_time,
    break_start_time,
    break_end_time,
    shiftid,
    total_work_hours,
    is_late,
    is_early_leave,
    late_minutes,
    early_leave_minutes,
    remarks,
  } = req.body;

  try {
    // Validate status if provided
    const validStatuses = [
      "PRESENT",
      "ABSENT",
      "HALF_DAY",
      "LATE",
      "EARLY_LEAVE",
    ];
    if (status && !validStatuses.includes(status)) {
      throw new ApiError(
        `Invalid status. Must be one of: ${validStatuses.join(", ")}`,
        400
      );
    }

    // Get existing record to calculate total_work_hours if needed
    const [[existingRecord]] = await pool.query(
      "SELECT check_in_time, check_out_time, break_start_time, break_end_time FROM attendance_records WHERE id = ?",
      [req.params.id]
    );

    if (!existingRecord) {
      throw new ApiError("Attendance record not found", 404);
    }

    // Use new values if provided, otherwise use existing values
    const finalCheckInTime =
      check_in_time !== undefined
        ? check_in_time
        : existingRecord.check_in_time;
    const finalCheckOutTime =
      check_out_time !== undefined
        ? check_out_time
        : existingRecord.check_out_time;
    const finalBreakStartTime =
      break_start_time !== undefined
        ? break_start_time
        : existingRecord.break_start_time;
    const finalBreakEndTime =
      break_end_time !== undefined
        ? break_end_time
        : existingRecord.break_end_time;

    // Calculate total_work_hours automatically if not explicitly provided
    // Only recalculate if check_in_time or check_out_time or break times are being updated
    let calculatedTotalWorkHours = null;
    if (
      total_work_hours === undefined &&
      (check_in_time !== undefined ||
        check_out_time !== undefined ||
        break_start_time !== undefined ||
        break_end_time !== undefined)
    ) {
      calculatedTotalWorkHours = calculateTotalWorkHours(
        finalCheckInTime,
        finalCheckOutTime,
        finalBreakStartTime,
        finalBreakEndTime
      );
    }

    const updates = [];
    const params = [];

    if (status !== undefined) {
      updates.push("status = ?");
      params.push(status);
    }
    if (check_in_time !== undefined) {
      updates.push("check_in_time = ?");
      params.push(check_in_time);
    }
    if (check_out_time !== undefined) {
      updates.push("check_out_time = ?");
      params.push(check_out_time);
    }
    if (break_start_time !== undefined) {
      updates.push("break_start_time = ?");
      params.push(break_start_time);
    }
    if (break_end_time !== undefined) {
      updates.push("break_end_time = ?");
      params.push(break_end_time);
    }
    if (shiftid !== undefined) {
      updates.push("shiftid = ?");
      params.push(shiftid);
    }
    // Use calculated value if available, otherwise use provided value
    if (calculatedTotalWorkHours !== null) {
      updates.push("total_work_hours = ?");
      params.push(calculatedTotalWorkHours);
    } else if (total_work_hours !== undefined) {
      updates.push("total_work_hours = ?");
      params.push(total_work_hours);
    }
    if (is_late !== undefined) {
      updates.push("is_late = ?");
      params.push(is_late);
    }
    if (is_early_leave !== undefined) {
      updates.push("is_early_leave = ?");
      params.push(is_early_leave);
    }
    if (late_minutes !== undefined) {
      updates.push("late_minutes = ?");
      params.push(late_minutes);
    }
    if (early_leave_minutes !== undefined) {
      updates.push("early_leave_minutes = ?");
      params.push(early_leave_minutes);
    }
    if (remarks !== undefined) {
      updates.push("remarks = ?");
      params.push(remarks);
    }

    if (updates.length === 0) {
      throw new ApiError("No fields to update", 400);
    }

    params.push(req.params.id);

    const [result] = await pool.query(
      `UPDATE attendance_records SET ${updates.join(
        ", "
      )}, updated_at = NOW() WHERE id = ?`,
      params
    );

    if (result.affectedRows === 0) {
      throw new ApiError("Attendance record not found", 404);
    }

    res.json({ updated: true });
  } catch (error) {
    next(error);
  }
});

// Note: Approval/rejection functionality has been moved to attendance_correction_requests table
// These endpoints are removed as per new schema

// Regularization request mapped to attendance_correction_requests
router.post("/:id/regularize", async (req, res, next) => {
  const {
    empid,
    correction_date,
    requested_check_in = null,
    requested_check_out = null,
    reason,
  } = req.body;

  try {
    if (!empid || !correction_date || !reason) {
      throw new ApiError(
        "empid, correction_date, and reason are required",
        400
      );
    }

    // Validate attendance record exists
    const [[att]] = await pool.query(
      "SELECT id FROM attendance_records WHERE id = ?",
      [req.params.id]
    );

    if (!att) {
      throw new ApiError("Attendance record not found", 404);
    }

    const [result] = await pool.query(
      "INSERT INTO attendance_correction_requests (empid, attendance_record_id, correction_date, requested_check_in, requested_check_out, reason) VALUES (?, ?, ?, ?, ?, ?)",
      [
        empid,
        req.params.id,
        correction_date,
        requested_check_in,
        requested_check_out,
        reason,
      ]
    );

    res.status(201).json({ id: result.insertId });
  } catch (error) {
    next(error);
  }
});

router.get("/team/summary", async (req, res, next) => {
  const { manager_id, attendance_date } = req.query;

  try {
    if (!manager_id) {
      throw new ApiError("manager_id is required", 400);
    }

    const date = attendance_date || new Date().toISOString().split("T")[0]; // YYYY-MM-DD

    // Step 1: Get team members reporting to manager
    const [employees] = await pool.query(
      "SELECT empid, employee_code, name, email FROM employees WHERE manager_id = ?",
      [manager_id]
    );

    if (employees.length === 0) {
      return res.json({
        manager_id,
        attendance_date: date,
        team_summary: [],
      });
    }

    // Step 2: Get attendance records for those employees on the date
    const employeeIds = employees.map((e) => e.empid);

    const [attendanceRecords] = await pool.query(
      `SELECT 
        ar.empid,
        ar.status,
        ar.check_in_time,
        ar.check_out_time,
        ar.break_start_time,
        ar.break_end_time,
        ar.total_work_hours,
        ar.is_late,
        ar.is_early_leave,
        ar.late_minutes,
        ar.early_leave_minutes
      FROM attendance_records ar
      WHERE ar.attendance_date = ? AND ar.empid IN (?)`,
      [date, employeeIds]
    );

    // Step 3: Merge employee and attendance data for summary
    const summary = employees.map((emp) => {
      const attendance = attendanceRecords.find((a) => a.empid === emp.empid);

      return {
        empid: emp.empid,
        employee_code: emp.employee_code,
        employee_name: emp.name,
        employee_email: emp.email,
        status: attendance ? attendance.status : null,
        check_in_time: attendance ? attendance.check_in_time : null,
        check_out_time: attendance ? attendance.check_out_time : null,
        break_start_time: attendance ? attendance.break_start_time : null,
        break_end_time: attendance ? attendance.break_end_time : null,
        total_work_hours: attendance ? attendance.total_work_hours : null,
        is_late: attendance ? attendance.is_late : null,
        is_early_leave: attendance ? attendance.is_early_leave : null,
        late_minutes: attendance ? attendance.late_minutes : 0,
        early_leave_minutes: attendance ? attendance.early_leave_minutes : 0,
      };
    });

    res.json({
      manager_id,
      attendance_date: date,
      team_summary: summary,
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
