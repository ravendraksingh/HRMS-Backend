/**
 * AttendancePolicy Model/Class
 * Represents an attendance policy with all its properties
 */
class AttendancePolicy {
  constructor(data) {
    // Core policy fields
    this.id = data.id || null;
    this.policy_name = data.policy_name || null;
    this.policy_type = data.policy_type || null; // LATE_ARRIVAL, EARLY_LEAVE, ABSENT, OVERTIME, etc.
    this.description = data.description || null;
    this.rules = data.rules || null; // JSON object
    this.is_active = data.is_active || "Y";
    this.effective_from = data.effective_from || null;
    this.effective_to = data.effective_to || null;

    // Internal fields (excluded from DTO)
    this.created_by = data.created_by || null;
    this.created_at = data.created_at || null;
    this.updated_at = data.updated_at || null;
  }

  /**
   * Convert the policy object to a plain object (excluding internal fields)
   * @returns {Object} Plain object representation
   */
  toJSON() {
    // Parse rules if it's a JSON string
    let rules = this.rules;
    if (typeof rules === "string") {
      try {
        rules = JSON.parse(rules);
      } catch (e) {
        rules = null;
      }
    }

    return {
      id: this.id,
      policy_name: this.policy_name,
      policy_type: this.policy_type,
      description: this.description,
      rules: rules,
      is_active: this.is_active,
      effective_from: this.effective_from,
      effective_to: this.effective_to,
    };
  }

  /**
   * Create an AttendancePolicy instance from database row
   * @param {Object} row - Database row object
   * @returns {AttendancePolicy} AttendancePolicy instance
   */
  static fromDatabaseRow(row) {
    return new AttendancePolicy({
      id: row.id,
      policy_name: row.policy_name,
      policy_type: row.policy_type,
      description: row.description,
      rules: row.rules,
      is_active: row.is_active,
      effective_from: row.effective_from,
      effective_to: row.effective_to,
      created_by: row.created_by,
      created_at: row.created_at,
      updated_at: row.updated_at,
    });
  }

  /**
   * Create multiple AttendancePolicy instances from database rows
   * @param {Array} rows - Array of database row objects
   * @returns {Array<AttendancePolicy>} Array of AttendancePolicy instances
   */
  static fromDatabaseRows(rows) {
    return rows.map((row) => AttendancePolicy.fromDatabaseRow(row));
  }
}

module.exports = AttendancePolicy;

