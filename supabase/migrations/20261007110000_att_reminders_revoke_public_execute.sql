-- Chặn gọi hàm nhắc chấm công qua RPC.
--
-- notify_missing_checkin/checkout là SECURITY DEFINER (chạy quyền postgres) nhưng đang cho
-- PUBLIC/anon/authenticated EXECUTE ⇒ ai có anon key cũng gọi /rest/v1/rpc/notify_missing_*
-- liên tục được ⇒ spam notifications + tag Discord nhân viên.
-- Chỉ pg_cron gọi 2 hàm này (job chạy dưới user postgres = owner) ⇒ thu quyền không ảnh hưởng nhắc.
-- Lưu ý: CREATE OR REPLACE giữ nguyên quyền cũ, nhưng tạo lại (DROP + CREATE) sẽ cấp lại
-- EXECUTE cho PUBLIC ⇒ khi đó phải chạy lại REVOKE này.

REVOKE EXECUTE ON FUNCTION public.notify_missing_checkin()  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_missing_checkout() FROM PUBLIC, anon, authenticated;
