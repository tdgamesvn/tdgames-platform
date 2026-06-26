-- Add is_hidden flag to hr_employees
-- Khi is_hidden = true, nhân viên không xuất hiện trong danh bạ Company Hub
-- Tài khoản vẫn hoạt động bình thường (login, portal, payroll...)

ALTER TABLE hr_employees
  ADD COLUMN IF NOT EXISTS is_hidden boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN hr_employees.is_hidden IS
  'Ẩn khỏi danh bạ Company Hub. Tài khoản vẫn hoạt động bình thường (dùng cho test accounts).';
