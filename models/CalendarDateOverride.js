/**
 * CalendarDateOverride Model/Class
 * Represents a date override in a calendar (make-up days, etc.)
 */
class CalendarDateOverride {
  constructor(data) {
    // Core override fields
    this.id = data.id || null;
    this.calendar_id = data.calendar_id || null;
    this.override_date = data.override_date || null;
    this.is_working_day = data.is_working_day || null; // Y or N
    this.reason = data.reason || null;

    // Internal fields (excluded from DTO)
    this.created_at = data.created_at || null;
    this.updated_at = data.updated_at || null;
  }

  /**
   * Convert the override object to a plain object (excluding internal fields)
   * @returns {Object} Plain object representation
   */
  toJSON() {
    return {
      id: this.id,
      calendar_id: this.calendar_id,
      override_date: this.override_date,
      is_working_day: this.is_working_day,
      reason: this.reason,
    };
  }

  /**
   * Create a CalendarDateOverride instance from database row
   * @param {Object} row - Database row object
   * @returns {CalendarDateOverride} CalendarDateOverride instance
   */
  static fromDatabaseRow(row) {
    return new CalendarDateOverride({
      id: row.id,
      calendar_id: row.calendar_id,
      override_date: row.override_date,
      is_working_day: row.is_working_day,
      reason: row.reason,
      created_at: row.created_at,
      updated_at: row.updated_at,
    });
  }

  /**
   * Create multiple CalendarDateOverride instances from database rows
   * @param {Array} rows - Array of database row objects
   * @returns {Array<CalendarDateOverride>} Array of CalendarDateOverride instances
   */
  static fromDatabaseRows(rows) {
    return rows.map((row) => CalendarDateOverride.fromDatabaseRow(row));
  }
}

module.exports = CalendarDateOverride;

