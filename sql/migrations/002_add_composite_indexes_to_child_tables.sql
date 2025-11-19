-- Migration: Add composite indexes to child tables for better multi-tenant query performance
-- This ensures all child tables have proper indexes on (organization_id, employee_id)
-- Date: 2024

-- employees_personal: Already has unique key, but ensure index exists
-- Check if index exists, if not add it
-- Note: The unique key uk_emp_personal already provides an index on (organization_id, employee_id)
-- Adding explicit index for clarity and potential query optimization
ALTER TABLE employees_personal 
  ADD INDEX IF NOT EXISTS idx_emp_personal_org_emp (organization_id, employee_id);

-- employees_education: Already has index, verify it's optimal
-- The existing idx_emp_edu_org_emp should be sufficient

-- employees_employment_history: Already has index, verify it's optimal
-- The existing idx_emp_hist_org_emp should be sufficient

-- employees_family: Already has index, verify it's optimal
-- The existing idx_emp_family_org_emp should be sufficient

-- attendance_records: Already has unique key and index
-- The existing uk_att_unique_day and idx_att_emp_date should be sufficient

-- users: Add composite index if not exists
ALTER TABLE users 
  ADD INDEX IF NOT EXISTS idx_users_org_emp (organization_id, employee_id);

-- Note: MySQL 5.7+ supports IF NOT EXISTS for indexes
-- For older versions, you may need to check existence first or use:
-- CREATE INDEX idx_emp_personal_org_emp ON employees_personal (organization_id, employee_id);
-- (This will fail if index exists, but that's acceptable in migration context)

