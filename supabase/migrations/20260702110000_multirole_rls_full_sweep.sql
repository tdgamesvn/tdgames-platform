-- =============================================================
-- Multi-role RLS full sweep (follow-up của 20260702090000)
-- Quét toàn bộ policy còn check primary-role-only và chuyển sang
-- jwt_has_any_role() (secondary-role aware).
-- Nguyên tắc: GIỮ NGUYÊN danh sách role của từng policy,
-- chỉ đổi cơ chế check. Tất cả policy đều PERMISSIVE / TO authenticated.
-- =============================================================

-- =============================================================
-- 1) is_admin_or_ke_toan() → secondary-aware
--    (tự sửa 9 policies: invoice_invoices, invoice_banks,
--     invoice_studios, invoice_recurring, invoice_activity_logs,
--     expense_expenses, expense_categories, expense_recurring,
--     finance_bank_accounts)
-- =============================================================
CREATE OR REPLACE FUNCTION public.is_admin_or_ke_toan()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT public.jwt_has_any_role(ARRAY['admin','ke_toan']);
$$;

-- =============================================================
-- 2) Policies dùng get_jwt_role() trực tiếp (12)
-- =============================================================

DROP POLICY IF EXISTS admin_write_company_profiles ON public.company_profiles;
CREATE POLICY admin_write_company_profiles ON public.company_profiles
  FOR ALL TO authenticated
  USING (public.jwt_has_any_role(ARRAY['admin','ke_toan']));

DROP POLICY IF EXISTS hr_contracts_ke_toan_read ON public.hr_contracts;
CREATE POLICY hr_contracts_ke_toan_read ON public.hr_contracts
  FOR SELECT TO authenticated
  USING (public.jwt_has_any_role(ARRAY['ke_toan']));

DROP POLICY IF EXISTS hr_dept_ke_toan_read ON public.hr_departments;
CREATE POLICY hr_dept_ke_toan_read ON public.hr_departments
  FOR SELECT TO authenticated
  USING (public.jwt_has_any_role(ARRAY['ke_toan']));

DROP POLICY IF EXISTS hr_dept_member_read ON public.hr_departments;
CREATE POLICY hr_dept_member_read ON public.hr_departments
  FOR SELECT TO authenticated
  USING (public.jwt_has_any_role(ARRAY['member','freelancer']));

DROP POLICY IF EXISTS hr_salary_ke_toan_read ON public.hr_employee_salary;
CREATE POLICY hr_salary_ke_toan_read ON public.hr_employee_salary
  FOR SELECT TO authenticated
  USING (public.jwt_has_any_role(ARRAY['ke_toan']));

DROP POLICY IF EXISTS hr_ke_toan_read ON public.hr_employees;
CREATE POLICY hr_ke_toan_read ON public.hr_employees
  FOR SELECT TO authenticated
  USING (public.jwt_has_any_role(ARRAY['ke_toan']));

DROP POLICY IF EXISTS employee_own_acks ON public.hr_onboarding_acknowledgments;
CREATE POLICY employee_own_acks ON public.hr_onboarding_acknowledgments
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM hr_employees e
      WHERE e.id = hr_onboarding_acknowledgments.employee_id
        AND e.auth_user_id = auth.uid()
    )
    OR public.jwt_has_any_role(ARRAY['admin','hr','ke_toan'])
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM hr_employees e
      WHERE e.id = hr_onboarding_acknowledgments.employee_id
        AND e.auth_user_id = auth.uid()
    )
    OR public.jwt_has_any_role(ARRAY['admin','hr','ke_toan'])
  );

DROP POLICY IF EXISTS hr_salary_comp_ke_toan_read ON public.hr_salary_components;
CREATE POLICY hr_salary_comp_ke_toan_read ON public.hr_salary_components
  FOR SELECT TO authenticated
  USING (public.jwt_has_any_role(ARRAY['ke_toan']));

