-- Cron attendance-sync-nightly (23:30 VN) chỉ tính lại bảng công THÁNG HIỆN TẠI. Lương trả
-- ngày 1–5 tháng sau, HR duyệt dồn đơn tháng trước vào đầu tháng ⇒ bảng tháng trước đứng yên,
-- phải bấm "Tính công" tay (sự cố 1/10/2026: 6 đơn T9 duyệt sáng 1/10, bảng T9 vẫn số cũ).
-- Sửa: tính lại thêm bảng công THÁNG TRƯỚC còn chưa chốt (finalized thì bỏ qua như cũ).
-- Không thêm dòng NV mới vào bảng tháng trước — người vào làm tháng này không thuộc bảng đó.
--
-- Kèm: hàm SECURITY DEFINER đang EXECUTE cho PUBLIC/anon/authenticated ⇒ ai cũng gọi được qua
-- RPC, ép tính lại mọi bảng chưa chốt (đè số HR sửa tay). Chỉ cron (postgres) cần gọi.
CREATE OR REPLACE FUNCTION public.att_sync_current_month()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _d    date := (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date;
  _m    int  := extract(month FROM _d);
  _y    int  := extract(year  FROM _d);
  _pd   date := (date_trunc('month', _d) - interval '1 day')::date;  -- ngày cuối tháng trước
  _from text;
  _ent  text;
  _sid  uuid;
  _st   text;
BEGIN
  SELECT value INTO _from FROM app_config WHERE key = 'att_sync_from_month';
  _from := COALESCE(NULLIF(_from, ''), '2026-09');

  -- Tháng trước: chỉ bảng đã tồn tại và chưa chốt.
  IF to_char(_pd, 'YYYY-MM') >= _from THEN
    FOR _sid IN
      SELECT id FROM att_monthly_sheets
       WHERE year = extract(year FROM _pd) AND month = extract(month FROM _pd)
         AND status <> 'finalized'
    LOOP
      PERFORM att_sync_month_workdays(_sid);
    END LOOP;
  END IF;

  IF to_char(_d, 'YYYY-MM') < _from THEN RETURN; END IF;

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
$function$;

REVOKE EXECUTE ON FUNCTION public.att_sync_current_month() FROM PUBLIC, anon, authenticated;
