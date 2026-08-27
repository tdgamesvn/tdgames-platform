-- Nối chấm công hằng ngày (att_records) vào bảng công tháng (att_monthly_records).
--
-- Trước đó 2 bảng rời nhau hoàn toàn: nhân viên bấm check-in/out cả tháng, nhưng
-- `att_monthly_records.work_days` — cột payroll đọc để tính lương — vẫn do HR gõ tay 100%.
-- Dữ liệu realtime chỉ dùng để bắn thông báo Discord rồi vứt đi.
--
-- 1. `att_work_days()` — MỘT công thức dùng chung cho cả trigger Discord lẫn RPC tổng hợp.
--    Trước đó công thức bị chép 3 bản lệch nhau (Portal 1.13 / Discord 1.00 / HR gõ tay).
-- 2. `notify_attendance_discord()` gọi hàm chung thay vì tự tính.
-- 3. `att_sync_month_workdays()` — nút "Tính từ chấm công" gọi vào. Ghi đè work_days,
--    HR vẫn sửa tay đè lên được sau đó (đúng luồng: app chấm → HR chốt & sửa nếu sai).

-- ══════════════════════════════════════════════════════════════════
-- 1. Công thức ngày công dùng chung
-- ══════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.att_work_days(
  _in timestamptz, _out timestamptz, _break_minutes int DEFAULT 60
) RETURNS numeric
LANGUAGE sql IMMUTABLE
AS $$
  -- Trừ nghỉ giữa ca nhưng không kéo giờ công xuống dưới 6h (tránh bậc nhảy ngược:
  -- 5.9h→0.74 mà 6.0h→0.63 nếu trừ thẳng), chia 8, trần 1 ngày công/ngày.
  -- 3h→0.38 | 6h→0.75 | 8h→0.88 | 9h (08:30–17:30)→1.00 | 11h→1.00
  SELECT LEAST(
    ROUND(GREATEST(LEAST(h, GREATEST(h - COALESCE(_break_minutes, 60) / 60.0, 6)), 0) / 8.0, 2),
    1
  )
  FROM (
    SELECT CASE
             WHEN _in IS NULL OR _out IS NULL OR _out <= _in THEN 0
             ELSE EXTRACT(EPOCH FROM (_out - _in)) / 3600.0
           END AS h
  ) t;
$$;

COMMENT ON FUNCTION public.att_work_days(timestamptz, timestamptz, int) IS
  'Ngày công của MỘT ca: (giờ có mặt - nghỉ giữa ca, sàn 6h) / 8, trần 1.0. Nguồn duy nhất của công thức này.';

-- ══════════════════════════════════════════════════════════════════
-- 2. Trigger Discord dùng lại hàm chung
-- ══════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.notify_attendance_discord()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _emp            record;
  _shift          record;
  _has_shift      boolean := false;
  _break_min      int := 60;   -- fallback khi bản ghi không gắn ca (hiện 100% bản ghi shift_id NULL)
  _discord_url    text;
  _kind           text;   -- 'in' | 'out' | 'ot_in' | 'ot_out'
  _vn_time        text;
  _title          text;
  _color          int;
  _fields         jsonb;
  _content        text := '';
  _hours          numeric;
  _work_days      numeric;
  _duration_text  text;
  _checkin_msgs   text[] := ARRAY[
    'Ngay moi tran day nang luong! Cung lam viec thoi nao! 🔥',
    'Chuc mot ngay lam viec hieu qua! 💪',
    'Let''s gooo! Mot ngay moi, mot co hoi moi! 🚀',
    'Sang nay tran day cam hung! ☀️',
    'Bat dau ngay moi thoi! ⚡',
    'Good morning! Hom nay se la mot ngay tuyet voi 🌟',
    'Rise and shine! Chay het cong suat nao! 🏃'
  ];
  _checkout_msgs  text[] := ARRAY[
    'Nghi ngoi xung dang nhe! Hen gap lai ngay mai 👋',
    'Mot ngay lam viec tuyet voi! Ve nghi ngoi thoi 🌙',
    'Good job hom nay! See you tomorrow 🎉',
    'Het gio roi! Tan huong buoi toi nhe 🌆',
    'Cam on vi mot ngay cong hien! 💯',
    'Well done! Hen gap lai ngay mai nhe 🫡',
    'Bai bai! Have a great evening 🏠'
  ];
  _ot_in_msgs     text[] := ARRAY[
    'Vao ca tang ca! Giu suc nhe 💪',
    'OT mode: ON 🌙',
    'Nan lai them chut nua, co len! 🔥'
  ];
  _ot_out_msgs    text[] := ARRAY[
    'Xong ca tang ca! Ve nghi som nhe 🌙',
    'Cam on vi da o lai! 🫡',
    'Het OT roi! Ngu bu di nhe 😴'
  ];
  _msg            text;
