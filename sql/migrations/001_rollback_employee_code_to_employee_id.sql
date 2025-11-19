-- Rollback Migration: Revert employee_code back to employee_id
-- Use this if you need to rollback the migration
-- Date: 2024

-- Step 1: Remove the new indexes
ALTER TABLE employees 
  DROP INDEX IF EXISTS idx_employees_code;

-- Step 2: Rename the unique constraint back
ALTER TABLE employees 
  DROP INDEX uk_employees_org_code,
  ADD UNIQUE KEY uk_employees_org_employee_id (organization_id, employee_id);

-- Step 3: Rename the column back from employee_code to employee_id
ALTER TABLE employees 
  CHANGE COLUMN employee_code employee_id VARCHAR(50) NOT NULL;

-- Verification query (run manually to verify):
-- SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE 
-- FROM INFORMATION_SCHEMA.COLUMNS 
-- WHERE TABLE_SCHEMA = DATABASE() 
--   AND TABLE_NAME = 'employees' 
--   AND COLUMN_NAME IN ('employee_code', 'employee_id');