DROP POLICY IF EXISTS hr_salary_comp_member_read ON public.hr_salary_components;
CREATE POLICY hr_salary_comp_member_read ON public.hr_salary_components
  FOR SELECT TO authenticated
  USING (public.jwt_has_any_role(ARRAY['member','freelancer']));

DROP POLICY IF EXISTS pay_formula_delete_accounting ON public.pay_payroll_formula_settings;
CREATE POLICY pay_formula_delete_accounting ON public.pay_payroll_formula_settings
  FOR DELETE TO authenticated
  USING (public.jwt_has_any_role(ARRAY['admin','ke_toan']));

DROP POLICY IF EXISTS pay_formula_insert_accounting ON public.pay_payroll_formula_settings;
CREATE POLICY pay_formula_insert_accounting ON public.pay_payroll_formula_settings
  FOR INSERT TO authenticated
  WITH CHECK (public.jwt_has_any_role(ARRAY['admin','ke_toan']));

DROP POLICY IF EXISTS pay_formula_update_accounting ON public.pay_payroll_formula_settings;
CREATE POLICY pay_formula_update_accounting ON public.pay_payroll_formula_settings
  FOR UPDATE TO authenticated
  USING (public.jwt_has_any_role(ARRAY['admin','ke_toan']))
  WITH CHECK (public.jwt_has_any_role(ARRAY['admin','ke_toan']));

-- =============================================================
-- 3) Policies đọc auth.jwt()->'app_metadata'->>'role' trực tiếp (22)
-- =============================================================

-- Accounting: acc_advances / acc_fixed_assets (ALL, admin+ke_toan)
DROP POLICY IF EXISTS "Admin/ke_toan full access on acc_advances" ON public.acc_advances;
CREATE POLICY "Admin/ke_toan full access on acc_advances" ON public.acc_advances
  FOR ALL TO authenticated
  USING (public.jwt_has_any_role(ARRAY['admin','ke_toan']));

DROP POLICY IF EXISTS "Admin/ke_toan full access on acc_fixed_assets" ON public.acc_fixed_assets;
CREATE POLICY "Admin/ke_toan full access on acc_fixed_assets" ON public.acc_fixed_assets
  FOR ALL TO authenticated
  USING (public.jwt_has_any_role(ARRAY['admin','ke_toan']));

-- acc_bank_statements (admin+ke_toan)
DROP POLICY IF EXISTS accounting_bank_select ON public.acc_bank_statements;
CREATE POLICY accounting_bank_select ON public.acc_bank_statements
  FOR SELECT TO authenticated
  USING (public.jwt_has_any_role(ARRAY['admin','ke_toan']));
DROP POLICY IF EXISTS accounting_bank_insert ON public.acc_bank_statements;
CREATE POLICY accounting_bank_insert ON public.acc_bank_statements
  FOR INSERT TO authenticated
  WITH CHECK (public.jwt_has_any_role(ARRAY['admin','ke_toan']));
DROP POLICY IF EXISTS accounting_bank_update ON public.acc_bank_statements;
CREATE POLICY accounting_bank_update ON public.acc_bank_statements
  FOR UPDATE TO authenticated
  USING (public.jwt_has_any_role(ARRAY['admin','ke_toan']));
DROP POLICY IF EXISTS accounting_bank_delete ON public.acc_bank_statements;
CREATE POLICY accounting_bank_delete ON public.acc_bank_statements
  FOR DELETE TO authenticated
  USING (public.jwt_has_any_role(ARRAY['admin','ke_toan']));

-- acc_bhxh_payments (select thêm hr)
DROP POLICY IF EXISTS acc_bhxh_payments_select ON public.acc_bhxh_payments;
CREATE POLICY acc_bhxh_payments_select ON public.acc_bhxh_payments
  FOR SELECT TO authenticated
  USING (public.jwt_has_any_role(ARRAY['admin','ke_toan','hr']));
