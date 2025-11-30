/**
 * LeaveCalendar Model/Class
 * Composite model representing leave information for a calendar period
 * Combines leave records with calendar/date information
 */
class LeaveCalendar {
  constructor(data) {
    // Date information
    this.date = data.date || null;

    // Leave information
    this.leave = data.leave || null; // Leave object
    this.leave_type_name = data.leave_type_name || null;

    // Status
    this.status = data.status || null; // PENDING, APPROVED, REJECTED, CANCELLED
  }

  /**
   * Convert the leave calendar object to a plain object
   * @returns {Object} Plain object representation
   */
  toJSON() {
    return {
      date: this.date,
      leave: this.leave ? (typeof this.leave.toJSON === 'function' ? this.leave.toJSON() : this.leave) : null,
      leave_type_name: this.leave_type_name,
      status: this.status,
    };
  }

  /**
   * Create a LeaveCalendar instance from data
   * @param {Object} data - Data object
   * @returns {LeaveCalendar} LeaveCalendar instance
   */
  static fromData(data) {
    return new LeaveCalendar(data);
  }

  /**
   * Create multiple LeaveCalendar instances from data array
   * @param {Array} dataArray - Array of data objects
   * @returns {Array<LeaveCalendar>} Array of LeaveCalendar instances
   */
  static fromDataArray(dataArray) {
    return dataArray.map((data) => LeaveCalendar.fromData(data));
  }
}

module.exports = LeaveCalendar;

