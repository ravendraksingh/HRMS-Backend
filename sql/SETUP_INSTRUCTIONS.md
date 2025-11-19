# Database Setup Instructions

This document provides instructions for setting up the EMS Backend database from scratch using the consolidated schema files.

## Overview

The project includes consolidated schema files for both MySQL and PostgreSQL:

- **MySQL**: `sql/01_setup_mysql.sql` - For MySQL 8.0+
- **PostgreSQL**: `sql/01_setup_postgresql.sql` - For PostgreSQL 12+

These files contain all tables, indexes, constraints, and relationships in the correct dependency order.

## Prerequisites

### MySQL Setup
- MySQL 8.0 or higher
- Database user with CREATE, ALTER, INDEX, and FOREIGN KEY privileges
- An empty database created

### PostgreSQL Setup
- PostgreSQL 12 or higher
- Database user with CREATE privileges
- An empty database created

## MySQL Setup

### Step 1: Create Database

```bash
mysql -u root -p
```

```sql
CREATE DATABASE ems_backend CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE ems_backend;
EXIT;
```

### Step 2: Run Schema File

```bash
mysql -u your_user -p ems_backend < sql/01_setup_mysql.sql
```

Or from within MySQL:

```sql
USE ems_backend;
SOURCE sql/01_setup_mysql.sql;
```

### Step 3: Verify Installation

```sql
SHOW TABLES;
```

You should see all 23 tables created.

## PostgreSQL Setup

### Step 1: Create Database

```bash
psql -U postgres
```

```sql
CREATE DATABASE ems_backend;
\c ems_backend
\q
```

### Step 2: Run Schema File

```bash
psql -U your_user -d ems_backend -f sql/01_setup_postgresql.sql
```

Or from within psql:

```sql
\c ems_backend
\i sql/01_setup_postgresql.sql
```

### Step 3: Verify Installation

```sql
\dt
```

You should see all 23 tables created.

## Schema Structure

The consolidated schema files create the following tables in dependency order:

### Core Tables (Multi-tenant Foundation)
1. **organizations** - Organization/tenant table
2. **office_locations** - Office locations
3. **departments** - Department definitions
4. **employees** - Employee master table
5. **department_hr_managers** - Department-HR manager junction

### Employee Related Tables
6. **employees_personal** - Personal information
7. **employees_education** - Education records
8. **employees_employment_history** - Previous employment
9. **employees_family** - Family member information

### User Management Tables
10. **roles** - User roles
11. **users** - User accounts
12. **user_roles** - User-role assignments
13. **refresh_tokens** - JWT refresh tokens

### Attendance Tables
14. **attendance_shifts** - Shift definitions
15. **attendance_shift_assignments** - Employee shift assignments
16. **attendance_policies** - Attendance policies
17. **attendance_holidays** - Holiday calendar
18. **attendance_leaves** - Leave requests
19. **attendance_records** - Daily attendance records
20. **attendance_exceptions** - Attendance exception requests
21. **attendance_overtime** - Overtime records
22. **attendance_audit_logs** - Audit trail
23. **attendance_weekly_off** - Weekly off configurations

## Key Differences: MySQL vs PostgreSQL

### Data Types
- **MySQL**: `BIGINT UNSIGNED`, `TINYINT(1)`, `ENUM`
- **PostgreSQL**: `BIGINT`, `BOOLEAN`, Custom ENUM types

### Auto Increment
- **MySQL**: `AUTO_INCREMENT`
- **PostgreSQL**: `BIGSERIAL` or `SERIAL`

### Timestamps
- **MySQL**: `ON UPDATE CURRENT_TIMESTAMP` (automatic)
- **PostgreSQL**: Uses triggers for `updated_at` (included in schema)

### JSON
- **MySQL**: `JSON` type
- **PostgreSQL**: `JSONB` type (more efficient)

### Generated Columns
- **MySQL**: `GENERATED ALWAYS AS ... STORED`
- **PostgreSQL**: `GENERATED ALWAYS AS ... STORED` (syntax differs)

### Indexes
- **MySQL**: Can be created inline with table
- **PostgreSQL**: Created separately after table creation

## Verification Queries

### Check All Tables (MySQL)
```sql
SELECT COUNT(*) as table_count 
FROM information_schema.tables 
WHERE table_schema = DATABASE();
-- Should return 23
```

### Check All Tables (PostgreSQL)
```sql
SELECT COUNT(*) as table_count 
FROM information_schema.tables 
WHERE table_schema = 'public' AND table_type = 'BASE TABLE';
-- Should return 23
```

### Check Foreign Keys (MySQL)
```sql
SELECT 
  TABLE_NAME,
  CONSTRAINT_NAME,
  REFERENCED_TABLE_NAME
FROM information_schema.KEY_COLUMN_USAGE
WHERE TABLE_SCHEMA = DATABASE()
  AND REFERENCED_TABLE_NAME IS NOT NULL
ORDER BY TABLE_NAME;
```

### Check Foreign Keys (PostgreSQL)
```sql
SELECT
  tc.table_name,
  tc.constraint_name,
  ccu.table_name AS foreign_table_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
ORDER BY tc.table_name;
```

## Troubleshooting

### MySQL Issues

**Error: "Table already exists"**
- Drop the database and recreate, or use `DROP TABLE IF EXISTS` before running schema

**Error: "Foreign key constraint fails"**
- Ensure tables are created in the correct order (schema handles this)
- Check that `FOREIGN_KEY_CHECKS` is disabled during creation

**Error: "Unknown collation"**
- Ensure MySQL 8.0+ is being used
- Verify `utf8mb4_unicode_ci` collation is available

### PostgreSQL Issues

**Error: "Type already exists"**
- ENUM types are created with `DO $$ BEGIN ... EXCEPTION ... END $$` to handle duplicates
- If issues persist, drop types manually: `DROP TYPE IF EXISTS gender_type CASCADE;`

**Error: "Function already exists"**
- The trigger function `update_updated_at_column()` is created with `CREATE OR REPLACE`
- Should not cause issues

**Error: "Trigger already exists"**
- Drop triggers manually if needed: `DROP TRIGGER IF EXISTS update_organizations_updated_at ON organizations;`

## Next Steps

After setting up the database:

1. **Update database connection** in `db.js`:
   ```javascript
   const poolConfig = {
     host: process.env.DB_HOST || "localhost",
     user: process.env.DB_USER || "root",
     password: process.env.DB_PASSWORD || "password",
     database: process.env.DB_NAME || "ems_backend",
   };
   ```

2. **Run migrations** (if any) from `sql/migrations/` directory

3. **Seed initial data** (optional) from `sql/seeds/` directory

4. **Start the server**: `npm run dev`

## Migration from Existing Setup

If you have an existing database with the old schema structure:

1. **Backup your data** first!
2. Review migration files in `sql/migrations/` directory
3. Run migrations in order (001, 002, 003, etc.)
4. Or drop and recreate using the consolidated schema files

## Support

For issues or questions:
- Check `MULTI_TENANT_DESIGN.md` for database design details
- Review `sql/migrations/README.md` for migration information
- Check application logs for database connection errors

