const express = require("express");
const router = express.Router({ mergeParams: true });
const pool = require("../../db");
const ApiError = require("../../util/ApiError");
const { resolveEmployeeNumericId } = require("../../util/employeeUtil");
const logger = require("../../config/logger");

// Get personal details for an employee
router.get("/employees/:employeeId/personal", async (req, res, next) => {
  try {
    const organization_id = req.organizationId;
    const employeeNumericId = await resolveEmployeeNumericId(
      req.params.employeeId,
      organization_id
    );

    const [rows] = await pool.query(
      "SELECT * FROM employees_personal WHERE organization_id = ? AND employee_id = ?",
      [organization_id, employeeNumericId]
    );
    if (rows.length === 0) return res.json(null);
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

// Upsert personal details for an employee
router.put("/employees/:employeeId/personal", async (req, res, next) => {
  const employeeId = req.params.employeeId;
  const organization_id = req.organizationId;
  logger.debug("Update employee personal info", { employeeId, organization_id });
  const {
    dob,
    gender,
    marital_status,
    phone_primary,
    phone_secondary,
    address_line1,
    address_line2,
    city,
    state,
    postal_code,
    country,
    emergency_contact_name,
    emergency_contact_relation,
    emergency_contact_phone,
  } = req.body;

  try {
    const [existing] = await pool.query(
      "SELECT id FROM employees_personal WHERE organization_id = ? AND employee_id = ?",
      [organization_id, employeeId]
    );
    if (existing.length === 0) {
      const [result] = await pool.query(
        "INSERT INTO employees_personal (organization_id, employee_id, dob, gender, marital_status, phone_primary, phone_secondary, address_line1, address_line2, city, state, postal_code, country, emergency_contact_name, emergency_contact_relation, emergency_contact_phone) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [
          organization_id,
          employeeId,
          dob || null,
          gender || null,
          marital_status || null,
          phone_primary || null,
          phone_secondary || null,
          address_line1 || null,
          address_line2 || null,
          city || null,
          state || null,
          postal_code || null,
          country || null,
          emergency_contact_name || null,
          emergency_contact_relation || null,
          emergency_contact_phone || null,
        ]
      );
      return res.status(201).json({ id: result.insertId });
    } else {
      await pool.query(
        "UPDATE employees_personal SET dob = COALESCE(?, dob), gender = COALESCE(?, gender), marital_status = COALESCE(?, marital_status), phone_primary = COALESCE(?, phone_primary), phone_secondary = COALESCE(?, phone_secondary), address_line1 = COALESCE(?, address_line1), address_line2 = COALESCE(?, address_line2), city = COALESCE(?, city), state = COALESCE(?, state), postal_code = COALESCE(?, postal_code), country = COALESCE(?, country), emergency_contact_name = COALESCE(?, emergency_contact_name), emergency_contact_relation = COALESCE(?, emergency_contact_relation), emergency_contact_phone = COALESCE(?, emergency_contact_phone) WHERE organization_id = ? AND employee_id = ?",
        [
          dob,
          gender,
          marital_status,
          phone_primary,
          phone_secondary,
          address_line1,
          address_line2,
          city,
          state,
          postal_code,
          country,
          emergency_contact_name,
          emergency_contact_relation,
          emergency_contact_phone,
          organization_id,
          employeeId,
        ]
      );
      return res.json({ updated: true });
    }
  } catch (err) {
    next(err);
  }
});

module.exports = router;
