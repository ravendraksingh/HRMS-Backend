-- Rollback Migration: Remove department_code column from departments table
-- Use this if you need to rollback the migration
-- Date: 2024

-- Step 1: Remove the indexes
ALTER TABLE departments 
  DROP INDEX IF EXISTS idx_dept_code,
  DROP INDEX IF EXISTS uk_dept_org_code;

-- Step 2: Remove the department_code column
ALTER TABLE departments 
  DROP COLUMN IF EXISTS department_code;

-- Step 3: Change id back to PRIMARY KEY (non-auto-increment)
-- Note: This will fail if there are existing auto-increment values
-- You may need to manually set IDs before running this
-- ALTER TABLE departments 
--   MODIFY COLUMN id BIGINT UNSIGNED PRIMARY KEY;

-- Verification query (run manually to verify):
-- SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_KEY, EXTRA
-- FROM INFORMATION_SCHEMA.COLUMNS 
-- WHERE TABLE_SCHEMA = DATABASE() 
--   AND TABLE_NAME = 'departments' 
--   AND COLUMN_NAME IN ('id', 'department_code');

