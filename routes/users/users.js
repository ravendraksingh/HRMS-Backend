const express = require("express");
const router = express.Router();
const pool = require("../../db");
const ApiError = require("../../util/ApiError");
const bcrypt = require("bcrypt");

// Get all users (with optional filters)
router.get("/", async (req, res, next) => {
  const { is_active, employee_id } = req.query;
  const organization_id = req.organizationId;

  try {
    let whereClauses = [];
    let params = [];

    // Always filter by organization_id from header
    whereClauses.push("u.organization_id = ?");
    params.push(organization_id);
    if (is_active !== undefined) {
      whereClauses.push("u.is_active = ?");
      params.push(is_active === "true" ? 1 : 0);
    }
    if (employee_id) {
      whereClauses.push("u.employee_id = ?");
      params.push(employee_id);
    }

    const whereSql = whereClauses.length
      ? `WHERE ${whereClauses.join(" AND ")}`
      : "";

    // First, get all users
    const userQuery = `
      SELECT 
        u.id,
        u.organization_id,
        u.username,
        u.employee_id,
        u.is_active,
        u.last_login,
        u.created_at,
        e.name as employee_name,
        e.email as employee_email
      FROM users u
      LEFT JOIN employees e ON u.employee_id = e.id
      ${whereSql}
      ORDER BY u.created_at DESC
    `;

    const [users] = await pool.query(userQuery, params);

    // Then, fetch roles for each user
    if (users.length > 0) {
      const userIds = users.map((u) => u.id);
      const rolesQuery = `
        SELECT 
          ur.user_id,
          r.name as role_name,
          r.code as role_code
        FROM user_roles ur
        JOIN roles r ON ur.role_id = r.id
        WHERE ur.user_id IN (${userIds.map(() => "?").join(",")})
        ORDER BY ur.user_id, r.name
      `;

      const [rolesData] = await pool.query(rolesQuery, userIds);

      // Group roles by user_id
      const rolesByUserId = {};
      rolesData.forEach((role) => {
        if (!rolesByUserId[role.user_id]) {
          rolesByUserId[role.user_id] = [];
        }
        rolesByUserId[role.user_id].push({
          role_name: role.role_name,
          role_code: role.role_code,
        });
      });

      // Attach roles to each user
      const usersWithRoles = users.map((user) => ({
        ...user,
        roles: rolesByUserId[user.id] || [],
      }));

      res.json({ users: usersWithRoles });
    } else {
      res.json({ users: [] });
    }
  } catch (error) {
    next(error);
  }
});

// Get user profile (complete profile with all related data)
router.get("/profile", async (req, res, next) => {
  const organization_id = req.organizationId;
  const userId = req.user?.user_id || req.user?.userId; // Support both snake_case and camelCase from JWT

  try {
    if (!userId) {
      throw new ApiError("User ID not found in token", 401);
    }

    // Fetch user with all related data in a single comprehensive query
    const query = `
      SELECT 
        u.id as user_id,
        u.username as user_name,
        u.organization_id as org_id,
        u.employee_id,
        u.is_active,
        u.last_login,
        u.created_at as user_created_at,
        u.updated_at as user_updated_at,
        e.employee_code,
        e.name as employee_name,
        e.email as employee_email,
        e.manager_id,
        e.department_id,
        e.location_id,
        e.created_at as employee_created_at,
        e.updated_at as employee_updated_at,
        o.code as organization_code,
        o.name as organization_name,
        o.is_active as organization_is_active,
        d.name as department_name,
        loc.name as location_name,
        loc.address_line1 as location_address_line1,
        loc.address_line2 as location_address_line2,
        loc.city as location_city,
        loc.state as location_state,
        loc.postal_code as location_postal_code,
        loc.country as location_country,
        loc.phone as location_phone,
        m.id as manager_employee_id,
        m.employee_code as manager_employee_code,
        m.name as manager_name,
        m.email as manager_email
      FROM users u
      INNER JOIN employees e ON u.employee_id = e.id
      INNER JOIN organizations o ON u.organization_id = o.id
      LEFT JOIN departments d ON e.department_id = d.id
      LEFT JOIN office_locations loc ON e.location_id = loc.id
      LEFT JOIN employees m ON e.manager_id = m.id
      WHERE u.id = ? AND u.organization_id = ?
    `;

    const [[profileData]] = await pool.query(query, [userId, organization_id]);

    if (!profileData) {
      throw new ApiError("User profile not found", 404);
    }

    // Fetch user roles
    const [roles] = await pool.query(
      `SELECT r.id, r.name, r.code, r.description, r.permissions, r.is_active
       FROM user_roles ur 
       JOIN roles r ON ur.role_id = r.id 
       WHERE ur.user_id = ? AND r.organization_id = ?`,
      [userId, organization_id]
    );

    // Build comprehensive profile response in snake_case
    const profile = {
      user: {
        user_id: profileData.user_id,
        username: profileData.user_name,
        employee_id: profileData.employee_id,
        employee_code: profileData.employee_code,
        employee_name: profileData.employee_name,
        employee_email: profileData.employee_email,
        organization_id: profileData.org_id,
        organization_code: profileData.organization_code,
        organization_name: profileData.organization_name,
        is_active: profileData.is_active === 1,
        roles: roles.map((r) => ({
          role_name: r.name,
          role_code: r.code,
          description: r.description,
        })),
        last_login: profileData.last_login,
      },
    };

    res.json(profile);
  } catch (error) {
    next(error);
  }
});

