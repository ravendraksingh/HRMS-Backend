const express = require("express");
const router = express.Router();
const pool = require("../../db");
const ApiError = require("../../util/ApiError");
const { resolveEmployeeNumericId } = require("../../util/employeeUtil");

router.get("/attendance/daily", async (req, res, next) => {
  const { work_date, date } = req.query;
  const organization_id = req.organizationId;

  // Support both 'work_date' and 'date' for backward compatibility
  const queryDate = work_date || date;

  try {
    if (!queryDate) {
      throw new ApiError("work_date or date query parameter is required", 400);
    }

    const [rows] = await pool.query(
      `SELECT 
        ar.*,
        e.employee_code,
        e.name AS employee_name,
        e.email AS employee_email
      FROM attendance_records ar
      JOIN employees e ON ar.employee_id = e.id
      WHERE ar.organization_id = ? AND ar.work_date = ?`,
      [organization_id, queryDate]
    );
    res.json({ work_date: queryDate, attendance: rows });
  } catch (err) {
    next(err);
  }
});

router.get("/attendance/monthly", async (req, res, next) => {
  const { month, employee_id } = req.query; // month: YYYY-MM
  const organization_id = req.organizationId;

  try {
    if (!month) {
      throw new ApiError(
        "month query parameter is required (format: YYYY-MM)",
        400
      );
    }

    let whereClauses = [
      "ar.organization_id = ?",
      "DATE_FORMAT(ar.work_date, '%Y-%m') = ?",
    ];
    let params = [organization_id, month];

    if (employee_id) {
      // Resolve employee numeric ID if employee_code is provided
      const employeeNumericId = await resolveEmployeeNumericId(
        employee_id,
        organization_id
      );
      whereClauses.push("ar.employee_id = ?");
      params.push(employeeNumericId);
    }
    //
    const fetchQuery = `SELECT 
        ar.*,
        e.employee_code,
        e.name AS employee_name,
        e.email AS employee_email
      FROM attendance_records ar
      LEFT JOIN employees e ON ar.employee_id = e.id
      WHERE ${whereClauses.join(" AND ")}`;

    const [rows] = await pool.query(fetchQuery, params);
    // console.log("rows:", rows);
    res.json({ month, records: rows });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
