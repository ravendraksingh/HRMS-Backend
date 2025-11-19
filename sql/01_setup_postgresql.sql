-- ============================================================================
-- HRMS Backend - Complete PostgreSQL Database Schema
-- Human Resource Management System - Backend
-- ============================================================================
-- This file contains the complete database schema for PostgreSQL 12+
-- Run this file to set up a fresh database from scratch
-- 
-- Usage: psql -U your_user -d your_database -f sql/01_setup_postgresql.sql
-- ============================================================================

-- Create custom ENUM types
DO $$ BEGIN
    CREATE TYPE gender_type AS ENUM ('male', 'female', 'other', 'undisclosed');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE marital_status_type AS ENUM ('single', 'married', 'divorced', 'widowed', 'other');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE leave_type_enum AS ENUM ('casual', 'sick', 'earned', 'unpaid', 'other');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE leave_status_enum AS ENUM ('pending', 'approved', 'rejected', 'cancelled');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE attendance_status_enum AS ENUM ('present', 'absent', 'half_day', 'on_leave', 'week_off', 'holiday');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE attendance_source_enum AS ENUM ('web', 'mobile', 'import', 'api');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE exception_kind_enum AS ENUM ('missing_in', 'missing_out', 'regularization', 'other');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE exception_status_enum AS ENUM ('pending', 'approved', 'rejected');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE overtime_status_enum AS ENUM ('pending', 'approved', 'rejected');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE rounding_policy_enum AS ENUM ('none', 'up', 'down', 'nearest');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE holiday_type_enum AS ENUM ('public', 'company', 'regional');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE audit_entity_type_enum AS ENUM ('record', 'leave', 'overtime', 'shift_assign', 'policy', 'holiday');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE audit_action_enum AS ENUM ('create', 'update', 'approve', 'reject', 'import', 'clock_in', 'clock_out');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ============================================================================
-- 1. ORGANIZATIONS (Core - Multi-tenant foundation)
-- ============================================================================

CREATE TABLE IF NOT EXISTS organizations (
  id BIGSERIAL PRIMARY KEY,
  code VARCHAR(50) NOT NULL,
  name VARCHAR(200) NOT NULL,
  logo_url VARCHAR(500) DEFAULT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uk_org_code UNIQUE (code),
  CONSTRAINT uk_org_name UNIQUE (name)
);

-- ============================================================================
-- 2. OFFICE LOCATIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS office_locations (
  id BIGSERIAL PRIMARY KEY,
  organization_id BIGINT NOT NULL,
  name VARCHAR(150) NOT NULL,
  address_line1 VARCHAR(200) NOT NULL,
  address_line2 VARCHAR(200) DEFAULT NULL,
  city VARCHAR(100) NOT NULL,
  state VARCHAR(100) NOT NULL,
  postal_code VARCHAR(20) NOT NULL,
  country VARCHAR(100) NOT NULL,
  phone VARCHAR(30) DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_locations_org FOREIGN KEY (organization_id) REFERENCES organizations(id),
  CONSTRAINT uk_location_org_name UNIQUE (organization_id, name)
);

CREATE INDEX IF NOT EXISTS idx_location_org ON office_locations(organization_id);

-- ============================================================================
-- 3. DEPARTMENTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS departments (
  id BIGSERIAL PRIMARY KEY,
  organization_id BIGINT NOT NULL,
  department_code VARCHAR(50) NOT NULL,
  name VARCHAR(150) NOT NULL,
  department_head BIGINT DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_departments_org FOREIGN KEY (organization_id) REFERENCES organizations(id),
  CONSTRAINT uk_dept_org_code UNIQUE (organization_id, department_code),
  CONSTRAINT uk_dept_org_name UNIQUE (organization_id, name)
);

CREATE INDEX IF NOT EXISTS idx_dept_org ON departments(organization_id);
CREATE INDEX IF NOT EXISTS idx_dept_code ON departments(department_code);
CREATE INDEX IF NOT EXISTS idx_dept_head ON departments(department_head);

