CREATE TABLE IF NOT EXISTS employees_family (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  organization_id BIGINT UNSIGNED NOT NULL,
  employee_id BIGINT UNSIGNED NOT NULL,
  name VARCHAR(150) NOT NULL,
  relation VARCHAR(80) NOT NULL,
  dob DATE DEFAULT NULL,
  phone VARCHAR(30) DEFAULT NULL,
  dependent TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_emp_family_org FOREIGN KEY (organization_id) REFERENCES organizations(id),
  CONSTRAINT fk_emp_family_employee FOREIGN KEY (employee_id) REFERENCES employees(id),
  INDEX idx_emp_family_emp (employee_id),
  INDEX idx_emp_family_org_emp (organization_id, employee_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


