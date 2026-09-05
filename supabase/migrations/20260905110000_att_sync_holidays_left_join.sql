-- Fix: LEFT JOIN thay FULL JOIN — NV chính thức KHÔNG có bản ghi chấm công (vd CEO) không bị sync ghi đè work_days = số ngày lễ; giữ số HR nhập tay.
-- Ngày lễ (att_holidays) được cộng công tự động — CHỈ cho nhân viên đã chính thức.
--
-- Quy tắc (sếp chốt 2026-09-05):
-- 1. Mỗi ngày lễ rơi vào T2–T6 = 1 công cho người đã chính thức TẠI ĐÚNG NGÀY ĐÓ
--    (mốc = COALESCE(official_date, probation_end + 1), cùng cách tính với payroll & leave).
--    Thử việc: 0 công lễ. Lên chính thức giữa tháng thì chỉ lễ sau mốc mới được cộng.
-- 2. Ngày lễ mà vẫn đi làm: KHÔNG cộng đúp. Giờ check-in/out hôm đó bị loại khỏi tổng công
--    thường — HR nhập vào ot_hours_holiday (hệ số ot_rate_holiday) nếu muốn trả thêm.
-- 3. HR vẫn sửa tay work_days sau khi tính (luồng không đổi).

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
  _holiday     numeric;
  _from_month  text;
  _sheet_month text;
BEGIN
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

  SELECT value INTO _from_month FROM app_config WHERE key = 'att_sync_from_month';
  _from_month  := COALESCE(NULLIF(_from_month, ''), '2026-09');
  _sheet_month := _sheet.year::text || '-' || lpad(_sheet.month::text, 2, '0');
  IF _sheet_month < _from_month THEN
    RAISE EXCEPTION 'Thang % nhap tay tu may cham cong. Tinh tu app chi ap dung tu thang % tro di.',
      _sheet_month, _from_month;
  END IF;

  -- Ngày lễ T2–T6 trong tháng của bảng công (1 dòng / ngày, gộp trùng nếu 2 kỳ lễ chồng nhau).
  DROP TABLE IF EXISTS _hd;
  CREATE TEMP TABLE _hd ON COMMIT DROP AS
  SELECT DISTINCT d::date AS d
  FROM   att_holidays h,
         generate_series(h.date_from, h.date_to, interval '1 day') d
  WHERE  date_part('month', d) = _sheet.month
    AND  date_part('year',  d) = _sheet.year
    AND  extract(isodow FROM d) < 6;

  -- ponytail: CHỈ ghi đè work_days. late_count/absent_days/OT vẫn HR nhập tay.
  WITH hours AS (
    SELECT r.employee_id,
           SUM(att_work_days(r.check_in, r.check_out, COALESCE(s.break_minutes, 60))) AS wd
    FROM   att_records r
    LEFT   JOIN att_shifts s ON s.id = r.shift_id
    WHERE  date_part('month', r.date) = _sheet.month
      AND  date_part('year',  r.date) = _sheet.year
      AND  r.check_in IS NOT NULL
      AND  r.check_out IS NOT NULL
      AND  NOT EXISTS (SELECT 1 FROM _hd WHERE _hd.d = r.date)   -- lễ đi làm → OT lễ, không cộng đúp
    GROUP  BY r.employee_id
  ), hol AS (
    SELECT mr.employee_id, count(*)::numeric AS wd
    FROM   att_monthly_records mr
    JOIN   hr_employees e ON e.id = mr.employee_id
    JOIN   _hd ON TRUE
    WHERE  mr.sheet_id = _sheet_id
      AND  COALESCE(e.official_date, e.probation_end + 1) <= _hd.d   -- đã chính thức tại ngày lễ
      AND  (e.start_date IS NULL OR e.start_date <= _hd.d)
    GROUP  BY mr.employee_id
  ), agg AS (
    SELECT h.employee_id,
           h.wd + COALESCE(l.wd, 0) AS wd
    FROM   hours h LEFT JOIN hol l ON l.employee_id = h.employee_id
  )
  UPDATE att_monthly_records mr
     SET work_days = ROUND(agg.wd, 2)
    FROM agg
   WHERE mr.sheet_id = _sheet_id
     AND mr.employee_id = agg.employee_id;
  GET DIAGNOSTICS _updated = ROW_COUNT;

  SELECT count(*) INTO _holiday FROM _hd;

  SELECT count(*) INTO _missing
  FROM   att_records r
  JOIN   att_monthly_records mr
         ON mr.employee_id = r.employee_id AND mr.sheet_id = _sheet_id
  WHERE  date_part('month', r.date) = _sheet.month
    AND  date_part('year',  r.date) = _sheet.year
    AND  (r.check_in IS NULL OR r.check_out IS NULL);

  RETURN jsonb_build_object('updated', _updated, 'missing_checkout', _missing, 'holiday_days', _holiday);
END;
$$;
