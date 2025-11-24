/**
 * LeaveType Model/Class
 * Represents a leave type with all its properties
 */
class LeaveType {
  constructor(data) {
    // Core leave type fields
    this.leavetype_id = data.leavetype_id || null;
    this.name = data.name || null;
    this.description = data.description || null;

    // Leave limits
    this.max_leaves_per_year = data.max_leaves_per_year || null;
    this.carry_forward = data.carry_forward || "N";
    this.max_carry_forward = data.max_carry_forward || 0;

    // Requirements
    this.requires_approval = data.requires_approval || "Y";
    this.requires_medical_certificate = data.requires_medical_certificate || "N";

    // Status
    this.is_active = data.is_active || "Y";
  }

  /**
   * Convert the leave type object to a plain object
   * @returns {Object} Plain object representation
   */
  toJSON() {
    return {
      leavetype_id: this.leavetype_id,
      name: this.name,
      description: this.description,
      max_leaves_per_year: this.max_leaves_per_year,
      carry_forward: this.carry_forward,
      max_carry_forward: this.max_carry_forward,
      requires_approval: this.requires_approval,
      requires_medical_certificate: this.requires_medical_certificate,
      is_active: this.is_active,
    };
  }

  /**
   * Create a LeaveType instance from database row
   * @param {Object} row - Database row object
   * @returns {LeaveType} LeaveType instance
   */
  static fromDatabaseRow(row) {
    return new LeaveType({
      leavetype_id: row.leavetype_id,
      name: row.name,
      description: row.description,
      max_leaves_per_year: row.max_leaves_per_year,
      carry_forward: row.carry_forward,
      max_carry_forward: row.max_carry_forward,
      requires_approval: row.requires_approval,
      requires_medical_certificate: row.requires_medical_certificate,
      is_active: row.is_active,
    });
  }

  /**
   * Create multiple LeaveType instances from database rows
   * @param {Array} rows - Array of database row objects
   * @returns {Array<LeaveType>} Array of LeaveType instances
   */
  static fromDatabaseRows(rows) {
    return rows.map((row) => LeaveType.fromDatabaseRow(row));
  }
}

module.exports = LeaveType;

