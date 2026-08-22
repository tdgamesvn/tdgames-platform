-- OT ban đêm (22h–6h) — NĐ 145/2020 Đ.57 k.3:
--   OT đêm = (đơn giá giờ × hệ số OT) + (đơn giá giờ × 30%) + (20% × đơn giá giờ BAN NGÀY của loại ngày đó)
--   ngày thường: 150 + 30 + 20%×100 = 200%
--   T7/CN:       200 + 30 + 20%×200 = 270%
--   lễ/Tết:      300 + 30 + 20%×300 = 390%
-- Cột giờ mới mặc định 0 → bảng công/bảng lương cũ giữ nguyên kết quả tính toán.

ALTER TABLE public.pay_payroll_formula_settings
  ADD COLUMN IF NOT EXISTS ot_rate_night_weekday numeric(12, 6) NOT NULL DEFAULT 2.0,
  ADD COLUMN IF NOT EXISTS ot_rate_night_weekend numeric(12, 6) NOT NULL DEFAULT 2.7,
  ADD COLUMN IF NOT EXISTS ot_rate_night_holiday numeric(12, 6) NOT NULL DEFAULT 3.9;

COMMENT ON COLUMN public.pay_payroll_formula_settings.ot_rate_night_weekday IS 'Hệ số OT ban đêm ngày thường — luật tối thiểu 2.0 (NĐ 145/2020 Đ.57)';
COMMENT ON COLUMN public.pay_payroll_formula_settings.ot_rate_night_weekend IS 'Hệ số OT ban đêm T7/CN — luật tối thiểu 2.7';
COMMENT ON COLUMN public.pay_payroll_formula_settings.ot_rate_night_holiday IS 'Hệ số OT ban đêm lễ/Tết — luật tối thiểu 3.9';

ALTER TABLE public.att_monthly_records
  ADD COLUMN IF NOT EXISTS ot_hours_night numeric(8, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ot_hours_night_weekend numeric(8, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ot_hours_night_holiday numeric(8, 2) NOT NULL DEFAULT 0;

ALTER TABLE public.pay_payroll_records
  ADD COLUMN IF NOT EXISTS extra_ot_hours_night numeric(8, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS extra_ot_hours_night_weekend numeric(8, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS extra_ot_hours_night_holiday numeric(8, 2) NOT NULL DEFAULT 0;
