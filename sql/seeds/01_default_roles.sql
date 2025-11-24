-- ============================================================================
-- Default Roles Seed Data
-- ============================================================================
-- This file inserts default roles into the roles table
-- Run this after the schema is created
-- ============================================================================

-- Insert default roles if they don't exist
INSERT IGNORE INTO roles (roleid, name, description, permissions, is_active) VALUES
('ADMIN', 'Administrator', 'Full system administrator with all permissions', 
  JSON_OBJECT(
    'organizations', JSON_ARRAY('create', 'read', 'update', 'delete'),
    'departments', JSON_ARRAY('create', 'read', 'update', 'delete'),
    'employees', JSON_ARRAY('create', 'read', 'update', 'delete'),
    'users', JSON_ARRAY('create', 'read', 'update', 'delete'),
    'roles', JSON_ARRAY('create', 'read', 'update', 'delete'),
    'attendance', JSON_ARRAY('create', 'read', 'update', 'delete'),
    'reports', JSON_ARRAY('read', 'export'),
    'system', JSON_ARRAY('configure', 'manage')
  ), 'Y'),
('USER', 'User', 'Standard user with basic permissions', 
  JSON_OBJECT(
    'employees', JSON_ARRAY('read'),
    'departments', JSON_ARRAY('read'),
    'attendance', JSON_ARRAY('read', 'create'),
    'reports', JSON_ARRAY('read')
  ), 'Y'),
('MANAGER', 'Manager', 'Department or team manager with management permissions', 
  JSON_OBJECT(
    'employees', JSON_ARRAY('read', 'update'),
    'departments', JSON_ARRAY('read'),
    'attendance', JSON_ARRAY('read', 'create', 'update', 'approve'),
    'reports', JSON_ARRAY('read', 'export'),
    'leaves', JSON_ARRAY('read', 'approve', 'reject')
  ), 'Y'),
('HRMANAGER', 'HR Manager', 'Human Resources manager with HR-related permissions', 
  JSON_OBJECT(
    'organizations', JSON_ARRAY('read'),
    'departments', JSON_ARRAY('read', 'update'),
    'employees', JSON_ARRAY('create', 'read', 'update', 'delete'),
    'users', JSON_ARRAY('create', 'read', 'update'),
    'attendance', JSON_ARRAY('read', 'create', 'update', 'delete', 'approve'),
    'reports', JSON_ARRAY('read', 'export'),
    'leaves', JSON_ARRAY('read', 'create', 'update', 'approve', 'reject'),
    'payroll', JSON_ARRAY('read', 'update')
  ), 'Y'),
('CXO', 'CXO', 'Chief Executive Officer or other C-level executive with executive permissions', 
  JSON_OBJECT(
    'organizations', JSON_ARRAY('read', 'update'),
    'departments', JSON_ARRAY('read'),
    'employees', JSON_ARRAY('read'),
    'attendance', JSON_ARRAY('read'),
    'reports', JSON_ARRAY('read', 'export'),
    'analytics', JSON_ARRAY('read'),
    'strategic', JSON_ARRAY('read', 'update')
  ), 'Y');
