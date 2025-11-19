// routes/attendance.js
const express = require("express");
const router = express.Router();
const pool = require("../../db");
const ApiError = require("../../util/ApiError");
const { resolveEmployeeNumericId } = require("../../util/employeeUtil");
const logger = require("../../config/logger");

router.post("/clockin", async (req, res, next) => {
  const { employee_id, work_date, clock_in, source = 'web' } = req.body;
  const organization_id = req.organizationId;
  
  try {
    if (!employee_id || !work_date || !clock_in) {
      throw new ApiError("employee_id, work_date, and clock_in are required", 400);
    }

    // Resolve employee numeric ID if employee_code is provided
    const employeeNumericId = await resolveEmployeeNumericId(employee_id, organization_id);

    // Check if attendance record already exists for this date
    const [[existing]] = await pool.query(
      "SELECT id FROM attendance_records WHERE organization_id = ? AND employee_id = ? AND work_date = ?",
      [organization_id, employeeNumericId, work_date]
    );

    if (existing) {
      // Update existing record
      await pool.query(
        "UPDATE attendance_records SET clock_in = ?, source = ?, updated_at = NOW() WHERE id = ?",
        [clock_in, source, existing.id]
      );
      res.status(200).json({ message: "Clock-in updated successfully", id: existing.id });
    } else {
      // Create new record
      const [result] = await pool.query(
        "INSERT INTO attendance_records (organization_id, employee_id, work_date, clock_in, status, source) VALUES (?, ?, ?, ?, 'present', ?)",
        [organization_id, employeeNumericId, work_date, clock_in, source]
      );
      res.status(201).json({ message: "Clock-in recorded successfully", id: result.insertId });
    }
  } catch (error) {
    next(error);
  }
});

router.post("/clockout", async (req, res, next) => {
  const { employee_id, work_date, clock_out, source = 'web' } = req.body;
  const organization_id = req.organizationId;
  
  try {
    if (!employee_id || !work_date || !clock_out) {
      throw new ApiError("employee_id, work_date, and clock_out are required", 400);
    }

    // Resolve employee numeric ID if employee_code is provided
    const employeeNumericId = await resolveEmployeeNumericId(employee_id, organization_id);

    const [result] = await pool.query(
      "UPDATE attendance_records SET clock_out = ?, source = ?, updated_at = NOW() WHERE organization_id = ? AND employee_id = ? AND work_date = ?",
      [clock_out, source, organization_id, employeeNumericId, work_date]
    );
    
    if (result.affectedRows === 0) {
      throw new ApiError("No attendance record found for the date", 404);
    }
    
    res.status(200).json({ message: "Clock-out recorded successfully" });
  } catch (error) {
    next(error);
  }
});

router.get("/", async (req, res, next) => {
  const { work_date, date, employee_id, manager_id, status, approved_by } = req.query;
  const organization_id = req.organizationId;
  
  // Support both 'work_date' and 'date' for backward compatibility
  const queryDate = work_date || date;
  
  // Validate that employee_id and manager_id are not both provided
  if (employee_id && manager_id) {
    throw new ApiError(
      "Cannot use both employee_id and manager_id. Use one or the other.",
      400
    );
  }
  
  try {
    let whereClauses = [];
    let params = [];

    // Always filter by organization_id
    whereClauses.push("ar.organization_id = ?");
    params.push(organization_id);

    if (queryDate) {
      whereClauses.push("ar.work_date = ?");
      params.push(queryDate);
    }
    
    if (manager_id) {
      // Resolve manager numeric ID if employee_code is provided
      const managerNumericId = await resolveEmployeeNumericId(manager_id, organization_id);
      
      // Get all employees reporting to this manager
      const [teamMembers] = await pool.query(
        "SELECT id FROM employees WHERE manager_id = ? AND organization_id = ?",
        [managerNumericId, organization_id]
      );
      
      if (teamMembers.length === 0) {
        return res.status(200).json({ attendance: [] });
      }
      
      const teamMemberIds = teamMembers.map((e) => e.id);
      whereClauses.push("ar.employee_id IN (?)");
      params.push(teamMemberIds);
    } else if (employee_id) {
      // Resolve employee numeric ID if employee_code is provided
      const employeeNumericId = await resolveEmployeeNumericId(employee_id, organization_id);
      whereClauses.push("ar.employee_id = ?");
      params.push(employeeNumericId);
    }
    
    if (status) {
      whereClauses.push("ar.status = ?");
      params.push(status);
    }
    if (approved_by) {
      whereClauses.push("ar.approved_by = ?");
      params.push(approved_by);
    }

    // Combine WHERE clauses
    const whereSql = whereClauses.length
      ? `WHERE ${whereClauses.join(" AND ")}`
      : "";

    // Fetch attendance records with employee details
    const dataQuery = `
      SELECT 
        ar.id,
        ar.organization_id,
        ar.employee_id,
        ar.work_date,
        ar.shift_id,
        ar.clock_in,
        ar.clock_out,
        ar.break_minutes,
        ar.status,
        ar.source,
        ar.notes,
        ar.approved_by,
        ar.approved_at,
        ar.worked_minutes,
        ar.created_at,
        ar.updated_at,
        e.employee_code,
        e.name as employee_name,
        e.email as employee_email,
        d.name as department_name
      FROM attendance_records ar
      LEFT JOIN employees e ON ar.employee_id = e.id
      LEFT JOIN departments d ON e.department_id = d.id
      ${whereSql}
      ORDER BY ar.work_date DESC, ar.created_at DESC
    `;

    const [items] = await pool.query(dataQuery, params);

    res.status(200).json({ attendance: items });
  } catch (error) {
    next(error);
  }
});

