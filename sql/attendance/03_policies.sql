CREATE TABLE IF NOT EXISTS attendance_policies (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  organization_id BIGINT UNSIGNED NOT NULL,
  name VARCHAR(150) NOT NULL,
  grace_in_minutes SMALLINT NOT NULL DEFAULT 0,
  late_threshold_minutes SMALLINT NOT NULL DEFAULT 0,
  half_day_threshold_minutes SMALLINT NOT NULL DEFAULT 240,
  overtime_minimum_minutes SMALLINT NOT NULL DEFAULT 30,
  rounding_policy ENUM('none','up','down','nearest') NOT NULL DEFAULT 'none',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_att_policies_org FOREIGN KEY (organization_id) REFERENCES organizations(id),
  UNIQUE KEY uk_policy_org_name (organization_id, name),
  INDEX idx_policy_org (organization_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