BEGIN
  SELECT value INTO _discord_url
  FROM   public.app_config
  WHERE  key = 'discord_attendance_webhook'
  LIMIT  1;

  IF _discord_url IS NULL OR _discord_url = '' THEN
    RETURN NEW;
  END IF;

  SELECT e.full_name, e.discord_user_id, e.type
  INTO   _emp
  FROM   hr_employees e
  WHERE  e.id = NEW.employee_id
  LIMIT  1;

  IF _emp IS NULL OR _emp.type = 'freelancer' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    _kind := 'in';
  ELSIF TG_OP = 'UPDATE' AND OLD.check_out IS NULL AND NEW.check_out IS NOT NULL THEN
    _kind := 'out';
  ELSIF TG_OP = 'UPDATE' AND OLD.ot_check_in IS NULL AND NEW.ot_check_in IS NOT NULL THEN
    _kind := 'ot_in';
  ELSIF TG_OP = 'UPDATE' AND OLD.ot_check_out IS NULL AND NEW.ot_check_out IS NOT NULL THEN
    _kind := 'ot_out';
  ELSE
    RETURN NEW;
  END IF;

  IF NEW.shift_id IS NOT NULL THEN
    SELECT s.name, s.start_time, s.end_time, s.break_minutes
    INTO   _shift
    FROM   att_shifts s
    WHERE  s.id = NEW.shift_id
    LIMIT  1;
    _has_shift := FOUND;
    IF _has_shift THEN
      _break_min := COALESCE(_shift.break_minutes, 60);
    END IF;
  END IF;

  _vn_time := to_char(now() AT TIME ZONE 'Asia/Ho_Chi_Minh', 'HH24:MI');

  IF _kind = 'in' THEN
    _title := '🟢 CHECK IN — ' || _emp.full_name;
    _color := 5025616; -- #4CAF50 green
    _msg   := _checkin_msgs[1 + floor(random() * array_length(_checkin_msgs, 1))::int];

    _fields := jsonb_build_array(
      jsonb_build_object('name', '⏰ Gio vao',     'value', _vn_time, 'inline', true),
      jsonb_build_object('name', '📍 Phuong thuc', 'value',
        CASE NEW.method
          WHEN 'geo'    THEN '🏢 Tai van phong'
          WHEN 'remote' THEN '🏠 Remote'
          WHEN 'manual' THEN '✏️ Thu cong (HR)'
          WHEN 'qr'     THEN '📱 QR Code'
          ELSE NEW.method
        END, 'inline', true)
    );

    IF _has_shift THEN
      _fields := _fields || jsonb_build_array(
        jsonb_build_object('name', '📋 Ca lam viec', 'value',
          _shift.name || ' (' || _shift.start_time || ' – ' || _shift.end_time || ')',
          'inline', false)
      );
    END IF;

  ELSIF _kind = 'out' THEN
    _title := '🔴 CHECK OUT — ' || _emp.full_name;
    _color := 15548997; -- #ED4245 red
    _msg   := _checkout_msgs[1 + floor(random() * array_length(_checkout_msgs, 1))::int];

    IF NEW.check_in IS NOT NULL AND NEW.check_out IS NOT NULL THEN
      _hours     := EXTRACT(EPOCH FROM (NEW.check_out - NEW.check_in)) / 3600.0;
      _work_days := att_work_days(NEW.check_in, NEW.check_out, _break_min);
      _duration_text := floor(_hours)::text || 'h ' || ROUND((_hours - floor(_hours)) * 60)::text || 'p';
    ELSE
      _hours         := 0;
      _work_days     := 0;
      _duration_text := '—';
    END IF;

    _fields := jsonb_build_array(
      jsonb_build_object('name', '⏰ Gio ra',    'value', _vn_time, 'inline', true),
      jsonb_build_object('name', '⏱ Thoi gian', 'value',
        _duration_text || ' (' || _work_days || ' ngay cong)',
        'inline', true)
    );

    IF _has_shift THEN
      _fields := _fields || jsonb_build_array(
        jsonb_build_object('name', '📋 Ca lam viec', 'value',
          _shift.name || ' (' || _shift.start_time || ' – ' || _shift.end_time || ')',
          'inline', false)
      );
    END IF;

  ELSIF _kind = 'ot_in' THEN
    _title := '🟠 CHECK IN OT — ' || _emp.full_name;
    _color := 16750848; -- #FF9500 brand orange
    _msg   := _ot_in_msgs[1 + floor(random() * array_length(_ot_in_msgs, 1))::int];

    _fields := jsonb_build_array(
      jsonb_build_object('name', '⏰ Bat dau OT', 'value', _vn_time, 'inline', true)
    );

  ELSE -- 'ot_out'
    _title := '🟣 CHECK OUT OT — ' || _emp.full_name;
    _color := 10181046; -- #9B59B6 purple
    _msg   := _ot_out_msgs[1 + floor(random() * array_length(_ot_out_msgs, 1))::int];

    IF NEW.ot_check_in IS NOT NULL THEN
      _hours         := EXTRACT(EPOCH FROM (NEW.ot_check_out - NEW.ot_check_in)) / 3600.0;
      _duration_text := floor(_hours)::text || 'h ' || ROUND((_hours - floor(_hours)) * 60)::text || 'p';
    ELSE
      _duration_text := '—';
    END IF;

    _fields := jsonb_build_array(
      jsonb_build_object('name', '⏰ Ket thuc OT', 'value', _vn_time, 'inline', true),
      jsonb_build_object('name', '⏱ Gio tang ca', 'value', _duration_text, 'inline', true)
    );
  END IF;

  _fields := _fields || jsonb_build_array(
    jsonb_build_object('name', '💬', 'value', '"' || _msg || '"', 'inline', false)
  );

  IF _emp.discord_user_id IS NOT NULL AND _emp.discord_user_id <> '' THEN
    _content := '<@' || _emp.discord_user_id || '>';
  END IF;

  PERFORM net.http_post(
    url     := _discord_url,
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body    := jsonb_build_object(
      'content', _content,
      'embeds', jsonb_build_array(
        jsonb_build_object(
          'title',  _title,
          'color',  _color,
          'fields', _fields,
          'footer', jsonb_build_object(
            'text', 'TD Games Attendance • ' || to_char(now() AT TIME ZONE 'Asia/Ho_Chi_Minh', 'DD/MM/YYYY')
          )
        )
      )
    )
  );

  RETURN NEW;
END;
$$;

-- ══════════════════════════════════════════════════════════════════
-- 3. Tổng hợp att_records → work_days của một bảng công
-- ══════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.att_sync_month_workdays(_sheet_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _sheet    record;
  _updated  int;
  _missing  int;
BEGIN
  -- SECURITY DEFINER ⇒ tự gác cổng, không dựa vào RLS của bảng.
  IF NOT is_staff() THEN
    RAISE EXCEPTION 'Chỉ HR/admin được tính bảng công từ dữ liệu chấm công';
  END IF;

  SELECT * INTO _sheet FROM att_monthly_sheets WHERE id = _sheet_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Không tìm thấy bảng công';
  END IF;
  IF _sheet.status = 'finalized' THEN
    RAISE EXCEPTION 'Bảng công đã chốt — mở lại trước khi tính lại';
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

REVOKE ALL ON FUNCTION public.att_sync_month_workdays(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.att_sync_month_workdays(uuid) TO authenticated;