DROP POLICY IF EXISTS acc_bhxh_payments_insert ON public.acc_bhxh_payments;
CREATE POLICY acc_bhxh_payments_insert ON public.acc_bhxh_payments
  FOR INSERT TO authenticated
  WITH CHECK (public.jwt_has_any_role(ARRAY['admin','ke_toan']));
DROP POLICY IF EXISTS acc_bhxh_payments_update ON public.acc_bhxh_payments;
CREATE POLICY acc_bhxh_payments_update ON public.acc_bhxh_payments
  FOR UPDATE TO authenticated
  USING (public.jwt_has_any_role(ARRAY['admin','ke_toan']))
  WITH CHECK (public.jwt_has_any_role(ARRAY['admin','ke_toan']));
DROP POLICY IF EXISTS acc_bhxh_payments_delete ON public.acc_bhxh_payments;
CREATE POLICY acc_bhxh_payments_delete ON public.acc_bhxh_payments
  FOR DELETE TO authenticated
  USING (public.jwt_has_any_role(ARRAY['admin','ke_toan']));

-- acc_loans (admin+ke_toan)
DROP POLICY IF EXISTS loans_select ON public.acc_loans;
CREATE POLICY loans_select ON public.acc_loans
  FOR SELECT TO authenticated
  USING (public.jwt_has_any_role(ARRAY['admin','ke_toan']));
DROP POLICY IF EXISTS loans_insert ON public.acc_loans;
CREATE POLICY loans_insert ON public.acc_loans
  FOR INSERT TO authenticated
  WITH CHECK (public.jwt_has_any_role(ARRAY['admin','ke_toan']));
DROP POLICY IF EXISTS loans_update ON public.acc_loans;
CREATE POLICY loans_update ON public.acc_loans
  FOR UPDATE TO authenticated
  USING (public.jwt_has_any_role(ARRAY['admin','ke_toan']))
  WITH CHECK (public.jwt_has_any_role(ARRAY['admin','ke_toan']));
DROP POLICY IF EXISTS loans_delete ON public.acc_loans;
CREATE POLICY loans_delete ON public.acc_loans
  FOR DELETE TO authenticated
  USING (public.jwt_has_any_role(ARRAY['admin','ke_toan']));

-- acc_savings (admin+ke_toan)
DROP POLICY IF EXISTS savings_select ON public.acc_savings;
CREATE POLICY savings_select ON public.acc_savings
  FOR SELECT TO authenticated
  USING (public.jwt_has_any_role(ARRAY['admin','ke_toan']));
DROP POLICY IF EXISTS savings_insert ON public.acc_savings;
CREATE POLICY savings_insert ON public.acc_savings
  FOR INSERT TO authenticated
  WITH CHECK (public.jwt_has_any_role(ARRAY['admin','ke_toan']));
DROP POLICY IF EXISTS savings_update ON public.acc_savings;
CREATE POLICY savings_update ON public.acc_savings
  FOR UPDATE TO authenticated
  USING (public.jwt_has_any_role(ARRAY['admin','ke_toan']))
  WITH CHECK (public.jwt_has_any_role(ARRAY['admin','ke_toan']));
DROP POLICY IF EXISTS savings_delete ON public.acc_savings;
CREATE POLICY savings_delete ON public.acc_savings
  FOR DELETE TO authenticated
  USING (public.jwt_has_any_role(ARRAY['admin','ke_toan']));

-- AI Agent (admin only — giữ nguyên)
DROP POLICY IF EXISTS ai_agents_read ON public.ai_agents;
CREATE POLICY ai_agents_read ON public.ai_agents
  FOR SELECT TO authenticated
  USING (public.jwt_has_any_role(ARRAY['admin']));
DROP POLICY IF EXISTS ai_agent_runs_read ON public.ai_agent_runs;
CREATE POLICY ai_agent_runs_read ON public.ai_agent_runs
  FOR SELECT TO authenticated
  USING (public.jwt_has_any_role(ARRAY['admin']));
