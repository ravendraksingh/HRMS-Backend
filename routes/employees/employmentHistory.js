const express = require("express");
const router = express.Router({ mergeParams: true });
const pool = require("../../db");
const ApiError = require("../../util/ApiError");
const { resolveEmployeeNumericId } = require("../../util/employeeUtil");

router.get("/employees/:employeeId/employment-history", async (req, res, next) => {
  try {
    const organization_id = req.organizationId;
    const employeeNumericId = await resolveEmployeeNumericId(
      req.params.employeeId,
      organization_id
    );
    const [rows] = await pool.query(
      "SELECT * FROM employees_employment_history WHERE organization_id = ? AND employee_id = ? ORDER BY start_date DESC",
      [organization_id, employeeNumericId]
    );
    res.json({ history: rows });
  } catch (err) {
    next(err);
  }
});

router.post("/employees/:employeeId/employment-history", async (req, res, next) => {
  const { company_name, job_title, start_date, end_date, responsibilities } = req.body;
  const organization_id = req.organizationId;
  try {
    const employeeNumericId = await resolveEmployeeNumericId(
      req.params.employeeId,
      organization_id
    );
    const [result] = await pool.query(
      "INSERT INTO employees_employment_history (organization_id, employee_id, company_name, job_title, start_date, end_date, responsibilities) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [organization_id, employeeNumericId, company_name, job_title, start_date, end_date, responsibilities]
    );
    res.status(201).json({ id: result.insertId });
  } catch (err) {
    next(err);
  }
});

router.patch("/employees/:employeeId/employment-history/:id", async (req, res, next) => {
  const { company_name, job_title, start_date, end_date, responsibilities } = req.body;
  const organization_id = req.organizationId;
  try {
    const employeeNumericId = await resolveEmployeeNumericId(
      req.params.employeeId,
      organization_id
    );
    const [result] = await pool.query(
      "UPDATE employees_employment_history SET company_name = COALESCE(?, company_name), job_title = COALESCE(?, job_title), start_date = COALESCE(?, start_date), end_date = COALESCE(?, end_date), responsibilities = COALESCE(?, responsibilities) WHERE id = ? AND organization_id = ? AND employee_id = ?",
      [company_name, job_title, start_date, end_date, responsibilities, req.params.id, organization_id, employeeNumericId]
    );
    if (result.affectedRows === 0) throw new ApiError("Employment history not found", 404);
    res.json({ updated: true });
  } catch (err) {
    next(err);
  }
});

router.delete("/employees/:employeeId/employment-history/:id", async (req, res, next) => {
  try {
    const organization_id = req.organizationId;
    const employeeNumericId = await resolveEmployeeNumericId(
      req.params.employeeId,
      organization_id
    );
    const [result] = await pool.query(
      "DELETE FROM employees_employment_history WHERE id = ? AND organization_id = ? AND employee_id = ?",
      [req.params.id, organization_id, employeeNumericId]
    );
    if (result.affectedRows === 0) throw new ApiError("Employment history not found", 404);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

module.exports = router;


