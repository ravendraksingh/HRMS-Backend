-- Refresh Tokens Table
-- Stores refresh tokens for JWT authentication
-- Tokens are hashed before storage for security

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  organization_id BIGINT UNSIGNED NOT NULL,
  token VARCHAR(255) NOT NULL COMMENT 'Hashed refresh token (SHA256)',
  device_info VARCHAR(500) DEFAULT NULL COMMENT 'Device/browser info for tracking',
  ip_address VARCHAR(45) DEFAULT NULL COMMENT 'IP address of the client',
  expires_at TIMESTAMP NOT NULL COMMENT 'Token expiration timestamp',
  revoked_at TIMESTAMP NULL DEFAULT NULL COMMENT 'Timestamp when token was revoked (NULL if active)',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_refresh_tokens_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_refresh_tokens_org FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
  INDEX idx_refresh_tokens_user (user_id),
  INDEX idx_refresh_tokens_org (organization_id),
  INDEX idx_refresh_tokens_token (token),
  INDEX idx_refresh_tokens_expires (expires_at),
  INDEX idx_refresh_tokens_active (token, revoked_at, expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

