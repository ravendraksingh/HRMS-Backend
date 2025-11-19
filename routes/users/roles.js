const express = require("express");
const router = express.Router();
const pool = require("../../db");
const ApiError = require("../../util/ApiError");

// Get all roles
router.get("/", async (req, res, next) => {
  const { is_active } = req.query;
  const organization_id = req.organizationId;
  
  try {
    let whereClauses = [];
    let params = [];

    // Always filter by organization_id from header
    whereClauses.push("organization_id = ?");
    params.push(organization_id);
    if (is_active !== undefined) {
      whereClauses.push("is_active = ?");
      params.push(is_active === "true" ? 1 : 0);
    }

    const whereSql = whereClauses.length ? `WHERE ${whereClauses.join(" AND ")}` : "";

    const query = `SELECT * FROM roles ${whereSql} ORDER BY name`;
    const [roles] = await pool.query(query, params);
    res.json({ roles });
  } catch (error) {
    next(error);
  }
});

// Get role by ID
router.get("/:id", async (req, res, next) => {
  try {
    const [[role]] = await pool.query("SELECT * FROM roles WHERE id = ?", [req.params.id]);
    if (!role) throw new ApiError("Role not found", 404);
    res.json(role);
  } catch (error) {
    next(error);
  }
});

// Create role
router.post("/", async (req, res, next) => {
  const { name, code, description, permissions, is_active = 1 } = req.body;
  const organization_id = req.organizationId;
  
  try {
    if (!name || !code) {
      throw new ApiError("name and code are required", 400);
    }

    const [result] = await pool.query(
      "INSERT INTO roles (organization_id, name, code, description, permissions, is_active) VALUES (?, ?, ?, ?, ?, ?)",
      [organization_id, name, code, description || null, permissions ? JSON.stringify(permissions) : null, is_active]
    );

    const [[newRole]] = await pool.query("SELECT * FROM roles WHERE id = ?", [result.insertId]);
    res.status(201).json(newRole);
  } catch (error) {
    next(error);
  }
});

// Update role
router.patch("/:id", async (req, res, next) => {
  const { name, code, description, permissions, is_active } = req.body;
  try {
    const updates = [];
    const params = [];

    if (name !== undefined) {
      updates.push("name = ?");
      params.push(name);
    }
    if (code !== undefined) {
      updates.push("code = ?");
      params.push(code);
    }
    if (description !== undefined) {
      updates.push("description = ?");
      params.push(description);
    }
    if (permissions !== undefined) {
      updates.push("permissions = ?");
      params.push(JSON.stringify(permissions));
    }
    if (is_active !== undefined) {
      updates.push("is_active = ?");
      params.push(is_active ? 1 : 0);
    }

    if (updates.length === 0) {
      throw new ApiError("No fields to update", 400);
    }

    params.push(req.params.id);
    const [result] = await pool.query(
      `UPDATE roles SET ${updates.join(", ")} WHERE id = ?`,
      params
    );

    if (result.affectedRows === 0) throw new ApiError("Role not found", 404);

    const [[updatedRole]] = await pool.query("SELECT * FROM roles WHERE id = ?", [req.params.id]);
    res.json(updatedRole);
  } catch (error) {
    next(error);
  }
});

// Delete role
router.delete("/:id", async (req, res, next) => {
  try {
    const [result] = await pool.query("DELETE FROM roles WHERE id = ?", [req.params.id]);
    if (result.affectedRows === 0) throw new ApiError("Role not found", 404);
    res.json({ deleted: true });
  } catch (error) {
    next(error);
  }
});

// Get users with a specific role
router.get("/:id/users", async (req, res, next) => {
  try {
    const query = `
      SELECT 
        u.id,
        u.username,
        u.employee_id,
        u.is_active,
        e.name as employee_name,
        e.email as employee_email
      FROM users u
      INNER JOIN user_roles ur ON u.id = ur.user_id
      LEFT JOIN employees e ON u.employee_id = e.id
      WHERE ur.role_id = ?
    `;
    const [users] = await pool.query(query, [req.params.id]);
    res.json({ users });
  } catch (error) {
    next(error);
  }
});

module.exports = router;

