-- Sample Data for Niyava Technologies
-- Execute this after running the main schema.sql

-- Insert Organization
INSERT INTO organizations (code, name, is_active) 
VALUES ('NIYAVA', 'Niyava Technologies', 1)
ON DUPLICATE KEY UPDATE name = VALUES(name);

-- Get the organization ID (assuming it's 1, or use LAST_INSERT_ID() if this is the first insert)
SET @org_id = (SELECT id FROM organizations WHERE code = 'NIYAVA' LIMIT 1);

-- Insert Office Locations
INSERT INTO office_locations (organization_id, name, address_line1, address_line2, city, state, postal_code, country, phone)
VALUES 
  (
    @org_id,
    'Noida Sec-62',
    'Sector 62',
    'Block A',
    'Noida',
    'Uttar Pradesh',
    '201301',
    'India',
    NULL
  ),
  (
    @org_id,
    'Udyog Vihar, Gurugram',
    'Udyog Vihar',
    'Phase 1',
    'Gurugram',
    'Haryana',
    '122016',
    'India',
    NULL
  )
ON DUPLICATE KEY UPDATE 
  address_line1 = VALUES(address_line1),
  city = VALUES(city),
  state = VALUES(state);

-- Insert Departments
INSERT INTO departments (id, organization_id, name)
VALUES 
  (1, @org_id, 'Human Resource'),
  (2, @org_id, 'Admin'),
  (3, @org_id, 'Technology'),
  (4, @org_id, 'Finance'),
  (5, @org_id, 'Operations')
ON DUPLICATE KEY UPDATE name = VALUES(name);

-- Insert Shifts
INSERT INTO attendance_shifts (organization_id, name, start_time, end_time, is_overnight, grace_in_minutes, default_break_minutes)
VALUES 
  (
    @org_id,
    '9am-6pm',
    '09:00:00',
    '18:00:00',
    0,
    15,
    60
  ),
  (
    @org_id,
    '3pm-11pm',
    '15:00:00',
    '23:00:00',
    0,
    15,
    60
  )
ON DUPLICATE KEY UPDATE 
  start_time = VALUES(start_time),
  end_time = VALUES(end_time);

-- Display inserted data
SELECT 'Organization' as entity, id, code, name FROM organizations WHERE code = 'NIYAVA';
SELECT 'Locations' as entity, id, name, city, state FROM office_locations WHERE organization_id = @org_id;
SELECT 'Departments' as entity, id, name FROM departments WHERE organization_id = @org_id;
SELECT 'Shifts' as entity, id, name, start_time, end_time FROM attendance_shifts WHERE organization_id = @org_id;

