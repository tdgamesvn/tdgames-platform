-- 1) Manual send tracking: BD gửi tay ngoài hệ thống vẫn ghi log lại được.
ALTER TABLE crm_email_log
  ADD COLUMN IF NOT EXISTS sent_by UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS channel TEXT DEFAULT 'resend'; -- 'resend' (qua hệ thống) | 'manual' (BD tự gửi)

DROP POLICY IF EXISTS crm_email_log_staff ON crm_email_log;
DROP POLICY IF EXISTS backend_manage_email_log ON crm_email_log; -- anon + qual=true, lỗ hổng tương tự outreach_leads

CREATE POLICY crm_email_log_admin ON crm_email_log
  FOR ALL TO authenticated
  USING (jwt_has_any_role(ARRAY['admin', 'ke_toan']))
  WITH CHECK (jwt_has_any_role(ARRAY['admin', 'ke_toan']));

-- bd chỉ đọc/ghi log của lead mình phụ trách (khớp với crm_outreach_leads_bd)
CREATE POLICY crm_email_log_bd ON crm_email_log
  FOR ALL TO authenticated
  USING (
    jwt_has_any_role(ARRAY['bd']) AND
    EXISTS (SELECT 1 FROM crm_outreach_leads l WHERE l.id = crm_email_log.lead_id AND l.assigned_bd_id = auth.uid())
  )
  WITH CHECK (
    jwt_has_any_role(ARRAY['bd']) AND
    EXISTS (SELECT 1 FROM crm_outreach_leads l WHERE l.id = crm_email_log.lead_id AND l.assigned_bd_id = auth.uid())
  );

-- 2) Personal templates: created_by NULL = mặc định công ty (ai cũng dùng được, chỉ admin/ke_toan sửa);
--    created_by = user = template riêng, chỉ chủ mới sửa/xoá, người khác không thấy.
ALTER TABLE crm_email_templates
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id);

DROP POLICY IF EXISTS crm_email_templates_staff ON crm_email_templates;
DROP POLICY IF EXISTS backend_manage_email_templates ON crm_email_templates; -- anon + qual=true, cùng lỗ hổng

CREATE POLICY crm_email_templates_admin ON crm_email_templates
  FOR ALL TO authenticated
  USING (jwt_has_any_role(ARRAY['admin', 'ke_toan']))
  WITH CHECK (jwt_has_any_role(ARRAY['admin', 'ke_toan']));

CREATE POLICY crm_email_templates_bd_read ON crm_email_templates
  FOR SELECT TO authenticated
  USING (jwt_has_any_role(ARRAY['bd']) AND (created_by IS NULL OR created_by = auth.uid()));

CREATE POLICY crm_email_templates_bd_write ON crm_email_templates
  FOR ALL TO authenticated
  USING (jwt_has_any_role(ARRAY['bd']) AND created_by = auth.uid())
  WITH CHECK (jwt_has_any_role(ARRAY['bd']) AND created_by = auth.uid());
