const express = require("express");
const router = express.Router();
const pool = require("../../db");
const ApiError = require("../../util/ApiError");

router.get("/", async (req, res, next) => {
  const { employee_id, from, to, status } = req.query;
  try {
    const where = [];
    const params = [];
    if (employee_id) {
      where.push("employee_id = ?");
      params.push(employee_id);
    }
    if (from) {
      where.push("work_date >= ?");
      params.push(from);
    }
    if (to) {
      where.push("work_date <= ?");
      params.push(to);
    }
    if (status) {
      where.push("status = ?");
      params.push(status);
    }
    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
    const [rows] = await pool.query(`SELECT * FROM attendance_overtime ${whereSql} ORDER BY work_date DESC`, params);
    res.json({ overtime: rows });
  } catch (err) {
    next(err);
  }
});

router.post("/", async (req, res, next) => {
  const { employee_id, work_date, minutes, reason = null } = req.body;
  try {
    const [result] = await pool.query(
      "INSERT INTO attendance_overtime (employee_id, work_date, minutes, reason) VALUES (?, ?, ?, ?)",
      [employee_id, work_date, minutes, reason]
    );
    res.status(201).json({ id: result.insertId });
  } catch (err) {
    next(err);
  }
});

router.patch("/:id", async (req, res, next) => {
  const { minutes, reason } = req.body;
  try {
    const [result] = await pool.query(
      "UPDATE attendance_overtime SET minutes = COALESCE(?, minutes), reason = COALESCE(?, reason) WHERE id = ? AND status = 'pending'",
      [minutes, reason, req.params.id]
    );
    if (result.affectedRows === 0) throw new ApiError("Overtime not found or not editable", 400);
    res.json({ updated: true });
  } catch (err) {
    next(err);
  }
});

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


