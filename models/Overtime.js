/**
 * Overtime Model/Class
 * Represents an overtime record with all its properties
 */
class Overtime {
  constructor(data) {
    // Core overtime fields
    this.id = data.id || null;
    this.empid = data.empid || null;
    this.overtime_date = data.overtime_date || null;
    this.start_time = data.start_time || null;
    this.end_time = data.end_time || null;
    this.total_hours = data.total_hours || null;
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
   * Convert the overtime object to a plain object (excluding internal fields)
   * @returns {Object} Plain object representation
   */
  toJSON() {
    return {
      id: this.id,
      empid: this.empid,
      overtime_date: this.overtime_date,
      start_time: this.start_time,
      end_time: this.end_time,
      total_hours: this.total_hours,
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
   * Create an Overtime instance from database row
   * @param {Object} row - Database row object
   * @returns {Overtime} Overtime instance
   */
  static fromDatabaseRow(row) {
    return new Overtime({
      id: row.id,
      empid: row.empid,
      overtime_date: row.overtime_date,
      start_time: row.start_time,
      end_time: row.end_time,
      total_hours: row.total_hours,
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
   * Create multiple Overtime instances from database rows
   * @param {Array} rows - Array of database row objects
   * @returns {Array<Overtime>} Array of Overtime instances
   */
  static fromDatabaseRows(rows) {
    return rows.map((row) => Overtime.fromDatabaseRow(row));
  }
}

module.exports = Overtime;

