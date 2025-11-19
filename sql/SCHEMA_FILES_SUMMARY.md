# Consolidated Schema Files Summary

## Overview

This directory now contains consolidated schema files that can be used to set up a fresh database from scratch. All tables, indexes, constraints, and relationships are included in the correct dependency order.

## Files Created

### 1. `01_setup_mysql.sql` (548 lines)
- **Database**: MySQL 8.0+
- **Purpose**: Complete schema setup for MySQL
- **Features**:
  - All 23 tables in correct dependency order
  - All indexes and constraints
  - Foreign key relationships
  - Generated columns (worked_minutes)
  - ENUM types (native MySQL)
  - Automatic `updated_at` via `ON UPDATE CURRENT_TIMESTAMP`

### 2. `01_setup_postgresql.sql` (707 lines)
- **Database**: PostgreSQL 12+
- **Purpose**: Complete schema setup for PostgreSQL
- **Features**:
  - All 23 tables in correct dependency order
  - All indexes and constraints
  - Foreign key relationships
  - Generated columns (worked_minutes)
  - Custom ENUM types (created with DO blocks)
  - Automatic `updated_at` via triggers
  - JSONB for better JSON performance

### 3. `SETUP_INSTRUCTIONS.md`
- **Purpose**: Detailed setup instructions for both databases
- **Contents**:
  - Step-by-step setup guide
  - Verification queries
  - Troubleshooting tips
  - Key differences between MySQL and PostgreSQL

## Table Count

Both schemas create **23 tables**:

1. organizations
2. office_locations
3. departments
4. employees
5. department_hr_managers
6. employees_personal
7. employees_education
8. employees_employment_history
9. employees_family
10. roles
11. users
12. user_roles
13. refresh_tokens
14. attendance_shifts
15. attendance_shift_assignments
16. attendance_policies
17. attendance_holidays
18. attendance_leaves
19. attendance_records
20. attendance_exceptions
21. attendance_overtime
22. attendance_audit_logs
23. attendance_weekly_off

## Key Differences: MySQL vs PostgreSQL

| Feature | MySQL | PostgreSQL |
|---------|-------|------------|
| Auto Increment | `AUTO_INCREMENT` | `BIGSERIAL` |
| Boolean | `TINYINT(1)` | `BOOLEAN` |
| ENUM | Native type | Custom type with DO block |
| JSON | `JSON` | `JSONB` |
| Unsigned | `BIGINT UNSIGNED` | `BIGINT` (no unsigned) |
| Updated At | `ON UPDATE CURRENT_TIMESTAMP` | Trigger function |
| Unique with COALESCE | Supported inline | Requires unique index |
| Generated Columns | `GENERATED ALWAYS AS ... STORED` | `GENERATED ALWAYS AS ... STORED` |

## Usage

### Quick Start (MySQL)
```bash
mysql -u root -p
CREATE DATABASE ems_backend CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
EXIT;

mysql -u your_user -p ems_backend < sql/01_setup_mysql.sql
```

### Quick Start (PostgreSQL)
```bash
psql -U postgres
CREATE DATABASE ems_backend;
\q

psql -U your_user -d ems_backend -f sql/01_setup_postgresql.sql
```

## Migration Notes

- The consolidated schemas include all changes from migrations up to `007_rename_department_to_department_id.sql`
- The `employees` table uses `department_id` (not `department`)
- All foreign keys and indexes are included
- No need to run individual migration files when using consolidated schemas

## Benefits

1. **Single File Setup**: One file per database type for complete setup
2. **Correct Order**: Tables created in proper dependency order
3. **No Manual Steps**: All indexes, constraints, and triggers included
4. **Database Agnostic**: Separate files for MySQL and PostgreSQL
5. **Production Ready**: Includes all optimizations and best practices

## Verification

After running either schema file, verify with:

**MySQL:**
```sql
SELECT COUNT(*) FROM information_schema.tables 
WHERE table_schema = DATABASE();
-- Should return 23
```

**PostgreSQL:**
```sql
SELECT COUNT(*) FROM information_schema.tables 
WHERE table_schema = 'public' AND table_type = 'BASE TABLE';
-- Should return 23
```

