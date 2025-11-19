-- Junction table for many-to-many relationship between departments and HR managers
-- Each department can have one or more HR managers
CREATE TABLE IF NOT EXISTS department_hr_managers (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  organization_id BIGINT UNSIGNED NOT NULL,
  department_id BIGINT UNSIGNED NOT NULL,
  hr_manager_id BIGINT UNSIGNED NOT NULL COMMENT 'Employee ID of the HR manager',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_dept_hr_mgr_org FOREIGN KEY (organization_id) REFERENCES organizations(id),
  CONSTRAINT fk_dept_hr_mgr_dept FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE CASCADE,
  CONSTRAINT fk_dept_hr_mgr_employee FOREIGN KEY (hr_manager_id) REFERENCES employees(id) ON DELETE CASCADE,
  UNIQUE KEY uk_dept_hr_mgr (department_id, hr_manager_id),
  INDEX idx_dept_hr_mgr_org (organization_id),
  INDEX idx_dept_hr_mgr_dept (department_id),
  INDEX idx_dept_hr_mgr_employee (hr_manager_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

