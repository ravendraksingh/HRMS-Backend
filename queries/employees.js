/**
 * Employee SQL Queries
 * Reusable SQL queries for employee operations
 */

// Basic employee queries
const SELECT_EMPLOYEE_BY_EMPID = `
  SELECT empid, name, email, doj, manager_id, hr_manager_id, department_id, location_id 
  FROM employees 
  WHERE empid = ?
`;

const SELECT_EMPLOYEE_EXISTS = `
  SELECT empid 
  FROM employees 
  WHERE empid = ?
`;

const SELECT_EMPLOYEE_WITH_DETAILS = `
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

const SELECT_EMPLOYEE_NAME = `
  SELECT empid, name 
  FROM employees 
  WHERE empid = ?
`;

const SELECT_EMPLOYEE_BY_MANAGER = `
  SELECT empid 
  FROM employees 
  WHERE empid = ? AND manager_id = ?
`;

const SELECT_EMPLOYEE_BASIC_INFO = `
  SELECT empid, department_id, hr_manager_id 
  FROM employees 
  WHERE empid = ?
`;

module.exports = {
  SELECT_EMPLOYEE_BY_EMPID,
  SELECT_EMPLOYEE_EXISTS,
  SELECT_EMPLOYEE_WITH_DETAILS,
  SELECT_EMPLOYEE_NAME,
  SELECT_EMPLOYEE_BY_MANAGER,
  SELECT_EMPLOYEE_BASIC_INFO,
};

