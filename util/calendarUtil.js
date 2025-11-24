/**
 * Calendar Utility Functions
 * Workday-style hierarchical calendar system
 * Resolves calendar from: Organization -> Location -> Department -> Employee
 */

const pool = require("../db");
const ApiError = require("./ApiError");

/**
 * Get employee's location and department for calendar resolution
 * @param {string} empid - Employee ID
 * @returns {Promise<Object|null>} { location_id, department_id }
 */
async function getEmployeeContext(empid) {
  try {
    const [[employee]] = await pool.query(
      `SELECT 
        e.location_id,
        e.department_id
      FROM employees e
      LEFT JOIN office_locations l ON e.location_id = l.id
      WHERE e.empid = ?`,
      [empid]
    );

    if (!employee) {
      return null;
    }

    return {
      location_id: employee.location_id,
      department_id: employee.department_id,
    };
  } catch (error) {
    console.error("Error getting employee context:", error);
    return null;
  }
}

/**
 * Get calendar for a specific level
 * @param {string} calendarType - ORGANIZATION, LOCATION, DEPARTMENT, EMPLOYEE
 * @param {number} year - Year
 * @param {number|null} locationId - Location ID
 * @param {string|null} departmentId - Department ID
 * @param {string|null} empid - Employee ID
 * @returns {Promise<Object|null>} Calendar object with holidays and weekly offs
 */
async function getCalendarForLevel(
  calendarType,
  year,
  locationId = null,
  departmentId = null,
  empid = null
) {
  try {
    let whereClause = "calendar_type = ? AND year = ? AND is_active = 'Y'";
    const params = [calendarType, year];

    if (calendarType === "ORGANIZATION") {
      // No additional filter needed for organization (single org system)
    } else if (calendarType === "LOCATION" && locationId) {
      whereClause += " AND location_id = ?";
      params.push(locationId);
    } else if (calendarType === "DEPARTMENT" && departmentId) {
      whereClause += " AND department_id = ?";
      params.push(departmentId);
    } else if (calendarType === "EMPLOYEE" && empid) {
      whereClause += " AND empid = ?";
      params.push(empid);
    } else {
      return null;
    }

    const [[calendar]] = await pool.query(
      `SELECT 
        id,
        calendar_name,
        calendar_type,
        location_id,
        department_id,
        empid,
        year,
        description
      FROM attendance_calendars
      WHERE ${whereClause}
      LIMIT 1`,
      params
    );

    if (!calendar) {
      return null;
    }

    // Get holidays for this calendar
    const [holidays] = await pool.query(
      `SELECT 
        id,
        DATE_FORMAT(holiday_date, '%Y-%m-%d') as holiday_date,
        holiday_name,
        is_optional,
        is_override,
        description
      FROM attendance_calendar_holidays
      WHERE calendar_id = ?
      ORDER BY holiday_date ASC`,
      [calendar.id]
    );

    // Get weekly offs for this calendar
    const [weeklyOffsRows] = await pool.query(
      `SELECT 
        id,
        day_of_week,
        is_override
      FROM attendance_calendar_weekly_offs
      WHERE calendar_id = ?
      ORDER BY day_of_week ASC`,
      [calendar.id]
    );

    // Get date overrides for this calendar
    const [dateOverrides] = await pool.query(
      `SELECT 
        id,
        DATE_FORMAT(override_date, '%Y-%m-%d') as override_date,
        is_working_day,
        reason
      FROM attendance_calendar_date_overrides
      WHERE calendar_id = ?
      ORDER BY override_date ASC`,
      [calendar.id]
    );

    return {
      ...calendar,
      holidays: holidays.map((h) => ({
        ...h,
        holiday_date: h.holiday_date,
      })),
      weekly_offs: weeklyOffsRows.map((wo) => wo.day_of_week),
      weekly_offs_detail: weeklyOffsRows, // Keep detail for override checking
      date_overrides: dateOverrides.map((do_) => ({
        ...do_,
        override_date: do_.override_date,
      })),
    };
  } catch (error) {
    console.error("Error getting calendar for level:", error);
    return null;
  }
}

/**
 * Resolve calendar for an employee using hierarchical inheritance
 * @param {string} empid - Employee ID
 * @param {number} year - Year
 * @returns {Promise<Object>} Resolved calendar with all holidays and weekly offs
 */
