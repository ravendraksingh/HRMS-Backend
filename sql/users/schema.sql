-- ============================================================================
-- Users Module Schema
-- ============================================================================
-- This file contains the user-related tables
-- ============================================================================

-- ============================================================================
-- 1. USERS
-- ============================================================================

CREATE TABLE IF NOT EXISTS users (
  empid VARCHAR(10) NOT NULL PRIMARY KEY,
  username VARCHAR(100) NOT NULL,
  password VARCHAR(255) NOT NULL,
  is_active VARCHAR(1) NOT NULL DEFAULT 'N',
  last_login TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_users_employee FOREIGN KEY (empid) REFERENCES employees(empid) ON DELETE CASCADE,
  UNIQUE KEY uk_username (username)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 2. USER ROLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_roles (
  id SMALLINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  empid VARCHAR(10) NOT NULL,
  roleid VARCHAR(10) NOT NULL,
  assigned_by VARCHAR(10) DEFAULT NULL COMMENT 'Employee ID of the user who assigned this role',
  assigned_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_user_roles_user FOREIGN KEY (empid) REFERENCES users(empid) ON DELETE CASCADE,
  CONSTRAINT fk_user_roles_role FOREIGN KEY (roleid) REFERENCES roles(roleid) ON DELETE CASCADE,
  CONSTRAINT fk_user_roles_assigned_by FOREIGN KEY (assigned_by) REFERENCES users(empid) ON DELETE SET NULL,
  UNIQUE KEY uk_user_role (empid, roleid),
  INDEX idx_user_roles_user (empid),
  INDEX idx_user_roles_role (roleid),
  INDEX idx_user_roles_assigned_by (assigned_by)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 3. REFRESH TOKENS
-- ============================================================================

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id SMALLINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  empid VARCHAR(10) NOT NULL,
  token VARCHAR(255) NOT NULL COMMENT 'Hashed refresh token (SHA256)',
  device_info VARCHAR(500) DEFAULT NULL COMMENT 'Device/browser info for tracking',
  ip_address VARCHAR(45) DEFAULT NULL COMMENT 'IP address of the client',
  expires_at TIMESTAMP NOT NULL COMMENT 'Token expiration timestamp',
  revoked_at TIMESTAMP NULL DEFAULT NULL COMMENT 'Timestamp when token was revoked (NULL if active)',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_refresh_tokens_user FOREIGN KEY (empid) REFERENCES users(empid) ON DELETE CASCADE,
  INDEX idx_refresh_tokens_user (empid),
  INDEX idx_refresh_tokens_token (token),
  INDEX idx_refresh_tokens_expires (expires_at),
  INDEX idx_refresh_tokens_active (token, revoked_at, expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
