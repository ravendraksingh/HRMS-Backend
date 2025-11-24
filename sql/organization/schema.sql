-- ============================================================================
-- Organization Module Schema
-- ============================================================================
-- This file contains the organization-related tables
-- ============================================================================

-- ============================================================================
-- 1. ORGANIZATION
-- ============================================================================

CREATE TABLE IF NOT EXISTS organization (
  orgid VARCHAR(10) NOT NULL PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  short_name VARCHAR(50) DEFAULT NULL,
  logo_url VARCHAR(500) DEFAULT NULL,
  is_active VARCHAR(1) DEFAULT 'N',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_org_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 2. OFFICE LOCATIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS office_locations (
  id TINYINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  address_line1 VARCHAR(200) NOT NULL,
  address_line2 VARCHAR(200) DEFAULT NULL,
  city VARCHAR(100) NOT NULL,
  state VARCHAR(100) NOT NULL,
  postal_code VARCHAR(20) NOT NULL,
  country VARCHAR(100) NOT NULL,
  phone VARCHAR(30) DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_location_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
