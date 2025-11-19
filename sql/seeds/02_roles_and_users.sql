-- Sample Data for Roles and Users
-- Execute this after running schema.sql and 01_sample_data.sql

-- Get the organization ID
SET @org_id = (SELECT id FROM organizations WHERE code = 'NIYAVA' LIMIT 1);

-- Insert Roles
INSERT INTO roles (organization_id, name, code, description, permissions, is_active)
VALUES 
  (
    @org_id,
    'Admin',
    'ADMIN',
    'Full system access with all permissions',
    JSON_OBJECT(
      'can_manage_users', true,
      'can_manage_employees', true,
      'can_manage_departments', true,
      'can_manage_locations', true,
      'can_manage_shifts', true,
      'can_manage_policies', true,
      'can_manage_holidays', true,
      'can_approve_attendance', true,
      'can_approve_leaves', true,
      'can_view_reports', true
    ),
    1
  ),
  (
    @org_id,
    'HR Manager',
    'HR_MANAGER',
    'Can manage shifts, policies, holidays, and approve attendance/leaves',
    JSON_OBJECT(
      'can_manage_users', false,
      'can_manage_employees', true,
      'can_manage_departments', false,
      'can_manage_locations', false,
      'can_manage_shifts', true,
      'can_manage_policies', true,
      'can_manage_holidays', true,
      'can_approve_attendance', true,
      'can_approve_leaves', true,
      'can_view_reports', true
    ),
    1
  ),
  (
    @org_id,
    'Manager',
    'MANAGER',
    'Can view and approve team attendance and leaves',
    JSON_OBJECT(
      'can_manage_users', false,
      'can_manage_employees', false,
      'can_manage_departments', false,
      'can_manage_locations', false,
      'can_manage_shifts', false,
      'can_manage_policies', false,
      'can_manage_holidays', false,
      'can_approve_attendance', true,
      'can_approve_leaves', true,
      'can_view_reports', true
    ),
    1
  ),
  (
    @org_id,
    'User',
    'USER',
    'Regular employee with basic access',
    JSON_OBJECT(
      'can_manage_users', false,
      'can_manage_employees', false,
      'can_manage_departments', false,
      'can_manage_locations', false,
      'can_manage_shifts', false,
      'can_manage_policies', false,
      'can_manage_holidays', false,
      'can_approve_attendance', false,
      'can_approve_leaves', false,
      'can_view_reports', false
    ),
    1
  )
ON DUPLICATE KEY UPDATE 
  name = VALUES(name),
  description = VALUES(description),
  permissions = VALUES(permissions);

-- Get role IDs
SET @admin_role_id = (SELECT id FROM roles WHERE code = 'ADMIN' AND organization_id = @org_id LIMIT 1);
SET @hr_manager_role_id = (SELECT id FROM roles WHERE code = 'HR_MANAGER' AND organization_id = @org_id LIMIT 1);
SET @manager_role_id = (SELECT id FROM roles WHERE code = 'MANAGER' AND organization_id = @org_id LIMIT 1);
SET @user_role_id = (SELECT id FROM roles WHERE code = 'USER' AND organization_id = @org_id LIMIT 1);

-- Note: Users will be created after employees are created
-- This is a template - you'll need to create employees first, then create users
-- Example users (assuming employees with IDs 1, 2, 3, 4 exist):
-- 
-- INSERT INTO users (organization_id, username, password, employee_id, is_active)
-- VALUES 
--   (@org_id, 'admin@niyava', '$2b$10$YourHashedPasswordHere', 1, 1),
--   (@org_id, 'hr@niyava', '$2b$10$YourHashedPasswordHere', 2, 1),
--   (@org_id, 'manager@niyava', '$2b$10$YourHashedPasswordHere', 3, 1),
--   (@org_id, 'user@niyava', '$2b$10$YourHashedPasswordHere', 4, 1)
-- ON DUPLICATE KEY UPDATE username = VALUES(username);
--
-- -- Assign roles to users
-- INSERT INTO user_roles (user_id, role_id)
-- SELECT u.id, @admin_role_id FROM users u WHERE u.username = 'admin@niyava' AND u.organization_id = @org_id
-- ON DUPLICATE KEY UPDATE user_id = user_id;
--
-- INSERT INTO user_roles (user_id, role_id)
-- SELECT u.id, @hr_manager_role_id FROM users u WHERE u.username = 'hr@niyava' AND u.organization_id = @org_id
-- ON DUPLICATE KEY UPDATE user_id = user_id;
--
-- INSERT INTO user_roles (user_id, role_id)
-- SELECT u.id, @manager_role_id FROM users u WHERE u.username = 'manager@niyava' AND u.organization_id = @org_id
-- ON DUPLICATE KEY UPDATE user_id = user_id;
--
-- INSERT INTO user_roles (user_id, role_id)
-- SELECT u.id, @user_role_id FROM users u WHERE u.username = 'user@niyava' AND u.organization_id = @org_id
-- ON DUPLICATE KEY UPDATE user_id = user_id;

-- Display inserted roles
SELECT 'Roles' as entity, id, name, code, description FROM roles WHERE organization_id = @org_id;

