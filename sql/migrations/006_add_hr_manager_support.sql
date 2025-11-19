-- Migration: Add HR Manager support
-- This migration adds:
-- 1. hr_manager_id column to employees table (dedicated HR manager per employee)
-- 2. department_hr_managers junction table (many-to-many: departments can have multiple HR managers)
-- Date: 2024

-- Step 1: Add hr_manager_id column to employees table
ALTER TABLE employees
  ADD COLUMN hr_manager_id BIGINT UNSIGNED DEFAULT NULL COMMENT 'Dedicated HR manager for this employee';

-- Step 2: Add foreign key constraint for hr_manager_id
ALTER TABLE employees
  ADD CONSTRAINT fk_employees_hr_manager FOREIGN KEY (hr_manager_id) REFERENCES employees(id) ON DELETE SET NULL;

-- Step 3: Add index for hr_manager_id
ALTER TABLE employees
  ADD INDEX idx_employees_hr_manager_id (hr_manager_id);

-- Step 4: Create department_hr_managers junction table
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

