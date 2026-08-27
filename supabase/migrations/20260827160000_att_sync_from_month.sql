-- Mốc chuyển đổi: tháng nào trở đi thì bảng công được tính từ app, trước đó nhập tay.
--
-- Bối cảnh: tới hết T8/2026 HR vẫn nhập bảng công thủ công từ MÁY CHẤM CÔNG. Chấm công
-- qua app chỉ áp dụng từ T9/2026. Nếu HR lỡ bấm "🔄 Tính từ chấm công" trên bảng T8,
-- `att_sync_month_workdays` sẽ ghi đè số nhập tay bằng vài bản ghi check-in lẻ trong app
-- ⇒ nát bảng công của tháng đó, và bảng lương copy theo.
--
-- Chặn ở SERVER chứ không phải ẩn nút ở client: đây là đường ghi đè dữ liệu tính lương.
--
-- Mốc để trong app_config (không hardcode) vì lịch triển khai rất dễ trượt —
-- lùi sang T10 thì UPDATE một dòng, không cần deploy lại.

INSERT INTO public.app_config (key, value)
VALUES ('att_sync_from_month', '2026-09')
ON CONFLICT (key) DO NOTHING;

COMMENT ON TABLE public.app_config IS
  'Cau hinh runtime. att_sync_from_month = thang YYYY-MM tro di duoc phep tinh bang cong tu app.';

CREATE OR REPLACE FUNCTION public.att_sync_month_workdays(_sheet_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _sheet       record;
  _updated     int;
  _missing     int;
  _from_month  text;
  _sheet_month text;
BEGIN
  -- SECURITY DEFINER ⇒ tự gác cổng, không dựa vào RLS của bảng.
  IF NOT is_staff() THEN
    RAISE EXCEPTION 'Chi HR/admin duoc tinh bang cong tu du lieu cham cong';
  END IF;

  SELECT * INTO _sheet FROM att_monthly_sheets WHERE id = _sheet_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Khong tim thay bang cong';
  END IF;
  IF _sheet.status = 'finalized' THEN
    RAISE EXCEPTION 'Bang cong da chot - mo lai truoc khi tinh lai';
  END IF;

  -- Chặn ghi đè các tháng còn nhập tay từ máy chấm công.
  SELECT value INTO _from_month FROM app_config WHERE key = 'att_sync_from_month';
  _from_month  := COALESCE(NULLIF(_from_month, ''), '2026-09');
  _sheet_month := _sheet.year::text || '-' || lpad(_sheet.month::text, 2, '0');
  IF _sheet_month < _from_month THEN   -- so sánh chuỗi YYYY-MM là đủ, không cần parse ngày
    RAISE EXCEPTION 'Thang % nhap tay tu may cham cong. Tinh tu app chi ap dung tu thang % tro di.',
      _sheet_month, _from_month;
  END IF;

  -- ponytail: CHỈ ghi đè work_days. late_count/absent_days/OT vẫn HR nhập tay vì
  -- att_records.late_minutes hiện luôn = 0 (self check-in không tính trễ) — sync vào
  -- là xoá trắng số HR đã gõ. Mở rộng khi nào check-in gắn được ca và tính trễ thật.
  WITH agg AS (
    SELECT r.employee_id,
           SUM(att_work_days(r.check_in, r.check_out, COALESCE(s.break_minutes, 60))) AS wd
    FROM   att_records r
    LEFT   JOIN att_shifts s ON s.id = r.shift_id
    WHERE  date_part('month', r.date) = _sheet.month
      AND  date_part('year',  r.date) = _sheet.year
      AND  r.check_in IS NOT NULL
      AND  r.check_out IS NOT NULL
    GROUP  BY r.employee_id
  )
  UPDATE att_monthly_records mr
     SET work_days = ROUND(agg.wd, 2)
    FROM agg
   WHERE mr.sheet_id = _sheet_id
     AND mr.employee_id = agg.employee_id;
  GET DIAGNOSTICS _updated = ROW_COUNT;

  -- Nhân viên không có bản ghi nào thì GIỮ NGUYÊN work_days cũ (không ép về 0) —
  -- tránh xoá số HR đã nhập tay cho người chấm công giấy/công tác.

  -- Ngày bấm vào mà quên bấm ra ⇒ không tính được, báo để HR sửa tay.
  SELECT count(*) INTO _missing
  FROM   att_records r
  JOIN   att_monthly_records mr
         ON mr.employee_id = r.employee_id AND mr.sheet_id = _sheet_id
  WHERE  date_part('month', r.date) = _sheet.month
    AND  date_part('year',  r.date) = _sheet.year
    AND  (r.check_in IS NULL OR r.check_out IS NULL);

  RETURN jsonb_build_object('updated', _updated, 'missing_checkout', _missing);
END;
$$;