// Get user by ID
router.get("/:id", async (req, res, next) => {
  try {
    // First, get user details
    const userQuery = `
      SELECT 
        u.id,
        u.organization_id,
        u.username,
        u.employee_id,
        u.is_active,
        u.last_login,
        u.created_at,
        u.updated_at,
        e.name as employee_name,
        e.email as employee_email
      FROM users u
      LEFT JOIN employees e ON u.employee_id = e.id
      WHERE u.id = ?
    `;

    const [[user]] = await pool.query(userQuery, [req.params.id]);
    if (!user) throw new ApiError("User not found", 404);

    // Fetch roles for the user
    const rolesQuery = `
      SELECT 
        r.name as role_name,
        r.code as role_code
      FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = ?
      ORDER BY r.name
    `;

    const [roles] = await pool.query(rolesQuery, [req.params.id]);

    // Format roles as array of objects with role_name and role_code
    const userWithRoles = {
      ...user,
      roles: roles.map((r) => ({
        role_name: r.role_name,
        role_code: r.role_code,
      })),
    };

    res.json(userWithRoles);
  } catch (error) {
    next(error);
  }
});

// Create user
router.post("/", async (req, res, next) => {
  const {
    username,
    password,
    employee_id,
    is_active = 1,
    role_ids = [],
  } = req.body;
  const organization_id = req.organizationId;
  console.debug(
    "username:",
    username,
    "password:",
    password,
    "employee_id:",
    employee_id,
    "organization_id:",
    organization_id,
    "role_ids:",
    role_ids
  );

  try {
    if (!username || !password || !employee_id) {
      throw new ApiError(
        "username, password, and employee_id are required",
        400
      );
    }

    // Check if employee exists and belongs to organization (search by employee_code VARCHAR field)
    const [[employee]] = await pool.query(
      "SELECT id FROM employees WHERE id = ? AND organization_id = ?",
      [employee_id, organization_id]
    );
    if (!employee)
      throw new ApiError(
        "Employee not found or doesn't belong to organization",
        404
      );

    // Get the numeric employee ID for foreign key reference
    const employeeNumericId = employee.id;

    // Check if username already exists in organization (organization_id first for index optimization)
    const [[existingUser]] = await pool.query(
      "SELECT id FROM users WHERE organization_id = ? AND username = ?",
      [organization_id, username]
    );
    if (existingUser)
      throw new ApiError("Username already exists in this organization", 409);

    // Hash password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Insert user (use numeric employee ID for foreign key)
    const [result] = await pool.query(
      "INSERT INTO users (organization_id, username, password, employee_id, is_active) VALUES (?, ?, ?, ?, ?)",
      [organization_id, username, hashedPassword, employeeNumericId, is_active]
    );

    const userId = result.insertId;

    // Assign roles if provided
    if (role_ids.length > 0) {
      const roleValues = role_ids.map((roleId) => [userId, roleId]);
      await pool.query("INSERT INTO user_roles (user_id, role_id) VALUES ?", [
        roleValues,
      ]);
    }

    // Fetch created user
    const [[newUser]] = await pool.query(
      `SELECT u.*, e.name as employee_name, e.email as employee_email
       FROM users u
       LEFT JOIN employees e ON u.employee_id = e.id
       WHERE u.id = ?`,
      [userId]
    );

    // Fetch roles for the user
    const [roles] = await pool.query(
      `SELECT r.name as role_name, r.code as role_code
       FROM user_roles ur
       JOIN roles r ON ur.role_id = r.id
       WHERE ur.user_id = ?
       ORDER BY r.name`,
      [userId]
    );

    // Format response with roles
    const userWithRoles = {
      ...newUser,
      roles: roles.map((r) => ({
        role_name: r.role_name,
        role_code: r.role_code,
      })),
    };

    res.status(201).json(userWithRoles);
  } catch (error) {
    next(error);
  }
});

