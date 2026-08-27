-- Ngày công hiển thị khi check-out: trừ giờ nghỉ giữa ca, chia 8, chặn trần 1 ngày.
--
-- Trước đó: ROUND(_hours / 8.0, 2) trên nguyên khoảng check-in → check-out.
-- Ca hành chính 08:30–17:30 = 9h ⇒ báo 1.13 ngày công (sai, phải là 1.00).
--
-- ponytail: dùng att_shifts.break_minutes có sẵn (default 60), không hardcode 12h–13h —
-- đổi ca/đổi giờ nghỉ trong ShiftManager là con số này theo luôn.
-- Nghỉ giữa ca không kéo giờ công xuống dưới 6h (BLLĐ 2019 Đ.109: làm ≥6h liên tục
-- mới có nghỉ giữa giờ), nên nửa buổi 08:30–11:30 vẫn ra 0.38 chứ không bị trừ oan.
--   3h → 0.38 | 6h → 0.75 | 6.5h → 0.75 | 8h → 0.88 | 9h (08:30–17:30) → 1.00 | 11h → 1.00
-- Con số này CHỈ hiển thị trên Discord — `att_monthly_records.work_days` vẫn HR nhập tay.
--
-- Tiện thể vá luôn: `IF _shift IS NOT NULL` trên record chưa gán sẽ raise
-- "record _shift is not assigned yet" khi bản ghi không có shift_id ⇒ đổi sang cờ FOUND.

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
  _break_h        numeric := 1.0;   -- fallback khi bản ghi không gắn ca
  _discord_url    text;
  _kind           text;   -- 'in' | 'out' | 'ot_in' | 'ot_out'
  _vn_time        text;
  _title          text;
  _color          int;
  _fields         jsonb;
  _content        text := '';
  _hours          numeric;
  _paid_hours     numeric;
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
      _break_h := COALESCE(_shift.break_minutes, 60) / 60.0;
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
      _hours := EXTRACT(EPOCH FROM (NEW.check_out::timestamptz - NEW.check_in::timestamptz)) / 3600.0;
      -- Trừ nghỉ giữa ca nhưng không kéo xuống dưới 6h — tránh bậc nhảy ngược
      -- (ở 5.9h được 0.74 mà ở 6.0h chỉ còn 0.63). Hàm này không giảm theo _hours.
      _paid_hours := GREATEST(LEAST(_hours, GREATEST(_hours - _break_h, 6)), 0);
      _work_days  := LEAST(ROUND(_paid_hours / 8.0, 2), 1);
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
