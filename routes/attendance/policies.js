const express = require("express");
const router = express.Router();
const pool = require("../../db");
const ApiError = require("../../errors/ApiError");

router.get("/", async (req, res, next) => {
  try {
    const [rows] = await pool.query("SELECT * FROM attendance_policies ORDER BY id DESC");
    res.json({ policies: rows });
  } catch (err) {
    next(err);
  }
});

router.post("/", async (req, res, next) => {
  const { name, grace_in_minutes = 0, late_threshold_minutes = 0, half_day_threshold_minutes = 240, overtime_minimum_minutes = 30, rounding_policy = "none" } = req.body;
  try {
    const [result] = await pool.query(
      "INSERT INTO attendance_policies (name, grace_in_minutes, late_threshold_minutes, half_day_threshold_minutes, overtime_minimum_minutes, rounding_policy) VALUES (?, ?, ?, ?, ?, ?)",
      [name, grace_in_minutes, late_threshold_minutes, half_day_threshold_minutes, overtime_minimum_minutes, rounding_policy]
    );
    res.status(201).json({ id: result.insertId });
  } catch (err) {
    next(err);
  }
});

router.patch("/:id", async (req, res, next) => {
  const { name, grace_in_minutes, late_threshold_minutes, half_day_threshold_minutes, overtime_minimum_minutes, rounding_policy } = req.body;
  try {
    const [result] = await pool.query(
      "UPDATE attendance_policies SET name = COALESCE(?, name), grace_in_minutes = COALESCE(?, grace_in_minutes), late_threshold_minutes = COALESCE(?, late_threshold_minutes), half_day_threshold_minutes = COALESCE(?, half_day_threshold_minutes), overtime_minimum_minutes = COALESCE(?, overtime_minimum_minutes), rounding_policy = COALESCE(?, rounding_policy) WHERE id = ?",
      [name, grace_in_minutes, late_threshold_minutes, half_day_threshold_minutes, overtime_minimum_minutes, rounding_policy, req.params.id]
    );
    if (result.affectedRows === 0) throw new ApiError("Policy not found", 404);
    res.json({ updated: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;


