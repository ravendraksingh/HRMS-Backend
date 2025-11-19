CREATE TABLE IF NOT EXISTS attendance_holidays (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  organization_id BIGINT UNSIGNED NOT NULL,
  holiday_date DATE NOT NULL,
  name VARCHAR(150) NOT NULL,
  type ENUM('public','company','regional') NOT NULL DEFAULT 'company',
  region VARCHAR(50) DEFAULT NULL,
  is_optional TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_att_holidays_org FOREIGN KEY (organization_id) REFERENCES organizations(id),
  UNIQUE KEY uk_holiday_org_date_region (organization_id, holiday_date, COALESCE(region, 'ALL')),
  INDEX idx_holiday_org (organization_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


