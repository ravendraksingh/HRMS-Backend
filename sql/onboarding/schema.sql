-- ============================================================================
-- Onboarding and Offboarding Module Schema
-- ============================================================================
-- This file contains the onboarding and offboarding-related tables
-- ============================================================================

-- ============================================================================
-- 1. ONBOARDING CHECKLISTS
-- ============================================================================
-- Template checklists for onboarding process

CREATE TABLE IF NOT EXISTS onboarding_checklists (
  checklistid VARCHAR(10) NOT NULL PRIMARY KEY,
  name VARCHAR(200) NOT NULL COMMENT 'Checklist name (e.g., Standard Onboarding, Executive Onboarding)',
  description VARCHAR(500) DEFAULT NULL,
  department_id VARCHAR(10) DEFAULT NULL COMMENT 'Department-specific checklist (NULL for all departments)',
  roleid VARCHAR(10) DEFAULT NULL COMMENT 'Role-specific checklist (NULL for all roles)',
  is_default VARCHAR(1) DEFAULT 'N' COMMENT 'Y if default checklist, N if custom',
  is_active VARCHAR(1) DEFAULT 'Y' COMMENT 'Y if active, N if inactive',
  created_by VARCHAR(10) DEFAULT NULL COMMENT 'Employee ID who created the checklist',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_onboarding_checklists_department FOREIGN KEY (department_id) REFERENCES departments(deptid) ON DELETE SET NULL,
  CONSTRAINT fk_onboarding_checklists_role FOREIGN KEY (roleid) REFERENCES roles(roleid) ON DELETE SET NULL,
  CONSTRAINT fk_onboarding_checklists_created_by FOREIGN KEY (created_by) REFERENCES employees(empid) ON DELETE SET NULL,
  UNIQUE KEY uk_checklist_name (name),
  INDEX idx_onboarding_checklists_department (department_id),
  INDEX idx_onboarding_checklists_role (roleid)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 2. ONBOARDING CHECKLIST ITEMS
-- ============================================================================
-- Individual items/tasks in onboarding checklists

CREATE TABLE IF NOT EXISTS onboarding_checklist_items (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  checklistid VARCHAR(10) NOT NULL,
  item_name VARCHAR(200) NOT NULL COMMENT 'Task/item name',
  description VARCHAR(500) DEFAULT NULL,
  item_type VARCHAR(50) NOT NULL COMMENT 'DOCUMENT, EQUIPMENT, TRAINING, ACCESS, COMPLIANCE, OTHER',
  category VARCHAR(50) DEFAULT NULL COMMENT 'HR, IT, ADMIN, FINANCE, etc.',
  is_required VARCHAR(1) DEFAULT 'Y' COMMENT 'Y if required, N if optional',
  is_mandatory VARCHAR(1) DEFAULT 'Y' COMMENT 'Y if mandatory (cannot skip), N if can be skipped',
  due_days INT DEFAULT 0 COMMENT 'Days from start date when this item is due (0 = immediate)',
  assigned_to_role VARCHAR(10) DEFAULT NULL COMMENT 'Role responsible for completing this task',
  instructions TEXT DEFAULT NULL COMMENT 'Instructions for completing this task',
  document_template_id INT UNSIGNED DEFAULT NULL COMMENT 'Reference to document template if applicable',
  sort_order INT UNSIGNED DEFAULT 0 COMMENT 'Display order',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_checklist_items_checklist FOREIGN KEY (checklistid) REFERENCES onboarding_checklists(checklistid) ON DELETE CASCADE,
  CONSTRAINT fk_checklist_items_role FOREIGN KEY (assigned_to_role) REFERENCES roles(roleid) ON DELETE SET NULL,
  INDEX idx_checklist_items_checklist (checklistid),
  INDEX idx_checklist_items_type (item_type),
  INDEX idx_checklist_items_category (category)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 3. ONBOARDING SESSIONS
-- ============================================================================
-- Onboarding sessions for new employees

CREATE TABLE IF NOT EXISTS onboarding_sessions (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  empid VARCHAR(10) NOT NULL COMMENT 'Employee being onboarded',
  checklistid VARCHAR(10) NOT NULL COMMENT 'Checklist being used',
  start_date DATE NOT NULL COMMENT 'Onboarding start date',
  expected_completion_date DATE DEFAULT NULL COMMENT 'Expected completion date',
  actual_completion_date DATE DEFAULT NULL COMMENT 'Actual completion date',
  status VARCHAR(20) DEFAULT 'IN_PROGRESS' COMMENT 'NOT_STARTED, IN_PROGRESS, COMPLETED, ON_HOLD, CANCELLED',
  assigned_to VARCHAR(10) DEFAULT NULL COMMENT 'Employee ID assigned to manage this onboarding',
  progress_percentage DECIMAL(5, 2) DEFAULT 0 COMMENT 'Completion percentage',
  notes TEXT DEFAULT NULL COMMENT 'Additional notes',
  created_by VARCHAR(10) DEFAULT NULL COMMENT 'Employee ID who initiated onboarding',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_onboarding_sessions_employee FOREIGN KEY (empid) REFERENCES employees(empid) ON DELETE CASCADE,
  CONSTRAINT fk_onboarding_sessions_checklist FOREIGN KEY (checklistid) REFERENCES onboarding_checklists(checklistid) ON DELETE RESTRICT,
  CONSTRAINT fk_onboarding_sessions_assigned_to FOREIGN KEY (assigned_to) REFERENCES employees(empid) ON DELETE SET NULL,
  CONSTRAINT fk_onboarding_sessions_created_by FOREIGN KEY (created_by) REFERENCES employees(empid) ON DELETE SET NULL,
  INDEX idx_onboarding_sessions_employee (empid),
  INDEX idx_onboarding_sessions_status (status),
  INDEX idx_onboarding_sessions_assigned_to (assigned_to),
  INDEX idx_onboarding_sessions_dates (start_date, expected_completion_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 4. ONBOARDING TASK COMPLETIONS
-- ============================================================================
-- Track completion of individual onboarding tasks

CREATE TABLE IF NOT EXISTS onboarding_task_completions (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  onboarding_session_id INT UNSIGNED NOT NULL,
  checklist_item_id INT UNSIGNED NOT NULL,
  status VARCHAR(20) DEFAULT 'PENDING' COMMENT 'PENDING, IN_PROGRESS, COMPLETED, SKIPPED, BLOCKED',
  completed_by VARCHAR(10) DEFAULT NULL COMMENT 'Employee ID who completed the task',
  completed_at TIMESTAMP NULL DEFAULT NULL COMMENT 'Timestamp when task was completed',
  due_date DATE DEFAULT NULL COMMENT 'Task due date',
  notes TEXT DEFAULT NULL COMMENT 'Notes or comments',
  attachment_url VARCHAR(500) DEFAULT NULL COMMENT 'URL to attached file/document',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_task_completions_session FOREIGN KEY (onboarding_session_id) REFERENCES onboarding_sessions(id) ON DELETE CASCADE,
  CONSTRAINT fk_task_completions_item FOREIGN KEY (checklist_item_id) REFERENCES onboarding_checklist_items(id) ON DELETE CASCADE,
  CONSTRAINT fk_task_completions_completed_by FOREIGN KEY (completed_by) REFERENCES employees(empid) ON DELETE SET NULL,
  UNIQUE KEY uk_task_completion (onboarding_session_id, checklist_item_id),
  INDEX idx_task_completions_session (onboarding_session_id),
  INDEX idx_task_completions_status (status),
  INDEX idx_task_completions_due_date (due_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 5. EQUIPMENT ISSUANCE
-- ============================================================================
-- Track equipment issued to employees during onboarding

CREATE TABLE IF NOT EXISTS equipment_issuance (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  empid VARCHAR(10) NOT NULL,
  equipment_type VARCHAR(100) NOT NULL COMMENT 'LAPTOP, MOBILE, KEY_CARD, BADGE, UNIFORM, etc.',
  equipment_name VARCHAR(200) NOT NULL COMMENT 'Equipment name/model',
  serial_number VARCHAR(100) DEFAULT NULL COMMENT 'Serial number or identifier',
  issued_date DATE NOT NULL COMMENT 'Date equipment was issued',
  expected_return_date DATE DEFAULT NULL COMMENT 'Expected return date (for temporary equipment)',
  actual_return_date DATE DEFAULT NULL COMMENT 'Actual return date',
  condition_on_issue VARCHAR(50) DEFAULT NULL COMMENT 'NEW, GOOD, FAIR, etc.',
  condition_on_return VARCHAR(50) DEFAULT NULL COMMENT 'GOOD, DAMAGED, LOST, etc.',
  issued_by VARCHAR(10) DEFAULT NULL COMMENT 'Employee ID who issued the equipment',
  received_by VARCHAR(10) DEFAULT NULL COMMENT 'Employee ID who received (usually the employee)',
  return_received_by VARCHAR(10) DEFAULT NULL COMMENT 'Employee ID who received the return',
  status VARCHAR(20) DEFAULT 'ISSUED' COMMENT 'ISSUED, RETURNED, LOST, DAMAGED',
  notes TEXT DEFAULT NULL COMMENT 'Additional notes',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_equipment_issuance_employee FOREIGN KEY (empid) REFERENCES employees(empid) ON DELETE CASCADE,
  CONSTRAINT fk_equipment_issuance_issued_by FOREIGN KEY (issued_by) REFERENCES employees(empid) ON DELETE SET NULL,
  CONSTRAINT fk_equipment_issuance_received_by FOREIGN KEY (received_by) REFERENCES employees(empid) ON DELETE SET NULL,
  CONSTRAINT fk_equipment_issuance_return_received_by FOREIGN KEY (return_received_by) REFERENCES employees(empid) ON DELETE SET NULL,
  INDEX idx_equipment_issuance_employee (empid),
  INDEX idx_equipment_issuance_type (equipment_type),
  INDEX idx_equipment_issuance_status (status),
  INDEX idx_equipment_issuance_dates (issued_date, expected_return_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 6. OFFBOARDING CHECKLISTS
-- ============================================================================
-- Template checklists for offboarding process

CREATE TABLE IF NOT EXISTS offboarding_checklists (
  checklistid VARCHAR(10) NOT NULL PRIMARY KEY,
  name VARCHAR(200) NOT NULL COMMENT 'Checklist name (e.g., Standard Offboarding, Executive Offboarding)',
  description VARCHAR(500) DEFAULT NULL,
  department_id VARCHAR(10) DEFAULT NULL COMMENT 'Department-specific checklist (NULL for all departments)',
  roleid VARCHAR(10) DEFAULT NULL COMMENT 'Role-specific checklist (NULL for all roles)',
  is_default VARCHAR(1) DEFAULT 'N' COMMENT 'Y if default checklist, N if custom',
  is_active VARCHAR(1) DEFAULT 'Y' COMMENT 'Y if active, N if inactive',
  created_by VARCHAR(10) DEFAULT NULL COMMENT 'Employee ID who created the checklist',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_offboarding_checklists_department FOREIGN KEY (department_id) REFERENCES departments(deptid) ON DELETE SET NULL,
  CONSTRAINT fk_offboarding_checklists_role FOREIGN KEY (roleid) REFERENCES roles(roleid) ON DELETE SET NULL,
  CONSTRAINT fk_offboarding_checklists_created_by FOREIGN KEY (created_by) REFERENCES employees(empid) ON DELETE SET NULL,
  UNIQUE KEY uk_offboarding_checklist_name (name),
  INDEX idx_offboarding_checklists_department (department_id),
  INDEX idx_offboarding_checklists_role (roleid)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 7. OFFBOARDING CHECKLIST ITEMS
-- ============================================================================
-- Individual items/tasks in offboarding checklists

CREATE TABLE IF NOT EXISTS offboarding_checklist_items (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  checklistid VARCHAR(10) NOT NULL,
  item_name VARCHAR(200) NOT NULL COMMENT 'Task/item name',
  description VARCHAR(500) DEFAULT NULL,
  item_type VARCHAR(50) NOT NULL COMMENT 'DOCUMENT, EQUIPMENT_RETURN, ACCESS_REVOKE, EXIT_INTERVIEW, COMPLIANCE, OTHER',
  category VARCHAR(50) DEFAULT NULL COMMENT 'HR, IT, ADMIN, FINANCE, etc.',
  is_required VARCHAR(1) DEFAULT 'Y' COMMENT 'Y if required, N if optional',
  is_mandatory VARCHAR(1) DEFAULT 'Y' COMMENT 'Y if mandatory (cannot skip), N if can be skipped',
  due_days INT DEFAULT 0 COMMENT 'Days from start date when this item is due (0 = immediate)',
  assigned_to_role VARCHAR(10) DEFAULT NULL COMMENT 'Role responsible for completing this task',
  instructions TEXT DEFAULT NULL COMMENT 'Instructions for completing this task',
  sort_order INT UNSIGNED DEFAULT 0 COMMENT 'Display order',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_offboarding_checklist_items_checklist FOREIGN KEY (checklistid) REFERENCES offboarding_checklists(checklistid) ON DELETE CASCADE,
  CONSTRAINT fk_offboarding_checklist_items_role FOREIGN KEY (assigned_to_role) REFERENCES roles(roleid) ON DELETE SET NULL,
  INDEX idx_offboarding_checklist_items_checklist (checklistid),
  INDEX idx_offboarding_checklist_items_type (item_type),
  INDEX idx_offboarding_checklist_items_category (category)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 8. OFFBOARDING SESSIONS
-- ============================================================================
-- Offboarding sessions for employees leaving the organization

CREATE TABLE IF NOT EXISTS offboarding_sessions (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  empid VARCHAR(10) NOT NULL COMMENT 'Employee being offboarded',
  checklistid VARCHAR(10) NOT NULL COMMENT 'Checklist being used',
  separation_type VARCHAR(50) NOT NULL COMMENT 'RESIGNATION, TERMINATION, RETIREMENT, CONTRACT_END, etc.',
  last_working_date DATE NOT NULL COMMENT 'Employee last working date',
  notice_period_days INT DEFAULT 0 COMMENT 'Notice period in days',
  start_date DATE NOT NULL COMMENT 'Offboarding start date',
  expected_completion_date DATE DEFAULT NULL COMMENT 'Expected completion date',
  actual_completion_date DATE DEFAULT NULL COMMENT 'Actual completion date',
  status VARCHAR(20) DEFAULT 'IN_PROGRESS' COMMENT 'NOT_STARTED, IN_PROGRESS, COMPLETED, ON_HOLD, CANCELLED',
  assigned_to VARCHAR(10) DEFAULT NULL COMMENT 'Employee ID assigned to manage this offboarding',
  progress_percentage DECIMAL(5, 2) DEFAULT 0 COMMENT 'Completion percentage',
  exit_interview_date DATE DEFAULT NULL COMMENT 'Exit interview scheduled date',
  exit_interview_conducted_by VARCHAR(10) DEFAULT NULL COMMENT 'Employee ID who conducted exit interview',
  exit_interview_notes TEXT DEFAULT NULL COMMENT 'Exit interview notes',
  reason_for_leaving VARCHAR(500) DEFAULT NULL COMMENT 'Reason for leaving',
  notes TEXT DEFAULT NULL COMMENT 'Additional notes',
  created_by VARCHAR(10) DEFAULT NULL COMMENT 'Employee ID who initiated offboarding',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_offboarding_sessions_employee FOREIGN KEY (empid) REFERENCES employees(empid) ON DELETE CASCADE,
  CONSTRAINT fk_offboarding_sessions_checklist FOREIGN KEY (checklistid) REFERENCES offboarding_checklists(checklistid) ON DELETE RESTRICT,
  CONSTRAINT fk_offboarding_sessions_assigned_to FOREIGN KEY (assigned_to) REFERENCES employees(empid) ON DELETE SET NULL,
  CONSTRAINT fk_offboarding_sessions_created_by FOREIGN KEY (created_by) REFERENCES employees(empid) ON DELETE SET NULL,
  CONSTRAINT fk_offboarding_sessions_exit_interview FOREIGN KEY (exit_interview_conducted_by) REFERENCES employees(empid) ON DELETE SET NULL,
  INDEX idx_offboarding_sessions_employee (empid),
  INDEX idx_offboarding_sessions_status (status),
  INDEX idx_offboarding_sessions_separation_type (separation_type),
  INDEX idx_offboarding_sessions_assigned_to (assigned_to),
  INDEX idx_offboarding_sessions_dates (start_date, last_working_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 9. OFFBOARDING TASK COMPLETIONS
-- ============================================================================
-- Track completion of individual offboarding tasks

CREATE TABLE IF NOT EXISTS offboarding_task_completions (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  offboarding_session_id INT UNSIGNED NOT NULL,
  checklist_item_id INT UNSIGNED NOT NULL,
  status VARCHAR(20) DEFAULT 'PENDING' COMMENT 'PENDING, IN_PROGRESS, COMPLETED, SKIPPED, BLOCKED',
  completed_by VARCHAR(10) DEFAULT NULL COMMENT 'Employee ID who completed the task',
  completed_at TIMESTAMP NULL DEFAULT NULL COMMENT 'Timestamp when task was completed',
  due_date DATE DEFAULT NULL COMMENT 'Task due date',
  notes TEXT DEFAULT NULL COMMENT 'Notes or comments',
  attachment_url VARCHAR(500) DEFAULT NULL COMMENT 'URL to attached file/document',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_offboarding_task_completions_session FOREIGN KEY (offboarding_session_id) REFERENCES offboarding_sessions(id) ON DELETE CASCADE,
  CONSTRAINT fk_offboarding_task_completions_item FOREIGN KEY (checklist_item_id) REFERENCES offboarding_checklist_items(id) ON DELETE CASCADE,
  CONSTRAINT fk_offboarding_task_completions_completed_by FOREIGN KEY (completed_by) REFERENCES employees(empid) ON DELETE SET NULL,
  UNIQUE KEY uk_offboarding_task_completion (offboarding_session_id, checklist_item_id),
  INDEX idx_offboarding_task_completions_session (offboarding_session_id),
  INDEX idx_offboarding_task_completions_status (status),
  INDEX idx_offboarding_task_completions_due_date (due_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

