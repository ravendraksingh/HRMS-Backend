const express = require("express");
const router = express.Router();
const pool = require("../../db");
const ApiError = require("../../errors/ApiError");
const bcrypt = require("bcrypt");
const { SELECT_EMPLOYEE_EXISTS } = require("../../queries/employees");
const {
  usernameParamValidator,
} = require("../../validations/commonValidators");
const {
  createUserSchema,
  updateUserSchema,
  deleteUserSchema,
  changePasswordSchema,
} = require("../../validations/userSchemas");
const { handleValidationErrors } = require("../../util/validation");
const {
  withCache,
  invalidateUserCache,
  CACHE_PREFIXES,
} = require("../../util/cacheUtil");

// Get all users (with optional filters)
router.get("/", async (req, res, next) => {
  const { is_active } = req.query;

  try {
    let whereClauses = [];
    let params = [];

    if (is_active !== undefined) {
      whereClauses.push("u.is_active = ?");
      params.push(is_active === "true" ? "Y" : "N");
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

// Get user profile by username (must be before /:username route)
router.get(
  "/:username/profile",
  usernameParamValidator("username"),
  handleValidationErrors,
  async (req, res, next) => {
    try {
      const { username } = req.params;
      const cacheKey = `${CACHE_PREFIXES.USER}:profile:${username}`;

      const userProfile = await withCache(
        async () => {
          // Get user details with employee information
          const userQuery = `
            SELECT 
              u.empid,
              u.username,
              u.is_active,
              u.last_login,
              u.created_at,
              u.updated_at,
              e.name as employee_name,
              e.email as employee_email,
              e.doj,
              e.manager_id,
              e.hr_manager_id,
              e.department_id,
              e.location_id,
              m.name as manager_name,
              m.email as manager_email,
              hr.name as hr_manager_name,
              hr.email as hr_manager_email,
              d.name as department_name,
              d.short_name as department_short_name,
              loc.name as location_name
            FROM users u
            LEFT JOIN employees e ON u.empid = e.empid
            LEFT JOIN employees m ON e.manager_id = m.empid
            LEFT JOIN employees hr ON e.hr_manager_id = hr.empid
            LEFT JOIN departments d ON e.department_id = d.deptid
            LEFT JOIN office_locations loc ON e.location_id = loc.id
            WHERE u.username = ?
          `;

          const [[user]] = await pool.query(userQuery, [username]);
          if (!user) throw new ApiError("User not found", 404);

          // Fetch roles with details for the user
          const rolesQuery = `
            SELECT 
              r.roleid,
              r.name as role_name,
              r.description as role_description,
              r.is_active as role_is_active
            FROM user_roles ur
            JOIN roles r ON ur.roleid = r.roleid
            WHERE ur.empid = ?
            ORDER BY r.name
          `;
          const [roles] = await pool.query(rolesQuery, [user.empid]);

          // Format roles as array of objects with details
          const rolesArray = roles.map((r) => ({
            roleid: r.roleid,
            name: r.role_name,
            description: r.role_description || null,
            is_active: r.role_is_active,
          }));

          // Build profile response
          return {
            user: {
              empid: user.empid,
              username: user.username,
              is_active: user.is_active,
              last_login: user.last_login,
              created_at: user.created_at,
              updated_at: user.updated_at,
            },
            employee: user.employee_name
              ? {
                  name: user.employee_name,
                  email: user.employee_email,
                  date_of_joining: user.doj,
                  manager: user.manager_id
                    ? {
                        empid: user.manager_id,
                        name: user.manager_name,
                        email: user.manager_email,
                      }
                    : null,
                  hr_manager: user.hr_manager_id
                    ? {
                        empid: user.hr_manager_id,
                        name: user.hr_manager_name,
                        email: user.hr_manager_email,
                      }
                    : null,
                  department: user.department_id
                    ? {
                        deptid: user.department_id,
                        name: user.department_name,
                        short_name: user.department_short_name,
                      }
                    : null,
                  location: user.location_id
                    ? {
                        id: user.location_id,
                        name: user.location_name,
                      }
                    : null,
                }
              : null,
            roles: rolesArray,
          };
        },
        cacheKey,
        1800 // 30 minutes TTL
      );

      res.json(userProfile);
    } catch (error) {
      next(error);
    }
  }
);

// Get user by username
router.get(
  "/:username",
  usernameParamValidator("username"),
  handleValidationErrors,
  async (req, res, next) => {
    try {
      const { username } = req.params;
      const cacheKey = `${CACHE_PREFIXES.USER}:${username}`;

      const userWithRoles = await withCache(
        async () => {
          // Get user details
          const userQuery = `
            SELECT 
              u.empid,
              u.username,
              u.is_active,
              e.name as employee_name,
              e.email as employee_email
            FROM users u
            LEFT JOIN employees e ON u.empid = e.empid
            WHERE u.username = ?
          `;

          const [[user]] = await pool.query(userQuery, [username]);
          if (!user) throw new ApiError("User not found", 404);

          // Fetch roles for the user
          const rolesQuery = `SELECT roleid FROM user_roles WHERE empid = ?`;
          const [roles] = await pool.query(rolesQuery, [user.empid]);

          const rolesArray = roles.map((r) => r.roleid);

          // Format roles as array of objects
          return {
            ...user,
            roles: rolesArray,
          };
        },
        cacheKey,
        1800 // 30 minutes TTL (user data changes less frequently)
      );

      res.json(userWithRoles);
    } catch (error) {
      next(error);
    }
  }
);

// Create user
router.post(
  "/",
  createUserSchema,
  handleValidationErrors,
  async (req, res, next) => {
    const {
      empid,
      username,
      password,
      is_active = "N",
      roleids = [],
    } = req.body;

    try {
      // Check if employee exists
      const [[employee]] = await pool.query(SELECT_EMPLOYEE_EXISTS, [empid]);
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

      // Invalidate user cache
      await invalidateUserCache(newUser.username, empid);

      res.status(201).json(userWithRoles);
    } catch (error) {
      next(error);
    }
  }
);

// Update user
router.patch(
  "/:username",
  updateUserSchema,
  handleValidationErrors,
  async (req, res, next) => {
    const { username: newUsername, password, is_active, roleids } = req.body;
    const username = req.params.username;

    try {
      // Check if user exists and get empid
      const [[existingUser]] = await pool.query(
        "SELECT empid, username FROM users WHERE username = ?",
        [username]
      );
      if (!existingUser) {
        throw new ApiError("User not found", 404);
      }

      const empid = existingUser.empid;
      const oldUsername = existingUser.username;

      const updates = [];
      const params = [];

      if (newUsername !== undefined) {
        // Check if new username conflicts with existing user
        const [[usernameCheck]] = await pool.query(
          "SELECT empid FROM users WHERE username = ? AND empid != ?",
          [newUsername, empid]
        );
        if (usernameCheck) {
          throw new ApiError("Username already exists", 409);
        }
        updates.push("username = ?");
        params.push(newUsername);
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

      // Invalidate user cache (invalidate by both old and new username if changed)
      await invalidateUserCache(oldUsername, empid);
      if (newUsername !== undefined && newUsername !== oldUsername) {
        await invalidateUserCache(newUsername, empid);
      }

      res.json(userWithRoles);
    } catch (error) {
      next(error);
    }
  }
);

// Delete user
router.delete(
  "/:username",
  deleteUserSchema,
  handleValidationErrors,
  async (req, res, next) => {
    try {
      const username = req.params.username;

      // Get user info before deleting for cache invalidation
      const [[user]] = await pool.query(
        "SELECT empid FROM users WHERE username = ?",
        [username]
      );

      if (!user) {
        throw new ApiError("User not found", 404);
      }

      const empid = user.empid;

      const [result] = await pool.query("DELETE FROM users WHERE empid = ?", [
        empid,
      ]);
      if (result.affectedRows === 0) throw new ApiError("User not found", 404);

      // Invalidate user cache
      await invalidateUserCache(username, empid);

      res.json({ deleted: true });
    } catch (error) {
      next(error);
    }
  }
);

// Assign role to user
router.post("/:username/roles", async (req, res, next) => {
  const { roleid, assignedBy } = req.body;
  const username = req.params.username;

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

    // Validate user exists and get empid
    const [[user]] = await pool.query(
      "SELECT empid FROM users WHERE username = ?",
      [username]
    );
    if (!user) {
      throw new ApiError("User not found", 404);
    }

    const empid = user.empid;

    await pool.query(
      "INSERT INTO user_roles (empid, roleid, assigned_by) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE empid = empid",
      [empid, roleid, assignedBy]
    );

    // Invalidate user cache
    await invalidateUserCache(username, empid);

    res.json({ assigned: true });
  } catch (error) {
    next(error);
  }
});

// Remove role from user
router.delete("/:username/roles/:roleid", async (req, res, next) => {
  try {
    const username = req.params.username;
    const roleid = req.params.roleid;

    // Get empid from username
    const [[user]] = await pool.query(
      "SELECT empid FROM users WHERE username = ?",
      [username]
    );
    if (!user) {
      throw new ApiError("User not found", 404);
    }

    const empid = user.empid;

    const [result] = await pool.query(
      "DELETE FROM user_roles WHERE empid = ? AND roleid = ?",
      [empid, roleid]
    );
    if (result.affectedRows === 0)
      throw new ApiError("User role not found", 404);

    // Invalidate user cache
    await invalidateUserCache(username, empid);

    res.json({ removed: true });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
