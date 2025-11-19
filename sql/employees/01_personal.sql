CREATE TABLE IF NOT EXISTS employees_personal (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  organization_id BIGINT UNSIGNED NOT NULL,
  employee_id BIGINT UNSIGNED NOT NULL,
  dob DATE DEFAULT NULL,
  gender ENUM('male','female','other','undisclosed') DEFAULT NULL,
  marital_status ENUM('single','married','divorced','widowed','other') DEFAULT NULL,
  phone_primary VARCHAR(30) DEFAULT NULL,
  phone_secondary VARCHAR(30) DEFAULT NULL,
  address_line1 VARCHAR(200) DEFAULT NULL,
  address_line2 VARCHAR(200) DEFAULT NULL,
  city VARCHAR(100) DEFAULT NULL,
  state VARCHAR(100) DEFAULT NULL,
  postal_code VARCHAR(20) DEFAULT NULL,
  country VARCHAR(100) DEFAULT NULL,
  emergency_contact_name VARCHAR(120) DEFAULT NULL,
  emergency_contact_relation VARCHAR(60) DEFAULT NULL,
  emergency_contact_phone VARCHAR(30) DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_emp_personal_org_emp (organization_id, employee_id),
  INDEX idx_emp_personal_org_emp (organization_id, employee_id),
  CONSTRAINT fk_emp_personal_org FOREIGN KEY (organization_id) REFERENCES organizations(id),
  CONSTRAINT fk_emp_personal_employee FOREIGN KEY (employee_id) REFERENCES employees(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


