const express = require("express");
const router = express.Router({ mergeParams: true });
const pool = require("../../db");
const ApiError = require("../../util/ApiError");

// List assignments for an employee
router.get("/employees/:employeeId/shift-assignments", async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      "SELECT * FROM attendance_shift_assignments WHERE employee_id = ? ORDER BY effective_from DESC",
      [req.params.employeeId]
    );
    res.json({ assignments: rows });
  } catch (err) {
    next(err);
  }
});

// Create assignment
router.post("/employees/:employeeId/shift-assignments", async (req, res, next) => {
  const { shift_id, effective_from, effective_to = null } = req.body;
  try {
    const [result] = await pool.query(
      "INSERT INTO attendance_shift_assignments (employee_id, shift_id, effective_from, effective_to) VALUES (?, ?, ?, ?)",
      [req.params.employeeId, shift_id, effective_from, effective_to]
    );
    res.status(201).json({ id: result.insertId });
  } catch (err) {
    next(err);
  }
});

module.exports = router;


