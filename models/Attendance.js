/**
 * Attendance Model/Class
 * Represents an attendance record with all its properties
 */
class Attendance {
  constructor(data) {
    // Core attendance fields
    this.id = data.id || null;
    this.empid = data.empid || null;
    this.attendance_date = data.attendance_date || null;
    this.shiftid = data.shiftid || null;

    // Time fields
    this.check_in_time = data.check_in_time || null;
    this.check_out_time = data.check_out_time || null;
    this.break_start_time = data.break_start_time || null;
    this.break_end_time = data.break_end_time || null;
    this.total_work_hours = data.total_work_hours || null;

    // Status and flags
    this.status = data.status || null; // PRESENT, ABSENT, HALF_DAY, LATE, EARLY_LEAVE
    this.is_late = data.is_late || "N";
    this.is_early_leave = data.is_early_leave || "N";
    this.late_minutes = data.late_minutes || 0;
    this.early_leave_minutes = data.early_leave_minutes || 0;

    // Additional fields
    this.remarks = data.remarks || null;
  }

  /**
   * Convert the attendance object to a plain object
   * @returns {Object} Plain object representation
   */
  toJSON() {
    return {
      id: this.id,
      empid: this.empid,
      attendance_date: this.attendance_date,
      shiftid: this.shiftid,
      check_in_time: this.check_in_time,
      check_out_time: this.check_out_time,
      break_start_time: this.break_start_time,
      break_end_time: this.break_end_time,
      total_work_hours: this.total_work_hours,
      status: this.status,
      is_late: this.is_late,
      is_early_leave: this.is_early_leave,
      late_minutes: this.late_minutes,
      early_leave_minutes: this.early_leave_minutes,
      remarks: this.remarks,
    };
  }

  /**
   * Create an Attendance instance from database row
   * @param {Object} row - Database row object
   * @returns {Attendance} Attendance instance
   */
  static fromDatabaseRow(row) {
    return new Attendance({
      id: row.id,
      empid: row.empid,
      attendance_date: row.attendance_date,
      shiftid: row.shiftid,
      check_in_time: row.check_in_time,
      check_out_time: row.check_out_time,
      break_start_time: row.break_start_time,
      break_end_time: row.break_end_time,
      total_work_hours: row.total_work_hours,
      status: row.status,
      is_late: row.is_late,
      is_early_leave: row.is_early_leave,
      late_minutes: row.late_minutes,
      early_leave_minutes: row.early_leave_minutes,
      remarks: row.remarks,
    });
  }

  /**
   * Create multiple Attendance instances from database rows
   * @param {Array} rows - Array of database row objects
   * @returns {Array<Attendance>} Array of Attendance instances
   */
  static fromDatabaseRows(rows) {
    return rows.map((row) => Attendance.fromDatabaseRow(row));
  }
}

module.exports = Attendance;
