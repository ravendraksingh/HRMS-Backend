const express = require("express");
const router = express.Router({ mergeParams: true });
const pool = require("../../db");
const ApiError = require("../../util/ApiError");

// Get family and dependents for an employee
router.get("/employees/:empid/family", async (req, res, next) => {
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

    const [rows] = await pool.query(
      "SELECT * FROM employee_family_dependents WHERE empid = ? ORDER BY id DESC",
      [empid]
    );
    res.json({ family: rows });
  } catch (err) {
    next(err);
  }
});

// Create family/dependent record
router.post("/employees/:empid/family", async (req, res, next) => {
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
    const [[employee]] = await pool.query(
      "SELECT empid FROM employees WHERE empid = ?",
      [empid]
    );
    if (!employee) {
      throw new ApiError("Employee not found", 404);
    }

    if (!relationship || !name) {
      throw new ApiError("relationship and name are required", 400);
    }

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
        relationship,
        name,
        date_of_birth || null,
        gender || null,
        is_dependent || "N",
        occupation || null,
        employer_name || null,
        phone || null,
        email || null,
        aadhaar_number || null,
        pan_number || null,
        passport_number || null,
        passport_expiry || null,
        is_covered_under_insurance || "N",
        insurance_policy_number || null,
        address_line1 || null,
        address_line2 || null,
        city || null,
        state || null,
        postal_code || null,
        country || null,
        is_emergency_contact || "N",
        notes || null,
      ]
    );
    res.status(201).json({ id: result.insertId });
  } catch (err) {
    next(err);
  }
});

// Update family/dependent record
router.patch("/employees/:empid/family/:id", async (req, res, next) => {
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
    const [[employee]] = await pool.query(
      "SELECT empid FROM employees WHERE empid = ?",
      [empid]
    );
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

    // Build update query
    const updates = [];
    const params = [];

    if (relationship !== undefined) {
      updates.push("relationship = ?");
      params.push(relationship);
    }
    if (name !== undefined) {
      updates.push("name = ?");
      params.push(name);
    }
    if (date_of_birth !== undefined) {
      updates.push("date_of_birth = ?");
      params.push(date_of_birth);
    }
    if (gender !== undefined) {
      updates.push("gender = ?");
      params.push(gender);
    }
    if (is_dependent !== undefined) {
      updates.push("is_dependent = ?");
      params.push(is_dependent);
    }
    if (occupation !== undefined) {
      updates.push("occupation = ?");
      params.push(occupation);
    }
    if (employer_name !== undefined) {
      updates.push("employer_name = ?");
      params.push(employer_name);
    }
    if (phone !== undefined) {
      updates.push("phone = ?");
      params.push(phone);
    }
    if (email !== undefined) {
      updates.push("email = ?");
      params.push(email);
    }
    if (aadhaar_number !== undefined) {
      updates.push("aadhaar_number = ?");
      params.push(aadhaar_number);
    }
    if (pan_number !== undefined) {
      updates.push("pan_number = ?");
      params.push(pan_number);
    }
    if (passport_number !== undefined) {
      updates.push("passport_number = ?");
      params.push(passport_number);
    }
    if (passport_expiry !== undefined) {
      updates.push("passport_expiry = ?");
      params.push(passport_expiry);
    }
    if (is_covered_under_insurance !== undefined) {
      updates.push("is_covered_under_insurance = ?");
      params.push(is_covered_under_insurance);
    }
    if (insurance_policy_number !== undefined) {
      updates.push("insurance_policy_number = ?");
      params.push(insurance_policy_number);
    }
    if (address_line1 !== undefined) {
      updates.push("address_line1 = ?");
      params.push(address_line1);
    }
    if (address_line2 !== undefined) {
      updates.push("address_line2 = ?");
      params.push(address_line2);
    }
    if (city !== undefined) {
      updates.push("city = ?");
      params.push(city);
    }
    if (state !== undefined) {
      updates.push("state = ?");
      params.push(state);
    }
    if (postal_code !== undefined) {
      updates.push("postal_code = ?");
      params.push(postal_code);
    }
    if (country !== undefined) {
      updates.push("country = ?");
      params.push(country);
    }
    if (is_emergency_contact !== undefined) {
      updates.push("is_emergency_contact = ?");
      params.push(is_emergency_contact);
    }
    if (notes !== undefined) {
      updates.push("notes = ?");
      params.push(notes);
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
});

// Delete family/dependent record
router.delete("/employees/:empid/family/:id", async (req, res, next) => {
  try {
    const empid = req.params.empid;
    const id = req.params.id;

    // Check if employee exists
    const [[employee]] = await pool.query(
      "SELECT empid FROM employees WHERE empid = ?",
      [empid]
    );
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
});

module.exports = router;
