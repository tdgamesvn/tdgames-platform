-- Việc 9 — policy RLS mở cho anon/public.
--
-- `TO public` trong policy KHÔNG có nghĩa "người đã đăng nhập" — public là mọi role,
-- gồm cả `anon`. 8 bảng workforce mang policy `FOR ALL TO public USING (true)`,
-- hai trong số đó còn đặt tên nhầm là "Allow all for authenticated".
--
-- Chứng minh trước khi vá: `set local role anon` đếm được
--   wf_settlements = 18 dòng, wf_workers = 20 dòng
-- tức là dữ liệu quyết toán + đơn giá freelancer đọc được từ internet bằng anon key
-- lấy trong JS bundle, không cần tài khoản.
--
-- Backend không bị ảnh hưởng: outreach-auto-batch / outreach-auto-discovery /
-- platform-data / billing-report đều dùng SUPABASE_SERVICE_ROLE_KEY (bypass RLS).
--
-- ponytail: bước này chỉ đổi đối tượng policy public/anon → authenticated. Hành vi của
-- user đã đăng nhập KHÔNG đổi ⇒ không rủi ro hỏng app. Việc siết tiếp theo role
-- (member không được xem quyết toán của người khác) cần đọc 11 file caller ở 5 mini-app,
-- tách thành việc riêng chứ không đoán bừa ở đây.

-- ── Workforce: dữ liệu tiền của freelancer ──────────────────────────────────
alter policy "Allow all access to wf_workers"            on public.wf_workers            to authenticated;
alter policy "Allow all access to wf_tasks"              on public.wf_tasks              to authenticated;
alter policy "Allow all access to wf_settlements"        on public.wf_settlements        to authenticated;
alter policy "Allow all access to wf_settlement_tasks"   on public.wf_settlement_tasks   to authenticated;
alter policy "Allow all access to wf_contracts"          on public.wf_contracts          to authenticated;
alter policy "Allow all access to wf_clickup_config"     on public.wf_clickup_config     to authenticated;
alter policy "Allow all for authenticated"               on public.wf_project_acceptances      to authenticated;
alter policy "Allow all for authenticated"               on public.wf_project_acceptance_tasks to authenticated;

-- ── CRM outreach: policy anon sót lại cùng họ với `backend_manage_outreach_leads`
--    (đã xoá ở 20260713100000). Edge function dùng service_role nên không cần anon.
alter policy "backend_read_discovered_studios"    on public.crm_discovered_studios to authenticated;
alter policy "anon_all"                           on public.crm_hiring_studios     to authenticated;
alter policy "crm_outreach_settings_anon_all"     on public.crm_outreach_settings  to authenticated;
alter policy "Allow anon read config"             on public.crm_outreach_config    to authenticated;
alter policy "Allow anon read batch log"          on public.crm_outreach_batch_log to authenticated;
alter policy "Allow anon insert batch log"        on public.crm_outreach_batch_log to authenticated;
alter policy "Allow anon update batch log"        on public.crm_outreach_batch_log to authenticated;

-- ── Còn lại ────────────────────────────────────────────────────────────────
-- Chèn notification cho user bất kỳ. Caller thật: services/notificationService.ts
-- (đã đăng nhập) + trigger notify_* (SECURITY DEFINER, bypass RLS).
-- ponytail: mới chặn anon. Member vẫn chèn được notification giả cho người khác —
-- việc riêng, cần thêm ràng buộc sender.
alter policy "notifications_insert_all" on public.notifications to authenticated;

-- Tên policy ghi "service role" nhưng đặt TO public. service_role bypass RLS nên
-- policy này chỉ còn tác dụng mở cho anon.
alter policy "service role can insert health checks" on public.system_health_checks to authenticated;
