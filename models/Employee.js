/**
 * Employee Model/Class
 * Represents an employee with all its properties
 */
class Employee {
  constructor(data) {
    // Core employee fields
    this.empid = data.empid || null;
    this.name = data.name || null;
    this.email = data.email || null;
    this.doj = data.doj || null;

    // Relationships
    this.manager_id = data.manager_id || null;
    this.hr_manager_id = data.hr_manager_id || null;
    this.department_id = data.department_id || null;
    this.location_id = data.location_id || null;
  }

  /**
   * Convert the employee object to a plain object
   * @returns {Object} Plain object representation
   */
  toJSON() {
    return {
      empid: this.empid,
      name: this.name,
      email: this.email,
      doj: this.doj,
      manager_id: this.manager_id,
      hr_manager_id: this.hr_manager_id,
      department_id: this.department_id,
      location_id: this.location_id,
    };
  }

  /**
   * Create an Employee instance from database row
   * @param {Object} row - Database row object
   * @returns {Employee} Employee instance
   */
  static fromDatabaseRow(row) {
    return new Employee({
      empid: row.empid,
      name: row.name,
      email: row.email,
      doj: row.doj,
      manager_id: row.manager_id,
      hr_manager_id: row.hr_manager_id,
      department_id: row.department_id,
      location_id: row.location_id,
    });
  }

  /**
   * Create multiple Employee instances from database rows
   * @param {Array} rows - Array of database row objects
   * @returns {Array<Employee>} Array of Employee instances
   */
  static fromDatabaseRows(rows) {
    return rows.map((row) => Employee.fromDatabaseRow(row));
  }
}

module.exports = Employee;