DROP POLICY IF EXISTS ai_agent_insights_read ON public.ai_agent_insights;
CREATE POLICY ai_agent_insights_read ON public.ai_agent_insights
  FOR SELECT TO authenticated
  USING (public.jwt_has_any_role(ARRAY['admin']));
DROP POLICY IF EXISTS ai_agent_insights_update ON public.ai_agent_insights;
CREATE POLICY ai_agent_insights_update ON public.ai_agent_insights
  FOR UPDATE TO authenticated
  USING (public.jwt_has_any_role(ARRAY['admin']));
DROP POLICY IF EXISTS ai_agent_knowledge_read ON public.ai_agent_knowledge;
CREATE POLICY ai_agent_knowledge_read ON public.ai_agent_knowledge
  FOR SELECT TO authenticated
  USING (public.jwt_has_any_role(ARRAY['admin']));
DROP POLICY IF EXISTS ai_agent_episodes_read ON public.ai_agent_episodes;
CREATE POLICY ai_agent_episodes_read ON public.ai_agent_episodes
  FOR SELECT TO authenticated
  USING (public.jwt_has_any_role(ARRAY['admin']));
DROP POLICY IF EXISTS ai_agent_conversations_read ON public.ai_agent_conversations;
CREATE POLICY ai_agent_conversations_read ON public.ai_agent_conversations
  FOR SELECT TO authenticated
  USING (public.jwt_has_any_role(ARRAY['admin']));
DROP POLICY IF EXISTS ai_agent_conversations_insert ON public.ai_agent_conversations;
CREATE POLICY ai_agent_conversations_insert ON public.ai_agent_conversations
  FOR INSERT TO authenticated
  WITH CHECK (public.jwt_has_any_role(ARRAY['admin']));

-- Attendance
DROP POLICY IF EXISTS att_office_config_update_admin ON public.att_office_config;
CREATE POLICY att_office_config_update_admin ON public.att_office_config
  FOR UPDATE TO authenticated
  USING (public.jwt_has_any_role(ARRAY['admin','hr']));

DROP POLICY IF EXISTS att_records_member_select_own ON public.att_records;
CREATE POLICY att_records_member_select_own ON public.att_records
  FOR SELECT TO authenticated
  USING (
    employee_id IN (SELECT e.id FROM hr_employees e WHERE e.auth_user_id = auth.uid())
    OR public.jwt_has_any_role(ARRAY['admin','hr','ke_toan'])
  );

DROP POLICY IF EXISTS att_records_member_update_checkout ON public.att_records;
CREATE POLICY att_records_member_update_checkout ON public.att_records
  FOR UPDATE TO authenticated
  USING (
    employee_id IN (SELECT e.id FROM hr_employees e WHERE e.auth_user_id = auth.uid())
    OR public.jwt_has_any_role(ARRAY['admin','hr'])
  );

-- Company documents / Handbook
DROP POLICY IF EXISTS admin_write_company_documents ON public.company_documents;
CREATE POLICY admin_write_company_documents ON public.company_documents
  FOR ALL TO authenticated
  USING (public.jwt_has_any_role(ARRAY['admin','ke_toan']))
  WITH CHECK (public.jwt_has_any_role(ARRAY['admin','ke_toan']));

DROP POLICY IF EXISTS admin_hr_manage_articles ON public.handbook_articles;
CREATE POLICY admin_hr_manage_articles ON public.handbook_articles
  FOR ALL TO authenticated
  USING (public.jwt_has_any_role(ARRAY['admin','hr']))
  WITH CHECK (public.jwt_has_any_role(ARRAY['admin','hr']));

DROP POLICY IF EXISTS admin_hr_manage_categories ON public.handbook_categories;
CREATE POLICY admin_hr_manage_categories ON public.handbook_categories
  FOR ALL TO authenticated
  USING (public.jwt_has_any_role(ARRAY['admin','hr']))
  WITH CHECK (public.jwt_has_any_role(ARRAY['admin','hr']));
