/**
 * Date Time Utility Functions
 * Functions for getting current date, month, and year in various formats
 */

/**
 * Get today's date in YYYY-MM-DD format
 * @returns {string} Today's date in YYYY-MM-DD format
 */
function getTodayDate() {
  const today = new Date();
  return today.toISOString().split("T")[0]; // YYYY-MM-DD
}

/**
 * Get current month in YYYY-MM format
 * @returns {string} Current month in YYYY-MM format
 */
function getCurrentMonth() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`; // YYYY-MM
}

/**
 * Get current year in YYYY format
 * @returns {string} Current year in YYYY format
 */
function getCurrentYear() {
  const today = new Date();
  return String(today.getFullYear()); // YYYY
}

module.exports = {
  getTodayDate,
  getCurrentMonth,
  getCurrentYear,
};

