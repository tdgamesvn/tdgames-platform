-- Migration: add bonus column to pay_payroll_records
-- Thưởng KPI nhập tay cuối tháng. Cộng thẳng vào net_salary và total_company_cost,
-- không tính vào thu nhập chịu thuế / bảo hiểm.

ALTER TABLE pay_payroll_records
  ADD COLUMN IF NOT EXISTS bonus numeric NOT NULL DEFAULT 0;

COMMENT ON COLUMN pay_payroll_records.bonus IS
  'Thưởng KPI nhập tay cuối tháng. Cộng thẳng vào net_salary và total_company_cost, không tính vào thuế/BH.';
