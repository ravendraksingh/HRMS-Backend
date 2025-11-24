// routes/managers/managers.js
const express = require("express");
const router = express.Router();
const pool = require("../../db");
const ApiError = require("../../util/ApiError");
/**
 * GET /managers/:id
 */
router.get("/:id", async (req, res, next) => {
  const managerId = req.params.id;
  try {
    const [[manager]] = await pool.query(
      `SELECT 
        e.empid,
        e.name,
        e.email,
        e.manager_id,
        e.hr_manager_id,
        e.department_id,
        e.location_id,
        e.created_at,
        e.updated_at,
        d.name as department_name,
        d.deptid as department_id,
        loc.name as location_name,
        m.name as manager_name,
        m.empid as manager_empid,
        hr.name as hr_manager_name,
        hr.empid as hr_manager_empid
      FROM employees e
      LEFT JOIN departments d ON e.department_id = d.deptid
      LEFT JOIN office_locations loc ON e.location_id = loc.id
      LEFT JOIN employees m ON e.manager_id = m.empid
      LEFT JOIN employees hr ON e.hr_manager_id = hr.empid
      WHERE e.empid = ?`,
      [managerId]
    );

    if (!manager) {
      throw new ApiError("Manager not found", 404);
    }

    res.json(manager);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /managers/:id/employees
 * Get all direct reports (employees) for a manager
 * Returns detailed employee information
 */
router.get("/:id/employees", async (req, res, next) => {
  const managerIdParam = req.params.id;
  try {
    // Verify manager exists
    const [[manager]] = await pool.query(
      "SELECT empid, name FROM employees WHERE empid = ?",
      [managerIdParam]
    );

    if (!manager) {
      throw new ApiError("Manager not found", 404);
    }

    // Get all direct reports with full details
    const [employees] = await pool.query(
      `SELECT 
        e.empid,
        e.name,
        e.email,
        e.hr_manager_id,
        e.department_id,
        e.location_id,
        e.department_id,
        loc.name as location_name
      FROM employees e
      LEFT JOIN office_locations loc ON e.location_id = loc.id
      WHERE e.manager_id = ?
      ORDER BY e.empid`,
      [managerIdParam]
    );

    res.json({
      manager_id: managerIdParam,
      manager_name: manager.name,
      employees: employees,
      count: employees.length,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /managers/:id/dashboard
 * Get team dashboard overview with summary statistics
 * Includes: team count, present/absent today, pending leaves, upcoming birthdays/anniversaries
 */
router.get("/:id/dashboard", async (req, res, next) => {
  const managerIdParam = req.params.id;
  const { date } = req.query; // Optional date, defaults to today

  try {
    // Verify manager exists
    const [[manager]] = await pool.query(
      "SELECT empid, name FROM employees WHERE empid = ?",
      [managerIdParam]
    );

    if (!manager) {
      throw new ApiError("Manager not found", 404);
    }

    // Get team members
    const [teamMembers] = await pool.query(
      "SELECT empid, name, email FROM employees WHERE manager_id = ?",
      [managerIdParam]
    );

    const teamMemberEmpids = teamMembers.map((e) => e.empid);
    const today = date || new Date().toISOString().split("T")[0]; // YYYY-MM-DD

    // Initialize summary
    const summary = {
      total_team_members: teamMembers.length,
      present_today: 0,
      absent_today: 0,
      on_leave_today: 0,
      late_today: 0,
      pending_leave_requests: 0,
      upcoming_birthdays: [],
      upcoming_anniversaries: [],
    };

    if (teamMemberEmpids.length === 0) {
      return res.json({
        manager_id: managerIdParam,
        manager_name: manager.name,
        date: today,
        summary,
      });
    }

    // Get today's attendance
    const [todayAttendance] = await pool.query(
      `SELECT 
        ar.empid,
        ar.status,
        ar.check_in_time,
        ar.check_out_time,
        ar.is_late
      FROM attendance_records ar
      WHERE ar.attendance_date = ? 
        AND ar.empid IN (?)
      ORDER BY ar.empid`,
      [today, teamMemberEmpids]
    );

    // Count attendance status
    todayAttendance.forEach((att) => {
      if (att.status === "PRESENT") {
        summary.present_today++;
        if (att.is_late === "Y") {
          summary.late_today++;
        }
      } else if (att.status === "ABSENT") {
        summary.absent_today++;
      } else if (att.status === "HALF_DAY") {
        summary.on_leave_today++;
      }
    });

    // Get pending leave requests
    const [pendingLeaves] = await pool.query(
      `SELECT COUNT(*) as count
      FROM leaves
      WHERE empid IN (?)
        AND status = 'PENDING'`,
      [teamMemberEmpids]
    );

    summary.pending_leave_requests = pendingLeaves[0]?.count || 0;

    // Get upcoming birthdays (next 30 days)
    const [birthdays] = await pool.query(
      `SELECT 
        e.empid,
        e.name,
        ep.date_of_birth
      FROM employees e
      INNER JOIN employee_personal_details ep ON e.empid = ep.empid
      WHERE e.manager_id = ?
        AND ep.date_of_birth IS NOT NULL
        AND DATE_FORMAT(ep.date_of_birth, '%m-%d') >= DATE_FORMAT(CURDATE(), '%m-%d')
        AND DATE_FORMAT(ep.date_of_birth, '%m-%d') <= DATE_FORMAT(DATE_ADD(CURDATE(), INTERVAL 30 DAY), '%m-%d')
      ORDER BY DATE_FORMAT(ep.date_of_birth, '%m-%d')
      LIMIT 10`,
      [managerIdParam]
    );

    summary.upcoming_birthdays = birthdays.map((b) => ({
      empid: b.empid,
      name: b.name,
      date_of_birth: b.date_of_birth,
    }));

    // Get upcoming work anniversaries (next 30 days) - based on doj or created_at
    const [anniversaries] = await pool.query(
      `SELECT 
        e.empid,
        e.name,
        COALESCE(e.doj, e.created_at) as start_date
      FROM employees e
      WHERE e.manager_id = ?
        AND COALESCE(e.doj, e.created_at) IS NOT NULL
        AND DATE_FORMAT(COALESCE(e.doj, e.created_at), '%m-%d') >= DATE_FORMAT(CURDATE(), '%m-%d')
        AND DATE_FORMAT(COALESCE(e.doj, e.created_at), '%m-%d') <= DATE_FORMAT(DATE_ADD(CURDATE(), INTERVAL 30 DAY), '%m-%d')
      ORDER BY DATE_FORMAT(COALESCE(e.doj, e.created_at), '%m-%d')
      LIMIT 10`,
      [managerIdParam]
    );

    summary.upcoming_anniversaries = anniversaries.map((a) => ({
      empid: a.empid,
      name: a.name,
      start_date: a.start_date,
    }));

    // Calculate attendance rate (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const dateFrom = thirtyDaysAgo.toISOString().split("T")[0];

    const [attendanceStats] = await pool.query(
      `SELECT 
        COUNT(DISTINCT ar.empid) as employees_with_records,
        SUM(CASE WHEN ar.status = 'PRESENT' THEN 1 ELSE 0 END) as present_count,
        SUM(CASE WHEN ar.status = 'ABSENT' THEN 1 ELSE 0 END) as absent_count,
        SUM(CASE WHEN ar.status = 'HALF_DAY' THEN 1 ELSE 0 END) as half_day_count
      FROM attendance_records ar
      WHERE ar.attendance_date >= ? 
        AND ar.empid IN (?)`,
      [dateFrom, teamMemberEmpids]
    );

    const stats = attendanceStats[0] || {};
    const totalRecords =
      (stats.present_count || 0) +
      (stats.absent_count || 0) +
      (stats.half_day_count || 0);
    const attendanceRate =
      totalRecords > 0 ? ((stats.present_count || 0) / totalRecords) * 100 : 0;

    res.json({
      manager_id: managerIdParam,
      manager_name: manager.name,
      date: today,
      summary,
      attendance_rate_30_days: Math.round(attendanceRate * 100) / 100,
      attendance_stats_30_days: {
        present: stats.present_count || 0,
        absent: stats.absent_count || 0,
        half_day: stats.half_day_count || 0,
        total_records: totalRecords,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /managers/:id/attendance
 * Get team attendance data with optional date range filtering
 */
router.get("/:id/attendance", async (req, res, next) => {
  const managerIdParam = req.params.id;
  const { from, to, status, empid } = req.query;

  try {
    // Verify manager exists
    const [[manager]] = await pool.query(
      "SELECT empid, name FROM employees WHERE empid = ?",
      [managerIdParam]
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
        [empid, managerIdParam]
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
        [managerIdParam]
      );
      teamMemberEmpids = teamMembers.map((e) => e.empid);
    }

    if (teamMemberEmpids.length === 0) {
      return res.json({
        manager_id: managerIdParam,
        manager_name: manager.name,
        attendance: [],
        count: 0,
      });
    }

    // Build query
    const whereClauses = ["ar.empid IN (?)"];
    const params = [teamMemberEmpids];

    if (from) {
      whereClauses.push("ar.attendance_date >= ?");
      params.push(from);
    }
    if (to) {
      whereClauses.push("ar.attendance_date <= ?");
      params.push(to);
    }
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
        ar.remarks,
        DATE_FORMAT(ar.created_at, '%Y-%m-%d %H:%i:%s') as created_at,
        DATE_FORMAT(ar.updated_at, '%Y-%m-%d %H:%i:%s') as updated_at,
        e.name as employee_name,
        e.email as employee_email,
        d.name as department_name
      FROM attendance_records ar
      LEFT JOIN employees e ON ar.empid = e.empid
      LEFT JOIN departments d ON e.department_id = d.deptid
      ${whereSql}
      ORDER BY ar.attendance_date DESC, e.name ASC`,
      params
    );

    res.json({
      manager_id: managerIdParam,
      manager_name: manager.name,
      attendance: attendance,
      count: attendance.length,
      filters: {
        from: from || null,
        to: to || null,
        status: status || null,
        empid: empid || null,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /managers/:id/attendance/corrections
 * Get pending attendance correction requests for team members
 */
router.get("/:id/attendance/corrections", async (req, res, next) => {
  const managerIdParam = req.params.id;
  const { from_date, to_date, empid } = req.query;

  try {
    // Verify manager exists
    const [[manager]] = await pool.query(
      "SELECT empid, name FROM employees WHERE empid = ?",
      [managerIdParam]
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
        [empid, managerIdParam]
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
        [managerIdParam]
      );
      teamMemberEmpids = teamMembers.map((e) => e.empid);
    }

    if (teamMemberEmpids.length === 0) {
      return res.json({
        manager_id: managerIdParam,
        manager_name: manager.name,
        corrections: [],
        count: 0,
      });
    }

    // Build query
    const whereClauses = ["acr.empid IN (?)", "acr.status = 'PENDING'"];
    const params = [teamMemberEmpids];

    if (from_date) {
      whereClauses.push("acr.correction_date >= ?");
      params.push(from_date);
    }
    if (to_date) {
      whereClauses.push("acr.correction_date <= ?");
      params.push(to_date);
    }

    const whereSql = `WHERE ${whereClauses.join(" AND ")}`;

    // Get pending correction requests with employee details
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
      manager_id: managerIdParam,
      manager_name: manager.name,
      corrections: corrections,
      count: corrections.length,
      filters: {
        from_date: from_date || null,
        to_date: to_date || null,
        empid: empid || null,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /managers/:id/leaves/pending
 * Get pending leave requests for team members
 */
router.get("/:id/leaves/pending", async (req, res, next) => {
  const managerIdParam = req.params.id;
  const { from, to, leavetype_id, empid } = req.query;

  try {
    // Verify manager exists
    const [[manager]] = await pool.query(
      "SELECT empid, name FROM employees WHERE empid = ?",
      [managerIdParam]
    );

    if (!manager) {
      throw new ApiError("Manager not found", 404);
    }

    // Get team member empids
    let teamMemberEmpids = [];
    if (empid) {
      const [[employee]] = await pool.query(
        "SELECT empid FROM employees WHERE empid = ? AND manager_id = ?",
        [empid, managerIdParam]
      );
      if (!employee) {
        throw new ApiError(
          "Employee not found or doesn't report to this manager",
          404
        );
      }
      teamMemberEmpids = [empid];
    } else {
      const [teamMembers] = await pool.query(
        "SELECT empid FROM employees WHERE manager_id = ?",
        [managerIdParam]
      );
      teamMemberEmpids = teamMembers.map((e) => e.empid);
    }

    if (teamMemberEmpids.length === 0) {
      return res.json({
        manager_id: managerIdParam,
        manager_name: manager.name,
        leaves: [],
        count: 0,
      });
    }

    // Build query
    const whereClauses = ["l.empid IN (?)", "l.status = 'PENDING'"];
    const params = [teamMemberEmpids];

    if (from) {
      whereClauses.push("l.end_date >= ?");
      params.push(from);
    }
    if (to) {
      whereClauses.push("l.start_date <= ?");
      params.push(to);
    }
    if (leavetype_id) {
      whereClauses.push("l.leavetype_id = ?");
      params.push(leavetype_id);
    }

    const whereSql = `WHERE ${whereClauses.join(" AND ")}`;

    // Get pending leave requests with employee details
    const [leaves] = await pool.query(
      `SELECT 
        l.id,
        l.empid,
        DATE_FORMAT(l.start_date, '%Y-%m-%d') as start_date,
        DATE_FORMAT(l.end_date, '%Y-%m-%d') as end_date,
        l.leavetype_id,
        l.total_days,
        l.status,
        l.reason,
        l.approved_by,
        DATE_FORMAT(l.approved_at, '%Y-%m-%d %H:%i:%s') as approved_at,
        DATE_FORMAT(l.applied_at, '%Y-%m-%d %H:%i:%s') as applied_at,
        DATE_FORMAT(l.created_at, '%Y-%m-%d %H:%i:%s') as created_at,
        DATE_FORMAT(l.updated_at, '%Y-%m-%d %H:%i:%s') as updated_at,
        e.name as employee_name,
        e.email as employee_email,
        d.name as department_name,
        lt.name as leave_type_name,
        DATEDIFF(l.end_date, l.start_date) + 1 as days_count
      FROM leaves l
      LEFT JOIN employees e ON l.empid = e.empid
      LEFT JOIN departments d ON e.department_id = d.deptid
      LEFT JOIN leave_types lt ON l.leavetype_id = lt.leavetype_id
      ${whereSql}
      ORDER BY l.created_at DESC`,
      params
    );

    res.json({
      manager_id: managerIdParam,
      manager_name: manager.name,
      leaves: leaves,
      count: leaves.length,
      filters: {
        from: from || null,
        to: to || null,
        leavetype_id: leavetype_id || null,
        empid: empid || null,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /managers/:id/analytics
 * Get team analytics including attendance trends, leave utilization, etc.
 */
router.get("/:id/analytics", async (req, res, next) => {
  const managerIdParam = req.params.id;
  const { period = "30" } = req.query; // days, default 30

  try {
    // Verify manager exists
    const [[manager]] = await pool.query(
      "SELECT empid, name FROM employees WHERE empid = ?",
      [managerIdParam]
    );

    if (!manager) {
      throw new ApiError("Manager not found", 404);
    }

    // Get team members
    const [teamMembers] = await pool.query(
      "SELECT empid, name FROM employees WHERE manager_id = ?",
      [managerIdParam]
    );

    const teamMemberEmpids = teamMembers.map((e) => e.empid);

    if (teamMemberEmpids.length === 0) {
      return res.json({
        manager_id: managerIdParam,
        manager_name: manager.name,
        period_days: parseInt(period),
        analytics: {
          attendance_trends: [],
          leave_utilization: [],
          attendance_by_status: {},
          average_work_hours: 0,
        },
      });
    }

    // Calculate date range
    const days = parseInt(period);
    const dateFrom = new Date();
    dateFrom.setDate(dateFrom.getDate() - days);
    const dateFromStr = dateFrom.toISOString().split("T")[0];

    // Get attendance trends (daily breakdown)
    const [attendanceTrends] = await pool.query(
      `SELECT 
        DATE_FORMAT(ar.attendance_date, '%Y-%m-%d') as attendance_date,
        COUNT(*) as total_records,
        SUM(CASE WHEN ar.status = 'PRESENT' THEN 1 ELSE 0 END) as present_count,
        SUM(CASE WHEN ar.status = 'ABSENT' THEN 1 ELSE 0 END) as absent_count,
        SUM(CASE WHEN ar.status = 'HALF_DAY' THEN 1 ELSE 0 END) as half_day_count,
        AVG(ar.total_work_hours) as avg_work_hours
      FROM attendance_records ar
      WHERE ar.attendance_date >= ? 
        AND ar.empid IN (?)
      GROUP BY ar.attendance_date
      ORDER BY ar.attendance_date DESC`,
      [dateFromStr, teamMemberEmpids]
    );

    // Get attendance by status summary
    const [statusSummary] = await pool.query(
      `SELECT 
        ar.status,
        COUNT(*) as count
      FROM attendance_records ar
      WHERE ar.attendance_date >= ? 
        AND ar.empid IN (?)
      GROUP BY ar.status`,
      [dateFromStr, teamMemberEmpids]
    );

    const attendanceByStatus = {};
    statusSummary.forEach((row) => {
      attendanceByStatus[row.status] = row.count;
    });

    // Get average work hours
    const [workHoursStats] = await pool.query(
      `SELECT 
        AVG(ar.total_work_hours) as avg_work_hours,
        SUM(ar.total_work_hours) as total_work_hours,
        COUNT(*) as records_with_hours
      FROM attendance_records ar
      WHERE ar.attendance_date >= ? 
        AND ar.empid IN (?)
        AND ar.total_work_hours IS NOT NULL`,
      [dateFromStr, teamMemberEmpids]
    );

    const avgWorkHours = workHoursStats[0]?.avg_work_hours || 0;

    // Get leave utilization by employee
    const [leaveUtilization] = await pool.query(
      `SELECT 
        e.empid,
        e.name as employee_name,
        COUNT(l.id) as total_leaves,
        SUM(CASE WHEN l.status = 'APPROVED' THEN l.total_days ELSE 0 END) as approved_days,
        SUM(CASE WHEN l.status = 'PENDING' THEN l.total_days ELSE 0 END) as pending_days
      FROM employees e
      LEFT JOIN leaves l ON e.empid = l.empid
        AND l.start_date >= ?
      WHERE e.manager_id = ?
      GROUP BY e.empid, e.name
      ORDER BY e.name`,
      [dateFromStr, managerIdParam]
    );

    res.json({
      manager_id: managerIdParam,
      manager_name: manager.name,
      period_days: days,
      date_from: dateFromStr,
      analytics: {
        attendance_trends: attendanceTrends,
        leave_utilization: leaveUtilization,
        attendance_by_status: attendanceByStatus,
        average_work_hours: parseFloat(avgWorkHours) || 0,
        total_team_members: teamMembers.length,
      },
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
