// routes/employees/leaves.js
// Employee Leave Summary APIs
const express = require("express");
const router = express.Router();
const pool = require("../../db");
const ApiError = require("../../util/ApiError");

/**
 * GET /employees/:empid/leaves/summary
 * Get leave summary for an employee
 * Query params: year (optional, defaults to current year)
 * Returns: Available leaves, leaves taken, pending leaves by leave type
 */
router.get("/:empid/leaves/summary", async (req, res, next) => {
  const { empid } = req.params;
  const { year } = req.query;

  try {
    // Validate employee exists
    const [[employee]] = await pool.query(
      "SELECT empid, name FROM employees WHERE empid = ?",
      [empid]
    );

    if (!employee) {
      throw new ApiError("Employee not found", 404);
    }

    // Use current year if not specified
    const currentYear = year || new Date().getFullYear();

    // Get leave balances for the year
    const [leaveBalances] = await pool.query(
      `SELECT 
        lb.leavetype_id,
        lb.current_balance,
        lb.opening_balance,
        lb.earned_leaves,
        lb.used_leaves,
        lb.carry_forward_balance,
        lt.name as leave_type_name
      FROM leave_balances lb
      LEFT JOIN leave_types lt ON lb.leavetype_id = lt.leavetype_id
      WHERE lb.empid = ? AND lb.year = ?
      ORDER BY lt.name`,
      [empid, currentYear]
    );

    // Get leaves taken (APPROVED) for the year
    const [leavesTaken] = await pool.query(
      `SELECT 
        leavetype_id,
        SUM(total_days) as total_days,
        COUNT(*) as leave_count
      FROM leaves
      WHERE empid = ? 
        AND status = 'APPROVED'
        AND YEAR(start_date) = ?
      GROUP BY leavetype_id`,
      [empid, currentYear]
    );

    // Get pending leaves for the year
    const [pendingLeaves] = await pool.query(
      `SELECT 
        leavetype_id,
        SUM(total_days) as total_days,
        COUNT(*) as leave_count
      FROM leaves
      WHERE empid = ? 
        AND status = 'PENDING'
        AND YEAR(start_date) = ?
      GROUP BY leavetype_id`,
      [empid, currentYear]
    );

    // Get rejected and cancelled leaves for the year (for reference)
    const [rejectedLeaves] = await pool.query(
      `SELECT 
        leavetype_id,
        SUM(total_days) as total_days,
        COUNT(*) as leave_count
      FROM leaves
      WHERE empid = ? 
        AND status IN ('REJECTED', 'CANCELLED')
        AND YEAR(start_date) = ?
      GROUP BY leavetype_id`,
      [empid, currentYear]
    );

    // Create maps for quick lookup
    const leavesTakenMap = new Map();
    leavesTaken.forEach((item) => {
      leavesTakenMap.set(item.leavetype_id, {
        total_days: parseFloat(item.total_days) || 0,
        leave_count: item.leave_count || 0,
      });
    });

    const pendingLeavesMap = new Map();
    pendingLeaves.forEach((item) => {
      pendingLeavesMap.set(item.leavetype_id, {
        total_days: parseFloat(item.total_days) || 0,
        leave_count: item.leave_count || 0,
      });
    });

    const rejectedLeavesMap = new Map();
    rejectedLeaves.forEach((item) => {
      rejectedLeavesMap.set(item.leavetype_id, {
        total_days: parseFloat(item.total_days) || 0,
        leave_count: item.leave_count || 0,
      });
    });

    // Build summary by leave type
    const summaryByType = leaveBalances.map((balance) => {
      const leavetype_id = balance.leavetype_id;
      const taken = leavesTakenMap.get(leavetype_id) || {
        total_days: 0,
        leave_count: 0,
      };
      const pending = pendingLeavesMap.get(leavetype_id) || {
        total_days: 0,
        leave_count: 0,
      };
      const rejected = rejectedLeavesMap.get(leavetype_id) || {
        total_days: 0,
        leave_count: 0,
      };

      return {
        leavetype_id: leavetype_id,
        leave_type_name: balance.leave_type_name,
        available: parseFloat(balance.current_balance) || 0,
        opening_balance: parseFloat(balance.opening_balance) || 0,
        earned: parseFloat(balance.earned_leaves) || 0,
        used: parseFloat(balance.used_leaves) || 0,
        carry_forward: parseFloat(balance.carry_forward_balance) || 0,
        taken: taken.total_days,
        taken_count: taken.leave_count,
        pending: pending.total_days,
        pending_count: pending.leave_count,
        rejected: rejected.total_days,
        rejected_count: rejected.leave_count,
      };
    });

    // Calculate totals
    const totals = {
      available: summaryByType.reduce(
        (sum, item) => sum + item.available,
        0
      ),
      taken: summaryByType.reduce((sum, item) => sum + item.taken, 0),
      pending: summaryByType.reduce((sum, item) => sum + item.pending, 0),
      rejected: summaryByType.reduce((sum, item) => sum + item.rejected, 0),
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

