-- Tax Portal: outsourced tax accountant (kế toán thuế thuê ngoài) gets a new
-- role `ke_toan_thue` with SELECT-only access to accounting/tax-relevant
-- tables. These are ADDITIVE policies — no existing policy is dropped or
-- modified, so admin/ke_toan/hr access is unaffected. Postgres combines
-- multiple permissive RLS policies with OR, so this purely widens read
-- access for the new role without touching write policies anywhere.
--
-- ponytail: scope is intentionally broad (full payroll detail included) per
-- sếp's explicit decision on 2026-07-08 — "tạm thời xem hết, sau siết lại".
-- When tightening later, the payroll policy below is the first candidate to
-- narrow (e.g. drop pay_payroll_records, keep only pay_payroll_sheets
-- aggregate totals).
--
-- Note: invoice_line_items does NOT exist as a standalone table (invoice
-- line items live in invoice_invoices.items JSONB) — skipped, already
-- covered by the invoice_invoices policy below.

CREATE POLICY invoice_invoices_ke_toan_thue_read ON public.invoice_invoices
  FOR SELECT TO authenticated
  USING (public.jwt_has_any_role(ARRAY['ke_toan_thue']));

CREATE POLICY expense_expenses_ke_toan_thue_read ON public.expense_expenses
  FOR SELECT TO authenticated
  USING (public.jwt_has_any_role(ARRAY['ke_toan_thue']));

CREATE POLICY expense_categories_ke_toan_thue_read ON public.expense_categories
  FOR SELECT TO authenticated
  USING (public.jwt_has_any_role(ARRAY['ke_toan_thue']));

CREATE POLICY expense_recurring_ke_toan_thue_read ON public.expense_recurring
  FOR SELECT TO authenticated
  USING (public.jwt_has_any_role(ARRAY['ke_toan_thue']));

CREATE POLICY finance_bank_accounts_ke_toan_thue_read ON public.finance_bank_accounts
  FOR SELECT TO authenticated
  USING (public.jwt_has_any_role(ARRAY['ke_toan_thue']));

CREATE POLICY finance_bank_balance_snapshots_ke_toan_thue_read ON public.finance_bank_balance_snapshots
  FOR SELECT TO authenticated
  USING (public.jwt_has_any_role(ARRAY['ke_toan_thue']));

CREATE POLICY acc_savings_ke_toan_thue_read ON public.acc_savings
  FOR SELECT TO authenticated
  USING (public.jwt_has_any_role(ARRAY['ke_toan_thue']));

CREATE POLICY acc_loans_ke_toan_thue_read ON public.acc_loans
  FOR SELECT TO authenticated
  USING (public.jwt_has_any_role(ARRAY['ke_toan_thue']));

CREATE POLICY acc_bhxh_payments_ke_toan_thue_read ON public.acc_bhxh_payments
  FOR SELECT TO authenticated
  USING (public.jwt_has_any_role(ARRAY['ke_toan_thue']));

CREATE POLICY finance_fx_rates_ke_toan_thue_read ON public.finance_fx_rates
  FOR SELECT TO authenticated
  USING (public.jwt_has_any_role(ARRAY['ke_toan_thue']));

CREATE POLICY pay_payroll_sheets_ke_toan_thue_read ON public.pay_payroll_sheets
  FOR SELECT TO authenticated
  USING (public.jwt_has_any_role(ARRAY['ke_toan_thue']));

CREATE POLICY pay_payroll_records_ke_toan_thue_read ON public.pay_payroll_records
  FOR SELECT TO authenticated
  USING (public.jwt_has_any_role(ARRAY['ke_toan_thue']));
