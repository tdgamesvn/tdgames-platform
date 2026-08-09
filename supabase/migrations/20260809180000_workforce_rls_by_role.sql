-- Việc 10 — siết RLS workforce theo role + bịt fallback user_metadata trong jwt_roles().
--
-- ── PHẦN 1: jwt_roles() đang tin user_metadata ─────────────────────────────
-- `jwt_roles()` = COALESCE(app_metadata.role, user_metadata.role, 'member').
-- `user_metadata` là thứ user TỰ SỬA ĐƯỢC bằng `supabase.auth.updateUser({data:{...}})`.
-- Nếu một user thiếu `app_metadata.role`, COALESCE rơi xuống user_metadata ⇒ user đó tự
-- phong mình làm admin, và MỌI guard RLS + guard trong SECURITY DEFINER function
-- (kể cả mấy cái vừa thêm ở việc 8) đều vô hiệu.
--
-- Hiện chưa khai thác được: 23/23 user đều có `app_metadata.role` nên COALESCE luôn dừng
-- ở nhánh đầu. Kiểm bằng JWT giả `{app_metadata:{role:member}, user_metadata:{role:admin}}`
-- → `jwt_roles()` trả `{member}`, `is_admin_or_ke_toan()` = false. Nhưng chỉ cần một user
-- mới tạo thiếu app_metadata.role là mìn nổ. Bỏ hẳn nhánh user_metadata.
-- Số user bị ảnh hưởng: 0.

create or replace function public.jwt_roles()
returns text[] language sql stable security definer set search_path = public, pg_temp as $$
  SELECT ARRAY(
    SELECT DISTINCT r FROM (
      SELECT COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', 'member') AS r
      UNION ALL
      SELECT jsonb_array_elements_text(
        CASE WHEN jsonb_typeof(auth.jwt() -> 'app_metadata' -> 'secondary_roles') = 'array'
             THEN auth.jwt() -> 'app_metadata' -> 'secondary_roles'
             ELSE '[]'::jsonb END
      )
    ) t
    WHERE r IS NOT NULL AND r <> ''
  );
$$;

-- ── PHẦN 2: policy workforce theo role ─────────────────────────────────────
-- Sau việc 9, policy `wf_*` là `authenticated USING (true)` ⇒ mọi user đăng nhập, kể cả
-- member/freelancer, vẫn đọc được quyết toán + đơn giá của NGƯỜI KHÁC.
--
-- Cách nối user → worker: `wf_workers` KHÔNG có cột auth_user_id, chỉ có `email`.
-- `worker_id` thì 0/23 user có trong app_metadata lẫn user_metadata ⇒ không dùng được
-- (mà user_metadata cũng không đáng tin, xem phần 1). Dùng claim `email` — do Supabase
-- phát, user không tự đặt bừa. Đây đúng là cách portalService.ts:227-236 đang map sẵn.

create or replace function public.my_worker_id()
returns uuid language sql stable security definer set search_path = public, pg_temp as $$
  SELECT id FROM public.wf_workers
  WHERE lower(email) = lower(auth.jwt() ->> 'email')
  LIMIT 1;
$$;
revoke execute on function public.my_worker_id() from public, anon;
grant execute on function public.my_worker_id() to authenticated;

-- Bảng có worker_id: staff toàn quyền, người khác chỉ ĐỌC dòng của chính mình.
drop policy if exists "Allow all access to wf_workers"     on public.wf_workers;
create policy wf_workers_staff_all  on public.wf_workers for all to authenticated
  using (public.is_staff()) with check (public.is_staff());
create policy wf_workers_self_read  on public.wf_workers for select to authenticated
  using (id = public.my_worker_id());

drop policy if exists "Allow all access to wf_tasks"       on public.wf_tasks;
create policy wf_tasks_staff_all    on public.wf_tasks for all to authenticated
  using (public.is_staff()) with check (public.is_staff());
create policy wf_tasks_self_read    on public.wf_tasks for select to authenticated
  using (worker_id = public.my_worker_id());

drop policy if exists "Allow all access to wf_settlements" on public.wf_settlements;
create policy wf_settlements_staff_all on public.wf_settlements for all to authenticated
  using (public.is_staff()) with check (public.is_staff());
create policy wf_settlements_self_read on public.wf_settlements for select to authenticated
  using (worker_id = public.my_worker_id());

drop policy if exists "Allow all access to wf_contracts"   on public.wf_contracts;
create policy wf_contracts_staff_all on public.wf_contracts for all to authenticated
  using (public.is_staff()) with check (public.is_staff());
create policy wf_contracts_self_read on public.wf_contracts for select to authenticated
  using (worker_id = public.my_worker_id());

-- Bảng nối: kế thừa qua settlement cha (freelancerPortalService.ts:28-30 join đúng lối này).
drop policy if exists "Allow all access to wf_settlement_tasks" on public.wf_settlement_tasks;
create policy wf_settlement_tasks_staff_all on public.wf_settlement_tasks for all to authenticated
  using (public.is_staff()) with check (public.is_staff());
create policy wf_settlement_tasks_self_read on public.wf_settlement_tasks for select to authenticated
  using (exists (
    select 1 from public.wf_settlements s
    where s.id = settlement_id and s.worker_id = public.my_worker_id()
  ));

-- Không có worker_id, thuần nội bộ (nghiệm thu với khách + cấu hình sync) ⇒ chỉ staff.
drop policy if exists "Allow all for authenticated" on public.wf_project_acceptances;
create policy wf_project_acceptances_staff_all on public.wf_project_acceptances for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

drop policy if exists "Allow all for authenticated" on public.wf_project_acceptance_tasks;
create policy wf_project_acceptance_tasks_staff_all on public.wf_project_acceptance_tasks for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

drop policy if exists "Allow all access to wf_clickup_config" on public.wf_clickup_config;
create policy wf_clickup_config_staff_all on public.wf_clickup_config for all to authenticated
  using (public.is_staff()) with check (public.is_staff());
