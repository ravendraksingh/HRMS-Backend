CREATE TABLE IF NOT EXISTS employees_education (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  organization_id BIGINT UNSIGNED NOT NULL,
  employee_id BIGINT UNSIGNED NOT NULL,
  degree VARCHAR(150) NOT NULL,
  institution VARCHAR(200) NOT NULL,
  field_of_study VARCHAR(150) DEFAULT NULL,
  start_date DATE DEFAULT NULL,
  end_date DATE DEFAULT NULL,
  grade VARCHAR(50) DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_emp_edu_org FOREIGN KEY (organization_id) REFERENCES organizations(id),
  CONSTRAINT fk_emp_edu_employee FOREIGN KEY (employee_id) REFERENCES employees(id),
  INDEX idx_emp_edu_emp (employee_id),
  INDEX idx_emp_edu_org_emp (organization_id, employee_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


