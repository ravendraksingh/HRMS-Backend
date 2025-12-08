const express = require("express");
const router = express.Router({ mergeParams: true });
const pool = require("../../db");
const ApiError = require("../../errors/ApiError");
const { SELECT_EMPLOYEE_EXISTS } = require("../../queries/employees");
const {
  createFamilySchema,
  updateFamilySchema,
} = require("../../validations/employeeSchemas");
const { handleValidationErrors } = require("../../util/validation");
const { param } = require("express-validator");
const { authorizeEmployee } = require("../../middlewares/rbac");
const { encryptPIIFields, decryptPIIFields } = require("../../util/encryption");
const { PII_FIELDS } = require("../../config/piiFields");

// Security sequence: Authentication (global) → BOLA → Validation → Business Logic → DB
// Get family and dependents for an employee
router.get(
  "/:empid/family",
  authorizeEmployee, // BOLA check first
  [param("empid").notEmpty().trim()],
  handleValidationErrors,
  async (req, res, next) => {
    try {
      const empid = req.params.empid;

      // Check if employee exists
      const [[employee]] = await pool.query(SELECT_EMPLOYEE_EXISTS, [empid]);
      if (!employee) {
        throw new ApiError("Employee not found", 404);
      }

      const [rows] = await pool.query(
        "SELECT * FROM employee_family_dependents WHERE empid = ? ORDER BY id DESC",
        [empid]
      );

      // Decrypt PII fields before sending response
      const decryptedFamily = rows.map((row) =>
        decryptPIIFields(row, PII_FIELDS.employee_family_dependents)
      );

      res.json({ family: decryptedFamily });
    } catch (err) {
      next(err);
    }
  }
);

