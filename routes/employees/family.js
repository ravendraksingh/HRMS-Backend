const express = require("express");
const router = express.Router({ mergeParams: true });
const pool = require("../../db");
const ApiError = require("../../util/ApiError");
const { resolveEmployeeNumericId } = require("../../util/employeeUtil");

router.get("/employees/:employeeId/family", async (req, res, next) => {
  try {
    const organization_id = req.organizationId;
    const employeeNumericId = await resolveEmployeeNumericId(
      req.params.employeeId,
      organization_id
    );
    const [rows] = await pool.query(
      "SELECT * FROM employees_family WHERE organization_id = ? AND employee_id = ? ORDER BY id DESC",
      [organization_id, employeeNumericId]
    );
    res.json({ family: rows });
  } catch (err) {
    next(err);
  }
});

router.post("/employees/:employeeId/family", async (req, res, next) => {
  const { name, relation, dob, phone, dependent } = req.body;
  const organization_id = req.organizationId;
  try {
    const employeeNumericId = await resolveEmployeeNumericId(
      req.params.employeeId,
      organization_id
    );
    const [result] = await pool.query(
      "INSERT INTO employees_family (organization_id, employee_id, name, relation, dob, phone, dependent) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [organization_id, employeeNumericId, name, relation, dob, phone, dependent ? 1 : 0]
    );
    res.status(201).json({ id: result.insertId });
  } catch (err) {
    next(err);
  }
});

router.patch("/employees/:employeeId/family/:id", async (req, res, next) => {
  const { name, relation, dob, phone, dependent } = req.body;
  const organization_id = req.organizationId;
  try {
    const employeeNumericId = await resolveEmployeeNumericId(
      req.params.employeeId,
      organization_id
    );
    const [result] = await pool.query(
      "UPDATE employees_family SET name = COALESCE(?, name), relation = COALESCE(?, relation), dob = COALESCE(?, dob), phone = COALESCE(?, phone), dependent = COALESCE(?, dependent) WHERE id = ? AND organization_id = ? AND employee_id = ?",
      [name, relation, dob, phone, dependent, req.params.id, organization_id, employeeNumericId]
    );
    if (result.affectedRows === 0) throw new ApiError("Family member not found", 404);
    res.json({ updated: true });
  } catch (err) {
    next(err);
  }
});

router.delete("/employees/:employeeId/family/:id", async (req, res, next) => {
  try {
    const organization_id = req.organizationId;
    const employeeNumericId = await resolveEmployeeNumericId(
      req.params.employeeId,
      organization_id
    );
    const [result] = await pool.query(
      "DELETE FROM employees_family WHERE id = ? AND organization_id = ? AND employee_id = ?",
      [req.params.id, organization_id, employeeNumericId]
    );
    if (result.affectedRows === 0) throw new ApiError("Family member not found", 404);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

module.exports = router;


