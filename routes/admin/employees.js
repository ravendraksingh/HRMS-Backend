// routes/employees.js
const express = require("express");
const router = express.Router();
const pool = require("../../db");

router.get("/all-employees", async (req, res, next) => {
  try {
    const [items] = await pool.query("SELECT * FROM employees");
    res.json({
      employees: items,
    });
  } catch (error) {
    logger.error("Error fetching departments", {
      error: error.message,
      stack: error.stack,
    });
    next(error);
  }
});

router.get("/employees", async (req, res) => {
  const { department, manager_id, name, page = 1, limit = 10 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit); // Calculate offset

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
    // Optionally filter by username (role-based view via user table etc.)
    // if (username) { ... }

    // Combine WHERE clauses
    const whereSql = whereClauses.length
      ? `WHERE ${whereClauses.join(" AND ")}`
      : "";

    // --- Total count for pagination ---
    const countQuery = `SELECT COUNT(*) AS total FROM employees ${whereSql}`;
    const [totalRows] = await pool.query(countQuery, params);
    const totalItems = totalRows[0]?.total || 0;
    const totalPages = Math.ceil(totalItems / limit);
    // --- Fetch paginated data ---
    const dataQuery = `SELECT * FROM employees ${whereSql} LIMIT ? OFFSET ?`;
    const itemsParams = [...params, parseInt(limit), offset];
    logger.debug("Admin employees query", { query: dataQuery, params: itemsParams });

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
    logger.error("Error fetching admin employees", {
      error: error.message,
      stack: error.stack,
    });
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
