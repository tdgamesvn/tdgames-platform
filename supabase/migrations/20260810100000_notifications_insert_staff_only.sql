-- Việc 12: notifications_insert_all cho phép MỌI user đăng nhập chèn notification giả
-- cho bất kỳ ai (with_check = true). Mọi notification thật đều do trigger SECURITY DEFINER
-- (owner postgres, force RLS off) hoặc edge function service_role tạo => không bị ảnh hưởng.
-- Caller client duy nhất là broadcastNotification() (admin/hr) trong services/notificationService.ts.
drop policy if exists notifications_insert_all on public.notifications;

create policy notifications_insert_staff on public.notifications
  for insert to authenticated
  with check (public.is_staff());

-- TO public gồm cả anon; anon vốn không đọc/ghi được dòng nào (auth.uid() null) nhưng
-- siết cho khớp chuẩn đã áp ở migration 20260809170000.
alter policy notifications_select_own on public.notifications to authenticated;
alter policy notifications_update_own on public.notifications to authenticated;
