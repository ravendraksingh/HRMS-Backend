/**
 * Shift Model/Class
 * Represents an attendance shift with all its properties
 */
class Shift {
  constructor(data) {
    // Core shift fields
    this.shiftid = data.shiftid || null;
    this.name = data.name || null;
    this.start_time = data.start_time || null;
    this.end_time = data.end_time || null;
    this.break_duration_minutes = data.break_duration_minutes || 0;
    this.total_hours = data.total_hours || null;
    this.is_active = data.is_active || "Y";
  }

  /**
   * Convert the shift object to a plain object
   * @returns {Object} Plain object representation
   */
  toJSON() {
    return {
      shiftid: this.shiftid,
      name: this.name,
      start_time: this.start_time,
      end_time: this.end_time,
      break_duration_minutes: this.break_duration_minutes,
      total_hours: this.total_hours,
      is_active: this.is_active,
    };
  }

  /**
   * Create a Shift instance from database row
   * @param {Object} row - Database row object
   * @returns {Shift} Shift instance
   */
  static fromDatabaseRow(row) {
    return new Shift({
      shiftid: row.shiftid,
      name: row.name,
      start_time: row.start_time,
      end_time: row.end_time,
      break_duration_minutes: row.break_duration_minutes,
      total_hours: row.total_hours,
      is_active: row.is_active,
    });
  }

  /**
   * Create multiple Shift instances from database rows
   * @param {Array} rows - Array of database row objects
   * @returns {Array<Shift>} Array of Shift instances
   */
  static fromDatabaseRows(rows) {
    return rows.map((row) => Shift.fromDatabaseRow(row));
  }
}

module.exports = Shift;

