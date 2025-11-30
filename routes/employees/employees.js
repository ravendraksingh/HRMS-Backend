// routes/employees.js
const express = require("express");
const router = express.Router();
const pool = require("../../db");
const ApiError = require("../../errors/ApiError");

// Get all employees (with optional filters)
router.get("/", async (req, res, next) => {
  const { department_id, manager_id, location_id, name } = req.query;

  try {
    let whereClauses = [];
    let params = [];

    if (department_id) {
      whereClauses.push("e.department_id = ?");
      params.push(department_id);
    }
    if (manager_id) {
      whereClauses.push("e.manager_id = ?");
      params.push(manager_id);
    }
    if (location_id) {
      whereClauses.push("e.location_id = ?");
      params.push(location_id);
    }
    if (name) {
      whereClauses.push("e.name LIKE ?");
      params.push(`%${name}%`);
    }

    const whereSql = whereClauses.length
      ? `WHERE ${whereClauses.join(" AND ")}`
      : "";

    const query = `
      SELECT 
        e.empid,
        e.name,
        e.email,
        e.doj,
        e.manager_id,
        e.hr_manager_id,
        e.department_id,
        e.location_id,
        e.created_at,
        e.updated_at,
        m.name as manager_name,
        m.email as manager_email,
        hr.name as hr_manager_name,
        hr.email as hr_manager_email,
        d.name as department_name,
        d.short_name as department_short_name,
        loc.name as location_name
      FROM employees e
      LEFT JOIN employees m ON e.manager_id = m.empid
      LEFT JOIN employees hr ON e.hr_manager_id = hr.empid
      LEFT JOIN departments d ON e.department_id = d.deptid
      LEFT JOIN office_locations loc ON e.location_id = loc.id
      ${whereSql}
      ORDER BY e.name
    `;
    const [employees] = await pool.query(query, params);
    res.json({ employees });
  } catch (error) {
    next(error);
  }
});

// Create employee
router.post("/", async (req, res, next) => {
  const { empid, name, email, doj, manager_id, hr_manager_id, department_id, location_id } =
    req.body;

  try {
    if (!empid || !name || !email) {
      throw new ApiError("empid, name, and email are required", 400);
    }

    // Check if empid already exists
    const [[existingEmployee]] = await pool.query(
      "SELECT empid FROM employees WHERE empid = ?",
      [empid]
    );
    if (existingEmployee) {
      throw new ApiError("Employee ID already exists", 409);
    }

    // Validate department if provided
    if (department_id) {
      const [[dept]] = await pool.query(
        "SELECT deptid FROM departments WHERE deptid = ?",
        [department_id]
      );
      if (!dept) {
        throw new ApiError("Department not found", 404);
      }
    }

    // Validate location if provided
    if (location_id) {
      const [[loc]] = await pool.query(
        "SELECT id FROM office_locations WHERE id = ?",
        [location_id]
      );
      if (!loc) {
        throw new ApiError("Location not found", 404);
      }
    }

    // Validate manager if provided
    if (manager_id) {
      const [[mgr]] = await pool.query(
        "SELECT empid FROM employees WHERE empid = ?",
        [manager_id]
      );
      if (!mgr) {
        throw new ApiError("Manager not found", 404);
      }
    }

    // Validate HR manager if provided
    if (hr_manager_id) {
      const [[hrMgr]] = await pool.query(
        "SELECT empid FROM employees WHERE empid = ?",
        [hr_manager_id]
      );
      if (!hrMgr) {
        throw new ApiError("HR Manager not found", 404);
      }
    }

    // Insert employee
    await pool.query(
      "INSERT INTO employees (empid, name, email, doj, manager_id, hr_manager_id, department_id, location_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      [
        empid,
        name,
        email,
        doj || null,
        manager_id || null,
        hr_manager_id || null,
        department_id || null,
        location_id || null,
      ]
    );

    // Fetch created employee
    const [[newEmployee]] = await pool.query(
      `SELECT 
        e.empid,
        e.name,
        e.email,
        e.doj,
        e.manager_id,
        e.hr_manager_id,
        e.department_id,
        e.location_id,
        e.created_at,
        e.updated_at,
        m.name as manager_name,
        hr.name as hr_manager_name,
        d.name as department_name,
        loc.name as location_name
      FROM employees e
      LEFT JOIN employees m ON e.manager_id = m.empid
      LEFT JOIN employees hr ON e.hr_manager_id = hr.empid
      LEFT JOIN departments d ON e.department_id = d.deptid
      LEFT JOIN office_locations loc ON e.location_id = loc.id
      WHERE e.empid = ?`,
      [empid]
    );

    res.status(201).json(newEmployee);
  } catch (error) {
    next(error);
  }
});

