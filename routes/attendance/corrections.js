// routes/attendance/corrections.js
// Attendance Correction Request APIs
const express = require("express");
const router = express.Router();
const pool = require("../../db");
const ApiError = require("../../util/ApiError");
const { calculateAttendanceStatus } = require("../../util/attendanceUtil");

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
 * POST /attendance/corrections
 * Create a new attendance correction request
 * Employees can request to correct attendance records
 */
router.post("/", async (req, res, next) => {
  const {
    empid,
    attendance_record_id,
    correction_date,
    requested_check_in,
    requested_check_out,
    reason,
  } = req.body;

  try {
    // Validate required fields
    if (!empid || !correction_date || !reason) {
      throw new ApiError(
        "empid, correction_date, and reason are required",
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

    // Validate check times if both provided
    if (requested_check_in && requested_check_out) {
      const checkIn = new Date(requested_check_in);
      const checkOut = new Date(requested_check_out);
      if (checkOut < checkIn) {
        throw new ApiError(
          "requested_check_out must be after requested_check_in",
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
        attendance_record_id,
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
});

/**
 * GET /attendance/corrections
 * Get attendance correction requests for an employee
 * Query params: empid, status, from_date, to_date
 */
router.get("/", async (req, res, next) => {
  const { empid, status, from_date, to_date } = req.query;

  try {
    if (!empid) {
      throw new ApiError("empid query parameter is required", 400);
    }

    let whereClauses = ["acr.empid = ?"];
    let params = [empid];

    if (status) {
      if (!["PENDING", "APPROVED", "REJECTED"].includes(status.toUpperCase())) {
        throw new ApiError(
          "Invalid status. Must be PENDING, APPROVED, or REJECTED",
          400
        );
      }
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

    res.json({ requests });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /attendance/corrections/pending
 * Get pending correction requests for managers to review
 * Query params: manager_empid, empid, from_date, to_date
 */
router.get("/pending", async (req, res, next) => {
  const { manager_empid, empid, from_date, to_date } = req.query;

  try {
    let whereClauses = ["acr.status = 'PENDING'"];
    let params = [];

    // If manager_empid provided, get requests for employees reporting to that manager
    if (manager_empid) {
      const [teamMembers] = await pool.query(
        "SELECT empid FROM employees WHERE manager_id = ?",
        [manager_empid]
      );

      if (teamMembers.length === 0) {
        return res.json({ requests: [] });
      }

      const teamMemberEmpids = teamMembers.map((e) => e.empid);
      whereClauses.push("acr.empid IN (?)");
      params.push(teamMemberEmpids);
    }
    // If empid provided, get requests for that specific employee
    else if (empid) {
      whereClauses.push("acr.empid = ?");
      params.push(empid);
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
        acr.*,
        e.name as employee_name,
        e.email as employee_email,
        d.name as department_name
      FROM attendance_correction_requests acr
      LEFT JOIN employees e ON acr.empid = e.empid
      LEFT JOIN departments d ON e.department_id = d.deptid
      WHERE ${whereClauses.join(" AND ")}
      ORDER BY acr.created_at DESC`,
      params
    );

    res.json({ requests });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /attendance/corrections/:id
 * Get a specific correction request by ID
 */
router.get("/:id", async (req, res, next) => {
  const { id } = req.params;

  try {
    const [[request]] = await pool.query(
      `SELECT 
        acr.*,
        e.name as employee_name,
        e.email as employee_email,
        approver.name as approver_name,
        d.name as department_name
      FROM attendance_correction_requests acr
      LEFT JOIN employees e ON acr.empid = e.empid
      LEFT JOIN employees approver ON acr.approved_by = approver.empid
      LEFT JOIN departments d ON e.department_id = d.deptid
      WHERE acr.id = ?`,
      [id]
    );

    if (!request) {
      throw new ApiError("Correction request not found", 404);
    }

    res.json({ request });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /attendance/corrections/:id/approve
 * Approve an attendance correction request
 * Creates new attendance record if attendance_record_id is null, otherwise updates existing record
 */
router.post("/:id/approve", async (req, res, next) => {
  const { id } = req.params;
  const { approved_by, remarks } = req.body;

  try {
    if (!approved_by) {
      throw new ApiError("approved_by is required", 400);
    }

    // Get the correction request
    const [[request]] = await pool.query(
      `SELECT 
        acr.*,
        e.manager_id
      FROM attendance_correction_requests acr
      LEFT JOIN employees e ON acr.empid = e.empid
      WHERE acr.id = ? AND acr.status = 'PENDING'`,
      [id]
    );

    if (!request) {
      throw new ApiError(
        "Correction request not found or already processed",
        404
      );
    }

    // Verify approver is manager of the employee
    const [[manager]] = await pool.query(
      "SELECT empid FROM employees WHERE empid = ? AND manager_id = ?",
      [request.empid, approved_by]
    );

    if (!manager) {
      throw new ApiError(
        "Only the employee's manager can approve this request",
        403
      );
    }

    // Start transaction
    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      let attendanceRecordId;

      // Calculate total_work_hours if both check_in and check_out are provided
      const calculatedTotalWorkHours = 
        request.requested_check_in && request.requested_check_out
          ? calculateTotalWorkHours(
              request.requested_check_in,
              request.requested_check_out,
              null, // break times not available in correction request
              null
            )
          : null;

      if (!request.attendance_record_id) {
        // Calculate attendance status (late/early leave) for new record
        const attendanceStatus = await calculateAttendanceStatus(
          request.empid,
          request.correction_date,
          request.requested_check_in || null,
          request.requested_check_out || null,
          null // shiftid will be determined from shift assignments
        );

        // Create new attendance record
        const insertFields = [
          "empid",
          "attendance_date",
          "check_in_time",
          "check_out_time",
          "status",
          "shiftid",
          "is_late",
          "late_minutes",
          "is_early_leave",
          "early_leave_minutes",
          "remarks"
        ];
        const insertValues = [
          request.empid,
          request.correction_date,
          request.requested_check_in || null,
          request.requested_check_out || null,
          "PRESENT",
          null, // shiftid can be set later if needed
          attendanceStatus.is_late,
          attendanceStatus.late_minutes,
          attendanceStatus.is_early_leave,
          attendanceStatus.early_leave_minutes,
          `Created via correction request #${id}: ${request.reason}`,
        ];

        // Add total_work_hours if calculated
        if (calculatedTotalWorkHours !== null) {
          insertFields.push("total_work_hours");
          insertValues.push(calculatedTotalWorkHours);
        }

        const [result] = await connection.query(
          `INSERT INTO attendance_records (${insertFields.join(", ")}) VALUES (${insertFields.map(() => "?").join(", ")})`,
          insertValues
        );
        attendanceRecordId = result.insertId;

        // Update correction request with the new attendance_record_id
        await connection.query(
          `UPDATE attendance_correction_requests 
          SET attendance_record_id = ? WHERE id = ?`,
          [attendanceRecordId, id]
        );
      } else {
        // Update existing attendance record
        attendanceRecordId = request.attendance_record_id;

        // Get existing record to calculate total_work_hours and get attendance_date, shiftid
        const [[existingRecord]] = await connection.query(
          "SELECT check_in_time, check_out_time, break_start_time, break_end_time, attendance_date, shiftid FROM attendance_records WHERE id = ?",
          [attendanceRecordId]
        );

        const updates = [];
        const updateParams = [];

        if (request.requested_check_in !== null) {
          updates.push("check_in_time = ?");
          updateParams.push(request.requested_check_in);
        }
        if (request.requested_check_out !== null) {
          updates.push("check_out_time = ?");
          updateParams.push(request.requested_check_out);
        }

        // Calculate total_work_hours and attendance status if check_in or check_out is being updated
        if (updates.length > 0) {
          // Use new values if provided, otherwise use existing values
          const finalCheckInTime = request.requested_check_in !== null 
            ? request.requested_check_in 
            : existingRecord?.check_in_time;
          const finalCheckOutTime = request.requested_check_out !== null 
            ? request.requested_check_out 
            : existingRecord?.check_out_time;
          const finalBreakStartTime = existingRecord?.break_start_time || null;
          const finalBreakEndTime = existingRecord?.break_end_time || null;

          // Calculate total_work_hours if both check_in and check_out are available
          if (finalCheckInTime && finalCheckOutTime) {
            const recalculatedTotalWorkHours = calculateTotalWorkHours(
              finalCheckInTime,
              finalCheckOutTime,
              finalBreakStartTime,
              finalBreakEndTime
            );
            if (recalculatedTotalWorkHours !== null) {
              updates.push("total_work_hours = ?");
              updateParams.push(recalculatedTotalWorkHours);
            }
          }

          // Calculate attendance status (late/early leave)
          const attendanceStatus = await calculateAttendanceStatus(
            request.empid,
            existingRecord.attendance_date,
            finalCheckInTime,
            finalCheckOutTime,
            existingRecord.shiftid
          );
          updates.push("is_late = ?");
          updateParams.push(attendanceStatus.is_late);
          updates.push("late_minutes = ?");
          updateParams.push(attendanceStatus.late_minutes);
          updates.push("is_early_leave = ?");
          updateParams.push(attendanceStatus.is_early_leave);
          updates.push("early_leave_minutes = ?");
          updateParams.push(attendanceStatus.early_leave_minutes);

          updates.push("remarks = CONCAT(COALESCE(remarks, ''), ?)");
          updateParams.push(
            ` | Updated via correction request #${id}: ${request.reason}`
          );
          updateParams.push(attendanceRecordId);

          await connection.query(
            `UPDATE attendance_records 
            SET ${updates.join(", ")}, updated_at = NOW() 
            WHERE id = ?`,
            updateParams
          );
        }
      }

      // Update correction request status
      await connection.query(
        `UPDATE attendance_correction_requests 
        SET status = 'APPROVED',
            approved_by = ?,
            approved_at = NOW(),
            remarks = ?,
            updated_at = NOW()
        WHERE id = ?`,
        [approved_by, remarks || null, id]
      );

      await connection.commit();

      // Fetch updated request
      const [[updatedRequest]] = await pool.query(
        `SELECT 
          acr.*,
          e.name as employee_name,
          e.email as employee_email,
          approver.name as approver_name
        FROM attendance_correction_requests acr
        LEFT JOIN employees e ON acr.empid = e.empid
        LEFT JOIN employees approver ON acr.approved_by = approver.empid
        WHERE acr.id = ?`,
        [id]
      );

      res.json({
        message: "Correction request approved and attendance record updated",
        request: updatedRequest,
        attendance_record_id: attendanceRecordId,
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
 * POST /attendance/corrections/:id/reject
 * Reject an attendance correction request
 */
router.post("/:id/reject", async (req, res, next) => {
  const { id } = req.params;
  const { approved_by, rejection_reason } = req.body;

  try {
    if (!approved_by) {
      throw new ApiError("approved_by is required", 400);
    }

    if (!rejection_reason) {
      throw new ApiError("rejection_reason is required when rejecting", 400);
    }

    // Get the correction request
    const [[request]] = await pool.query(
      `SELECT 
        acr.*,
        e.manager_id
      FROM attendance_correction_requests acr
      LEFT JOIN employees e ON acr.empid = e.empid
      WHERE acr.id = ? AND acr.status = 'PENDING'`,
      [id]
    );

    if (!request) {
      throw new ApiError(
        "Correction request not found or already processed",
        404
      );
    }

    // Verify approver is manager of the employee
    const [[manager]] = await pool.query(
      "SELECT empid FROM employees WHERE empid = ? AND manager_id = ?",
      [request.empid, approved_by]
    );

    if (!manager) {
      throw new ApiError(
        "Only the employee's manager can reject this request",
        403
      );
    }

    // Update correction request status
    const [result] = await pool.query(
      `UPDATE attendance_correction_requests 
      SET status = 'REJECTED',
          approved_by = ?,
          approved_at = NOW(),
          rejection_reason = ?,
          updated_at = NOW()
      WHERE id = ?`,
      [approved_by, rejection_reason, id]
    );

    if (result.affectedRows === 0) {
      throw new ApiError("Failed to reject correction request", 500);
    }

    // Fetch updated request
    const [[updatedRequest]] = await pool.query(
      `SELECT 
        acr.*,
        e.name as employee_name,
        e.email as employee_email,
        approver.name as approver_name
      FROM attendance_correction_requests acr
      LEFT JOIN employees e ON acr.empid = e.empid
      LEFT JOIN employees approver ON acr.approved_by = approver.empid
      WHERE acr.id = ?`,
      [id]
    );

    res.json({
      message: "Correction request rejected",
      request: updatedRequest,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /attendance/corrections/:id/cancel
 * Cancel an attendance correction request (by employee)
 */
router.post("/:id/cancel", async (req, res, next) => {
  const { id } = req.params;
  const { empid } = req.body;

  try {
    if (!empid) {
      throw new ApiError("empid is required", 400);
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
});

module.exports = router;
