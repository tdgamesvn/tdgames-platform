-- Tính đi muộn / về sớm ở DB thay vì ở client.
--
-- Trước đó: UI đã có chỗ hiện (AttendanceReport "Tổng phút muộn", badge "Muộn 25p" ở
-- AttendanceLog/Dashboard) nhưng luôn bằng 0 — 25/25 bản ghi có late_minutes = 0.
-- Ba lý do cộng lại:
--   1. `attendanceService.checkIn` chỉ tính muộn khi truyền `shiftId`, mà 0/25 bản ghi gắn ca.
--   2. Check-in geo từ Portal (đường DUY NHẤT nhân viên đang dùng) insert cứng
--      `status:'present', late_minutes: 0` và không gắn ca ⇒ không bao giờ vào nhánh tính.
--   3. Không có chỗ nào tính `early_minutes` — cột chết từ ngày tạo bảng.
--
-- Đặt ở DB vì mọi đường ghi đều chui qua đây: check-in geo, check-out, HR sửa tay,
-- `applyForgotRequest` khi duyệt đơn quên chấm công. Sửa ở client thì phải vá 4 chỗ và
-- vẫn sai múi giờ — code cũ dùng `new Date()` theo đồng hồ MÁY KHÁCH, ai để máy lệch
-- timezone là số phút muộn lệch theo.
--
-- ⚠ Hệ quả có chủ ý: duyệt đơn quên chấm công khai giờ vào 09:45 giờ sẽ bị tính muộn
-- thật, thay vì `late_minutes: 0` như trước. Đơn giải trình là để ngày đó CÓ công,
-- không phải để xoá dấu đi muộn. Muốn tha thì HR sửa tay bản ghi sau khi duyệt.

CREATE OR REPLACE FUNCTION public.att_compute_late_early()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  _sh    record;
  _dow   text;
  _diff  int;
BEGIN
  -- Bản ghi không gắn ca thì rơi về ca hành chính đang bật (hiện là ca duy nhất).
  -- Cùng kiểu fallback với `notify_attendance_discord` — không bịa thêm nguồn cấu hình mới.
  SELECT s.* INTO _sh
  FROM att_shifts s
  WHERE s.id = NEW.shift_id
     OR (NEW.shift_id IS NULL AND s.is_active AND s.shift_type = 'fixed')
  ORDER BY (s.id = NEW.shift_id) DESC NULLS LAST, s.created_at
  LIMIT 1;

  IF NOT FOUND THEN RETURN NEW; END IF;

  -- Ngoài ngày làm việc của ca (T7/CN) thì không có khái niệm muộn/sớm.
  _dow := to_char(NEW.date, 'dy');
  IF NOT (_dow = ANY(_sh.applicable_days)) THEN
    NEW.late_minutes  := 0;
    NEW.early_minutes := 0;
    RETURN NEW;
  END IF;

  -- timestamptz lưu UTC ⇒ phải quy về giờ VN mới so được với start_time/end_time (giờ local).
  IF NEW.check_in IS NOT NULL THEN
    _diff := GREATEST(EXTRACT(EPOCH FROM (
      (NEW.check_in AT TIME ZONE 'Asia/Ho_Chi_Minh')::time - _sh.start_time
    )) / 60, 0)::int;
    -- Quá ngưỡng thì ghi TRỌN số phút muộn (không trừ ngưỡng) — giữ đúng nghĩa cũ của
    -- badge "Muộn 25p" ở AttendanceLog. Ngưỡng chỉ là mức bỏ qua, không phải mức miễn trừ.
    NEW.late_minutes := CASE
      WHEN _diff > COALESCE(_sh.late_threshold_minutes, 15) THEN _diff ELSE 0 END;
  END IF;

  IF NEW.check_out IS NOT NULL THEN
    _diff := GREATEST(EXTRACT(EPOCH FROM (
      _sh.end_time - (NEW.check_out AT TIME ZONE 'Asia/Ho_Chi_Minh')::time
    )) / 60, 0)::int;
    NEW.early_minutes := CASE
      WHEN _diff > COALESCE(_sh.early_threshold_minutes, 15) THEN _diff ELSE 0 END;
  END IF;

  -- Chỉ lật giữa present/late. 'leave', 'absent', 'holiday'... là do HR đặt, không đụng.
  IF COALESCE(NEW.status, 'present') IN ('present', 'late') THEN
    NEW.status := CASE WHEN COALESCE(NEW.late_minutes, 0) > 0 THEN 'late' ELSE 'present' END;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.att_compute_late_early() IS
  'Tinh late_minutes/early_minutes/status tu ca lam viec. Nguon duy nhat cua cong thuc nay.';

-- ⚠ TÊN TRIGGER PHẢI SẮP SAU `att_records_guard_self_update` theo alphabet.
-- Postgres chạy BEFORE trigger theo thứ tự tên. Guard ép mọi cột ngoài whitelist
-- {check_out, ot_check_in, ot_check_out} về giá trị cũ khi người sửa không phải staff —
-- chạy trước guard thì early_minutes vừa tính xong bị guard trả về 0 ngay lúc nhân viên
-- bấm giờ về. Đổi tên trigger này thành 'att_records_compute_*' là hỏng luồng đó.
DROP TRIGGER IF EXISTS att_records_zz_late_early ON public.att_records;
CREATE TRIGGER att_records_zz_late_early
  BEFORE INSERT OR UPDATE ON public.att_records
  FOR EACH ROW EXECUTE FUNCTION public.att_compute_late_early();

-- Vá lại toàn bộ bản ghi cũ. SET status = status ⇒ chạy qua trigger BEFORE UPDATE mà
-- không đụng cột check_out/ot_* nên không kích hoạt 3 trigger Discord (đều `UPDATE OF`).
UPDATE public.att_records SET status = status;
