-- ============================================================================
-- Documents Module Schema
-- ============================================================================
-- This file contains the document management-related tables
-- ============================================================================

-- ============================================================================
-- 1. DOCUMENT CATEGORIES
-- ============================================================================
-- Categories for organizing documents (Employment Contracts, Policies, Training, Legal Forms, etc.)

CREATE TABLE IF NOT EXISTS document_categories (
  categoryid VARCHAR(10) NOT NULL PRIMARY KEY,
  name VARCHAR(100) NOT NULL COMMENT 'Category name (e.g., Employment Contracts, Company Policies, Training Materials, Legal Forms)',
  description VARCHAR(500) DEFAULT NULL,
  parent_categoryid VARCHAR(10) DEFAULT NULL COMMENT 'Parent category for hierarchical organization',
  is_active VARCHAR(1) DEFAULT 'Y' COMMENT 'Y if active, N if inactive',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_doc_categories_parent FOREIGN KEY (parent_categoryid) REFERENCES document_categories(categoryid) ON DELETE SET NULL,
  UNIQUE KEY uk_category_name (name),
  INDEX idx_category_parent (parent_categoryid)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 2. DOCUMENTS
-- ============================================================================
-- Main documents table storing all document metadata

CREATE TABLE IF NOT EXISTS documents (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  document_code VARCHAR(50) DEFAULT NULL COMMENT 'Unique document code/identifier',
  title VARCHAR(200) NOT NULL COMMENT 'Document title',
  description TEXT DEFAULT NULL COMMENT 'Document description',
  categoryid VARCHAR(10) NOT NULL COMMENT 'Document category',
  document_type VARCHAR(50) DEFAULT NULL COMMENT 'pdf, doc, docx, xls, xlsx, ppt, pptx, image, etc.',
  file_url VARCHAR(500) NOT NULL COMMENT 'URL or path to the document file',
  file_size BIGINT UNSIGNED DEFAULT NULL COMMENT 'File size in bytes',
  file_hash VARCHAR(255) DEFAULT NULL COMMENT 'File hash for integrity verification (SHA256)',
  version VARCHAR(20) DEFAULT '1.0' COMMENT 'Document version',
  is_template VARCHAR(1) DEFAULT 'N' COMMENT 'Y if template document, N if regular document',
  is_confidential VARCHAR(1) DEFAULT 'N' COMMENT 'Y if confidential, N if not',
  requires_acknowledgment VARCHAR(1) DEFAULT 'N' COMMENT 'Y if employee acknowledgment required, N if not',
  effective_from DATE DEFAULT NULL COMMENT 'Date from which document is effective',
  effective_to DATE DEFAULT NULL COMMENT 'Date until which document is valid (NULL if ongoing)',
  expiry_date DATE DEFAULT NULL COMMENT 'Document expiry date (for contracts, certificates, etc.)',
  status VARCHAR(20) DEFAULT 'ACTIVE' COMMENT 'ACTIVE, DRAFT, ARCHIVED, EXPIRED',
  uploaded_by VARCHAR(10) DEFAULT NULL COMMENT 'Employee ID who uploaded the document',
  approved_by VARCHAR(10) DEFAULT NULL COMMENT 'Employee ID who approved the document',
  approved_at TIMESTAMP NULL DEFAULT NULL,
  tags JSON DEFAULT NULL COMMENT 'Tags for search and filtering',
  metadata JSON DEFAULT NULL COMMENT 'Additional metadata in JSON format',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_documents_category FOREIGN KEY (categoryid) REFERENCES document_categories(categoryid) ON DELETE RESTRICT,
  CONSTRAINT fk_documents_uploaded_by FOREIGN KEY (uploaded_by) REFERENCES employees(empid) ON DELETE SET NULL,
  CONSTRAINT fk_documents_approved_by FOREIGN KEY (approved_by) REFERENCES employees(empid) ON DELETE SET NULL,
  UNIQUE KEY uk_document_code (document_code),
  INDEX idx_documents_category (categoryid),
  INDEX idx_documents_status (status),
  INDEX idx_documents_effective_dates (effective_from, effective_to),
  INDEX idx_documents_expiry (expiry_date),
  INDEX idx_documents_uploaded_by (uploaded_by)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 3. DOCUMENT ASSIGNMENTS
-- ============================================================================
-- Assign documents to employees, departments, or roles for access control

CREATE TABLE IF NOT EXISTS document_assignments (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  document_id INT UNSIGNED NOT NULL,
  assignment_type VARCHAR(20) NOT NULL COMMENT 'EMPLOYEE, DEPARTMENT, ROLE, ALL',
  empid VARCHAR(10) DEFAULT NULL COMMENT 'Employee ID (if assignment_type is EMPLOYEE)',
  deptid VARCHAR(10) DEFAULT NULL COMMENT 'Department ID (if assignment_type is DEPARTMENT)',
  roleid VARCHAR(10) DEFAULT NULL COMMENT 'Role ID (if assignment_type is ROLE)',
  is_required VARCHAR(1) DEFAULT 'N' COMMENT 'Y if document is required for this assignment, N if optional',
  access_level VARCHAR(20) DEFAULT 'VIEW' COMMENT 'VIEW, DOWNLOAD, EDIT, DELETE',
  assigned_by VARCHAR(10) DEFAULT NULL COMMENT 'Employee ID who made this assignment',
  assigned_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at DATE DEFAULT NULL COMMENT 'Date when assignment expires (NULL if no expiry)',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_doc_assignments_document FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
  CONSTRAINT fk_doc_assignments_employee FOREIGN KEY (empid) REFERENCES employees(empid) ON DELETE CASCADE,
  CONSTRAINT fk_doc_assignments_department FOREIGN KEY (deptid) REFERENCES departments(deptid) ON DELETE CASCADE,
  CONSTRAINT fk_doc_assignments_role FOREIGN KEY (roleid) REFERENCES roles(roleid) ON DELETE CASCADE,
  CONSTRAINT fk_doc_assignments_assigned_by FOREIGN KEY (assigned_by) REFERENCES employees(empid) ON DELETE SET NULL,
  INDEX idx_doc_assignments_document (document_id),
  INDEX idx_doc_assignments_employee (empid),
  INDEX idx_doc_assignments_department (deptid),
  INDEX idx_doc_assignments_role (roleid),
  INDEX idx_doc_assignments_type (assignment_type),
  INDEX idx_doc_assignments_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 4. DOCUMENT VERSIONS
-- ============================================================================
-- Track document versions for version control

CREATE TABLE IF NOT EXISTS document_versions (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  document_id INT UNSIGNED NOT NULL COMMENT 'Reference to main document',
  version VARCHAR(20) NOT NULL COMMENT 'Version number (e.g., 1.0, 1.1, 2.0)',
  file_url VARCHAR(500) NOT NULL COMMENT 'URL or path to this version of the document',
  file_size BIGINT UNSIGNED DEFAULT NULL COMMENT 'File size in bytes',
  file_hash VARCHAR(255) DEFAULT NULL COMMENT 'File hash for integrity verification',
  change_summary TEXT DEFAULT NULL COMMENT 'Summary of changes in this version',
  is_current VARCHAR(1) DEFAULT 'N' COMMENT 'Y if this is the current version, N if not',
  created_by VARCHAR(10) DEFAULT NULL COMMENT 'Employee ID who created this version',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_doc_versions_document FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
  CONSTRAINT fk_doc_versions_created_by FOREIGN KEY (created_by) REFERENCES employees(empid) ON DELETE SET NULL,
  UNIQUE KEY uk_doc_version (document_id, version),
  INDEX idx_doc_versions_document (document_id),
  INDEX idx_doc_versions_current (is_current)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 5. DOCUMENT ACKNOWLEDGMENTS
-- ============================================================================
-- Track employee acknowledgments for required documents (policies, contracts, etc.)

CREATE TABLE IF NOT EXISTS document_acknowledgments (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  document_id INT UNSIGNED NOT NULL,
  empid VARCHAR(10) NOT NULL,
  acknowledged_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Timestamp when employee acknowledged',
  ip_address VARCHAR(45) DEFAULT NULL COMMENT 'IP address from which acknowledgment was made',
  user_agent VARCHAR(500) DEFAULT NULL COMMENT 'Browser/user agent information',
  remarks VARCHAR(500) DEFAULT NULL COMMENT 'Employee remarks or comments',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_doc_acknowledgments_document FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
  CONSTRAINT fk_doc_acknowledgments_employee FOREIGN KEY (empid) REFERENCES employees(empid) ON DELETE CASCADE,
  UNIQUE KEY uk_doc_ack_employee_document (document_id, empid),
  INDEX idx_doc_acknowledgments_document (document_id),
  INDEX idx_doc_acknowledgments_employee (empid),
  INDEX idx_doc_acknowledgments_date (acknowledged_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 6. EMPLOYEE DOCUMENTS
-- ============================================================================
-- Employee-specific documents (employment contracts, certificates, ID proofs, etc.)

CREATE TABLE IF NOT EXISTS employee_documents (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  empid VARCHAR(10) NOT NULL,
  document_id INT UNSIGNED DEFAULT NULL COMMENT 'Reference to documents table (if document exists in library)',
  document_type VARCHAR(50) NOT NULL COMMENT 'CONTRACT, CERTIFICATE, ID_PROOF, RESUME, OFFER_LETTER, APPOINTMENT_LETTER, etc.',
  title VARCHAR(200) NOT NULL COMMENT 'Document title',
  description TEXT DEFAULT NULL,
  file_url VARCHAR(500) NOT NULL COMMENT 'URL or path to the document file',
  file_size BIGINT UNSIGNED DEFAULT NULL COMMENT 'File size in bytes',
  file_hash VARCHAR(255) DEFAULT NULL COMMENT 'File hash for integrity verification',
  issue_date DATE DEFAULT NULL COMMENT 'Document issue date',
  expiry_date DATE DEFAULT NULL COMMENT 'Document expiry date (for certificates, IDs, etc.)',
  issued_by VARCHAR(200) DEFAULT NULL COMMENT 'Organization/authority that issued the document',
  is_verified VARCHAR(1) DEFAULT 'N' COMMENT 'Y if verified by HR, N if not',
  verified_by VARCHAR(10) DEFAULT NULL COMMENT 'Employee ID who verified this document',
  verified_at TIMESTAMP NULL DEFAULT NULL,
  uploaded_by VARCHAR(10) DEFAULT NULL COMMENT 'Employee ID who uploaded the document',
  is_confidential VARCHAR(1) DEFAULT 'N' COMMENT 'Y if confidential, N if not',
  status VARCHAR(20) DEFAULT 'ACTIVE' COMMENT 'ACTIVE, EXPIRED, REVOKED, ARCHIVED',
  tags JSON DEFAULT NULL COMMENT 'Tags for search and filtering',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_employee_documents_employee FOREIGN KEY (empid) REFERENCES employees(empid) ON DELETE CASCADE,
  CONSTRAINT fk_employee_documents_document FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE SET NULL,
  CONSTRAINT fk_employee_documents_verified_by FOREIGN KEY (verified_by) REFERENCES employees(empid) ON DELETE SET NULL,
  CONSTRAINT fk_employee_documents_uploaded_by FOREIGN KEY (uploaded_by) REFERENCES employees(empid) ON DELETE SET NULL,
  INDEX idx_employee_documents_employee (empid),
  INDEX idx_employee_documents_type (document_type),
  INDEX idx_employee_documents_status (status),
  INDEX idx_employee_documents_expiry (expiry_date),
  INDEX idx_employee_documents_verified (is_verified)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 7. DOCUMENT DOWNLOAD LOGS
-- ============================================================================
-- Track document downloads for audit and compliance

CREATE TABLE IF NOT EXISTS document_download_logs (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  document_id INT UNSIGNED NOT NULL,
  empid VARCHAR(10) DEFAULT NULL COMMENT 'Employee ID who downloaded (NULL if anonymous)',
  downloaded_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ip_address VARCHAR(45) DEFAULT NULL COMMENT 'IP address from which download was made',
  user_agent VARCHAR(500) DEFAULT NULL COMMENT 'Browser/user agent information',
  file_size BIGINT UNSIGNED DEFAULT NULL COMMENT 'Size of downloaded file',
  CONSTRAINT fk_doc_download_logs_document FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
  CONSTRAINT fk_doc_download_logs_employee FOREIGN KEY (empid) REFERENCES employees(empid) ON DELETE SET NULL,
  INDEX idx_doc_download_logs_document (document_id),
  INDEX idx_doc_download_logs_employee (empid),
  INDEX idx_doc_download_logs_date (downloaded_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

