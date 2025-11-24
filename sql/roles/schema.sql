-- ============================================================================
-- Roles Module Schema
-- ============================================================================
-- This file contains the role-related tables
-- ============================================================================

-- ============================================================================
-- 1. ROLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS roles (
  roleid VARCHAR(10) NOT NULL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description VARCHAR(500) DEFAULT NULL,
  permissions JSON DEFAULT NULL,
  is_active VARCHAR(1) DEFAULT 'N',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_role_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
