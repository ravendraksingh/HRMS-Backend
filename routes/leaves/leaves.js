const express = require("express");
const router = express.Router();
const pool = require("../../db");
const ApiError = require("../../errors/ApiError");
const { SELECT_EMPLOYEE_EXISTS } = require("../../queries/employees");

router.get("/:id", async (req, res, next) => {
  try {
    const [[leave]] = await pool.query(
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
        DATE_FORMAT(l.applied_at, '%Y-%m-%d %H:%i:%s') as applied_at
      FROM leaves l
      WHERE l.id = ?`,
      [req.params.id]
    );
    if (!leave) throw new ApiError("Leave not found", 404);

    res.json(leave);
  } catch (err) {
    next(err);
  }
});

router.patch("/:id", async (req, res, next) => {
  const { start_date, end_date, leavetype_id, reason } = req.body;

  try {
    const updates = [];
    const params = [];

    if (start_date !== undefined) {
      updates.push("start_date = ?");
      params.push(start_date);
    }

    if (end_date !== undefined) {
      updates.push("end_date = ?");
      params.push(end_date);
    }

    if (leavetype_id !== undefined) {
      // Validate leave type exists and is active
      const [[leaveType]] = await pool.query(
        `SELECT * FROM leave_types WHERE leavetype_id = ? AND is_active = 'Y'`,
        [leavetype_id.toUpperCase()]
      );

      if (!leaveType) {
        throw new ApiError(
          `Leave type with id '${leavetype_id}' not found or inactive`,
          404
        );
      }

      updates.push("leavetype_id = ?");
      params.push(leavetype_id.toUpperCase());
    }

    if (reason !== undefined) {
      updates.push("reason = ?");
      params.push(reason);
    }

    // Recalculate total_days if dates changed
    if (start_date !== undefined || end_date !== undefined) {
      const [[currentLeave]] = await pool.query(
        "SELECT start_date, end_date FROM leaves WHERE id = ?",
        [req.params.id]
      );

      if (!currentLeave) {
        throw new ApiError("Leave not found", 404);
      }

      const finalStartDate = start_date || currentLeave.start_date;
      const finalEndDate = end_date || currentLeave.end_date;
      const startDate = new Date(finalStartDate);
      const endDate = new Date(finalEndDate);
      const timeDiff = endDate.getTime() - startDate.getTime();
      const totalDays = Math.ceil(timeDiff / (1000 * 60 * 60 * 24)) + 1;

      updates.push("total_days = ?");
      params.push(totalDays);
    }

    if (updates.length === 0) {
      throw new ApiError("No fields to update", 400);
    }

    params.push(req.params.id);

    const [result] = await pool.query(
      `UPDATE leaves SET ${updates.join(
        ", "
      )} WHERE id = ? AND status = 'PENDING'`,
      params
    );

    if (result.affectedRows === 0)
      throw new ApiError("Leave not found or not editable", 400);
    res.json({ updated: true });
  } catch (err) {
    next(err);
  }
});

router.post("/:id/approve", async (req, res, next) => {
  const { approved_by } = req.body;

  try {
    if (!approved_by) {
      throw new ApiError("approved_by is required", 400);
    }

    // Validate approver exists
    const [[approver]] = await pool.query(
      SELECT_EMPLOYEE_EXISTS,
      [approved_by]
    );
    if (!approver) {
      throw new ApiError("Approver not found", 404);
    }

    // Get leave details before updating
    const [[leave]] = await pool.query(
      "SELECT empid, leavetype_id, total_days, start_date FROM leaves WHERE id = ? AND status = 'PENDING'",
      [req.params.id]
    );

    if (!leave) {
      throw new ApiError("Leave not found or already processed", 400);
    }

    // Update leave status
    const [result] = await pool.query(
      "UPDATE leaves SET status = 'APPROVED', approved_by = ?, approved_at = NOW() WHERE id = ? AND status = 'PENDING'",
      [approved_by, req.params.id]
    );

    if (result.affectedRows === 0) {
      throw new ApiError("Leave not found or already processed", 400);
    }

    // Update leave_balances: increment used_leaves
    const leaveYear = new Date(leave.start_date).getFullYear();
    await pool.query(
      `INSERT INTO leave_balances (empid, leavetype_id, year, used_leaves)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE 
         used_leaves = used_leaves + ?`,
      [
        leave.empid,
        leave.leavetype_id,
        leaveYear,
        leave.total_days,
        leave.total_days,
      ]
    );

    res.json({ approved: true });
  } catch (err) {
    next(err);
  }
});

router.post("/:id/reject", async (req, res, next) => {
  const { approved_by, rejection_reason } = req.body;

  try {
    if (!approved_by) {
      throw new ApiError("approved_by is required", 400);
    }

    // Validate approver exists
    const [[approver]] = await pool.query(
      SELECT_EMPLOYEE_EXISTS,
      [approved_by]
    );
    if (!approver) {
      throw new ApiError("Approver not found", 404);
    }

    const [result] = await pool.query(
      "UPDATE leaves SET status = 'REJECTED', approved_by = ?, approved_at = NOW(), rejection_reason = ? WHERE id = ? AND status = 'PENDING'",
      [approved_by, rejection_reason || null, req.params.id]
    );
    if (result.affectedRows === 0)
      throw new ApiError("Leave not found or already processed", 400);
    res.json({ rejected: true });
  } catch (err) {
    next(err);
  }
});

// Move to /employees/:empid/leaves/:id/cancel (do not register here anymore; move logic to correct file/route).

module.exports = router;
