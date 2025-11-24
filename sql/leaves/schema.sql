-- ============================================================================
-- Leaves Module Schema
-- ============================================================================
-- This file contains the leave and holiday-related tables
-- ============================================================================

-- ============================================================================
-- 1. LEAVE TYPES
-- ============================================================================
-- Types of leaves (Sick, Casual, Annual, etc.) - Managed by HR Manager

CREATE TABLE IF NOT EXISTS leave_types (
  leavetype_id VARCHAR(3) NOT NULL PRIMARY KEY,
  name VARCHAR(50) NOT NULL COMMENT 'Leave type name (e.g., Sick Leave, Casual Leave)',
  description VARCHAR(200) DEFAULT NULL,
  max_leaves_per_year INT UNSIGNED DEFAULT NULL COMMENT 'Maximum leaves allowed per year (NULL for unlimited)',
  carry_forward VARCHAR(1) DEFAULT 'N' COMMENT 'Y if leaves can be carried forward, N if not',
  max_carry_forward INT UNSIGNED DEFAULT 0 COMMENT 'Maximum leaves that can be carried forward',
  requires_approval VARCHAR(1) DEFAULT 'Y' COMMENT 'Y if requires approval, N if auto-approved',
  requires_medical_certificate VARCHAR(1) DEFAULT 'N' COMMENT 'Y if medical certificate required',
  is_active VARCHAR(1) DEFAULT 'Y' COMMENT 'Y if active, N if inactive',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_leave_type_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 2. HOLIDAYS
-- ============================================================================
-- Company holidays - Managed by HR Manager

CREATE TABLE IF NOT EXISTS holidays (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(200) NOT NULL COMMENT 'Holiday name (e.g., Republic Day, Diwali)',
  holiday_date DATE NOT NULL,
  is_optional VARCHAR(1) DEFAULT 'N' COMMENT 'Y if optional holiday, N if mandatory',
  description VARCHAR(500) DEFAULT NULL,
  created_by VARCHAR(10) DEFAULT NULL COMMENT 'Employee ID of creator',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_holidays_created_by FOREIGN KEY (created_by) REFERENCES employees(empid) ON DELETE SET NULL,
  INDEX idx_holiday_date (holiday_date),
  INDEX idx_holiday_year (holiday_date),
  UNIQUE KEY uk_holiday_date (holiday_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 3. LEAVE BALANCES
-- ============================================================================
-- Current leave balances per employee per leave type

CREATE TABLE IF NOT EXISTS leave_balances (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  empid VARCHAR(10) NOT NULL,
  leavetype_id VARCHAR(3) NOT NULL,
  year YEAR NOT NULL COMMENT 'Year for which balance is tracked',
  opening_balance DECIMAL(5, 2) DEFAULT 0 COMMENT 'Opening balance at start of year',
  earned_leaves DECIMAL(5, 2) DEFAULT 0 COMMENT 'Leaves earned during the year',
  used_leaves DECIMAL(5, 2) DEFAULT 0 COMMENT 'Leaves used during the year',
  current_balance DECIMAL(5, 2) GENERATED ALWAYS AS (opening_balance + earned_leaves - used_leaves) STORED COMMENT 'Current available balance',
  carry_forward_balance DECIMAL(5, 2) DEFAULT 0 COMMENT 'Balance carried forward from previous year',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_leave_balances_employee FOREIGN KEY (empid) REFERENCES employees(empid) ON DELETE CASCADE,
  CONSTRAINT fk_leave_balances_leave_type FOREIGN KEY (leavetype_id) REFERENCES leave_types(leavetype_id) ON DELETE CASCADE,
  UNIQUE KEY uk_leave_balance_employee_type_year (empid, leavetype_id, year),
  INDEX idx_leave_balances_employee (empid),
  INDEX idx_leave_balances_year (year),
  INDEX idx_leave_balances_leave_type (leavetype_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 4. LEAVES
-- ============================================================================
-- Leave applications/requests

CREATE TABLE IF NOT EXISTS leaves (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  empid VARCHAR(10) NOT NULL,
  leavetype_id VARCHAR(3) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  total_days DECIMAL(4, 2) NOT NULL COMMENT 'Total number of leave days',
  reason VARCHAR(500) DEFAULT NULL COMMENT 'Reason for leave',
  medical_certificate_url VARCHAR(500) DEFAULT NULL COMMENT 'URL to medical certificate if required',
  status VARCHAR(20) DEFAULT 'PENDING' COMMENT 'PENDING, APPROVED, REJECTED, CANCELLED',
  applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  approved_by VARCHAR(10) DEFAULT NULL COMMENT 'Employee ID of approver',
  approved_at TIMESTAMP NULL DEFAULT NULL,
  rejection_reason VARCHAR(500) DEFAULT NULL COMMENT 'Reason if rejected',
  cancelled_at TIMESTAMP NULL DEFAULT NULL,
  remarks VARCHAR(500) DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_leaves_employee FOREIGN KEY (empid) REFERENCES employees(empid) ON DELETE CASCADE,
  CONSTRAINT fk_leaves_leave_type FOREIGN KEY (leavetype_id) REFERENCES leave_types(leavetype_id) ON DELETE CASCADE,
  CONSTRAINT fk_leaves_approved_by FOREIGN KEY (approved_by) REFERENCES employees(empid) ON DELETE SET NULL,
  INDEX idx_leaves_employee (empid),
  INDEX idx_leaves_dates (start_date, end_date),
  INDEX idx_leaves_status (status),
  INDEX idx_leaves_leave_type (leavetype_id),
  INDEX idx_leaves_applied_at (applied_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

