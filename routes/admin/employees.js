const express = require("express");
const router = express.Router();
const pool = require("../../db");
const ApiError = require("../../errors/ApiError");

// Get all employees (simple list)
router.get("/all-employees", async (req, res, next) => {
  try {
    const [items] = await pool.query("SELECT * FROM employees");
    res.json({
      employees: items,
    });
  } catch (error) {
    next(error);
  }
});

// Get employees with pagination and filters
router.get("/employees", async (req, res, next) => {
  const { department, manager_id, name, page = 1, limit = 10 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  try {
    // Build dynamic WHERE conditions and parameters
    let whereClauses = [];
    let params = [];

    if (department) {
      whereClauses.push("department_id = ?");
      params.push(department);
    }
    if (manager_id) {
      whereClauses.push("manager_id = ?");
      params.push(manager_id);
    }
    if (name) {
      // Fuzzy search: match anywhere in the name
      whereClauses.push("name LIKE ?");
      params.push(`%${name}%`);
    }

    // Combine WHERE clauses
    const whereSql = whereClauses.length
      ? `WHERE ${whereClauses.join(" AND ")}`
      : "";

    // Total count for pagination
    const countQuery = `SELECT COUNT(*) AS total FROM employees ${whereSql}`;
    const [totalRows] = await pool.query(countQuery, params);
    const totalItems = totalRows[0]?.total || 0;
    const totalPages = Math.ceil(totalItems / limit);

    // Fetch paginated data
    const dataQuery = `SELECT * FROM employees ${whereSql} LIMIT ? OFFSET ?`;
    const itemsParams = [...params, parseInt(limit), offset];

    const [items] = await pool.query(dataQuery, itemsParams);

    res.json({
      employees: items,
      pagination: {
        currentPage: parseInt(page),
        itemsPerPage: parseInt(limit),
        totalItems,
        totalPages,
        hasNextPage: parseInt(page) < totalPages,
        hasPreviousPage: parseInt(page) > 1,
      },
    });
  } catch (error) {
    next(error);
  }
});

// Get all users (admin view)
router.get("/users", async (req, res, next) => {
  const { is_active, empid, page = 1, limit = 10 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

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

    // Total count for pagination
    const countQuery = `
      SELECT COUNT(*) AS total 
      FROM users u
      ${whereSql}
    `;
    const [totalRows] = await pool.query(countQuery, params);
    const totalItems = totalRows[0]?.total || 0;
    const totalPages = Math.ceil(totalItems / limit);

    // Get all users with employee info
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
      LIMIT ? OFFSET ?
    `;

    const [users] = await pool.query(userQuery, [...params, parseInt(limit), offset]);

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

      res.json({
        users: usersWithRoles,
        pagination: {
          currentPage: parseInt(page),
          itemsPerPage: parseInt(limit),
          totalItems,
          totalPages,
          hasNextPage: parseInt(page) < totalPages,
          hasPreviousPage: parseInt(page) > 1,
        },
      });
    } else {
      res.json({
        users: [],
        pagination: {
          currentPage: parseInt(page),
          itemsPerPage: parseInt(limit),
          totalItems: 0,
          totalPages: 0,
          hasNextPage: false,
          hasPreviousPage: false,
        },
      });
    }
  } catch (error) {
    next(error);
  }
});

/**
 * GET /admin/dashboard
 * Get admin dashboard summary
 * Returns: Summary statistics including users, departments, locations, system health, and hourly login data
 */
router.get("/dashboard", async (req, res, next) => {
  try {
    const timestamp = new Date().toISOString();
    const uptime = process.uptime();

    // Test database connection for system health
    let dbConnected = false;
    let dbInfo = null;
    try {
      const connection = await pool.getConnection();
      await connection.ping();
      const [[dbInfoResult]] = await connection.query(
        "SELECT VERSION() as version, DATABASE() as `database`"
      );
      dbInfo = dbInfoResult;
      dbConnected = true;
      connection.release();
    } catch (dbError) {
      dbConnected = false;
    }

    // Get user statistics
    const [[userStats]] = await pool.query(`
      SELECT 
        COUNT(*) as total_users,
        SUM(CASE WHEN is_active = 'Y' THEN 1 ELSE 0 END) as active_users,
        SUM(CASE WHEN last_login IS NOT NULL AND last_login >= DATE_SUB(NOW(), INTERVAL 24 HOUR) THEN 1 ELSE 0 END) as logged_in_users_24h
      FROM users
    `);

    // Get department count
    const [[deptStats]] = await pool.query(`
      SELECT COUNT(*) as total_departments
      FROM departments
    `);

    // Get location count
    const [[locationStats]] = await pool.query(`
      SELECT COUNT(*) as total_locations
      FROM office_locations
    `);

    // Get hourly logged-in users summary for the last 24 hours
    const [hourlyLogins] = await pool.query(`
      SELECT 
        DATE_FORMAT(last_login, '%Y-%m-%d %H:00:00') as hour,
        COUNT(*) as user_count
      FROM users
      WHERE last_login IS NOT NULL 
        AND last_login >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
      GROUP BY DATE_FORMAT(last_login, '%Y-%m-%d %H:00:00')
      ORDER BY hour DESC
    `);

    // Format hourly data
    const hourlyLoggedInUsers = hourlyLogins.map((row) => ({
      hour: row.hour,
      user_count: row.user_count,
    }));

    // Build system health object
    const systemHealth = {
      status: dbConnected ? "ok" : "error",
      database: {
        connected: dbConnected,
        version: dbInfo?.version || null,
        database: dbInfo?.database || null,
      },
      server: {
        uptime: `${Math.floor(uptime)}s`,
        environment: process.env.NODE_ENV || "development",
        node_version: process.version,
      },
      timestamp: timestamp,
    };

    // Build response
    const dashboard = {
      summary: {
        users: {
          total: parseInt(userStats.total_users) || 0,
          active: parseInt(userStats.active_users) || 0,
          logged_in_24h: parseInt(userStats.logged_in_users_24h) || 0,
        },
        departments: {
          total: parseInt(deptStats.total_departments) || 0,
        },
        locations: {
          total: parseInt(locationStats.total_locations) || 0,
        },
      },
      system_health: systemHealth,
      hourly_logged_in_users: hourlyLoggedInUsers,
      generated_at: timestamp,
    };

    res.json(dashboard);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
