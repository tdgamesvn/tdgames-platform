-- Fix 42501 "permission denied for table users": các policy cũ trên crm_deals /
-- crm_payment_schedules query thẳng auth.users (authenticated không có quyền SELECT).
-- Thay bằng jwt_has_any_role() — đọc role + secondary_roles từ JWT, cùng ngữ nghĩa.

-- crm_deals
drop policy if exists crm_deals_admin on crm_deals;
drop policy if exists crm_deals_bd_read on crm_deals;
drop policy if exists crm_deals_bd_write on crm_deals;

create policy crm_deals_admin on crm_deals for all to authenticated
  using (jwt_has_any_role(array['admin', 'ke_toan']))
  with check (jwt_has_any_role(array['admin', 'ke_toan']));
create policy crm_deals_bd_read on crm_deals for select to authenticated
  using (jwt_has_any_role(array['bd']));
create policy crm_deals_bd_write on crm_deals for all to authenticated
  using (owner_id = auth.uid() and jwt_has_any_role(array['bd']))
  with check (owner_id = auth.uid() and jwt_has_any_role(array['bd']));

-- crm_payment_schedules (crm_ps_select đã dùng auth.uid(), giữ nguyên)
drop policy if exists crm_ps_insert on crm_payment_schedules;
drop policy if exists crm_ps_update on crm_payment_schedules;
drop policy if exists crm_ps_delete on crm_payment_schedules;

create policy crm_ps_insert on crm_payment_schedules for insert to authenticated
  with check (jwt_has_any_role(array['admin', 'bd']));
create policy crm_ps_update on crm_payment_schedules for update to authenticated
  using (jwt_has_any_role(array['admin', 'ke_toan', 'bd']));
create policy crm_ps_delete on crm_payment_schedules for delete to authenticated
  using (jwt_has_any_role(array['admin', 'bd']));
