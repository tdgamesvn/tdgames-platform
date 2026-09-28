-- Quy tắc chấm công (chốt 28/9, thay cho bản "ngoài bán kính vẫn ghi nhận" 15/9):
--   • Chỉ chấm được khi đứng TRONG bán kính att_office_config — áp cho cả check-in,
--     check-out, OT check-in/out.
--   • Miễn GPS khi có đơn Remote (leave/remote) phủ hôm đó ở trạng thái approved HOẶC pending
--     (quản lý duyệt muộn không được làm nhân viên mất công). Đơn bị từ chối sau: chưa xử lý —
--     tỉ lệ từ chối hiện 0%, phát sinh thì sửa sau.
--   • Miễn bán kính vào ngày "Sự kiện công ty" (att_holidays.kind='event' ⇒ att_day_kind='event').
--
-- Check-out/OT trước đây KHÔNG có kiểm tra phía server (policy UPDATE chỉ kiểm chủ bản ghi)
-- ⇒ trigger chặn dựa trên last_stamp_lat/lng (cột thêm ở 20260928100000).
-- Bước 2/2: apply SAU khi client mới đã deploy — app cũ không gửi toạ độ check-out ⇒ bị chặn oan.
-- Ceiling giữ nguyên: toạ độ do client gửi ⇒ chặn được gọi API trần, không chặn được app giả GPS.

-- ── 1. Helpers ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.att_within_office(_lat float8, _lng float8)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT _lat IS NOT NULL AND _lng IS NOT NULL AND EXISTS (
    SELECT 1 FROM att_office_config c
    WHERE 2 * 6371000 * asin(sqrt(
            power(sin(radians(_lat - c.lat) / 2), 2)
            + cos(radians(c.lat)) * cos(radians(_lat))
              * power(sin(radians(_lng - c.lng) / 2), 2)
          )) <= c.radius_meters
  );
$$;

-- ponytail: STABLE thường, KHÔNG SECURITY DEFINER — chạy dưới quyền người gọi, member chỉ đọc
-- được đơn của chính mình (att_requests_select) ⇒ không thành RPC dò WFH người khác.
CREATE OR REPLACE FUNCTION public.att_has_remote_request(_employee_id uuid, _date date)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM att_requests r
    WHERE r.employee_id  = _employee_id
      AND r.request_type = 'leave'
      AND r.leave_type   = 'remote'
      AND r.status IN ('approved', 'pending')
      AND _date BETWEEN r.date_from AND r.date_to
  );
$$;

-- ── 2. Check-in (policy att_records_member_insert_geo gọi hàm theo tên ⇒ chỉ REPLACE) ──
CREATE OR REPLACE FUNCTION public.att_selfcheckin_valid(
  _employee_id uuid,
  _method      text,
  _date        date,
  _lat         float8,
  _lng         float8
) RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT _date = (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date AND CASE _method
    WHEN 'remote' THEN public.att_has_remote_request(_employee_id, _date)
    WHEN 'geo' THEN _lat IS NOT NULL AND _lng IS NOT NULL AND (
      public.att_within_office(_lat, _lng) OR public.att_day_kind(_date) = 'event'
    )
    ELSE false
  END;
$$;

-- ── 3. Check-out / OT (cột + whitelist ở 20260928100000) ───────
CREATE OR REPLACE FUNCTION public.att_records_guard_stamp_geo()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF current_user IN ('postgres', 'supabase_admin', 'service_role') THEN RETURN NEW; END IF;
  IF is_staff() THEN RETURN NEW; END IF;

  IF (NEW.check_out    IS DISTINCT FROM OLD.check_out
      OR NEW.ot_check_in  IS DISTINCT FROM OLD.ot_check_in
      OR NEW.ot_check_out IS DISTINCT FROM OLD.ot_check_out)
     AND NOT (
       NEW.method = 'remote'
       OR public.att_has_remote_request(NEW.employee_id, NEW.date)
       OR public.att_day_kind(NEW.date) = 'event'
       OR public.att_within_office(NEW.last_stamp_lat, NEW.last_stamp_lng)
     ) THEN
    RAISE EXCEPTION 'Bạn đang ở ngoài bán kính văn phòng — không thể chấm công. Quên chấm thì làm đơn giải trình.'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

-- Tên "att_records_guard_stamp_geo" xếp sau "att_records_guard_self_update" (thứ tự chữ cái)
-- ⇒ chạy sau khi whitelist đã lọc cột.
DROP TRIGGER IF EXISTS att_records_guard_stamp_geo ON public.att_records;
CREATE TRIGGER att_records_guard_stamp_geo
  BEFORE UPDATE OF check_out, ot_check_in, ot_check_out ON public.att_records
  FOR EACH ROW EXECUTE FUNCTION public.att_records_guard_stamp_geo();
