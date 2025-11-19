CREATE TABLE IF NOT EXISTS attendance_shifts (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  organization_id BIGINT UNSIGNED NOT NULL,
  name VARCHAR(100) NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  is_overnight TINYINT(1) NOT NULL DEFAULT 0,
  grace_in_minutes SMALLINT NOT NULL DEFAULT 0,
  default_break_minutes SMALLINT NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT chk_shift_times CHECK (start_time <> end_time),
  CONSTRAINT fk_att_shifts_org FOREIGN KEY (organization_id) REFERENCES organizations(id),
  UNIQUE KEY uk_shift_org_name (organization_id, name),
  INDEX idx_shift_org (organization_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


