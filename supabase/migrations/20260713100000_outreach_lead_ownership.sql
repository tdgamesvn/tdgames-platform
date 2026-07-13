-- Outreach Lead Ownership: mỗi BD chỉ quản lý (đọc/sửa/xoá) lead của chính mình.
-- Database studio/contact chung (crm_studios, crm_discovered_studios, crm_clients) KHÔNG đổi —
-- vẫn xem chung như cũ. Chỉ crm_outreach_leads (lead đang làm việc + gửi email) là siết riêng theo BD.

ALTER TABLE crm_outreach_leads
  ADD COLUMN IF NOT EXISTS assigned_bd_id UUID REFERENCES auth.users(id);

CREATE INDEX IF NOT EXISTS idx_outreach_leads_assigned_bd
  ON crm_outreach_leads (assigned_bd_id)
  WHERE assigned_bd_id IS NOT NULL;

-- Policy cũ cho BD thấy/sửa TẤT CẢ lead (không phân biệt ai phụ trách) — bỏ.
DROP POLICY IF EXISTS crm_outreach_leads_staff ON crm_outreach_leads;

-- Policy "anon + qual:true" (ALL) — lỗ hổng: anon key là public (bundle vào frontend JS),
-- ai cũng đọc/sửa/xoá được toàn bộ leads mà không cần đăng nhập. Backend (td-mailer-api)
-- dùng SUPABASE_SERVICE_KEY (bypass RLS hoàn toàn) nên không cần policy này. Bỏ luôn.
DROP POLICY IF EXISTS backend_manage_outreach_leads ON crm_outreach_leads;

-- admin/ke_toan: toàn quyền mọi lead (như trước)
CREATE POLICY crm_outreach_leads_admin ON crm_outreach_leads
  FOR ALL
  TO authenticated
  USING (jwt_has_any_role(ARRAY['admin', 'ke_toan']))
  WITH CHECK (jwt_has_any_role(ARRAY['admin', 'ke_toan']));

-- bd: chỉ đọc/sửa/xoá lead mình đang phụ trách (assigned_bd_id = chính mình)
CREATE POLICY crm_outreach_leads_bd ON crm_outreach_leads
  FOR ALL
  TO authenticated
  USING (jwt_has_any_role(ARRAY['bd']) AND assigned_bd_id = auth.uid())
  WITH CHECK (jwt_has_any_role(ARRAY['bd']) AND assigned_bd_id = auth.uid());
