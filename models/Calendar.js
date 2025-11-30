/**
 * Calendar Model/Class
 * Represents an attendance calendar with all its properties
 */
class Calendar {
  constructor(data) {
    // Core calendar fields
    this.id = data.id || null;
    this.calendar_name = data.calendar_name || null;
    this.calendar_type = data.calendar_type || null; // ORGANIZATION, LOCATION, DEPARTMENT, EMPLOYEE
    this.location_id = data.location_id || null;
    this.department_id = data.department_id || null;
    this.empid = data.empid || null;
    this.year = data.year || null;
    this.is_active = data.is_active || "Y";
    this.description = data.description || null;

    // Internal fields (excluded from DTO)
    this.created_by = data.created_by || null;
    this.created_at = data.created_at || null;
    this.updated_at = data.updated_at || null;
  }

  /**
   * Convert the calendar object to a plain object (excluding internal fields)
   * @returns {Object} Plain object representation
   */
  toJSON() {
    return {
      id: this.id,
      calendar_name: this.calendar_name,
      calendar_type: this.calendar_type,
      location_id: this.location_id,
      department_id: this.department_id,
      empid: this.empid,
      year: this.year,
      is_active: this.is_active,
      description: this.description,
    };
  }

  /**
   * Create a Calendar instance from database row
   * @param {Object} row - Database row object
   * @returns {Calendar} Calendar instance
   */
  static fromDatabaseRow(row) {
    return new Calendar({
      id: row.id,
      calendar_name: row.calendar_name,
      calendar_type: row.calendar_type,
      location_id: row.location_id,
      department_id: row.department_id,
      empid: row.empid,
      year: row.year,
      is_active: row.is_active,
      description: row.description,
      created_by: row.created_by,
      created_at: row.created_at,
      updated_at: row.updated_at,
    });
  }

  /**
   * Create multiple Calendar instances from database rows
   * @param {Array} rows - Array of database row objects
   * @returns {Array<Calendar>} Array of Calendar instances
   */
  static fromDatabaseRows(rows) {
    return rows.map((row) => Calendar.fromDatabaseRow(row));
  }
}

module.exports = Calendar;

