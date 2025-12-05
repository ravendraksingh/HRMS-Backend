// routes/employees.js
const express = require("express");
const router = express.Router();
const pool = require("../../db");
const ApiError = require("../../errors/ApiError");
const {
  createEmployeeSchema,
  empidParamSchema,
} = require("../../validations/employeeSchemas");
const { handleValidationErrors } = require("../../util/validation");
const {
  SELECT_EMPLOYEE_BY_EMPID,
  SELECT_EMPLOYEE_EXISTS,
  SELECT_EMPLOYEE_WITH_DETAILS,
  SELECT_EMPLOYEE_BASIC_INFO,
} = require("../../queries/employees");
const { SELECT_DEPARTMENT_EXISTS } = require("../../queries/departments");
const { SELECT_LOCATION_EXISTS } = require("../../queries/locations");
const { authorizeEmployee } = require("../../middlewares/rbac");

// Create employee
router.post(
  "/",
  createEmployeeSchema,
  handleValidationErrors,
  async (req, res, next) => {
    const {
      empid,
      name,
      email,
      doj,
      manager_id,
      hr_manager_id,
      department_id,
      location_id,
    } = req.body;

    try {
      // Check if empid already exists
      const [[existingEmployee]] = await pool.query(SELECT_EMPLOYEE_EXISTS, [
        empid,
      ]);
      if (existingEmployee) {
        throw new ApiError("Employee ID already exists", 409);
      }

      // Validate department if provided
      if (department_id) {
        const [[dept]] = await pool.query(SELECT_DEPARTMENT_EXISTS, [
          department_id,
        ]);
        if (!dept) {
          throw new ApiError("Department not found", 404);
        }
      }

      // Validate location if provided
      if (location_id) {
        const [[loc]] = await pool.query(SELECT_LOCATION_EXISTS, [location_id]);
        if (!loc) {
          throw new ApiError("Location not found", 404);
        }
      }

      // Validate manager if provided
      if (manager_id) {
        const [[mgr]] = await pool.query(SELECT_EMPLOYEE_EXISTS, [manager_id]);
        if (!mgr) {
          throw new ApiError("Manager not found", 404);
        }
      }

      // Validate HR manager if provided
      if (hr_manager_id) {
        const [[hrMgr]] = await pool.query(SELECT_EMPLOYEE_EXISTS, [
          hr_manager_id,
        ]);
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
      const [[newEmployee]] = await pool.query(SELECT_EMPLOYEE_BY_EMPID, [
        empid,
      ]);
      res.status(201).json(newEmployee);
    } catch (error) {
      next(error);
    }
  }
);

// Get employee by empid
router.get(
  "/:empid",
  empidParamSchema,
  handleValidationErrors,
  authorizeEmployee,
  async (req, res, next) => {
    const empid = req.params.empid;

    try {
      const [[employee]] = await pool.query(SELECT_EMPLOYEE_BY_EMPID, [empid]);
      if (!employee) throw new ApiError("Employee not found", 404);

      res.json(employee);
    } catch (error) {
      next(error);
    }
  }
);

// Update employee
router.patch(
  "/:empid",
  empidParamSchema,
  handleValidationErrors,
  authorizeEmployee,
  async (req, res, next) => {
    const empid = req.params.empid;
    const {
      name,
      email,
      doj,
      manager_id,
      hr_manager_id,
      department_id,
      location_id,
    } = req.body;

    try {
      // Check if employee exists
      const [[employee]] = await pool.query(SELECT_EMPLOYEE_BASIC_INFO, [
        empid,
      ]);

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
          const [[mgr]] = await pool.query(SELECT_EMPLOYEE_EXISTS, [
            manager_id,
          ]);
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
          const [[dept]] = await pool.query(SELECT_DEPARTMENT_EXISTS, [
            department_id,
          ]);
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
          const [[hrMgr]] = await pool.query(SELECT_EMPLOYEE_EXISTS, [
            hr_manager_id,
          ]);
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
          const [[loc]] = await pool.query(SELECT_LOCATION_EXISTS, [
            location_id,
          ]);
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
        SELECT_EMPLOYEE_WITH_DETAILS,
        [empid]
      );

      res.json(updatedEmployee);
    } catch (error) {
      next(error);
    }
  }
);

// Delete employee
router.delete(
  "/:empid",
  empidParamSchema,
  handleValidationErrors,
  authorizeEmployee,
  async (req, res, next) => {
    const empid = req.params.empid;

    try {
      // Check if employee exists
      const [[employee]] = await pool.query(SELECT_EMPLOYEE_EXISTS, [empid]);

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
  }
);

module.exports = router;
