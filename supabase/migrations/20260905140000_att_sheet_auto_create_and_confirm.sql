-- Luồng bảng công tự động (sếp chốt 05/09):
-- 1) Cron đêm tự TẠO bảng công tháng hiện tại cho mỗi sổ công ty (nếu chưa có), thêm NV mới vào, rồi sync.
-- 2) HR bấm "Gửi NV xác nhận" → notification cho từng NV; NV bấm Xác nhận ở Portal (confirmed_at).
--    Gửi lại = xoá xác nhận cũ (số liệu có thể đã sửa).
-- 3) HR chốt bảng (UI cảnh báo nếu chưa đủ xác nhận) → Payroll kéo về như cũ (chỉ nhận bảng đã chốt).
-- RLS: NV đọc được dòng bảng công của mình + sheet (trước đây chỉ staff ⇒ mục bảng công ở Portal luôn rỗng),
-- và chỉ sửa được confirmed_at (trigger guard_self_update_columns dùng chung với att_records).

ALTER TABLE public.att_monthly_sheets  ADD COLUMN IF NOT EXISTS review_sent_at timestamptz;
ALTER TABLE public.att_monthly_records ADD COLUMN IF NOT EXISTS confirmed_at   timestamptz;

DROP POLICY IF EXISTS att_monthly_sheets_read_all ON public.att_monthly_sheets;
CREATE POLICY att_monthly_sheets_read_all ON public.att_monthly_sheets
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS att_monthly_records_member_select_own ON public.att_monthly_records;
CREATE POLICY att_monthly_records_member_select_own ON public.att_monthly_records
  FOR SELECT TO authenticated
  USING (employee_id IN (SELECT e.id FROM public.hr_employees e WHERE e.auth_user_id = auth.uid()));

DROP POLICY IF EXISTS att_monthly_records_member_confirm ON public.att_monthly_records;
CREATE POLICY att_monthly_records_member_confirm ON public.att_monthly_records
  FOR UPDATE TO authenticated
  USING (employee_id IN (SELECT e.id FROM public.hr_employees e WHERE e.auth_user_id = auth.uid()));

DROP TRIGGER IF EXISTS att_monthly_records_guard_self_update ON public.att_monthly_records;
CREATE TRIGGER att_monthly_records_guard_self_update
  BEFORE UPDATE ON public.att_monthly_records
  FOR EACH ROW EXECUTE FUNCTION public.guard_self_update_columns('{confirmed_at}');

-- Cron đêm: tạo bảng nếu thiếu + thêm NV thiếu + sync. Chỉ từ att_sync_from_month.
CREATE OR REPLACE FUNCTION public.att_sync_current_month()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _d    date := (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date;
  _m    int  := extract(month FROM _d);
  _y    int  := extract(year  FROM _d);
  _from text;
  _ent  text;
  _sid  uuid;
  _st   text;
BEGIN
  SELECT value INTO _from FROM app_config WHERE key = 'att_sync_from_month';
  IF to_char(_d, 'YYYY-MM') < COALESCE(NULLIF(_from, ''), '2026-09') THEN RETURN; END IF;

  FOR _ent IN
    SELECT DISTINCT COALESCE(e.entity, 'TD GAMES') FROM hr_employees e
    WHERE e.status = 'active' AND e.type IN ('fulltime', 'parttime')
      AND NOT COALESCE(e.exclude_from_payroll, false)
  LOOP
    SELECT id, status INTO _sid, _st FROM att_monthly_sheets
     WHERE year = _y AND month = _m AND COALESCE(entity, 'TD GAMES') = _ent
     ORDER BY created_at LIMIT 1;
    IF _sid IS NULL THEN
      INSERT INTO att_monthly_sheets (month, year, title, status, notes, entity)
      VALUES (_m, _y, 'Bảng chấm công Tháng ' || _m || '/' || _y, 'draft', '', _ent)
      RETURNING id, status INTO _sid, _st;
    END IF;
    IF _st = 'finalized' THEN CONTINUE; END IF;

    INSERT INTO att_monthly_records (sheet_id, employee_id, work_days, ot_hours, ot_hours_weekend, ot_hours_holiday,
                                     ot_hours_night, ot_hours_night_weekend, ot_hours_night_holiday,
                                     late_count, early_count, absent_days, note)
    SELECT _sid, e.id, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, ''
    FROM hr_employees e
    WHERE e.status = 'active' AND e.type IN ('fulltime', 'parttime')
      AND NOT COALESCE(e.exclude_from_payroll, false)
      AND COALESCE(e.entity, 'TD GAMES') = _ent
      AND NOT EXISTS (SELECT 1 FROM att_monthly_records mr WHERE mr.sheet_id = _sid AND mr.employee_id = e.id);

    PERFORM att_sync_month_workdays(_sid);
  END LOOP;
END;
$$;

-- HR gửi yêu cầu xác nhận. Trả về số NV được thông báo.
CREATE OR REPLACE FUNCTION public.att_request_sheet_confirm(_sheet_id uuid)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _s record;
  _n int;
BEGIN
  IF NOT is_staff() THEN RAISE EXCEPTION 'Chi HR/admin duoc gui yeu cau xac nhan'; END IF;
  SELECT * INTO _s FROM att_monthly_sheets WHERE id = _sheet_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Khong tim thay bang cong'; END IF;
  IF _s.status = 'finalized' THEN RAISE EXCEPTION 'Bang cong da chot'; END IF;

  UPDATE att_monthly_records SET confirmed_at = NULL WHERE sheet_id = _sheet_id;
  UPDATE att_monthly_sheets  SET review_sent_at = now() WHERE id = _sheet_id;

  INSERT INTO notifications (recipient_user_id, type, title, body, link)
  SELECT e.auth_user_id, 'attendance_confirm',
         '📋 Xác nhận bảng công Tháng ' || _s.month || '/' || _s.year,
         'Kiểm tra ngày công / OT / đi muộn của bạn trong Portal. Đúng thì bấm Xác nhận, sai thì báo HR trước khi chốt.',
         '#portal/tasks'  -- deep-link tab chấm công của Portal
  FROM   att_monthly_records mr
  JOIN   hr_employees e ON e.id = mr.employee_id
  WHERE  mr.sheet_id = _sheet_id AND e.auth_user_id IS NOT NULL AND e.status = 'active';
  GET DIAGNOSTICS _n = ROW_COUNT;
  RETURN _n;
END;
$$;
