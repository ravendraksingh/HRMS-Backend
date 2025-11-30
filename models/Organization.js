/**
 * Organization Model/Class
 * Represents an organization with all its properties
 */
class Organization {
  constructor(data) {
    // Core organization fields
    this.orgid = data.orgid || null;
    this.name = data.name || null;
    this.short_name = data.short_name || null;
    this.logo_url = data.logo_url || null;
    this.is_active = data.is_active || "N";
    this.financial_year = data.financial_year || null;

    // Internal fields (excluded from DTO)
    this.created_at = data.created_at || null;
    this.updated_at = data.updated_at || null;
  }

  /**
   * Convert the organization object to a plain object (excluding internal fields)
   * @returns {Object} Plain object representation
   */
  toJSON() {
    return {
      orgid: this.orgid,
      name: this.name,
      short_name: this.short_name,
      logo_url: this.logo_url,
      is_active: this.is_active,
      financial_year: this.financial_year,
    };
  }

  /**
   * Create an Organization instance from database row
   * @param {Object} row - Database row object
   * @returns {Organization} Organization instance
   */
  static fromDatabaseRow(row) {
    return new Organization({
      orgid: row.orgid,
      name: row.name,
      short_name: row.short_name,
      logo_url: row.logo_url,
      is_active: row.is_active,
      financial_year: row.financial_year,
      created_at: row.created_at,
      updated_at: row.updated_at,
    });
  }

  /**
   * Create multiple Organization instances from database rows
   * @param {Array} rows - Array of database row objects
   * @returns {Array<Organization>} Array of Organization instances
   */
  static fromDatabaseRows(rows) {
    return rows.map((row) => Organization.fromDatabaseRow(row));
  }
}

module.exports = Organization;