router.get("/:id", async (req, res, next) => {
  const organization_id = req.organizationId;
  try {
    const [[record]] = await pool.query(
      `SELECT 
        ar.id,
        ar.organization_id,
        ar.employee_id,
        ar.work_date,
        ar.shift_id,
        ar.clock_in,
        ar.clock_out,
        ar.break_minutes,
        ar.status,
        ar.source,
        ar.notes,
        ar.approved_by,
        ar.approved_at,
        ar.worked_minutes,
        ar.created_at,
        ar.updated_at,
        e.employee_code,
        e.name as employee_name,
        e.email as employee_email
      FROM attendance_records ar
      LEFT JOIN employees e ON ar.employee_id = e.id
      WHERE ar.id = ? AND ar.organization_id = ?`,
      [req.params.id, organization_id]
    );
    
    if (!record) throw new ApiError("Attendance record not found", 404);
    res.json(record);
  } catch (error) {
    next(error);
  }
});

router.patch("/:id", async (req, res, next) => {
  const {
    status,
    clock_in,
    clock_out,
    break_minutes,
    notes,
    shift_id,
  } = req.body;
  const organization_id = req.organizationId;
  
  try {
    // Validate status if provided
    const validStatuses = ['present', 'absent', 'half_day', 'on_leave', 'week_off', 'holiday'];
    if (status && !validStatuses.includes(status)) {
      throw new ApiError(`Invalid status. Must be one of: ${validStatuses.join(', ')}`, 400);
    }

    const updates = [];
    const params = [];

    if (status !== undefined) {
      updates.push("status = ?");
      params.push(status);
    }
    if (clock_in !== undefined) {
      updates.push("clock_in = ?");
      params.push(clock_in);
    }
    if (clock_out !== undefined) {
      updates.push("clock_out = ?");
      params.push(clock_out);
    }
    if (break_minutes !== undefined) {
      updates.push("break_minutes = ?");
      params.push(break_minutes);
    }
    if (notes !== undefined) {
      updates.push("notes = ?");
      params.push(notes);
    }
    if (shift_id !== undefined) {
      updates.push("shift_id = ?");
      params.push(shift_id);
    }

    if (updates.length === 0) {
      throw new ApiError("No fields to update", 400);
    }

    params.push(req.params.id, organization_id);
    
    const [result] = await pool.query(
      `UPDATE attendance_records SET ${updates.join(", ")}, updated_at = NOW() WHERE id = ? AND organization_id = ?`,
      params
    );
    
    if (result.affectedRows === 0) {
      throw new ApiError("Attendance record not found", 404);
    }
    
    res.json({ updated: true });
  } catch (error) {
    next(error);
  }
});

router.post("/:id/approve", async (req, res, next) => {
  const { approved_by } = req.body;
  const organization_id = req.organizationId;
  
  try {
    if (!approved_by) {
      throw new ApiError("approved_by is required", 400);
    }

    const [result] = await pool.query(
      "UPDATE attendance_records SET approved_by = ?, approved_at = NOW() WHERE id = ? AND organization_id = ?",
      [approved_by, req.params.id, organization_id]
    );
    
    if (result.affectedRows === 0) {
      throw new ApiError("Attendance record not found", 404);
    }
    
    res.json({ approved: true });
  } catch (error) {
    next(error);
  }
});

