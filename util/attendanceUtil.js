/**
 * Attendance Utility Functions
 * Functions for calculating late arrival and early leave
 */

const pool = require("../db");

/**
 * Get shift details for an employee on a specific date
 * @param {string} empid - Employee ID
 * @param {string|Date} attendanceDate - Attendance date (YYYY-MM-DD)
 * @param {string|null} shiftid - Optional shift ID from attendance record
 * @returns {Promise<Object|null>} Shift details with start_time, end_time, grace_duration_minutes, or null if not found
 */
async function getShiftForDate(empid, attendanceDate, shiftid = null) {
  try {
    // Convert attendanceDate to Date object if string
    const date = typeof attendanceDate === "string" 
      ? new Date(attendanceDate + "T00:00:00") 
      : attendanceDate;
    const dateStr = date.toISOString().split("T")[0]; // YYYY-MM-DD

    let shiftQuery;
    let params;

    // If shiftid is provided, use it directly
    if (shiftid) {
      shiftQuery = `
        SELECT 
          s.shiftid,
          s.start_time,
          s.end_time,
          s.grace_duration_minutes
        FROM attendance_shifts s
        WHERE s.shiftid = ? AND s.is_active = 'Y'
      `;
      params = [shiftid];
    } else {
      // Get active shift assignment for the date
      shiftQuery = `
        SELECT 
          s.shiftid,
          s.start_time,
          s.end_time,
          s.grace_duration_minutes
        FROM attendance_shift_assignments asa
        INNER JOIN attendance_shifts s ON asa.shiftid = s.shiftid
        WHERE asa.empid = ?
          AND asa.is_active = 'Y'
          AND s.is_active = 'Y'
          AND asa.effective_from <= ?
          AND (asa.effective_to IS NULL OR asa.effective_to >= ?)
        ORDER BY asa.effective_from DESC
        LIMIT 1
      `;
      params = [empid, dateStr, dateStr];
    }

    const [[shift]] = await pool.query(shiftQuery, params);

    if (!shift) {
      return null;
    }

    return {
      shiftid: shift.shiftid,
      start_time: shift.start_time,
      end_time: shift.end_time,
      grace_duration_minutes: shift.grace_duration_minutes || 0,
    };
  } catch (error) {
    console.error("Error getting shift for date:", error);
    return null;
  }
}

/**
 * Calculate late minutes based on check-in time and shift start time
 * @param {string|Date} checkInTime - Check-in timestamp
 * @param {string|Date} attendanceDate - Attendance date (YYYY-MM-DD)
 * @param {string} shiftStartTime - Shift start time (HH:MM:SS)
 * @param {number} graceDurationMinutes - Grace duration in minutes
 * @returns {Object} { is_late: 'Y'|'N', late_minutes: number }
 */
function calculateLateStatus(checkInTime, attendanceDate, shiftStartTime, graceDurationMinutes = 0) {
  if (!checkInTime || !shiftStartTime) {
    return { is_late: "N", late_minutes: 0 };
  }

  try {
    // Parse check-in time (from database TIMESTAMP, already in local timezone)
    const checkIn = new Date(checkInTime);
    if (isNaN(checkIn.getTime())) {
      return { is_late: "N", late_minutes: 0 };
    }

    // Parse attendance date to get year, month, day in local timezone
    const date = typeof attendanceDate === "string" 
      ? new Date(attendanceDate + "T00:00:00") 
      : attendanceDate;
    
    // Get local date components (year, month, day)
    const year = date.getFullYear();
    const month = date.getMonth();
    const day = date.getDate();

    // Parse shift start time (HH:MM:SS)
    const [hours, minutes, seconds] = shiftStartTime.split(":").map(Number);
    
    // Create expected start time in LOCAL timezone (not UTC)
    const expectedStartTime = new Date(year, month, day, hours, minutes, seconds || 0);

    // Add grace duration to get the actual allowed start time
    // Example: If shift starts at 9:00 AM with 15 min grace, allowed time is 9:15 AM
    const allowedStartTime = new Date(expectedStartTime.getTime() + graceDurationMinutes * 60 * 1000);

    // Calculate difference in minutes between check-in and allowed start time
    // If check-in is after allowedStartTime, employee is late
    const diffMinutes = Math.floor((checkIn.getTime() - allowedStartTime.getTime()) / (1000 * 60));

    if (diffMinutes > 0) {
      return {
        is_late: "Y",
        late_minutes: diffMinutes,
      };
    } else {
      return {
        is_late: "N",
        late_minutes: 0,
      };
    }
  } catch (error) {
    console.error("Error calculating late status:", error);
    return { is_late: "N", late_minutes: 0 };
  }
}

