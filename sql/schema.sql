-- ============================================================================
-- HRMS Backend - Complete MySQL Database Schema (Single Tenant)
-- Human Resource Management System - Backend
-- ============================================================================
-- This file contains the complete database schema for MySQL 8.0+
-- Run this file to set up a fresh database from scratch
-- 
-- Usage: mysql -u your_user -p your_database < sql/schema.sql
-- ============================================================================

-- Set SQL mode and disable foreign key checks during creation
SET @old_sql_mode = @@SQL_MODE;
SET SQL_MODE = 'STRICT_ALL_TABLES,NO_AUTO_VALUE_ON_ZERO,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION';
SET @old_fk_checks = @@FOREIGN_KEY_CHECKS;
SET FOREIGN_KEY_CHECKS = 0;

-- ============================================================================
-- Load Module Schemas
-- ============================================================================

-- 1. Organization Module (foundation - no dependencies)
SOURCE organization/schema.sql;

-- 2. Departments Module (before employees, but department_head FK added later)
SOURCE departments/schema.sql;

-- 3. Roles Module (no dependencies)
SOURCE roles/schema.sql;

-- 4. Employees Module (depends on organization, departments, and office_locations)
SOURCE employees/schema.sql;

-- 5. Add department_head foreign key after employees table exists
ALTER TABLE departments
  ADD CONSTRAINT fk_departments_head FOREIGN KEY (department_head_id) REFERENCES employees(empid) ON DELETE SET NULL;

-- 6. Users Module (depends on employees and roles)
SOURCE users/schema.sql;

-- 7. Attendance Module (depends on employees)
SOURCE attendance/schema.sql;

-- 8. Leaves Module (depends on employees)
SOURCE leaves/schema.sql;

-- 9. Documents Module (depends on employees, departments, roles)
SOURCE documents/schema.sql;

-- 10. Reports Module (depends on employees)
SOURCE reports/schema.sql;

-- 11. Onboarding Module (depends on employees, departments, roles)
SOURCE onboarding/schema.sql;

-- 12. Add job_information shift foreign key after attendance_shifts table exists
ALTER TABLE employee_job_information
  ADD CONSTRAINT fk_job_information_shift FOREIGN KEY (shiftid) REFERENCES attendance_shifts(shiftid) ON DELETE SET NULL;

-- 13. Add onboarding checklist items document template foreign key after documents table exists
ALTER TABLE onboarding_checklist_items
  ADD CONSTRAINT fk_checklist_items_document_template FOREIGN KEY (document_template_id) REFERENCES documents(id) ON DELETE SET NULL;

-- ============================================================================
-- Load Seed Data
-- ============================================================================

-- Load default roles
SOURCE seeds/01_default_roles.sql;

-- ============================================================================
-- Restore settings
-- ============================================================================

SET FOREIGN_KEY_CHECKS = @old_fk_checks;
SET SQL_MODE = @old_sql_mode;

-- ============================================================================
-- Schema creation complete!
-- ============================================================================
