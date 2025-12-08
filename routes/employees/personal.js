const express = require("express");
const router = express.Router({ mergeParams: true });
const pool = require("../../db");
const ApiError = require("../../errors/ApiError");
const { SELECT_EMPLOYEE_EXISTS } = require("../../queries/employees");
const {
  updatePersonalDetailsSchema,
} = require("../../validations/employeeSchemas");
const { handleValidationErrors } = require("../../util/validation");
const { param } = require("express-validator");
const { authorizeEmployee } = require("../../middlewares/rbac");
const logger = require("../../util/logger");
const { encryptPIIFields, decryptPIIFields } = require("../../util/encryption");
const { PII_FIELDS } = require("../../config/piiFields");

// Security sequence: Authentication (global) → BOLA → Validation → Business Logic → DB
// Get personal details for an employee
router.get(
  "/:empid/personal",
  authorizeEmployee, // BOLA check first
  [param("empid").notEmpty().trim()],
  handleValidationErrors,
  async (req, res, next) => {
    try {
      const empid = req.params.empid;
      const requestedBy = req.user?.empid || "unknown";

      logger.info(
        {
          route: "/employees/:empid/personal",
          method: "GET",
          empid,
          requestedBy,
          ip: req.ip,
        },
        "Fetching personal details"
      );

      // Check if employee exists
      const [[employee]] = await pool.query(SELECT_EMPLOYEE_EXISTS, [empid]);
      if (!employee) {
        logger.warn(
          {
            route: "/employees/:empid/personal",
            method: "GET",
            empid,
            requestedBy,
          },
          "Employee not found"
        );
        throw new ApiError("Employee not found", 404);
      }

      const [[personalDetails]] = await pool.query(
        "SELECT * FROM employee_personal_details WHERE empid = ?",
        [empid]
      );

      if (!personalDetails) {
        logger.warn(
          {
            route: "/employees/:empid/personal",
            method: "GET",
            empid,
            requestedBy,
          },
          "Personal details not found"
        );
        throw new ApiError("Personal details not found", 404);
      }

      // Decrypt PII fields before sending response
      const decryptedDetails = decryptPIIFields(
        personalDetails,
        PII_FIELDS.employee_personal_details
      );

      logger.debug(
        {
          route: "/employees/:empid/personal",
          method: "GET",
          empid,
          requestedBy,
          hasPersonalDetails: !!personalDetails,
        },
        "Personal details retrieved successfully"
      );

      res.json(decryptedDetails);
    } catch (err) {
      logger.error(
        {
          route: "/employees/:empid/personal",
          method: "GET",
          empid: req.params.empid,
          requestedBy: req.user?.empid || "unknown",
          error: err.message,
          stack: err.stack,
          ip: req.ip,
        },
        "Error fetching personal details"
      );
      next(err);
    }
  }
);

// Security sequence: Authentication (global) → BOLA → Validation → Business Logic → DB
// Upsert personal details for an employee
router.put(
  "/:empid/personal",
  authorizeEmployee, // BOLA check first
  updatePersonalDetailsSchema,
  handleValidationErrors,
  async (req, res, next) => {
    const empid = req.params.empid;
    const requestedBy = req.user?.empid || "unknown";
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

    logger.info(
      {
        route: "/employees/:empid/personal",
        method: "PUT",
        empid,
        requestedBy,
        ip: req.ip,
        fieldsUpdated: Object.keys(req.body).filter(
          (key) => req.body[key] !== undefined
        ),
      },
      "Updating personal details"
    );

    try {
      // Check if employee exists
      const [[employee]] = await pool.query(SELECT_EMPLOYEE_EXISTS, [empid]);
      if (!employee) {
        logger.warn(
          {
            route: "/employees/:empid/personal",
            method: "PUT",
            empid,
            requestedBy,
          },
          "Employee not found"
        );
        throw new ApiError("Employee not found", 404);
      }

      // Encrypt PII fields before saving
      const encryptedData = encryptPIIFields(
        {
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
        },
        PII_FIELDS.employee_personal_details
      );

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
            encryptedData.phone || null,
            encryptedData.alternate_phone || null,
            encryptedData.date_of_birth || null,
            encryptedData.gender || null,
            encryptedData.marital_status || null,
            encryptedData.blood_group || null,
            encryptedData.emergency_contact_name || null,
            encryptedData.emergency_contact_phone || null,
            encryptedData.emergency_contact_relation || null,
            encryptedData.permanent_address_line1 || null,
            encryptedData.permanent_address_line2 || null,
            encryptedData.permanent_city || null,
            encryptedData.permanent_state || null,
            encryptedData.permanent_postal_code || null,
            encryptedData.permanent_country || null,
            encryptedData.current_address_line1 || null,
            encryptedData.current_address_line2 || null,
            encryptedData.current_city || null,
            encryptedData.current_state || null,
            encryptedData.current_postal_code || null,
            encryptedData.current_country || null,
            encryptedData.pan_number || null,
            encryptedData.aadhaar_number || null,
            encryptedData.passport_number || null,
            encryptedData.passport_expiry || null,
            encryptedData.driving_license_number || null,
            encryptedData.driving_license_expiry || null,
            empid,
          ]
        );

        logger.info(
          {
            route: "/employees/:empid/personal",
            method: "PUT",
            empid,
            requestedBy,
            action: "updated",
          },
          "Personal details updated successfully"
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
            encryptedData.phone || null,
            encryptedData.alternate_phone || null,
            encryptedData.date_of_birth || null,
            encryptedData.gender || null,
            encryptedData.marital_status || null,
            encryptedData.blood_group || null,
            encryptedData.emergency_contact_name || null,
            encryptedData.emergency_contact_phone || null,
            encryptedData.emergency_contact_relation || null,
            encryptedData.permanent_address_line1 || null,
            encryptedData.permanent_address_line2 || null,
            encryptedData.permanent_city || null,
            encryptedData.permanent_state || null,
            encryptedData.permanent_postal_code || null,
            encryptedData.permanent_country || null,
            encryptedData.current_address_line1 || null,
            encryptedData.current_address_line2 || null,
            encryptedData.current_city || null,
            encryptedData.current_state || null,
            encryptedData.current_postal_code || null,
            encryptedData.current_country || null,
            encryptedData.pan_number || null,
            encryptedData.aadhaar_number || null,
            encryptedData.passport_number || null,
            encryptedData.passport_expiry || null,
            encryptedData.driving_license_number || null,
            encryptedData.driving_license_expiry || null,
          ]
        );

        logger.info(
          {
            route: "/employees/:empid/personal",
            method: "PUT",
            empid,
            requestedBy,
            action: "created",
          },
          "Personal details created successfully"
        );

        return res.status(201).json({ created: true });
      }
    } catch (err) {
      logger.error(
        {
          route: "/employees/:empid/personal",
          method: "PUT",
          empid,
          requestedBy,
          error: err.message,
          stack: err.stack,
          ip: req.ip,
        },
        "Error updating personal details"
      );
      next(err);
    }
  }
);

module.exports = router;
