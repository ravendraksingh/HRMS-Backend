// routes/managers/employeeLeaves.js
// Manager Employee Leaves Routes
const express = require("express");
const router = express.Router();
const pool = require("../../db");
const ApiError = require("../../errors/ApiError");
const { SELECT_EMPLOYEE_NAME, SELECT_EMPLOYEE_BY_MANAGER } = require("../../queries/employees");
const logger = require("../../util/logger");

/**
 * GET /managers/:managerEmpId/employees/:employeeId/leaves
 * Get leave details for a specific employee reporting to a manager
 * Query params: start_date (optional, YYYY-MM-DD), end_date (optional, YYYY-MM-DD), status (optional)
 * Returns: List of leaves for the specific employee
 *   - If start_date and end_date are provided: returns leaves that overlap with the date range
 *   - If not provided: returns all leaves for the employee
 * 
 * NOTE: This route must be defined BEFORE the general /employees/leaves route
 * to ensure proper route matching in Express
 */
router.get(
  "/:managerEmpId/employees/:employeeId/leaves",
  async (req, res, next) => {
    const managerEmpId = req.params.managerEmpId;
    const employeeId = req.params.employeeId;
    const { start_date, end_date, status } = req.query;
    const requestedBy = req.user?.empid || 'unknown';

    logger.info(
      { 
        route: '/managers/:managerEmpId/employees/:employeeId/leaves', 
        method: 'GET',
        managerEmpId, 
        employeeId,
        requestedBy,
        start_date,
        end_date,
        status,
        ip: req.ip
      }, 
      'Manager fetching employee leaves'
    );

    try {
      // Verify manager exists
      const [[manager]] = await pool.query(
        SELECT_EMPLOYEE_NAME,
        [managerEmpId]
      );

      if (!manager) {
        logger.warn({ route: '/managers/:managerEmpId/employees/:employeeId/leaves', method: 'GET', managerEmpId, requestedBy }, 'Manager not found');
        throw new ApiError("Manager not found", 404);
      }

      // Verify employee exists and reports to this manager
      const [[employee]] = await pool.query(
        `SELECT 
          e.empid,
          e.name,
          e.email,
          e.manager_id,
          d.name as department_name
        FROM employees e
        LEFT JOIN departments d ON e.department_id = d.deptid
        WHERE e.empid = ? AND e.manager_id = ?`,
        [employeeId, managerEmpId]
      );

      if (!employee) {
        throw new ApiError(
          "Employee not found or doesn't report to this manager",
          404
        );
      }

      // Build query conditions
      let where = ["l.empid = ?"];
      let params = [employeeId];

      // Find leaves that overlap with the date range (if provided)
      // A leave overlaps if: leave.start_date <= end_date AND leave.end_date >= start_date
      if (start_date && end_date) {
        where.push("l.start_date <= ?");
        params.push(end_date);
        where.push("l.end_date >= ?");
        params.push(start_date);
      } else if (start_date) {
        // If only start_date is provided, get leaves that end on or after start_date
        where.push("l.end_date >= ?");
        params.push(start_date);
      } else if (end_date) {
        // If only end_date is provided, get leaves that start on or before end_date
        where.push("l.start_date <= ?");
        params.push(end_date);
      }

      if (status) {
        where.push("l.status = ?");
        params.push(status);
      }

      const whereSql = `WHERE ${where.join(" AND ")}`;

      // Get leaves with employee and leave type details
      const [rows] = await pool.query(
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
          DATE_FORMAT(l.cancelled_at, '%Y-%m-%d %H:%i:%s') as cancelled_at,
          l.remarks,
          DATE_FORMAT(l.applied_at, '%Y-%m-%d') as applied_at,
          lt.name as leave_type_name
        FROM leaves l
        LEFT JOIN leave_types lt ON l.leavetype_id = lt.leavetype_id
        ${whereSql}
        ORDER BY l.start_date DESC, l.id DESC`,
        params
      );

      // Add leave type name to each leave record
      const leavesWithDetails = rows.map((row) => {
        return {
          ...row,
          leave_type_name: row?.leave_type_name || null,
        };
      });

      logger.debug(
        { 
          route: '/managers/:managerEmpId/employees/:employeeId/leaves', 
          method: 'GET',
          managerEmpId, 
          employeeId,
          requestedBy,
          leavesCount: leavesWithDetails.length
        }, 
        'Employee leaves retrieved successfully'
      );

      res.json({
        manager_empid: managerEmpId,
        manager_name: manager.name,
        employee_id: employeeId,
        employee_name: employee.name,
        employee_email: employee.email,
        department_name: employee.department_name,
        start_date: start_date || null,
        end_date: end_date || null,
        status: status || null,
        count: leavesWithDetails.length,
        leaves: leavesWithDetails,
      });
    } catch (error) {
      logger.error(
        { 
          route: '/managers/:managerEmpId/employees/:employeeId/leaves', 
          method: 'GET',
          managerEmpId, 
          employeeId,
          requestedBy,
          error: error.message,
          stack: error.stack,
          ip: req.ip
        }, 
        'Error fetching employee leaves'
      );
      next(error);
    }
  }
);

/**
 * GET /managers/:managerEmpId/employees/leaves
 * Get leave details for all employees reporting to a manager
 * Query params: start_date (optional, YYYY-MM-DD), end_date (optional, YYYY-MM-DD), status (optional)
 * Returns: List of leaves for all team members
 *   - If start_date and end_date are provided: returns leaves that overlap with the date range
 *   - If not provided: returns all leaves for team members
 */
router.get("/:managerEmpId/employees/leaves", async (req, res, next) => {
  const managerEmpId = req.params.managerEmpId;
  const { start_date, end_date, status } = req.query;
  const requestedBy = req.user?.empid || 'unknown';

  logger.info(
    { 
      route: '/managers/:managerEmpId/employees/leaves', 
      method: 'GET',
      managerEmpId, 
      requestedBy,
      start_date,
      end_date,
      status,
      ip: req.ip
    }, 
    'Manager fetching team leaves'
  );

  try {
    // Verify manager exists
    const [[manager]] = await pool.query(
      SELECT_EMPLOYEE_NAME,
      [managerEmpId]
    );

    if (!manager) {
      logger.warn({ route: '/managers/:managerEmpId/employees/leaves', method: 'GET', managerEmpId, requestedBy }, 'Manager not found');
      throw new ApiError("Manager not found", 404);
    }

    // Get all team member empids
    const [teamMembers] = await pool.query(
      "SELECT empid, name, email FROM employees WHERE manager_id = ?",
      [managerEmpId]
    );

    const teamMemberEmpids = teamMembers.map((e) => e.empid);

    if (teamMemberEmpids.length === 0) {
      return res.json({
        manager_empid: managerEmpId,
        manager_name: manager.name,
        start_date: start_date || null,
        end_date: end_date || null,
        status: status || null,
        count: 0,
        leaves: [],
      });
    }

    // Build query conditions
    let where = ["l.empid IN (?)"];
    let params = [teamMemberEmpids];

    // Find leaves that overlap with the date range (if provided)
    // A leave overlaps if: leave.start_date <= end_date AND leave.end_date >= start_date
    if (start_date && end_date) {
      where.push("l.start_date <= ?");
      params.push(end_date);
      where.push("l.end_date >= ?");
      params.push(start_date);
    } else if (start_date) {
      // If only start_date is provided, get leaves that end on or after start_date
      where.push("l.end_date >= ?");
      params.push(start_date);
    } else if (end_date) {
      // If only end_date is provided, get leaves that start on or before end_date
      where.push("l.start_date <= ?");
      params.push(end_date);
    }

    if (status) {
      where.push("l.status = ?");
      params.push(status);
    }

    const whereSql = `WHERE ${where.join(" AND ")}`;

    console.log("whereSql", whereSql);

    // Get leaves with employee details
    const [rows] = await pool.query(
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
        DATE_FORMAT(l.cancelled_at, '%Y-%m-%d %H:%i:%s') as cancelled_at,
        l.remarks,
        DATE_FORMAT(l.applied_at, '%Y-%m-%d') as applied_at,
        e.name as employee_name,
        e.email as employee_email,
        d.name as department_name,
        lt.name as leave_type_name
      FROM leaves l
      LEFT JOIN employees e ON l.empid = e.empid
      LEFT JOIN departments d ON e.department_id = d.deptid
      LEFT JOIN leave_types lt ON l.leavetype_id = lt.leavetype_id
      ${whereSql}
      ORDER BY l.start_date DESC, l.id DESC`,
      params
    );

    // Add employee details to each leave record
    const leavesWithDetails = rows.map((row) => {
      return {
        ...row,
        employee_name: row?.employee_name || null,
        employee_email: row?.employee_email || null,
        department_name: row?.department_name || null,
        leave_type_name: row?.leave_type_name || null,
      };
    });

    logger.debug(
      { 
        route: '/managers/:managerEmpId/employees/leaves', 
        method: 'GET',
        managerEmpId, 
        requestedBy,
        leavesCount: leavesWithDetails.length
      }, 
      'Team leaves retrieved successfully'
    );

    res.json({
      manager_empid: managerEmpId,
      manager_name: manager.name,
      start_date: start_date || null,
      end_date: end_date || null,
      status: status || null,
      count: leavesWithDetails.length,
      leaves: leavesWithDetails,
    });
  } catch (error) {
    logger.error(
      { 
        route: '/managers/:managerEmpId/employees/leaves', 
        method: 'GET',
        managerEmpId, 
        requestedBy,
        error: error.message,
        stack: error.stack,
        ip: req.ip
      }, 
      'Error fetching team leaves'
    );
    next(error);
  }
});

module.exports = router;
