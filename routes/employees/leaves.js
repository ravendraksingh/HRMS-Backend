// routes/employees/leaves.js
// Employee Leave Summary APIs
const express = require("express");
const router = express.Router();
const pool = require("../../db");
const ApiError = require("../../errors/ApiError");
const { SELECT_EMPLOYEE_EXISTS, SELECT_EMPLOYEE_NAME } = require("../../queries/employees");
const {
  getLeavesQuerySchema,
  createLeaveSchema,
} = require("../../validations/leaveSchemas");
const { handleValidationErrors } = require("../../util/validation");

/**
 * GET /employees/:empid/leaves
 * Get all leaves for an employee
 * Query params: start_date (optional, YYYY-MM-DD), end_date (optional, YYYY-MM-DD), status (optional)
 * Returns: List of leaves for the employee
 *   - If start_date and end_date are provided: returns leaves that overlap with the date range
 *   - If not provided: returns all leaves for the employee
 */
router.get(
  "/:empid/leaves",
//   getLeavesQuerySchema,
//   handleValidationErrors,
  async (req, res, next) => {
    const { empid } = req.params;
    const { start_date, end_date, status } = req.query;

    try {
      // Validate employee exists
      const [[employee]] = await pool.query(
        SELECT_EMPLOYEE_EXISTS,
        [empid]
      );

      if (!employee) {
        throw new ApiError("Employee not found", 404);
      }

      let where = ["l.empid = ?"];
      let params = [empid];

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
      // If neither is provided, return all leaves (no additional date filter)

      if (status) {
        where.push("l.status = ?");
        params.push(status);
      }

      const whereSql = `WHERE ${where.join(" AND ")}`;
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
        DATE_FORMAT(l.applied_at, '%Y-%m-%d') as applied_at
      FROM leaves l
      ${whereSql} 
      ORDER BY l.start_date DESC, l.id DESC`,
        params
      );

      res.json({
        empid: empid,
        start_date: start_date || null,
        end_date: end_date || null,
        count: rows.length,
        leaves: rows,
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /employees/:empid/leaves
 * Create a new leave for an employee
 * Body: start_date, end_date, leavetype_id, reason (optional), medical_certificate_url (optional)
 * Returns: Created leave ID
 */
router.post(
  "/:empid/leaves",
  createLeaveSchema,
  handleValidationErrors,
  async (req, res, next) => {
    const { empid } = req.params;
    const {
      start_date,
      end_date,
      leavetype_id,
      reason = null,
      medical_certificate_url = null,
    } = req.body;

    try {
      // Validate employee exists
      const [[employee]] = await pool.query(
        SELECT_EMPLOYEE_EXISTS,
        [empid]
      );

      if (!employee) {
        throw new ApiError("Employee not found", 404);
      }

      // Validate leave type exists and is active
      const [[leaveType]] = await pool.query(
        `SELECT *
       FROM leave_types
       WHERE leavetype_id = ? AND is_active = 'Y'`,
        [leavetype_id]
      );

      if (!leaveType) {
        throw new ApiError(
          `Leave type with id '${leavetype_id}' not found or inactive`,
          404
        );
      }

      // Calculate total days
      const startDate = new Date(start_date);
      const endDate = new Date(end_date);
      const timeDiff = endDate.getTime() - startDate.getTime();
      const totalDays = Math.ceil(timeDiff / (1000 * 60 * 60 * 24)) + 1;

      const [result] = await pool.query(
        "INSERT INTO leaves (empid, leavetype_id, start_date, end_date, total_days, reason, medical_certificate_url) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [
          empid,
          leavetype_id,
          start_date,
          end_date,
          totalDays,
          reason,
          medical_certificate_url,
        ]
      );
      res.status(201).json({ id: result.insertId });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /employees/:empid/leaves/summary/yearly
 * Get yearly leave summary for an employee
 * Query params: year (optional, defaults to current year)
 * Returns: Yearly leave summary with balances, usage, and statistics
 */
router.get("/:empid/leaves/summary/yearly", async (req, res, next) => {
  const { empid } = req.params;
  const { year } = req.query;

  try {
    // Validate employee exists
    const [[employee]] = await pool.query(
      SELECT_EMPLOYEE_NAME,
      [empid]
    );

    if (!employee) {
      throw new ApiError("Employee not found", 404);
    }

    // Use current year if not specified
    const currentYear = year ? parseInt(year) : new Date().getFullYear();

    // Validate year is a valid number
    if (isNaN(currentYear) || currentYear < 2000 || currentYear > 2100) {
      throw new ApiError(
        "Invalid year. Year must be between 2000 and 2100",
        400
      );
    }

    // Get leave balances for the year
    const [leaveBalances] = await pool.query(
      `SELECT 
        lb.leavetype_id,
        lb.current_balance,
        lb.opening_balance,
        lb.earned_leaves,
        lb.used_leaves,
        lb.carry_forward_balance,
        lt.name as leave_type_name,
        lt.max_leaves_per_year
      FROM leave_balances lb
      LEFT JOIN leave_types lt ON lb.leavetype_id = lt.leavetype_id
      WHERE lb.empid = ? AND lb.year = ?
      ORDER BY lt.name`,
      [empid, currentYear]
    );

    // Get all leaves for the year grouped by status and leave type
    const [leavesByStatus] = await pool.query(
      `SELECT 
        leavetype_id,
        status,
        SUM(total_days) as total_days,
        COUNT(*) as leave_count
      FROM leaves
      WHERE empid = ? 
        AND YEAR(start_date) = ?
      GROUP BY leavetype_id, status`,
      [empid, currentYear]
    );

    // Get monthly breakdown of leaves
    const [monthlyLeaves] = await pool.query(
      `SELECT 
        MONTH(start_date) as month,
        leavetype_id,
        SUM(total_days) as total_days,
        COUNT(*) as leave_count
      FROM leaves
      WHERE empid = ? 
        AND YEAR(start_date) = ?
        AND status = 'APPROVED'
      GROUP BY MONTH(start_date), leavetype_id
      ORDER BY month, leavetype_id`,
      [empid, currentYear]
    );

    // Create maps for quick lookup
    const leavesByStatusMap = new Map();
    leavesByStatus.forEach((item) => {
      const key = `${item.leavetype_id}_${item.status}`;
      leavesByStatusMap.set(key, {
        total_days: parseFloat(item.total_days) || 0,
        leave_count: item.leave_count || 0,
      });
    });

    // Build monthly breakdown map
    const monthlyMap = new Map();
    monthlyLeaves.forEach((item) => {
      const key = `${item.month}_${item.leavetype_id}`;
      monthlyMap.set(key, {
        total_days: parseFloat(item.total_days) || 0,
        leave_count: item.leave_count || 0,
      });
    });

    // Build summary by leave type
    const summaryByType = leaveBalances.map((balance) => {
      const leavetype_id = balance.leavetype_id;

      const approved = leavesByStatusMap.get(`${leavetype_id}_APPROVED`) || {
        total_days: 0,
        leave_count: 0,
      };
      const pending = leavesByStatusMap.get(`${leavetype_id}_PENDING`) || {
        total_days: 0,
        leave_count: 0,
      };
      const rejected = leavesByStatusMap.get(`${leavetype_id}_REJECTED`) || {
        total_days: 0,
        leave_count: 0,
      };
      const cancelled = leavesByStatusMap.get(`${leavetype_id}_CANCELLED`) || {
        total_days: 0,
        leave_count: 0,
      };

      // Build monthly breakdown for this leave type
      const monthlyBreakdown = [];
      for (let month = 1; month <= 12; month++) {
        const monthlyData = monthlyMap.get(`${month}_${leavetype_id}`) || {
          total_days: 0,
          leave_count: 0,
        };
        monthlyBreakdown.push({
          month: month,
          month_name: new Date(currentYear, month - 1, 1).toLocaleString(
            "default",
            { month: "long" }
          ),
          total_days: monthlyData.total_days,
          leave_count: monthlyData.leave_count,
        });
      }

      return {
        leavetype_id: leavetype_id,
        leave_type_name: balance.leave_type_name,
        max_leaves_per_year: balance.max_leaves_per_year,
        opening_balance: parseFloat(balance.opening_balance) || 0,
        earned: parseFloat(balance.earned_leaves) || 0,
        used: parseFloat(balance.used_leaves) || 0,
        carry_forward: parseFloat(balance.carry_forward_balance) || 0,
        current_balance: parseFloat(balance.current_balance) || 0,
        approved: {
          total_days: approved.total_days,
          leave_count: approved.leave_count,
        },
        pending: {
          total_days: pending.total_days,
          leave_count: pending.leave_count,
        },
        rejected: {
          total_days: rejected.total_days,
          leave_count: rejected.leave_count,
        },
        cancelled: {
          total_days: cancelled.total_days,
          leave_count: cancelled.leave_count,
        },
        monthly_breakdown: monthlyBreakdown,
      };
    });

    // Calculate yearly totals
    const totals = {
      opening_balance: summaryByType.reduce(
        (sum, item) => sum + item.opening_balance,
        0
      ),
      earned: summaryByType.reduce((sum, item) => sum + item.earned, 0),
      used: summaryByType.reduce((sum, item) => sum + item.used, 0),
      carry_forward: summaryByType.reduce(
        (sum, item) => sum + item.carry_forward,
        0
      ),
      current_balance: summaryByType.reduce(
        (sum, item) => sum + item.current_balance,
        0
      ),
      approved: {
        total_days: summaryByType.reduce(
          (sum, item) => sum + item.approved.total_days,
          0
        ),
        leave_count: summaryByType.reduce(
          (sum, item) => sum + item.approved.leave_count,
          0
        ),
      },
      pending: {
        total_days: summaryByType.reduce(
          (sum, item) => sum + item.pending.total_days,
          0
        ),
        leave_count: summaryByType.reduce(
          (sum, item) => sum + item.pending.leave_count,
          0
        ),
      },
      rejected: {
        total_days: summaryByType.reduce(
          (sum, item) => sum + item.rejected.total_days,
          0
        ),
        leave_count: summaryByType.reduce(
          (sum, item) => sum + item.rejected.leave_count,
          0
        ),
      },
      cancelled: {
        total_days: summaryByType.reduce(
          (sum, item) => sum + item.cancelled.total_days,
          0
        ),
        leave_count: summaryByType.reduce(
          (sum, item) => sum + item.cancelled.leave_count,
          0
        ),
      },
    };

    res.json({
      empid: empid,
      employee_name: employee.name,
      year: currentYear,
      summary_by_type: summaryByType,
      totals: totals,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
