const express = require("express");
const router = express.Router();
const pool = require("../../db");
const ApiError = require("../../util/ApiError");
const bcrypt = require("bcrypt");

// Get all users (with optional filters)
router.get("/", async (req, res, next) => {
  const { is_active, empid } = req.query;

  try {
    let whereClauses = [];
    let params = [];

    if (is_active !== undefined) {
      whereClauses.push("u.is_active = ?");
      params.push(is_active === "true" ? "Y" : "N");
    }
    if (empid) {
      whereClauses.push("u.empid = ?");
      params.push(empid);
    }

    const whereSql = whereClauses.length
      ? `WHERE ${whereClauses.join(" AND ")}`
      : "";

    // Get all users
    const userQuery = `
      SELECT 
        u.empid,
        u.username,
        u.is_active,
        u.last_login,
        u.created_at,
        u.updated_at,
        e.name as employee_name,
        e.email as employee_email
      FROM users u
      LEFT JOIN employees e ON u.empid = e.empid
      ${whereSql}
      ORDER BY u.created_at DESC
    `;

    const [users] = await pool.query(userQuery, params);

    // Fetch roles for each user
    if (users.length > 0) {
      const empids = users.map((u) => u.empid);
      const rolesQuery = `
        SELECT 
          ur.empid,
          r.roleid,
          r.name as role_name
        FROM user_roles ur
        JOIN roles r ON ur.roleid = r.roleid
        WHERE ur.empid IN (${empids.map(() => "?").join(",")})
        ORDER BY ur.empid, r.name
      `;

      const [rolesData] = await pool.query(rolesQuery, empids);

      // Group roles by empid
      const rolesByEmpid = {};
      rolesData.forEach((role) => {
        if (!rolesByEmpid[role.empid]) {
          rolesByEmpid[role.empid] = [];
        }
        rolesByEmpid[role.empid].push({
          roleid: role.roleid,
          role_name: role.role_name,
        });
      });

      // Attach roles to each user
      const usersWithRoles = users.map((user) => ({
        ...user,
        roles: rolesByEmpid[user.empid] || [],
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
router.get("/:empid/profile", async (req, res, next) => {
  const empid = req.params.empid;
  if (!empid) {
    throw new ApiError("Employee ID is required", 400);
  }
  try {
    // Fetch user with all related data
    const query = `
      SELECT 
        u.empid,
        u.username,
        u.is_active,
        u.last_login,
        e.name as employee_name,
        e.email as employee_email,
        e.doj,
        e.manager_id,
        e.hr_manager_id,
        e.department_id,
        e.location_id,
        d.name as department_name,
        d.short_name as department_short_name,
        loc.name as location_name,
        loc.address_line1 as location_address_line1,
        loc.address_line2 as location_address_line2,
        loc.city as location_city,
        loc.state as location_state,
        loc.postal_code as location_postal_code,
        loc.country as location_country,
        loc.phone as location_phone,
        m.empid as manager_empid,
        m.name as manager_name,
        m.email as manager_email
      FROM users u
      INNER JOIN employees e ON u.empid = e.empid
      LEFT JOIN departments d ON e.department_id = d.deptid
      LEFT JOIN office_locations loc ON e.location_id = loc.id
      LEFT JOIN employees m ON e.manager_id = m.empid
      WHERE u.empid = ?
    `;

    const [[profileData]] = await pool.query(query, [empid]);

    if (!profileData) {
      throw new ApiError("User profile not found", 404);
    }

    // Fetch user roles
    const [roles] = await pool.query(
      `SELECT r.roleid, r.name, r.description, r.permissions, r.is_active
       FROM user_roles ur 
       JOIN roles r ON ur.roleid = r.roleid 
       WHERE ur.empid = ?`,
      [empid]
    );

    // Build comprehensive profile response
    const profile = {
      user: {
        empid: profileData.empid,
        username: profileData.username,
        employee_name: profileData.employee_name,
        employee_email: profileData.employee_email,
        doj: profileData.doj,
        is_active: profileData.is_active,
        roles: roles.map((r) => ({
          roleid: r.roleid,
          role_name: r.name,
          description: r.description,
          permissions: r.permissions,
        })),
        last_login: profileData.last_login,
        department: profileData.department_name
          ? {
              deptid: profileData.department_id,
              name: profileData.department_name,
              short_name: profileData.department_short_name,
            }
          : null,
        location: profileData.location_name
          ? {
              id: profileData.location_id,
              name: profileData.location_name,
              address_line1: profileData.location_address_line1,
              address_line2: profileData.location_address_line2,
              city: profileData.location_city,
              state: profileData.location_state,
              postal_code: profileData.location_postal_code,
              country: profileData.location_country,
              phone: profileData.location_phone,
            }
          : null,
        manager: profileData.manager_name
          ? {
              empid: profileData.manager_empid,
              name: profileData.manager_name,
              email: profileData.manager_email,
            }
          : null,
      },
    };

    res.json(profile);
  } catch (error) {
    next(error);
  }
});

// Get user by empid
router.get("/:empid", async (req, res, next) => {
  try {
    // Get user details
    const userQuery = `
      SELECT 
        u.empid,
        u.username,
        u.is_active,
        u.last_login,
        u.created_at,
        u.updated_at,
        e.name as employee_name,
        e.email as employee_email
      FROM users u
      LEFT JOIN employees e ON u.empid = e.empid
      WHERE u.empid = ?
    `;

    const [[user]] = await pool.query(userQuery, [req.params.empid]);
    if (!user) throw new ApiError("User not found", 404);

    // Fetch roles for the user
    const rolesQuery = `
      SELECT 
        r.roleid,
        r.name as role_name
      FROM user_roles ur
      JOIN roles r ON ur.roleid = r.roleid
      WHERE ur.empid = ?
      ORDER BY r.name
    `;

    const [roles] = await pool.query(rolesQuery, [req.params.empid]);

    // Format roles as array of objects
    const userWithRoles = {
      ...user,
      roles: roles.map((r) => ({
        roleid: r.roleid,
        role_name: r.role_name,
      })),
    };

    res.json(userWithRoles);
  } catch (error) {
    next(error);
  }
});

// Create user
router.post("/", async (req, res, next) => {
  const { empid, username, password, is_active = "N", roleids = [] } = req.body;

  try {
    if (!empid || !username || !password) {
      throw new ApiError("empid, username, and password are required", 400);
    }

    // Check if employee exists
    const [[employee]] = await pool.query(
      "SELECT empid FROM employees WHERE empid = ?",
      [empid]
    );
    if (!employee) {
      throw new ApiError("Employee not found", 404);
    }

    // Check if username already exists
    const [[existingUser]] = await pool.query(
      "SELECT empid FROM users WHERE username = ?",
      [username]
    );
    if (existingUser) {
      throw new ApiError("Username already exists", 409);
    }

    // Check if user already exists for this employee
    const [[existingEmpUser]] = await pool.query(
      "SELECT empid FROM users WHERE empid = ?",
      [empid]
    );
    if (existingEmpUser) {
      throw new ApiError("User already exists for this employee", 409);
    }

    // Hash password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Insert user
    await pool.query(
      "INSERT INTO users (empid, username, password, is_active) VALUES (?, ?, ?, ?)",
      [empid, username, hashedPassword, is_active]
    );

    // Assign default USER role to the user
    await pool.query(
      "INSERT INTO user_roles (empid, roleid) VALUES (?, 'USER')",
      [empid]
    );

    // Fetch created user
    const [[newUser]] = await pool.query(
      `SELECT u.*, e.name as employee_name, e.email as employee_email
       FROM users u
       LEFT JOIN employees e ON u.empid = e.empid
       WHERE u.empid = ?`,
      [empid]
    );

    // Fetch roles for the user
    const [roles] = await pool.query(
      `SELECT r.roleid, r.name as role_name
       FROM user_roles ur
       JOIN roles r ON ur.roleid = r.roleid
       WHERE ur.empid = ?
       ORDER BY r.name`,
      [empid]
    );

    // Format response with roles
    const userWithRoles = {
      ...newUser,
      roles: roles.map((r) => ({
        roleid: r.roleid,
        role_name: r.role_name,
      })),
    };

    res.status(201).json(userWithRoles);
  } catch (error) {
    next(error);
  }
});

// Update user
router.patch("/:empid", async (req, res, next) => {
  const { username, password, is_active, roleids } = req.body;
  const empid = req.params.empid;

  try {
    // Check if user exists
    const [[existingUser]] = await pool.query(
      "SELECT empid FROM users WHERE empid = ?",
      [empid]
    );
    if (!existingUser) {
      throw new ApiError("User not found", 404);
    }

    const updates = [];
    const params = [];

    if (username !== undefined) {
      // Check if new username conflicts with existing user
      const [[usernameCheck]] = await pool.query(
        "SELECT empid FROM users WHERE username = ? AND empid != ?",
        [username, empid]
      );
      if (usernameCheck) {
        throw new ApiError("Username already exists", 409);
      }
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
      params.push(is_active ? "Y" : "N");
    }

    if (updates.length > 0) {
      params.push(empid);
      await pool.query(
        `UPDATE users SET ${updates.join(", ")} WHERE empid = ?`,
        params
      );
    }

    // Update roles if provided
    if (roleids !== undefined) {
      // Delete existing roles
      await pool.query("DELETE FROM user_roles WHERE empid = ?", [empid]);

      // Insert new roles
      if (roleids.length > 0) {
        // Validate all roleids exist
        const placeholders = roleids.map(() => "?").join(",");
        const [validRoles] = await pool.query(
          `SELECT roleid FROM roles WHERE roleid IN (${placeholders})`,
          roleids
        );

        if (validRoles.length !== roleids.length) {
          throw new ApiError("One or more role IDs are invalid", 400);
        }

        const roleValues = roleids.map((roleid) => [empid, roleid]);
        await pool.query("INSERT INTO user_roles (empid, roleid) VALUES ?", [
          roleValues,
        ]);
      }
    }

    // Fetch updated user
    const [[updatedUser]] = await pool.query(
      `SELECT u.*, e.name as employee_name, e.email as employee_email
       FROM users u
       LEFT JOIN employees e ON u.empid = e.empid
       WHERE u.empid = ?`,
      [empid]
    );

    if (!updatedUser) throw new ApiError("User not found", 404);

    // Fetch roles for the user
    const [roles] = await pool.query(
      `SELECT r.roleid, r.name as role_name
       FROM user_roles ur
       JOIN roles r ON ur.roleid = r.roleid
       WHERE ur.empid = ?
       ORDER BY r.name`,
      [empid]
    );

    // Format response with roles
    const userWithRoles = {
      ...updatedUser,
      roles: roles.map((r) => ({
        roleid: r.roleid,
        role_name: r.role_name,
      })),
    };

    res.json(userWithRoles);
  } catch (error) {
    next(error);
  }
});

// Delete user
router.delete("/:empid", async (req, res, next) => {
  try {
    const [result] = await pool.query("DELETE FROM users WHERE empid = ?", [
      req.params.empid,
    ]);
    if (result.affectedRows === 0) throw new ApiError("User not found", 404);
    res.json({ deleted: true });
  } catch (error) {
    next(error);
  }
});

// Assign role to user
router.post("/:empid/roles", async (req, res, next) => {
  const { roleid, assignedBy } = req.body;
  const empid = req.params.empid;

  try {
    if (!roleid) throw new ApiError("roleid is required", 400);

    // Validate role exists
    const [[role]] = await pool.query(
      "SELECT roleid FROM roles WHERE roleid = ?",
      [roleid]
    );
    if (!role) {
      throw new ApiError("Role not found", 404);
    }

    // Validate user exists
    const [[user]] = await pool.query(
      "SELECT empid FROM users WHERE empid = ?",
      [empid]
    );
    if (!user) {
      throw new ApiError("User not found", 404);
    }

    await pool.query(
      "INSERT INTO user_roles (empid, roleid, assigned_by) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE empid = empid",
      [empid, roleid, assignedBy]
    );

    res.json({ assigned: true });
  } catch (error) {
    next(error);
  }
});

// Remove role from user
router.delete("/:empid/roles/:roleid", async (req, res, next) => {
  try {
    const [result] = await pool.query(
      "DELETE FROM user_roles WHERE empid = ? AND roleid = ?",
      [req.params.empid, req.params.roleid]
    );
    if (result.affectedRows === 0)
      throw new ApiError("User role not found", 404);
    res.json({ removed: true });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
