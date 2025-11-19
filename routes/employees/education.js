const express = require("express");
const router = express.Router({ mergeParams: true });
const pool = require("../../db");
const ApiError = require("../../util/ApiError");
const { resolveEmployeeNumericId } = require("../../util/employeeUtil");

router.get("/employees/:employeeId/education", async (req, res, next) => {
  try {
    const organization_id = req.organizationId;
    const employeeNumericId = await resolveEmployeeNumericId(
      req.params.employeeId,
      organization_id
    );
    const [rows] = await pool.query(
      "SELECT * FROM employees_education WHERE organization_id = ? AND employee_id = ? ORDER BY start_date DESC",
      [organization_id, employeeNumericId]
    );
    res.json({ education: rows });
  } catch (err) {
    next(err);
  }
});

router.post("/employees/:employeeId/education", async (req, res, next) => {
  const { degree, institution, field_of_study, start_date, end_date, grade } = req.body;
  const organization_id = req.organizationId;
  try {
    const employeeNumericId = await resolveEmployeeNumericId(
      req.params.employeeId,
      organization_id
    );
    const [result] = await pool.query(
      "INSERT INTO employees_education (organization_id, employee_id, degree, institution, field_of_study, start_date, end_date, grade) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      [organization_id, employeeNumericId, degree, institution, field_of_study, start_date, end_date, grade]
    );
    res.status(201).json({ id: result.insertId });
  } catch (err) {
    next(err);
  }
});

router.patch("/employees/:employeeId/education/:id", async (req, res, next) => {
  const { degree, institution, field_of_study, start_date, end_date, grade } = req.body;
  const organization_id = req.organizationId;
  try {
    const employeeNumericId = await resolveEmployeeNumericId(
      req.params.employeeId,
      organization_id
    );
    const [result] = await pool.query(
      "UPDATE employees_education SET degree = COALESCE(?, degree), institution = COALESCE(?, institution), field_of_study = COALESCE(?, field_of_study), start_date = COALESCE(?, start_date), end_date = COALESCE(?, end_date), grade = COALESCE(?, grade) WHERE id = ? AND organization_id = ? AND employee_id = ?",
      [degree, institution, field_of_study, start_date, end_date, grade, req.params.id, organization_id, employeeNumericId]
    );
    if (result.affectedRows === 0) throw new ApiError("Education record not found", 404);
    res.json({ updated: true });
  } catch (err) {
    next(err);
  }
});

router.delete("/employees/:employeeId/education/:id", async (req, res, next) => {
  try {
    const organization_id = req.organizationId;
    const employeeNumericId = await resolveEmployeeNumericId(
      req.params.employeeId,
      organization_id
    );
    const [result] = await pool.query(
      "DELETE FROM employees_education WHERE id = ? AND organization_id = ? AND employee_id = ?",
      [req.params.id, organization_id, employeeNumericId]
    );
    if (result.affectedRows === 0) throw new ApiError("Education record not found", 404);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

module.exports = router;


