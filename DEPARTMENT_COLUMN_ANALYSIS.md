# Analysis: SQL Queries Referencing employees.department

## Schema Definition

According to `sql/employees/00_employees.sql`, the column name is:
```sql
department BIGINT UNSIGNED DEFAULT NULL,
```

**The correct column name is `department` (NOT `department_id`)**

---

## Queries Using CORRECT Column Name: `e.department`

### ✅ routes/managers/managers.js
- **Line 32**: `e.department,` (SELECT clause)
- **Line 44**: `LEFT JOIN departments d ON e.department = d.id` (JOIN)
- **Line 97**: `e.department,` (SELECT clause)
- **Line 105**: `LEFT JOIN departments d ON e.department = d.id` (JOIN)
- **Line 434**: `LEFT JOIN departments d ON e.department = d.id` (JOIN)
- **Line 563**: `LEFT JOIN departments d ON e.department = d.id` (JOIN)

### ✅ routes/attendance/leaves.js
- **Line 84**: `LEFT JOIN departments d ON e.department = d.id` (JOIN)

---

## Queries Using INCORRECT Column Name: `e.department_id` or `department_id`

### ❌ routes/managers/managers.js
- **Line 32**: `e.department_id,` (SELECT clause) - **SHOULD BE `e.department`**
- **Line 44**: `LEFT JOIN departments d ON e.department_id = d.id` - **SHOULD BE `e.department`**
- **Line 97**: `e.department_id,` (SELECT clause) - **SHOULD BE `e.department`**
- **Line 105**: `LEFT JOIN departments d ON e.department_id = d.id` - **SHOULD BE `e.department`**

### ❌ routes/attendance/attendance.js
- **Line 164**: `LEFT JOIN departments d ON e.department_id = d.id` - **SHOULD BE `e.department`**

### ❌ routes/users/users.js
- **Line 120**: `e.department_id,` (SELECT clause) - **SHOULD BE `e.department`**
- **Line 143**: `LEFT JOIN departments d ON e.department_id = d.id` - **SHOULD BE `e.department`**

### ❌ routes/employees/employees.js
- **Line 25**: `whereClauses.push("department_id = ?");` - **SHOULD BE `department = ?`**
- **Line 105**: `"INSERT INTO employees (organization_id, employee_code, name, email, manager_id, department_id, location_id) VALUES (?, ?, ?, ?, ?, ?, ?)"` - **SHOULD BE `department`**
- **Line 160**: `"SELECT id, department_id, hr_manager_id FROM employees WHERE id = ? AND organization_id = ?"` - **SHOULD BE `department`**
- **Line 184**: `let newDeptId = employee.department_id;` - **SHOULD BE `employee.department`**
- **Line 197**: `updates.push("department_id = ?");` - **SHOULD BE `department = ?`**
- **Line 243**: `if (department !== undefined && employee.department_id !== newDeptId)` - **SHOULD BE `employee.department`**
- **Line 326**: `"SELECT department_id FROM employees WHERE id = ? AND organization_id = ?"` - **SHOULD BE `department`**
- **Line 334**: `if (!employee.department_id)` - **SHOULD BE `employee.department`**
- **Line 340**: `employee.department_id,` - **SHOULD BE `employee.department`**

### ❌ routes/admin/employees.js
- **Line 28**: `whereClauses.push("department_id = ?");` - **SHOULD BE `department = ?`**

### ❌ routes/onboarding/onboarding.js
- **Line 163**: `"INSERT INTO employees (organization_id, employee_code, name, email, manager_id, hr_manager_id, department_id, location_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"` - **SHOULD BE `department`**
- **Line 250**: `LEFT JOIN departments d ON e.department_id = d.id` - **SHOULD BE `e.department`**
- **Line 271**: `department_id: newEmployee.department_id,` - **SHOULD BE `newEmployee.department`**
- **Line 347**: `"SELECT id, department_id, hr_manager_id FROM employees WHERE id = ? AND organization_id = ?"` - **SHOULD BE `department`**
- **Line 400**: `: employee.department_id;` - **SHOULD BE `employee.department`**
- **Line 452**: `updates.push("department_id = ?");` - **SHOULD BE `department = ?`**
- **Line 490**: `: employee.department_id;` - **SHOULD BE `employee.department`**
- **Line 520**: `LEFT JOIN departments d ON e.department_id = d.id` - **SHOULD BE `e.department`**
- **Line 540**: `department_id: updatedEmployee.department_id,` - **SHOULD BE `updatedEmployee.department`**

### ❌ routes/departments/departments.js
- **Line 208**: `"SELECT id, department_id FROM employees WHERE id = ? AND organization_id = ?"` - **SHOULD BE `department`**

---

## Summary

### Files with Mixed Usage (Some Correct, Some Incorrect)
1. **routes/managers/managers.js** - Has both correct (`e.department`) and incorrect (`e.department_id`) usage

### Files with Only Incorrect Usage
1. **routes/attendance/attendance.js** - Uses `e.department_id`
2. **routes/users/users.js** - Uses `e.department_id`
3. **routes/employees/employees.js** - Uses `department_id` in multiple places
4. **routes/admin/employees.js** - Uses `department_id`
5. **routes/onboarding/onboarding.js** - Uses `department_id` in multiple places
6. **routes/departments/departments.js** - Uses `department_id`

### Files with Only Correct Usage
1. **routes/attendance/leaves.js** - Uses `e.department` correctly

---

## Impact

These incorrect column references will cause SQL errors when the queries are executed, as the column `department_id` does not exist in the `employees` table. The correct column name is `department`.

---

## Recommendation

All queries should be updated to use `department` instead of `department_id` when referencing the `employees` table.

