const express = require("express");
const router = express.Router();
const pool = require("../../db");
const ApiError = require("../../util/ApiError");

router.get("/", async (req, res, next) => {
  const organization_id = req.organizationId;

  try {
    const [rows] = await pool.query(
      "SELECT * FROM attendance_shifts WHERE organization_id = ? ORDER BY id DESC",
      [organization_id]
    );
    res.json({ shifts: rows });
  } catch (err) {
    next(err);
  }
});

router.get("/:id", async (req, res, next) => {
  const organization_id = req.organizationId;

  try {
    const [[shift]] = await pool.query(
      "SELECT * FROM attendance_shifts WHERE id = ? AND organization_id = ?",
      [req.params.id, organization_id]
    );
    if (!shift) throw new ApiError("Shift not found", 404);
    res.json(shift);
  } catch (err) {
    next(err);
  }
});

router.post("/", async (req, res, next) => {
  const {
    name,
    start_time,
    end_time,
    is_overnight = 0,
    grace_in_minutes = 0,
    default_break_minutes = 0,
  } = req.body;
  const organization_id = req.organizationId;
  try {
    const [result] = await pool.query(
      "INSERT INTO attendance_shifts (organization_id, name, start_time, end_time, is_overnight, grace_in_minutes, default_break_minutes) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [
        organization_id,
        name,
        start_time,
        end_time,
        is_overnight,
        grace_in_minutes,
        default_break_minutes,
      ]
    );
    res.status(201).json({ id: result.insertId });
  } catch (err) {
    next(err);
  }
});

router.patch("/:id", async (req, res, next) => {
  const {
    name,
    start_time,
    end_time,
    is_overnight,
    grace_in_minutes,
    default_break_minutes,
  } = req.body;
  const organization_id = req.organizationId;

  try {
    const [result] = await pool.query(
      "UPDATE attendance_shifts SET name = COALESCE(?, name), start_time = COALESCE(?, start_time), end_time = COALESCE(?, end_time), is_overnight = COALESCE(?, is_overnight), grace_in_minutes = COALESCE(?, grace_in_minutes), default_break_minutes = COALESCE(?, default_break_minutes) WHERE id = ? AND organization_id = ?",
      [
        name,
        start_time,
        end_time,
        is_overnight,
        grace_in_minutes,
        default_break_minutes,
        req.params.id,
        organization_id,
      ]
    );
    if (result.affectedRows === 0) throw new ApiError("Shift not found", 404);
    res.json({ updated: true });
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", async (req, res, next) => {
  const organization_id = req.organizationId;

  try {
    const [result] = await pool.query(
      "DELETE FROM attendance_shifts WHERE id = ? AND organization_id = ?",
      [req.params.id, organization_id]
    );
    if (result.affectedRows === 0) throw new ApiError("Shift not found", 404);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
