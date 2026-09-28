-- Bước 1/2 của quy tắc chặn bán kính 28/9 (xem 20260928110000). Chỉ thêm cột + whitelist —
-- vô hại với app cũ, phải apply TRƯỚC khi deploy client mới (client gửi last_stamp_lat/lng
-- khi check-out; thiếu cột thì PostgREST báo lỗi).

ALTER TABLE public.att_records
  ADD COLUMN IF NOT EXISTS last_stamp_lat float8,
  ADD COLUMN IF NOT EXISTS last_stamp_lng float8;

COMMENT ON COLUMN public.att_records.last_stamp_lat IS
  'Toạ độ lần tự bấm check-out/OT gần nhất (NV gửi) — trigger att_records_guard_stamp_geo kiểm bán kính.';

-- Trigger guard_self_update_columns trả mọi cột ngoài whitelist về OLD với member ⇒ phải thêm
-- 2 cột toạ độ vào whitelist, không thì trigger chặn (20260928110000) luôn thấy NULL.
DROP TRIGGER IF EXISTS att_records_guard_self_update ON public.att_records;
CREATE TRIGGER att_records_guard_self_update
  BEFORE UPDATE ON public.att_records
  FOR EACH ROW EXECUTE FUNCTION public.guard_self_update_columns(
    '{check_out,ot_check_in,ot_check_out,last_stamp_lat,last_stamp_lng}'
  );

