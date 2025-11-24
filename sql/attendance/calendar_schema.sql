-- ============================================================================
-- ATTENDANCE CALENDAR SYSTEM (Workday-style Hierarchical Calendar)
-- ============================================================================
-- Hierarchical calendar system: Organization -> Location -> Department -> Employee
-- Each level can override the parent level's calendar
-- ============================================================================

-- ============================================================================
-- 1. CALENDAR DEFINITIONS
-- ============================================================================
-- Base calendar definitions at each level (org, location, department, employee)

CREATE TABLE IF NOT EXISTS attendance_calendars (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  calendar_name VARCHAR(200) NOT NULL COMMENT 'Name of the calendar (e.g., "India Office Calendar 2025")',
  calendar_type VARCHAR(20) NOT NULL COMMENT 'ORGANIZATION, LOCATION, DEPARTMENT, EMPLOYEE',
  location_id TINYINT UNSIGNED DEFAULT NULL COMMENT 'Location ID (for LOCATION type)',
  department_id VARCHAR(10) DEFAULT NULL COMMENT 'Department ID (for DEPARTMENT type)',
  empid VARCHAR(10) DEFAULT NULL COMMENT 'Employee ID (for EMPLOYEE type)',
  year INT NOT NULL COMMENT 'Year this calendar applies to',
  is_active VARCHAR(1) DEFAULT 'Y' COMMENT 'Y if active, N if inactive',
  description VARCHAR(500) DEFAULT NULL,
  created_by VARCHAR(10) DEFAULT NULL COMMENT 'Employee ID of creator',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_calendar_location FOREIGN KEY (location_id) REFERENCES office_locations(id) ON DELETE CASCADE,
  CONSTRAINT fk_calendar_department FOREIGN KEY (department_id) REFERENCES departments(deptid) ON DELETE CASCADE,
  CONSTRAINT fk_calendar_employee FOREIGN KEY (empid) REFERENCES employees(empid) ON DELETE CASCADE,
  CONSTRAINT fk_calendar_created_by FOREIGN KEY (created_by) REFERENCES employees(empid) ON DELETE SET NULL,
  INDEX idx_calendar_type (calendar_type),
  INDEX idx_calendar_year (year),
  INDEX idx_calendar_location (location_id),
  INDEX idx_calendar_department (department_id),
  INDEX idx_calendar_employee (empid),
  -- Ensure one calendar per level per year
  UNIQUE KEY uk_calendar_location_year (location_id, year, calendar_type),
  UNIQUE KEY uk_calendar_department_year (department_id, year, calendar_type),
  UNIQUE KEY uk_calendar_employee_year (empid, year, calendar_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 2. CALENDAR HOLIDAYS
-- ============================================================================
-- Holidays defined in each calendar (can override parent holidays)

CREATE TABLE IF NOT EXISTS attendance_calendar_holidays (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  calendar_id INT UNSIGNED NOT NULL COMMENT 'Reference to attendance_calendars.id',
  holiday_date DATE NOT NULL,
  holiday_name VARCHAR(200) NOT NULL,
  is_optional VARCHAR(1) DEFAULT 'N' COMMENT 'Y if optional holiday, N if mandatory',
  is_override VARCHAR(1) DEFAULT 'N' COMMENT 'Y if this overrides a parent calendar holiday',
  description VARCHAR(500) DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_calendar_holidays_calendar FOREIGN KEY (calendar_id) REFERENCES attendance_calendars(id) ON DELETE CASCADE,
  INDEX idx_calendar_holidays_calendar (calendar_id),
  INDEX idx_calendar_holidays_date (holiday_date),
  -- One holiday per date per calendar
  UNIQUE KEY uk_calendar_holiday_date (calendar_id, holiday_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 3. CALENDAR WEEKLY OFFS
-- ============================================================================
-- Weekly off days defined in each calendar

CREATE TABLE IF NOT EXISTS attendance_calendar_weekly_offs (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  calendar_id INT UNSIGNED NOT NULL COMMENT 'Reference to attendance_calendars.id',
  day_of_week TINYINT NOT NULL COMMENT '1=Monday, 2=Tuesday, ..., 7=Sunday',
  is_override VARCHAR(1) DEFAULT 'N' COMMENT 'Y if this overrides a parent calendar weekly off',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_calendar_weekly_offs_calendar FOREIGN KEY (calendar_id) REFERENCES attendance_calendars(id) ON DELETE CASCADE,
  INDEX idx_calendar_weekly_offs_calendar (calendar_id),
  INDEX idx_calendar_weekly_offs_day (day_of_week),
  -- One weekly off per day per calendar
  UNIQUE KEY uk_calendar_weekly_off_day (calendar_id, day_of_week)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 4. CALENDAR WORKING DAYS OVERRIDES
-- ============================================================================
-- Override specific dates to be working/non-working (e.g., make-up days)

CREATE TABLE IF NOT EXISTS attendance_calendar_date_overrides (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  calendar_id INT UNSIGNED NOT NULL COMMENT 'Reference to attendance_calendars.id',
  override_date DATE NOT NULL,
  is_working_day VARCHAR(1) NOT NULL COMMENT 'Y if working day, N if non-working day',
  reason VARCHAR(500) DEFAULT NULL COMMENT 'Reason for override (e.g., "Make-up day for holiday")',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_calendar_date_overrides_calendar FOREIGN KEY (calendar_id) REFERENCES attendance_calendars(id) ON DELETE CASCADE,
  INDEX idx_calendar_date_overrides_calendar (calendar_id),
  INDEX idx_calendar_date_overrides_date (override_date),
  -- One override per date per calendar
  UNIQUE KEY uk_calendar_date_override (calendar_id, override_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

