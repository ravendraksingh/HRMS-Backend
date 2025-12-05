const express = require("express");
const router = express.Router();
const pool = require("../../db");
const ApiError = require("../../errors/ApiError");

/**
 * GET /attendance/overtime
 * Get overtime records (for managers/admin to view all)
 * Query params: empid (optional), from_date (optional), to_date (optional), status (optional)
 * Note: For employee-specific overtime, use GET /employees/:empid/attendance/overtime
 */
router.get("/", async (req, res, next) => {
  const { empid, from_date, to_date, status } = req.query;
  try {
    const where = [];
    const params = [];
    if (empid) {
      where.push("ao.empid = ?");
      params.push(empid);
    }
    if (from_date) {
      where.push("ao.overtime_date >= ?");
      params.push(from_date);
    }
    if (to_date) {
      where.push("ao.overtime_date <= ?");
      params.push(to_date);
    }
    if (status) {
      where.push("ao.status = ?");
      params.push(status.toUpperCase());
    }
    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
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
        ao.remarks,
        ao.created_at,
        ao.updated_at
      FROM attendance_overtime ao
      ${whereSql} 
      ORDER BY ao.overtime_date DESC`,
      params
    );
    
    res.json({ 
      count: rows.length,
      overtime: rows
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /attendance/overtime/:id/approve
 * Approve an overtime record (for managers/admin)
 */
router.post("/:id/approve", async (req, res, next) => {
  const { approved_by } = req.body;
  try {
    const [result] = await pool.query(
      "UPDATE attendance_overtime SET status = 'approved', approved_by = ?, approved_at = NOW() WHERE id = ? AND status = 'pending'",
      [approved_by, req.params.id]
    );
    if (result.affectedRows === 0) throw new ApiError("Overtime not found or already processed", 400);
    res.json({ approved: true });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /attendance/overtime/:id/reject
 * Reject an overtime record (for managers/admin)
 */
router.post("/:id/reject", async (req, res, next) => {
  const { approved_by } = req.body;
  try {
    const [result] = await pool.query(
      "UPDATE attendance_overtime SET status = 'rejected', approved_by = ?, approved_at = NOW() WHERE id = ? AND status = 'pending'",
      [approved_by, req.params.id]
    );
    if (result.affectedRows === 0) throw new ApiError("Overtime not found or already processed", 400);
    res.json({ rejected: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;


