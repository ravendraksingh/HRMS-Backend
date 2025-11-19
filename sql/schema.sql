-- Application-level schema orchestrator
-- Run this file to create all tables, indexes, and constraints

-- Optional: set SQL modes and disable FKs during creation
SET @old_sql_mode = @@SQL_MODE;
SET SQL_MODE = 'STRICT_ALL_TABLES,NO_AUTO_VALUE_ON_ZERO,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION';
SET @old_fk_checks = @@FOREIGN_KEY_CHECKS;
SET FOREIGN_KEY_CHECKS = 0;

-- Core reference data first (tenancy)
SOURCE organizations/schema.sql;
SOURCE departments/schema.sql;
SOURCE organization/schema.sql;

-- Employee domain
SOURCE employees/schema.sql;

-- Users and Roles domain (after employees, as users reference employees)
SOURCE users/schema.sql;

-- Attendance domain
SOURCE attendance/schema.sql;

-- Restore settings
SET FOREIGN_KEY_CHECKS = @old_fk_checks;
SET SQL_MODE = @old_sql_mode;


