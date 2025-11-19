const express = require("express");
const router = express.Router();
const pool = require("../../db");
const ApiError = require("../../util/ApiError");

router.get("/", async (req, res, next) => {
  const { year, region } = req.query;
  try {
    const where = [];
    const params = [];
    if (year) {
      where.push("YEAR(holiday_date) = ?");
      params.push(year);
    }
    if (region) {
      where.push("COALESCE(region, 'ALL') = ?");
      params.push(region);
    }
    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
    const [rows] = await pool.query(`SELECT * FROM attendance_holidays ${whereSql} ORDER BY holiday_date ASC`, params);
    res.json({ holidays: rows });
  } catch (err) {
    next(err);
  }
});

router.post("/", async (req, res, next) => {
  const { holiday_date, name, type = "company", region = null, is_optional = 0 } = req.body;
  const organization_id = req.organizationId;
  try {
    const [result] = await pool.query(
      "INSERT INTO attendance_holidays (organization_id, holiday_date, name, type, region, is_optional) VALUES (?, ?, ?, ?, ?, ?)",
      [organization_id, holiday_date, name, type, region, is_optional]
    );
    res.status(201).json({ id: result.insertId });
  } catch (err) {
    next(err);
  }
});

router.patch("/:id", async (req, res, next) => {
  const { holiday_date, name, type, region, is_optional } = req.body;
  try {
    const [result] = await pool.query(
      "UPDATE attendance_holidays SET holiday_date = COALESCE(?, holiday_date), name = COALESCE(?, name), type = COALESCE(?, type), region = COALESCE(?, region), is_optional = COALESCE(?, is_optional) WHERE id = ?",
      [holiday_date, name, type, region, is_optional, req.params.id]
    );
    if (result.affectedRows === 0) throw new ApiError("Holiday not found", 404);
    res.json({ updated: true });
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    const [result] = await pool.query("DELETE FROM attendance_holidays WHERE id = ?", [req.params.id]);
    if (result.affectedRows === 0) throw new ApiError("Holiday not found", 404);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

module.exports = router;


