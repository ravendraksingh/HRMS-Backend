CREATE TABLE IF NOT EXISTS attendance_records (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  organization_id BIGINT UNSIGNED NOT NULL,
  employee_id BIGINT UNSIGNED NOT NULL,
  work_date DATE NOT NULL,
  shift_id BIGINT UNSIGNED DEFAULT NULL,
  clock_in DATETIME NULL DEFAULT NULL,
  clock_out DATETIME NULL DEFAULT NULL,
  break_minutes SMALLINT NOT NULL DEFAULT 0,
  status ENUM('present','absent','half_day','on_leave','week_off','holiday') NOT NULL DEFAULT 'present',
  source ENUM('web','mobile','import','api') NOT NULL DEFAULT 'web',
  location_in POINT NULL,
  location_out POINT NULL,
  notes VARCHAR(500) DEFAULT NULL,
  approved_by BIGINT UNSIGNED DEFAULT NULL,
  approved_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  worked_minutes INT GENERATED ALWAYS AS (
    IF(clock_in IS NULL OR clock_out IS NULL,
       NULL,
       TIMESTAMPDIFF(MINUTE, clock_in, clock_out) - break_minutes)
  ) STORED,
  CONSTRAINT fk_att_records_org FOREIGN KEY (organization_id) REFERENCES organizations(id),
  CONSTRAINT fk_att_employee FOREIGN KEY (employee_id) REFERENCES employees(id),
  CONSTRAINT fk_att_shift FOREIGN KEY (shift_id) REFERENCES attendance_shifts(id),
  UNIQUE KEY uk_att_unique_day (organization_id, employee_id, work_date),
  INDEX idx_att_emp_date (organization_id, employee_id, work_date),
  INDEX idx_att_status (status),
  CONSTRAINT chk_clock_order CHECK (clock_out IS NULL OR clock_in IS NULL OR clock_out >= clock_in),
  -- Spatial indexes require NOT NULL; columns are optional, so omit indexes
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


