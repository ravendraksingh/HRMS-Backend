# Multi-Tenant Database Design - Best Practices Implementation

## Overview

This document explains the multi-tenant database design strategy implemented for the HRMS Backend (Human Resource Management System - Backend) system, which supports multiple organizations in a single database instance.

## Design Strategy: Shared Database, Shared Schema

We use a **shared database with shared schema** approach, where:
- All organizations share the same database and tables
- Each table includes an `organization_id` column for tenant isolation
- Data is logically separated by `organization_id` in queries

## Key Design Principles

### 1. Surrogate Primary Keys
- **All tables use `id` (BIGINT UNSIGNED AUTO_INCREMENT) as the primary key**
- This provides optimal performance for foreign key relationships
- Enables efficient joins and indexing

### 2. Business Keys (Real-World Identifiers)
- **`employee_code` (VARCHAR) represents the real-world employee identifier**
- This is the identifier used by organizations in their business processes
- Can be any format (e.g., "EMP001", "E-2024-001", "JOHN-DOE-001")

### 3. Composite Unique Constraints
- **`(organization_id, employee_code)` ensures uniqueness per organization**
- Prevents duplicate employee codes within an organization
- Allows different organizations to use the same employee codes

### 4. Composite Indexes
- **All child tables have indexes on `(organization_id, employee_id)`**
- Optimizes multi-tenant queries that filter by organization
- Enables efficient lookups and joins

### 5. Organization Context Enforcement
- **Always include `organization_id` in WHERE clauses**
- Enforced at the application layer via middleware
- Prevents cross-organization data access

## Database Schema Structure

### Employees Table

```sql
CREATE TABLE employees (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,           -- Surrogate key
  organization_id BIGINT UNSIGNED NOT NULL,                 -- Tenant identifier
  employee_code VARCHAR(50) NOT NULL,                       -- Business key
  name VARCHAR(150) NOT NULL,
  email VARCHAR(200) NOT NULL,
  -- ... other fields
  UNIQUE KEY uk_employees_org_code (organization_id, employee_code),
  INDEX idx_employees_org (organization_id),
  INDEX idx_employees_code (employee_code),                 -- For faster lookups
  FOREIGN KEY (organization_id) REFERENCES organizations(id)
);
```

**Key Points:**
- `id` is the primary key (used in foreign keys)
- `employee_code` is the business identifier (used in API requests)
- Composite unique constraint ensures uniqueness per organization
- Indexes optimize common query patterns

### Child Tables (Example: employees_personal)

```sql
CREATE TABLE employees_personal (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  organization_id BIGINT UNSIGNED NOT NULL,
  employee_id BIGINT UNSIGNED NOT NULL,                     -- FK to employees.id
  -- ... other fields
  UNIQUE KEY uk_emp_personal_org_emp (organization_id, employee_id),
  INDEX idx_emp_personal_org_emp (organization_id, employee_id),
  FOREIGN KEY (employee_id) REFERENCES employees(id),
  FOREIGN KEY (organization_id) REFERENCES organizations(id)
);
```

**Key Points:**
- `employee_id` references `employees.id` (the surrogate key)
- Composite unique constraint ensures one record per employee per organization
- Composite index optimizes organization-scoped queries

## Application Layer Patterns

### 1. Employee ID Resolution

The `resolveEmployeeNumericId()` utility function handles both:
- Numeric IDs (the surrogate key `id`)
- Employee codes (the VARCHAR `employee_code`)

```javascript
// Automatically resolves employee_code to numeric id
const numericId = await resolveEmployeeNumericId('EMP001', organizationId);
```

### 2. Organization Context Middleware

All routes enforce organization context:

```javascript
// Middleware ensures organization_id is always present
const organization_id = req.organizationId; // From middleware

// All queries include organization_id
const [rows] = await pool.query(
  "SELECT * FROM employees WHERE organization_id = ? AND employee_code = ?",
  [organization_id, employeeCode]
);
```

### 3. Query Patterns

**Lookup by Employee Code:**
```sql
SELECT * FROM employees 
WHERE organization_id = ? AND employee_code = ?
```