/**
 * Calculate early leave minutes based on check-out time and shift end time
 * @param {string|Date} checkOutTime - Check-out timestamp
 * @param {string|Date} attendanceDate - Attendance date (YYYY-MM-DD)
 * @param {string} shiftEndTime - Shift end time (HH:MM:SS)
 * @returns {Object} { is_early_leave: 'Y'|'N', early_leave_minutes: number }
 */
function calculateEarlyLeaveStatus(checkOutTime, attendanceDate, shiftEndTime) {
  if (!checkOutTime || !shiftEndTime) {
    return { is_early_leave: "N", early_leave_minutes: 0 };
  }

  try {
    // Parse check-out time (from database TIMESTAMP, already in local timezone)
    const checkOut = new Date(checkOutTime);
    if (isNaN(checkOut.getTime())) {
      return { is_early_leave: "N", early_leave_minutes: 0 };
    }

    // Parse attendance date to get year, month, day in local timezone
    const date = typeof attendanceDate === "string" 
      ? new Date(attendanceDate + "T00:00:00") 
      : attendanceDate;
    
    // Get local date components (year, month, day)
    const year = date.getFullYear();
    const month = date.getMonth();
    const day = date.getDate();

    // Parse shift end time (HH:MM:SS)
    const [hours, minutes, seconds] = shiftEndTime.split(":").map(Number);
    
    // Create expected end time in LOCAL timezone (not UTC)
    const expectedEndTime = new Date(year, month, day, hours, minutes, seconds || 0);

    // Calculate difference in minutes (positive if early, negative if late)
    const diffMinutes = Math.floor((expectedEndTime.getTime() - checkOut.getTime()) / (1000 * 60));

    if (diffMinutes > 0) {
      return {
        is_early_leave: "Y",
        early_leave_minutes: diffMinutes,
      };
    } else {
      return {
        is_early_leave: "N",
        early_leave_minutes: 0,
      };
    }
  } catch (error) {
    console.error("Error calculating early leave status:", error);
    return { is_early_leave: "N", early_leave_minutes: 0 };
  }
}

/**
 * Calculate both late and early leave status for an attendance record
 * @param {string} empid - Employee ID
 * @param {string|Date} attendanceDate - Attendance date (YYYY-MM-DD)
 * @param {string|Date|null} checkInTime - Check-in timestamp
 * @param {string|Date|null} checkOutTime - Check-out timestamp
 * @param {string|null} shiftid - Optional shift ID from attendance record
 * @returns {Promise<Object>} { is_late, late_minutes, is_early_leave, early_leave_minutes }
 */
async function calculateAttendanceStatus(
  empid,
  attendanceDate,
  checkInTime = null,
  checkOutTime = null,
  shiftid = null
) {
  const result = {
    is_late: "N",
    late_minutes: 0,
    is_early_leave: "N",
    early_leave_minutes: 0,
  };

  // Get shift details
  const shift = await getShiftForDate(empid, attendanceDate, shiftid);

  if (!shift) {
    // No shift found, return default values
    return result;
  }

  // Calculate late status if check-in time exists
  if (checkInTime) {
    const lateStatus = calculateLateStatus(
      checkInTime,
      attendanceDate,
      shift.start_time,
      shift.grace_duration_minutes
    );
    result.is_late = lateStatus.is_late;
    result.late_minutes = lateStatus.late_minutes;
  }

  // Calculate early leave status if check-out time exists
  if (checkOutTime) {
    const earlyLeaveStatus = calculateEarlyLeaveStatus(
      checkOutTime,
      attendanceDate,
      shift.end_time
    );
    result.is_early_leave = earlyLeaveStatus.is_early_leave;
    result.early_leave_minutes = earlyLeaveStatus.early_leave_minutes;
  }

  return result;
}

module.exports = {
  getShiftForDate,
  calculateLateStatus,
  calculateEarlyLeaveStatus,
  calculateAttendanceStatus,
};

