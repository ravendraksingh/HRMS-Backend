-- ============================================================================
-- HRMS Backend - Complete MySQL Database Schema
-- Human Resource Management System - Backend
-- ============================================================================
-- This file contains the complete database schema for MySQL 8.0+
-- Run this file to set up a fresh database from scratch
-- 
-- Usage: mysql -u your_user -p your_database < sql/01_setup_mysql.sql
-- ============================================================================

-- Set SQL mode and disable foreign key checks during creation
SET @old_sql_mode = @@SQL_MODE;
SET SQL_MODE = 'STRICT_ALL_TABLES,NO_AUTO_VALUE_ON_ZERO,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION';
SET @old_fk_checks = @@FOREIGN_KEY_CHECKS;
SET FOREIGN_KEY_CHECKS = 0;

-- ============================================================================
-- 1. ORGANIZATIONS (Core - Multi-tenant foundation)
-- ============================================================================

CREATE TABLE IF NOT EXISTS organizations (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(50) NOT NULL,
  name VARCHAR(200) NOT NULL,
  logo_url VARCHAR(500) DEFAULT NULL COMMENT 'URL or path to organization logo',
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_org_code (code),
  UNIQUE KEY uk_org_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 2. OFFICE LOCATIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS office_locations (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  organization_id BIGINT UNSIGNED NOT NULL,
  name VARCHAR(150) NOT NULL,
  address_line1 VARCHAR(200) NOT NULL,
  address_line2 VARCHAR(200) DEFAULT NULL,
  city VARCHAR(100) NOT NULL,
  state VARCHAR(100) NOT NULL,
  postal_code VARCHAR(20) NOT NULL,
  country VARCHAR(100) NOT NULL,
  phone VARCHAR(30) DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_locations_org FOREIGN KEY (organization_id) REFERENCES organizations(id),
  UNIQUE KEY uk_location_org_name (organization_id, name),
  INDEX idx_location_org (organization_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 3. DEPARTMENTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS departments (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  organization_id BIGINT UNSIGNED NOT NULL,
  department_code VARCHAR(50) NOT NULL COMMENT 'Real-world department code used by the organization',
  name VARCHAR(150) NOT NULL,
  department_head BIGINT UNSIGNED DEFAULT NULL COMMENT 'Employee ID of the department head',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_departments_org FOREIGN KEY (organization_id) REFERENCES organizations(id),
  UNIQUE KEY uk_dept_org_code (organization_id, department_code),
  UNIQUE KEY uk_dept_org_name (organization_id, name),
  INDEX idx_dept_org (organization_id),
  INDEX idx_dept_code (department_code),
  INDEX idx_dept_head (department_head)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 4. EMPLOYEES (Core table - referenced by many others)
-- ============================================================================

CREATE TABLE IF NOT EXISTS employees (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  organization_id BIGINT UNSIGNED NOT NULL,
  employee_code VARCHAR(50) NOT NULL COMMENT 'Real-world employee ID/code used by the organization',
  name VARCHAR(150) NOT NULL,
  email VARCHAR(200) NOT NULL,
  manager_id BIGINT UNSIGNED DEFAULT NULL,
  hr_manager_id BIGINT UNSIGNED DEFAULT NULL COMMENT 'Dedicated HR manager for this employee',
  department_id BIGINT UNSIGNED DEFAULT NULL,
  location_id BIGINT UNSIGNED DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_employees_org_code (organization_id, employee_code),
  INDEX idx_employees_org (organization_id),
  INDEX idx_employees_code (employee_code),
  INDEX idx_employees_manager_id (manager_id),
  INDEX idx_employees_hr_manager_id (hr_manager_id),
  INDEX idx_employees_department_id (department_id),
  INDEX idx_employees_location (location_id),
  CONSTRAINT fk_employees_org FOREIGN KEY (organization_id) REFERENCES organizations(id),
  CONSTRAINT fk_employees_manager FOREIGN KEY (manager_id) REFERENCES employees(id),
  CONSTRAINT fk_employees_hr_manager FOREIGN KEY (hr_manager_id) REFERENCES employees(id) ON DELETE SET NULL,
  CONSTRAINT fk_employees_department FOREIGN KEY (department_id) REFERENCES departments(id),
  CONSTRAINT fk_employees_location FOREIGN KEY (location_id) REFERENCES office_locations(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Add self-referencing foreign key for department_head after employees table exists
ALTER TABLE departments
  ADD CONSTRAINT fk_departments_head FOREIGN KEY (department_head) REFERENCES employees(id) ON DELETE SET NULL;

-- ============================================================================
-- 5. DEPARTMENT HR MANAGERS (Junction table)
-- ============================================================================

CREATE TABLE IF NOT EXISTS department_hr_managers (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  organization_id BIGINT UNSIGNED NOT NULL,
  department_id BIGINT UNSIGNED NOT NULL,
  hr_manager_id BIGINT UNSIGNED NOT NULL COMMENT 'Employee ID of the HR manager',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_dept_hr_mgr_org FOREIGN KEY (organization_id) REFERENCES organizations(id),
  CONSTRAINT fk_dept_hr_mgr_dept FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE CASCADE,
  CONSTRAINT fk_dept_hr_mgr_employee FOREIGN KEY (hr_manager_id) REFERENCES employees(id) ON DELETE CASCADE,
  UNIQUE KEY uk_dept_hr_mgr (department_id, hr_manager_id),
  INDEX idx_dept_hr_mgr_org (organization_id),
  INDEX idx_dept_hr_mgr_dept (department_id),
  INDEX idx_dept_hr_mgr_employee (hr_manager_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 6. EMPLOYEE PERSONAL INFORMATION
-- ============================================================================

CREATE TABLE IF NOT EXISTS employees_personal (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  organization_id BIGINT UNSIGNED NOT NULL,
  employee_id BIGINT UNSIGNED NOT NULL,
  dob DATE DEFAULT NULL,
  gender ENUM('male','female','other','undisclosed') DEFAULT NULL,
  marital_status ENUM('single','married','divorced','widowed','other') DEFAULT NULL,
  phone_primary VARCHAR(30) DEFAULT NULL,
  phone_secondary VARCHAR(30) DEFAULT NULL,
  address_line1 VARCHAR(200) DEFAULT NULL,
  address_line2 VARCHAR(200) DEFAULT NULL,
  city VARCHAR(100) DEFAULT NULL,
  state VARCHAR(100) DEFAULT NULL,
  postal_code VARCHAR(20) DEFAULT NULL,
  country VARCHAR(100) DEFAULT NULL,
  emergency_contact_name VARCHAR(120) DEFAULT NULL,
  emergency_contact_relation VARCHAR(60) DEFAULT NULL,
  emergency_contact_phone VARCHAR(30) DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_emp_personal_org_emp (organization_id, employee_id),
  INDEX idx_emp_personal_org_emp (organization_id, employee_id),
  CONSTRAINT fk_emp_personal_org FOREIGN KEY (organization_id) REFERENCES organizations(id),
  CONSTRAINT fk_emp_personal_employee FOREIGN KEY (employee_id) REFERENCES employees(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 7. EMPLOYEE EDUCATION
-- ============================================================================

CREATE TABLE IF NOT EXISTS employees_education (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  organization_id BIGINT UNSIGNED NOT NULL,
  employee_id BIGINT UNSIGNED NOT NULL,
  degree VARCHAR(150) NOT NULL,
  institution VARCHAR(200) NOT NULL,
  field_of_study VARCHAR(150) DEFAULT NULL,
  start_date DATE DEFAULT NULL,
  end_date DATE DEFAULT NULL,
  grade VARCHAR(50) DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_emp_edu_org FOREIGN KEY (organization_id) REFERENCES organizations(id),
  CONSTRAINT fk_emp_edu_employee FOREIGN KEY (employee_id) REFERENCES employees(id),
  INDEX idx_emp_edu_emp (employee_id),
  INDEX idx_emp_edu_org_emp (organization_id, employee_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 8. EMPLOYEE EMPLOYMENT HISTORY
-- ============================================================================

CREATE TABLE IF NOT EXISTS employees_employment_history (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  organization_id BIGINT UNSIGNED NOT NULL,
  employee_id BIGINT UNSIGNED NOT NULL,
  company_name VARCHAR(200) NOT NULL,
  job_title VARCHAR(150) NOT NULL,
  start_date DATE DEFAULT NULL,
  end_date DATE DEFAULT NULL,
  responsibilities TEXT DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_emp_hist_org FOREIGN KEY (organization_id) REFERENCES organizations(id),
  CONSTRAINT fk_emp_hist_employee FOREIGN KEY (employee_id) REFERENCES employees(id),
  INDEX idx_emp_hist_emp (employee_id),
  INDEX idx_emp_hist_org_emp (organization_id, employee_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 9. EMPLOYEE FAMILY
-- ============================================================================

CREATE TABLE IF NOT EXISTS employees_family (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  organization_id BIGINT UNSIGNED NOT NULL,
  employee_id BIGINT UNSIGNED NOT NULL,
  name VARCHAR(150) NOT NULL,
  relation VARCHAR(80) NOT NULL,
  dob DATE DEFAULT NULL,
  phone VARCHAR(30) DEFAULT NULL,
  dependent TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_emp_family_org FOREIGN KEY (organization_id) REFERENCES organizations(id),
  CONSTRAINT fk_emp_family_employee FOREIGN KEY (employee_id) REFERENCES employees(id),
  INDEX idx_emp_family_emp (employee_id),
  INDEX idx_emp_family_org_emp (organization_id, employee_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 10. ROLES (User management)
-- ============================================================================

CREATE TABLE IF NOT EXISTS roles (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  organization_id BIGINT UNSIGNED NOT NULL,
  name VARCHAR(100) NOT NULL,
  code VARCHAR(50) NOT NULL,
  description VARCHAR(500) DEFAULT NULL,
  permissions JSON DEFAULT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_roles_org FOREIGN KEY (organization_id) REFERENCES organizations(id),
  UNIQUE KEY uk_roles_org_code (organization_id, code),
  UNIQUE KEY uk_roles_org_name (organization_id, name),
  INDEX idx_roles_org (organization_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 11. USERS (After employees and roles)
-- ============================================================================

CREATE TABLE IF NOT EXISTS users (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  organization_id BIGINT UNSIGNED NOT NULL,
  username VARCHAR(100) NOT NULL,
  password VARCHAR(255) NOT NULL,
  employee_id BIGINT UNSIGNED NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  last_login TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_users_org FOREIGN KEY (organization_id) REFERENCES organizations(id),
  CONSTRAINT fk_users_employee FOREIGN KEY (employee_id) REFERENCES employees(id),
  UNIQUE KEY uk_users_org_username (organization_id, username),
  INDEX idx_users_org (organization_id),
  INDEX idx_users_employee (employee_id),
  INDEX idx_users_org_emp (organization_id, employee_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 12. USER ROLES (Junction table)
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_roles (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  role_id BIGINT UNSIGNED NOT NULL,
  assigned_by BIGINT UNSIGNED DEFAULT NULL,
  assigned_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_user_roles_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_user_roles_role FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
  CONSTRAINT fk_user_roles_assigned_by FOREIGN KEY (assigned_by) REFERENCES users(id),
  UNIQUE KEY uk_user_role (user_id, role_id),
  INDEX idx_user_roles_user (user_id),
  INDEX idx_user_roles_role (role_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 13. REFRESH TOKENS
-- ============================================================================

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  organization_id BIGINT UNSIGNED NOT NULL,
  token VARCHAR(255) NOT NULL COMMENT 'Hashed refresh token (SHA256)',
  device_info VARCHAR(500) DEFAULT NULL COMMENT 'Device/browser info for tracking',
  ip_address VARCHAR(45) DEFAULT NULL COMMENT 'IP address of the client',
  expires_at TIMESTAMP NOT NULL COMMENT 'Token expiration timestamp',
  revoked_at TIMESTAMP NULL DEFAULT NULL COMMENT 'Timestamp when token was revoked (NULL if active)',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_refresh_tokens_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_refresh_tokens_org FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
  INDEX idx_refresh_tokens_user (user_id),
  INDEX idx_refresh_tokens_org (organization_id),
  INDEX idx_refresh_tokens_token (token),
  INDEX idx_refresh_tokens_expires (expires_at),
  INDEX idx_refresh_tokens_active (token, revoked_at, expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 14. ATTENDANCE SHIFTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS attendance_shifts (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  organization_id BIGINT UNSIGNED NOT NULL,
  name VARCHAR(100) NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  is_overnight TINYINT(1) NOT NULL DEFAULT 0,
  grace_in_minutes SMALLINT NOT NULL DEFAULT 0,
  default_break_minutes SMALLINT NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT chk_shift_times CHECK (start_time <> end_time),
  CONSTRAINT fk_att_shifts_org FOREIGN KEY (organization_id) REFERENCES organizations(id),
  UNIQUE KEY uk_shift_org_name (organization_id, name),
  INDEX idx_shift_org (organization_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 15. ATTENDANCE SHIFT ASSIGNMENTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS attendance_shift_assignments (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  organization_id BIGINT UNSIGNED NOT NULL,
  employee_id BIGINT UNSIGNED NOT NULL,
  shift_id BIGINT UNSIGNED NOT NULL,
  effective_from DATE NOT NULL,
  effective_to DATE DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_shift_assign_org FOREIGN KEY (organization_id) REFERENCES organizations(id),
  CONSTRAINT fk_shift_assign_employee FOREIGN KEY (employee_id) REFERENCES employees(id),
  CONSTRAINT fk_shift_assign_shift FOREIGN KEY (shift_id) REFERENCES attendance_shifts(id),
  INDEX idx_shift_assign_emp_from_to (employee_id, effective_from, COALESCE(effective_to, '9999-12-31')),
  INDEX idx_shift_assign_org_emp (organization_id, employee_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 16. ATTENDANCE POLICIES
-- ============================================================================

CREATE TABLE IF NOT EXISTS attendance_policies (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  organization_id BIGINT UNSIGNED NOT NULL,
  name VARCHAR(150) NOT NULL,
  grace_in_minutes SMALLINT NOT NULL DEFAULT 0,
  late_threshold_minutes SMALLINT NOT NULL DEFAULT 0,
  half_day_threshold_minutes SMALLINT NOT NULL DEFAULT 240,
  overtime_minimum_minutes SMALLINT NOT NULL DEFAULT 30,
  rounding_policy ENUM('none','up','down','nearest') NOT NULL DEFAULT 'none',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_att_policies_org FOREIGN KEY (organization_id) REFERENCES organizations(id),
  UNIQUE KEY uk_policy_org_name (organization_id, name),
  INDEX idx_policy_org (organization_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 17. ATTENDANCE HOLIDAYS
-- ============================================================================

CREATE TABLE IF NOT EXISTS attendance_holidays (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  organization_id BIGINT UNSIGNED NOT NULL,
  holiday_date DATE NOT NULL,
  name VARCHAR(150) NOT NULL,
  type ENUM('public','company','regional') NOT NULL DEFAULT 'company',
  region VARCHAR(50) DEFAULT NULL,
  is_optional TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_att_holidays_org FOREIGN KEY (organization_id) REFERENCES organizations(id),
  UNIQUE KEY uk_holiday_org_date_region (organization_id, holiday_date, COALESCE(region, 'ALL')),
  INDEX idx_holiday_org (organization_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 18. ATTENDANCE LEAVES
-- ============================================================================

CREATE TABLE IF NOT EXISTS attendance_leaves (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  organization_id BIGINT UNSIGNED NOT NULL,
  employee_id BIGINT UNSIGNED NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  leave_type ENUM('casual','sick','earned','unpaid','other') NOT NULL,
  status ENUM('pending','approved','rejected','cancelled') NOT NULL DEFAULT 'pending',
  reason VARCHAR(500) DEFAULT NULL,
  approved_by BIGINT UNSIGNED DEFAULT NULL,
  approved_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_leave_org FOREIGN KEY (organization_id) REFERENCES organizations(id),
  CONSTRAINT fk_leave_employee FOREIGN KEY (employee_id) REFERENCES employees(id),
  INDEX idx_leave_emp_range (employee_id, start_date, end_date),
  INDEX idx_leave_status (status),
  INDEX idx_leave_org_emp (organization_id, employee_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 19. ATTENDANCE RECORDS
-- ============================================================================

CREATE TABLE IF NOT EXISTS attendance_records (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  organization_id BIGINT UNSIGNED NOT NULL,
  employee_id BIGINT UNSIGNED NOT NULL,
  work_date DATE NOT NULL,
  shift_id BIGINT UNSIGNED DEFAULT NULL,
  clock_in DATETIME NULL DEFAULT NULL,
  clock_out DATETIME NULL DEFAULT NULL,
  break_minutes SMALLINT NOT NULL DEFAULT 0,
  status ENUM('present','absent','half_day','on_leave','week_off','holiday') NOT NULL DEFAULT 'present',
  source ENUM('web','mobile','import','api') NOT NULL DEFAULT 'web',
  location_in POINT NULL,
  location_out POINT NULL,
  notes VARCHAR(500) DEFAULT NULL,
  approved_by BIGINT UNSIGNED DEFAULT NULL,
  approved_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  worked_minutes INT GENERATED ALWAYS AS (
    IF(clock_in IS NULL OR clock_out IS NULL,
       NULL,
       TIMESTAMPDIFF(MINUTE, clock_in, clock_out) - break_minutes)
  ) STORED,
  CONSTRAINT fk_att_records_org FOREIGN KEY (organization_id) REFERENCES organizations(id),
  CONSTRAINT fk_att_employee FOREIGN KEY (employee_id) REFERENCES employees(id),
  CONSTRAINT fk_att_shift FOREIGN KEY (shift_id) REFERENCES attendance_shifts(id),
  UNIQUE KEY uk_att_unique_day (organization_id, employee_id, work_date),
  INDEX idx_att_emp_date (organization_id, employee_id, work_date),
  INDEX idx_att_status (status),
  CONSTRAINT chk_clock_order CHECK (clock_out IS NULL OR clock_in IS NULL OR clock_out >= clock_in)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 20. ATTENDANCE EXCEPTIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS attendance_exceptions (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  organization_id BIGINT UNSIGNED NOT NULL,
  attendance_id BIGINT UNSIGNED NOT NULL,
  kind ENUM('missing_in','missing_out','regularization','other') NOT NULL,
  requested_by BIGINT UNSIGNED NOT NULL,
  requested_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  reviewer_id BIGINT UNSIGNED DEFAULT NULL,
  reviewed_at TIMESTAMP NULL DEFAULT NULL,
  comment VARCHAR(500) DEFAULT NULL,
  CONSTRAINT fk_exc_org FOREIGN KEY (organization_id) REFERENCES organizations(id),
  CONSTRAINT fk_exc_att FOREIGN KEY (attendance_id) REFERENCES attendance_records(id),
  INDEX idx_exc_att_status (attendance_id, status),
  INDEX idx_exc_org (organization_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 21. ATTENDANCE OVERTIME
-- ============================================================================

CREATE TABLE IF NOT EXISTS attendance_overtime (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  organization_id BIGINT UNSIGNED NOT NULL,
  employee_id BIGINT UNSIGNED NOT NULL,
  work_date DATE NOT NULL,
  minutes INT NOT NULL,
  status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  reason VARCHAR(300) DEFAULT NULL,
  approved_by BIGINT UNSIGNED DEFAULT NULL,
  approved_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_ot_org FOREIGN KEY (organization_id) REFERENCES organizations(id),
  CONSTRAINT fk_ot_employee FOREIGN KEY (employee_id) REFERENCES employees(id),
  UNIQUE KEY uk_ot_unique (organization_id, employee_id, work_date),
  INDEX idx_ot_emp_date (organization_id, employee_id, work_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 22. ATTENDANCE AUDIT LOGS
-- ============================================================================

CREATE TABLE IF NOT EXISTS attendance_audit_logs (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  organization_id BIGINT UNSIGNED NOT NULL,
  entity_type ENUM('record','leave','overtime','shift_assign','policy','holiday') NOT NULL,
  entity_id BIGINT UNSIGNED NOT NULL,
  action ENUM('create','update','approve','reject','import','clock_in','clock_out') NOT NULL,
  actor_id BIGINT UNSIGNED DEFAULT NULL,
  payload JSON DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_audit_org FOREIGN KEY (organization_id) REFERENCES organizations(id),
  INDEX idx_audit_entity (entity_type, entity_id),
  INDEX idx_audit_action_time (action, created_at),
  INDEX idx_audit_org (organization_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 23. ATTENDANCE WEEKLY OFF
-- ============================================================================

CREATE TABLE IF NOT EXISTS attendance_weekly_off (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  organization_id BIGINT UNSIGNED NOT NULL,
  year SMALLINT NOT NULL,
  month TINYINT NOT NULL COMMENT '1-12 for January-December',
  employee_id BIGINT UNSIGNED DEFAULT NULL COMMENT 'NULL for organization-wide, specific employee_id for employee-specific',
  department_id BIGINT UNSIGNED DEFAULT NULL COMMENT 'NULL for organization-wide or employee-specific, specific department_id for department-wide',
  days_of_week JSON NOT NULL COMMENT 'Array of day numbers: 0=Sunday, 1=Monday, ..., 6=Saturday',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_weekly_off_org FOREIGN KEY (organization_id) REFERENCES organizations(id),
  CONSTRAINT fk_weekly_off_employee FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
  CONSTRAINT fk_weekly_off_department FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE CASCADE,
  CONSTRAINT chk_weekly_off_scope CHECK (
    (employee_id IS NULL AND department_id IS NULL) OR
    (employee_id IS NOT NULL AND department_id IS NULL) OR
    (employee_id IS NULL AND department_id IS NOT NULL)
  ),
  CONSTRAINT chk_weekly_off_month CHECK (month >= 1 AND month <= 12),
  CONSTRAINT chk_weekly_off_year CHECK (year >= 2000 AND year <= 2100),
  UNIQUE KEY uk_weekly_off_org_year_month_emp_dept (organization_id, year, month, COALESCE(employee_id, 0), COALESCE(department_id, 0)),
  INDEX idx_weekly_off_org (organization_id),
  INDEX idx_weekly_off_employee (employee_id),
  INDEX idx_weekly_off_department (department_id),
  INDEX idx_weekly_off_year_month (year, month)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- Restore settings
-- ============================================================================

SET FOREIGN_KEY_CHECKS = @old_fk_checks;
SET SQL_MODE = @old_sql_mode;

-- ============================================================================
-- Schema creation complete!
-- ============================================================================

