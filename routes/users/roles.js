const express = require("express");
const router = express.Router();
const pool = require("../../db");
const ApiError = require("../../util/ApiError");

// Helper function to add status field to role object
const addStatusField = (role) => {
  if (!role) return role;
  return {
    ...role,
    status: role.is_active === "Y" ? "Active" : "Inactive",
  };
};

// Helper function to add status field to array of roles
const addStatusToRoles = (roles) => {
  return roles.map(addStatusField);
};

// Get all roles
router.get("/", async (req, res, next) => {
  const { is_active } = req.query;

  try {
    let whereClauses = [];
    let params = [];

    if (is_active !== undefined) {
      whereClauses.push("is_active = ?");
      params.push(is_active === "true" ? "Y" : "N");
    }

    const whereSql = whereClauses.length
      ? `WHERE ${whereClauses.join(" AND ")}`
      : "";

    const query = `SELECT * FROM roles ${whereSql} ORDER BY name`;
    const [roles] = await pool.query(query, params);
    res.json({ roles: addStatusToRoles(roles) });
  } catch (error) {
    next(error);
  }
});

// Get role by ID
router.get("/:roleid", async (req, res, next) => {
  try {
    const [[role]] = await pool.query("SELECT * FROM roles WHERE roleid = ?", [
      req.params.roleid,
    ]);
    if (!role) throw new ApiError("Role not found", 404);
    res.json(addStatusField(role));
  } catch (error) {
    next(error);
  }
});

// Create role
router.post("/", async (req, res, next) => {
  const { roleid, name, description, permissions, is_active = "N" } = req.body;

  try {
    if (!roleid || !name) {
      throw new ApiError("roleid and name are required", 400);
    }

    // Validate is_active is 'Y' or 'N'
    const activeValue =
      is_active === true || is_active === "Y" || is_active === 1 ? "Y" : "N";

    await pool.query(
      "INSERT INTO roles (roleid, name, description, permissions, is_active) VALUES (?, ?, ?, ?, ?)",
      [
        roleid,
        name,
        description || null,
        permissions ? JSON.stringify(permissions) : null,
        activeValue,
      ]
    );

    const [[newRole]] = await pool.query(
      "SELECT * FROM roles WHERE roleid = ?",
      [roleid]
    );
    res.status(201).json(addStatusField(newRole));
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      next(new ApiError("Role with this roleid already exists", 409));
    } else {
      next(error);
    }
  }
});

// Update role
router.patch("/:roleid", async (req, res, next) => {
  const { name, description, permissions, is_active } = req.body;
  try {
    const updates = [];
    const params = [];

    if (name !== undefined) {
      updates.push("name = ?");
      params.push(name);
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
      // Convert boolean/string/number to 'Y' or 'N'
      const activeValue =
        is_active === true || is_active === "Y" || is_active === 1 ? "Y" : "N";
      params.push(activeValue);
    }

    if (updates.length === 0) {
      throw new ApiError("No fields to update", 400);
    }

    params.push(req.params.roleid);
    const [result] = await pool.query(
      `UPDATE roles SET ${updates.join(", ")} WHERE roleid = ?`,
      params
    );

    if (result.affectedRows === 0) throw new ApiError("Role not found", 404);

    const [[updatedRole]] = await pool.query(
      "SELECT * FROM roles WHERE roleid = ?",
      [req.params.roleid]
    );
    res.json(addStatusField(updatedRole));
  } catch (error) {
    next(error);
  }
});

// Delete role
router.delete("/:roleid", async (req, res, next) => {
  try {
    const [result] = await pool.query("DELETE FROM roles WHERE roleid = ?", [
      req.params.roleid,
    ]);
    if (result.affectedRows === 0) throw new ApiError("Role not found", 404);
    res.json({ deleted: true });
  } catch (error) {
    next(error);
  }
});

// Get users with a specific role
router.get("/:roleid/users", async (req, res, next) => {
  try {
    const query = `
      SELECT 
        u.empid,
        u.username,
        u.is_active,
        e.name as employee_name,
        e.email as employee_email
      FROM users u
      INNER JOIN user_roles ur ON u.empid = ur.empid
      LEFT JOIN employees e ON u.empid = e.empid
      WHERE ur.roleid = ?
    `;
    const [users] = await pool.query(query, [req.params.roleid]);
    res.json({ users });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
