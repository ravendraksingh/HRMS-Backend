// routes/employees/search.js
// Employee Search API
const express = require("express");
const router = express.Router();
const pool = require("../../db");
const ApiError = require("../../util/ApiError");
const Employee = require("../../models/Employee");

/**
 * GET /employees/search
 * Search employees with various filters and fuzzy search
 *
 * Query Parameters:
 * - search_type: "empid" | "name" | "department" | "location"
 * - search_value: The search term/value
 * - fuzzy: boolean (default: true) - Enable fuzzy search
 * - name_starts_with: string (A-Z) - Filter by first letter of name
 * - page: number (default: 1) - Page number for pagination
 * - limit: number (default: 100) - Results per page
 */
router.get("/search", async (req, res, next) => {
  const {
    search_type,
    search_value,
    fuzzy = "true",
    name_starts_with,
    page = "1",
    limit = "100",
  } = req.query;

  try {
    let whereClauses = [];
    let params = [];
    const isFuzzy = fuzzy === "true" || fuzzy === true;

    // Handle name_starts_with filter (case-insensitive)
    if (name_starts_with) {
      const letter = name_starts_with.toUpperCase().charAt(0);
      if (letter.match(/[A-Z]/)) {
        whereClauses.push("UPPER(SUBSTRING(e.name, 1, 1)) = ?");
        params.push(letter);
      }
    }

    // Handle search_type and search_value
    if (search_type && search_value) {
      switch (search_type.toLowerCase()) {
        case "empid":
          if (isFuzzy) {
            // Fuzzy search: partial match on empid
            whereClauses.push("e.empid LIKE ?");
            params.push(`%${search_value}%`);
          } else {
            // Exact match
            whereClauses.push("e.empid = ?");
            params.push(search_value);
          }
          break;

        case "name":
          if (isFuzzy) {
            // Fuzzy search: partial match on name (case-insensitive)
            whereClauses.push("LOWER(e.name) LIKE ?");
            params.push(`%${search_value.toLowerCase()}%`);
          } else {
            // Exact match (case-insensitive)
            whereClauses.push("LOWER(e.name) = ?");
            params.push(search_value.toLowerCase());
          }
          break;

        case "department":
          // Exact match on department_id
          whereClauses.push("e.department_id = ?");
          params.push(search_value);
          break;

        case "location":
          // Exact match on location_id
          whereClauses.push("e.location_id = ?");
          params.push(parseInt(search_value));
          break;

        default:
          throw new ApiError(
            `Invalid search_type. Must be one of: empid, name, department, location`,
            400
          );
      }
    }

    const whereSql = whereClauses.length
      ? `WHERE ${whereClauses.join(" AND ")}`
      : "";

    // Pagination
    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 100;
    const offset = (pageNum - 1) * limitNum;

    // Get total count for pagination
    const [countResult] = await pool.query(
      `SELECT COUNT(*) as total 
       FROM employees e 
       ${whereSql}`,
      params
    );
    const total = countResult[0]?.total || 0;

    // Get employees with job information for is_active status
    const query = `
      SELECT 
        e.empid,
        e.name,
        e.email,
        DATE_FORMAT(e.doj, '%Y-%m-%d') as doj,
        e.manager_id,
        e.hr_manager_id,
        e.department_id,
        e.location_id,
        ji.employment_status
      FROM employees e
      LEFT JOIN employee_job_information ji ON e.empid = ji.empid
      ${whereSql}
      ORDER BY e.name ASC, e.empid ASC
      LIMIT ? OFFSET ?
    `;

    const [employees] = await pool.query(query, [...params, limitNum, offset]);

    // Convert to Employee class instances
    const employeeInstances = Employee.fromDatabaseRows(employees);

    // Add is_active field to each employee (not part of Employee class)
    const formattedEmployees = employeeInstances.map((emp, index) => {
      const empData = emp.toJSON();
      // Determine is_active from employment_status
      const employmentStatus = employees[index]?.employment_status || "active";
      const is_active =
        employmentStatus === "active" || employmentStatus === "on_leave"
          ? "Y"
          : "N";

      return {
        ...empData,
        is_active: is_active,
      };
    });

    res.json({
      employees: formattedEmployees,
      total: total,
      page: pageNum,
      limit: limitNum,
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
