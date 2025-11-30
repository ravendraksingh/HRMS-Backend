-- ============================================================================
-- Financial Years Module Schema
-- ============================================================================
-- This file contains the financial years table
-- ============================================================================

-- ============================================================================
-- FINANCIAL YEARS
-- ============================================================================
-- Financial year definitions
-- Financial year runs from 1 April to 31 March (e.g., 1 Apr 2025 to 31 Mar 2026 = 2025-26)
-- Only one financial year can be marked as current (is_current = 'Y')
-- Multiple financial years can be active (is_active = 'Y')

CREATE TABLE IF NOT EXISTS financial_years (
  id SMALLINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  financial_year VARCHAR(7) NOT NULL COMMENT 'Financial year in YYYY-YY format (e.g., 2025-26)',
  start_date DATE NOT NULL COMMENT 'Start date: 1 April YYYY',
  end_date DATE NOT NULL COMMENT 'End date: 31 March YYYY',
  is_current VARCHAR(1) DEFAULT 'N' COMMENT 'Y if current financial year, N otherwise. Only one can be current.',
  is_active VARCHAR(1) DEFAULT 'Y' COMMENT 'Y if active, N if inactive. Multiple can be active.',
  description VARCHAR(500) DEFAULT NULL,
  created_by VARCHAR(10) DEFAULT NULL COMMENT 'Employee ID of creator',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_financial_years_created_by FOREIGN KEY (created_by) REFERENCES employees(empid) ON DELETE SET NULL,
  UNIQUE KEY uk_financial_year (financial_year),
  INDEX idx_financial_year_dates (start_date, end_date),
  INDEX idx_financial_year_current (is_current),
  INDEX idx_financial_year_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Trigger to ensure only one financial year is marked as current
DELIMITER //
CREATE TRIGGER trg_financial_years_single_current
BEFORE UPDATE ON financial_years
FOR EACH ROW
BEGIN
  IF NEW.is_current = 'Y' AND OLD.is_current = 'N' THEN
    -- If setting a new financial year as current, unset all others
    UPDATE financial_years 
    SET is_current = 'N' 
    WHERE id != NEW.id AND is_current = 'Y';
  END IF;
END//
DELIMITER ;

-- Trigger for INSERT to ensure only one financial year is marked as current
DELIMITER //
CREATE TRIGGER trg_financial_years_single_current_insert
BEFORE INSERT ON financial_years
FOR EACH ROW
BEGIN
  IF NEW.is_current = 'Y' THEN
    -- If inserting a new financial year as current, unset all others
    UPDATE financial_years 
    SET is_current = 'N' 
    WHERE is_current = 'Y';
  END IF;
END//
DELIMITER ;

