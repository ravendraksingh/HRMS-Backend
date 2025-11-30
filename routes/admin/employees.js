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

module.exports = router;
