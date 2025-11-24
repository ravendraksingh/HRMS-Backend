-- ============================================================================
-- Reports and Analytics Module Schema
-- ============================================================================
-- This file contains the reporting and analytics-related tables
-- ============================================================================

-- ============================================================================
-- 1. REPORT TEMPLATES
-- ============================================================================
-- Predefined and custom report templates

CREATE TABLE IF NOT EXISTS report_templates (
  templateid VARCHAR(10) NOT NULL PRIMARY KEY,
  name VARCHAR(200) NOT NULL COMMENT 'Report template name',
  description VARCHAR(500) DEFAULT NULL,
  report_type VARCHAR(50) NOT NULL COMMENT 'ATTENDANCE, LEAVE, PAYROLL, EMPLOYEE, DEPARTMENT, CUSTOM',
  category VARCHAR(50) DEFAULT NULL COMMENT 'HR, FINANCE, OPERATIONS, COMPLIANCE, etc.',
  query_sql TEXT DEFAULT NULL COMMENT 'SQL query for the report (if SQL-based)',
  config JSON DEFAULT NULL COMMENT 'Report configuration in JSON format',
  parameters JSON DEFAULT NULL COMMENT 'Report parameters and filters in JSON format',
  is_system_template VARCHAR(1) DEFAULT 'N' COMMENT 'Y if system template, N if user-created',
  is_active VARCHAR(1) DEFAULT 'Y' COMMENT 'Y if active, N if inactive',
  created_by VARCHAR(10) DEFAULT NULL COMMENT 'Employee ID who created the template',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_report_templates_created_by FOREIGN KEY (created_by) REFERENCES employees(empid) ON DELETE SET NULL,
  UNIQUE KEY uk_template_name (name),
  INDEX idx_report_templates_type (report_type),
  INDEX idx_report_templates_category (category)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 2. SAVED REPORTS
-- ============================================================================
-- Saved report instances with specific parameters

CREATE TABLE IF NOT EXISTS saved_reports (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  templateid VARCHAR(10) DEFAULT NULL COMMENT 'Reference to report template (NULL for custom reports)',
  name VARCHAR(200) NOT NULL COMMENT 'Saved report name',
  description VARCHAR(500) DEFAULT NULL,
  report_type VARCHAR(50) NOT NULL COMMENT 'ATTENDANCE, LEAVE, PAYROLL, EMPLOYEE, DEPARTMENT, CUSTOM',
  parameters JSON NOT NULL COMMENT 'Report parameters and filters in JSON format',
  config JSON DEFAULT NULL COMMENT 'Report configuration in JSON format',
  created_by VARCHAR(10) NOT NULL COMMENT 'Employee ID who created the saved report',
  is_shared VARCHAR(1) DEFAULT 'N' COMMENT 'Y if shared with others, N if private',
  shared_with JSON DEFAULT NULL COMMENT 'List of employee IDs or roles with access (JSON array)',
  last_run_at TIMESTAMP NULL DEFAULT NULL COMMENT 'Last time report was executed',
  run_count INT UNSIGNED DEFAULT 0 COMMENT 'Number of times report has been executed',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_saved_reports_template FOREIGN KEY (templateid) REFERENCES report_templates(templateid) ON DELETE SET NULL,
  CONSTRAINT fk_saved_reports_created_by FOREIGN KEY (created_by) REFERENCES employees(empid) ON DELETE CASCADE,
  INDEX idx_saved_reports_template (templateid),
  INDEX idx_saved_reports_type (report_type),
  INDEX idx_saved_reports_created_by (created_by),
  INDEX idx_saved_reports_shared (is_shared)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 3. REPORT EXECUTIONS
-- ============================================================================
-- Log of report executions for audit and performance tracking

CREATE TABLE IF NOT EXISTS report_executions (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  saved_report_id INT UNSIGNED DEFAULT NULL COMMENT 'Reference to saved report (NULL if ad-hoc)',
  templateid VARCHAR(10) DEFAULT NULL COMMENT 'Report template used',
  report_type VARCHAR(50) NOT NULL,
  parameters JSON DEFAULT NULL COMMENT 'Parameters used for this execution',
  executed_by VARCHAR(10) NOT NULL COMMENT 'Employee ID who executed the report',
  execution_time_ms INT UNSIGNED DEFAULT NULL COMMENT 'Report execution time in milliseconds',
  record_count INT UNSIGNED DEFAULT NULL COMMENT 'Number of records returned',
  status VARCHAR(20) DEFAULT 'SUCCESS' COMMENT 'SUCCESS, FAILED, TIMEOUT',
  error_message TEXT DEFAULT NULL COMMENT 'Error message if execution failed',
  result_file_url VARCHAR(500) DEFAULT NULL COMMENT 'URL to exported report file (if exported)',
  export_format VARCHAR(20) DEFAULT NULL COMMENT 'PDF, EXCEL, CSV, JSON',
  executed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_report_executions_saved_report FOREIGN KEY (saved_report_id) REFERENCES saved_reports(id) ON DELETE SET NULL,
  CONSTRAINT fk_report_executions_template FOREIGN KEY (templateid) REFERENCES report_templates(templateid) ON DELETE SET NULL,
  CONSTRAINT fk_report_executions_executed_by FOREIGN KEY (executed_by) REFERENCES employees(empid) ON DELETE CASCADE,
  INDEX idx_report_executions_saved_report (saved_report_id),
  INDEX idx_report_executions_template (templateid),
  INDEX idx_report_executions_type (report_type),
  INDEX idx_report_executions_executed_by (executed_by),
  INDEX idx_report_executions_date (executed_at),
  INDEX idx_report_executions_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 4. DASHBOARD WIDGETS
-- ============================================================================
-- Dashboard widgets configuration

CREATE TABLE IF NOT EXISTS dashboard_widgets (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  widget_type VARCHAR(50) NOT NULL COMMENT 'CHART, TABLE, METRIC, KPI, LIST, etc.',
  widget_name VARCHAR(200) NOT NULL COMMENT 'Widget name/title',
  data_source VARCHAR(50) DEFAULT NULL COMMENT 'ATTENDANCE, LEAVE, EMPLOYEE, PAYROLL, etc.',
  config JSON NOT NULL COMMENT 'Widget configuration in JSON format',
  position_x INT UNSIGNED DEFAULT 0 COMMENT 'X position on dashboard',
  position_y INT UNSIGNED DEFAULT 0 COMMENT 'Y position on dashboard',
  width INT UNSIGNED DEFAULT 4 COMMENT 'Widget width (grid units)',
  height INT UNSIGNED DEFAULT 3 COMMENT 'Widget height (grid units)',
  is_system_widget VARCHAR(1) DEFAULT 'N' COMMENT 'Y if system widget, N if custom',
  is_active VARCHAR(1) DEFAULT 'Y' COMMENT 'Y if active, N if inactive',
  created_by VARCHAR(10) DEFAULT NULL COMMENT 'Employee ID who created the widget',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_dashboard_widgets_created_by FOREIGN KEY (created_by) REFERENCES employees(empid) ON DELETE SET NULL,
  INDEX idx_dashboard_widgets_type (widget_type),
  INDEX idx_dashboard_widgets_data_source (data_source)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 5. USER DASHBOARDS
-- ============================================================================
-- User-specific dashboard configurations

CREATE TABLE IF NOT EXISTS user_dashboards (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  empid VARCHAR(10) NOT NULL COMMENT 'Employee ID (owner of dashboard)',
  dashboard_name VARCHAR(200) NOT NULL COMMENT 'Dashboard name',
  description VARCHAR(500) DEFAULT NULL,
  is_default VARCHAR(1) DEFAULT 'N' COMMENT 'Y if default dashboard, N if not',
  layout JSON DEFAULT NULL COMMENT 'Dashboard layout configuration in JSON',
  widget_ids JSON DEFAULT NULL COMMENT 'Array of widget IDs in this dashboard',
  is_shared VARCHAR(1) DEFAULT 'N' COMMENT 'Y if shared, N if private',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_user_dashboards_employee FOREIGN KEY (empid) REFERENCES employees(empid) ON DELETE CASCADE,
  INDEX idx_user_dashboards_employee (empid),
  INDEX idx_user_dashboards_default (is_default)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 6. ANALYTICS METRICS
-- ============================================================================
-- Predefined analytics metrics and KPIs

CREATE TABLE IF NOT EXISTS analytics_metrics (
  metricid VARCHAR(10) NOT NULL PRIMARY KEY,
  name VARCHAR(200) NOT NULL COMMENT 'Metric name',
  description VARCHAR(500) DEFAULT NULL,
  metric_type VARCHAR(50) NOT NULL COMMENT 'COUNT, SUM, AVG, PERCENTAGE, RATIO, etc.',
  data_source VARCHAR(50) NOT NULL COMMENT 'ATTENDANCE, LEAVE, EMPLOYEE, PAYROLL, etc.',
  calculation_sql TEXT DEFAULT NULL COMMENT 'SQL query for metric calculation',
  calculation_config JSON DEFAULT NULL COMMENT 'Metric calculation configuration',
  unit VARCHAR(20) DEFAULT NULL COMMENT 'Unit of measurement (days, hours, %, etc.)',
  target_value DECIMAL(10, 2) DEFAULT NULL COMMENT 'Target value for the metric',
  is_active VARCHAR(1) DEFAULT 'Y' COMMENT 'Y if active, N if inactive',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_metric_name (name),
  INDEX idx_analytics_metrics_type (metric_type),
  INDEX idx_analytics_metrics_data_source (data_source)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 7. METRIC VALUES
-- ============================================================================
-- Historical metric values for trend analysis

CREATE TABLE IF NOT EXISTS metric_values (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  metricid VARCHAR(10) NOT NULL,
  metric_date DATE NOT NULL COMMENT 'Date for which metric value is calculated',
  metric_value DECIMAL(15, 4) NOT NULL COMMENT 'Calculated metric value',
  dimension_value VARCHAR(100) DEFAULT NULL COMMENT 'Dimension value (e.g., department, role)',
  dimension_type VARCHAR(50) DEFAULT NULL COMMENT 'DEPARTMENT, ROLE, EMPLOYEE, etc.',
  calculated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_metric_values_metric FOREIGN KEY (metricid) REFERENCES analytics_metrics(metricid) ON DELETE CASCADE,
  INDEX idx_metric_values_metric (metricid),
  INDEX idx_metric_values_date (metric_date),
  INDEX idx_metric_values_dimension (dimension_type, dimension_value),
  UNIQUE KEY uk_metric_date_dimension (metricid, metric_date, dimension_type, dimension_value)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

