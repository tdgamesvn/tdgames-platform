-- Tighten RLS: replace deprecated auth.role() checks and qual=true policies
-- with multi-role-aware jwt_has_any_role(). External Outreach API anon-key
-- policies are preserved but scoped TO anon (previously {public} = everyone).
-- wf_* tables intentionally NOT touched (freelancer/member portal ownership model TBD).
-- Applied to prod via MCP apply_migration on 2026-07-02 (name: tighten_rls_role_policies).

-- ── 1. finance_fx_rates ─────────────────────────────────────────
DROP POLICY IF EXISTS "Authenticated users can read and manage fx rates" ON public.finance_fx_rates;
DROP POLICY IF EXISTS finance_fx_rates_read  ON public.finance_fx_rates;
DROP POLICY IF EXISTS finance_fx_rates_write ON public.finance_fx_rates;
CREATE POLICY finance_fx_rates_read ON public.finance_fx_rates
  FOR SELECT TO authenticated USING (true);
CREATE POLICY finance_fx_rates_write ON public.finance_fx_rates
  FOR ALL TO authenticated
  USING (public.jwt_has_any_role(ARRAY['admin','ke_toan']))
  WITH CHECK (public.jwt_has_any_role(ARRAY['admin','ke_toan']));

-- ── 2. Outreach: scope anon-key policies TO anon, staff policy for app users ──
ALTER POLICY "Allow anon insert batch log" ON public.crm_outreach_batch_log TO anon;
ALTER POLICY "Allow anon read batch log"   ON public.crm_outreach_batch_log TO anon;
ALTER POLICY "Allow anon update batch log" ON public.crm_outreach_batch_log TO anon;
DROP POLICY IF EXISTS "Allow all for authenticated" ON public.crm_outreach_batch_log;
DROP POLICY IF EXISTS crm_outreach_batch_log_staff ON public.crm_outreach_batch_log;
CREATE POLICY crm_outreach_batch_log_staff ON public.crm_outreach_batch_log
  FOR ALL TO authenticated
  USING (public.jwt_has_any_role(ARRAY['admin','ke_toan','bd']))
  WITH CHECK (public.jwt_has_any_role(ARRAY['admin','ke_toan','bd']));

ALTER POLICY "Allow anon read config" ON public.crm_outreach_config TO anon;
DROP POLICY IF EXISTS "Allow all for authenticated" ON public.crm_outreach_config;
DROP POLICY IF EXISTS crm_outreach_config_staff ON public.crm_outreach_config;
CREATE POLICY crm_outreach_config_staff ON public.crm_outreach_config
  FOR ALL TO authenticated
  USING (public.jwt_has_any_role(ARRAY['admin','ke_toan','bd']))
  WITH CHECK (public.jwt_has_any_role(ARRAY['admin','ke_toan','bd']));

ALTER POLICY backend_manage_outreach_leads ON public.crm_outreach_leads TO anon;
DROP POLICY IF EXISTS auth_manage_outreach ON public.crm_outreach_leads;
DROP POLICY IF EXISTS crm_outreach_leads_staff ON public.crm_outreach_leads;
CREATE POLICY crm_outreach_leads_staff ON public.crm_outreach_leads
  FOR ALL TO authenticated
  USING (public.jwt_has_any_role(ARRAY['admin','ke_toan','bd']))
  WITH CHECK (public.jwt_has_any_role(ARRAY['admin','ke_toan','bd']));

ALTER POLICY backend_manage_email_log ON public.crm_email_log TO anon;
DROP POLICY IF EXISTS auth_manage_email_log ON public.crm_email_log;
DROP POLICY IF EXISTS crm_email_log_staff ON public.crm_email_log;
CREATE POLICY crm_email_log_staff ON public.crm_email_log
  FOR ALL TO authenticated
  USING (public.jwt_has_any_role(ARRAY['admin','ke_toan','bd']))
  WITH CHECK (public.jwt_has_any_role(ARRAY['admin','ke_toan','bd']));