router.post("/:id/reject", async (req, res, next) => {
  const { approved_by } = req.body;
  const organization_id = req.organizationId;
  
  try {
    if (!approved_by) {
      throw new ApiError("approved_by is required", 400);
    }

    const [result] = await pool.query(
      "UPDATE attendance_records SET approved_by = NULL, approved_at = NULL WHERE id = ? AND organization_id = ?",
      [req.params.id, organization_id]
    );
    
    if (result.affectedRows === 0) {
      throw new ApiError("Attendance record not found", 404);
    }
    
    res.json({ rejected: true });
  } catch (error) {
    next(error);
  }
});

// Regularization request mapped to attendance_exceptions
router.post("/:id/regularize", async (req, res, next) => {
  const { requested_by, kind = "regularization", comment = null } = req.body;
  const organization_id = req.organizationId;
  
  try {
    if (!requested_by) {
      throw new ApiError("requested_by is required", 400);
    }

    // Validate attendance record exists and belongs to organization
    const [[att]] = await pool.query(
      "SELECT id FROM attendance_records WHERE id = ? AND organization_id = ?",
      [req.params.id, organization_id]
    );
    
    if (!att) {
      throw new ApiError("Attendance record not found", 404);
    }

    // Validate kind
    const validKinds = ['missing_in', 'missing_out', 'regularization', 'other'];
    if (!validKinds.includes(kind)) {
      throw new ApiError(`Invalid kind. Must be one of: ${validKinds.join(', ')}`, 400);
    }

    const [result] = await pool.query(
      "INSERT INTO attendance_exceptions (organization_id, attendance_id, kind, requested_by, comment) VALUES (?, ?, ?, ?, ?)",
      [organization_id, req.params.id, kind, requested_by, comment]
    );
    
    res.status(201).json({ id: result.insertId });
  } catch (error) {
    next(error);
  }
});

router.get("/team/summary", async (req, res, next) => {
  const { manager_id, work_date } = req.query;
  const organization_id = req.organizationId;
  
  try {
    if (!manager_id) {
      throw new ApiError("manager_id is required", 400);
    }

    const date = work_date || new Date().toISOString().split("T")[0]; // YYYY-MM-DD

    // Step 1: Get team members reporting to manager (within organization)
    const [employees] = await pool.query(
      "SELECT id, employee_code, name, email FROM employees WHERE manager_id = ? AND organization_id = ?",
      [manager_id, organization_id]
    );

    if (employees.length === 0) {
      return res.json({ 
        manager_id, 
        work_date: date, 
        team_summary: [] 
      });
    }

    // Step 2: Get attendance records for those employees on the date
    const employeeIds = employees.map((e) => e.id);

    const [attendanceRecords] = await pool.query(
      `SELECT 
        ar.employee_id,
        ar.status,
        ar.clock_in,
        ar.clock_out,
        ar.break_minutes,
        ar.worked_minutes,
        ar.approved_by,
        ar.approved_at
      FROM attendance_records ar
      WHERE ar.organization_id = ? AND ar.work_date = ? AND ar.employee_id IN (?)`,
      [organization_id, date, employeeIds]
    );

    // Step 3: Merge employee and attendance data for summary
    const summary = employees.map((emp) => {
      const attendance = attendanceRecords.find(
        (a) => a.employee_id === emp.id
      );

      return {
        employee_id: emp.id,
        employee_code: emp.employee_code,
        employee_name: emp.name,
        employee_email: emp.email,
        status: attendance ? attendance.status : null,
        clock_in: attendance ? attendance.clock_in : null,
        clock_out: attendance ? attendance.clock_out : null,
        break_minutes: attendance ? attendance.break_minutes : 0,
        worked_minutes: attendance ? attendance.worked_minutes : null,
        approved_by: attendance ? attendance.approved_by : null,
        approved_at: attendance ? attendance.approved_at : null,
      };
    });

    res.json({ 
      manager_id, 
      work_date: date, 
      team_summary: summary 
    });
  } catch (error) {
    logger.error("Error fetching attendance summary", {
      error: error.message,
      stack: error.stack,
      manager_id: manager_id,
      work_date: work_date,
    });
    next(error);
  }
});

module.exports = router;
