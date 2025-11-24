/**
 * Location Model/Class
 * Represents an office location with all its properties
 */
class Location {
  constructor(data) {
    // Core location fields
    this.id = data.id || null;
    this.name = data.name || null;
    this.address_line1 = data.address_line1 || null;
    this.address_line2 = data.address_line2 || null;
    this.city = data.city || null;
    this.state = data.state || null;
    this.postal_code = data.postal_code || null;
    this.country = data.country || null;
    this.phone = data.phone || null;
  }

  /**
   * Convert the location object to a plain object
   * @returns {Object} Plain object representation
   */
  toJSON() {
    return {
      id: this.id,
      name: this.name,
      address_line1: this.address_line1,
      address_line2: this.address_line2,
      city: this.city,
      state: this.state,
      postal_code: this.postal_code,
      country: this.country,
      phone: this.phone,
    };
  }

  /**
   * Create a Location instance from database row
   * @param {Object} row - Database row object
   * @returns {Location} Location instance
   */
  static fromDatabaseRow(row) {
    return new Location({
      id: row.id,
      name: row.name,
      address_line1: row.address_line1,
      address_line2: row.address_line2,
      city: row.city,
      state: row.state,
      postal_code: row.postal_code,
      country: row.country,
      phone: row.phone,
    });
  }

  /**
   * Create multiple Location instances from database rows
   * @param {Array} rows - Array of database row objects
   * @returns {Array<Location>} Array of Location instances
   */
  static fromDatabaseRows(rows) {
    return rows.map((row) => Location.fromDatabaseRow(row));
  }
}

module.exports = Location;

