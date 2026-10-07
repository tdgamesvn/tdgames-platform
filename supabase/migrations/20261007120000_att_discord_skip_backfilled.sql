-- Discord chấm công: chỉ báo khi chấm THẬT (GPS/QR, giờ ghi ≈ now()).
-- Trước đây duyệt đơn quên chấm công / HR sửa tay giờ vào-ra cho ngày cũ cũng bắn
-- "CHECK OUT" với giờ = now() và ngày = hôm nay ⇒ trông như vừa check-out.
-- Nay: bỏ qua nếu mốc giờ vừa ghi lệch now() > 15 phút (bổ sung sau). Không dựa vào note
-- vì note "Giải trình đã duyệt" còn nằm lại khi NV check-out thật sau đó cùng ngày.
-- Hiển thị giờ/ngày lấy từ chính mốc đã ghi thay vì now().
CREATE OR REPLACE FUNCTION public.notify_attendance_discord()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _emp            record;
  _shift          record;
  _has_shift      boolean := false;
  _break_min      int := 60;
  _discord_url    text;
  _kind           text;
  _stamp          timestamptz;
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
  IF TG_OP = 'INSERT' THEN
    _kind := 'in';  _stamp := NEW.check_in;
  ELSIF TG_OP = 'UPDATE' AND OLD.check_out IS NULL AND NEW.check_out IS NOT NULL THEN
    _kind := 'out'; _stamp := NEW.check_out;
  ELSIF TG_OP = 'UPDATE' AND OLD.ot_check_in IS NULL AND NEW.ot_check_in IS NOT NULL THEN
    _kind := 'ot_in'; _stamp := NEW.ot_check_in;
  ELSIF TG_OP = 'UPDATE' AND OLD.ot_check_out IS NULL AND NEW.ot_check_out IS NOT NULL THEN
    _kind := 'ot_out'; _stamp := NEW.ot_check_out;
  ELSE
    RETURN NEW;
  END IF;

  -- Bổ sung sau (duyệt đơn quên chấm / sửa tay) ⇒ không báo Discord
  IF _stamp IS NULL
     OR abs(EXTRACT(EPOCH FROM (now() - _stamp))) > 900 THEN
    RETURN NEW;
  END IF;

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

  _vn_time := to_char(_stamp AT TIME ZONE 'Asia/Ho_Chi_Minh', 'HH24:MI');

  IF _kind = 'in' THEN
    _title := '🟢 CHECK IN — ' || _emp.full_name;
    _color := 5025616;
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
    _color := 15548997;
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
    _color := 16750848;
    _msg   := _ot_in_msgs[1 + floor(random() * array_length(_ot_in_msgs, 1))::int];

    _fields := jsonb_build_array(
      jsonb_build_object('name', '⏰ Bat dau OT', 'value', _vn_time, 'inline', true)
    );

  ELSE
    _title := '🟣 CHECK OUT OT — ' || _emp.full_name;
    _color := 10181046;
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
            'text', 'TD Games Attendance • ' || to_char(_stamp AT TIME ZONE 'Asia/Ho_Chi_Minh', 'DD/MM/YYYY')
          )
        )
      )
    )
  );

  RETURN NEW;
END;
$function$;
