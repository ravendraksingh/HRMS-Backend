/**
 * WeeklyOff Model/Class
 * Represents a weekly off configuration with all its properties
 */
class WeeklyOff {
  constructor(data) {
    // Core weekly off fields
    this.id = data.id || null;
    this.empid = data.empid || null;
    this.year = data.year || null;
    this.month = data.month || null;
    this.days_of_week = data.days_of_week || null; // Array of day numbers [0, 6] for Sunday, Saturday
    this.is_active = data.is_active || "Y";

    // Internal fields (excluded from DTO)
    this.created_at = data.created_at || null;
    this.updated_at = data.updated_at || null;
  }

  /**
   * Convert the weekly off object to a plain object (excluding internal fields)
   * @returns {Object} Plain object representation
   */
  toJSON() {
    return {
      id: this.id,
      empid: this.empid,
      year: this.year,
      month: this.month,
      days_of_week: this.days_of_week,
      is_active: this.is_active,
    };
  }

  /**
   * Create a WeeklyOff instance from database row
   * @param {Object} row - Database row object
   * @returns {WeeklyOff} WeeklyOff instance
   */
  static fromDatabaseRow(row) {
    // Parse days_of_week if it's a JSON string
    let daysOfWeek = row.days_of_week;
    if (typeof daysOfWeek === "string") {
      try {
        daysOfWeek = JSON.parse(daysOfWeek);
      } catch (e) {
        daysOfWeek = null;
      }
    }

    return new WeeklyOff({
      id: row.id,
      empid: row.empid,
      year: row.year,
      month: row.month,
      days_of_week: daysOfWeek,
      is_active: row.is_active,
      created_at: row.created_at,
      updated_at: row.updated_at,
    });
  }

  /**
   * Create multiple WeeklyOff instances from database rows
   * @param {Array} rows - Array of database row objects
   * @returns {Array<WeeklyOff>} Array of WeeklyOff instances
   */
  static fromDatabaseRows(rows) {
    return rows.map((row) => WeeklyOff.fromDatabaseRow(row));
  }
}

module.exports = WeeklyOff;

