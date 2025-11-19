CREATE TABLE IF NOT EXISTS employees (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  organization_id BIGINT UNSIGNED NOT NULL,
  employee_code VARCHAR(50) NOT NULL COMMENT 'Real-world employee ID/code used by the organization',
  name VARCHAR(150) NOT NULL,
  email VARCHAR(200) NOT NULL,
  manager_id BIGINT UNSIGNED DEFAULT NULL,
  hr_manager_id BIGINT UNSIGNED DEFAULT NULL COMMENT 'Dedicated HR manager for this employee',
  department_id BIGINT UNSIGNED DEFAULT NULL,
  location_id BIGINT UNSIGNED DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_employees_org_code (organization_id, employee_code),
  INDEX idx_employees_org (organization_id),
  INDEX idx_employees_code (employee_code),
  INDEX idx_employees_manager_id (manager_id),
  INDEX idx_employees_hr_manager_id (hr_manager_id),
  INDEX idx_employees_department_id (department_id),
  INDEX idx_employees_location (location_id),
  CONSTRAINT fk_employees_org FOREIGN KEY (organization_id) REFERENCES organizations(id),
  CONSTRAINT fk_employees_manager FOREIGN KEY (manager_id) REFERENCES employees(id),
  CONSTRAINT fk_employees_hr_manager FOREIGN KEY (hr_manager_id) REFERENCES employees(id) ON DELETE SET NULL,
  CONSTRAINT fk_employees_department FOREIGN KEY (department_id) REFERENCES departments(id),
  CONSTRAINT fk_employees_location FOREIGN KEY (location_id) REFERENCES office_locations(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


