// routes/onboarding/onboarding.js
const express = require("express");
const router = express.Router();
const pool = require("../../db");
const ApiError = require("../../util/ApiError");
const bcrypt = require("bcrypt");
const { 
  resolveEmployeeNumericId, 
  resolveDepartmentNumericId,
  validateHrManagerForDepartment,
  getHrManagersForDepartment,
  autoAssignHrManager
} = require("../../util/employeeUtil");

/**
 * POST /onboarding
 * Complete onboarding process for a new employee:
 * 1. Create employee record
 * 2. Assign department (required)
 * 3. Set as department head if no head exists
 * 4. Assign manager (optional)
 * 5. Optionally create user account
 */
router.post("/", async (req, res, next) => {
  const {
    employee_code,
    name,
    email,
    department, // Can be department_id (numeric) or department_code (string)
    manager, // Can be manager_id (numeric) or employee_code (string), optional
    hr_manager, // Can be hr_manager_id (numeric) or employee_code (string), optional
    location_id, // Optional
    create_user_account = false, // Optional flag to create user account
    username, // Required if create_user_account is true
    password, // Required if create_user_account is true
    role_ids = [], // Optional array of role IDs
  } = req.body;
  const organization_id = req.organizationId;

  try {
    // Validate required fields
    if (!employee_code || !name || !email || !department) {
      throw new ApiError(
        "employee_code, name, email, and department are required",
        400
      );
    }

    // Validate user account creation fields
    if (create_user_account) {
      if (!username || !password) {
        throw new ApiError(
          "username and password are required when create_user_account is true",
          400
        );
      }
    }

    // Check if employee_code already exists in organization
    const [[existingEmployee]] = await pool.query(
      "SELECT id FROM employees WHERE organization_id = ? AND employee_code = ?",
      [organization_id, employee_code]
    );
    if (existingEmployee) {
      throw new ApiError(
        "Employee code already exists in this organization",
        409
      );
    }

    // Resolve department ID (can be numeric ID or department_code)
    const departmentId = await resolveDepartmentNumericId(department, organization_id);

    // Validate department exists
    const [[dept]] = await pool.query(
      "SELECT id, department_head FROM departments WHERE id = ? AND organization_id = ?",
      [departmentId, organization_id]
    );
    if (!dept) {
      throw new ApiError(
        "Department not found or doesn't belong to organization",
        404
      );
    }

    // Resolve manager ID if provided
    let managerId = null;
    if (manager) {
      managerId = await resolveEmployeeNumericId(manager, organization_id);
      
      // Validate manager exists and belongs to organization
      const [[mgr]] = await pool.query(
        "SELECT id FROM employees WHERE id = ? AND organization_id = ?",
        [managerId, organization_id]
      );
      if (!mgr) {
        throw new ApiError(
          "Manager not found or doesn't belong to organization",
          404
        );
      }
    }

    // Resolve HR manager ID if provided
    let hrManagerId = null;
    if (hr_manager) {
      hrManagerId = await resolveEmployeeNumericId(hr_manager, organization_id);
      
      // Validate HR manager exists and belongs to organization
      const [[hrMgr]] = await pool.query(
        "SELECT id FROM employees WHERE id = ? AND organization_id = ?",
        [hrManagerId, organization_id]
      );
      if (!hrMgr) {
        throw new ApiError(
          "HR Manager not found or doesn't belong to organization",
          404
        );
      }
      
      // Validate HR manager belongs to department
      const isValid = await validateHrManagerForDepartment(
        hrManagerId,
        departmentId,
        organization_id
      );
      
      if (!isValid) {
        throw new ApiError(
          "HR Manager must be assigned to the employee's department. Use /departments/:id/hr-managers to assign HR managers to departments.",
          400
        );
      }
    } else {
      // Auto-assign HR manager if department has exactly one
      const autoAssignedId = await autoAssignHrManager(null, departmentId, organization_id);
      if (autoAssignedId) {
        hrManagerId = autoAssignedId;
      }
    }

    // Validate location if provided
    if (location_id) {
      const [[loc]] = await pool.query(
        "SELECT id FROM office_locations WHERE id = ? AND organization_id = ?",
        [location_id, organization_id]
      );
      if (!loc) {
        throw new ApiError(
          "Location not found or doesn't belong to organization",
          404
        );
      }
    }

    // Start transaction for atomic operations
    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      // Step 1: Create employee
      const [employeeResult] = await connection.query(
        "INSERT INTO employees (organization_id, employee_code, name, email, manager_id, hr_manager_id, department_id, location_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        [
          organization_id,
          employee_code,
          name,
          email,
          managerId,
          hrManagerId,
          departmentId,
          location_id || null,
        ]
      );

      const employeeId = employeeResult.insertId;

      // Step 2: Set as department head if no head exists
      if (!dept.department_head) {
        await connection.query(
          "UPDATE departments SET department_head = ? WHERE id = ? AND organization_id = ?",
          [employeeId, departmentId, organization_id]
        );
      }

      // Step 3: Create user account if requested
      let userId = null;
      if (create_user_account) {
        // Check if username already exists in organization
        const [[existingUser]] = await connection.query(
          "SELECT id FROM users WHERE organization_id = ? AND username = ?",
          [organization_id, username]
        );
        if (existingUser) {
          throw new ApiError("Username already exists in this organization", 409);
        }

        // Hash password
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        // Insert user
        const [userResult] = await connection.query(
          "INSERT INTO users (organization_id, username, password, employee_id, is_active) VALUES (?, ?, ?, ?, ?)",
          [organization_id, username, hashedPassword, employeeId, 1]
        );

        userId = userResult.insertId;

        // Assign roles if provided
        if (role_ids.length > 0) {
          // Validate all role IDs belong to organization
          const placeholders = role_ids.map(() => "?").join(",");
          const [roles] = await connection.query(
            `SELECT id FROM roles WHERE id IN (${placeholders}) AND organization_id = ?`,
            [...role_ids, organization_id]
          );
          
          if (roles.length !== role_ids.length) {
            throw new ApiError(
              "One or more roles not found or don't belong to organization",
              404
            );
          }

          const roleValues = role_ids.map((roleId) => [userId, roleId]);
          await connection.query(
            "INSERT INTO user_roles (user_id, role_id) VALUES ?",
            [roleValues]
          );
        }
      }

      // Commit transaction
      await connection.commit();

      // Fetch created employee with related data
      const [[newEmployee]] = await pool.query(
        `SELECT 
          e.*,
          d.name as department_name,
          d.department_code,
          d.department_head,
          loc.name as location_name,
          m.name as manager_name,
          m.employee_code as manager_employee_code,
          hr.name as hr_manager_name,
          hr.employee_code as hr_manager_employee_code
        FROM employees e
        LEFT JOIN departments d ON e.department_id = d.id
        LEFT JOIN office_locations loc ON e.location_id = loc.id
        LEFT JOIN employees m ON e.manager_id = m.id
        LEFT JOIN employees hr ON e.hr_manager_id = hr.id
        WHERE e.id = ? AND e.organization_id = ?`,
        [employeeId, organization_id]
      );

      // Build response
      const response = {
        employee: {
          id: newEmployee.id,
          employee_code: newEmployee.employee_code,
          name: newEmployee.name,
          email: newEmployee.email,
          manager_id: newEmployee.manager_id,
          manager_name: newEmployee.manager_name,
          manager_employee_code: newEmployee.manager_employee_code,
          hr_manager_id: newEmployee.hr_manager_id,
          hr_manager_name: newEmployee.hr_manager_name,
          hr_manager_employee_code: newEmployee.hr_manager_employee_code,
          department_id: newEmployee.department_id,
          department_name: newEmployee.department_name,
          department_code: newEmployee.department_code,
          is_department_head: newEmployee.department_head === newEmployee.id,
          location_id: newEmployee.location_id,
          location_name: newEmployee.location_name,
          created_at: newEmployee.created_at,
          updated_at: newEmployee.updated_at,
        },
      };

      // Add user account info if created
      if (create_user_account && userId) {
        const [[user]] = await pool.query(
          `SELECT 
            u.id,
            u.username,
            u.is_active,
            u.created_at,
            COALESCE(JSON_ARRAYAGG(
              JSON_OBJECT(
                'id', r.id,
                'name', r.name,
                'code', r.code
              )
            ), JSON_ARRAY()) as roles
          FROM users u
          LEFT JOIN user_roles ur ON u.id = ur.user_id
          LEFT JOIN roles r ON ur.role_id = r.id
          WHERE u.id = ?
          GROUP BY u.id, u.username, u.is_active, u.created_at`,
          [userId]
        );

        response.user_account = {
          user_id: user.id,
          username: user.username,
          is_active: user.is_active === 1,
          roles: JSON.parse(user.roles),
          created_at: user.created_at,
        };
      }

      res.status(201).json(response);
    } catch (error) {
      // Rollback transaction on error
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /onboarding/:employee_id
 * Update employee onboarding details (department, manager, location)
 * Can also set/update department head
 */
router.patch("/:employee_id", async (req, res, next) => {
  const { department, manager, hr_manager, location_id, set_as_department_head = false } =
    req.body;
  const organization_id = req.organizationId;
  const employeeIdParam = req.params.employee_id;

  try {
    // Resolve employee ID
    const employeeId = await resolveEmployeeNumericId(
      employeeIdParam,
      organization_id
    );

    // Verify employee exists and belongs to organization
    const [[employee]] = await pool.query(
      "SELECT id, department_id, hr_manager_id FROM employees WHERE id = ? AND organization_id = ?",
      [employeeId, organization_id]
    );
    if (!employee) {
      throw new ApiError("Employee not found", 404);
    }

    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      const updates = [];
      const params = [];


      // Update manager if provided
      if (manager !== undefined) {
        if (manager === null) {
          updates.push("manager_id = NULL");
        } else {
          const managerId = await resolveEmployeeNumericId(
            manager,
            organization_id
          );
          updates.push("manager_id = ?");
          params.push(managerId);
        }
      }

      // Update HR manager if provided
      if (hr_manager !== undefined) {
        if (hr_manager === null) {
          updates.push("hr_manager_id = NULL");
        } else {
          const hrManagerId = await resolveEmployeeNumericId(
            hr_manager,
            organization_id
          );
          // Validate HR manager exists
          const [[hrMgr]] = await connection.query(
            "SELECT id FROM employees WHERE id = ? AND organization_id = ?",
            [hrManagerId, organization_id]
          );
          if (!hrMgr) {
            throw new ApiError(
              "HR Manager not found or doesn't belong to organization",
              404
            );
          }
          
          // Get the department (current or new)
          const currentDeptId = department !== undefined
            ? await resolveDepartmentNumericId(department, organization_id)
            : employee.department_id;
          
          if (!currentDeptId) {
            throw new ApiError(
              "Employee must have a department assigned before assigning HR manager",
              400
            );
          }
          
          // Validate HR manager belongs to department
          const isValid = await validateHrManagerForDepartment(
            hrManagerId,
            currentDeptId,
            organization_id
          );
          
          if (!isValid) {
            throw new ApiError(
              "HR Manager must be assigned to the employee's department. Use /departments/:id/hr-managers to assign HR managers to departments.",
              400
            );
          }
          
          updates.push("hr_manager_id = ?");
          params.push(hrManagerId);
        }
      }
      
      // Handle department change - validate/update HR manager
      if (department !== undefined) {
        const newDeptId = await resolveDepartmentNumericId(department, organization_id);
        
        // If employee has HR manager and it's not being explicitly changed, validate it
        if (hr_manager === undefined && employee.hr_manager_id) {
          const isValid = await validateHrManagerForDepartment(
            employee.hr_manager_id,
            newDeptId,
            organization_id
          );
          
          if (!isValid) {
            // Try to auto-assign if only one HR manager in new department
            const hrManagers = await getHrManagersForDepartment(newDeptId, organization_id);
            if (hrManagers.length === 1) {
              updates.push("hr_manager_id = ?");
              params.push(hrManagers[0].id);
            } else {
              updates.push("hr_manager_id = NULL");
            }
          }
        }
        
        updates.push("department_id = ?");
        params.push(newDeptId);
      }

      // Update location if provided
      if (location_id !== undefined) {
        if (location_id === null) {
          updates.push("location_id = NULL");
        } else {
          // Validate location
          const [[loc]] = await connection.query(
            "SELECT id FROM office_locations WHERE id = ? AND organization_id = ?",
            [location_id, organization_id]
          );
          if (!loc) {
            throw new ApiError(
              "Location not found or doesn't belong to organization",
              404
            );
          }
          updates.push("location_id = ?");
          params.push(location_id);
        }
      }

      // Update employee if there are changes
      if (updates.length > 0) {
        params.push(employeeId);
        await connection.query(
          `UPDATE employees SET ${updates.join(", ")} WHERE id = ? AND organization_id = ?`,
          [...params, organization_id]
        );
      }

      // Set as department head if requested
      if (set_as_department_head) {
        const currentDeptId = department !== undefined
          ? await resolveDepartmentNumericId(department, organization_id)
          : employee.department_id;

        if (!currentDeptId) {
          throw new ApiError(
            "Employee must have a department to be set as department head",
            400
          );
        }

        await connection.query(
          "UPDATE departments SET department_head = ? WHERE id = ? AND organization_id = ?",
          [employeeId, currentDeptId, organization_id]
        );
      }

      await connection.commit();

      // Fetch updated employee
      const [[updatedEmployee]] = await pool.query(
        `SELECT 
          e.*,
          d.name as department_name,
          d.department_code,
          d.department_head,
          loc.name as location_name,
          m.name as manager_name,
          m.employee_code as manager_employee_code,
          hr.name as hr_manager_name,
          hr.employee_code as hr_manager_employee_code
        FROM employees e
        LEFT JOIN departments d ON e.department_id = d.id
        LEFT JOIN office_locations loc ON e.location_id = loc.id
        LEFT JOIN employees m ON e.manager_id = m.id
        LEFT JOIN employees hr ON e.hr_manager_id = hr.id
        WHERE e.id = ? AND e.organization_id = ?`,
        [employeeId, organization_id]
      );

      res.json({
        employee: {
          id: updatedEmployee.id,
          employee_code: updatedEmployee.employee_code,
          name: updatedEmployee.name,
          email: updatedEmployee.email,
          manager_id: updatedEmployee.manager_id,
          manager_name: updatedEmployee.manager_name,
          manager_employee_code: updatedEmployee.manager_employee_code,
          hr_manager_id: updatedEmployee.hr_manager_id,
          hr_manager_name: updatedEmployee.hr_manager_name,
          hr_manager_employee_code: updatedEmployee.hr_manager_employee_code,
          department_id: updatedEmployee.department_id,
          department_name: updatedEmployee.department_name,
          department_code: updatedEmployee.department_code,
          is_department_head:
            updatedEmployee.department_head === updatedEmployee.id,
          location_id: updatedEmployee.location_id,
          location_name: updatedEmployee.location_name,
          created_at: updatedEmployee.created_at,
          updated_at: updatedEmployee.updated_at,
        },
      });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    next(error);
  }
});

module.exports = router;

