-- Migration: Rename employees.department to employees.department_id
-- This migration renames the department column to department_id for consistency with other ID columns
-- Date: 2024

-- Step 1: Rename the column from 'department' to 'department_id'
ALTER TABLE employees
  CHANGE COLUMN department department_id BIGINT UNSIGNED DEFAULT NULL;

-- Step 2: Rename the index to match the new column name
ALTER TABLE employees
  DROP INDEX idx_employees_department,
  ADD INDEX idx_employees_department_id (department_id);

-- Step 3: Rename the foreign key constraint to match the new column name
ALTER TABLE employees
  DROP FOREIGN KEY fk_employees_department,
  ADD CONSTRAINT fk_employees_department FOREIGN KEY (department_id) REFERENCES departments(id);

-- Note: The column is already BIGINT UNSIGNED, so no data type change is needed
-- The column name change ensures consistency with other ID columns (manager_id, hr_manager_id, location_id)

