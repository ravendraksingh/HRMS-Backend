CREATE TABLE IF NOT EXISTS attendance_audit_logs (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  organization_id BIGINT UNSIGNED NOT NULL,
  entity_type ENUM('record','leave','overtime','shift_assign','policy','holiday') NOT NULL,
  entity_id BIGINT UNSIGNED NOT NULL,
  action ENUM('create','update','approve','reject','import','clock_in','clock_out') NOT NULL,
  actor_id BIGINT UNSIGNED DEFAULT NULL,
  payload JSON DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_audit_org FOREIGN KEY (organization_id) REFERENCES organizations(id),
  INDEX idx_audit_entity (entity_type, entity_id),
  INDEX idx_audit_action_time (action, created_at),
  INDEX idx_audit_org (organization_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


