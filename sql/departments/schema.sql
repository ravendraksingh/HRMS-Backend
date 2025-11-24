-- ============================================================================
-- Departments Module Schema
-- ============================================================================
-- This file contains the department-related tables
-- ============================================================================

-- ============================================================================
-- 1. DEPARTMENTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS departments (
  deptid VARCHAR(10) NOT NULL PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  short_name VARCHAR(50) DEFAULT NULL,
  department_head_id VARCHAR(10) DEFAULT NULL COMMENT 'Employee ID of the department head',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_dept_name (name),
  INDEX idx_dept_head (department_head_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Add foreign key for department_head after employees table exists
-- This will be added in the main schema.sql after all modules are loaded

-- ============================================================================
-- 2. DEPARTMENT HR MANAGERS
-- ============================================================================
-- Many-to-many relationship: One department can have multiple HR managers
-- One HR manager can manage multiple departments

CREATE TABLE IF NOT EXISTS department_hr_managers (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  department_id VARCHAR(10) NOT NULL COMMENT 'Department ID (deptid)',
  hr_manager_empid VARCHAR(10) NOT NULL COMMENT 'HR Manager employee ID (empid)',
  effective_from DATE NOT NULL COMMENT 'Date from which this assignment is effective',
  effective_to DATE DEFAULT NULL COMMENT 'Date until which this assignment is valid (NULL for ongoing)',
  is_active VARCHAR(1) DEFAULT 'Y' COMMENT 'Y if active, N if inactive',
  assigned_by VARCHAR(10) DEFAULT NULL COMMENT 'Employee ID of the person who assigned this (empid)',
  remarks VARCHAR(500) DEFAULT NULL COMMENT 'Additional notes or remarks about this assignment',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_dept_hr_managers_department FOREIGN KEY (department_id) REFERENCES departments(deptid) ON DELETE CASCADE,
  CONSTRAINT fk_dept_hr_managers_hr_manager FOREIGN KEY (hr_manager_empid) REFERENCES employees(empid) ON DELETE CASCADE,
  CONSTRAINT fk_dept_hr_managers_assigned_by FOREIGN KEY (assigned_by) REFERENCES employees(empid) ON DELETE SET NULL,
  UNIQUE KEY uk_dept_hr_manager_active (department_id, hr_manager_empid, effective_from) COMMENT 'Prevent duplicate active assignments',
  INDEX idx_dept_hr_managers_department (department_id),
  INDEX idx_dept_hr_managers_hr_manager (hr_manager_empid),
  INDEX idx_dept_hr_managers_dates (effective_from, effective_to),
  INDEX idx_dept_hr_managers_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
