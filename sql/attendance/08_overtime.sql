CREATE TABLE IF NOT EXISTS attendance_overtime (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  organization_id BIGINT UNSIGNED NOT NULL,
  employee_id BIGINT UNSIGNED NOT NULL,
  work_date DATE NOT NULL,
  minutes INT NOT NULL,
  status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  reason VARCHAR(300) DEFAULT NULL,
  approved_by BIGINT UNSIGNED DEFAULT NULL,
  approved_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_ot_org FOREIGN KEY (organization_id) REFERENCES organizations(id),
  CONSTRAINT fk_ot_employee FOREIGN KEY (employee_id) REFERENCES employees(id),
  UNIQUE KEY uk_ot_unique (organization_id, employee_id, work_date),
  INDEX idx_ot_emp_date (organization_id, employee_id, work_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


