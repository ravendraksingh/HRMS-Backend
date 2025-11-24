-- ============================================================================
-- Employees Module Schema
-- ============================================================================
-- This file contains the employee-related tables
-- ============================================================================

-- ============================================================================
-- 1. EMPLOYEES
-- ============================================================================

CREATE TABLE IF NOT EXISTS employees (
  empid VARCHAR(10) NOT NULL PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  email VARCHAR(200) NOT NULL,
  doj DATE DEFAULT NULL,
  manager_id VARCHAR(10) DEFAULT NULL,
  hr_manager_id VARCHAR(10) DEFAULT NULL,
  department_id VARCHAR(10) DEFAULT NULL,
  location_id TINYINT UNSIGNED DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_employee_email (email),
  INDEX idx_employee_manager (manager_id),
  INDEX idx_employee_hr_manager (hr_manager_id),
  INDEX idx_employee_department (department_id),
  INDEX idx_employee_location (location_id),
  CONSTRAINT fk_employee_manager FOREIGN KEY (manager_id) REFERENCES employees(empid) ON DELETE SET NULL,
  CONSTRAINT fk_employee_hr_manager FOREIGN KEY (hr_manager_id) REFERENCES employees(empid) ON DELETE SET NULL,
  CONSTRAINT fk_employee_department FOREIGN KEY (department_id) REFERENCES departments(deptid) ON DELETE SET NULL,
  CONSTRAINT fk_employee_location FOREIGN KEY (location_id) REFERENCES office_locations(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 2. EMPLOYEE PERSONAL DETAILS
-- ============================================================================

CREATE TABLE IF NOT EXISTS employee_personal_details (
  empid VARCHAR(10) NOT NULL PRIMARY KEY,
  phone VARCHAR(20) DEFAULT NULL,
  alternate_phone VARCHAR(20) DEFAULT NULL,
  date_of_birth DATE DEFAULT NULL,
  gender VARCHAR(10) DEFAULT NULL COMMENT 'M, F, Other',
  marital_status VARCHAR(20) DEFAULT NULL COMMENT 'Single, Married, Divorced, Widowed',
  blood_group VARCHAR(5) DEFAULT NULL,
  emergency_contact_name VARCHAR(150) DEFAULT NULL,
  emergency_contact_phone VARCHAR(20) DEFAULT NULL,
  emergency_contact_relation VARCHAR(50) DEFAULT NULL,
  permanent_address_line1 VARCHAR(200) DEFAULT NULL,
  permanent_address_line2 VARCHAR(200) DEFAULT NULL,
  permanent_city VARCHAR(100) DEFAULT NULL,
  permanent_state VARCHAR(100) DEFAULT NULL,
  permanent_postal_code VARCHAR(20) DEFAULT NULL,
  permanent_country VARCHAR(100) DEFAULT NULL,
  current_address_line1 VARCHAR(200) DEFAULT NULL,
  current_address_line2 VARCHAR(200) DEFAULT NULL,
  current_city VARCHAR(100) DEFAULT NULL,
  current_state VARCHAR(100) DEFAULT NULL,
  current_postal_code VARCHAR(20) DEFAULT NULL,
  current_country VARCHAR(100) DEFAULT NULL,
  pan_number VARCHAR(20) DEFAULT NULL,
  aadhaar_number VARCHAR(20) DEFAULT NULL,
  passport_number VARCHAR(50) DEFAULT NULL,
  passport_expiry DATE DEFAULT NULL,
  driving_license_number VARCHAR(50) DEFAULT NULL,
  driving_license_expiry DATE DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_personal_details_employee FOREIGN KEY (empid) REFERENCES employees(empid) ON DELETE CASCADE,
  INDEX idx_personal_pan (pan_number),
  INDEX idx_personal_aadhaar (aadhaar_number),
  INDEX idx_personal_passport (passport_number)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 3. EMPLOYEE EMPLOYMENT HISTORY
-- ============================================================================

CREATE TABLE IF NOT EXISTS employee_employment_history (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  empid VARCHAR(10) NOT NULL,
  company_name VARCHAR(200) NOT NULL,
  designation VARCHAR(150) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE DEFAULT NULL COMMENT 'NULL if current employment',
  job_description TEXT DEFAULT NULL,
  reason_for_leaving VARCHAR(500) DEFAULT NULL,
  last_salary DECIMAL(10, 2) DEFAULT NULL,
  supervisor_name VARCHAR(150) DEFAULT NULL,
  supervisor_contact VARCHAR(50) DEFAULT NULL,
  is_verified VARCHAR(1) DEFAULT 'N' COMMENT 'Y if verified, N if not',
  verified_by VARCHAR(10) DEFAULT NULL COMMENT 'Employee ID of verifier',
  verified_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_employment_history_employee FOREIGN KEY (empid) REFERENCES employees(empid) ON DELETE CASCADE,
  CONSTRAINT fk_employment_history_verified_by FOREIGN KEY (verified_by) REFERENCES employees(empid) ON DELETE SET NULL,
  INDEX idx_employment_employee (empid),
  INDEX idx_employment_dates (start_date, end_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 4. EMPLOYEE EDUCATIONAL DETAILS
-- ============================================================================

CREATE TABLE IF NOT EXISTS employee_educational_details (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  empid VARCHAR(10) NOT NULL,
  qualification_type VARCHAR(50) NOT NULL COMMENT '10th, 12th, Diploma, Graduation, Post-Graduation, PhD, etc.',
  degree VARCHAR(200) DEFAULT NULL COMMENT 'B.Tech, MBA, etc.',
  specialization VARCHAR(200) DEFAULT NULL COMMENT 'Computer Science, Finance, etc.',
  institution_name VARCHAR(300) NOT NULL,
  university_board VARCHAR(200) DEFAULT NULL,
  start_date DATE DEFAULT NULL,
  end_date DATE DEFAULT NULL,
  percentage DECIMAL(5, 2) DEFAULT NULL COMMENT 'Percentage or CGPA',
  cgpa DECIMAL(4, 2) DEFAULT NULL,
  grade VARCHAR(10) DEFAULT NULL,
  is_verified VARCHAR(1) DEFAULT 'N' COMMENT 'Y if verified, N if not',
  verified_by VARCHAR(10) DEFAULT NULL COMMENT 'Employee ID of verifier',
  verified_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_educational_details_employee FOREIGN KEY (empid) REFERENCES employees(empid) ON DELETE CASCADE,
  CONSTRAINT fk_educational_details_verified_by FOREIGN KEY (verified_by) REFERENCES employees(empid) ON DELETE SET NULL,
  INDEX idx_educational_employee (empid),
  INDEX idx_educational_qualification (qualification_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 5. EMPLOYEE FAMILY AND DEPENDENTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS employee_family_dependents (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  empid VARCHAR(10) NOT NULL,
  relationship VARCHAR(50) NOT NULL COMMENT 'Spouse, Child, Parent, Sibling, Father-in-law, Mother-in-law, etc.',
  name VARCHAR(150) NOT NULL,
  date_of_birth DATE DEFAULT NULL,
  gender VARCHAR(10) DEFAULT NULL COMMENT 'M, F, Other',
  is_dependent VARCHAR(1) DEFAULT 'N' COMMENT 'Y if dependent, N if not',
  occupation VARCHAR(200) DEFAULT NULL,
  employer_name VARCHAR(200) DEFAULT NULL,
  phone VARCHAR(20) DEFAULT NULL,
  email VARCHAR(200) DEFAULT NULL,
  aadhaar_number VARCHAR(20) DEFAULT NULL,
  pan_number VARCHAR(20) DEFAULT NULL,
  passport_number VARCHAR(50) DEFAULT NULL,
  passport_expiry DATE DEFAULT NULL,
  is_covered_under_insurance VARCHAR(1) DEFAULT 'N' COMMENT 'Y if covered under employee insurance, N if not',
  insurance_policy_number VARCHAR(100) DEFAULT NULL,
  address_line1 VARCHAR(200) DEFAULT NULL,
  address_line2 VARCHAR(200) DEFAULT NULL,
  city VARCHAR(100) DEFAULT NULL,
  state VARCHAR(100) DEFAULT NULL,
  postal_code VARCHAR(20) DEFAULT NULL,
  country VARCHAR(100) DEFAULT NULL,
  is_emergency_contact VARCHAR(1) DEFAULT 'N' COMMENT 'Y if emergency contact, N if not',
  notes TEXT DEFAULT NULL COMMENT 'Additional notes or special requirements',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_family_dependents_employee FOREIGN KEY (empid) REFERENCES employees(empid) ON DELETE CASCADE,
  INDEX idx_family_employee (empid),
  INDEX idx_family_relationship (relationship),
  INDEX idx_family_dependent (is_dependent),
  INDEX idx_family_emergency (is_emergency_contact)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 6. EMPLOYEE JOB INFORMATION
-- ============================================================================
-- Current job information within the organization (one record per employee)

CREATE TABLE IF NOT EXISTS employee_job_information (
  empid VARCHAR(10) NOT NULL PRIMARY KEY,
  job_title VARCHAR(150) NOT NULL COMMENT 'Current job title/designation',
  employment_type VARCHAR(50) DEFAULT 'full_time' COMMENT 'full_time, part_time, contract, intern, consultant',
  employment_status VARCHAR(50) DEFAULT 'active' COMMENT 'active, inactive, on_leave, terminated, resigned',
  date_of_joining DATE NOT NULL COMMENT 'Date of joining the organization',
  probation_start_date DATE DEFAULT NULL COMMENT 'Probation period start date',
  probation_end_date DATE DEFAULT NULL COMMENT 'Probation period end date',
  probation_status VARCHAR(50) DEFAULT NULL COMMENT 'pending, completed, extended, terminated',
  confirmation_date DATE DEFAULT NULL COMMENT 'Date when employee was confirmed',
  shiftid VARCHAR(10) DEFAULT NULL COMMENT 'Assigned shift ID',
  cost_center VARCHAR(100) DEFAULT NULL COMMENT 'Cost center code',
  employee_category VARCHAR(100) DEFAULT NULL COMMENT 'Category/classification of employee',
  grade VARCHAR(50) DEFAULT NULL COMMENT 'Employee grade',
  level VARCHAR(50) DEFAULT NULL COMMENT 'Employee level',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_job_information_employee FOREIGN KEY (empid) REFERENCES employees(empid) ON DELETE CASCADE,
  INDEX idx_job_info_employment_status (employment_status),
  INDEX idx_job_info_employment_type (employment_type),
  INDEX idx_job_info_shift (shiftid)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 7. EMPLOYEE JOB HISTORY
-- ============================================================================
-- Job history within the current organization (promotions, transfers, role changes)

CREATE TABLE IF NOT EXISTS employee_job_history (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  empid VARCHAR(10) NOT NULL,
  change_type VARCHAR(50) NOT NULL COMMENT 'PROMOTION, TRANSFER, DEMOTION, ROLE_CHANGE, DEPARTMENT_CHANGE, MANAGER_CHANGE',
  previous_job_title VARCHAR(150) DEFAULT NULL COMMENT 'Previous job title before change',
  new_job_title VARCHAR(150) NOT NULL COMMENT 'New job title after change',
  previous_department_id VARCHAR(10) DEFAULT NULL COMMENT 'Previous department ID',
  new_department_id VARCHAR(10) DEFAULT NULL COMMENT 'New department ID',
  previous_manager_id VARCHAR(10) DEFAULT NULL COMMENT 'Previous manager employee ID',
  new_manager_id VARCHAR(10) DEFAULT NULL COMMENT 'New manager employee ID',
  effective_date DATE NOT NULL COMMENT 'Date when the change becomes effective',
  reason VARCHAR(500) DEFAULT NULL COMMENT 'Reason for the change',
  notes TEXT DEFAULT NULL COMMENT 'Additional notes about the change',
  approved_by VARCHAR(10) DEFAULT NULL COMMENT 'Employee ID who approved this change',
  approved_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Timestamp when approved',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_job_history_employee FOREIGN KEY (empid) REFERENCES employees(empid) ON DELETE CASCADE,
  CONSTRAINT fk_job_history_previous_dept FOREIGN KEY (previous_department_id) REFERENCES departments(deptid) ON DELETE SET NULL,
  CONSTRAINT fk_job_history_new_dept FOREIGN KEY (new_department_id) REFERENCES departments(deptid) ON DELETE SET NULL,
  CONSTRAINT fk_job_history_previous_manager FOREIGN KEY (previous_manager_id) REFERENCES employees(empid) ON DELETE SET NULL,
  CONSTRAINT fk_job_history_new_manager FOREIGN KEY (new_manager_id) REFERENCES employees(empid) ON DELETE SET NULL,
  CONSTRAINT fk_job_history_approved_by FOREIGN KEY (approved_by) REFERENCES employees(empid) ON DELETE SET NULL,
  INDEX idx_job_history_employee (empid),
  INDEX idx_job_history_change_type (change_type),
  INDEX idx_job_history_effective_date (effective_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