// Get employee by empid
router.get("/:empid", async (req, res, next) => {
  const empid = req.params.empid;

  try {
    const query = `
      SELECT 
        e.empid,
        e.name,
        e.email,
        e.doj,
        e.manager_id,
        e.hr_manager_id,
        e.department_id,
        e.location_id,
        e.created_at,
        e.updated_at,
        m.name as manager_name,
        m.email as manager_email,
        hr.name as hr_manager_name,
        hr.email as hr_manager_email,
        hr.empid as hr_manager_empid,
        d.name as department_name,
        d.short_name as department_short_name,
        loc.name as location_name
      FROM employees e
      LEFT JOIN employees m ON e.manager_id = m.empid
      LEFT JOIN employees hr ON e.hr_manager_id = hr.empid
      LEFT JOIN departments d ON e.department_id = d.deptid
      LEFT JOIN office_locations loc ON e.location_id = loc.id
      WHERE e.empid = ?
    `;
    const [[employee]] = await pool.query(query, [empid]);
    if (!employee) throw new ApiError("Employee not found", 404);

    res.json(employee);
  } catch (error) {
    next(error);
  }
});

// Update employee
router.patch("/:empid", async (req, res, next) => {
  const empid = req.params.empid;
  const { name, email, doj, manager_id, hr_manager_id, department_id, location_id } =
    req.body;

  try {
    // Check if employee exists
    const [[employee]] = await pool.query(
      "SELECT empid, department_id, hr_manager_id FROM employees WHERE empid = ?",
      [empid]
    );

    if (!employee) throw new ApiError("Employee not found", 404);

    // Prepare fields to update
    const updates = [];
    const params = [];

    if (name !== undefined) {
      updates.push("name = ?");
      params.push(name);
    }
    if (email !== undefined) {
      updates.push("email = ?");
      params.push(email);
    }
    if (doj !== undefined) {
      updates.push("doj = ?");
      params.push(doj);
    }
    if (manager_id !== undefined) {
      if (manager_id === null) {
        updates.push("manager_id = NULL");
      } else {
        // Validate manager exists
        const [[mgr]] = await pool.query(
          "SELECT empid FROM employees WHERE empid = ?",
          [manager_id]
        );
        if (!mgr) {
          throw new ApiError("Manager not found", 404);
        }
        updates.push("manager_id = ?");
        params.push(manager_id);
      }
    }

    // Handle department update
    if (department_id !== undefined) {
      if (department_id === null) {
        updates.push("department_id = NULL");
      } else {
        // Validate department exists
        const [[dept]] = await pool.query(
          "SELECT deptid FROM departments WHERE deptid = ?",
          [department_id]
        );
        if (!dept) {
          throw new ApiError("Department not found", 404);
        }
        updates.push("department_id = ?");
        params.push(department_id);
      }
    }

    // Handle HR manager update
    if (hr_manager_id !== undefined) {
      if (hr_manager_id === null) {
        updates.push("hr_manager_id = NULL");
      } else {
        // Validate HR manager exists
        const [[hrMgr]] = await pool.query(
          "SELECT empid FROM employees WHERE empid = ?",
          [hr_manager_id]
        );
        if (!hrMgr) {
          throw new ApiError("HR Manager not found", 404);
        }
        updates.push("hr_manager_id = ?");
        params.push(hr_manager_id);
      }
    }

    if (location_id !== undefined) {
      if (location_id === null) {
        updates.push("location_id = NULL");
      } else {
        // Validate location
        const [[loc]] = await pool.query(
          "SELECT id FROM office_locations WHERE id = ?",
          [location_id]
        );
        if (!loc) {
          throw new ApiError("Location not found", 404);
        }
        updates.push("location_id = ?");
        params.push(location_id);
      }
    }

    if (updates.length > 0) {
      params.push(empid);
      await pool.query(
        `UPDATE employees SET ${updates.join(", ")} WHERE empid = ?`,
        params
      );
    }

    // Return updated employee
    const [[updatedEmployee]] = await pool.query(
      `SELECT 
        e.empid,
        e.name,
        e.email,
        e.doj,
        e.manager_id,
        e.hr_manager_id,
        e.department_id,
        e.location_id,
        e.created_at,
        e.updated_at,
        m.name as manager_name,
        m.email as manager_email,
        hr.name as hr_manager_name,
        hr.email as hr_manager_email,
        hr.empid as hr_manager_empid,
        d.name as department_name,
        d.short_name as department_short_name,
        loc.name as location_name
      FROM employees e
      LEFT JOIN employees m ON e.manager_id = m.empid
      LEFT JOIN employees hr ON e.hr_manager_id = hr.empid
      LEFT JOIN departments d ON e.department_id = d.deptid
      LEFT JOIN office_locations loc ON e.location_id = loc.id
      WHERE e.empid = ?`,
      [empid]
    );

    res.json(updatedEmployee);
  } catch (error) {
    next(error);
  }
});

// Delete employee
router.delete("/:empid", async (req, res, next) => {
  const empid = req.params.empid;

  try {
    // Check if employee exists
    const [[employee]] = await pool.query(
      "SELECT empid FROM employees WHERE empid = ?",
      [empid]
    );

    if (!employee) {
      throw new ApiError("Employee not found", 404);
    }

    // Delete employee (CASCADE will handle related records)
    const [result] = await pool.query(
      "DELETE FROM employees WHERE empid = ?",
      [empid]
    );

    if (result.affectedRows === 0) {
      throw new ApiError("Employee not found", 404);
    }
    
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

module.exports = router;
