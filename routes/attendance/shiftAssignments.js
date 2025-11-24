const express = require("express");
const router = express.Router({ mergeParams: true });
const pool = require("../../db");
const ApiError = require("../../util/ApiError");

// List assignments for an employee
router.get("/employees/:empid/shift-assignments", async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      "SELECT * FROM attendance_shift_assignments WHERE empid = ? ORDER BY effective_from DESC",
      [req.params.empid]
    );
    res.json({ assignments: rows });
  } catch (err) {
    next(err);
  }
});

// Create assignment
router.post("/employees/:empid/shift-assignments", async (req, res, next) => {
  const {
    shiftid,
    effective_from,
    effective_to = null,
    is_active = "Y",
    assigned_by = null,
  } = req.body;
  try {
    if (!shiftid || !effective_from) {
      throw new ApiError("shiftid and effective_from are required", 400);
    }
    const [result] = await pool.query(
      "INSERT INTO attendance_shift_assignments (empid, shiftid, effective_from, effective_to, is_active, assigned_by) VALUES (?, ?, ?, ?, ?, ?)",
      [
        req.params.empid,
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