-- ============================================================================
-- 4. EMPLOYEES (Core table - referenced by many others)
-- ============================================================================

CREATE TABLE IF NOT EXISTS employees (
  id BIGSERIAL PRIMARY KEY,
  organization_id BIGINT NOT NULL,
  employee_code VARCHAR(50) NOT NULL,
  name VARCHAR(150) NOT NULL,
  email VARCHAR(200) NOT NULL,
  manager_id BIGINT DEFAULT NULL,
  hr_manager_id BIGINT DEFAULT NULL,
  department_id BIGINT DEFAULT NULL,
  location_id BIGINT DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_employees_org FOREIGN KEY (organization_id) REFERENCES organizations(id),
  CONSTRAINT fk_employees_manager FOREIGN KEY (manager_id) REFERENCES employees(id),
  CONSTRAINT fk_employees_hr_manager FOREIGN KEY (hr_manager_id) REFERENCES employees(id) ON DELETE SET NULL,
  CONSTRAINT fk_employees_department FOREIGN KEY (department_id) REFERENCES departments(id),
  CONSTRAINT fk_employees_location FOREIGN KEY (location_id) REFERENCES office_locations(id),
  CONSTRAINT uk_employees_org_code UNIQUE (organization_id, employee_code)
);

CREATE INDEX IF NOT EXISTS idx_employees_org ON employees(organization_id);
CREATE INDEX IF NOT EXISTS idx_employees_code ON employees(employee_code);
CREATE INDEX IF NOT EXISTS idx_employees_manager_id ON employees(manager_id);
CREATE INDEX IF NOT EXISTS idx_employees_hr_manager_id ON employees(hr_manager_id);
CREATE INDEX IF NOT EXISTS idx_employees_department_id ON employees(department_id);
CREATE INDEX IF NOT EXISTS idx_employees_location ON employees(location_id);

-- Add self-referencing foreign key for department_head after employees table exists
ALTER TABLE departments
  ADD CONSTRAINT fk_departments_head FOREIGN KEY (department_head) REFERENCES employees(id) ON DELETE SET NULL;

-- ============================================================================
-- 5. DEPARTMENT HR MANAGERS (Junction table)
-- ============================================================================

CREATE TABLE IF NOT EXISTS department_hr_managers (
  id BIGSERIAL PRIMARY KEY,
  organization_id BIGINT NOT NULL,
  department_id BIGINT NOT NULL,
  hr_manager_id BIGINT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_dept_hr_mgr_org FOREIGN KEY (organization_id) REFERENCES organizations(id),
  CONSTRAINT fk_dept_hr_mgr_dept FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE CASCADE,
  CONSTRAINT fk_dept_hr_mgr_employee FOREIGN KEY (hr_manager_id) REFERENCES employees(id) ON DELETE CASCADE,
  CONSTRAINT uk_dept_hr_mgr UNIQUE (department_id, hr_manager_id)
);

CREATE INDEX IF NOT EXISTS idx_dept_hr_mgr_org ON department_hr_managers(organization_id);
CREATE INDEX IF NOT EXISTS idx_dept_hr_mgr_dept ON department_hr_managers(department_id);
CREATE INDEX IF NOT EXISTS idx_dept_hr_mgr_employee ON department_hr_managers(hr_manager_id);

-- ============================================================================
-- 6. EMPLOYEE PERSONAL INFORMATION
-- ============================================================================

CREATE TABLE IF NOT EXISTS employees_personal (
  id BIGSERIAL PRIMARY KEY,
  organization_id BIGINT NOT NULL,
  employee_id BIGINT NOT NULL,
  dob DATE DEFAULT NULL,
  gender gender_type DEFAULT NULL,
  marital_status marital_status_type DEFAULT NULL,
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
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_emp_personal_org FOREIGN KEY (organization_id) REFERENCES organizations(id),
  CONSTRAINT fk_emp_personal_employee FOREIGN KEY (employee_id) REFERENCES employees(id),
  CONSTRAINT uk_emp_personal_org_emp UNIQUE (organization_id, employee_id)
);

