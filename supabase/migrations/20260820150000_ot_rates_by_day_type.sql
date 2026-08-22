-- OT theo loại ngày (BLLĐ 2019 Đ.98): ngày thường 150%, ngày nghỉ tuần 200%, lễ/Tết 300%.
-- Trước migration này app chỉ có 1 hệ số duy nhất (ot_rate_weekday = 1.5) áp cho mọi giờ OT.
-- Cột mới mặc định 0 giờ → bảng công/bảng lương cũ giữ nguyên kết quả tính toán.

ALTER TABLE public.pay_payroll_formula_settings
  ADD COLUMN IF NOT EXISTS ot_rate_weekend numeric(12, 6) NOT NULL DEFAULT 2.0,
  ADD COLUMN IF NOT EXISTS ot_rate_holiday numeric(12, 6) NOT NULL DEFAULT 3.0;

COMMENT ON COLUMN public.pay_payroll_formula_settings.ot_rate_weekend IS 'Hệ số OT ngày nghỉ hằng tuần (T7/CN) — luật tối thiểu 2.0';
COMMENT ON COLUMN public.pay_payroll_formula_settings.ot_rate_holiday IS 'Hệ số OT ngày lễ/Tết — luật tối thiểu 3.0';

ALTER TABLE public.att_monthly_records
  ADD COLUMN IF NOT EXISTS ot_hours_weekend numeric(8, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ot_hours_holiday numeric(8, 2) NOT NULL DEFAULT 0;

ALTER TABLE public.pay_payroll_records
  ADD COLUMN IF NOT EXISTS extra_ot_hours_weekend numeric(8, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS extra_ot_hours_holiday numeric(8, 2) NOT NULL DEFAULT 0;
