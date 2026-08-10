-- Outreach lead pool: lead chưa ai nhận (assigned_bd_id IS NULL) là hàng đợi chung,
-- BD nào cũng xem được và tự "nhận" về mình. Trước đó policy chỉ cho BD thấy lead
-- assigned_bd_id = auth.uid() => 1955 lead do script backend insert (không set owner)
-- vô hình với toàn bộ BD.

-- Xem pool
create policy crm_outreach_leads_bd_pool_read
  on public.crm_outreach_leads for select to authenticated
  using (jwt_has_any_role(array['bd']) and assigned_bd_id is null);

-- Nhận lead: chỉ được đụng lead chưa ai sở hữu, và bắt buộc gán về chính mình.
-- WITH CHECK chặn BD "nhận hộ" người khác hoặc trả lead về NULL sau khi sửa.
create policy crm_outreach_leads_bd_claim
  on public.crm_outreach_leads for update to authenticated
  using (jwt_has_any_role(array['bd']) and assigned_bd_id is null)
  with check (jwt_has_any_role(array['bd']) and assigned_bd_id = auth.uid());

-- ponytail: không có policy DELETE cho pool — BD chỉ xoá được lead đã nhận.