CREATE INDEX IF NOT EXISTS idx_emp_personal_org_emp ON employees_personal(organization_id, employee_id);

-- ============================================================================
-- 7. EMPLOYEE EDUCATION
-- ============================================================================

CREATE TABLE IF NOT EXISTS employees_education (
  id BIGSERIAL PRIMARY KEY,
  organization_id BIGINT NOT NULL,
  employee_id BIGINT NOT NULL,
  degree VARCHAR(150) NOT NULL,
  institution VARCHAR(200) NOT NULL,
  field_of_study VARCHAR(150) DEFAULT NULL,
  start_date DATE DEFAULT NULL,
  end_date DATE DEFAULT NULL,
  grade VARCHAR(50) DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_emp_edu_org FOREIGN KEY (organization_id) REFERENCES organizations(id),
  CONSTRAINT fk_emp_edu_employee FOREIGN KEY (employee_id) REFERENCES employees(id)
);

CREATE INDEX IF NOT EXISTS idx_emp_edu_emp ON employees_education(employee_id);
CREATE INDEX IF NOT EXISTS idx_emp_edu_org_emp ON employees_education(organization_id, employee_id);

-- ============================================================================
-- 8. EMPLOYEE EMPLOYMENT HISTORY
-- ============================================================================

CREATE TABLE IF NOT EXISTS employees_employment_history (
  id BIGSERIAL PRIMARY KEY,
  organization_id BIGINT NOT NULL,
  employee_id BIGINT NOT NULL,
  company_name VARCHAR(200) NOT NULL,
  job_title VARCHAR(150) NOT NULL,
  start_date DATE DEFAULT NULL,
  end_date DATE DEFAULT NULL,
  responsibilities TEXT DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_emp_hist_org FOREIGN KEY (organization_id) REFERENCES organizations(id),
  CONSTRAINT fk_emp_hist_employee FOREIGN KEY (employee_id) REFERENCES employees(id)
);

CREATE INDEX IF NOT EXISTS idx_emp_hist_emp ON employees_employment_history(employee_id);
CREATE INDEX IF NOT EXISTS idx_emp_hist_org_emp ON employees_employment_history(organization_id, employee_id);

-- ============================================================================
-- 9. EMPLOYEE FAMILY
-- ============================================================================

CREATE TABLE IF NOT EXISTS employees_family (
  id BIGSERIAL PRIMARY KEY,
  organization_id BIGINT NOT NULL,
  employee_id BIGINT NOT NULL,
  name VARCHAR(150) NOT NULL,
  relation VARCHAR(80) NOT NULL,
  dob DATE DEFAULT NULL,
  phone VARCHAR(30) DEFAULT NULL,
  dependent BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_emp_family_org FOREIGN KEY (organization_id) REFERENCES organizations(id),
  CONSTRAINT fk_emp_family_employee FOREIGN KEY (employee_id) REFERENCES employees(id)
);

CREATE INDEX IF NOT EXISTS idx_emp_family_emp ON employees_family(employee_id);
CREATE INDEX IF NOT EXISTS idx_emp_family_org_emp ON employees_family(organization_id, employee_id);

-- ============================================================================
-- 10. ROLES (User management)
-- ============================================================================

CREATE TABLE IF NOT EXISTS roles (
  id BIGSERIAL PRIMARY KEY,
  organization_id BIGINT NOT NULL,
  name VARCHAR(100) NOT NULL,
  code VARCHAR(50) NOT NULL,
  description VARCHAR(500) DEFAULT NULL,
  permissions JSONB DEFAULT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_roles_org FOREIGN KEY (organization_id) REFERENCES organizations(id),
  CONSTRAINT uk_roles_org_code UNIQUE (organization_id, code),
  CONSTRAINT uk_roles_org_name UNIQUE (organization_id, name)
);

