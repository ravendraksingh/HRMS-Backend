/**
 * Holiday Model/Class
 * Represents a holiday with all its properties
 * Works with attendance_calendar_holidays table
 */
class Holiday {
  constructor(data) {
    // Core holiday fields
    this.id = data.id || null;
    this.name = data.name || null; // Maps from holiday_name in database
    this.holiday_date = data.holiday_date || null;
    this.is_optional = data.is_optional || "N";
    this.is_override = data.is_override || "N";
    this.description = data.description || null;
    this.calendar_id = data.calendar_id || null;
  }

  /**
   * Convert the holiday object to a plain object
   * @returns {Object} Plain object representation
   */
  toJSON() {
    return {
      id: this.id,
      name: this.name,
      holiday_date: this.holiday_date,
      is_optional: this.is_optional,
      is_override: this.is_override,
      description: this.description,
      calendar_id: this.calendar_id,
    };
  }

  /**
   * Create a Holiday instance from database row
   * @param {Object} row - Database row object (with holiday_name mapped to name)
   * @returns {Holiday} Holiday instance
   */
  static fromDatabaseRow(row) {
    return new Holiday({
      id: row.id,
      name: row.name, // Already mapped from holiday_name in SQL query
      holiday_date: row.holiday_date,
      is_optional: row.is_optional,
      is_override: row.is_override,
      description: row.description,
      calendar_id: row.calendar_id,
    });
  }

  /**
   * Create multiple Holiday instances from database rows
   * @param {Array} rows - Array of database row objects
   * @returns {Array<Holiday>} Array of Holiday instances
   */
  static fromDatabaseRows(rows) {
    return rows.map((row) => Holiday.fromDatabaseRow(row));
  }
}

module.exports = Holiday;

