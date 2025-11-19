# Database Migrations

This directory contains database migration scripts for the HRMS Backend (Human Resource Management System - Backend) multi-tenant system.

## Migration 001: Rename employee_id to employee_code

**File:** `001_rename_employee_id_to_employee_code.sql`

**Purpose:** 
- Renames the `employee_id` VARCHAR column to `employee_code` in the `employees` table for better clarity
- Adds index on `employee_code` for faster lookups
- Updates unique constraint name to reflect the new column name

**Changes:**
- `employees.employee_id` → `employees.employee_code`
- Adds `idx_employees_code` index
- Renames unique key from `uk_employees_org_employee_id` to `uk_employees_org_code`

**Rollback:** Use `001_rollback_employee_code_to_employee_id.sql` if needed

## Migration 002: Add composite indexes to child tables

**File:** `002_add_composite_indexes_to_child_tables.sql`

**Purpose:**
- Ensures all child tables have proper composite indexes on `(organization_id, employee_id)`
- Optimizes multi-tenant queries

**Note:** Most tables already have these indexes. This migration ensures consistency.

## Running Migrations

### Option 1: Using MySQL Command Line

```bash
mysql -u your_username -p your_database < sql/migrations/001_rename_employee_id_to_employee_code.sql
mysql -u your_username -p your_database < sql/migrations/002_add_composite_indexes_to_child_tables.sql
```

### Option 2: Using MySQL Workbench or phpMyAdmin

1. Open the migration file
2. Execute the SQL statements
3. Verify the changes

### Option 3: Using Node.js Script

You can create a simple migration runner script if needed.

## Verification Queries

After running migration 001, verify the changes:

```sql
-- Check column name
SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE 
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_SCHEMA = DATABASE() 
  AND TABLE_NAME = 'employees' 
  AND COLUMN_NAME IN ('employee_code', 'employee_id');

-- Check indexes
SHOW INDEXES FROM employees WHERE Column_name = 'employee_code';

-- Test query
SELECT * FROM employees WHERE organization_id = 1 AND employee_code = 'EMP001';
```

## Important Notes

1. **Backup First:** Always backup your database before running migrations
2. **Test Environment:** Test migrations in a development/staging environment first
3. **Application Code:** The application code has been updated to use `employee_code` instead of `employee_id`
4. **API Changes:** The API now expects `employee_code` in request bodies instead of `employee_id` when creating employees

## Multi-Tenant Design Best Practices

After these migrations, your database follows these best practices:

1. **Surrogate Primary Keys:** All tables use `id` (BIGINT) as primary key for performance
2. **Business Keys:** `employee_code` (VARCHAR) represents the real-world employee identifier
3. **Composite Unique Constraints:** `(organization_id, employee_code)` ensures uniqueness per organization
4. **Composite Indexes:** All child tables have indexes on `(organization_id, employee_id)` for efficient queries
5. **Organization Context:** Always include `organization_id` in WHERE clauses (enforced at application level)

## Rollback

If you need to rollback migration 001:

```bash
mysql -u your_username -p your_database < sql/migrations/001_rollback_employee_code_to_employee_id.sql
```

**Warning:** Rolling back will require reverting application code changes as well.

