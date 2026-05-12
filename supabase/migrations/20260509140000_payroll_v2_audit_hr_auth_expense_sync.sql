-- Applied on remote project Workflow (see MCP apply_migration payroll_v2_audit_hr_auth_expense_sync).
-- Payroll audit columns, HR auth_user_id + auth.users trigger, expense sync fixes, record→expense refresh, HR RLS.

ALTER TABLE public.hr_employees
  ADD COLUMN IF NOT EXISTS auth_user_id uuid UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_hr_employees_auth_user_id ON public.hr_employees(auth_user_id);

UPDATE public.hr_employees e
SET auth_user_id = u.id
FROM auth.users u
WHERE (u.raw_user_meta_data->>'employee_id')::uuid = e.id
  AND e.auth_user_id IS NULL;

CREATE OR REPLACE FUNCTION public.sync_hr_employee_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF NEW.raw_user_meta_data IS NOT NULL AND NEW.raw_user_meta_data ? 'employee_id' THEN
    UPDATE public.hr_employees
    SET auth_user_id = NEW.id
    WHERE id = (NEW.raw_user_meta_data->>'employee_id')::uuid;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_sync_hr ON auth.users;
CREATE TRIGGER on_auth_user_sync_hr
  AFTER INSERT OR UPDATE OF raw_user_meta_data ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_hr_employee_auth_user();

ALTER TABLE public.pay_payroll_sheets
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS paid_at timestamptz,
  ADD COLUMN IF NOT EXISTS confirmed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS paid_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

UPDATE public.pay_payroll_sheets SET updated_at = COALESCE(updated_at, created_at, now()) WHERE updated_at IS NULL;

ALTER TABLE public.pay_payroll_sheets DROP CONSTRAINT IF EXISTS pay_payroll_sheets_status_check;
ALTER TABLE public.pay_payroll_sheets
  ADD CONSTRAINT pay_payroll_sheets_status_check
  CHECK (status IS NULL OR status IN ('draft', 'confirmed', 'paid'));

UPDATE public.pay_payroll_sheets SET status = 'draft' WHERE status IS NULL;
UPDATE public.pay_payroll_sheets SET confirmed_at = COALESCE(confirmed_at, created_at) WHERE status IN ('confirmed', 'paid') AND confirmed_at IS NULL;

CREATE OR REPLACE FUNCTION public.pay_payroll_sheets_before_upd()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  IF NEW.status = 'draft' AND OLD.status IN ('confirmed', 'paid') THEN
    NEW.confirmed_at := NULL;
    NEW.paid_at := NULL;
    NEW.confirmed_by := NULL;
    NEW.paid_by := NULL;
  ELSIF NEW.status = 'confirmed' AND OLD.status = 'draft' THEN
    NEW.confirmed_at := COALESCE(NEW.confirmed_at, now());
  ELSIF NEW.status = 'paid' AND OLD.status = 'confirmed' THEN
    NEW.paid_at := COALESCE(NEW.paid_at, now());
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_pay_sheets_before_upd ON public.pay_payroll_sheets;
CREATE TRIGGER trg_pay_sheets_before_upd
  BEFORE UPDATE ON public.pay_payroll_sheets
  FOR EACH ROW
  EXECUTE FUNCTION public.pay_payroll_sheets_before_upd();

CREATE OR REPLACE FUNCTION public.sync_payroll_to_expense()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total numeric;
  v_emp_count int;
  v_cat_id uuid;
BEGIN
  IF NEW.status = 'confirmed' AND (OLD.status IS NULL OR OLD.status = 'draft') THEN
    IF EXISTS (SELECT 1 FROM expense_expenses WHERE source_type = 'payroll' AND source_id = NEW.id) THEN
      RETURN NEW;
    END IF;
    SELECT COALESCE(SUM(total_company_cost), 0), COUNT(*)
    INTO v_total, v_emp_count
    FROM pay_payroll_records WHERE sheet_id = NEW.id;
    SELECT id INTO v_cat_id FROM expense_categories WHERE name = '💼 Lương nhân viên' LIMIT 1;
    INSERT INTO expense_expenses (
      title, amount, currency, expense_date, category_id,
      project, vendor, status, type, source_type, source_id,
      created_by, notes
    ) VALUES (
      'Bảng lương T' || LPAD(NEW.month::text, 2, '0') || '/' || NEW.year,
      v_total, 'VND', make_date(NEW.year, NEW.month, 1), v_cat_id,
      '', 'TD Games Studio', 'approved', 'expense', 'payroll', NEW.id,
      'system',
      'Tự động từ Payroll | ' || v_emp_count || ' nhân viên | Total: ' || v_total::text || ' VND'
    );
  END IF;
  IF NEW.status = 'draft' AND OLD.status IN ('confirmed', 'paid') THEN
    DELETE FROM expense_expenses WHERE source_type = 'payroll' AND source_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.refresh_payroll_expense_for_sheet(p_sheet_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status text;
  v_total numeric;
  v_emp_count int;
BEGIN
  SELECT status INTO v_status FROM pay_payroll_sheets WHERE id = p_sheet_id;
  IF v_status IS NULL OR v_status NOT IN ('confirmed', 'paid') THEN
    RETURN;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM expense_expenses WHERE source_type = 'payroll' AND source_id = p_sheet_id
  ) THEN
    RETURN;
  END IF;
  SELECT COALESCE(SUM(total_company_cost), 0), COUNT(*)
  INTO v_total, v_emp_count
  FROM pay_payroll_records WHERE sheet_id = p_sheet_id;
  UPDATE expense_expenses
  SET amount = v_total,
      notes = 'Tự động từ Payroll | ' || v_emp_count || ' nhân viên | Total: ' || v_total::text || ' VND (cập nhật ' || to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI') || ' UTC)'
  WHERE source_type = 'payroll' AND source_id = p_sheet_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_payroll_records_touch_expense()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  sid uuid;
BEGIN
  sid := COALESCE(NEW.sheet_id, OLD.sheet_id);
  PERFORM public.refresh_payroll_expense_for_sheet(sid);
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_payroll_records_expense ON public.pay_payroll_records;
CREATE TRIGGER trg_payroll_records_expense
  AFTER INSERT OR UPDATE OR DELETE ON public.pay_payroll_records
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_payroll_records_touch_expense();

DROP POLICY IF EXISTS hr_contracts_self_read ON public.hr_contracts;
CREATE POLICY hr_contracts_self_read ON public.hr_contracts
  FOR SELECT TO authenticated
  USING (
    employee_id IN (
      SELECT id FROM public.hr_employees WHERE auth_user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS hr_employee_self_update ON public.hr_employees;
CREATE POLICY hr_employee_self_update ON public.hr_employees
  FOR UPDATE TO authenticated
  USING (
    id IN (SELECT id FROM public.hr_employees WHERE auth_user_id = (SELECT auth.uid()))
  )
  WITH CHECK (
    id IN (SELECT id FROM public.hr_employees WHERE auth_user_id = (SELECT auth.uid()))
  );
