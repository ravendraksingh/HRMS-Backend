const express = require("express");
const router = express.Router();
const pool = require("../../db");
const ApiError = require("../../errors/ApiError");

router.get("/", async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      "SELECT * FROM attendance_shifts ORDER BY created_at DESC"
    );
    res.json({ shifts: rows });
  } catch (err) {
    next(err);
  }
});

router.get("/:shiftid", async (req, res, next) => {
  try {
    const [[shift]] = await pool.query(
      "SELECT * FROM attendance_shifts WHERE shiftid = ?",
      [req.params.shiftid]
    );
    if (!shift) throw new ApiError("Shift not found", 404);
    res.json(shift);
  } catch (err) {
    next(err);
  }
});

router.post("/", async (req, res, next) => {
  const {
    shiftid,
    name,
    start_time,
    end_time,
    break_duration_minutes = 0,
    grace_duration_minutes = 0,
    total_hours,
    is_active = "Y",
  } = req.body;

  try {
    if (
      !shiftid ||
      !name ||
      !start_time ||
      !end_time ||
      !grace_duration_minutes ||
      !break_duration_minutes ||
      !total_hours
    ) {
      throw new ApiError(
        "shiftid, name, start_time, end_time, grace_duration_minutes, break_duration_minutes, and total_hours are required",
        400
      );
    }

    const [result] = await pool.query(
      "INSERT INTO attendance_shifts (shiftid, name, start_time, end_time, break_duration_minutes, grace_duration_minutes, total_hours, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      [
        shiftid,
        name,
        start_time,
        end_time,
        break_duration_minutes,
        grace_duration_minutes,
        total_hours,
        is_active,
      ]
    );
    res.status(201).json({ shiftid: shiftid });
  } catch (err) {
    next(err);
  }
});

router.patch("/:shiftid", async (req, res, next) => {
  const {
    name,
    start_time,
    end_time,
    break_duration_minutes,
    grace_duration_minutes,
    total_hours,
    is_active,
  } = req.body;

  try {
    const updates = [];
    const params = [];

    if (name !== undefined) {
      updates.push("name = ?");
      params.push(name);
    }
    if (start_time !== undefined) {
      updates.push("start_time = ?");
      params.push(start_time);
    }
    if (end_time !== undefined) {
      updates.push("end_time = ?");
      params.push(end_time);
    }
    if (break_duration_minutes !== undefined) {
      updates.push("break_duration_minutes = ?");
      params.push(break_duration_minutes);
    }
    if (grace_duration_minutes !== undefined) {
      updates.push("grace_duration_minutes = ?");
      params.push(grace_duration_minutes);
    }
    if (total_hours !== undefined) {
      updates.push("total_hours = ?");
      params.push(total_hours);
    }
    if (is_active !== undefined) {
      updates.push("is_active = ?");
      params.push(is_active);
    }

    if (updates.length === 0) {
      throw new ApiError("No fields to update", 400);
    }

    params.push(req.params.shiftid);

    const [result] = await pool.query(
      `UPDATE attendance_shifts SET ${updates.join(
        ", "
      )}, updated_at = NOW() WHERE shiftid = ?`,
      params
    );
    if (result.affectedRows === 0) throw new ApiError("Shift not found", 404);
    res.json({ updated: true });
  } catch (err) {
    next(err);
  }
});

router.delete("/:shiftid", async (req, res, next) => {
  try {
    const [result] = await pool.query(
      "DELETE FROM attendance_shifts WHERE shiftid = ?",
      [req.params.shiftid]
    );
    if (result.affectedRows === 0) throw new ApiError("Shift not found", 404);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
