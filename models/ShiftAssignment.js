/**
 * ShiftAssignment Model/Class
 * Represents a shift assignment with all its properties
 */
class ShiftAssignment {
  constructor(data) {
    // Core shift assignment fields
    this.id = data.id || null;
    this.empid = data.empid || null;
    this.shiftid = data.shiftid || null;
    this.effective_from = data.effective_from || null;
    this.effective_to = data.effective_to || null;
    this.is_active = data.is_active || "Y";
    this.assigned_by = data.assigned_by || null;

    // Internal fields (excluded from DTO)
    this.created_at = data.created_at || null;
    this.updated_at = data.updated_at || null;
  }

  /**
   * Convert the shift assignment object to a plain object (excluding internal fields)
   * @returns {Object} Plain object representation
   */
  toJSON() {
    return {
      id: this.id,
      empid: this.empid,
      shiftid: this.shiftid,
      effective_from: this.effective_from,
      effective_to: this.effective_to,
      is_active: this.is_active,
      assigned_by: this.assigned_by,
    };
  }

  /**
   * Create a ShiftAssignment instance from database row
   * @param {Object} row - Database row object
   * @returns {ShiftAssignment} ShiftAssignment instance
   */
  static fromDatabaseRow(row) {
    return new ShiftAssignment({
      id: row.id,
      empid: row.empid,
      shiftid: row.shiftid,
      effective_from: row.effective_from,
      effective_to: row.effective_to,
      is_active: row.is_active,
      assigned_by: row.assigned_by,
      created_at: row.created_at,
      updated_at: row.updated_at,
    });
  }

  /**
   * Create multiple ShiftAssignment instances from database rows
   * @param {Array} rows - Array of database row objects
   * @returns {Array<ShiftAssignment>} Array of ShiftAssignment instances
   */
  static fromDatabaseRows(rows) {
    return rows.map((row) => ShiftAssignment.fromDatabaseRow(row));
  }
}

module.exports = ShiftAssignment;

