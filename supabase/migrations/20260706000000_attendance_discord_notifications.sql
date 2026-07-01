-- Attendance Discord Notifications
-- Phase 2 of employee check-in geolocation system
--
-- 1. Add discord_user_id to hr_employees
-- 2. Create trigger function for check-in/check-out Discord notifications
-- 3. Create triggers on att_records
-- 4. Filter: skip freelancers, include shift info

-- ── 1. Add discord_user_id column ────────────────────────────
ALTER TABLE hr_employees
  ADD COLUMN IF NOT EXISTS discord_user_id TEXT DEFAULT '';

-- ── 2. Trigger function ──────────────────────────────────────
CREATE OR REPLACE FUNCTION public.notify_attendance_discord()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _emp            record;
  _shift          record;
  _discord_url    text;
  _is_checkin     boolean;
  _vn_time        text;
  _title          text;
  _color          int;
  _fields         jsonb;
  _content        text := '';
  _hours          numeric;
  _work_days      numeric;
  _duration_text  text;
  -- Random check-in messages
  _checkin_msgs   text[] := ARRAY[
    'Ngay moi tran day nang luong! Cung lam viec thoi nao! 🔥',
    'Chuc mot ngay lam viec hieu qua! 💪',
    'Let''s gooo! Mot ngay moi, mot co hoi moi! 🚀',
    'Sang nay tran day cam hung! ☀️',
    'Bat dau ngay moi thoi! ⚡',
    'Good morning! Hom nay se la mot ngay tuyet voi 🌟',
    'Rise and shine! Chay het cong suat nao! 🏃'
  ];
  -- Random check-out messages
  _checkout_msgs  text[] := ARRAY[
    'Nghi ngoi xung dang nhe! Hen gap lai ngay mai 👋',
    'Mot ngay lam viec tuyet voi! Ve nghi ngoi thoi 🌙',
    'Good job hom nay! See you tomorrow 🎉',
    'Het gio roi! Tan huong buoi toi nhe 🌆',
    'Cam on vi mot ngay cong hien! 💯',
    'Well done! Hen gap lai ngay mai nhe 🫡',
    'Bai bai! Have a great evening 🏠'
  ];
  _msg            text;
BEGIN
  -- Get webhook URL from app_config
  SELECT value INTO _discord_url
  FROM   public.app_config
  WHERE  key = 'discord_attendance_webhook'
  LIMIT  1;

  IF _discord_url IS NULL OR _discord_url = '' THEN
    RETURN NEW;
  END IF;

  -- Get employee info — skip freelancers
  SELECT e.full_name, e.discord_user_id, e.type
  INTO   _emp
  FROM   hr_employees e
  WHERE  e.id = NEW.employee_id
  LIMIT  1;

  IF _emp IS NULL OR _emp.type = 'freelancer' THEN
    RETURN NEW;
  END IF;

  -- Determine check-in vs check-out
  IF TG_OP = 'INSERT' THEN
    _is_checkin := true;
  ELSIF TG_OP = 'UPDATE' AND OLD.check_out IS NULL AND NEW.check_out IS NOT NULL THEN
    _is_checkin := false;
  ELSE
    RETURN NEW;
  END IF;

  -- Get shift info if available
  IF NEW.shift_id IS NOT NULL THEN
    SELECT s.name, s.start_time, s.end_time
    INTO   _shift
    FROM   att_shifts s
    WHERE  s.id = NEW.shift_id
    LIMIT  1;
  END IF;

  _vn_time := to_char(now() AT TIME ZONE 'Asia/Ho_Chi_Minh', 'HH24:MI');

  IF _is_checkin THEN
    -- ── CHECK IN ──
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

    -- Add shift info
    IF _shift IS NOT NULL THEN
      _fields := _fields || jsonb_build_array(
        jsonb_build_object('name', '📋 Ca lam viec', 'value',
          _shift.name || ' (' || _shift.start_time || ' – ' || _shift.end_time || ')',
          'inline', false)
      );
    END IF;

  ELSE
    -- ── CHECK OUT ──
    _title := '🔴 CHECK OUT — ' || _emp.full_name;
    _color := 15548997; -- #ED4245 red
    _msg   := _checkout_msgs[1 + floor(random() * array_length(_checkout_msgs, 1))::int];

    -- Calculate work duration
    IF NEW.check_in IS NOT NULL AND NEW.check_out IS NOT NULL THEN
      _hours         := EXTRACT(EPOCH FROM (NEW.check_out::timestamptz - NEW.check_in::timestamptz)) / 3600.0;
      _work_days     := ROUND(_hours / 8.0, 2);
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

    -- Add shift info
    IF _shift IS NOT NULL THEN
      _fields := _fields || jsonb_build_array(
        jsonb_build_object('name', '📋 Ca lam viec', 'value',
          _shift.name || ' (' || _shift.start_time || ' – ' || _shift.end_time || ')',
          'inline', false)
      );
    END IF;
  END IF;

  -- Add random quote
  _fields := _fields || jsonb_build_array(
    jsonb_build_object('name', '💬', 'value', '"' || _msg || '"', 'inline', false)
  );

  -- Build content with Discord mention
  IF _emp.discord_user_id IS NOT NULL AND _emp.discord_user_id <> '' THEN
    _content := '<@' || _emp.discord_user_id || '>';
  END IF;

  -- POST to Discord webhook
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

-- ── 3. Triggers ──────────────────────────────────────────────
-- Check-in: fires on INSERT
DROP TRIGGER IF EXISTS trg_attendance_discord_checkin ON att_records;
CREATE TRIGGER trg_attendance_discord_checkin
  AFTER INSERT ON att_records
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_attendance_discord();

-- Check-out: fires on UPDATE when check_out changes from NULL to a value
DROP TRIGGER IF EXISTS trg_attendance_discord_checkout ON att_records;
CREATE TRIGGER trg_attendance_discord_checkout
  AFTER UPDATE OF check_out ON att_records
  FOR EACH ROW
  WHEN (OLD.check_out IS NULL AND NEW.check_out IS NOT NULL)
  EXECUTE FUNCTION public.notify_attendance_discord();
