CREATE TABLE IF NOT EXISTS attendance_exceptions (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  organization_id BIGINT UNSIGNED NOT NULL,
  attendance_id BIGINT UNSIGNED NOT NULL,
  kind ENUM('missing_in','missing_out','regularization','other') NOT NULL,
  requested_by BIGINT UNSIGNED NOT NULL,
  requested_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  reviewer_id BIGINT UNSIGNED DEFAULT NULL,
  reviewed_at TIMESTAMP NULL DEFAULT NULL,
  comment VARCHAR(500) DEFAULT NULL,
  CONSTRAINT fk_exc_org FOREIGN KEY (organization_id) REFERENCES organizations(id),
  CONSTRAINT fk_exc_att FOREIGN KEY (attendance_id) REFERENCES attendance_records(id),
  INDEX idx_exc_att_status (attendance_id, status),
  INDEX idx_exc_org (organization_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


