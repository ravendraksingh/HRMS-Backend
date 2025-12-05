// routes/attendance.js
const express = require("express");
const router = express.Router();
const pool = require("../../db");
const ApiError = require("../../errors/ApiError");
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

    res.json(record);
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

module.exports = router;
