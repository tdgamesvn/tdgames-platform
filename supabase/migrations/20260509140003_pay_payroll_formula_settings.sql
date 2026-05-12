-- Configurable payroll formula parameters (effective_from versioning, AMIS-style).
-- RLS: staff can read; only admin + ke_toan can insert/update/delete.

CREATE TABLE IF NOT EXISTS public.pay_payroll_formula_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL DEFAULT '',
  effective_from date NOT NULL,
  standard_work_days numeric(8, 2) NOT NULL DEFAULT 22,
  hours_per_day numeric(8, 2) NOT NULL DEFAULT 8,
  bh_employee_rate numeric(12, 8) NOT NULL DEFAULT 0.105,
  bh_company_rate numeric(12, 8) NOT NULL DEFAULT 0.215,
  personal_deduction numeric(18, 2) NOT NULL DEFAULT 15500000,
  dependent_deduction numeric(18, 2) NOT NULL DEFAULT 6200000,
  ot_rate_weekday numeric(12, 6) NOT NULL DEFAULT 1.5,
  probation_pit_rate numeric(12, 8) NOT NULL DEFAULT 0.1,
  tax_brackets jsonb NOT NULL DEFAULT '[]'::jsonb,
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz,
  CONSTRAINT pay_payroll_formula_effective_from_key UNIQUE (effective_from)
);

COMMENT ON TABLE public.pay_payroll_formula_settings IS 'Payroll calculation parameters by effective_from; sheets reference a row for reproducibility.';

-- Baseline row (matches legacy FALLBACK_PAYROLL_FORMULA in app).
INSERT INTO public.pay_payroll_formula_settings (
  id,
  name,
  effective_from,
  standard_work_days,
  hours_per_day,
  bh_employee_rate,
  bh_company_rate,
  personal_deduction,
  dependent_deduction,
  ot_rate_weekday,
  probation_pit_rate,
  tax_brackets,
  notes
) VALUES (
  'a0000000-0000-4000-8000-000000000001',
  'Mặc định (legacy)',
  '2000-01-01',
  22,
  8,
  0.105,
  0.215,
  15500000,
  6200000,
  1.5,
  0.1,
  '[
    {"limit": 10000000, "rate": 0.05, "deduction": 0},
    {"limit": 30000000, "rate": 0.10, "deduction": 500000},
    {"limit": 60000000, "rate": 0.20, "deduction": 3500000},
    {"limit": 100000000, "rate": 0.30, "deduction": 9500000},
    {"limit": null, "rate": 0.35, "deduction": 14500000}
  ]'::jsonb,
  'Seed: thông số trùng logic cố định cũ trong code.'
)
ON CONFLICT (effective_from) DO NOTHING;

ALTER TABLE public.pay_payroll_sheets
  ADD COLUMN IF NOT EXISTS formula_settings_id uuid
    REFERENCES public.pay_payroll_formula_settings(id) ON DELETE RESTRICT;

UPDATE public.pay_payroll_sheets
SET formula_settings_id = 'a0000000-0000-4000-8000-000000000001'
WHERE formula_settings_id IS NULL;

ALTER TABLE public.pay_payroll_formula_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pay_formula_settings_select ON public.pay_payroll_formula_settings;
CREATE POLICY pay_formula_settings_select ON public.pay_payroll_formula_settings
  FOR SELECT TO authenticated
  USING (public.is_staff());

DROP POLICY IF EXISTS pay_formula_settings_insert ON public.pay_payroll_formula_settings;
CREATE POLICY pay_formula_settings_insert ON public.pay_payroll_formula_settings
  FOR INSERT TO authenticated
  WITH CHECK (public.get_jwt_role() IN ('admin', 'ke_toan'));

DROP POLICY IF EXISTS pay_formula_settings_update ON public.pay_payroll_formula_settings;
CREATE POLICY pay_formula_settings_update ON public.pay_payroll_formula_settings
  FOR UPDATE TO authenticated
  USING (public.get_jwt_role() IN ('admin', 'ke_toan'))
  WITH CHECK (public.get_jwt_role() IN ('admin', 'ke_toan'));

DROP POLICY IF EXISTS pay_formula_settings_delete ON public.pay_payroll_formula_settings;
CREATE POLICY pay_formula_settings_delete ON public.pay_payroll_formula_settings
  FOR DELETE TO authenticated
  USING (public.get_jwt_role() IN ('admin', 'ke_toan'));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pay_payroll_formula_settings TO authenticated;
GRANT ALL ON public.pay_payroll_formula_settings TO service_role;
