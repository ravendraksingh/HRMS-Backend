CREATE TABLE IF NOT EXISTS departments (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  organization_id BIGINT UNSIGNED NOT NULL,
  department_code VARCHAR(50) NOT NULL COMMENT 'Real-world department code used by the organization',
  name VARCHAR(150) NOT NULL,
  department_head BIGINT UNSIGNED DEFAULT NULL COMMENT 'Employee ID of the department head',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_departments_org FOREIGN KEY (organization_id) REFERENCES organizations(id),
  CONSTRAINT fk_departments_head FOREIGN KEY (department_head) REFERENCES employees(id) ON DELETE SET NULL,
  UNIQUE KEY uk_dept_org_code (organization_id, department_code),
  UNIQUE KEY uk_dept_org_name (organization_id, name),
  INDEX idx_dept_org (organization_id),
  INDEX idx_dept_code (department_code),
  INDEX idx_dept_head (department_head)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


