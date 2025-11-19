const express = require("express");
const router = express.Router();
const pool = require("../../db");
const ApiError = require("../../util/ApiError");
const { resolveEmployeeNumericId } = require("../../util/employeeUtil");

router.get("/", async (req, res, next) => {
  const { employee_id, manager_id, from, to, status } = req.query;
  const organization_id = req.organizationId;

  // Either employee_id or manager_id should be provided, but not both
  if (!employee_id && !manager_id) {
    throw new ApiError(
      "Either employee_id or manager_id query parameter is required",
      400
    );
  }

  if (employee_id && manager_id) {
    throw new ApiError(
      "Cannot use both employee_id and manager_id. Use one or the other.",
      400
    );
  }

  try {
    let where = ["al.organization_id = ?"];
    let params = [organization_id];
    let employeeIds = [];

    if (manager_id) {
      // Resolve manager_id (can be numeric ID or employee_code)
      const managerNumericId = await resolveEmployeeNumericId(
        manager_id,
        organization_id
      );

      // Get all employees reporting to this manager
      const [teamMembers] = await pool.query(
        "SELECT id FROM employees WHERE manager_id = ? AND organization_id = ?",
        [managerNumericId, organization_id]
      );

      if (teamMembers.length === 0) {
        return res.json({ leaves: [] });
      }

      employeeIds = teamMembers.map((e) => e.id);
      where.push("al.employee_id IN (?)");
      params.push(employeeIds);
    } else if (employee_id) {
      // Resolve employee_id (can be numeric ID or employee_code)
      const employeeNumericId = await resolveEmployeeNumericId(
        employee_id,
        organization_id
      );
      where.push("al.employee_id = ?");
      params.push(employeeNumericId);
    }

    if (from) {
      where.push("al.end_date >= ?");
      params.push(from);
    }
    if (to) {
      where.push("al.start_date <= ?");
      params.push(to);
    }
    if (status) {
      where.push("al.status = ?");
      params.push(status);
    }

    const whereSql = `WHERE ${where.join(" AND ")}`;
    const [rows] = await pool.query(
      `SELECT 
        al.*,
        e.employee_code,
        e.name as employee_name,
        e.email as employee_email,
        d.name as department_name
      FROM attendance_leaves al
      LEFT JOIN employees e ON al.employee_id = e.id
      LEFT JOIN departments d ON e.department_id = d.id
      ${whereSql} 
      ORDER BY al.id DESC`,
      params
    );
    res.json({ leaves: rows });
  } catch (err) {
    next(err);
  }
});

router.get("/:id", async (req, res, next) => {
  const organization_id = req.organizationId;

  try {
    const [[leave]] = await pool.query(
      "SELECT * FROM attendance_leaves WHERE id = ? AND organization_id = ?",
      [req.params.id, organization_id]
    );
    if (!leave) throw new ApiError("Leave not found", 404);
    res.json(leave);
  } catch (err) {
    next(err);
  }
});

router.post("/", async (req, res, next) => {
  const {
    employee_id,
    start_date,
    end_date,
    leave_type,
    reason = null,
  } = req.body;
  const organization_id = req.organizationId;

  try {
    if (!employee_id || !start_date || !end_date || !leave_type) {
      throw new ApiError(
        "employee_id, start_date, end_date, and leave_type are required",
        400
      );
    }

    // Resolve employee_id (can be numeric ID or employee_code)
    const employeeNumericId = await resolveEmployeeNumericId(
      employee_id,
      organization_id
    );

    // Validate employee belongs to organization
    const [[employee]] = await pool.query(
      "SELECT id FROM employees WHERE id = ? AND organization_id = ?",
      [employeeNumericId, organization_id]
    );
    if (!employee) {
      throw new ApiError(
        "Employee not found or doesn't belong to organization",
        404
      );
    }

    const [result] = await pool.query(
      "INSERT INTO attendance_leaves (organization_id, employee_id, start_date, end_date, leave_type, reason) VALUES (?, ?, ?, ?, ?, ?)",
      [
        organization_id,
        employeeNumericId,
        start_date,
        end_date,
        leave_type,
        reason,
      ]
    );
    res.status(201).json({ id: result.insertId });
  } catch (err) {
    next(err);
  }
});

router.patch("/:id", async (req, res, next) => {
  const { start_date, end_date, leave_type, reason } = req.body;
  const organization_id = req.organizationId;

  try {
    const [result] = await pool.query(
      "UPDATE attendance_leaves SET start_date = COALESCE(?, start_date), end_date = COALESCE(?, end_date), leave_type = COALESCE(?, leave_type), reason = COALESCE(?, reason) WHERE id = ? AND organization_id = ? AND status = 'pending'",
      [start_date, end_date, leave_type, reason, req.params.id, organization_id]
    );
    if (result.affectedRows === 0)
      throw new ApiError("Leave not found or not editable", 400);
    res.json({ updated: true });
  } catch (err) {
    next(err);
  }
});

router.post("/:id/approve", async (req, res, next) => {
  const { approved_by } = req.body;
  const organization_id = req.organizationId;

  try {
    if (!approved_by) {
      throw new ApiError("approved_by is required", 400);
    }

    // Resolve approved_by (can be numeric ID or employee_code)
    const approverNumericId = await resolveEmployeeNumericId(
      approved_by,
      organization_id
    );

    // Validate approver belongs to organization
    const [[approver]] = await pool.query(
      "SELECT id FROM employees WHERE id = ? AND organization_id = ?",
      [approverNumericId, organization_id]
    );
    if (!approver) {
      throw new ApiError(
        "Approver not found or doesn't belong to organization",
        404
      );
    }

    const [result] = await pool.query(
      "UPDATE attendance_leaves SET status = 'approved', approved_by = ?, approved_at = NOW() WHERE id = ? AND organization_id = ? AND status = 'pending'",
      [approverNumericId, req.params.id, organization_id]
    );
    if (result.affectedRows === 0)
      throw new ApiError("Leave not found or already processed", 400);
    res.json({ approved: true });
  } catch (err) {
    next(err);
  }
});

router.post("/:id/reject", async (req, res, next) => {
  const { approved_by } = req.body;
  const organization_id = req.organizationId;

  try {
    if (!approved_by) {
      throw new ApiError("approved_by is required", 400);
    }

    // Resolve approved_by (can be numeric ID or employee_code)
    const approverNumericId = await resolveEmployeeNumericId(
      approved_by,
      organization_id
    );

    // Validate approver belongs to organization
    const [[approver]] = await pool.query(
      "SELECT id FROM employees WHERE id = ? AND organization_id = ?",
      [approverNumericId, organization_id]
    );
    if (!approver) {
      throw new ApiError(
        "Approver not found or doesn't belong to organization",
        404
      );
    }

    const [result] = await pool.query(
      "UPDATE attendance_leaves SET status = 'rejected', approved_by = ?, approved_at = NOW() WHERE id = ? AND organization_id = ? AND status = 'pending'",
      [approverNumericId, req.params.id, organization_id]
    );
    if (result.affectedRows === 0)
      throw new ApiError("Leave not found or already processed", 400);
    res.json({ rejected: true });
  } catch (err) {
    next(err);
  }
});

router.post("/:id/cancel", async (req, res, next) => {
  const organization_id = req.organizationId;

  try {
    const [result] = await pool.query(
      "UPDATE attendance_leaves SET status = 'cancelled' WHERE id = ? AND organization_id = ? AND status IN ('pending','approved')",
      [req.params.id, organization_id]
    );
    if (result.affectedRows === 0)
      throw new ApiError("Leave not found or cannot be cancelled", 400);
    res.json({ cancelled: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
