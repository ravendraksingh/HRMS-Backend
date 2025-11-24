const express = require("express");
const router = express.Router({ mergeParams: true });
const pool = require("../../db");
const ApiError = require("../../util/ApiError");

// Get employment history for an employee
router.get("/employees/:empid/employment-history", async (req, res, next) => {
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
      `SELECT 
        eh.*,
        v.name as verified_by_name,
        v.email as verified_by_email
      FROM employee_employment_history eh
      LEFT JOIN employees v ON eh.verified_by = v.empid
      WHERE eh.empid = ? 
      ORDER BY eh.start_date DESC`,
      [empid]
    );
    res.json({ history: rows });
  } catch (err) {
    next(err);
  }
});

// Create employment history record
router.post("/employees/:empid/employment-history", async (req, res, next) => {
  const {
    company_name,
    designation,
    start_date,
    end_date,
    job_description,
    reason_for_leaving,
    last_salary,
    supervisor_name,
    supervisor_contact,
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

    if (!company_name || !designation || !start_date) {
      throw new ApiError("company_name, designation, and start_date are required", 400);
    }

    const [result] = await pool.query(
      `INSERT INTO employee_employment_history 
       (empid, company_name, designation, start_date, end_date, job_description, 
        reason_for_leaving, last_salary, supervisor_name, supervisor_contact) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        empid,
        company_name,
        designation,
        start_date,
        end_date || null,
        job_description || null,
        reason_for_leaving || null,
        last_salary || null,
        supervisor_name || null,
        supervisor_contact || null,
      ]
    );
    res.status(201).json({ id: result.insertId });
  } catch (err) {
    next(err);
  }
});

// Update employment history record
router.patch("/employees/:empid/employment-history/:id", async (req, res, next) => {
  const {
    company_name,
    designation,
    start_date,
    end_date,
    job_description,
    reason_for_leaving,
    last_salary,
    supervisor_name,
    supervisor_contact,
    is_verified,
    verified_by,
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

    // Check if employment history record exists
    const [[history]] = await pool.query(
      "SELECT id FROM employee_employment_history WHERE id = ? AND empid = ?",
      [id, empid]
    );
    if (!history) {
      throw new ApiError("Employment history record not found", 404);
    }

    // Build update query
    const updates = [];
    const params = [];

    if (company_name !== undefined) {
      updates.push("company_name = ?");
      params.push(company_name);
    }
    if (designation !== undefined) {
      updates.push("designation = ?");
      params.push(designation);
    }
    if (start_date !== undefined) {
      updates.push("start_date = ?");
      params.push(start_date);
    }
    if (end_date !== undefined) {
      updates.push("end_date = ?");
      params.push(end_date);
    }
    if (job_description !== undefined) {
      updates.push("job_description = ?");
      params.push(job_description);
    }
    if (reason_for_leaving !== undefined) {
      updates.push("reason_for_leaving = ?");
      params.push(reason_for_leaving);
    }
    if (last_salary !== undefined) {
      updates.push("last_salary = ?");
      params.push(last_salary);
    }
    if (supervisor_name !== undefined) {
      updates.push("supervisor_name = ?");
      params.push(supervisor_name);
    }
    if (supervisor_contact !== undefined) {
      updates.push("supervisor_contact = ?");
      params.push(supervisor_contact);
    }
    if (is_verified !== undefined) {
      updates.push("is_verified = ?");
      params.push(is_verified);
    }
    if (verified_by !== undefined) {
      if (verified_by === null) {
        updates.push("verified_by = NULL, verified_at = NULL");
      } else {
        // Validate verifier exists
        const [[verifier]] = await pool.query(
          "SELECT empid FROM employees WHERE empid = ?",
          [verified_by]
        );
        if (!verifier) {
          throw new ApiError("Verifier employee not found", 404);
        }
        updates.push("verified_by = ?, verified_at = NOW()");
        params.push(verified_by);
      }
    }

    if (updates.length > 0) {
      params.push(id, empid);
      await pool.query(
        `UPDATE employee_employment_history SET ${updates.join(", ")} 
         WHERE id = ? AND empid = ?`,
        params
      );
    }

    res.json({ updated: true });
  } catch (err) {
    next(err);
  }
});

// Delete employment history record
router.delete("/employees/:empid/employment-history/:id", async (req, res, next) => {
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
      "DELETE FROM employee_employment_history WHERE id = ? AND empid = ?",
      [id, empid]
    );
    if (result.affectedRows === 0) {
      throw new ApiError("Employment history record not found", 404);
    }
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
