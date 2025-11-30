const express = require("express");
const router = express.Router({ mergeParams: true });
const pool = require("../../db");
const ApiError = require("../../errors/ApiError");
const { updatePersonalDetailsSchema } = require("../../validations/employeeSchemas");
const { handleValidationErrors } = require("../../util/validation");
const { param } = require("express-validator");

// Get personal details for an employee
router.get("/employees/:empid/personal", 
  [param("empid").notEmpty().trim()],
  handleValidationErrors,
  async (req, res, next) => {
  try {
    const empid = req.params.empid;
    // Check if employee exists
    const [[employee]] = await pool.query(
      "SELECT empid FROM employees WHERE empid = ?",
      [empid]
    );
    if (!employee) {
      throw new ApiError("Employee not found", 404);
    }

    const [[personalDetails]] = await pool.query(
      "SELECT * FROM employee_personal_details WHERE empid = ?",
      [empid]
    );
    
    if (!personalDetails) {
      throw new ApiError("Personal details not found", 404);
    }
    
    res.json(personalDetails);
  } catch (err) {
    next(err);
  }
});

// Upsert personal details for an employee
router.put("/employees/:empid/personal",
  updatePersonalDetailsSchema,
  handleValidationErrors,
  async (req, res, next) => {
    const empid = req.params.empid;
    const {
      phone,
      alternate_phone,
      date_of_birth,
      gender,
      marital_status,
      blood_group,
      emergency_contact_name,
      emergency_contact_phone,
      emergency_contact_relation,
      permanent_address_line1,
      permanent_address_line2,
      permanent_city,
      permanent_state,
      permanent_postal_code,
      permanent_country,
      current_address_line1,
      current_address_line2,
      current_city,
      current_state,
      current_postal_code,
      current_country,
      pan_number,
      aadhaar_number,
      passport_number,
      passport_expiry,
      driving_license_number,
      driving_license_expiry,
    } = req.body;

  try {
    // Check if employee exists
    const [[employee]] = await pool.query(
      "SELECT empid FROM employees WHERE empid = ?",
      [empid]
    );
    if (!employee) {
      throw new ApiError("Employee not found", 404);
    }

    // Check if personal details already exist
    const [[existing]] = await pool.query(
      "SELECT empid FROM employee_personal_details WHERE empid = ?",
      [empid]
    );

    if (existing) {
      // Update existing record
      await pool.query(
        `UPDATE employee_personal_details SET
          phone = ?,
          alternate_phone = ?,
          date_of_birth = ?,
          gender = ?,
          marital_status = ?,
          blood_group = ?,
          emergency_contact_name = ?,
          emergency_contact_phone = ?,
          emergency_contact_relation = ?,
          permanent_address_line1 = ?,
          permanent_address_line2 = ?,
          permanent_city = ?,
          permanent_state = ?,
          permanent_postal_code = ?,
          permanent_country = ?,
          current_address_line1 = ?,
          current_address_line2 = ?,
          current_city = ?,
          current_state = ?,
          current_postal_code = ?,
          current_country = ?,
          pan_number = ?,
          aadhaar_number = ?,
          passport_number = ?,
          passport_expiry = ?,
          driving_license_number = ?,
          driving_license_expiry = ?
        WHERE empid = ?`,
        [
          phone || null,
          alternate_phone || null,
          date_of_birth || null,
          gender || null,
          marital_status || null,
          blood_group || null,
          emergency_contact_name || null,
          emergency_contact_phone || null,
          emergency_contact_relation || null,
          permanent_address_line1 || null,
          permanent_address_line2 || null,
          permanent_city || null,
          permanent_state || null,
          permanent_postal_code || null,
          permanent_country || null,
          current_address_line1 || null,
          current_address_line2 || null,
          current_city || null,
          current_state || null,
          current_postal_code || null,
          current_country || null,
          pan_number || null,
          aadhaar_number || null,
          passport_number || null,
          passport_expiry || null,
          driving_license_number || null,
          driving_license_expiry || null,
          empid,
        ]
      );
      return res.json({ updated: true });
    } else {
      // Insert new record
      await pool.query(
        `INSERT INTO employee_personal_details (
          empid, phone, alternate_phone, date_of_birth, gender, marital_status,
          blood_group, emergency_contact_name, emergency_contact_phone,
          emergency_contact_relation, permanent_address_line1, permanent_address_line2,
          permanent_city, permanent_state, permanent_postal_code, permanent_country,
          current_address_line1, current_address_line2, current_city, current_state,
          current_postal_code, current_country, pan_number, aadhaar_number,
          passport_number, passport_expiry, driving_license_number, driving_license_expiry
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          empid,
          phone || null,
          alternate_phone || null,
          date_of_birth || null,
          gender || null,
          marital_status || null,
          blood_group || null,
          emergency_contact_name || null,
          emergency_contact_phone || null,
          emergency_contact_relation || null,
          permanent_address_line1 || null,
          permanent_address_line2 || null,
          permanent_city || null,
          permanent_state || null,
          permanent_postal_code || null,
          permanent_country || null,
          current_address_line1 || null,
          current_address_line2 || null,
          current_city || null,
          current_state || null,
          current_postal_code || null,
          current_country || null,
          pan_number || null,
          aadhaar_number || null,
          passport_number || null,
          passport_expiry || null,
          driving_license_number || null,
          driving_license_expiry || null,
        ]
      );
      return res.status(201).json({ created: true });
    }
  } catch (err) {
    next(err);
  }
});

module.exports = router;