async function resolveEmployeeCalendar(empid, year) {
  try {
    // Get employee context
    const context = await getEmployeeContext(empid);
    if (!context) {
      throw new Error(`Employee ${empid} not found`);
    }

    // Resolve calendars in hierarchy order (most specific to least specific)
    const calendars = {
      employee: null,
      department: null,
      location: null,
      organization: null,
    };

    // 1. Employee calendar (most specific)
    if (empid) {
      calendars.employee = await getCalendarForLevel(
        "EMPLOYEE",
        year,
        null,
        null,
        empid
      );
    }

    // 2. Department calendar
    if (context.department_id) {
      calendars.department = await getCalendarForLevel(
        "DEPARTMENT",
        year,
        null,
        context.department_id,
        null
      );
    }

    // 3. Location calendar
    if (context.location_id) {
      calendars.location = await getCalendarForLevel(
        "LOCATION",
        year,
        context.location_id,
        null,
        null
      );
    }

    // 4. Organization calendar (base/default)
    calendars.organization = await getCalendarForLevel(
      "ORGANIZATION",
      year,
      null,
      null,
      null
    );

    // Merge calendars with inheritance (employee overrides department, etc.)
    const resolved = {
      holidays: new Map(), // Use Map to handle overrides
      weekly_offs: new Set(), // Use Set to collect unique weekly offs
      date_overrides: new Map(), // Use Map to handle overrides
      source_calendars: [],
    };

    // Process in reverse order (organization -> location -> department -> employee)
    // So that more specific calendars can override less specific ones
    const order = ["organization", "location", "department", "employee"];

    for (const level of order) {
      const calendar = calendars[level];
      if (!calendar) continue;

      resolved.source_calendars.push({
        level,
        calendar_id: calendar.id,
        calendar_name: calendar.calendar_name,
      });

      // Add weekly offs (employee can override, but we collect all)
      if (calendar.weekly_offs && calendar.weekly_offs.length > 0) {
        // Check if any weekly off in this calendar is marked as override
        const hasOverride = calendar.weekly_offs_detail?.some(
          (wo) => wo.is_override === "Y"
        );

        // If this calendar has overrides, clear previous weekly offs
        if (hasOverride) {
          resolved.weekly_offs.clear();
        }

        calendar.weekly_offs.forEach((day) => {
          resolved.weekly_offs.add(day);
        });
      }

      // Add holidays (more specific calendars override less specific ones)
      if (calendar.holidays && calendar.holidays.length > 0) {
        calendar.holidays.forEach((holiday) => {
          // If marked as override, remove any existing holiday for this date
          if (holiday.is_override === "Y") {
            resolved.holidays.delete(holiday.holiday_date);
          }
          resolved.holidays.set(holiday.holiday_date, holiday);
        });
      }

      // Add date overrides (more specific calendars override less specific ones)
      if (calendar.date_overrides && calendar.date_overrides.length > 0) {
        calendar.date_overrides.forEach((override) => {
          resolved.date_overrides.set(override.override_date, override);
        });
      }
    }

    // Check if any calendars were found
    if (resolved.source_calendars.length === 0) {
      throw new ApiError(
        `No calendars found for employee ${empid} for year ${year} at any level (organization, location, department, or employee)`,
        404
      );
    }

    // Convert Maps and Sets to arrays
    return {
      empid,
      year,
      holidays: Array.from(resolved.holidays.values()),
      weekly_offs: Array.from(resolved.weekly_offs).sort(),
      date_overrides: Array.from(resolved.date_overrides.values()),
      source_calendars: resolved.source_calendars,
    };
  } catch (error) {
    console.error("Error resolving employee calendar:", error);
    throw error;
  }
}

/**
 * Check if a date is a working day for an employee
 * @param {string} empid - Employee ID
 * @param {string|Date} date - Date to check (YYYY-MM-DD or Date object)
 * @returns {Promise<Object>} { is_working_day: boolean, reason: string, type: string }
 */
