/**
 * AttendanceCalendar Model/Class
 * Composite model representing a comprehensive attendance calendar day
 * Combines calendar data, attendance records, and leave records
 */
class AttendanceCalendar {
  constructor(data) {
    // Date information
    this.date = data.date || null;

    // Calendar information
    this.is_working_day = data.is_working_day || null;
    this.calendar_reason = data.calendar_reason || null;
    this.calendar_type = data.calendar_type || null; // HOLIDAY, OPTIONAL_HOLIDAY, WEEKLY_OFF, etc.

    // Attendance information
    this.attendance = data.attendance || null; // Attendance object or null

    // Leave information
    this.leaves = data.leaves || []; // Array of leave objects

    // Combined status
    this.day_status = data.day_status || null; // PRESENT, ABSENT, ON_LEAVE, LEAVE_PENDING, NON_WORKING, EXPECTED, INDETERMINATE
  }

  /**
   * Convert the attendance calendar object to a plain object
   * @returns {Object} Plain object representation
   */
  toJSON() {
    return {
      date: this.date,
      is_working_day: this.is_working_day,
      calendar_reason: this.calendar_reason,
      calendar_type: this.calendar_type,
      attendance: this.attendance ? (typeof this.attendance.toJSON === 'function' ? this.attendance.toJSON() : this.attendance) : null,
      leaves: this.leaves.map(leave => typeof leave.toJSON === 'function' ? leave.toJSON() : leave),
      day_status: this.day_status,
    };
  }

  /**
   * Create an AttendanceCalendar instance from data
   * @param {Object} data - Data object
   * @returns {AttendanceCalendar} AttendanceCalendar instance
   */
  static fromData(data) {
    return new AttendanceCalendar(data);
  }

  /**
   * Create multiple AttendanceCalendar instances from data array
   * @param {Array} dataArray - Array of data objects
   * @returns {Array<AttendanceCalendar>} Array of AttendanceCalendar instances
   */
  static fromDataArray(dataArray) {
    return dataArray.map((data) => AttendanceCalendar.fromData(data));
  }
}

module.exports = AttendanceCalendar;

