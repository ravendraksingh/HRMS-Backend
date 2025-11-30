const express = require("express");
const router = express.Router();
const pool = require("../../db");
const ApiError = require("../../errors/ApiError");

/**
 * GET /attendance/shift-assignments
 * Get all shift assignments (for managers/admin)
 * Query params: empid (optional), shiftid (optional), is_active (optional)
 */
router.get("/", async (req, res, next) => {
  const { empid, shiftid, is_active } = req.query;
  try {
    const where = [];
    const params = [];
    
    if (empid) {
      where.push("asa.empid = ?");
      params.push(empid);
    }
    if (shiftid) {
      where.push("asa.shiftid = ?");
      params.push(shiftid);
    }
    if (is_active) {
      where.push("asa.is_active = ?");
      params.push(is_active);
    }
    
    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
    const [rows] = await pool.query(
      `SELECT 
        asa.id,
        asa.empid,
        asa.shiftid,
        DATE_FORMAT(asa.effective_from, '%Y-%m-%d') as effective_from,
        DATE_FORMAT(asa.effective_to, '%Y-%m-%d') as effective_to,
        asa.is_active,
        asa.assigned_by,
        DATE_FORMAT(asa.created_at, '%Y-%m-%d %H:%i:%s') as created_at,
        s.name as shift_name,
        s.start_time,
        s.end_time
      FROM attendance_shift_assignments asa
      LEFT JOIN attendance_shifts s ON asa.shiftid = s.shiftid
      ${whereSql} 
      ORDER BY asa.effective_from DESC`,
      params
    );
    res.json({ assignments: rows });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /attendance/shift-assignments
 * Create a new shift assignment (for managers/admin)
 * Body: empid, shiftid, effective_from, effective_to (optional), is_active (optional), assigned_by (optional)
 */
router.post("/", async (req, res, next) => {
  const {
    empid,
    shiftid,
    effective_from,
    effective_to = null,
    is_active = "Y",
    assigned_by = null,
  } = req.body;
  try {
    if (!empid || !shiftid || !effective_from) {
      throw new ApiError("empid, shiftid, and effective_from are required", 400);
    }
    const [result] = await pool.query(
      "INSERT INTO attendance_shift_assignments (empid, shiftid, effective_from, effective_to, is_active, assigned_by) VALUES (?, ?, ?, ?, ?, ?)",
      [
        empid,
        shiftid,
        effective_from,
        effective_to,
        is_active,
        assigned_by,
      ]
    );
    res.status(201).json({ id: result.insertId });
  } catch (err) {
    next(err);
  }
});

module.exports = router;


