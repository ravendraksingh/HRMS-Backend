/**
 * Location SQL Queries
 * Reusable SQL queries for location operations
 */

const SELECT_LOCATION_BY_ID = `
  SELECT id, name, address_line1, address_line2, city, state, postal_code, country, phone
  FROM office_locations
  WHERE id = ?
`;

const SELECT_LOCATION_EXISTS = `
  SELECT id 
  FROM office_locations 
  WHERE id = ?
`;

const SELECT_LOCATION_BY_NAME = `
  SELECT id 
  FROM office_locations 
  WHERE name = ?
`;

const SELECT_ALL_LOCATIONS = `
  SELECT id, name, address_line1, address_line2, city, state, postal_code, country, phone 
  FROM office_locations 
  ORDER BY name ASC
`;

const SELECT_LOCATION_NAME_CONFLICT = `
  SELECT id 
  FROM office_locations 
  WHERE name = ? AND id != ?
`;

module.exports = {
  SELECT_LOCATION_BY_ID,
  SELECT_LOCATION_EXISTS,
  SELECT_LOCATION_BY_NAME,
  SELECT_ALL_LOCATIONS,
  SELECT_LOCATION_NAME_CONFLICT,
};