CREATE INDEX IF NOT EXISTS idx_roles_org ON roles(organization_id);

-- ============================================================================
-- 11. USERS (After employees and roles)
-- ============================================================================

CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,
  organization_id BIGINT NOT NULL,
  username VARCHAR(100) NOT NULL,
  password VARCHAR(255) NOT NULL,
  employee_id BIGINT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  last_login TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_users_org FOREIGN KEY (organization_id) REFERENCES organizations(id),
  CONSTRAINT fk_users_employee FOREIGN KEY (employee_id) REFERENCES employees(id),
  CONSTRAINT uk_users_org_username UNIQUE (organization_id, username)
);

CREATE INDEX IF NOT EXISTS idx_users_org ON users(organization_id);
CREATE INDEX IF NOT EXISTS idx_users_employee ON users(employee_id);
CREATE INDEX IF NOT EXISTS idx_users_org_emp ON users(organization_id, employee_id);

-- ============================================================================
-- 12. USER ROLES (Junction table)
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_roles (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL,
  role_id BIGINT NOT NULL,
  assigned_by BIGINT DEFAULT NULL,
  assigned_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_user_roles_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_user_roles_role FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
  CONSTRAINT fk_user_roles_assigned_by FOREIGN KEY (assigned_by) REFERENCES users(id),
  CONSTRAINT uk_user_role UNIQUE (user_id, role_id)
);

CREATE INDEX IF NOT EXISTS idx_user_roles_user ON user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON user_roles(role_id);

