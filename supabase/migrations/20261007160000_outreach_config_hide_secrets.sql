-- Outreach: giấu secret khỏi mọi user + chặn ghi settings tràn lan.
-- Trước:
--   • crm_outreach_config policy "Allow anon read config" (authenticated, USING true) ⇒ mọi tài khoản
--     đăng nhập (kể cả freelancer/member) đọc được admin_token (X-Admin-Token của Outreach API) và
--     cron_secret (gác outreach-auto-batch / outreach-auto-discovery / clickup-auto-sync).
--   • crm_outreach_settings policy "crm_outreach_settings_anon_all" (authenticated, ALL USING true)
--     ⇒ mọi tài khoản sửa thẳng sending_paused / daily_limit / resend_from.
-- Sau: secret chỉ đọc được bằng service_role (edge function) hoặc postgres (pg_cron, bỏ qua RLS).
-- Edge outreach-auto-batch v29 + outreach-proxy v24 đã đổi sang đọc admin_token bằng service_role.

DROP POLICY IF EXISTS "Allow anon read config"   ON public.crm_outreach_config;
DROP POLICY IF EXISTS crm_outreach_config_staff  ON public.crm_outreach_config;
DROP POLICY IF EXISTS outreach_config_staff      ON public.crm_outreach_config;
CREATE POLICY crm_outreach_config_staff ON public.crm_outreach_config FOR ALL TO authenticated
  USING      (public.jwt_has_any_role(ARRAY['admin','ke_toan','bd']) AND key NOT IN ('admin_token','cron_secret'))
  WITH CHECK (public.jwt_has_any_role(ARRAY['admin','ke_toan','bd']) AND key NOT IN ('admin_token','cron_secret'));

DROP POLICY IF EXISTS crm_outreach_settings_anon_all ON public.crm_outreach_settings;
DROP POLICY IF EXISTS crm_outreach_settings_staff_write ON public.crm_outreach_settings;
CREATE POLICY crm_outreach_settings_staff_write ON public.crm_outreach_settings FOR UPDATE TO authenticated
  USING (public.jwt_has_any_role(ARRAY['admin','ke_toan'])) WITH CHECK (public.jwt_has_any_role(ARRAY['admin','ke_toan']));