ALTER POLICY backend_manage_email_templates ON public.crm_email_templates TO anon;
DROP POLICY IF EXISTS auth_manage_templates ON public.crm_email_templates;
DROP POLICY IF EXISTS crm_email_templates_staff ON public.crm_email_templates;
CREATE POLICY crm_email_templates_staff ON public.crm_email_templates
  FOR ALL TO authenticated
  USING (public.jwt_has_any_role(ARRAY['admin','ke_toan','bd']))
  WITH CHECK (public.jwt_has_any_role(ARRAY['admin','ke_toan','bd']));

DROP POLICY IF EXISTS authenticated_all ON public.crm_hiring_studios;
DROP POLICY IF EXISTS crm_hiring_studios_staff ON public.crm_hiring_studios;
CREATE POLICY crm_hiring_studios_staff ON public.crm_hiring_studios
  FOR ALL TO authenticated
  USING (public.jwt_has_any_role(ARRAY['admin','ke_toan','bd']))
  WITH CHECK (public.jwt_has_any_role(ARRAY['admin','ke_toan','bd']));

-- ── 3. CRM core tables → admin/ke_toan/bd ───────────────────────
DROP POLICY IF EXISTS "Allow full access to crm_clients" ON public.crm_clients;
DROP POLICY IF EXISTS crm_clients_staff ON public.crm_clients;
CREATE POLICY crm_clients_staff ON public.crm_clients
  FOR ALL TO authenticated
  USING (public.jwt_has_any_role(ARRAY['admin','ke_toan','bd']))
  WITH CHECK (public.jwt_has_any_role(ARRAY['admin','ke_toan','bd']));

DROP POLICY IF EXISTS "Allow full access to crm_contacts" ON public.crm_contacts;
DROP POLICY IF EXISTS crm_contacts_staff ON public.crm_contacts;
CREATE POLICY crm_contacts_staff ON public.crm_contacts
  FOR ALL TO authenticated
  USING (public.jwt_has_any_role(ARRAY['admin','ke_toan','bd']))
  WITH CHECK (public.jwt_has_any_role(ARRAY['admin','ke_toan','bd']));

DROP POLICY IF EXISTS "Allow full access to crm_documents" ON public.crm_documents;
DROP POLICY IF EXISTS crm_documents_staff ON public.crm_documents;
CREATE POLICY crm_documents_staff ON public.crm_documents
  FOR ALL TO authenticated
  USING (public.jwt_has_any_role(ARRAY['admin','ke_toan','bd']))
  WITH CHECK (public.jwt_has_any_role(ARRAY['admin','ke_toan','bd']));

DROP POLICY IF EXISTS "Allow full access to crm_projects" ON public.crm_projects;
DROP POLICY IF EXISTS crm_projects_staff ON public.crm_projects;
CREATE POLICY crm_projects_staff ON public.crm_projects
  FOR ALL TO authenticated
  USING (public.jwt_has_any_role(ARRAY['admin','ke_toan','bd']))
  WITH CHECK (public.jwt_has_any_role(ARRAY['admin','ke_toan','bd']));

DROP POLICY IF EXISTS "Allow full access to crm_project_files" ON public.crm_project_files;
DROP POLICY IF EXISTS crm_project_files_staff ON public.crm_project_files;
CREATE POLICY crm_project_files_staff ON public.crm_project_files
  FOR ALL TO authenticated
  USING (public.jwt_has_any_role(ARRAY['admin','ke_toan','bd']))
  WITH CHECK (public.jwt_has_any_role(ARRAY['admin','ke_toan','bd']));

DROP POLICY IF EXISTS "Authenticated users can read quotations"   ON public.crm_quotations;
DROP POLICY IF EXISTS "Authenticated users can insert quotations" ON public.crm_quotations;
DROP POLICY IF EXISTS "Authenticated users can update quotations" ON public.crm_quotations;
DROP POLICY IF EXISTS "Authenticated users can delete quotations" ON public.crm_quotations;
DROP POLICY IF EXISTS crm_quotations_staff ON public.crm_quotations;
CREATE POLICY crm_quotations_staff ON public.crm_quotations
  FOR ALL TO authenticated
  USING (public.jwt_has_any_role(ARRAY['admin','ke_toan','bd']))
  WITH CHECK (public.jwt_has_any_role(ARRAY['admin','ke_toan','bd']));

