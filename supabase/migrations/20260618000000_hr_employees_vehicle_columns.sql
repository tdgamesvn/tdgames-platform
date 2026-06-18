-- Add vehicle info columns to hr_employees (replaces hr_parking_registrations for simple 1-vehicle use case)

ALTER TABLE hr_employees
  ADD COLUMN IF NOT EXISTS vehicle_type    TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS license_plate   TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS vehicle_brand   TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS vehicle_color   TEXT NOT NULL DEFAULT '';

COMMENT ON COLUMN hr_employees.vehicle_type  IS 'Loại xe: motorcycle, car, bicycle, electric_bike, other, hoặc rỗng';
COMMENT ON COLUMN hr_employees.license_plate IS 'Biển số xe';
COMMENT ON COLUMN hr_employees.vehicle_brand IS 'Nhãn hiệu xe (Honda, Yamaha…)';
COMMENT ON COLUMN hr_employees.vehicle_color IS 'Màu xe';
