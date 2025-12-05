// routes/employees/jobInformation.js
// Employee Job Information Management APIs
const express = require("express");
const router = express.Router();
const pool = require("../../db");
const ApiError = require("../../errors/ApiError");
const { SELECT_EMPLOYEE_EXISTS } = require("../../queries/employees");
const { SELECT_DEPARTMENT_EXISTS } = require("../../queries/departments");
const { createUpdateJobInformationSchema, createJobHistorySchema } = require("../../validations/employeeSchemas");
const { handleValidationErrors } = require("../../util/validation");
const { param } = require("express-validator");

/**
 * GET /employees/:empid/job-information
 * Get job information for an employee
 */
router.get("/:empid/job-information",
  [param("empid").notEmpty().trim()],
  handleValidationErrors,
  async (req, res, next) => {
    const { empid } = req.params;

  try {
    // Check if employee exists
    const [[employee]] = await pool.query(
      SELECT_EMPLOYEE_EXISTS,
      [empid]
    );
    if (!employee) {
      throw new ApiError("Employee not found", 404);
    }

    const [[jobInfo]] = await pool.query(
      `SELECT 
        ji.job_title,
        ji.employment_type,
        ji.employment_status,
        DATE_FORMAT(ji.date_of_joining, '%Y-%m-%d') as date_of_joining, 
        DATE_FORMAT(ji.probation_start_date, '%Y-%m-%d') as probation_start_date,
        DATE_FORMAT(ji.probation_end_date, '%Y-%m-%d') as probation_end_date,
        ji.probation_status,
        DATE_FORMAT(ji.confirmation_date, '%Y-%m-%d') as confirmation_date,
        ji.shiftid,
        ji.cost_center,
        ji.employee_category,
        ji.grade,
        ji.level,
        e.empid,
        e.name as employee_name,
        e.email as employee_email,
        s.name as shift_name,
        s.shiftid,
        d.name as department_name,
        d.deptid as department_id,
        m.name as manager_name,
        m.empid as manager_empid
      FROM employee_job_information ji
      LEFT JOIN employees e ON ji.empid = e.empid
      LEFT JOIN attendance_shifts s ON ji.shiftid = s.shiftid
      LEFT JOIN departments d ON e.department_id = d.deptid
      LEFT JOIN employees m ON e.manager_id = m.empid
      WHERE ji.empid = ?`,
      [empid]
    );

    if (!jobInfo) {
      throw new ApiError("Job information not found", 404);
    }

    res.json(jobInfo);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /employees/:empid/job-information
 * Create or update job information (HR Manager/Admin only)
 */
router.post("/:empid/job-information",
  createUpdateJobInformationSchema,
  handleValidationErrors,
  async (req, res, next) => {
    const { empid } = req.params;
    const {
      job_title,
      employment_type,
      employment_status,
      date_of_joining,
      probation_start_date,
      probation_end_date,
      probation_status,
      confirmation_date,
      shiftid,
      cost_center,
      employee_category,
      grade,
      level,
    } = req.body;

  try {

    // Check if employee exists
    const [[employee]] = await pool.query(
      SELECT_EMPLOYEE_EXISTS,
      [empid]
    );
    if (!employee) {
      throw new ApiError("Employee not found", 404);
    }

    // Validate shift if provided
    if (shiftid) {
      const [[shift]] = await pool.query(
        "SELECT shiftid FROM attendance_shifts WHERE shiftid = ?",
        [shiftid]
      );
      if (!shift) {
        throw new ApiError("Shift not found", 404);
      }
    }

    // Check if job info already exists
    const [[existing]] = await pool.query(
      "SELECT empid FROM employee_job_information WHERE empid = ?",
      [empid]
    );

    if (existing) {
      // Update existing
      const updates = [];
      const params = [];

      if (job_title !== undefined) {
        updates.push("job_title = ?");
        params.push(job_title);
      }
      if (employment_type !== undefined) {
        updates.push("employment_type = ?");
        params.push(employment_type);
      }
      if (employment_status !== undefined) {
        updates.push("employment_status = ?");
        params.push(employment_status);
      }
      if (date_of_joining !== undefined) {
        updates.push("date_of_joining = ?");
        params.push(date_of_joining);
      }
      if (probation_start_date !== undefined) {
        updates.push("probation_start_date = ?");
        params.push(probation_start_date || null);
      }
      if (probation_end_date !== undefined) {
        updates.push("probation_end_date = ?");
        params.push(probation_end_date || null);
      }
      if (probation_status !== undefined) {
        updates.push("probation_status = ?");
        params.push(probation_status || null);
      }
      if (confirmation_date !== undefined) {
        updates.push("confirmation_date = ?");
        params.push(confirmation_date || null);
      }
      if (shiftid !== undefined) {
        updates.push("shiftid = ?");
        params.push(shiftid || null);
      }
      if (cost_center !== undefined) {
        updates.push("cost_center = ?");
        params.push(cost_center || null);
      }
      if (employee_category !== undefined) {
        updates.push("employee_category = ?");
        params.push(employee_category || null);
      }
      if (grade !== undefined) {
        updates.push("grade = ?");
        params.push(grade || null);
      }
      if (level !== undefined) {
        updates.push("level = ?");
        params.push(level || null);
      }

      if (updates.length > 0) {
        params.push(empid);
        await pool.query(
          `UPDATE employee_job_information 
          SET ${updates.join(", ")} 
          WHERE empid = ?`,
          params
        );
      }

      // Fetch updated info
      const [[updated]] = await pool.query(
        `SELECT 
          ji.*,
          e.empid,
          e.name as employee_name,
          s.name as shift_name
        FROM employee_job_information ji
        LEFT JOIN employees e ON ji.empid = e.empid
        LEFT JOIN attendance_shifts s ON ji.shiftid = s.shiftid
        WHERE ji.empid = ?`,
        [empid]
      );

      return res.json({
        message: "Job information updated successfully",
        job_information: updated,
      });
    } else {
      // Create new
      await pool.query(
        `INSERT INTO employee_job_information (
          empid, job_title, employment_type, employment_status,
          date_of_joining, probation_start_date, probation_end_date, probation_status,
          confirmation_date, shiftid, cost_center, employee_category, grade, level
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          empid,
          job_title,
          employment_type || "full_time",
          employment_status || "active",
          date_of_joining,
          probation_start_date || null,
          probation_end_date || null,
          probation_status || null,
          confirmation_date || null,
          shiftid || null,
          cost_center || null,
          employee_category || null,
          grade || null,
          level || null,
        ]
      );

      // Fetch created info
      const [[created]] = await pool.query(
        `SELECT 
          ji.*,
          e.empid,
          e.name as employee_name,
          s.name as shift_name
        FROM employee_job_information ji
        LEFT JOIN employees e ON ji.empid = e.empid
        LEFT JOIN attendance_shifts s ON ji.shiftid = s.shiftid
        WHERE ji.empid = ?`,
        [empid]
      );

      return res.status(201).json({
        message: "Job information created successfully",
        job_information: created,
      });
    }
  } catch (error) {
    next(error);
  }
});

/**
 * GET /employees/:empid/job-history
 * Get job history (promotions, transfers) for an employee
 */
router.get("/:empid/job-history",
  [param("empid").notEmpty().trim()],
  handleValidationErrors,
  async (req, res, next) => {
    const { empid } = req.params;

  try {
    // Check if employee exists
    const [[employee]] = await pool.query(
      SELECT_EMPLOYEE_EXISTS,
      [empid]
    );
    if (!employee) {
      throw new ApiError("Employee not found", 404);
    }

    const [history] = await pool.query(
      `SELECT 
        jh.id,
        jh.change_type,
        jh.previous_job_title,
        jh.new_job_title,
        DATE_FORMAT(jh.effective_date, '%Y-%m-%d') as effective_date,
        jh.reason,
        jh.notes,
        jh.approved_by,
        DATE_FORMAT(jh.approved_at, '%Y-%m-%d') as approved_at,
        prev_dept.name as previous_department_name,
        prev_dept.deptid as previous_department_id,
        new_dept.name as new_department_name,
        new_dept.deptid as new_department_id,
        prev_mgr.name as previous_manager_name,
        prev_mgr.empid as previous_manager_empid,
        new_mgr.name as new_manager_name,
        new_mgr.empid as new_manager_empid,
        approver.name as approved_by_name,
        approver.empid as approved_by_empid
      FROM employee_job_history jh
      LEFT JOIN departments prev_dept ON jh.previous_department_id = prev_dept.deptid
      LEFT JOIN departments new_dept ON jh.new_department_id = new_dept.deptid
      LEFT JOIN employees prev_mgr ON jh.previous_manager_id = prev_mgr.empid
      LEFT JOIN employees new_mgr ON jh.new_manager_id = new_mgr.empid
      LEFT JOIN employees approver ON jh.approved_by = approver.empid
      WHERE jh.empid = ?
      ORDER BY jh.effective_date DESC, jh.created_at DESC`,
      [empid]
    );

    res.json({ job_history: history });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /employees/:empid/job-history
 * Add job history entry (promotion, transfer, etc.) - HR Manager/Admin only
 */
router.post("/:empid/job-history",
  createJobHistorySchema,
  handleValidationErrors,
  async (req, res, next) => {
    const { empid } = req.params;
    const {
      previous_job_title,
      new_job_title,
      previous_department_id,
      new_department_id,
      previous_manager_id,
      new_manager_id,
      change_type,
      effective_date,
      reason,
      notes,
    } = req.body;
    const approved_by = req.user?.empid;

  try {

    // Check if employee exists
    const [[employee]] = await pool.query(
      SELECT_EMPLOYEE_EXISTS,
      [empid]
    );
    if (!employee) {
      throw new ApiError("Employee not found", 404);
    }

    // Validate departments if provided
    if (previous_department_id) {
      const [[dept]] = await pool.query(
        SELECT_DEPARTMENT_EXISTS,
        [previous_department_id]
      );
      if (!dept) {
        throw new ApiError("Previous department not found", 404);
      }
    }

    if (new_department_id) {
      const [[dept]] = await pool.query(
        SELECT_DEPARTMENT_EXISTS,
        [new_department_id]
      );
      if (!dept) {
        throw new ApiError("New department not found", 404);
      }
    }

    // Validate managers if provided
    if (previous_manager_id) {
      const [[mgr]] = await pool.query(
        SELECT_EMPLOYEE_EXISTS,
        [previous_manager_id]
      );
      if (!mgr) {
        throw new ApiError("Previous manager not found", 404);
      }
    }

    if (new_manager_id) {
      const [[mgr]] = await pool.query(
        SELECT_EMPLOYEE_EXISTS,
        [new_manager_id]
      );
      if (!mgr) {
        throw new ApiError("New manager not found", 404);
      }
    }

    // Validate approver
    if (approved_by) {
      const [[approver]] = await pool.query(
        SELECT_EMPLOYEE_EXISTS,
        [approved_by]
      );
      if (!approver) {
        throw new ApiError("Approver not found", 404);
      }
    }

    const [result] = await pool.query(
      `INSERT INTO employee_job_history (
        empid, previous_job_title, new_job_title,
        previous_department_id, new_department_id, previous_manager_id, new_manager_id,
        change_type, effective_date, reason, approved_by, approved_at, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?)`,
      [
        empid,
        previous_job_title || null,
        new_job_title,
        previous_department_id || null,
        new_department_id || null,
        previous_manager_id || null,
        new_manager_id || null,
        change_type,
        effective_date,
        reason || null,
        approved_by || null,
        notes || null,
      ]
    );

    // Fetch created entry
    const [[entry]] = await pool.query(
      `SELECT 
        jh.*,
        prev_dept.name as previous_department_name,
        new_dept.name as new_department_name
      FROM employee_job_history jh
      LEFT JOIN departments prev_dept ON jh.previous_department_id = prev_dept.deptid
      LEFT JOIN departments new_dept ON jh.new_department_id = new_dept.deptid
      WHERE jh.id = ?`,
      [result.insertId]
    );

    res.status(201).json({
      message: "Job history entry created successfully",
      job_history: entry,
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