// Update user
router.patch("/:id", async (req, res, next) => {
  const { username, password, is_active, role_ids } = req.body;
  try {
    const updates = [];
    const params = [];

    if (username !== undefined) {
      updates.push("username = ?");
      params.push(username);
    }
    if (password !== undefined) {
      const saltRounds = 10;
      const hashedPassword = await bcrypt.hash(password, saltRounds);
      updates.push("password = ?");
      params.push(hashedPassword);
    }
    if (is_active !== undefined) {
      updates.push("is_active = ?");
      params.push(is_active ? 1 : 0);
    }

    if (updates.length > 0) {
      params.push(req.params.id);
      await pool.query(
        `UPDATE users SET ${updates.join(", ")} WHERE id = ?`,
        params
      );
    }

    // Update roles if provided
    if (role_ids !== undefined) {
      // Delete existing roles
      await pool.query("DELETE FROM user_roles WHERE user_id = ?", [
        req.params.id,
      ]);
      // Insert new roles
      if (role_ids.length > 0) {
        const roleValues = role_ids.map((roleId) => [req.params.id, roleId]);
        await pool.query("INSERT INTO user_roles (user_id, role_id) VALUES ?", [
          roleValues,
        ]);
      }
    }

    // Fetch updated user
    const [[updatedUser]] = await pool.query(
      `SELECT u.*, e.name as employee_name, e.email as employee_email
       FROM users u
       LEFT JOIN employees e ON u.employee_id = e.id
       WHERE u.id = ?`,
      [req.params.id]
    );

    if (!updatedUser) throw new ApiError("User not found", 404);

    // Fetch roles for the user
    const [roles] = await pool.query(
      `SELECT r.name as role_name, r.code as role_code
       FROM user_roles ur
       JOIN roles r ON ur.role_id = r.id
       WHERE ur.user_id = ?
       ORDER BY r.name`,
      [req.params.id]
    );

    // Format response with roles
    const userWithRoles = {
      ...updatedUser,
      roles: roles.map((r) => ({
        role_name: r.role_name,
        role_code: r.role_code,
      })),
    };

    res.json(userWithRoles);
  } catch (error) {
    next(error);
  }
});

// Delete user
router.delete("/:id", async (req, res, next) => {
  try {
    const [result] = await pool.query("DELETE FROM users WHERE id = ?", [
      req.params.id,
    ]);
    if (result.affectedRows === 0) throw new ApiError("User not found", 404);
    res.json({ deleted: true });
  } catch (error) {
    next(error);
  }
});

// Assign role to user
router.post("/:id/roles", async (req, res, next) => {
  const { role_id } = req.body;
  try {
    if (!role_id) throw new ApiError("role_id is required", 400);

    await pool.query(
      "INSERT INTO user_roles (user_id, role_id) VALUES (?, ?) ON DUPLICATE KEY UPDATE user_id = user_id",
      [req.params.id, role_id]
    );

    res.json({ assigned: true });
  } catch (error) {
    next(error);
  }
});

// Remove role from user
router.delete("/:id/roles/:roleId", async (req, res, next) => {
  try {
    const [result] = await pool.query(
      "DELETE FROM user_roles WHERE user_id = ? AND role_id = ?",
      [req.params.id, req.params.roleId]
    );
    if (result.affectedRows === 0)
      throw new ApiError("User role not found", 404);
    res.json({ removed: true });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
