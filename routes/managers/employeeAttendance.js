// routes/managers/employeeAttendance.js
// Manager Employee Attendance Routes
const express = require("express");
const router = express.Router();
const pool = require("../../db");
const ApiError = require("../../errors/ApiError");

/**
 * GET /managers/:managerEmpId/employees/attendance
 * Get team attendance data with optional date range filtering
 */
router.get("/:managerEmpId/employees/attendance", async (req, res, next) => {
  const managerEmpId = req.params.managerEmpId;
  const { start_date, end_date, status, empid } = req.query;

  try {
    // Verify manager exists
    const [[manager]] = await pool.query(
      "SELECT empid, name FROM employees WHERE empid = ?",
      [managerEmpId]
    );

    if (!manager) {
      throw new ApiError("Manager not found", 404);
    }

    // Get team member empids
    let teamMemberEmpids = [];
    if (empid) {
      // Filter by specific employee if provided
      // Verify employee reports to this manager
      const [[employee]] = await pool.query(
        "SELECT empid FROM employees WHERE empid = ? AND manager_id = ?",
        [empid, managerEmpId]
      );
      if (!employee) {
        throw new ApiError(
          "Employee not found or doesn't report to this manager",
          404
        );
      }
      teamMemberEmpids = [empid];
    } else {
      // Get all team members
      const [teamMembers] = await pool.query(
        "SELECT empid FROM employees WHERE manager_id = ?",
        [managerEmpId]
      );
      teamMemberEmpids = teamMembers.map((e) => e.empid);
    }

    if (teamMemberEmpids.length === 0) {
      return res.json({
        manager_empid: managerEmpId,
        manager_name: manager.name,
        attendance: [],
        count: 0,
      });
    }

    // Handle date filters - co-mandatory, default to today's date
    let finalStartDate = start_date;
    let finalEndDate = end_date;

    // If one is provided but not the other, throw error
    if ((start_date && !end_date) || (!start_date && end_date)) {
      throw new ApiError(
        "start_date and end_date are co-mandatory. Both must be provided together.",
        400
      );
    }

    // If neither is provided, default to today's date
    if (!start_date && !end_date) {
      const today = new Date();
      const todayStr = today.toISOString().split("T")[0]; // Format: YYYY-MM-DD
      finalStartDate = todayStr;
      finalEndDate = todayStr;
    }

    // Build query
    const whereClauses = ["ar.empid IN (?)"];
    const params = [teamMemberEmpids];

    whereClauses.push("ar.attendance_date >= ?");
    params.push(finalStartDate);
    whereClauses.push("ar.attendance_date <= ?");
    params.push(finalEndDate);

    if (status) {
      whereClauses.push("ar.status = ?");
      params.push(status);
    }

    const whereSql = `WHERE ${whereClauses.join(" AND ")}`;

    // Get attendance records with employee details
    const [attendance] = await pool.query(
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
      ${whereSql}
      ORDER BY ar.attendance_date DESC`,
      params
    );

    res.json({
      manager_empid: managerEmpId,
      manager_name: manager.name,
      count: attendance.length,
      filters: {
        start_date: finalStartDate,
        end_date: finalEndDate,
        status: status || null,
        empid: empid || null,
      },
      attendance: attendance,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /managers/:managerEmpId/employees/attendance/corrections
 * Get attendance correction requests for team members (all statuses)
 * Query params: from_date (optional), to_date (optional), empid (optional), status (optional)
 */
router.get(
  "/:managerEmpId/employees/attendance/corrections",
  async (req, res, next) => {
    const managerEmpId = req.params.managerEmpId;
    const { from_date, to_date, empid, status } = req.query;

    try {
      // Verify manager exists
      const [[manager]] = await pool.query(
        "SELECT empid, name FROM employees WHERE empid = ?",
        [managerEmpId]
      );

      if (!manager) {
        throw new ApiError("Manager not found", 404);
      }

      // Get team member empids
      let teamMemberEmpids = [];
      if (empid) {
        // Filter by specific employee if provided
        const [[employee]] = await pool.query(
          "SELECT empid FROM employees WHERE empid = ? AND manager_id = ?",
          [empid, managerEmpId]
        );
        if (!employee) {
          throw new ApiError(
            "Employee not found or doesn't report to this manager",
            404
          );
        }
        teamMemberEmpids = [empid];
      } else {
        // Get all team members
        const [teamMembers] = await pool.query(
          "SELECT empid FROM employees WHERE manager_id = ?",
          [managerEmpId]
        );
        teamMemberEmpids = teamMembers.map((e) => e.empid);
      }

      if (teamMemberEmpids.length === 0) {
        return res.json({
          manager_id: managerEmpId,
          manager_name: manager.name,
          corrections: [],
          count: 0,
        });
      }

      // Build query
      const whereClauses = ["acr.empid IN (?)"];
      const params = [teamMemberEmpids];

      if (status) {
        if (
          !["PENDING", "APPROVED", "REJECTED"].includes(status.toUpperCase())
        ) {
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

      const whereSql = `WHERE ${whereClauses.join(" AND ")}`;

      // Get correction requests with employee details
      const [corrections] = await pool.query(
        `SELECT 
        acr.id,
        acr.empid,
        acr.attendance_record_id,
        DATE_FORMAT(acr.correction_date, '%Y-%m-%d') as correction_date,
        DATE_FORMAT(acr.requested_check_in, '%Y-%m-%d %H:%i:%s') as requested_check_in,
        DATE_FORMAT(acr.requested_check_out, '%Y-%m-%d %H:%i:%s') as requested_check_out,
        acr.reason,
        acr.status,
        DATE_FORMAT(acr.applied_at, '%Y-%m-%d') as applied_at,
        e.name as employee_name,
        e.email as employee_email,
        d.name as department_name
      FROM attendance_correction_requests acr
      LEFT JOIN employees e ON acr.empid = e.empid
      LEFT JOIN departments d ON e.department_id = d.deptid
      ${whereSql}
      ORDER BY acr.applied_at DESC`,
        params
      );

      res.json({
        manager_id: managerEmpId,
        manager_name: manager.name,
        corrections: corrections,
        count: corrections.length,
        filters: {
          from_date: from_date || null,
          to_date: to_date || null,
          empid: empid || null,
          status: status || null,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;
