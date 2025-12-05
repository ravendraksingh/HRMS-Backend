/**
 * Central export for all SQL queries
 * Import specific queries from their modules or use this for convenience
 */

const employeeQueries = require('./employees');
const departmentQueries = require('./departments');
const locationQueries = require('./locations');

module.exports = {
  // Employee queries
  ...employeeQueries,
  
  // Department queries
  ...departmentQueries,
  
  // Location queries
  ...locationQueries,
};

