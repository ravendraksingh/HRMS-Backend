const express = require("express");
const router = express.Router({ mergeParams: true });
const pool = require("../../db");
const ApiError = require("../../util/ApiError");

// Get educational details for an employee
router.get("/employees/:empid/education", async (req, res, next) => {
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
        ed.*,
        v.name as verified_by_name,
        v.email as verified_by_email
      FROM employee_educational_details ed
      LEFT JOIN employees v ON ed.verified_by = v.empid
      WHERE ed.empid = ? 
      ORDER BY ed.end_date DESC, ed.start_date DESC`,
      [empid]
    );
    res.json({ education: rows });
  } catch (err) {
    next(err);
  }
});

// Create educational detail record
router.post("/employees/:empid/education", async (req, res, next) => {
  const {
    qualification_type,
    degree,
    specialization,
    institution_name,
    university_board,
    start_date,
    end_date,
    percentage,
    cgpa,
    grade,
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

    if (!qualification_type || !institution_name) {
      throw new ApiError("qualification_type and institution_name are required", 400);
    }

    const [result] = await pool.query(
      `INSERT INTO employee_educational_details 
       (empid, qualification_type, degree, specialization, institution_name, 
        university_board, start_date, end_date, percentage, cgpa, grade) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        empid,
        qualification_type,
        degree || null,
        specialization || null,
        institution_name,
        university_board || null,
        start_date || null,
        end_date || null,
        percentage || null,
        cgpa || null,
        grade || null,
      ]
    );
    res.status(201).json({ id: result.insertId });
  } catch (err) {
    next(err);
  }
});

// Update educational detail record
router.patch("/employees/:empid/education/:id", async (req, res, next) => {
  const {
    qualification_type,
    degree,
    specialization,
    institution_name,
    university_board,
    start_date,
    end_date,
    percentage,
    cgpa,
    grade,
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

    // Check if educational detail record exists
    const [[education]] = await pool.query(
      "SELECT id FROM employee_educational_details WHERE id = ? AND empid = ?",
      [id, empid]
    );
    if (!education) {
      throw new ApiError("Educational detail record not found", 404);
    }

    // Build update query
    const updates = [];
    const params = [];

    if (qualification_type !== undefined) {
      updates.push("qualification_type = ?");
      params.push(qualification_type);
    }
    if (degree !== undefined) {
      updates.push("degree = ?");
      params.push(degree);
    }
    if (specialization !== undefined) {
      updates.push("specialization = ?");
      params.push(specialization);
    }
    if (institution_name !== undefined) {
      updates.push("institution_name = ?");
      params.push(institution_name);
    }
    if (university_board !== undefined) {
      updates.push("university_board = ?");
      params.push(university_board);
    }
    if (start_date !== undefined) {
      updates.push("start_date = ?");
      params.push(start_date);
    }
    if (end_date !== undefined) {
      updates.push("end_date = ?");
      params.push(end_date);
    }
    if (percentage !== undefined) {
      updates.push("percentage = ?");
      params.push(percentage);
    }
    if (cgpa !== undefined) {
      updates.push("cgpa = ?");
      params.push(cgpa);
    }
    if (grade !== undefined) {
      updates.push("grade = ?");
      params.push(grade);
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
        `UPDATE employee_educational_details SET ${updates.join(", ")} 
         WHERE id = ? AND empid = ?`,
        params
      );
    }

    res.json({ updated: true });
  } catch (err) {
    next(err);
  }
});

// Delete educational detail record
router.delete("/employees/:empid/education/:id", async (req, res, next) => {
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
      "DELETE FROM employee_educational_details WHERE id = ? AND empid = ?",
      [id, empid]
    );
    if (result.affectedRows === 0) {
      throw new ApiError("Educational detail record not found", 404);
    }
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
