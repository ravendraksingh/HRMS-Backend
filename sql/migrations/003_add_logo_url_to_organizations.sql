-- Migration: Add logo_url column to organizations table
-- Date: 2024

ALTER TABLE organizations 
  ADD COLUMN logo_url VARCHAR(500) DEFAULT NULL COMMENT 'URL or path to organization logo';

-- Verification query (run manually to verify):
-- SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE 
-- FROM INFORMATION_SCHEMA.COLUMNS 
-- WHERE TABLE_SCHEMA = DATABASE() 
--   AND TABLE_NAME = 'organizations' 
--   AND COLUMN_NAME = 'logo_url';

