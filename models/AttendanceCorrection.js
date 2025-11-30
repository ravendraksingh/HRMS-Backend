/**
 * AttendanceCorrection Model/Class
 * Represents an attendance correction request with all its properties
 */
class AttendanceCorrection {
  constructor(data) {
    // Core correction fields
    this.id = data.id || null;
    this.empid = data.empid || null;
    this.attendance_record_id = data.attendance_record_id || null;
    this.correction_date = data.correction_date || null;
    this.requested_check_in = data.requested_check_in || null;
    this.requested_check_out = data.requested_check_out || null;
    this.reason = data.reason || null;
    this.status = data.status || "PENDING"; // PENDING, APPROVED, REJECTED
    this.applied_at = data.applied_at || null;
    this.approved_by = data.approved_by || null;
    this.approved_at = data.approved_at || null;
    this.rejection_reason = data.rejection_reason || null;
    this.remarks = data.remarks || null;

    // Internal fields (excluded from DTO)
    this.created_at = data.created_at || null;
    this.updated_at = data.updated_at || null;
  }

  /**
   * Convert the correction object to a plain object (excluding internal fields)
   * @returns {Object} Plain object representation
   */
  toJSON() {
    return {
      id: this.id,
      empid: this.empid,
      attendance_record_id: this.attendance_record_id,
      correction_date: this.correction_date,
      requested_check_in: this.requested_check_in,
      requested_check_out: this.requested_check_out,
      reason: this.reason,
      status: this.status,
      applied_at: this.applied_at,
      approved_by: this.approved_by,
      approved_at: this.approved_at,
      rejection_reason: this.rejection_reason,
      remarks: this.remarks,
    };
  }

  /**
   * Create an AttendanceCorrection instance from database row
   * @param {Object} row - Database row object
   * @returns {AttendanceCorrection} AttendanceCorrection instance
   */
  static fromDatabaseRow(row) {
    return new AttendanceCorrection({
      id: row.id,
      empid: row.empid,
      attendance_record_id: row.attendance_record_id,
      correction_date: row.correction_date,
      requested_check_in: row.requested_check_in,
      requested_check_out: row.requested_check_out,
      reason: row.reason,
      status: row.status,
      applied_at: row.applied_at,
      approved_by: row.approved_by,
      approved_at: row.approved_at,
      rejection_reason: row.rejection_reason,
      remarks: row.remarks,
      created_at: row.created_at,
      updated_at: row.updated_at,
    });
  }

  /**
   * Create multiple AttendanceCorrection instances from database rows
   * @param {Array} rows - Array of database row objects
   * @returns {Array<AttendanceCorrection>} Array of AttendanceCorrection instances
   */
  static fromDatabaseRows(rows) {
    return rows.map((row) => AttendanceCorrection.fromDatabaseRow(row));
  }
}

module.exports = AttendanceCorrection;