// Security sequence: Authentication (global) → BOLA → Validation → Business Logic → DB
// Create family/dependent record
router.post(
  "/:empid/family",
  authorizeEmployee, // BOLA check first
  createFamilySchema,
  handleValidationErrors,
  async (req, res, next) => {
    const {
      relationship,
      name,
      date_of_birth,
      gender,
      is_dependent,
      occupation,
      employer_name,
      phone,
      email,
      aadhaar_number,
      pan_number,
      passport_number,
      passport_expiry,
      is_covered_under_insurance,
      insurance_policy_number,
      address_line1,
      address_line2,
      city,
      state,
      postal_code,
      country,
      is_emergency_contact,
      notes,
    } = req.body;
    const empid = req.params.empid;

    try {
      // Check if employee exists
      const [[employee]] = await pool.query(SELECT_EMPLOYEE_EXISTS, [empid]);
      if (!employee) {
        throw new ApiError("Employee not found", 404);
      }

      // Encrypt PII fields before saving
      const encryptedData = encryptPIIFields(
        {
          relationship,
          name,
          date_of_birth,
          gender,
          is_dependent,
          occupation,
          employer_name,
          phone,
          email,
          aadhaar_number,
          pan_number,
          passport_number,
          passport_expiry,
          is_covered_under_insurance,
          insurance_policy_number,
          address_line1,
          address_line2,
          city,
          state,
          postal_code,
          country,
          is_emergency_contact,
          notes,
        },
        PII_FIELDS.employee_family_dependents
      );

      const [result] = await pool.query(
        `INSERT INTO employee_family_dependents 
       (empid, relationship, name, date_of_birth, gender, is_dependent, 
        occupation, employer_name, phone, email, aadhaar_number, pan_number,
        passport_number, passport_expiry, is_covered_under_insurance, 
        insurance_policy_number, address_line1, address_line2, city, state,
        postal_code, country, is_emergency_contact, notes) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          empid,
          encryptedData.relationship,
          encryptedData.name,
          encryptedData.date_of_birth || null,
          encryptedData.gender || null,
          encryptedData.is_dependent || "N",
          encryptedData.occupation || null,
          encryptedData.employer_name || null,
          encryptedData.phone || null,
          encryptedData.email || null,
          encryptedData.aadhaar_number || null,
          encryptedData.pan_number || null,
          encryptedData.passport_number || null,
          encryptedData.passport_expiry || null,
          encryptedData.is_covered_under_insurance || "N",
          encryptedData.insurance_policy_number || null,
          encryptedData.address_line1 || null,
          encryptedData.address_line2 || null,
          encryptedData.city || null,
          encryptedData.state || null,
          encryptedData.postal_code || null,
          encryptedData.country || null,
          encryptedData.is_emergency_contact || "N",
          encryptedData.notes || null,
        ]
      );
      res.status(201).json({ id: result.insertId });
    } catch (err) {
      next(err);
    }
  }
);

// Security sequence: Authentication (global) → BOLA → Validation → Business Logic → DB
// Update family/dependent record
router.patch(
  "/:empid/family/:id",
  authorizeEmployee, // BOLA check first
  updateFamilySchema,
  handleValidationErrors,
  async (req, res, next) => {
    const {
      relationship,
      name,
      date_of_birth,
      gender,
      is_dependent,
      occupation,
      employer_name,
      phone,
      email,
      aadhaar_number,
      pan_number,
      passport_number,
      passport_expiry,
      is_covered_under_insurance,
      insurance_policy_number,
      address_line1,
      address_line2,
      city,
      state,
      postal_code,
      country,
      is_emergency_contact,
      notes,
    } = req.body;
    const empid = req.params.empid;
    const id = req.params.id;

    try {
      // Check if employee exists
      const [[employee]] = await pool.query(SELECT_EMPLOYEE_EXISTS, [empid]);
      if (!employee) {
        throw new ApiError("Employee not found", 404);
      }

      // Check if family record exists
      const [[family]] = await pool.query(
        "SELECT id FROM employee_family_dependents WHERE id = ? AND empid = ?",
        [id, empid]
      );
      if (!family) {
        throw new ApiError("Family member record not found", 404);
      }

      // Encrypt PII fields in update data
      const encryptedUpdateData = encryptPIIFields(
        {
          relationship,
          name,
          date_of_birth,
          gender,
          is_dependent,
          occupation,
          employer_name,
          phone,
          email,
          aadhaar_number,
          pan_number,
          passport_number,
          passport_expiry,
          is_covered_under_insurance,
          insurance_policy_number,
          address_line1,
          address_line2,
          city,
          state,
          postal_code,
          country,
          is_emergency_contact,
          notes,
        },
        PII_FIELDS.employee_family_dependents
      );

      // Build update query
      const updates = [];
      const params = [];

      if (relationship !== undefined) {
        updates.push("relationship = ?");
        params.push(encryptedUpdateData.relationship);
      }
      if (name !== undefined) {
        updates.push("name = ?");
        params.push(encryptedUpdateData.name);
      }
      if (date_of_birth !== undefined) {
        updates.push("date_of_birth = ?");
        params.push(encryptedUpdateData.date_of_birth);
      }
      if (gender !== undefined) {
        updates.push("gender = ?");
        params.push(encryptedUpdateData.gender);
      }
      if (is_dependent !== undefined) {
        updates.push("is_dependent = ?");
        params.push(encryptedUpdateData.is_dependent);
      }
      if (occupation !== undefined) {
        updates.push("occupation = ?");
        params.push(encryptedUpdateData.occupation);
      }
      if (employer_name !== undefined) {
        updates.push("employer_name = ?");
        params.push(encryptedUpdateData.employer_name);
      }
      if (phone !== undefined) {
        updates.push("phone = ?");
        params.push(encryptedUpdateData.phone);
      }
      if (email !== undefined) {
        updates.push("email = ?");
        params.push(encryptedUpdateData.email);
      }
      if (aadhaar_number !== undefined) {
        updates.push("aadhaar_number = ?");
        params.push(encryptedUpdateData.aadhaar_number);
      }
      if (pan_number !== undefined) {
        updates.push("pan_number = ?");
        params.push(encryptedUpdateData.pan_number);
      }
      if (passport_number !== undefined) {
        updates.push("passport_number = ?");
        params.push(encryptedUpdateData.passport_number);
      }
      if (passport_expiry !== undefined) {
        updates.push("passport_expiry = ?");
        params.push(encryptedUpdateData.passport_expiry);
      }
      if (is_covered_under_insurance !== undefined) {
        updates.push("is_covered_under_insurance = ?");
        params.push(encryptedUpdateData.is_covered_under_insurance);
      }
      if (insurance_policy_number !== undefined) {
        updates.push("insurance_policy_number = ?");
        params.push(encryptedUpdateData.insurance_policy_number);
      }
      if (address_line1 !== undefined) {
        updates.push("address_line1 = ?");
        params.push(encryptedUpdateData.address_line1);
      }
      if (address_line2 !== undefined) {
        updates.push("address_line2 = ?");
        params.push(encryptedUpdateData.address_line2);
      }
      if (city !== undefined) {
        updates.push("city = ?");
        params.push(encryptedUpdateData.city);
      }
      if (state !== undefined) {
        updates.push("state = ?");
        params.push(encryptedUpdateData.state);
      }
      if (postal_code !== undefined) {
        updates.push("postal_code = ?");
        params.push(encryptedUpdateData.postal_code);
      }
      if (country !== undefined) {
        updates.push("country = ?");
        params.push(encryptedUpdateData.country);
      }
      if (is_emergency_contact !== undefined) {
        updates.push("is_emergency_contact = ?");
        params.push(encryptedUpdateData.is_emergency_contact);
      }
      if (notes !== undefined) {
        updates.push("notes = ?");
        params.push(encryptedUpdateData.notes);
      }

      if (updates.length > 0) {
        params.push(id, empid);
        await pool.query(
          `UPDATE employee_family_dependents SET ${updates.join(", ")} 
         WHERE id = ? AND empid = ?`,
          params
        );
      }

      res.json({ updated: true });
    } catch (err) {
      next(err);
    }
  }
);

// Security sequence: Authentication (global) → BOLA → Validation → Business Logic → DB
// Delete family/dependent record
router.delete(
  "/:empid/family/:id",
  authorizeEmployee, // BOLA check first
  [
    param("empid").notEmpty().trim(),
    param("id")
      .isInt({ min: 1 })
      .withMessage("id must be a positive integer")
      .toInt(),
  ],
  handleValidationErrors,
  async (req, res, next) => {
    try {
      const empid = req.params.empid;
      const id = req.params.id;

      // Check if employee exists
      const [[employee]] = await pool.query(SELECT_EMPLOYEE_EXISTS, [empid]);
      if (!employee) {
        throw new ApiError("Employee not found", 404);
      }

      const [result] = await pool.query(
        "DELETE FROM employee_family_dependents WHERE id = ? AND empid = ?",
        [id, empid]
      );
      if (result.affectedRows === 0) {
        throw new ApiError("Family member record not found", 404);
      }
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
