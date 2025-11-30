/**
 * CalendarWeeklyOff Model/Class
 * Represents a weekly off day in a calendar
 */
class CalendarWeeklyOff {
  constructor(data) {
    // Core weekly off fields
    this.id = data.id || null;
    this.calendar_id = data.calendar_id || null;
    this.day_of_week = data.day_of_week || null; // 1=Monday, 2=Tuesday, ..., 7=Sunday
    this.is_override = data.is_override || "N";

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
      calendar_id: this.calendar_id,
      day_of_week: this.day_of_week,
      is_override: this.is_override,
    };
  }

  /**
   * Create a CalendarWeeklyOff instance from database row
   * @param {Object} row - Database row object
   * @returns {CalendarWeeklyOff} CalendarWeeklyOff instance
   */
  static fromDatabaseRow(row) {
    return new CalendarWeeklyOff({
      id: row.id,
      calendar_id: row.calendar_id,
      day_of_week: row.day_of_week,
      is_override: row.is_override,
      created_at: row.created_at,
      updated_at: row.updated_at,
    });
  }

  /**
   * Create multiple CalendarWeeklyOff instances from database rows
   * @param {Array} rows - Array of database row objects
   * @returns {Array<CalendarWeeklyOff>} Array of CalendarWeeklyOff instances
   */
  static fromDatabaseRows(rows) {
    return rows.map((row) => CalendarWeeklyOff.fromDatabaseRow(row));
  }
}

module.exports = CalendarWeeklyOff;

