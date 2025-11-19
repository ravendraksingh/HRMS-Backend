-- Migration: Rename employee_id to employee_code in employees table
-- This migration improves multi-tenant database design by:
-- 1. Renaming employee_id (VARCHAR) to employee_code for clarity
-- 2. Adding index on employee_code for faster lookups
-- 3. Adding composite index for organization_id + employee_code lookups
-- Date: 2024

-- Step 1: Rename the column from employee_id to employee_code
ALTER TABLE employees 
  CHANGE COLUMN employee_id employee_code VARCHAR(50) NOT NULL;

-- Step 2: Rename the unique constraint to reflect the new column name
ALTER TABLE employees 
  DROP INDEX uk_employees_org_employee_id,
  ADD UNIQUE KEY uk_employees_org_code (organization_id, employee_code);

-- Step 3: Add index on employee_code alone for faster lookups
ALTER TABLE employees 
  ADD INDEX idx_employees_code (employee_code);

-- Step 4: The composite index (organization_id, employee_code) is already covered
-- by the unique key, but we can add an explicit index if needed for query optimization
-- Note: The unique key already serves as an index, so this is optional
-- ALTER TABLE employees 
--   ADD INDEX idx_employees_org_code_lookup (organization_id, employee_code);

-- Verification query (run manually to verify):
-- SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE 
-- FROM INFORMATION_SCHEMA.COLUMNS 
-- WHERE TABLE_SCHEMA = DATABASE() 
--   AND TABLE_NAME = 'employees' 
--   AND COLUMN_NAME IN ('employee_code', 'employee_id');

