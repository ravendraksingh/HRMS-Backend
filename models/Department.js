/**
 * Department Model/Class
 * Represents a department with all its properties
 */
class Department {
  constructor(data) {
    // Core department fields
    this.deptid = data.deptid || null;
    this.name = data.name || null;
    this.short_name = data.short_name || null;
    this.department_head_id = data.department_head_id || null;

    // Internal fields (excluded from DTO)
    this.created_at = data.created_at || null;
    this.updated_at = data.updated_at || null;
  }

  /**
   * Convert the department object to a plain object
   * @returns {Object} Plain object representation
   */
  toJSON() {
    return {
      deptid: this.deptid,
      name: this.name,
      short_name: this.short_name,
      department_head_id: this.department_head_id,
    };
  }

  /**
   * Create a Department instance from database row
   * @param {Object} row - Database row object
   * @returns {Department} Department instance
   */
  static fromDatabaseRow(row) {
    return new Department({
      deptid: row.deptid,
      name: row.name,
      short_name: row.short_name,
      department_head_id: row.department_head_id,
    });
  }

  /**
   * Create multiple Department instances from database rows
   * @param {Array} rows - Array of database row objects
   * @returns {Array<Department>} Array of Department instances
   */
  static fromDatabaseRows(rows) {
    return rows.map((row) => Department.fromDatabaseRow(row));
  }
}

module.exports = Department;

