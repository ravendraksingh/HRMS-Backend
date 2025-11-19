CREATE TABLE IF NOT EXISTS attendance_weekly_off (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  organization_id BIGINT UNSIGNED NOT NULL,
  year SMALLINT NOT NULL,
  month TINYINT NOT NULL COMMENT '1-12 for January-December',
  employee_id BIGINT UNSIGNED DEFAULT NULL COMMENT 'NULL for organization-wide, specific employee_id for employee-specific',
  department_id BIGINT UNSIGNED DEFAULT NULL COMMENT 'NULL for organization-wide or employee-specific, specific department_id for department-wide',
  days_of_week JSON NOT NULL COMMENT 'Array of day numbers: 0=Sunday, 1=Monday, ..., 6=Saturday',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_weekly_off_org FOREIGN KEY (organization_id) REFERENCES organizations(id),
  CONSTRAINT fk_weekly_off_employee FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
  CONSTRAINT fk_weekly_off_department FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE CASCADE,
  CONSTRAINT chk_weekly_off_scope CHECK (
    (employee_id IS NULL AND department_id IS NULL) OR
    (employee_id IS NOT NULL AND department_id IS NULL) OR
    (employee_id IS NULL AND department_id IS NOT NULL)
  ),
  CONSTRAINT chk_weekly_off_month CHECK (month >= 1 AND month <= 12),
  CONSTRAINT chk_weekly_off_year CHECK (year >= 2000 AND year <= 2100),
  UNIQUE KEY uk_weekly_off_org_year_month_emp_dept (organization_id, year, month, COALESCE(employee_id, 0), COALESCE(department_id, 0)),
  INDEX idx_weekly_off_org (organization_id),
  INDEX idx_weekly_off_employee (employee_id),
  INDEX idx_weekly_off_department (department_id),
  INDEX idx_weekly_off_year_month (year, month)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

