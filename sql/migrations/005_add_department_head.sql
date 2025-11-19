-- Migration: Add department_head column to departments table
-- This migration adds a department_head field to ensure each department has one head
-- Date: 2024

-- Step 1: Add department_head column
ALTER TABLE departments
  ADD COLUMN department_head BIGINT UNSIGNED DEFAULT NULL COMMENT 'Employee ID of the department head';

-- Step 2: Add foreign key constraint
ALTER TABLE departments
  ADD CONSTRAINT fk_departments_head FOREIGN KEY (department_head) REFERENCES employees(id) ON DELETE SET NULL;

-- Step 3: Add index for faster lookups
ALTER TABLE departments
  ADD INDEX idx_dept_head (department_head);

