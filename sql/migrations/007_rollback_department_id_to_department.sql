-- Rollback Migration: Rename employees.department_id back to employees.department
-- Use this if you need to rollback migration 007
-- Date: 2024

-- Step 1: Rename the column back from 'department_id' to 'department'
ALTER TABLE employees
  CHANGE COLUMN department_id department BIGINT UNSIGNED DEFAULT NULL;

-- Step 2: Rename the index back to match the original column name
ALTER TABLE employees
  DROP INDEX idx_employees_department_id,
  ADD INDEX idx_employees_department (department);

-- Step 3: Rename the foreign key constraint back to match the original column name
ALTER TABLE employees
  DROP FOREIGN KEY fk_employees_department,
  ADD CONSTRAINT fk_employees_department FOREIGN KEY (department) REFERENCES departments(id);

-- Warning: Rolling back will require reverting application code changes as well.

