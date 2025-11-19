ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS location_id BIGINT UNSIGNED NULL,
  ADD INDEX idx_emp_location_id (location_id);

ALTER TABLE employees
  ADD CONSTRAINT fk_employees_location
  FOREIGN KEY (location_id) REFERENCES office_locations(id);


