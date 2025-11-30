-- ============================================================================
-- Attendance Module Schema
-- ============================================================================
-- This file contains the attendance-related tables
-- ============================================================================

-- ============================================================================
-- 1. ATTENDANCE SHIFTS
-- ============================================================================
-- Define work shifts (Morning, Evening, Night, etc.)

CREATE TABLE IF NOT EXISTS attendance_shifts (
  shiftid VARCHAR(10) NOT NULL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  start_time TIME NOT NULL COMMENT 'Shift start time (e.g., 09:00:00)',
  end_time TIME NOT NULL COMMENT 'Shift end time (e.g., 18:00:00)',
  break_duration_minutes INT UNSIGNED DEFAULT 0 COMMENT 'Break duration in minutes',
  grace_duration_minutes INT UNSIGNED DEFAULT 0 COMMENT 'Grace duration in minutes',
  total_hours DECIMAL(4, 2) NOT NULL COMMENT 'Total working hours per day',
  is_active VARCHAR(1) DEFAULT 'Y' COMMENT 'Y if active, N if inactive',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_shift_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 2. ATTENDANCE SHIFT ASSIGNMENTS
-- ============================================================================
-- Assign shifts to employees

CREATE TABLE IF NOT EXISTS attendance_shift_assignments (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  empid VARCHAR(10) NOT NULL,
  shiftid VARCHAR(10) NOT NULL,
  effective_from DATE NOT NULL COMMENT 'Date from which this shift assignment is effective',
  effective_to DATE DEFAULT NULL COMMENT 'Date until which this shift assignment is valid (NULL for ongoing)',
  is_active VARCHAR(1) DEFAULT 'Y' COMMENT 'Y if active, N if inactive',
  assigned_by VARCHAR(10) DEFAULT NULL COMMENT 'Employee ID who assigned this shift',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_shift_assignments_employee FOREIGN KEY (empid) REFERENCES employees(empid) ON DELETE CASCADE,
  CONSTRAINT fk_shift_assignments_shift FOREIGN KEY (shiftid) REFERENCES attendance_shifts(shiftid) ON DELETE CASCADE,
  CONSTRAINT fk_shift_assignments_assigned_by FOREIGN KEY (assigned_by) REFERENCES employees(empid) ON DELETE SET NULL,
  INDEX idx_shift_assignments_employee (empid),
  INDEX idx_shift_assignments_shift (shiftid),
  INDEX idx_shift_assignments_dates (effective_from, effective_to)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 3. ATTENDANCE RECORDS
-- ============================================================================
-- Daily attendance records (check-in/check-out)

CREATE TABLE IF NOT EXISTS attendance_records (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  empid VARCHAR(10) NOT NULL,
  attendance_date DATE NOT NULL,
  shiftid VARCHAR(10) NOT NULL DEFAULT 'GENERAL' COMMENT 'Shift assigned for this day',
  check_in_time TIMESTAMP NULL DEFAULT NULL COMMENT 'Employee check-in timestamp',
  check_out_time TIMESTAMP NULL DEFAULT NULL COMMENT 'Employee check-out timestamp',
  break_start_time TIMESTAMP NULL DEFAULT NULL COMMENT 'Break start timestamp',
  break_end_time TIMESTAMP NULL DEFAULT NULL COMMENT 'Break end timestamp',
  total_work_hours DECIMAL(5, 2) DEFAULT NULL COMMENT 'Total work hours (calculated)',
  status VARCHAR(20) DEFAULT 'PRESENT' COMMENT 'PRESENT, ABSENT, HALF_DAY, LATE, EARLY_LEAVE',
  is_late VARCHAR(1) DEFAULT 'N' COMMENT 'Y if late check-in, N if not',
  is_early_leave VARCHAR(1) DEFAULT 'N' COMMENT 'Y if early check-out, N if not',
  late_minutes INT DEFAULT 0 COMMENT 'Minutes late',
  early_leave_minutes INT DEFAULT 0 COMMENT 'Minutes early leave',
  remarks VARCHAR(500) DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_attendance_records_employee FOREIGN KEY (empid) REFERENCES employees(empid) ON DELETE CASCADE,
  CONSTRAINT fk_attendance_records_shift FOREIGN KEY (shiftid) REFERENCES attendance_shifts(shiftid) ON DELETE SET NULL,
  UNIQUE KEY uk_attendance_employee_date (empid, attendance_date),
  INDEX idx_attendance_date (attendance_date),
  INDEX idx_attendance_employee (empid),
  INDEX idx_attendance_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 4. ATTENDANCE OVERTIME
-- ============================================================================
-- Overtime records

CREATE TABLE IF NOT EXISTS attendance_overtime (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  empid VARCHAR(10) NOT NULL,
  overtime_date DATE NOT NULL,
  start_time TIMESTAMP NOT NULL COMMENT 'Overtime start timestamp',
  end_time TIMESTAMP NOT NULL COMMENT 'Overtime end timestamp',
  total_hours DECIMAL(5, 2) NOT NULL COMMENT 'Total overtime hours',
  reason VARCHAR(500) DEFAULT NULL COMMENT 'Reason for overtime',
  status VARCHAR(20) DEFAULT 'PENDING' COMMENT 'PENDING, APPROVED, REJECTED',
  applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  approved_by VARCHAR(10) DEFAULT NULL COMMENT 'Employee ID of approver',
  approved_at TIMESTAMP NULL DEFAULT NULL,
  rejection_reason VARCHAR(500) DEFAULT NULL COMMENT 'Reason if rejected',
  remarks VARCHAR(500) DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_overtime_employee FOREIGN KEY (empid) REFERENCES employees(empid) ON DELETE CASCADE,
  CONSTRAINT fk_overtime_approved_by FOREIGN KEY (approved_by) REFERENCES employees(empid) ON DELETE SET NULL,
  INDEX idx_overtime_employee (empid),
  INDEX idx_overtime_date (overtime_date),
  INDEX idx_overtime_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 5. ATTENDANCE CORRECTION REQUESTS
-- ============================================================================
-- Requests to correct attendance records

CREATE TABLE IF NOT EXISTS attendance_correction_requests (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  empid VARCHAR(10) NOT NULL,
  attendance_record_id BIGINT UNSIGNED DEFAULT NULL COMMENT 'Reference to attendance_records.id (NULL if no record exists for the date)',
  correction_date DATE NOT NULL COMMENT 'Date for which correction is requested',
  requested_check_in TIMESTAMP NULL DEFAULT NULL COMMENT 'Requested check-in time',
  requested_check_out TIMESTAMP NULL DEFAULT NULL COMMENT 'Requested check-out time',
  reason VARCHAR(500) NOT NULL COMMENT 'Reason for correction request',
  status VARCHAR(20) DEFAULT 'PENDING' COMMENT 'PENDING, APPROVED, REJECTED',
  applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  approved_by VARCHAR(10) DEFAULT NULL COMMENT 'Employee ID of approver',
  approved_at TIMESTAMP NULL DEFAULT NULL,
  rejection_reason VARCHAR(500) DEFAULT NULL COMMENT 'Reason if rejected',
  remarks VARCHAR(500) DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_correction_requests_employee FOREIGN KEY (empid) REFERENCES employees(empid) ON DELETE CASCADE,
  CONSTRAINT fk_correction_requests_attendance FOREIGN KEY (attendance_record_id) REFERENCES attendance_records(id) ON DELETE CASCADE,
  CONSTRAINT fk_correction_requests_approved_by FOREIGN KEY (approved_by) REFERENCES employees(empid) ON DELETE SET NULL,
  INDEX idx_correction_requests_employee (empid),
  INDEX idx_correction_requests_date (correction_date),
  INDEX idx_correction_requests_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 6. ATTENDANCE POLICIES
-- ============================================================================
-- Attendance policies and rules

CREATE TABLE IF NOT EXISTS attendance_policies (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  policy_name VARCHAR(200) NOT NULL,
  policy_type VARCHAR(50) NOT NULL COMMENT 'LATE_ARRIVAL, EARLY_LEAVE, ABSENT, OVERTIME, etc.',
  description TEXT DEFAULT NULL,
  rules JSON DEFAULT NULL COMMENT 'Policy rules in JSON format',
  is_active VARCHAR(1) DEFAULT 'Y' COMMENT 'Y if active, N if inactive',
  effective_from DATE NOT NULL,
  effective_to DATE DEFAULT NULL COMMENT 'NULL if ongoing',
  created_by VARCHAR(10) DEFAULT NULL COMMENT 'Employee ID of creator',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_policies_created_by FOREIGN KEY (created_by) REFERENCES employees(empid) ON DELETE SET NULL,
  INDEX idx_policies_type (policy_type),
  INDEX idx_policies_dates (effective_from, effective_to)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 7. ATTENDANCE WEEKLY OFF
-- ============================================================================
-- Weekly off days configuration

CREATE TABLE IF NOT EXISTS attendance_weekly_off (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  empid VARCHAR(10) NOT NULL,
  day_of_week TINYINT NOT NULL COMMENT '1=Monday, 2=Tuesday, ..., 7=Sunday',
  is_active VARCHAR(1) DEFAULT 'Y' COMMENT 'Y if active, N if inactive',
  effective_from DATE NOT NULL,
  effective_to DATE DEFAULT NULL COMMENT 'NULL if ongoing',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_weekly_off_employee FOREIGN KEY (empid) REFERENCES employees(empid) ON DELETE CASCADE,
  UNIQUE KEY uk_weekly_off_employee_day (empid, day_of_week, effective_from),
  INDEX idx_weekly_off_employee (empid),
  INDEX idx_weekly_off_day (day_of_week)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