**Lookup by Numeric ID (with org check):**
```sql
SELECT * FROM employees 
WHERE id = ? AND organization_id = ?
```

**Join with Child Tables:**
```sql
SELECT ep.*, e.name, e.email
FROM employees_personal ep
JOIN employees e ON ep.employee_id = e.id
WHERE ep.organization_id = ? AND ep.employee_id = ?
```

## Benefits of This Design

### 1. Performance
- Surrogate BIGINT keys are faster than VARCHAR for joins
- Composite indexes optimize multi-tenant queries
- Efficient foreign key relationships

### 2. Flexibility
- Employee codes can be any format per organization
- Easy to support different identifier schemes
- No constraints on code format

### 3. Safety
- Composite unique constraints prevent duplicates
- Organization context prevents cross-tenant access
- Clear separation between internal IDs and business codes

### 4. Maintainability
- Consistent pattern across all tables
- Clear naming conventions
- Well-documented structure

### 5. Scalability
- Single database instance reduces operational overhead
- Efficient indexing supports large datasets
- Easy to add new organizations

## Migration Guide

See `sql/migrations/README.md` for detailed migration instructions.

**Quick Start:**
1. Backup your database
2. Run migration 001: `001_rename_employee_id_to_employee_code.sql`
3. Run migration 002: `002_add_composite_indexes_to_child_tables.sql`
4. Verify changes using the verification queries in the README

## API Changes

### Creating Employees

**Before:**
```json
POST /employees
{
  "employee_id": "EMP001",
  "name": "John Doe",
  "email": "john@example.com"
}
```

**After:**
```json
POST /employees
{
  "employee_code": "EMP001",
  "name": "John Doe",
  "email": "john@example.com"
}
```

### Querying Employees

The API continues to support both:
- Numeric IDs: `GET /employees/123`
- Employee codes: `GET /employees/EMP001`

The `resolveEmployeeNumericId()` utility handles both automatically.

## Best Practices Checklist

- ✅ Surrogate primary keys (`id`) for all tables
- ✅ Business keys (`employee_code`) for real-world identifiers
- ✅ Composite unique constraints `(organization_id, business_key)`
- ✅ Composite indexes `(organization_id, foreign_key)` on child tables
- ✅ Organization context enforced in all queries
- ✅ Clear naming conventions (code vs id)
- ✅ Proper foreign key relationships
- ✅ Indexes on frequently queried columns

## Comparison with Alternatives

### Why Not Composite Primary Keys?

**Composite PKs (organization_id, employee_code):**
- ❌ VARCHAR in primary key is slower
- ❌ All foreign keys become composite (more verbose)
- ❌ Joins require both columns

**Our Approach (Surrogate PK + Composite Unique):**
- ✅ Fast BIGINT primary keys
- ✅ Simple foreign key relationships
- ✅ Flexible business key format
- ✅ Best of both worlds

### Why Not Separate Databases?

**Separate Databases:**
- ❌ Higher operational overhead
- ❌ Harder cross-organization analytics
- ❌ More complex migrations
- ❌ Higher cost at scale

**Our Approach (Shared Database):**
- ✅ Lower operational overhead
- ✅ Easy cross-organization analytics (if needed)
- ✅ Simpler migrations
- ✅ Cost-effective

## Security Considerations

1. **Always filter by organization_id** - Never trust client input
2. **Use parameterized queries** - Prevent SQL injection
3. **Validate organization context** - Middleware should enforce this
4. **Audit logs** - Track cross-organization access attempts
5. **Row-level security** - Consider PostgreSQL RLS for additional protection

## Future Enhancements

Potential improvements:
1. **Database-level row-level security** (PostgreSQL RLS)
2. **Partitioning by organization_id** for very large datasets
3. **Read replicas** for scaling read operations
4. **Caching layer** for frequently accessed organization data
5. **Soft deletes** with organization context

## Questions?

For questions or issues, refer to:
- Migration guide: `sql/migrations/README.md`
- Schema files: `sql/employees/`
- Application code: `routes/employees/` and `util/employeeUtil.js`

