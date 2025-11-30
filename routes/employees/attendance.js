const express = require("express");
const router = express.Router();
const pool = require("../../db");
const ApiError = require("../../errors/ApiError");
const Attendance = require("../../models/Attendance");
const Leave = require("../../models/Leave");
const { empidParamValidator } = require("../../validations/employeeSchemas");
const {
  createCorrectionRequestSchema,
  getCorrectionRequestsQuerySchema,
} = require("../../validations/attendanceSchemas");
const { handleValidationErrors } = require("../../util/validation");
const { query, body, param } = require("express-validator");
const mysql = require("mysql2/promise");
const { calculateAttendanceStatus } = require("../../util/attendanceUtil");
const {
  isWorkingDay,
  getMonthlyCalendar,
  getWorkingDays,
} = require("../../util/calendarUtil");

/**
 * POST /employees/:empid/attendance/clockin
 * Clock in for an employee
 * Body: attendance_date (YYYY-MM-DD), check_in_time (YYYY-MM-DD HH:MM:SS), shiftid (optional)
 * Returns: Check-in record with late status
 */
router.post(
  "/:empid/attendance/clockin",
  [
    empidParamValidator,
    body("attendance_date")
      .notEmpty()
      .withMessage("attendance_date is required")
      .isISO8601()
      .withMessage(
        "attendance_date must be a valid ISO 8601 date (YYYY-MM-DD)"
      ),
    body("check_in_time")
      .notEmpty()
      .withMessage("check_in_time is required")
      .isISO8601()
      .withMessage("check_in_time must be a valid ISO 8601 datetime"),
    body("shiftid").optional().trim(),
  ],
  handleValidationErrors,
  async (req, res, next) => {
    const { empid } = req.params;
    const { attendance_date, check_in_time, shiftid } = req.body;

    try {
      // Validate employee exists
      const [[employee]] = await pool.query(
        "SELECT empid FROM employees WHERE empid = ?",
        [empid]
      );

      if (!employee) {
        throw new ApiError("Employee not found", 404);
      }

      // Ensure shiftid is set (default to 'GENERAL' if not provided)
      const finalShiftid = shiftid || "GENERAL";

      // Check if it's a working day (optional check - can be configured to allow/disallow)
      try {
        const workingDayStatus = await isWorkingDay(empid, attendance_date);
        if (
          !workingDayStatus.is_working_day &&
          workingDayStatus.type !== "OPTIONAL_HOLIDAY"
        ) {
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
        finalShiftid
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
            finalShiftid
          );
        }

        // Update existing record with late status
        await pool.query(
          "UPDATE attendance_records SET check_in_time = ?, shiftid = ?, is_late = ?, late_minutes = ?, is_early_leave = ?, early_leave_minutes = ?, updated_at = NOW() WHERE id = ?",
          [
            check_in_time,
            finalShiftid,
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
            finalShiftid,
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
  }
);

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

/**
 * POST /employees/:empid/attendance/clockout
 * Clock out for an employee
 * Body: attendance_date (YYYY-MM-DD), check_out_time (YYYY-MM-DD HH:MM:SS)
 * Returns: Check-out record with early leave status and total work hours
 */
router.post(
  "/:empid/attendance/clockout",
  [
    empidParamValidator,
    body("attendance_date")
      .notEmpty()
      .withMessage("attendance_date is required")
      .isISO8601()
      .withMessage(
        "attendance_date must be a valid ISO 8601 date (YYYY-MM-DD)"
      ),
    body("check_out_time")
      .notEmpty()
      .withMessage("check_out_time is required")
      .isISO8601()
      .withMessage("check_out_time must be a valid ISO 8601 datetime"),
  ],
  handleValidationErrors,
  async (req, res, next) => {
    const { empid } = req.params;
    const { attendance_date, check_out_time } = req.body;

    try {
      // Validate employee exists
      const [[employee]] = await pool.query(
        "SELECT empid FROM employees WHERE empid = ?",
        [empid]
      );

      if (!employee) {
        throw new ApiError("Employee not found", 404);
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

      // Ensure shiftid is set (default to 'GENERAL' if not provided or null)
      const finalShiftid = existing.shiftid || "GENERAL";

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
        finalShiftid
      );

      // Update with check_out_time, shiftid (if was null), calculated total_work_hours, and early leave status
      // Also update shiftid if it was null (for old records)
      const updateQuery =
        totalWorkHours !== null
          ? "UPDATE attendance_records SET check_out_time = ?, shiftid = ?, total_work_hours = ?, is_late = ?, late_minutes = ?, is_early_leave = ?, early_leave_minutes = ?, updated_at = NOW() WHERE empid = ? AND attendance_date = ?"
          : "UPDATE attendance_records SET check_out_time = ?, shiftid = ?, is_late = ?, late_minutes = ?, is_early_leave = ?, early_leave_minutes = ?, updated_at = NOW() WHERE empid = ? AND attendance_date = ?";

      const updateParams =
        totalWorkHours !== null
          ? [
              check_out_time,
              finalShiftid,
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
              finalShiftid,
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
  }
);

/**
 * GET /employees/:empid/attendance/today
 * Get today's attendance record for an employee with calendar information
 * Returns format similar to /calendars/monthly/employee/:empid but for a single day
 * Only returns attendance data if:
 *   - Today is a working day for the employee
 *   - Employee is not on approved leave today
 * Format: { empid, date, is_working_day, reason, type, holiday, attendance }
 */
router.get(
  "/:empid/attendance/today",
  [empidParamValidator],
  handleValidationErrors,
  async (req, res, next) => {
    const { empid } = req.params;

    try {
      // Get today's date in YYYY-MM-DD format
      const today = new Date();
      const year = today.getFullYear();
      const month = String(today.getMonth() + 1).padStart(2, "0");
      const day = String(today.getDate()).padStart(2, "0");
      const todayStr = `${year}-${month}-${day}`;

      // Validate employee exists
      const [[employee]] = await pool.query(
        "SELECT empid, name FROM employees WHERE empid = ?",
        [empid]
      );

      if (!employee) {
        throw new ApiError("Employee not found", 404);
      }

      // Check if today is a working day (includes holiday information)
      const workingDayStatus = await isWorkingDay(empid, todayStr);

      // Build base response with calendar information
      const response = {
        empid: empid,
        date: todayStr,
        is_working_day: workingDayStatus.is_working_day,
        reason: workingDayStatus.reason,
        type: workingDayStatus.type,
        holiday: workingDayStatus.holiday || null,
        attendance: null,
        leave: null,
        day_status: null,
      };

      // If not a working day, return with attendance as null and day_status as NON_WORKING
      if (!workingDayStatus.is_working_day) {
        response.day_status =
          workingDayStatus.type === "UNKNOWN"
            ? workingDayStatus.type
            : "NON_WORKING";
        return res.json(response);
      }

      // Check if employee has any leave for today (any status) - for ABSENT determination
      const [allLeaves] = await pool.query(
        `SELECT 
          l.id,
          l.status
        FROM leaves l
        WHERE l.empid = ?
          AND l.start_date <= ?
          AND l.end_date >= ?`,
        [empid, todayStr, todayStr]
      );

      // Check if employee has approved or pending leave for today - for display
      const [leaves] = await pool.query(
        `SELECT 
          l.id,
          l.empid,
          l.leavetype_id,
          DATE_FORMAT(l.start_date, '%Y-%m-%d') as start_date,
          DATE_FORMAT(l.end_date, '%Y-%m-%d') as end_date,
          l.total_days,
          l.reason,
          l.medical_certificate_url,
          l.status,
          l.approved_by,
          DATE_FORMAT(l.approved_at, '%Y-%m-%d %H:%i:%s') as approved_at,
          l.rejection_reason,
          l.cancelled_at,
          l.remarks,
          DATE_FORMAT(l.applied_at, '%Y-%m-%d %H:%i:%s') as applied_at,
          lt.name as leave_type_name
        FROM leaves l
        LEFT JOIN leave_types lt ON l.leavetype_id = lt.leavetype_id
        WHERE l.empid = ?
          AND l.status IN ('APPROVED', 'PENDING')
          AND l.start_date <= ?
          AND l.end_date >= ?
        ORDER BY l.start_date ASC`,
        [empid, todayStr, todayStr]
      );

      // If employee is on approved or pending leave, return with leave information
      if (leaves.length > 0) {
        // Prioritize APPROVED over PENDING, otherwise take the first one
        const leave = leaves.find((l) => l.status === "APPROVED") || leaves[0];

        // Format leave object
        const formattedLeave = {
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
        };

        // Determine day_status based on leave status
        const dayStatus =
          leave.status === "APPROVED" ? "ON_LEAVE" : "LEAVE_PENDING";

        response.leave = formattedLeave;
        response.day_status = dayStatus;
        return res.json(response);
      }

      // Employee is not on leave and today is a working day
      // Fetch attendance record for today
      const [attendanceRecords] = await pool.query(
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
        WHERE ar.empid = ? 
          AND ar.attendance_date = ?`,
        [empid, todayStr]
      );

      // Set attendance data if record exists
      if (attendanceRecords.length > 0) {
        const attendance = Attendance.fromDatabaseRow(attendanceRecords[0]);
        response.attendance = attendance.toJSON();
        // Set day_status based on attendance status
        // If explicitly marked ABSENT, use ABSENT; otherwise use the status from record
        response.day_status = attendance.status || null;
      } else {
        // No attendance record - check if ABSENT, EXPECTED, or INDETERMINATE
        // ABSENT if: working day AND no leaves (any status) AND date is today or past
        // EXPECTED if: working day AND no leaves (any status) AND date is future
        // Otherwise: INDETERMINATE
        if (response.is_working_day && allLeaves.length === 0) {
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const dateObj = new Date(todayStr + "T00:00:00");
          const isFutureDate = dateObj > today;
          response.day_status = isFutureDate ? "EXPECTED" : "ABSENT";
        } else {
          response.day_status = "INDETERMINATE";
        }
      }

      return res.json(response);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /employees/:empid/attendance
 * Get attendance records for an employee within a date range
 * Query params: start_date (YYYY-MM-DD), end_date (YYYY-MM-DD)
 */
router.get(
  "/:empid/attendance",
  [
    empidParamValidator,
    query("start_date")
      .optional()
      .isISO8601()
      .withMessage("start_date must be a valid ISO 8601 date (YYYY-MM-DD)"),
    query("end_date")
      .optional()
      .isISO8601()
      .withMessage("end_date must be a valid ISO 8601 date (YYYY-MM-DD)"),
    query().custom((value, { req }) => {
      const { start_date, end_date } = req.query;
      if (start_date && end_date) {
        const start = new Date(start_date);
        const end = new Date(end_date);
        if (start > end) {
          throw new Error("start_date must be before or equal to end_date");
        }
      }
      return true;
    }),
  ],
  handleValidationErrors,
  async (req, res, next) => {
    const { empid } = req.params;
    const { start_date, end_date } = req.query;

    try {
      // Check if employee exists
      const [[employee]] = await pool.query(
        "SELECT empid FROM employees WHERE empid = ?",
        [empid]
      );

      if (!employee) {
        throw new ApiError("Employee not found", 404);
      }

      // Build query
      const whereClauses = ["ar.empid = ?"];
      const params = [empid];

      if (start_date) {
        whereClauses.push("ar.attendance_date >= ?");
        params.push(start_date);
      }

      if (end_date) {
        whereClauses.push("ar.attendance_date <= ?");
        params.push(end_date);
      }

      const whereSql = `WHERE ${whereClauses.join(" AND ")}`;

      // Fetch attendance records
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
        ORDER BY ar.attendance_date DESC
      `;

      const [items] = await pool.query(dataQuery, params);

      // Convert database rows to Attendance class instances
      const attendanceRecords = Attendance.fromDatabaseRows(items);

      res.status(200).json({
        empid,
        count: attendanceRecords.length,
        attendance: attendanceRecords.map((att) => att.toJSON()),
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /employees/:empid/attendance/corrections
 * Create a new attendance correction request
 * Body: attendance_record_id (optional), correction_date (YYYY-MM-DD), requested_check_in (optional), requested_check_out (optional), reason
 * Returns: Created correction request
 */
router.post(
  "/:empid/attendance/corrections",
  createCorrectionRequestSchema,
  handleValidationErrors,
  async (req, res, next) => {
    const { empid } = req.params;
    const {
      attendance_record_id,
      correction_date,
      requested_check_in,
      requested_check_out,
      reason,
    } = req.body;

    try {
      // Validate employee exists
      const [[employee]] = await pool.query(
        "SELECT empid FROM employees WHERE empid = ?",
        [empid]
      );

      if (!employee) {
        throw new ApiError("Employee not found", 404);
      }

      // Check if there's already a pending or approved correction request for this date
      // This prevents duplicate requests for the same date
      const [[existingRequest]] = await pool.query(
        `SELECT id, status, correction_date 
         FROM attendance_correction_requests 
         WHERE empid = ? 
           AND correction_date = ? 
           AND status IN ('PENDING', 'APPROVED')`,
        [empid, correction_date]
      );

      if (existingRequest) {
        throw new ApiError(
          `A correction request already exists for date ${correction_date} with status ${existingRequest.status}. Please wait for the existing request to be processed or cancelled before creating a new one.`,
          400
        );
      }

      // If attendance_record_id is provided, validate it exists and belongs to employee
      if (attendance_record_id) {
        const [[attendance]] = await pool.query(
          "SELECT id, empid FROM attendance_records WHERE id = ? AND empid = ?",
          [attendance_record_id, empid]
        );

        if (!attendance) {
          throw new ApiError(
            "Attendance record not found or does not belong to employee",
            404
          );
        }
      } else {
        // If no attendance_record_id, check if a record already exists for this date
        const [[existing]] = await pool.query(
          "SELECT id FROM attendance_records WHERE empid = ? AND attendance_date = ?",
          [empid, correction_date]
        );

        if (existing) {
          throw new ApiError(
            `Attendance record already exists for date ${correction_date}. Please provide attendance_record_id to update it.`,
            400
          );
        }
      }

      // Insert correction request
      const [result] = await pool.query(
        `INSERT INTO attendance_correction_requests (
        empid, attendance_record_id, correction_date,
        requested_check_in, requested_check_out, reason
      ) VALUES (?, ?, ?, ?, ?, ?)`,
        [
          empid,
          attendance_record_id || null,
          correction_date,
          requested_check_in || null,
          requested_check_out || null,
          reason,
        ]
      );

      // Fetch created request with employee details
      const [[request]] = await pool.query(
        `SELECT 
        acr.*,
        e.name as employee_name,
        e.email as employee_email
      FROM attendance_correction_requests acr
      LEFT JOIN employees e ON acr.empid = e.empid
      WHERE acr.id = ?`,
        [result.insertId]
      );

      res.status(201).json({
        message: "Attendance correction request created successfully",
        request: request,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /employees/:empid/attendance/corrections
 * Get attendance correction requests for an employee
 * Query params: status (optional), from_date (optional), to_date (optional)
 * Returns: List of correction requests for the employee
 */
router.get(
  "/:empid/attendance/corrections",
  getCorrectionRequestsQuerySchema,
  handleValidationErrors,
  async (req, res, next) => {
    const { empid } = req.params;
    const { status, from_date, to_date } = req.query;

    try {
      // Validate employee exists
      const [[employee]] = await pool.query(
        "SELECT empid FROM employees WHERE empid = ?",
        [empid]
      );

      if (!employee) {
        throw new ApiError("Employee not found", 404);
      }

      let whereClauses = ["acr.empid = ?"];
      let params = [empid];

      if (status) {
        whereClauses.push("acr.status = ?");
        params.push(status.toUpperCase());
      }

      if (from_date) {
        whereClauses.push("acr.correction_date >= ?");
        params.push(from_date);
      }

      if (to_date) {
        whereClauses.push("acr.correction_date <= ?");
        params.push(to_date);
      }

      const [requests] = await pool.query(
        `SELECT 
        acr.id,
        acr.empid,
        acr.attendance_record_id,
        DATE_FORMAT(acr.correction_date, '%Y-%m-%d') as correction_date,
        DATE_FORMAT(acr.requested_check_in, '%Y-%m-%d %H:%i:%s') as requested_check_in,
        DATE_FORMAT(acr.requested_check_out, '%Y-%m-%d %H:%i:%s') as requested_check_out,
        acr.reason,
        acr.status,
        acr.rejection_reason,
        DATE_FORMAT(acr.applied_at, '%Y-%m-%d') as applied_at,
        DATE_FORMAT(acr.approved_at, '%Y-%m-%d') as approved_at,
        acr.remarks,
        e.name as employee_name,
        e.email as employee_email,
        approver.name as approver_name
      FROM attendance_correction_requests acr
      LEFT JOIN employees e ON acr.empid = e.empid
      LEFT JOIN employees approver ON acr.approved_by = approver.empid
      WHERE ${whereClauses.join(" AND ")}
      ORDER BY acr.created_at DESC`,
        params
      );

      res.json({
        empid: empid,
        count: requests.length,
        requests: requests,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /employees/:empid/attendance/corrections/eligible-dates
 * Get eligible dates for an employee for which they can raise correction requests
 * Eligibility criteria:
 * 1. No records in attendance_records table for that date AND no leaves in pending/approved status
 * 2. Record in attendance_records table but either clockin or clockout time is missing
 * 3. Do not include future dates and keep this within current month
 * Returns: List of eligible dates with their details
 */
router.get(
  "/:empid/attendance/corrections/eligible-dates",
  [empidParamValidator],
  handleValidationErrors,
  async (req, res, next) => {
    const { empid } = req.params;

    try {
      // Validate employee exists
      const [[employee]] = await pool.query(
        "SELECT empid, name FROM employees WHERE empid = ?",
        [empid]
      );

      if (!employee) {
        throw new ApiError("Employee not found", 404);
      }

      // Get current month
      const now = new Date();
      const year = now.getFullYear();
      const month = now.getMonth() + 1;
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Calculate date range for the current month
      const startDateStr = `${year}-${String(month).padStart(2, "0")}-01`;
      const lastDay = new Date(year, month, 0).getDate();
      const endDateStr = `${year}-${String(month).padStart(2, "0")}-${String(
        lastDay
      ).padStart(2, "0")}`;

      // 1. Get monthly calendar (working days, holidays, weekly offs)
      const calendar = await getMonthlyCalendar(empid, year, month);

      // 2. Get attendance records for the month
      const [attendanceRecords] = await pool.query(
        `SELECT 
          ar.id,
          DATE_FORMAT(ar.attendance_date, '%Y-%m-%d') as attendance_date,
          DATE_FORMAT(ar.check_in_time, '%Y-%m-%d %H:%i:%s') as check_in_time,
          DATE_FORMAT(ar.check_out_time, '%Y-%m-%d %H:%i:%s') as check_out_time
        FROM attendance_records ar
        WHERE ar.empid = ? 
          AND ar.attendance_date >= ? 
          AND ar.attendance_date <= ?
        ORDER BY ar.attendance_date ASC`,
        [empid, startDateStr, endDateStr]
      );

      // 3. Get leaves (pending/approved) for the month
      const [leaves] = await pool.query(
        `SELECT 
          l.id,
          DATE_FORMAT(l.start_date, '%Y-%m-%d') as start_date,
          DATE_FORMAT(l.end_date, '%Y-%m-%d') as end_date,
          l.status
        FROM leaves l
        WHERE l.empid = ?
          AND l.status IN ('PENDING', 'APPROVED')
          AND l.start_date <= ?
          AND l.end_date >= ?`,
        [empid, endDateStr, startDateStr]
      );

      // 4. Get existing correction requests (pending/approved) for the month
      const [correctionRequests] = await pool.query(
        `SELECT 
          acr.id,
          DATE_FORMAT(acr.correction_date, '%Y-%m-%d') as correction_date,
          acr.status
        FROM attendance_correction_requests acr
        WHERE acr.empid = ?
          AND acr.correction_date >= ?
          AND acr.correction_date <= ?
          AND acr.status IN ('PENDING', 'APPROVED')`,
        [empid, startDateStr, endDateStr]
      );

      // Create maps for quick lookup
      const attendanceMap = new Map();
      attendanceRecords.forEach((record) => {
        attendanceMap.set(record.attendance_date, record);
      });

      // Create a map of correction requests by date
      const correctionRequestsMap = new Map();
      correctionRequests.forEach((request) => {
        correctionRequestsMap.set(request.correction_date, request);
      });

      // Create a map of leaves by date (a leave can span multiple days)
      const leavesMap = new Map();
      leaves.forEach((leave) => {
        const leaveStartDate = new Date(leave.start_date);
        const leaveEndDate = new Date(leave.end_date);
        const currentDate = new Date(leaveStartDate);

        while (currentDate <= leaveEndDate) {
          const dateStr = currentDate.toISOString().split("T")[0];
          // Only include dates within the requested month
          if (dateStr >= startDateStr && dateStr <= endDateStr) {
            if (!leavesMap.has(dateStr)) {
              leavesMap.set(dateStr, []);
            }
            leavesMap.get(dateStr).push({
              id: leave.id,
              start_date: leave.start_date,
              end_date: leave.end_date,
              status: leave.status,
            });
          }
          currentDate.setDate(currentDate.getDate() + 1);
        }
      });

      // Filter eligible dates
      const eligibleDates = [];

      for (const day of calendar.calendar) {
        const dateStr = day.date;
        const dateObj = new Date(dateStr + "T00:00:00");

        // Skip future dates
        if (dateObj > today) {
          continue;
        }

        // Only consider working days
        if (!day.is_working_day) {
          continue;
        }

        const attendance = attendanceMap.get(dateStr);
        const dayLeaves = leavesMap.get(dateStr) || [];
        const existingCorrectionRequest = correctionRequestsMap.get(dateStr);

        // Skip if there's already a pending or approved correction request for this date
        if (existingCorrectionRequest) {
          continue;
        }

        // Check eligibility criteria:
        // 1. No attendance record AND no pending/approved leaves
        // 2. Attendance record exists but either check_in_time or check_out_time is missing
        let isEligible = false;
        let eligibilityReason = "";

        if (!attendance && dayLeaves.length === 0) {
          // No attendance record and no leaves
          isEligible = true;
          eligibilityReason =
            "No attendance record and no pending/approved leaves";
        } else if (attendance) {
          // Check if either check_in_time or check_out_time is missing
          if (!attendance.check_in_time || !attendance.check_out_time) {
            isEligible = true;
            if (!attendance.check_in_time && !attendance.check_out_time) {
              eligibilityReason = "Missing both check-in and check-out times";
            } else if (!attendance.check_in_time) {
              eligibilityReason = "Missing check-in time";
            } else {
              eligibilityReason = "Missing check-out time";
            }
          }
        }

        if (isEligible) {
          eligibleDates.push({
            date: dateStr,
            is_working_day: day.is_working_day,
            calendar_reason: day.reason,
            calendar_type: day.type,
            has_attendance_record: !!attendance,
            attendance_id: attendance?.id || null,
            check_in_time: attendance?.check_in_time || null,
            check_out_time: attendance?.check_out_time || null,
            has_pending_or_approved_leave: dayLeaves.length > 0,
            leaves: dayLeaves.length > 0 ? dayLeaves : [],
            eligibility_reason: eligibilityReason,
          });
        }
      }

      // Sort by date (ascending)
      eligibleDates.sort((a, b) => a.date.localeCompare(b.date));

      res.json({
        empid: empid,
        employee_name: employee.name,
        year: year,
        month: month,
        start_date: startDateStr,
        end_date: endDateStr,
        count: eligibleDates.length,
        eligible_dates: eligibleDates,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /employees/:empid/attendance/corrections/:id/cancel
 * Cancel an attendance correction request (by employee)
 * Returns: Success message
 */
router.post(
  "/:empid/attendance/corrections/:id/cancel",
  [
    empidParamValidator,
    param("id")
      .isInt({ min: 1 })
      .withMessage("id must be a positive integer")
      .toInt(),
  ],
  handleValidationErrors,
  async (req, res, next) => {
    const { empid, id } = req.params;

    try {
      // Validate employee exists
      const [[employee]] = await pool.query(
        "SELECT empid FROM employees WHERE empid = ?",
        [empid]
      );

      if (!employee) {
        throw new ApiError("Employee not found", 404);
      }

      // Get the correction request
      const [[request]] = await pool.query(
        "SELECT * FROM attendance_correction_requests WHERE id = ? AND status = 'PENDING'",
        [id]
      );

      if (!request) {
        throw new ApiError(
          "Correction request not found or cannot be cancelled",
          404
        );
      }

      // Verify it belongs to the employee
      if (request.empid !== empid) {
        throw new ApiError(
          "You can only cancel your own correction requests",
          403
        );
      }

      // Delete the request since there's no 'cancelled' status in schema
      const [result] = await pool.query(
        `DELETE FROM attendance_correction_requests 
      WHERE id = ? AND empid = ? AND status = 'PENDING'`,
        [id, empid]
      );

      if (result.affectedRows === 0) {
        throw new ApiError("Failed to cancel correction request", 500);
      }

      res.json({ message: "Correction request cancelled successfully" });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /employees/:empid/attendance/monthly
 * Get monthly attendance report with aggregated statistics for an employee
 * Query params: month (required, YYYY-MM format, e.g., 2024-12)
 * Returns: Aggregated statistics for the month
 */
router.get(
  "/:empid/attendance/monthly",
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
        "SELECT empid, name FROM employees WHERE empid = ?",
        [empid]
      );

      if (!employee) {
        throw new ApiError("Employee not found", 404);
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
        empid,
        employee_name: employee.name,
        month: month,
        year: year,
        month_number: monthNum,
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
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /employees/:empid/attendance/overtime
 * Get overtime records for an employee
 * Query params: from_date (optional), to_date (optional), status (optional)
 * Returns: List of overtime records for the employee
 */
router.get(
  "/:empid/attendance/overtime",
  [
    empidParamValidator,
    query("from_date")
      .optional()
      .isISO8601()
      .withMessage("from_date must be a valid ISO 8601 date (YYYY-MM-DD)"),
    query("to_date")
      .optional()
      .isISO8601()
      .withMessage("to_date must be a valid ISO 8601 date (YYYY-MM-DD)"),
    query("status")
      .optional()
      .isIn(["PENDING", "APPROVED", "REJECTED"])
      .withMessage("status must be PENDING, APPROVED, or REJECTED"),
  ],
  handleValidationErrors,
  async (req, res, next) => {
    const { empid } = req.params;
    const { from_date, to_date, status } = req.query;

    try {
      // Validate employee exists
      const [[employee]] = await pool.query(
        "SELECT empid FROM employees WHERE empid = ?",
        [empid]
      );

      if (!employee) {
        throw new ApiError("Employee not found", 404);
      }

      let whereClauses = ["ao.empid = ?"];
      let params = [empid];

      if (from_date) {
        whereClauses.push("ao.overtime_date >= ?");
        params.push(from_date);
      }

      if (to_date) {
        whereClauses.push("ao.overtime_date <= ?");
        params.push(to_date);
      }

      if (status) {
        whereClauses.push("ao.status = ?");
        params.push(status.toUpperCase());
      }

      const whereSql = `WHERE ${whereClauses.join(" AND ")}`;
      const [rows] = await pool.query(
        `SELECT 
          ao.id,
          ao.empid,
          DATE_FORMAT(ao.overtime_date, '%Y-%m-%d') as overtime_date,
          DATE_FORMAT(ao.start_time, '%Y-%m-%d %H:%i:%s') as start_time,
          DATE_FORMAT(ao.end_time, '%Y-%m-%d %H:%i:%s') as end_time,
          ao.total_hours,
          ao.reason,
          ao.status,
          DATE_FORMAT(ao.applied_at, '%Y-%m-%d %H:%i:%s') as applied_at,
          ao.approved_by,
          DATE_FORMAT(ao.approved_at, '%Y-%m-%d %H:%i:%s') as approved_at,
          ao.rejection_reason,
          ao.remarks
        FROM attendance_overtime ao
        ${whereSql} 
        ORDER BY ao.overtime_date DESC`,
        params
      );

      res.json({
        empid: empid,
        count: rows.length,
        overtime: rows,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /employees/:empid/attendance/overtime
 * Create a new overtime record for an employee
 * Body: overtime_date (YYYY-MM-DD), start_time (YYYY-MM-DD HH:MM:SS), end_time (YYYY-MM-DD HH:MM:SS), reason (optional)
 * Returns: Created overtime record ID
 */
router.post(
  "/:empid/attendance/overtime",
  [
    empidParamValidator,
    body("overtime_date")
      .notEmpty()
      .withMessage("overtime_date is required")
      .isISO8601()
      .withMessage("overtime_date must be a valid ISO 8601 date (YYYY-MM-DD)"),
    body("start_time")
      .notEmpty()
      .withMessage("start_time is required")
      .isISO8601()
      .withMessage("start_time must be a valid ISO 8601 datetime"),
    body("end_time")
      .notEmpty()
      .withMessage("end_time is required")
      .isISO8601()
      .withMessage("end_time must be a valid ISO 8601 datetime"),
    body("reason")
      .optional()
      .isLength({ max: 500 })
      .withMessage("reason must be 500 characters or less")
      .trim(),
    body().custom((value, { req }) => {
      const { start_time, end_time } = req.body;
      if (start_time && end_time) {
        const start = new Date(start_time);
        const end = new Date(end_time);
        if (end <= start) {
          throw new Error("end_time must be after start_time");
        }
        // Calculate total hours
        const hours = (end - start) / (1000 * 60 * 60);
        if (hours <= 0) {
          throw new Error("Overtime duration must be greater than 0 hours");
        }
      }
      return true;
    }),
  ],
  handleValidationErrors,
  async (req, res, next) => {
    const { empid } = req.params;
    const { overtime_date, start_time, end_time, reason = null } = req.body;

    try {
      // Validate employee exists
      const [[employee]] = await pool.query(
        "SELECT empid FROM employees WHERE empid = ?",
        [empid]
      );

      if (!employee) {
        throw new ApiError("Employee not found", 404);
      }

      // Calculate total hours
      const start = new Date(start_time);
      const end = new Date(end_time);
      const totalHours =
        Math.round(((end - start) / (1000 * 60 * 60)) * 100) / 100;

      const [result] = await pool.query(
        "INSERT INTO attendance_overtime (empid, overtime_date, start_time, end_time, total_hours, reason) VALUES (?, ?, ?, ?, ?, ?)",
        [empid, overtime_date, start_time, end_time, totalHours, reason]
      );

      res.status(201).json({
        message: "Overtime record created successfully",
        id: result.insertId,
        total_hours: totalHours,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PATCH /employees/:empid/attendance/overtime/:id
 * Update an overtime record (only PENDING records can be updated)
 * Body: start_time (optional), end_time (optional), reason (optional)
 * Returns: Success message
 */
router.patch(
  "/:empid/attendance/overtime/:id",
  [
    empidParamValidator,
    param("id")
      .isInt({ min: 1 })
      .withMessage("id must be a positive integer")
      .toInt(),
    body("start_time")
      .optional()
      .isISO8601()
      .withMessage("start_time must be a valid ISO 8601 datetime"),
    body("end_time")
      .optional()
      .isISO8601()
      .withMessage("end_time must be a valid ISO 8601 datetime"),
    body("reason")
      .optional()
      .isLength({ max: 500 })
      .withMessage("reason must be 500 characters or less")
      .trim(),
    body().custom((value, { req }) => {
      const { start_time, end_time } = req.body;
      if (start_time && end_time) {
        const start = new Date(start_time);
        const end = new Date(end_time);
        if (end <= start) {
          throw new Error("end_time must be after start_time");
        }
      }
      return true;
    }),
  ],
  handleValidationErrors,
  async (req, res, next) => {
    const { empid, id } = req.params;
    const { start_time, end_time, reason } = req.body;

    try {
      // Validate employee exists
      const [[employee]] = await pool.query(
        "SELECT empid FROM employees WHERE empid = ?",
        [empid]
      );

      if (!employee) {
        throw new ApiError("Employee not found", 404);
      }

      // Check if overtime record exists and belongs to employee
      const [[overtime]] = await pool.query(
        "SELECT id, empid, status, start_time, end_time FROM attendance_overtime WHERE id = ? AND empid = ?",
        [id, empid]
      );

      if (!overtime) {
        throw new ApiError(
          "Overtime record not found or does not belong to employee",
          404
        );
      }

      if (overtime.status !== "PENDING") {
        throw new ApiError("Only PENDING overtime records can be updated", 400);
      }

      const updates = [];
      const params = [];

      // Use existing values if not provided
      const finalStartTime = start_time || overtime.start_time;
      const finalEndTime = end_time || overtime.end_time;

      if (start_time !== undefined) {
        updates.push("start_time = ?");
        params.push(start_time);
      }

      if (end_time !== undefined) {
        updates.push("end_time = ?");
        params.push(end_time);
      }

      // Recalculate total_hours if times changed
      if (start_time !== undefined || end_time !== undefined) {
        const start = new Date(finalStartTime);
        const end = new Date(finalEndTime);
        const totalHours =
          Math.round(((end - start) / (1000 * 60 * 60)) * 100) / 100;
        updates.push("total_hours = ?");
        params.push(totalHours);
      }

      if (reason !== undefined) {
        updates.push("reason = ?");
        params.push(reason);
      }

      if (updates.length === 0) {
        throw new ApiError("No fields to update", 400);
      }

      params.push(id, empid);

      const [result] = await pool.query(
        `UPDATE attendance_overtime 
        SET ${updates.join(", ")}, updated_at = NOW() 
        WHERE id = ? AND empid = ? AND status = 'PENDING'`,
        params
      );

      if (result.affectedRows === 0) {
        throw new ApiError("Failed to update overtime record", 500);
      }

      res.json({ message: "Overtime record updated successfully" });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /employees/:empid/calendar/attendance
 * Generate comprehensive attendance calendar for an employee for a date range
 * Query params: start_date (optional, YYYY-MM-DD, defaults to current week's Monday),
 *                end_date (optional, YYYY-MM-DD, defaults to current week's Sunday)
 * Returns: Calendar combining:
 *   - Calendar data (working days, holidays, weekly offs, date overrides)
 *   - Attendance records for each day
 *   - Leave records for each day
 * Note: Maximum date range is 31 days
 */
router.get(
  "/:empid/calendar/attendance",
  [
    empidParamValidator,
    query("start_date")
      .optional()
      .matches(/^\d{4}-\d{2}-\d{2}$/)
      .withMessage("start_date must be in YYYY-MM-DD format"),
    query("end_date")
      .optional()
      .matches(/^\d{4}-\d{2}-\d{2}$/)
      .withMessage("end_date must be in YYYY-MM-DD format"),
  ],
  handleValidationErrors,
  async (req, res, next) => {
    const { empid } = req.params;
    let { start_date, end_date } = req.query;

    try {
      // Default to current week if not provided
      if (!start_date || !end_date) {
        const today = new Date();
        const dayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
        // Calculate Monday of current week
        const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
        const monday = new Date(today);
        monday.setDate(today.getDate() + mondayOffset);
        // Calculate Sunday of current week
        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);

        const formatDate = (date) => {
          const year = date.getFullYear();
          const month = String(date.getMonth() + 1).padStart(2, "0");
          const day = String(date.getDate()).padStart(2, "0");
          return `${year}-${month}-${day}`;
        };

        start_date = start_date || formatDate(monday);
        end_date = end_date || formatDate(sunday);
      }

      // Validate dates
      const startDate = new Date(start_date + "T00:00:00");
      const endDate = new Date(end_date + "T00:00:00");

      if (isNaN(startDate.getTime())) {
        throw new ApiError("Invalid start_date", 400);
      }

      if (isNaN(endDate.getTime())) {
        throw new ApiError("Invalid end_date", 400);
      }

      if (endDate < startDate) {
        throw new ApiError("end_date cannot be less than start_date", 400);
      }

      // Validate maximum date range (31 days)
      const daysDiff =
        Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;
      if (daysDiff > 31) {
        throw new ApiError(
          "Date range cannot exceed 31 days. Maximum allowed range is 31 days.",
          400
        );
      }

      // Validate employee exists
      const [[employee]] = await pool.query(
        "SELECT empid, name FROM employees WHERE empid = ?",
        [empid]
      );

      if (!employee) {
        throw new ApiError("Employee not found", 404);
      }

      // Get working days for the date range
      const workingDays = await getWorkingDays(empid, start_date, end_date);

      // Get attendance records for the date range
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
        [empid, start_date, end_date]
      );

      // Get leaves for the date range (leaves that overlap with the range)
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
        [empid, end_date, start_date]
      );

      // Create maps for quick lookup
      const attendanceMap = new Map();
      attendanceRecords.forEach((record) => {
        attendanceMap.set(record.attendance_date, record);
      });

      // Create a map of leaves by date (a leave can span multiple days)
      const leavesMap = new Map();
      leaves.forEach((leave) => {
        const leaveStartDate = new Date(leave.start_date);
        const leaveEndDate = new Date(leave.end_date);
        const currentDate = new Date(leaveStartDate);

        while (currentDate <= leaveEndDate) {
          const dateStr = currentDate.toISOString().split("T")[0];
          // Only include dates within the requested range
          if (dateStr >= start_date && dateStr <= end_date) {
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
      const comprehensiveCalendar = workingDays.map((day) => {
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
          // ABSENT if:
          // 1. status is explicitly marked ABSENT in attendance_records, OR
          // 2. no attendance record AND no leaves (any status) AND is working day
          // Otherwise: INDETERMINATE
          day_status: attendance
            ? attendance.status === "ABSENT"
              ? "ABSENT"
              : attendance.status || "INDETERMINATE"
            : dayLeaves.length > 0
            ? dayLeaves[0].status === "APPROVED"
              ? "ON_LEAVE"
              : dayLeaves[0].status === "PENDING"
              ? "LEAVE_PENDING"
              : "INDETERMINATE"
            : day.is_working_day
            ? (() => {
                // Check if date is in the future
                const dateObj = new Date(day.date + "T00:00:00");
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const isFutureDate = dateObj > today;

                // Future dates: EXPECTED, Past dates: ABSENT
                return isFutureDate ? "EXPECTED" : "ABSENT";
              })()
            : "NON_WORKING", // Non-working day = NON_WORKING
        };
      });

      // Calculate comprehensive summary
      const summary = {
        total_days: comprehensiveCalendar.length,
        working_days: comprehensiveCalendar.filter((d) => d.is_working_day)
          .length,
        non_working_days: comprehensiveCalendar.filter((d) => !d.is_working_day)
          .length,
        attendance: {
          present: comprehensiveCalendar.filter(
            (d) => d.attendance && d.attendance.status === "PRESENT"
          ).length,
          absent: comprehensiveCalendar.filter((d) => d.day_status === "ABSENT")
            .length,
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
          approved: comprehensiveCalendar.filter((d) =>
            d.leaves.some((l) => l.status === "APPROVED")
          ).length,
          pending: comprehensiveCalendar.filter((d) =>
            d.leaves.some((l) => l.status === "PENDING")
          ).length,
          rejected: comprehensiveCalendar.filter((d) =>
            d.leaves.some((l) => l.status === "REJECTED")
          ).length,
        },
      };

      res.json({
        message: "Attendance calendar generated successfully",
        empid: empid,
        employee_name: employee.name,
        start_date: start_date,
        end_date: end_date,
        calendar: comprehensiveCalendar,
        summary: summary,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /employees/:empid/calendar/attendance/monthly
 * Generate comprehensive attendance calendar for an employee for a given month
 * Query params: month (optional, YYYY-MM format, defaults to current month)
 * Returns: Monthly calendar combining:
 *   - Calendar data (working days, holidays, weekly offs, date overrides)
 *   - Attendance records for each day
 *   - Leave records for each day
 */
router.get(
  "/:empid/calendar/attendance/monthly",
  [
    empidParamValidator,
    query("month")
      .optional()
      .matches(/^\d{4}-\d{2}$/)
      .withMessage("month must be in YYYY-MM format"),
  ],
  handleValidationErrors,
  async (req, res, next) => {
    const { empid } = req.params;
    let { month } = req.query;

    try {
      // Default to current month if not provided
      if (!month) {
        const now = new Date();
        const year = now.getFullYear();
        const monthNum = now.getMonth() + 1;
        month = `${year}-${String(monthNum).padStart(2, "0")}`;
      }

      // Parse month (YYYY-MM)
      const [yearStr, monthStr] = month.split("-");
      const yearNum = parseInt(yearStr);
      const monthNum = parseInt(monthStr);

      // Validate month range
      if (isNaN(monthNum) || monthNum < 1 || monthNum > 12) {
        throw new ApiError("month must be between 01 and 12", 400);
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
      const endDateStr = `${yearNum}-${String(monthNum).padStart(
        2,
        "0"
      )}-${String(lastDay).padStart(2, "0")}`;

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

      // 4. Get pending attendance correction requests for the month
      const [correctionRequests] = await pool.query(
        `SELECT 
          acr.id,
          acr.empid,
          acr.attendance_record_id,
          DATE_FORMAT(acr.correction_date, '%Y-%m-%d') as correction_date,
          DATE_FORMAT(acr.requested_check_in, '%Y-%m-%d %H:%i:%s') as requested_check_in,
          DATE_FORMAT(acr.requested_check_out, '%Y-%m-%d %H:%i:%s') as requested_check_out,
          acr.reason,
          acr.status,
          acr.rejection_reason,
          DATE_FORMAT(acr.applied_at, '%Y-%m-%d %H:%i:%s') as applied_at,
          DATE_FORMAT(acr.approved_at, '%Y-%m-%d %H:%i:%s') as approved_at,
          acr.remarks
        FROM attendance_correction_requests acr
        WHERE acr.empid = ?
          AND acr.correction_date >= ?
          AND acr.correction_date <= ?
          AND acr.status = 'PENDING'
        ORDER BY acr.correction_date ASC`,
        [empid, startDateStr, endDateStr]
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

      // Create a map of pending correction requests by date
      const correctionRequestsMap = new Map();
      correctionRequests.forEach((request) => {
        const dateStr = request.correction_date;
        if (!correctionRequestsMap.has(dateStr)) {
          correctionRequestsMap.set(dateStr, []);
        }
        correctionRequestsMap.get(dateStr).push({
          id: request.id,
          attendance_record_id: request.attendance_record_id,
          correction_date: request.correction_date,
          requested_check_in: request.requested_check_in,
          requested_check_out: request.requested_check_out,
          reason: request.reason,
          status: request.status,
          applied_at: request.applied_at,
          approved_at: request.approved_at,
          rejection_reason: request.rejection_reason,
          remarks: request.remarks,
        });
      });

      // Combine calendar, attendance, leave, and correction request data for each day
      const comprehensiveCalendar = calendar.calendar.map((day) => {
        const dateStr = day.date;
        const attendance = attendanceMap.get(dateStr) || null;
        const dayLeaves = leavesMap.get(dateStr) || [];
        const dayCorrectionRequests = correctionRequestsMap.get(dateStr) || [];

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
          // Attendance correction requests (pending only)
          correction_requests: dayCorrectionRequests,
          // Combined status
          // Note: If there's a pending correction request, day_status cannot be ABSENT
          // ABSENT if:
          // 1. status is explicitly marked ABSENT in attendance_records, OR
          // 2. no attendance record AND no leaves (any status) AND is working day AND no pending correction requests
          // Otherwise: INDETERMINATE
          day_status:
            dayCorrectionRequests.length > 0
              ? "CORRECTION_PENDING" // If there's a pending correction request, status cannot be ABSENT
              : attendance
              ? attendance.status === "ABSENT"
                ? "ABSENT"
                : attendance.status || "INDETERMINATE"
              : dayLeaves.length > 0
              ? dayLeaves[0].status === "APPROVED"
                ? "ON_LEAVE"
                : dayLeaves[0].status === "PENDING"
                ? "LEAVE_PENDING"
                : "INDETERMINATE"
              : day.is_working_day
              ? (() => {
                  // Check if date is in the future
                  const dateObj = new Date(day.date + "T00:00:00");
                  const today = new Date();
                  today.setHours(0, 0, 0, 0);
                  const isFutureDate = dateObj > today;

                  // Future dates: EXPECTED, Past dates: ABSENT
                  return isFutureDate ? "EXPECTED" : "ABSENT";
                })()
              : "NON_WORKING", // Non-working day = NON_WORKING
        };
      });

      // Calculate comprehensive summary
      const summary = {
        ...calendar.summary,
        attendance: {
          present: comprehensiveCalendar.filter(
            (d) => d.attendance && d.attendance.status === "PRESENT"
          ).length,
          absent: comprehensiveCalendar.filter((d) => d.day_status === "ABSENT")
            .length,
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
          approved: comprehensiveCalendar.filter((d) =>
            d.leaves.some((l) => l.status === "APPROVED")
          ).length,
          pending: comprehensiveCalendar.filter((d) =>
            d.leaves.some((l) => l.status === "PENDING")
          ).length,
          rejected: comprehensiveCalendar.filter((d) =>
            d.leaves.some((l) => l.status === "REJECTED")
          ).length,
        },
        correction_requests: {
          pending: comprehensiveCalendar.filter(
            (d) => d.correction_requests && d.correction_requests.length > 0
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
  }
);

module.exports = router;