async function isWorkingDay(empid, date) {
  try {
    // Handle date string or Date object
    let dateStr, year, dayOfWeek;

    if (typeof date === "string") {
      // If already in YYYY-MM-DD format, use it directly
      dateStr = date;
      const dateObj = new Date(date + "T00:00:00");
      year = dateObj.getFullYear();
      dayOfWeek = dateObj.getDay() === 0 ? 7 : dateObj.getDay();
    } else {
      // Extract local date components to avoid timezone issues
      year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      dateStr = `${year}-${month}-${day}`;
      dayOfWeek = date.getDay() === 0 ? 7 : date.getDay();
    }

    // Resolve employee calendar
    const calendar = await resolveEmployeeCalendar(empid, year);

    // Check date overrides first (highest priority)
    const dateOverride = calendar.date_overrides.find(
      (do_) => do_.override_date === dateStr
    );
    if (dateOverride) {
      return {
        is_working_day: dateOverride.is_working_day === "Y",
        reason: dateOverride.reason || "Date override",
        type: "DATE_OVERRIDE",
      };
    }

    // Check if it's a holiday
    const holiday = calendar.holidays.find((h) => h.holiday_date === dateStr);
    if (holiday) {
      return {
        is_working_day: false,
        reason: holiday.holiday_name,
        type: holiday.is_optional === "Y" ? "OPTIONAL_HOLIDAY" : "HOLIDAY",
        holiday: holiday,
      };
    }

    // Check if it's a weekly off day
    if (calendar.weekly_offs.includes(dayOfWeek)) {
      return {
        is_working_day: false,
        reason: `Weekly off (${getDayName(dayOfWeek)})`,
        type: "WEEKLY_OFF",
      };
    }

    // Default: it's a working day
    return {
      is_working_day: true,
      reason: "Regular working day",
      type: "WORKING_DAY",
    };
  } catch (error) {
    console.error("Error checking working day:", error);
    // Default to working day on error
    return {
      is_working_day: true,
      reason: "Error determining status",
      type: "UNKNOWN",
    };
  }
}

/**
 * Get working days for a date range
 * @param {string} empid - Employee ID
 * @param {string|Date} startDate - Start date
 * @param {string|Date} endDate - End date
 * @returns {Promise<Array>} Array of date objects with working day status
 */
async function getWorkingDays(empid, startDate, endDate) {
  try {
    // Convert to date strings if Date objects are passed
    let startStr, endStr;

    if (typeof startDate === "string") {
      startStr = startDate;
    } else {
      // Extract YYYY-MM-DD from Date object in local timezone
      const year = startDate.getFullYear();
      const month = String(startDate.getMonth() + 1).padStart(2, "0");
      const day = String(startDate.getDate()).padStart(2, "0");
      startStr = `${year}-${month}-${day}`;
    }

    if (typeof endDate === "string") {
      endStr = endDate;
    } else {
      // Extract YYYY-MM-DD from Date object in local timezone
      const year = endDate.getFullYear();
      const month = String(endDate.getMonth() + 1).padStart(2, "0");
      const day = String(endDate.getDate()).padStart(2, "0");
      endStr = `${year}-${month}-${day}`;
    }

    // Parse date strings to Date objects for comparison
    const start = new Date(startStr + "T00:00:00");
    const end = new Date(endStr + "T23:59:59");

    const dates = [];
    const current = new Date(start);

    while (current <= end) {
      // Get date string in YYYY-MM-DD format (using local date components)
      const year = current.getFullYear();
      const month = String(current.getMonth() + 1).padStart(2, "0");
      const day = String(current.getDate()).padStart(2, "0");
      const dateStr = `${year}-${month}-${day}`;

      const status = await isWorkingDay(empid, dateStr);

      dates.push({
        date: dateStr,
        ...status,
      });

      // Move to next day
      current.setDate(current.getDate() + 1);
    }

    return dates;
  } catch (error) {
    console.error("Error getting working days:", error);
    return [];
  }
}

/**
 * Check if a date is a working day based on a specific calendar (not resolved)
 * @param {Object} calendar - Calendar object with holidays, weekly_offs, date_overrides
 * @param {string} dateStr - Date string (YYYY-MM-DD)
 * @returns {Object} { is_working_day: boolean, reason: string, type: string }
 */
function isWorkingDayForCalendar(calendar, dateStr) {
  if (!calendar) {
    // Default: working day if no calendar
    return {
      is_working_day: true,
      reason: "No calendar defined",
      type: "UNKNOWN",
    };
  }

  // Get day of week (1=Monday, 7=Sunday)
  const dateObj = new Date(dateStr + "T00:00:00");
  const dayOfWeek = dateObj.getDay() === 0 ? 7 : dateObj.getDay();

  // Check date overrides first (highest priority)
  const dateOverride = calendar.date_overrides?.find(
    (do_) => do_.override_date === dateStr
  );
  if (dateOverride) {
    return {
      is_working_day: dateOverride.is_working_day === "Y",
      reason: dateOverride.reason || "Date override",
      type: "DATE_OVERRIDE",
    };
  }

  // Check if it's a holiday
  const holiday = calendar.holidays?.find((h) => h.holiday_date === dateStr);
  if (holiday) {
    return {
      is_working_day: false,
      reason: holiday.holiday_name,
      type: holiday.is_optional === "Y" ? "OPTIONAL_HOLIDAY" : "HOLIDAY",
      holiday: holiday,
    };
  }

  // Check if it's a weekly off day
  if (calendar.weekly_offs?.includes(dayOfWeek)) {
    return {
      is_working_day: false,
      reason: `Weekly off (${getDayName(dayOfWeek)})`,
      type: "WEEKLY_OFF",
    };
  }

  // Default: it's a working day
  return {
    is_working_day: true,
    reason: "Regular working day",
    type: "WORKING_DAY",
  };
}

