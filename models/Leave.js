/**
 * Leave Model/Class
 * Represents a leave record with all its properties
 */
class Leave {
  constructor(data) {
    // Core leave fields
    this.id = data.id || null;
    this.empid = data.empid || null;
    this.leavetype_id = data.leavetype_id || null;
    this.start_date = data.start_date || null;
    this.end_date = data.end_date || null;
    this.total_days = data.total_days || null;

    // Leave details
    this.reason = data.reason || null;
    this.medical_certificate_url = data.medical_certificate_url || null;

    // Status and approval
    this.status = data.status || null; // PENDING, APPROVED, REJECTED, CANCELLED
    this.approved_by = data.approved_by || null;
    this.approved_at = data.approved_at || null;
    this.rejection_reason = data.rejection_reason || null;
    this.cancelled_at = data.cancelled_at || null;
    this.remarks = data.remarks || null;

    // Timestamp
    this.applied_at = data.applied_at || null;
  }

  /**
   * Convert the leave object to a plain object
   * @returns {Object} Plain object representation
   */
  toJSON() {
    return {
      id: this.id,
      empid: this.empid,
      leavetype_id: this.leavetype_id,
      start_date: this.start_date,
      end_date: this.end_date,
      total_days: this.total_days,
      reason: this.reason,
      medical_certificate_url: this.medical_certificate_url,
      status: this.status,
      approved_by: this.approved_by,
      approved_at: this.approved_at,
      rejection_reason: this.rejection_reason,
      cancelled_at: this.cancelled_at,
      remarks: this.remarks,
      applied_at: this.applied_at,
    };
  }

  /**
   * Create a Leave instance from database row
   * @param {Object} row - Database row object
   * @returns {Leave} Leave instance
   */
  static fromDatabaseRow(row) {
    return new Leave({
      id: row.id,
      empid: row.empid,
      leavetype_id: row.leavetype_id,
      start_date: row.start_date,
      end_date: row.end_date,
      total_days: row.total_days,
      reason: row.reason,
      medical_certificate_url: row.medical_certificate_url,
      status: row.status,
      approved_by: row.approved_by,
      approved_at: row.approved_at,
      rejection_reason: row.rejection_reason,
      cancelled_at: row.cancelled_at,
      remarks: row.remarks,
      applied_at: row.applied_at,
    });
  }

  /**
   * Create multiple Leave instances from database rows
   * @param {Array} rows - Array of database row objects
   * @returns {Array<Leave>} Array of Leave instances
   */
  static fromDatabaseRows(rows) {
    return rows.map((row) => Leave.fromDatabaseRow(row));
  }
}

module.exports = Leave;

