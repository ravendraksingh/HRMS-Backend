/**
 * Department SQL Queries
 * Reusable SQL queries for department operations
 */

const SELECT_DEPARTMENT_BY_DEPTID = `
  SELECT deptid, name, short_name, department_head_empid
  FROM departments
  WHERE deptid = ?
`;

const SELECT_DEPARTMENT_EXISTS = `
  SELECT deptid 
  FROM departments 
  WHERE deptid = ?
`;

const SELECT_DEPARTMENT_BY_NAME = `
  SELECT deptid 
  FROM departments 
  WHERE name = ?
`;

const SELECT_ALL_DEPARTMENTS = `
  SELECT 
    deptid,
    name,
    short_name,
    department_head_empid
  FROM departments
  ORDER BY name
`;

const SELECT_DEPARTMENT_NAME_CONFLICT = `
  SELECT deptid 
  FROM departments 
  WHERE name = ? AND deptid != ?
`;

module.exports = {
  SELECT_DEPARTMENT_BY_DEPTID,
  SELECT_DEPARTMENT_EXISTS,
  SELECT_DEPARTMENT_BY_NAME,
  SELECT_ALL_DEPARTMENTS,
  SELECT_DEPARTMENT_NAME_CONFLICT,
};

