// routes/managers/managers.js
const express = require("express");
const router = express.Router();
const pool = require("../../db");
const ApiError = require("../../util/ApiError");
const { resolveEmployeeNumericId } = require("../../util/employeeUtil");

/**
 * GET /managers/:id
 * Get manager details by ID (can be numeric ID or employee_code)
 */
router.get("/:id", async (req, res, next) => {
  const managerIdParam = req.params.id;
  const organization_id = req.organizationId;

  try {
    // Resolve manager numeric ID if employee_code is provided
    const managerNumericId = await resolveEmployeeNumericId(
      managerIdParam,
      organization_id
    );

    // Get manager details with department and location info
    const [[manager]] = await pool.query(
      `SELECT 
        e.id,
        e.employee_code,
        e.name,
        e.email,
        e.manager_id,
        e.hr_manager_id,
        e.department_id,
        e.location_id,
        e.created_at,
        e.updated_at,
        d.name as department_name,
        d.department_code,
        loc.name as location_name,
        m.name as manager_name,
        m.employee_code as manager_code,
        hr.name as hr_manager_name,
        hr.employee_code as hr_manager_code
      FROM employees e
      LEFT JOIN departments d ON e.department_id = d.id
      LEFT JOIN office_locations loc ON e.location_id = loc.id
      LEFT JOIN employees m ON e.manager_id = m.id
      LEFT JOIN employees hr ON e.hr_manager_id = hr.id
      WHERE e.id = ? AND e.organization_id = ?`,
      [managerNumericId, organization_id]
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
  const organization_id = req.organizationId;

  try {
    // Resolve manager numeric ID if employee_code is provided
    const managerNumericId = await resolveEmployeeNumericId(
      managerIdParam,
      organization_id
    );

    // Verify manager exists
    const [[manager]] = await pool.query(
      "SELECT id, name FROM employees WHERE id = ? AND organization_id = ?",
      [managerNumericId, organization_id]
    );

    if (!manager) {
      throw new ApiError("Manager not found", 404);
    }

    // Get all direct reports with full details
    const [employees] = await pool.query(
      `SELECT 
        e.id as employee_id,
        e.employee_code,
        e.name,
        e.email,
        e.manager_id,
        e.hr_manager_id,
        e.department_id,
        e.location_id,
        d.name as department_name,
        d.department_code,
        loc.name as location_name,
        hr.name as hr_manager_name,
        hr.employee_code as hr_manager_code
      FROM employees e
      LEFT JOIN departments d ON e.department_id = d.id
      LEFT JOIN office_locations loc ON e.location_id = loc.id
      LEFT JOIN employees hr ON e.hr_manager_id = hr.id
      WHERE e.manager_id = ? AND e.organization_id = ?
      ORDER BY e.name`,
      [managerNumericId, organization_id]
    );

    res.json({
      manager_id: managerNumericId,
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
  const organization_id = req.organizationId;
  const { date } = req.query; // Optional date, defaults to today

  try {
    // Resolve manager numeric ID
    const managerNumericId = await resolveEmployeeNumericId(
      managerIdParam,
      organization_id
    );

    // Verify manager exists
    const [[manager]] = await pool.query(
      "SELECT id, name FROM employees WHERE id = ? AND organization_id = ?",
      [managerNumericId, organization_id]
    );

    if (!manager) {
      throw new ApiError("Manager not found", 404);
    }

    // Get team members
    const [teamMembers] = await pool.query(
      "SELECT id, employee_code, name, email FROM employees WHERE manager_id = ? AND organization_id = ?",
      [managerNumericId, organization_id]
    );

    const teamMemberIds = teamMembers.map((e) => e.id);
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

    if (teamMemberIds.length === 0) {
      return res.json({
        manager_id: managerNumericId,
        manager_name: manager.name,
        date: today,
        summary,
      });
    }

    // Get today's attendance
    const [todayAttendance] = await pool.query(
      `SELECT 
        employee_id,
        status,
        clock_in,
        clock_out
      FROM attendance_records
      WHERE organization_id = ? 
        AND work_date = ? 
        AND employee_id IN (?)
      ORDER BY employee_id`,
      [organization_id, today, teamMemberIds]
    );

    // Count attendance status
    todayAttendance.forEach((att) => {
      if (att.status === "present") {
        summary.present_today++;
        // Check if late (clock_in after 9:30 AM as example, adjust as needed)
        if (att.clock_in) {
          const clockInTime = new Date(att.clock_in);
          const expectedTime = new Date(`${today}T09:30:00`);
          if (clockInTime > expectedTime) {
            summary.late_today++;
          }
        }
      } else if (att.status === "absent") {
        summary.absent_today++;
      } else if (att.status === "on_leave") {
        summary.on_leave_today++;
      }
    });

    // Get pending leave requests
    const [pendingLeaves] = await pool.query(
      `SELECT COUNT(*) as count
      FROM attendance_leaves
      WHERE organization_id = ? 
        AND employee_id IN (?)
        AND status = 'pending'`,
      [organization_id, teamMemberIds]
    );

    summary.pending_leave_requests = pendingLeaves[0]?.count || 0;

    // Get upcoming birthdays (next 30 days)
    const [birthdays] = await pool.query(
      `SELECT 
        e.id,
        e.employee_code,
        e.name,
        ep.dob
      FROM employees e
      INNER JOIN employees_personal ep ON e.id = ep.employee_id
      WHERE e.manager_id = ? 
        AND e.organization_id = ?
        AND ep.dob IS NOT NULL
        AND DATE_FORMAT(ep.dob, '%m-%d') >= DATE_FORMAT(CURDATE(), '%m-%d')
        AND DATE_FORMAT(ep.dob, '%m-%d') <= DATE_FORMAT(DATE_ADD(CURDATE(), INTERVAL 30 DAY), '%m-%d')
      ORDER BY DATE_FORMAT(ep.dob, '%m-%d')
      LIMIT 10`,
      [managerNumericId, organization_id]
    );

    summary.upcoming_birthdays = birthdays.map((b) => ({
      employee_id: b.id,
      employee_code: b.employee_code,
      name: b.name,
      dob: b.dob,
    }));

    // Get upcoming work anniversaries (next 30 days) - based on created_at/employment start
    const [anniversaries] = await pool.query(
      `SELECT 
        e.id,
        e.employee_code,
        e.name,
        e.created_at
      FROM employees e
      WHERE e.manager_id = ? 
        AND e.organization_id = ?
        AND DATE_FORMAT(e.created_at, '%m-%d') >= DATE_FORMAT(CURDATE(), '%m-%d')
        AND DATE_FORMAT(e.created_at, '%m-%d') <= DATE_FORMAT(DATE_ADD(CURDATE(), INTERVAL 30 DAY), '%m-%d')
      ORDER BY DATE_FORMAT(e.created_at, '%m-%d')
      LIMIT 10`,
      [managerNumericId, organization_id]
    );

    summary.upcoming_anniversaries = anniversaries.map((a) => ({
      employee_id: a.id,
      employee_code: a.employee_code,
      name: a.name,
      start_date: a.created_at,
    }));

    // Calculate attendance rate (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const dateFrom = thirtyDaysAgo.toISOString().split("T")[0];

    const [attendanceStats] = await pool.query(
      `SELECT 
        COUNT(DISTINCT employee_id) as employees_with_records,
        SUM(CASE WHEN status = 'present' THEN 1 ELSE 0 END) as present_count,
        SUM(CASE WHEN status = 'absent' THEN 1 ELSE 0 END) as absent_count,
        SUM(CASE WHEN status = 'on_leave' THEN 1 ELSE 0 END) as on_leave_count
      FROM attendance_records
      WHERE organization_id = ? 
        AND work_date >= ? 
        AND employee_id IN (?)`,
      [organization_id, dateFrom, teamMemberIds]
    );

    const stats = attendanceStats[0] || {};
    const totalRecords =
      (stats.present_count || 0) +
      (stats.absent_count || 0) +
      (stats.on_leave_count || 0);
    const attendanceRate =
      totalRecords > 0
        ? ((stats.present_count || 0) / totalRecords) * 100
        : 0;

    res.json({
      manager_id: managerNumericId,
      manager_name: manager.name,
      date: today,
      summary,
      attendance_rate_30_days: Math.round(attendanceRate * 100) / 100,
      attendance_stats_30_days: {
        present: stats.present_count || 0,
        absent: stats.absent_count || 0,
        on_leave: stats.on_leave_count || 0,
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
  const organization_id = req.organizationId;
  const { from, to, status, employee_id } = req.query;

  try {
    // Resolve manager numeric ID
    const managerNumericId = await resolveEmployeeNumericId(
      managerIdParam,
      organization_id
    );

    // Verify manager exists
    const [[manager]] = await pool.query(
      "SELECT id, name FROM employees WHERE id = ? AND organization_id = ?",
      [managerNumericId, organization_id]
    );

    if (!manager) {
      throw new ApiError("Manager not found", 404);
    }

    // Get team member IDs
    let teamMemberIds = [];
    if (employee_id) {
      // Filter by specific employee if provided
      const employeeNumericId = await resolveEmployeeNumericId(
        employee_id,
        organization_id
      );
      // Verify employee reports to this manager
      const [[employee]] = await pool.query(
        "SELECT id FROM employees WHERE id = ? AND manager_id = ? AND organization_id = ?",
        [employeeNumericId, managerNumericId, organization_id]
      );
      if (!employee) {
        throw new ApiError(
          "Employee not found or doesn't report to this manager",
          404
        );
      }
      teamMemberIds = [employeeNumericId];
    } else {
      // Get all team members
      const [teamMembers] = await pool.query(
        "SELECT id FROM employees WHERE manager_id = ? AND organization_id = ?",
        [managerNumericId, organization_id]
      );
      teamMemberIds = teamMembers.map((e) => e.id);
    }

    if (teamMemberIds.length === 0) {
      return res.json({
        manager_id: managerNumericId,
        manager_name: manager.name,
        attendance: [],
        count: 0,
      });
    }

    // Build query
    const whereClauses = [
      "ar.organization_id = ?",
      "ar.employee_id IN (?)",
    ];
    const params = [organization_id, teamMemberIds];

    if (from) {
      whereClauses.push("ar.work_date >= ?");
      params.push(from);
    }
    if (to) {
      whereClauses.push("ar.work_date <= ?");
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
        ar.organization_id,
        ar.employee_id,
        ar.work_date,
        ar.shift_id,
        ar.clock_in,
        ar.clock_out,
        ar.break_minutes,
        ar.status,
        ar.source,
        ar.notes,
        ar.approved_by,
        ar.approved_at,
        ar.worked_minutes,
        ar.created_at,
        ar.updated_at,
        e.employee_code,
        e.name as employee_name,
        e.email as employee_email,
        d.name as department_name
      FROM attendance_records ar
      LEFT JOIN employees e ON ar.employee_id = e.id
      LEFT JOIN departments d ON e.department_id = d.id
      ${whereSql}
      ORDER BY ar.work_date DESC, e.name ASC`,
      params
    );

    res.json({
      manager_id: managerNumericId,
      manager_name: manager.name,
      attendance: attendance,
      count: attendance.length,
      filters: {
        from: from || null,
        to: to || null,
        status: status || null,
        employee_id: employee_id || null,
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
  const organization_id = req.organizationId;
  const { from, to, leave_type, employee_id } = req.query;

  try {
    // Resolve manager numeric ID
    const managerNumericId = await resolveEmployeeNumericId(
      managerIdParam,
      organization_id
    );

    // Verify manager exists
    const [[manager]] = await pool.query(
      "SELECT id, name FROM employees WHERE id = ? AND organization_id = ?",
      [managerNumericId, organization_id]
    );

    if (!manager) {
      throw new ApiError("Manager not found", 404);
    }

    // Get team member IDs
    let teamMemberIds = [];
    if (employee_id) {
      const employeeNumericId = await resolveEmployeeNumericId(
        employee_id,
        organization_id
      );
      const [[employee]] = await pool.query(
        "SELECT id FROM employees WHERE id = ? AND manager_id = ? AND organization_id = ?",
        [employeeNumericId, managerNumericId, organization_id]
      );
      if (!employee) {
        throw new ApiError(
          "Employee not found or doesn't report to this manager",
          404
        );
      }
      teamMemberIds = [employeeNumericId];
    } else {
      const [teamMembers] = await pool.query(
        "SELECT id FROM employees WHERE manager_id = ? AND organization_id = ?",
        [managerNumericId, organization_id]
      );
      teamMemberIds = teamMembers.map((e) => e.id);
    }

    if (teamMemberIds.length === 0) {
      return res.json({
        manager_id: managerNumericId,
        manager_name: manager.name,
        leaves: [],
        count: 0,
      });
    }

    // Build query
    const whereClauses = [
      "al.organization_id = ?",
      "al.employee_id IN (?)",
      "al.status = 'pending'",
    ];
    const params = [organization_id, teamMemberIds];

    if (from) {
      whereClauses.push("al.end_date >= ?");
      params.push(from);
    }
    if (to) {
      whereClauses.push("al.start_date <= ?");
      params.push(to);
    }
    if (leave_type) {
      whereClauses.push("al.leave_type = ?");
      params.push(leave_type);
    }

    const whereSql = `WHERE ${whereClauses.join(" AND ")}`;

    // Get pending leave requests with employee details
    const [leaves] = await pool.query(
      `SELECT 
        al.id,
        al.organization_id,
        al.employee_id,
        al.start_date,
        al.end_date,
        al.leave_type,
        al.status,
        al.reason,
        al.approved_by,
        al.approved_at,
        al.created_at,
        al.updated_at,
        e.employee_code,
        e.name as employee_name,
        e.email as employee_email,
        d.name as department_name,
        DATEDIFF(al.end_date, al.start_date) + 1 as days_count
      FROM attendance_leaves al
      LEFT JOIN employees e ON al.employee_id = e.id
      LEFT JOIN departments d ON e.department_id = d.id
      ${whereSql}
      ORDER BY al.created_at DESC`,
      params
    );

    res.json({
      manager_id: managerNumericId,
      manager_name: manager.name,
      leaves: leaves,
      count: leaves.length,
      filters: {
        from: from || null,
        to: to || null,
        leave_type: leave_type || null,
        employee_id: employee_id || null,
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
  const organization_id = req.organizationId;
  const { period = "30" } = req.query; // days, default 30

  try {
    // Resolve manager numeric ID
    const managerNumericId = await resolveEmployeeNumericId(
      managerIdParam,
      organization_id
    );

    // Verify manager exists
    const [[manager]] = await pool.query(
      "SELECT id, name FROM employees WHERE id = ? AND organization_id = ?",
      [managerNumericId, organization_id]
    );

    if (!manager) {
      throw new ApiError("Manager not found", 404);
    }

    // Get team members
    const [teamMembers] = await pool.query(
      "SELECT id, employee_code, name FROM employees WHERE manager_id = ? AND organization_id = ?",
      [managerNumericId, organization_id]
    );

    const teamMemberIds = teamMembers.map((e) => e.id);

    if (teamMemberIds.length === 0) {
      return res.json({
        manager_id: managerNumericId,
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
        work_date,
        COUNT(*) as total_records,
        SUM(CASE WHEN status = 'present' THEN 1 ELSE 0 END) as present_count,
        SUM(CASE WHEN status = 'absent' THEN 1 ELSE 0 END) as absent_count,
        SUM(CASE WHEN status = 'on_leave' THEN 1 ELSE 0 END) as on_leave_count,
        AVG(worked_minutes) as avg_work_minutes
      FROM attendance_records
      WHERE organization_id = ? 
        AND work_date >= ? 
        AND employee_id IN (?)
      GROUP BY work_date
      ORDER BY work_date DESC`,
      [organization_id, dateFromStr, teamMemberIds]
    );

    // Get attendance by status summary
    const [statusSummary] = await pool.query(
      `SELECT 
        status,
        COUNT(*) as count
      FROM attendance_records
      WHERE organization_id = ? 
        AND work_date >= ? 
        AND employee_id IN (?)
      GROUP BY status`,
      [organization_id, dateFromStr, teamMemberIds]
    );

    const attendanceByStatus = {};
    statusSummary.forEach((row) => {
      attendanceByStatus[row.status] = row.count;
    });

    // Get average work hours
    const [workHoursStats] = await pool.query(
      `SELECT 
        AVG(worked_minutes) as avg_work_minutes,
        SUM(worked_minutes) as total_work_minutes,
        COUNT(*) as records_with_hours
      FROM attendance_records
      WHERE organization_id = ? 
        AND work_date >= ? 
        AND employee_id IN (?)
        AND worked_minutes IS NOT NULL`,
      [organization_id, dateFromStr, teamMemberIds]
    );

    const avgWorkHours =
      workHoursStats[0]?.avg_work_minutes > 0
        ? (workHoursStats[0].avg_work_minutes / 60).toFixed(2)
        : 0;

    // Get leave utilization by employee
    const [leaveUtilization] = await pool.query(
      `SELECT 
        e.id as employee_id,
        e.employee_code,
        e.name as employee_name,
        COUNT(al.id) as total_leaves,
        SUM(CASE WHEN al.status = 'approved' THEN DATEDIFF(al.end_date, al.start_date) + 1 ELSE 0 END) as approved_days,
        SUM(CASE WHEN al.status = 'pending' THEN DATEDIFF(al.end_date, al.start_date) + 1 ELSE 0 END) as pending_days
      FROM employees e
      LEFT JOIN attendance_leaves al ON e.id = al.employee_id 
        AND al.organization_id = ?
        AND al.start_date >= ?
      WHERE e.manager_id = ? 
        AND e.organization_id = ?
      GROUP BY e.id, e.employee_code, e.name
      ORDER BY e.name`,
      [organization_id, dateFromStr, managerNumericId, organization_id]
    );

    res.json({
      manager_id: managerNumericId,
      manager_name: manager.name,
      period_days: days,
      date_from: dateFromStr,
      analytics: {
        attendance_trends: attendanceTrends,
        leave_utilization: leaveUtilization,
        attendance_by_status: attendanceByStatus,
        average_work_hours: parseFloat(avgWorkHours),
        total_team_members: teamMembers.length,
      },
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