-- ============================================================================
-- 13. REFRESH TOKENS
-- ============================================================================

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL,
  organization_id BIGINT NOT NULL,
  token VARCHAR(255) NOT NULL,
  device_info VARCHAR(500) DEFAULT NULL,
  ip_address VARCHAR(45) DEFAULT NULL,
  expires_at TIMESTAMP NOT NULL,
  revoked_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_refresh_tokens_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_refresh_tokens_org FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_org ON refresh_tokens(organization_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token ON refresh_tokens(token);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires ON refresh_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_active ON refresh_tokens(token, revoked_at, expires_at);

-- ============================================================================
-- 14. ATTENDANCE SHIFTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS attendance_shifts (
  id BIGSERIAL PRIMARY KEY,
  organization_id BIGINT NOT NULL,
  name VARCHAR(100) NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  is_overnight BOOLEAN NOT NULL DEFAULT FALSE,
  grace_in_minutes SMALLINT NOT NULL DEFAULT 0,
  default_break_minutes SMALLINT NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_shift_times CHECK (start_time <> end_time),
  CONSTRAINT fk_att_shifts_org FOREIGN KEY (organization_id) REFERENCES organizations(id),
  CONSTRAINT uk_shift_org_name UNIQUE (organization_id, name)
);

CREATE INDEX IF NOT EXISTS idx_shift_org ON attendance_shifts(organization_id);

-- ============================================================================
-- 15. ATTENDANCE SHIFT ASSIGNMENTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS attendance_shift_assignments (
  id BIGSERIAL PRIMARY KEY,
  organization_id BIGINT NOT NULL,
  employee_id BIGINT NOT NULL,
  shift_id BIGINT NOT NULL,
  effective_from DATE NOT NULL,
  effective_to DATE DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_shift_assign_org FOREIGN KEY (organization_id) REFERENCES organizations(id),
  CONSTRAINT fk_shift_assign_employee FOREIGN KEY (employee_id) REFERENCES employees(id),
  CONSTRAINT fk_shift_assign_shift FOREIGN KEY (shift_id) REFERENCES attendance_shifts(id)
);

CREATE INDEX IF NOT EXISTS idx_shift_assign_emp_from_to ON attendance_shift_assignments(employee_id, effective_from, COALESCE(effective_to, '9999-12-31'::date));
-- Note: PostgreSQL allows COALESCE in indexes, but for better performance, consider a partial index if needed
CREATE INDEX IF NOT EXISTS idx_shift_assign_org_emp ON attendance_shift_assignments(organization_id, employee_id);

-- ============================================================================
-- 16. ATTENDANCE POLICIES
-- ============================================================================

CREATE TABLE IF NOT EXISTS attendance_policies (
  id BIGSERIAL PRIMARY KEY,
  organization_id BIGINT NOT NULL,
  name VARCHAR(150) NOT NULL,
  grace_in_minutes SMALLINT NOT NULL DEFAULT 0,
  late_threshold_minutes SMALLINT NOT NULL DEFAULT 0,
  half_day_threshold_minutes SMALLINT NOT NULL DEFAULT 240,
  overtime_minimum_minutes SMALLINT NOT NULL DEFAULT 30,
  rounding_policy rounding_policy_enum NOT NULL DEFAULT 'none',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_att_policies_org FOREIGN KEY (organization_id) REFERENCES organizations(id),
  CONSTRAINT uk_policy_org_name UNIQUE (organization_id, name)
);

CREATE INDEX IF NOT EXISTS idx_policy_org ON attendance_policies(organization_id);

-- ============================================================================
-- 17. ATTENDANCE HOLIDAYS
-- ============================================================================

CREATE TABLE IF NOT EXISTS attendance_holidays (
  id BIGSERIAL PRIMARY KEY,
  organization_id BIGINT NOT NULL,
  holiday_date DATE NOT NULL,
  name VARCHAR(150) NOT NULL,
  type holiday_type_enum NOT NULL DEFAULT 'company',
  region VARCHAR(50) DEFAULT NULL,
  is_optional BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_att_holidays_org FOREIGN KEY (organization_id) REFERENCES organizations(id)
);

-- Unique constraint using index with COALESCE
CREATE UNIQUE INDEX IF NOT EXISTS uk_holiday_org_date_region 
  ON attendance_holidays(organization_id, holiday_date, COALESCE(region, ''));

CREATE INDEX IF NOT EXISTS idx_holiday_org ON attendance_holidays(organization_id);

-- ============================================================================
-- 18. ATTENDANCE LEAVES
-- ============================================================================

CREATE TABLE IF NOT EXISTS attendance_leaves (
  id BIGSERIAL PRIMARY KEY,
  organization_id BIGINT NOT NULL,
  employee_id BIGINT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  leave_type leave_type_enum NOT NULL,
  status leave_status_enum NOT NULL DEFAULT 'pending',
  reason VARCHAR(500) DEFAULT NULL,
  approved_by BIGINT DEFAULT NULL,
  approved_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_leave_org FOREIGN KEY (organization_id) REFERENCES organizations(id),
  CONSTRAINT fk_leave_employee FOREIGN KEY (employee_id) REFERENCES employees(id)
);

CREATE INDEX IF NOT EXISTS idx_leave_emp_range ON attendance_leaves(employee_id, start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_leave_status ON attendance_leaves(status);
CREATE INDEX IF NOT EXISTS idx_leave_org_emp ON attendance_leaves(organization_id, employee_id);

-- ============================================================================
-- 19. ATTENDANCE RECORDS
-- ============================================================================

CREATE TABLE IF NOT EXISTS attendance_records (
  id BIGSERIAL PRIMARY KEY,
  organization_id BIGINT NOT NULL,
  employee_id BIGINT NOT NULL,
  work_date DATE NOT NULL,
  shift_id BIGINT DEFAULT NULL,
  clock_in TIMESTAMP NULL DEFAULT NULL,
  clock_out TIMESTAMP NULL DEFAULT NULL,
  break_minutes SMALLINT NOT NULL DEFAULT 0,
  status attendance_status_enum NOT NULL DEFAULT 'present',
  source attendance_source_enum NOT NULL DEFAULT 'web',
  location_in POINT NULL,
  location_out POINT NULL,
  notes VARCHAR(500) DEFAULT NULL,
  approved_by BIGINT DEFAULT NULL,
  approved_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  worked_minutes INT GENERATED ALWAYS AS (
    CASE 
      WHEN clock_in IS NULL OR clock_out IS NULL THEN NULL
      ELSE EXTRACT(EPOCH FROM (clock_out - clock_in))::INT / 60 - break_minutes
    END
  ) STORED,
  CONSTRAINT fk_att_records_org FOREIGN KEY (organization_id) REFERENCES organizations(id),
  CONSTRAINT fk_att_employee FOREIGN KEY (employee_id) REFERENCES employees(id),
  CONSTRAINT fk_att_shift FOREIGN KEY (shift_id) REFERENCES attendance_shifts(id),
  CONSTRAINT uk_att_unique_day UNIQUE (organization_id, employee_id, work_date),
  CONSTRAINT chk_clock_order CHECK (clock_out IS NULL OR clock_in IS NULL OR clock_out >= clock_in)
);

CREATE INDEX IF NOT EXISTS idx_att_emp_date ON attendance_records(organization_id, employee_id, work_date);
CREATE INDEX IF NOT EXISTS idx_att_status ON attendance_records(status);

-- ============================================================================
-- 20. ATTENDANCE EXCEPTIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS attendance_exceptions (
  id BIGSERIAL PRIMARY KEY,
  organization_id BIGINT NOT NULL,
  attendance_id BIGINT NOT NULL,
  kind exception_kind_enum NOT NULL,
  requested_by BIGINT NOT NULL,
  requested_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  status exception_status_enum NOT NULL DEFAULT 'pending',
  reviewer_id BIGINT DEFAULT NULL,
  reviewed_at TIMESTAMP NULL DEFAULT NULL,
  comment VARCHAR(500) DEFAULT NULL,
  CONSTRAINT fk_exc_org FOREIGN KEY (organization_id) REFERENCES organizations(id),
  CONSTRAINT fk_exc_att FOREIGN KEY (attendance_id) REFERENCES attendance_records(id)
);

CREATE INDEX IF NOT EXISTS idx_exc_att_status ON attendance_exceptions(attendance_id, status);
CREATE INDEX IF NOT EXISTS idx_exc_org ON attendance_exceptions(organization_id);

-- ============================================================================
-- 21. ATTENDANCE OVERTIME
-- ============================================================================

CREATE TABLE IF NOT EXISTS attendance_overtime (
  id BIGSERIAL PRIMARY KEY,
  organization_id BIGINT NOT NULL,
  employee_id BIGINT NOT NULL,
  work_date DATE NOT NULL,
  minutes INT NOT NULL,
  status overtime_status_enum NOT NULL DEFAULT 'pending',
  reason VARCHAR(300) DEFAULT NULL,
  approved_by BIGINT DEFAULT NULL,
  approved_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_ot_org FOREIGN KEY (organization_id) REFERENCES organizations(id),
  CONSTRAINT fk_ot_employee FOREIGN KEY (employee_id) REFERENCES employees(id),
  CONSTRAINT uk_ot_unique UNIQUE (organization_id, employee_id, work_date)
);

CREATE INDEX IF NOT EXISTS idx_ot_emp_date ON attendance_overtime(organization_id, employee_id, work_date);

-- ============================================================================
-- 22. ATTENDANCE AUDIT LOGS
-- ============================================================================

CREATE TABLE IF NOT EXISTS attendance_audit_logs (
  id BIGSERIAL PRIMARY KEY,
  organization_id BIGINT NOT NULL,
  entity_type audit_entity_type_enum NOT NULL,
  entity_id BIGINT NOT NULL,
  action audit_action_enum NOT NULL,
  actor_id BIGINT DEFAULT NULL,
  payload JSONB DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_audit_org FOREIGN KEY (organization_id) REFERENCES organizations(id)
);

CREATE INDEX IF NOT EXISTS idx_audit_entity ON attendance_audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_action_time ON attendance_audit_logs(action, created_at);
CREATE INDEX IF NOT EXISTS idx_audit_org ON attendance_audit_logs(organization_id);

-- ============================================================================
-- 23. ATTENDANCE WEEKLY OFF
-- ============================================================================

CREATE TABLE IF NOT EXISTS attendance_weekly_off (
  id BIGSERIAL PRIMARY KEY,
  organization_id BIGINT NOT NULL,
  year SMALLINT NOT NULL,
  month SMALLINT NOT NULL,
  employee_id BIGINT DEFAULT NULL,
  department_id BIGINT DEFAULT NULL,
  days_of_week JSONB NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_weekly_off_org FOREIGN KEY (organization_id) REFERENCES organizations(id),
  CONSTRAINT fk_weekly_off_employee FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
  CONSTRAINT fk_weekly_off_department FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE CASCADE,
  CONSTRAINT chk_weekly_off_scope CHECK (
    (employee_id IS NULL AND department_id IS NULL) OR
    (employee_id IS NOT NULL AND department_id IS NULL) OR
    (employee_id IS NULL AND department_id IS NOT NULL)
  ),
  CONSTRAINT chk_weekly_off_month CHECK (month >= 1 AND month <= 12),
  CONSTRAINT chk_weekly_off_year CHECK (year >= 2000 AND year <= 2100)
);

-- Unique constraint using index with COALESCE
CREATE UNIQUE INDEX IF NOT EXISTS uk_weekly_off_org_year_month_emp_dept 
  ON attendance_weekly_off(organization_id, year, month, COALESCE(employee_id, 0), COALESCE(department_id, 0));

CREATE INDEX IF NOT EXISTS idx_weekly_off_org ON attendance_weekly_off(organization_id);
CREATE INDEX IF NOT EXISTS idx_weekly_off_employee ON attendance_weekly_off(employee_id);
CREATE INDEX IF NOT EXISTS idx_weekly_off_department ON attendance_weekly_off(department_id);
CREATE INDEX IF NOT EXISTS idx_weekly_off_year_month ON attendance_weekly_off(year, month);

-- ============================================================================
-- Create trigger function for updated_at timestamp
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at trigger to all tables
CREATE TRIGGER update_organizations_updated_at BEFORE UPDATE ON organizations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_office_locations_updated_at BEFORE UPDATE ON office_locations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_departments_updated_at BEFORE UPDATE ON departments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_employees_updated_at BEFORE UPDATE ON employees
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_department_hr_managers_updated_at BEFORE UPDATE ON department_hr_managers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_employees_personal_updated_at BEFORE UPDATE ON employees_personal
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_employees_education_updated_at BEFORE UPDATE ON employees_education
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_employees_employment_history_updated_at BEFORE UPDATE ON employees_employment_history
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_employees_family_updated_at BEFORE UPDATE ON employees_family
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_roles_updated_at BEFORE UPDATE ON roles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_refresh_tokens_updated_at BEFORE UPDATE ON refresh_tokens
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_attendance_shifts_updated_at BEFORE UPDATE ON attendance_shifts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_attendance_shift_assignments_updated_at BEFORE UPDATE ON attendance_shift_assignments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_attendance_policies_updated_at BEFORE UPDATE ON attendance_policies
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_attendance_holidays_updated_at BEFORE UPDATE ON attendance_holidays
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_attendance_leaves_updated_at BEFORE UPDATE ON attendance_leaves
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_attendance_records_updated_at BEFORE UPDATE ON attendance_records
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_attendance_weekly_off_updated_at BEFORE UPDATE ON attendance_weekly_off
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- Schema creation complete!
-- ============================================================================