/**
 * Get monthly calendar view for a specific calendar level
 * @param {Object} calendar - Calendar object
 * @param {number} year - Year
 * @param {number} month - Month (1-12)
 * @returns {Object} Monthly calendar with all dates and their status
 */
function getMonthlyCalendarForLevel(calendar, year, month) {
  // Use date strings to avoid timezone issues
  const startDateStr = `${year}-${String(month).padStart(2, "0")}-01`;

  // Get last day of month
  const lastDay = new Date(year, month, 0).getDate();
  const endDateStr = `${year}-${String(month).padStart(2, "0")}-${String(
    lastDay
  ).padStart(2, "0")}`;

  // Generate all dates in the month
  const dates = [];
  const start = new Date(startDateStr + "T00:00:00");
  const end = new Date(endDateStr + "T23:59:59");
  const current = new Date(start);

  while (current <= end) {
    const year = current.getFullYear();
    const month = String(current.getMonth() + 1).padStart(2, "0");
    const day = String(current.getDate()).padStart(2, "0");
    const dateStr = `${year}-${month}-${day}`;

    const status = isWorkingDayForCalendar(calendar, dateStr);

    dates.push({
      date: dateStr,
      ...status,
    });

    current.setDate(current.getDate() + 1);
  }

  // Calculate summary
  const summary = {
    total_days: dates.length,
    working_days: dates.filter((d) => d.is_working_day).length,
    holidays: dates.filter((d) => d.type === "HOLIDAY").length,
    optional_holidays: dates.filter((d) => d.type === "OPTIONAL_HOLIDAY")
      .length,
    weekly_offs: dates.filter((d) => d.type === "WEEKLY_OFF").length,
    date_overrides: dates.filter((d) => d.type === "DATE_OVERRIDE").length,
  };

  return {
    calendar: dates,
    summary,
  };
}

/**
 * Get monthly calendar view for an employee
 * @param {string} empid - Employee ID
 * @param {number} year - Year
 * @param {number} month - Month (1-12)
 * @returns {Promise<Object>} Monthly calendar with all dates and their status
 */
async function getMonthlyCalendar(empid, year, month) {
  try {
    // Use date strings to avoid timezone issues
    // Format: YYYY-MM-DD
    const startDateStr = `${year}-${String(month).padStart(2, "0")}-01`;

    // Get last day of month by creating first day of next month and subtracting 1 day
    const lastDay = new Date(year, month, 0).getDate();
    const endDateStr = `${year}-${String(month).padStart(2, "0")}-${String(
      lastDay
    ).padStart(2, "0")}`;

    const calendar = await resolveEmployeeCalendar(empid, year);
    const workingDays = await getWorkingDays(empid, startDateStr, endDateStr);

    // Calculate summary
    const summary = {
      total_days: workingDays.length,
      working_days: workingDays.filter((d) => d.is_working_day).length,
      holidays: workingDays.filter((d) => d.type === "HOLIDAY").length,
      optional_holidays: workingDays.filter(
        (d) => d.type === "OPTIONAL_HOLIDAY"
      ).length,
      weekly_offs: workingDays.filter((d) => d.type === "WEEKLY_OFF").length,
      date_overrides: workingDays.filter((d) => d.type === "DATE_OVERRIDE")
        .length,
    };

    return {
      empid,
      year,
      month,
      calendar: workingDays,
      summary,
      source_calendars: calendar.source_calendars,
    };
  } catch (error) {
    console.error("Error getting monthly calendar:", error);
    throw error;
  }
}

/**
 * Helper function to get day name
 * @param {number} dayOfWeek - Day of week (1=Monday, 7=Sunday)
 * @returns {string} Day name
 */
function getDayName(dayOfWeek) {
  const days = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];
  return days[dayOfWeek === 7 ? 0 : dayOfWeek] || "Unknown";
}

module.exports = {
  getEmployeeContext,
  getCalendarForLevel,
  resolveEmployeeCalendar,
  isWorkingDay,
  isWorkingDayForCalendar,
  getWorkingDays,
  getMonthlyCalendar,
  getMonthlyCalendarForLevel,
  getDayName,
};