DROP POLICY IF EXISTS crm_studios_select ON public.crm_studios;
DROP POLICY IF EXISTS crm_studios_insert ON public.crm_studios;
DROP POLICY IF EXISTS crm_studios_update ON public.crm_studios;
DROP POLICY IF EXISTS crm_studios_delete ON public.crm_studios;
DROP POLICY IF EXISTS crm_studios_staff ON public.crm_studios;
CREATE POLICY crm_studios_staff ON public.crm_studios
  FOR ALL TO authenticated
  USING (public.jwt_has_any_role(ARRAY['admin','ke_toan','bd']))
  WITH CHECK (public.jwt_has_any_role(ARRAY['admin','ke_toan','bd']));

-- ── 4. expense_budgets → admin/ke_toan ──────────────────────────
DROP POLICY IF EXISTS expense_budgets_all ON public.expense_budgets;
DROP POLICY IF EXISTS expense_budgets_staff ON public.expense_budgets;
CREATE POLICY expense_budgets_staff ON public.expense_budgets
  FOR ALL TO authenticated
  USING (public.is_admin_or_ke_toan())
  WITH CHECK (public.is_admin_or_ke_toan());

-- ── 5. acc_bhxh_payments: drop legacy wide-open duplicates ──────
-- (role-scoped acc_bhxh_payments_select/insert/update/delete already exist)
DROP POLICY IF EXISTS "Authenticated users can insert bhxh payments" ON public.acc_bhxh_payments;
DROP POLICY IF EXISTS "Authenticated users can read bhxh payments"   ON public.acc_bhxh_payments;
DROP POLICY IF EXISTS "Authenticated users can update bhxh payments" ON public.acc_bhxh_payments;

-- ── 6. hr_change_requests: read = admin/hr or own row ───────────
-- (staff insert/update/delete via existing cr_admin_hr_full)
DROP POLICY IF EXISTS cr_authenticated_read   ON public.hr_change_requests;
DROP POLICY IF EXISTS cr_authenticated_insert ON public.hr_change_requests;
DROP POLICY IF EXISTS cr_read_staff_or_own ON public.hr_change_requests;
CREATE POLICY cr_read_staff_or_own ON public.hr_change_requests
  FOR SELECT TO authenticated
  USING (
    public.jwt_has_any_role(ARRAY['admin','hr'])
    OR employee_id IN (SELECT id FROM public.hr_employees WHERE auth_user_id = auth.uid())
  );

-- ── 7. Evaluation: read open (evaluators are regular members), write scoped ──
DROP POLICY IF EXISTS hr_eval_cycles_auth_all ON public.hr_evaluation_cycles;
DROP POLICY IF EXISTS hr_eval_cycles_read  ON public.hr_evaluation_cycles;
DROP POLICY IF EXISTS hr_eval_cycles_write ON public.hr_evaluation_cycles;
CREATE POLICY hr_eval_cycles_read ON public.hr_evaluation_cycles
  FOR SELECT TO authenticated USING (true);
CREATE POLICY hr_eval_cycles_write ON public.hr_evaluation_cycles
  FOR ALL TO authenticated
  USING (public.jwt_has_any_role(ARRAY['admin','hr']) OR leader_user_id = auth.uid() OR created_by = auth.uid())
  WITH CHECK (public.jwt_has_any_role(ARRAY['admin','hr']) OR leader_user_id = auth.uid() OR created_by = auth.uid());

DROP POLICY IF EXISTS hr_eval_submissions_auth_all ON public.hr_evaluation_submissions;
DROP POLICY IF EXISTS hr_eval_submissions_read  ON public.hr_evaluation_submissions;
DROP POLICY IF EXISTS hr_eval_submissions_write ON public.hr_evaluation_submissions;
CREATE POLICY hr_eval_submissions_read ON public.hr_evaluation_submissions
  FOR SELECT TO authenticated USING (true);
CREATE POLICY hr_eval_submissions_write ON public.hr_evaluation_submissions
  FOR ALL TO authenticated
  USING (public.jwt_has_any_role(ARRAY['admin','hr']) OR evaluator_user_id = auth.uid())
  WITH CHECK (public.jwt_has_any_role(ARRAY['admin','hr']) OR evaluator_user_id = auth.uid());
