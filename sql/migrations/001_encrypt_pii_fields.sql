-- ============================================================================
-- Migration: Increase field sizes for encrypted PII data
-- ============================================================================
-- This migration increases the size of PII fields to accommodate encrypted data
-- Encrypted data is larger than plaintext (approximately 2-3x larger)
-- Format: iv:salt:tag:encrypted (all base64 encoded)
-- ============================================================================

-- Employee Personal Details Table
ALTER TABLE employee_personal_details 
  MODIFY pan_number VARCHAR(500) DEFAULT NULL COMMENT 'Encrypted PAN number',
  MODIFY aadhaar_number VARCHAR(500) DEFAULT NULL COMMENT 'Encrypted Aadhaar number',
  MODIFY passport_number VARCHAR(500) DEFAULT NULL COMMENT 'Encrypted Passport number',
  MODIFY driving_license_number VARCHAR(500) DEFAULT NULL COMMENT 'Encrypted Driving License number';

-- Employee Family Dependents Table
ALTER TABLE employee_family_dependents 
  MODIFY aadhaar_number VARCHAR(500) DEFAULT NULL COMMENT 'Encrypted Aadhaar number',
  MODIFY pan_number VARCHAR(500) DEFAULT NULL COMMENT 'Encrypted PAN number',
  MODIFY passport_number VARCHAR(500) DEFAULT NULL COMMENT 'Encrypted Passport number';

-- Add encryption version tracking (optional, for future key rotation)
ALTER TABLE employee_personal_details 
  ADD COLUMN encryption_version TINYINT DEFAULT 1 COMMENT 'Encryption version for key rotation' AFTER driving_license_expiry;

ALTER TABLE employee_family_dependents 
  ADD COLUMN encryption_version TINYINT DEFAULT 1 COMMENT 'Encryption version for key rotation' AFTER passport_expiry;

