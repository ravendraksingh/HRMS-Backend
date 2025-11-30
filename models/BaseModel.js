/**
 * Base Model Class
 * Provides common functionality for all models
 */
class BaseModel {
  /**
   * Convert model to JSON, excluding internal fields
   * @param {Array<string>} excludeFields - Fields to exclude from JSON output
   * @returns {Object} Plain object representation
   */
  toJSON(excludeFields = []) {
    const json = {};
    for (const key in this) {
      if (this.hasOwnProperty(key) && !excludeFields.includes(key)) {
        json[key] = this[key];
      }
    }
    return json;
  }

  /**
   * Get all fields including internal ones
   * @returns {Object} Complete object representation
   */
  toFullJSON() {
    return this.toJSON([]);
  }
}

module.exports = BaseModel;

