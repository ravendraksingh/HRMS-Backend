CREATE TABLE IF NOT EXISTS attendance_shift_assignments (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  organization_id BIGINT UNSIGNED NOT NULL,
  employee_id BIGINT UNSIGNED NOT NULL,
  shift_id BIGINT UNSIGNED NOT NULL,
  effective_from DATE NOT NULL,
  effective_to DATE DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_shift_assign_org FOREIGN KEY (organization_id) REFERENCES organizations(id),
  CONSTRAINT fk_shift_assign_employee FOREIGN KEY (employee_id) REFERENCES employees(id),
  CONSTRAINT fk_shift_assign_shift FOREIGN KEY (shift_id) REFERENCES attendance_shifts(id),
  INDEX idx_shift_assign_emp_from_to (employee_id, effective_from, COALESCE(effective_to, '9999-12-31')),
  INDEX idx_shift_assign_org_emp (organization_id, employee_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


