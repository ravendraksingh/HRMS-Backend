-- Migration: Add department_code to departments table and change id to AUTO_INCREMENT
-- This follows the same pattern as employees: surrogate PK (id) + business key (department_code)
-- Date: 2024

-- Step 1: Change id from PRIMARY KEY to AUTO_INCREMENT PRIMARY KEY
ALTER TABLE departments 
  MODIFY COLUMN id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY;

-- Step 2: Add department_code column
ALTER TABLE departments 
  ADD COLUMN department_code VARCHAR(50) NOT NULL COMMENT 'Real-world department code used by the organization' AFTER organization_id;

-- Step 3: Add composite unique constraint on (organization_id, department_code)
ALTER TABLE departments 
  ADD UNIQUE KEY uk_dept_org_code (organization_id, department_code);

-- Step 4: Add index on department_code for faster lookups
ALTER TABLE departments 
  ADD INDEX idx_dept_code (department_code);

-- Note: The existing uk_dept_org_name unique constraint remains for backward compatibility
-- You may want to remove it later if department_code is the preferred identifier

-- Verification query (run manually to verify):
-- SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_KEY, EXTRA
-- FROM INFORMATION_SCHEMA.COLUMNS 
-- WHERE TABLE_SCHEMA = DATABASE() 
--   AND TABLE_NAME = 'departments' 
--   AND COLUMN_NAME IN ('id', 'department_code');

