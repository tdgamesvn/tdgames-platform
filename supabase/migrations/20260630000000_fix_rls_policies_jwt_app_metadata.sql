-- Fix RLS policies: acc_loans, acc_savings dùng auth.jwt() ->> 'role' sai
-- (đọc Postgres role 'authenticated', LUÔN FALSE với 'admin'/'ke_toan')
-- Fix acc_bhxh_payments: 'accountant' → 'ke_toan', role public → authenticated

-- ============================================================
-- Fix 1: acc_loans
-- ============================================================
DROP POLICY IF EXISTS "loans_select" ON public.acc_loans;
DROP POLICY IF EXISTS "loans_insert" ON public.acc_loans;
DROP POLICY IF EXISTS "loans_update" ON public.acc_loans;
DROP POLICY IF EXISTS "loans_delete" ON public.acc_loans;

CREATE POLICY "loans_select" ON public.acc_loans
  FOR SELECT TO authenticated
  USING (((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) = ANY (ARRAY['admin'::text, 'ke_toan'::text]));

CREATE POLICY "loans_insert" ON public.acc_loans
  FOR INSERT TO authenticated
  WITH CHECK (((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) = ANY (ARRAY['admin'::text, 'ke_toan'::text]));

CREATE POLICY "loans_update" ON public.acc_loans
  FOR UPDATE TO authenticated
  USING (((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) = ANY (ARRAY['admin'::text, 'ke_toan'::text]))
  WITH CHECK (((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) = ANY (ARRAY['admin'::text, 'ke_toan'::text]));

CREATE POLICY "loans_delete" ON public.acc_loans
  FOR DELETE TO authenticated
  USING (((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) = ANY (ARRAY['admin'::text, 'ke_toan'::text]));

-- ============================================================
-- Fix 2: acc_savings
-- ============================================================
DROP POLICY IF EXISTS "savings_select" ON public.acc_savings;
DROP POLICY IF EXISTS "savings_insert" ON public.acc_savings;
DROP POLICY IF EXISTS "savings_update" ON public.acc_savings;
DROP POLICY IF EXISTS "savings_delete" ON public.acc_savings;

CREATE POLICY "savings_select" ON public.acc_savings
  FOR SELECT TO authenticated
  USING (((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) = ANY (ARRAY['admin'::text, 'ke_toan'::text]));

CREATE POLICY "savings_insert" ON public.acc_savings
  FOR INSERT TO authenticated
  WITH CHECK (((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) = ANY (ARRAY['admin'::text, 'ke_toan'::text]));

CREATE POLICY "savings_update" ON public.acc_savings
  FOR UPDATE TO authenticated
  USING (((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) = ANY (ARRAY['admin'::text, 'ke_toan'::text]))
  WITH CHECK (((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) = ANY (ARRAY['admin'::text, 'ke_toan'::text]));

CREATE POLICY "savings_delete" ON public.acc_savings
  FOR DELETE TO authenticated
  USING (((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) = ANY (ARRAY['admin'::text, 'ke_toan'::text]));

-- ============================================================
-- Fix 3: acc_bhxh_payments — 'accountant' → 'ke_toan', public → authenticated
-- ============================================================
DROP POLICY IF EXISTS "acc_bhxh_payments_select" ON public.acc_bhxh_payments;
DROP POLICY IF EXISTS "acc_bhxh_payments_insert" ON public.acc_bhxh_payments;
DROP POLICY IF EXISTS "acc_bhxh_payments_update" ON public.acc_bhxh_payments;
DROP POLICY IF EXISTS "acc_bhxh_payments_delete" ON public.acc_bhxh_payments;

CREATE POLICY "acc_bhxh_payments_select" ON public.acc_bhxh_payments
  FOR SELECT TO authenticated
  USING (((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) = ANY (ARRAY['admin'::text, 'ke_toan'::text, 'hr'::text]));

CREATE POLICY "acc_bhxh_payments_insert" ON public.acc_bhxh_payments
  FOR INSERT TO authenticated
  WITH CHECK (((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) = ANY (ARRAY['admin'::text, 'ke_toan'::text]));

CREATE POLICY "acc_bhxh_payments_update" ON public.acc_bhxh_payments
  FOR UPDATE TO authenticated
  USING (((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) = ANY (ARRAY['admin'::text, 'ke_toan'::text]))
  WITH CHECK (((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) = ANY (ARRAY['admin'::text, 'ke_toan'::text]));

CREATE POLICY "acc_bhxh_payments_delete" ON public.acc_bhxh_payments
  FOR DELETE TO authenticated
  USING (((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) = ANY (ARRAY['admin'::text, 'ke_toan'::text]));
