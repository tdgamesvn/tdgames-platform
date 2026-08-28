-- Ngày lễ thì không có khái niệm đi muộn / về sớm.
--
-- Bản đầu (20260828140000) mới bỏ qua ngày ngoài `applicable_days` của ca (T7/CN), quên mất
-- `att_holidays`. Hậu quả nhìn thấy ngay trên báo cáo T8: 6 người "đi muộn 87 phút" cùng
-- một ngày, cùng khung 09:57 — thực ra hôm đó nghỉ lễ, ai vào cũng chỉ là ghé qua.
--
-- SECURITY DEFINER: trigger chạy dưới quyền người đang ghi. Nhân viên tự check-in mà RLS
-- không cho họ SELECT `att_holidays` thì EXISTS trả false ⇒ ngày lễ vẫn bị tính muộn, mà lỗi
-- kiểu này im lặng hoàn toàn. Hàm chỉ đọc 2 bảng cấu hình và gán cột của chính NEW.
CREATE OR REPLACE FUNCTION public.att_compute_late_early()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _sh    record;
  _dow   text;
  _diff  int;
BEGIN
  SELECT s.* INTO _sh
  FROM att_shifts s
  WHERE s.id = NEW.shift_id
     OR (NEW.shift_id IS NULL AND s.is_active AND s.shift_type = 'fixed')
  ORDER BY (s.id = NEW.shift_id) DESC NULLS LAST, s.created_at
  LIMIT 1;

  IF NOT FOUND THEN RETURN NEW; END IF;

  _dow := to_char(NEW.date, 'dy');
  IF NOT (_dow = ANY(_sh.applicable_days))
     OR EXISTS (
       SELECT 1 FROM att_holidays h
       WHERE NEW.date BETWEEN h.date_from AND h.date_to
     )
  THEN
    NEW.late_minutes  := 0;
    NEW.early_minutes := 0;
    RETURN NEW;
  END IF;

  IF NEW.check_in IS NOT NULL THEN
    _diff := GREATEST(EXTRACT(EPOCH FROM (
      (NEW.check_in AT TIME ZONE 'Asia/Ho_Chi_Minh')::time - _sh.start_time
    )) / 60, 0)::int;
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

  IF COALESCE(NEW.status, 'present') IN ('present', 'late') THEN
    NEW.status := CASE WHEN COALESCE(NEW.late_minutes, 0) > 0 THEN 'late' ELSE 'present' END;
  END IF;

  RETURN NEW;
END;
$$;

-- Tính lại toàn bộ (không đụng check_out ⇒ 3 trigger Discord `UPDATE OF` không bắn).
UPDATE public.att_records SET status = status;

-- ⚠ CHƯA XỬ LÝ: bảng `att_holidays` hiện chỉ có đúng 1 dòng (Quốc khánh 29/8–2/9/2026).
-- Ngày 26/08/2026 mà sếp xác nhận là nghỉ lễ KHÔNG có trong bảng ⇒ trigger vẫn tính muộn
-- cho hôm đó. Phải thêm dòng nghỉ lễ vào `att_holidays` (tab Nghỉ phép) rồi chạy lại
-- `UPDATE att_records SET status = status;` thì số mới sạch.
