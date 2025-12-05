// routes/managers/managers.js
const express = require("express");
const router = express.Router();
const pool = require("../../db");
const ApiError = require("../../errors/ApiError");
const { getTodayDate } = require("../../util/dateTimeUtil");
const { SELECT_EMPLOYEE_NAME } = require("../../queries/employees");
const logger = require("../../util/logger");

/**
 * GET /managers/:managerEmpId/employees
 * Get all direct reports (employees) for a manager
 * Returns detailed employee information
 */
router.get("/:managerEmpId/employees", async (req, res, next) => {
  const managerEmpId = req.params.managerEmpId;
  const requestedBy = req.user?.empid || 'unknown';

  logger.info(
    { 
      route: '/managers/:managerEmpId/employees', 
      method: 'GET',
      managerEmpId, 
      requestedBy,
      ip: req.ip
    }, 
    'Manager fetching team employees'
  );

  try {
    // Verify manager exists
    const [[manager]] = await pool.query(SELECT_EMPLOYEE_NAME, [managerEmpId]);

    if (!manager) {
      logger.warn({ route: '/managers/:managerEmpId/employees', method: 'GET', managerEmpId, requestedBy }, 'Manager not found');
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
      [managerEmpId]
    );

    logger.debug(
      { 
        route: '/managers/:managerEmpId/employees', 
        method: 'GET',
        managerEmpId, 
        requestedBy,
        employeesCount: employees.length
      }, 
      'Team employees retrieved successfully'
    );

    res.json({
      manager_id: managerEmpId,
      manager_name: manager.name,
      employees: employees,
      count: employees.length,
    });
  } catch (error) {
    logger.error(
      { 
        route: '/managers/:managerEmpId/employees', 
        method: 'GET',
        managerEmpId, 
        requestedBy,
        error: error.message,
        stack: error.stack,
        ip: req.ip
      }, 
      'Error fetching team employees'
    );
    next(error);
  }
});

/**
 * GET /managers/:managerEmpId/dashboard
 * Get team dashboard overview with summary statistics
 * Includes: team count, present/absent today, pending leaves, pending attendance corrections, upcoming birthdays/anniversaries
 */
router.get("/:managerEmpId/dashboard", async (req, res, next) => {
  const managerEmpId = req.params.managerEmpId;
  const { date } = req.query; // Optional date, defaults to today
  const requestedBy = req.user?.empid || 'unknown';

  logger.info(
    { 
      route: '/managers/:managerEmpId/dashboard', 
      method: 'GET',
      managerEmpId, 
      requestedBy,
      date,
      ip: req.ip
    }, 
    'Manager fetching dashboard'
  );

  try {
    // Verify manager exists
    const [[manager]] = await pool.query(SELECT_EMPLOYEE_NAME, [managerEmpId]);

    if (!manager) {
      logger.warn({ route: '/managers/:managerEmpId/dashboard', method: 'GET', managerEmpId, requestedBy }, 'Manager not found');
      throw new ApiError("Manager not found", 404);
    }

    // Get team members
    const [teamMembers] = await pool.query(
      "SELECT empid, name, email FROM employees WHERE manager_id = ?",
      [managerEmpId]
    );

    const teamMemberEmpids = teamMembers.map((e) => e.empid);
    const today = date || getTodayDate();

    // Initialize summary
    const summary = {
      total_team_members: teamMembers.length,
      present_today: 0,
      absent_today: 0,
      on_leave_today: 0,
      late_today: 0,
      pending_leave_requests: 0,
      pending_attendance_correction_requests: 0,
      upcoming_birthdays: [],
      upcoming_anniversaries: [],
    };

    if (teamMemberEmpids.length === 0) {
      return res.json({
        manager_empid: managerEmpId,
        manager_name: manager.name,
        date: today,
        summary,
        pending_attendance_corrections: [],
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

    // Get pending attendance correction requests
    const [pendingCorrections] = await pool.query(
      `SELECT 
        acr.id,
        acr.empid,
        acr.attendance_record_id,
        DATE_FORMAT(acr.correction_date, '%Y-%m-%d') as correction_date,
        DATE_FORMAT(acr.requested_check_in, '%Y-%m-%d %H:%i:%s') as requested_check_in,
        DATE_FORMAT(acr.requested_check_out, '%Y-%m-%d %H:%i:%s') as requested_check_out,
        acr.reason,
        DATE_FORMAT(acr.applied_at, '%Y-%m-%d') as applied_at,
        e.name as employee_name,
        e.email as employee_email,
        d.name as department_name
      FROM attendance_correction_requests acr
      LEFT JOIN employees e ON acr.empid = e.empid
      LEFT JOIN departments d ON e.department_id = d.deptid
      WHERE acr.empid IN (?)
        AND acr.status = 'PENDING'
      ORDER BY acr.applied_at DESC`,
      [teamMemberEmpids]
    );

    summary.pending_attendance_correction_requests = pendingCorrections.length;

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
      [managerEmpId]
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
        COALESCE(e.doj) as start_date
      FROM employees e
      WHERE e.manager_id = ?
        AND COALESCE(e.doj) IS NOT NULL
        AND DATE_FORMAT(COALESCE(e.doj), '%m-%d') >= DATE_FORMAT(CURDATE(), '%m-%d')
        AND DATE_FORMAT(COALESCE(e.doj), '%m-%d') <= DATE_FORMAT(DATE_ADD(CURDATE(), INTERVAL 30 DAY), '%m-%d')
      ORDER BY DATE_FORMAT(COALESCE(e.doj), '%m-%d')
      LIMIT 10`,
      [managerEmpId]
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

    logger.debug(
      { 
        route: '/managers/:managerEmpId/dashboard', 
        method: 'GET',
        managerEmpId, 
        requestedBy,
        date: today,
        teamSize: summary.total_team_members
      }, 
      'Dashboard retrieved successfully'
    );

    res.json({
      manager_empid: managerEmpId,
      manager_name: manager.name,
      date: today,
      summary,
      pending_attendance_corrections: pendingCorrections,
      attendance_rate_30_days: Math.round(attendanceRate * 100) / 100,
      attendance_stats_30_days: {
        present: stats.present_count || 0,
        absent: stats.absent_count || 0,
        half_day: stats.half_day_count || 0,
        total_records: totalRecords,
      },
    });
  } catch (error) {
    logger.error(
      { 
        route: '/managers/:managerEmpId/dashboard', 
        method: 'GET',
        managerEmpId, 
        requestedBy,
        error: error.message,
        stack: error.stack,
        ip: req.ip
      }, 
      'Error fetching dashboard'
    );
    next(error);
  }
});

module.exports = router;
